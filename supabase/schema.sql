-- ============================================================
-- Church Sunday School Management App – Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- 1. STUDENTS ─────────────────────────────────────────────────
create table if not exists students (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  nickname       text,
  code           text unique,
  grade          text,
  grade_id       text,
  academic_year  text,
  room           text,
  school         text,
  gender         text,
  parent_phone   text,
  parent_phone_2 text,
  parent_name    text,
  parent_relation text,
  birth_date     text,
  address        text,
  nearest_church text,
  servant        text,
  status         text default 'منتظم',
  last_attendance text,
  attendance_rate int default 0,
  blood_type     text,
  medical_notes  text,
  hobbies        text[],
  avatar         text,
  avatar_color   text,
  notes          text,
  created_at     timestamptz default now()
);

-- 2. ATTENDANCE RECORDS ───────────────────────────────────────
create table if not exists attendance_records (
  id              uuid primary key default gen_random_uuid(),
  student_id      uuid references students(id) on delete cascade,
  attendance_date date not null,
  status          text not null,  -- حاضر | غائب | معتذر
  created_at      timestamptz default now(),
  unique (student_id, attendance_date)
);

-- 3. FOLLOW-UP TASKS ──────────────────────────────────────────
create table if not exists follow_ups (
  id               uuid primary key default gen_random_uuid(),
  student_id       uuid references students(id) on delete cascade unique,
  student_name     text,
  avatar           text,
  avatar_color     text,
  grade            text,
  absence_duration text,
  last_contact     text,
  status           text,
  type             text,  -- مكالمة | زيارة | رسالة
  notes            text,
  urgency          text default 'normal',  -- urgent | normal
  created_at       timestamptz default now()
);

-- 4. FOLLOW-UP LOGS ───────────────────────────────────────────
create table if not exists follow_up_logs (
  id             uuid primary key default gen_random_uuid(),
  student_id     uuid references students(id) on delete cascade,
  student_name   text,
  type           text,
  notes          text,
  contact_status text,
  servant_name   text,
  created_at     timestamptz default now()
);

-- ============================================================
-- SEED DATA (mock students)
-- ============================================================
insert into students (name, code, grade, grade_id, gender, parent_phone, parent_name, birth_date, address, status, last_attendance, attendance_rate, blood_type, medical_notes, hobbies, avatar, avatar_color, notes) values
  ('بيشوي أنطونيوس',   'STD-4401', 'الثالث الابتدائي',  'grade3', 'ذكر',  '01234567890', 'أنطونيوس ميخائيل', '15 مايو 2013',     'شارع فيصل، الجيزة',       'منتظم',        'الأحد الماضي',  92, 'O+',  'لا يوجد', ARRAY['كرة القدم','الرسم'],    'ب أ', '#1D4ED8', 'طالب متميز ومواظب. يشارك في أنشطة الكورال.'),
  ('كيرلس مرقس',       'STD-4415', 'الرابع الابتدائي',  'grade4', 'ذكر',  '01123456789', 'مرقس عبدالمسيح',  '3 أغسطس 2012',    'المنيل، القاهرة',          'يحتاج افتقاد', 'منذ شهر',       45, 'A+',  'لا يوجد', ARRAY['كرة القدم'],           'ك م', '#7C3AED', 'يحتاج للمتابعة المستمرة.'),
  ('مينا جرجس',        'STD-4388', 'الثالث الابتدائي',  'grade3', 'ذكر',  '01098765432', 'جرجس حبيب',       '22 يناير 2013',    'شبرا، القاهرة',            'منتظم',        'الأحد الماضي',  88, 'B+',  'لا يوجد', ARRAY['القراءة','السباحة'],   'م ج', '#0D9488', 'حضور منتظم. يتفاعل بشكل جيد.'),
  ('أبانوب رأفت',      'STD-4402', 'الأول الابتدائي',   'grade1', 'ذكر',  '01567891234', 'رأفت سمير',       '10 مارس 2015',    'الدقي، الجيزة',            'جديد',         'الأحد الماضي',  75, 'O+',  'لا يوجد', ARRAY['الرسم'],               'أ ر', '#EA580C', 'طالب جديد. بدأ الحضور منذ شهر.'),
  ('مارينا كمال صبحي', 'STD-4390', 'الثاني الابتدائي',  'grade2', 'أنثى', '01234509876', 'كمال صبحي',       '7 يوليو 2014',    'حلوان، القاهرة',           'يحتاج افتقاد', 'الأسبوع الماضي',60, 'AB+', 'لا يوجد', ARRAY['الموسيقى','الرسم'],    'م ص', '#DB2777', 'تحتاج لمتابعة أسبوعية.'),
  ('مينا تادرس فوزي',  'STD-4367', 'الخامس الابتدائي', 'grade5', 'ذكر',  '01011223344', 'تادرس فوزي',      '1 سبتمبر 2011',   'مدينة نصر، القاهرة',      'يحتاج افتقاد', 'منذ أسبوعين',   55, 'A-',  'لا يوجد', ARRAY['كرة السلة'],           'م ت', '#16A34A', 'يحتاج لتشجيع مستمر.'),
  ('ريتا سمير جورج',   'STD-4421', 'الرابع الابتدائي',  'grade4', 'أنثى', '01055667788', 'سمير جورج',       '15 فبراير 2012',  'مصر الجديدة، القاهرة',    'منتظم',        'الأحد الماضي',  95, 'O-',  'لا يوجد', ARRAY['الغناء','القراءة'],    'ر س', '#9333EA', 'متميزة في الحضور والتفاعل.'),
  ('جوليا رأفت كمال',  'STD-4598', 'الأول الابتدائي',   'grade1', 'أنثى', '01587654321', 'رأفت كمال',       '20 ديسمبر 2015', 'الزيتون، القاهرة',         'جديد',         'لم تحضر بعد',   0,  'B-',  'لا يوجد', ARRAY[]::text[],              'ج ر', '#DC2626', 'مسجلة حديثاً. لم تحضر بعد.')
