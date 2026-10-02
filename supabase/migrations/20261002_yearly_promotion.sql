CREATE TABLE IF NOT EXISTS yearly_promotion_logs (
    id uuid primary key default gen_random_uuid(),
    executed_by uuid references profiles(id),
    executed_at timestamptz default now(),
    promotion_year text not null,
    affected_students_count int not null,
    affected_profiles_count int not null,
    details jsonb
);

ALTER TABLE yearly_promotion_logs ADD CONSTRAINT uq_promotion_year UNIQUE (promotion_year);

CREATE TABLE IF NOT EXISTS yearly_promotion_log_items (
    id uuid primary key default gen_random_uuid(),
    promotion_log_id uuid references yearly_promotion_logs(id) on delete cascade,
    entity_type text not null,
    entity_id uuid not null,
    old_grade text,
    new_grade text,
    created_at timestamptz default now()
);

-- RPC for execution
CREATE OR REPLACE FUNCTION execute_yearly_promotion(
    p_executed_by uuid,
    p_promotion_year text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_log_id uuid;
    v_student_count int := 0;
    v_profile_count int := 0;
    v_student record;
    v_profile record;
    v_new_grade text;
    v_new_grades text[];
    v_old_grade text;
    v_old_grades text[];
    i int;
BEGIN
    -- Check if already executed
    IF EXISTS (SELECT 1 FROM yearly_promotion_logs WHERE promotion_year = p_promotion_year) THEN
        RAISE EXCEPTION 'تم تنفيذ ترحيل هذه السنة من قبل';
    END IF;

    -- Insert log record
    INSERT INTO yearly_promotion_logs (executed_by, promotion_year, affected_students_count, affected_profiles_count, details)
    VALUES (p_executed_by, p_promotion_year, 0, 0, '{}'::jsonb)
    RETURNING id INTO v_log_id;

    -- Create temporary table for mapping
    CREATE TEMP TABLE tmp_grade_map (old_g text, new_g text) ON COMMIT DROP;
    INSERT INTO tmp_grade_map VALUES
        ('حضانه أولى', 'حضانه ثانية'),
        ('حضانه ثانية', 'أولى ابتدائي'),
        ('الأول الابتدائي', 'الثاني الابتدائي'),
        ('الثاني الابتدائي', 'الثالث الابتدائي'),
        ('الثالث الابتدائي', 'الرابع الابتدائي'),
        ('الرابع الابتدائي', 'الخامس الابتدائي'),
        ('الخامس الابتدائي', 'السادس الابتدائي'),
        ('السادس الابتدائي', 'الأول الإعدادي'),
        ('الأول الإعدادي', 'الثاني الإعدادي'),
        ('الثاني الإعدادي', 'الثالث الإعدادي'),
        ('الثالث الإعدادي', 'الأول الثانوي'),
        ('الأول الثانوي', 'الثاني الثانوي'),
        ('الثاني الثانوي', 'الثالث الثانوي'),
        ('الثالث الثانوي', 'خريجين');

    -- Process students
    FOR v_student IN SELECT id, grade FROM students WHERE grade IN (SELECT old_g FROM tmp_grade_map)
    LOOP
        SELECT new_g INTO v_new_grade FROM tmp_grade_map WHERE old_g = v_student.grade;
        
        UPDATE students SET grade = v_new_grade WHERE id = v_student.id;
        
        INSERT INTO yearly_promotion_log_items (promotion_log_id, entity_type, entity_id, old_grade, new_grade)
        VALUES (v_log_id, 'student', v_student.id, v_student.grade, v_new_grade);
        
        v_student_count := v_student_count + 1;
    END LOOP;

    -- Process profiles (assigned_grade)
    FOR v_profile IN SELECT id, assigned_grade FROM profiles WHERE assigned_grade IN (SELECT old_g FROM tmp_grade_map)
    LOOP
        SELECT new_g INTO v_new_grade FROM tmp_grade_map WHERE old_g = v_profile.assigned_grade;
        
        UPDATE profiles SET assigned_grade = v_new_grade WHERE id = v_profile.id;
        
        INSERT INTO yearly_promotion_log_items (promotion_log_id, entity_type, entity_id, old_grade, new_grade)
        VALUES (v_log_id, 'profile_assigned_grade', v_profile.id, v_profile.assigned_grade, v_new_grade);
        
        v_profile_count := v_profile_count + 1;
    END LOOP;

    -- Process profiles (assigned_grades array)
    FOR v_profile IN SELECT id, assigned_grades FROM profiles WHERE assigned_grades IS NOT NULL AND array_length(assigned_grades, 1) > 0
    LOOP
        v_new_grades := ARRAY[]::text[];
        v_old_grades := v_profile.assigned_grades;
        
        FOR i IN 1 .. array_length(v_old_grades, 1)
        LOOP
            SELECT new_g INTO v_new_grade FROM tmp_grade_map WHERE old_g = v_old_grades[i];
            IF v_new_grade IS NULL THEN
                v_new_grade := v_old_grades[i]; -- keep as is if no mapping found (e.g., خريجين)
            END IF;
            v_new_grades := array_append(v_new_grades, v_new_grade);
        END LOOP;
        
        -- Check if anything changed
        IF v_new_grades != v_old_grades THEN
            UPDATE profiles SET assigned_grades = v_new_grades WHERE id = v_profile.id;
            
            INSERT INTO yearly_promotion_log_items (promotion_log_id, entity_type, entity_id, old_grade, new_grade)
            VALUES (v_log_id, 'profile_assigned_grades', v_profile.id, array_to_string(v_old_grades, ','), array_to_string(v_new_grades, ','));
            
            v_profile_count := v_profile_count + 1;
        END IF;
    END LOOP;

    -- Update log counts
    UPDATE yearly_promotion_logs 
    SET affected_students_count = v_student_count, 
        affected_profiles_count = v_profile_count 
    WHERE id = v_log_id;

    RETURN json_build_object(
        'success', true,
        'affected_students_count', v_student_count,
        'affected_profiles_count', v_profile_count,
        'log_id', v_log_id
    );
END;
$$;