on conflict (code) do nothing;

-- Seed follow-ups (students who need follow-up)
insert into follow_ups (student_id, student_name, avatar, avatar_color, grade, absence_duration, last_contact, status, type, notes, urgency)
select id, name, avatar, avatar_color, grade, 'غائب منذ ٣ أسابيع', 'لم يتم التواصل', 'عاجل', null, '', 'urgent'
from students where code = 'STD-4415'
on conflict (student_id) do nothing;

insert into follow_ups (student_id, student_name, avatar, avatar_color, grade, absence_duration, last_contact, status, type, notes, urgency)
select id, name, avatar, avatar_color, grade, 'غائبة منذ أسبوعين', 'تم التواصل - رسالة', 'تحتاج مكالمة ترحيب', 'رسالة', '', 'normal'
from students where code = 'STD-4390'
on conflict (student_id) do nothing;

insert into follow_ups (student_id, student_name, avatar, avatar_color, grade, absence_duration, last_contact, status, type, notes, urgency)
select id, name, avatar, avatar_color, grade, 'غائب منذ أسبوعين', 'زيارة مجدولة', 'زيارة مجدولة', 'زيارة', '', 'normal'
from students where code = 'STD-4367'
on conflict (student_id) do nothing;

-- Seed follow-up logs
insert into follow_up_logs (student_name, type, notes, contact_status, servant_name) values
  ('يوحنا عماد',  'زيارة',   'زيارة منزلية: الأسرة ترحب بالخادم. الطالب سيعود للحضور القادم.', 'تم التواصل', 'أ. مينا كمال'),
  ('ديفيد نبيل',  'مكالمة', 'مكالمة هاتفية: الطالب مريض قليلاً. تم الصلاة معه هاتفياً.',      'تم التواصل', 'أ. مينا كمال'),
  ('توماس أشرف',  'رسالة',   'رسالة واتساب: تم إرسال مادة الدرس وتحديد موعد للزيارة.',          'يحتاج متابعة','أ. مينا كمال');

-- Enable Row Level Security (RLS) and allow anon read/write for now
-- (Tighten these policies before production)
alter table students           enable row level security;
alter table attendance_records enable row level security;
alter table follow_ups         enable row level security;
alter table follow_up_logs     enable row level security;

create policy "Allow all for anon" on students           for all using (true) with check (true);
create policy "Allow all for anon" on attendance_records for all using (true) with check (true);
create policy "Allow all for anon" on follow_ups         for all using (true) with check (true);
create policy "Allow all for anon" on follow_up_logs     for all using (true) with check (true);
