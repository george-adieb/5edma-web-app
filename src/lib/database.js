import { supabase } from './supabase';
import { GRADE_LABEL_MAP } from '../data/constants';
import { getRecentFridays } from './attendanceCycle';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayISO() {
  return new Date().toISOString().split('T')[0]; // YYYY-MM-DD
}

/**
 * Apply grade/gender scoping to a Supabase query for SERVANT role.
 * For any other role (or if profile is null) the query is returned unchanged.
 */
function applyServantScope(query, profile) {
  if (profile?.role === 'SERVANT') {
    query = query.eq('grade', profile.assigned_grade).eq('gender', profile.assigned_gender);
  }
  return query;
}

// ─── STUDENTS ─────────────────────────────────────────────────────────────────

/** Fetch all students ordered by name, with role-based filtering */
export async function fetchStudents(profile = null) {
  let query = supabase.from('students').select('*');
  query = applyServantScope(query, profile);
  const { data, error } = await query.order('name');
  if (error) throw error;
  return data;
}

/**
 * Fetch students who need follow-up (status = 'يحتاج افتقاد').
 * Used by the Follow-up page list and form dropdown.
 */
export async function fetchStudentsNeedingFollowUp() {
  const { data, error } = await supabase
    .from('students')
    .select('id, name, grade, avatar, avatar_color, parent_phone, status')
    .eq('status', 'يحتاج افتقاد')
    .order('name');
  if (error) throw error;
  return data || [];
}

/**
 * Fetch follow-up candidates driven entirely by real attendance data.
 *
 * Algorithm:
 *   1. Query attendance_records for the given Friday dates.
 *   2. For every student who has at least one "غائب" record, compute:
 *        - totalAbsences   — total غائب records in the window
 *        - consecutive     — longest streak of غائب Fridays ending at the
 *                            most-recent Friday they appear in (streak breaks
 *                            on the first non-غائب record when scanning newest→oldest)
 *   3. Exclude students with zero absences.
 *   4. Sort: consecutive desc → totalAbsences desc (most urgent first).
 *   5. Fetch full student details and return merged objects.
 *
 * @param {string[]} recentFridays  Ordered list of Friday ISO dates (most-recent first).
 *                                  Generate with getRecentFridays() from attendanceCycle.js.
 *
 * Each returned object has the student's DB fields plus:
 *   absenceTotal       {number}
 *   absenceConsecutive {number}
 *
 * Extensibility note: consecutive is computed client-side from individual
 * records, so richer streak rules (e.g. "skip معتذر without breaking streak")
 * can be added to the loop below without touching the query.
 */
export async function fetchFollowUpCandidates(recentFridays, profile = null) {
  if (!recentFridays || recentFridays.length === 0) return [];

  // When scoped to a servant, first get the IDs of students in their group
  // so we only process attendance records for those students.
  let scopedStudentIds = null;
  if (profile?.role === 'SERVANT') {
    const { data: scopedStudents, error: scopeErr } = await supabase
      .from('students')
      .select('id')
      .eq('grade', profile.assigned_grade)
      .eq('gender', profile.assigned_gender);
    if (scopeErr) throw scopeErr;
    scopedStudentIds = (scopedStudents || []).map(s => s.id);
    if (scopedStudentIds.length === 0) return [];
  }

  // Fetch all attendance records for the given Fridays (all statuses so we
  // can detect streak breaks caused by a حاضر or معتذر record).
  let recordsQuery = supabase
    .from('attendance_records')
    .select('student_id, attendance_date, status')
    .in('attendance_date', recentFridays);
  if (scopedStudentIds) {
    recordsQuery = recordsQuery.in('student_id', scopedStudentIds);
  }
  const { data: records, error } = await recordsQuery;
  if (error) throw error;
  if (!records || records.length === 0) return [];

  // Group records by student_id, sorted newest → oldest
  const byStudent = {};
  for (const rec of records) {
    if (!byStudent[rec.student_id]) byStudent[rec.student_id] = [];
    byStudent[rec.student_id].push(rec);
  }

  for (const id of Object.keys(byStudent)) {
    byStudent[id].sort((a, b) => b.attendance_date.localeCompare(a.attendance_date));
  }

  // Calculate absence metrics per student
  const metrics = [];
  for (const [studentId, recs] of Object.entries(byStudent)) {
    const totalAbsences = recs.filter(r => r.status === 'غائب').length;
    if (totalAbsences === 0) continue; // no absences → not a follow-up candidate

    const latestAbsence = recs.find(r => r.status === 'غائب');
    const latestAbsenceDate = latestAbsence ? latestAbsence.attendance_date : null;

    // Consecutive streak: scan newest → oldest, count leading غائب records.
    let consecutive = 0;
    for (const r of recs) {
      if (r.status === 'غائب') consecutive++;
      else break;
    }

    metrics.push({ studentId, totalAbsences, consecutive, latestAbsenceDate });
  }

  if (metrics.length === 0) return [];

  // Fetch latest follow-up log for these students
  const ids = metrics.map(m => m.studentId);
  const { data: logs, error: eLogs } = await supabase
    .from('follow_up_logs')
    .select('student_id, contact_status, created_at, type')
    .in('student_id', ids)
    .order('created_at', { ascending: false });

  const latestLogs = {};
  for (const log of (logs || [])) {
    if (!latestLogs[log.student_id]) {
      latestLogs[log.student_id] = log;
    }
  }

  const resolvedStatuses = ['تم التواصل', 'عاد للانتظام', 'منتظم'];

  // Filter out candidates if their latest log marks them as resolved AFTER their latest absence
  const activeMetrics = metrics.filter(m => {
    const lat = latestLogs[m.studentId];
    if (!lat) return true; // keep

    if (resolvedStatuses.includes(lat.contact_status)) {
      // Check if the log was created on or after the day of the latest absence
      if (lat.created_at.localeCompare(m.latestAbsenceDate) >= 0) {
        return false; // exclude
      }
    }
    return true; // keep
  });

  if (activeMetrics.length === 0) return [];

  // Sort: consecutive desc, then totalAbsences desc
  activeMetrics.sort((a, b) =>
    b.consecutive  - a.consecutive  ||
    b.totalAbsences - a.totalAbsences
  );

  // Fetch student details
  const activeIds = activeMetrics.map(m => m.studentId);
  const { data: students, error: e2 } = await supabase
    .from('students')
    .select('id, name, grade, avatar, avatar_color, parent_phone, status')
    .in('id', activeIds);
  if (e2) throw e2;

  const studentMap = Object.fromEntries((students || []).map(s => [String(s.id), s]));

  // Merge and return
  return activeMetrics
    .map(m => {
      const s = studentMap[String(m.studentId)];
      if (!s) return null;
      const lat = latestLogs[m.studentId];
      return { 
        ...s, 
        absenceTotal: m.totalAbsences, 
        absenceConsecutive: m.consecutive, 
        latestLog: lat ? {
          type: lat.type,
          contact_status: lat.contact_status,
          time: timeAgo(lat.created_at)
        } : null
      };
    })
    .filter(Boolean);
}

/**
 * Update only the status field of a student.
 * Used when a follow-up closes a case (e.g. student returned to regularity).
 */
export async function updateStudentStatus(id, status) {
  const { error } = await supabase
    .from('students')
    .update({ status })
    .eq('id', id);
  if (error) throw error;
}

/** Fetch a single student by id */
export async function fetchStudent(id) {
  const { data, error } = await supabase
    .from('students')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

/** Fetch students who have upcoming birthdays in the next 7 days */
export async function fetchUpcomingBirthdays(profile = null) {
  let query = supabase
    .from('students')
    .select('id, name, grade, birth_date, avatar, avatar_color')
    .not('birth_date', 'is', null);
  query = applyServantScope(query, profile);

  const { data, error } = await query;
  if (error) {
    console.warn('[fetchUpcomingBirthdays] error:', error);
    return [];
  }

  const today = new Date();
  const currentYear = today.getFullYear();
  const upcoming = [];

  for (const student of data || []) {
    if (!student.birth_date) continue;
    if (!student.birth_date.includes('-')) continue;

    const [y, m, d] = student.birth_date.split('-');
    if (!m || !d) continue;

    const bMonth = parseInt(m, 10);
    const bDay = parseInt(d, 10);

    let nextBday = new Date(currentYear, bMonth - 1, bDay);
    
    today.setHours(0, 0, 0, 0);
    nextBday.setHours(0, 0, 0, 0);

    let diffTime = nextBday - today;
    
    if (diffTime < 0) {
      nextBday = new Date(currentYear + 1, bMonth - 1, bDay);
      nextBday.setHours(0, 0, 0, 0);
      diffTime = nextBday - today;
    }

    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays >= 0 && diffDays <= 7) {
      upcoming.push({
        ...student,
        daysUntil: diffDays,
        formattedBday: `${bDay}/${bMonth}`
      });
    }
  }

  return upcoming.sort((a,b) => a.daysUntil - b.daysUntil);
}

/** Insert a new student */
export async function insertStudent(studentData) {
  // Auto-generate a STD code
  const code = `STD-${Math.floor(4000 + Math.random() * 1000)}`;
  // Derive avatar initials from name
  const parts = studentData.fullName.trim().split(' ');
  const avatar = parts.length >= 2
    ? `${parts[0].charAt(0)} ${parts[parts.length - 1].charAt(0)}`
    : parts[0].charAt(0);
  const COLORS = ['#1D4ED8','#7C3AED','#0D9488','#EA580C','#16A34A','#DB2777','#9333EA','#DC2626'];
  const avatarColor = COLORS[Math.floor(Math.random() * COLORS.length)];

  // Parse hobbies — support both Arabic comma (،) and Latin comma (,)
  const hobbiesList = studentData.hobbies
    ? studentData.hobbies.split(/[،,]/).map(h => h.trim()).filter(Boolean)
    : [];

  // Build payload — matching real columns in Supabase
  const row = {
    code,
    name:          studentData.fullName,
    nickname:      studentData.nickname      || null,
    grade:         gradeLabel(studentData.grade) || null,
    school:        studentData.school        || null,
    gender:        studentData.gender        || null,
    birth_date:    studentData.birthDate     || null,
    parent_name:   studentData.parentName    || null,
    parent_relation: studentData.parentRelation || null,
    parent_phone:  studentData.parentPhone   || null,
    parent_phone_2: studentData.parentPhone2 || null,
    address:       studentData.address       || null,
    nearest_church: studentData.nearestChurch || null,
    servant:       studentData.servant       || null,
    status:        studentData.studentStatus || 'منتظم',
    medical_notes: studentData.medicalNotes  || null,
    hobbies:       hobbiesList,
    avatar,
    avatar_color:  avatarColor,
    notes:         studentData.notes         || null,
  };
  // ⛔ NOT sent: attendance_rate, last_attendance, grade, grade_id — not real DB columns

  console.log('[insertStudent] payload →', row);
  const { data, error } = await supabase.from('students').insert(row).select().single();
  console.log('[insertStudent] response →', data);
  if (error) {
    console.error('[insertStudent] error →', error);
    throw error;
  }
  return data;
}

/** Update an existing student */
export async function updateStudent(id, studentData) {
  let hobbiesList = [];
  if (typeof studentData.hobbies === 'string') {
    hobbiesList = studentData.hobbies.split(/[،,]/).map(h => h.trim()).filter(Boolean);
  } else if (Array.isArray(studentData.hobbies)) {
    hobbiesList = studentData.hobbies;
  }

  const row = {
    name:          studentData.fullName,
    nickname:      studentData.nickname      || null,
    grade:         gradeLabel(studentData.grade) || null,
    school:        studentData.school        || null,
    gender:        studentData.gender        || null,
    birth_date:    studentData.birthDate     || null,
    parent_name:   studentData.parentName    || null,
    parent_relation: studentData.parentRelation || null,
    parent_phone:  studentData.parentPhone   || null,
    parent_phone_2: studentData.parentPhone2 || null,
    address:       studentData.address       || null,
    nearest_church: studentData.nearestChurch || null,
    servant:       studentData.servant       || null,
    status:        studentData.studentStatus || 'منتظم',
    medical_notes: studentData.medicalNotes  || null,
    hobbies:       hobbiesList,
    notes:         studentData.notes         || null,
  };

  console.log('[updateStudent] payload →', row);
  const { data, error } = await supabase.from('students').update(row).eq('id', id).select().single();
  if (error) {
    console.error('[updateStudent] error →', error);
    throw error;
  }
  return data;
}

export function gradeLabel(gradeId) {
  return GRADE_LABEL_MAP[gradeId] || gradeId;
}

/** Delete a student and related records */
export async function deleteStudent(id) {
  // Delete related records first to avoid foreign key constraints
  await supabase.from('attendance_records').delete().eq('student_id', id);
  await supabase.from('follow_up_logs').delete().eq('student_id', id);
  await supabase.from('follow_ups').delete().eq('student_id', id);

  const { error } = await supabase.from('students').delete().eq('id', id);
  if (error) {
    console.error('[deleteStudent] error →', error);
    throw error;
  }
}

// ─── SERVANTS ─────────────────────────────────────────────────────────────────

/** Fetch all servants ordered by name */
export async function fetchServants() {
  const { data, error } = await supabase
    .from('servants')
    .select('*')
    .order('full_name');
  if (error) throw error;
  return data;
}

/** Insert a new servant */
export async function insertServant(servantData) {
  const role = servantData.role || null;

  // Stage mapping: each role gets exactly one of {stage_group, stage}, the other is null
  const stageGroup = role === 'أمين خدمة'  ? (servantData.stageGroup || null) : null;
  const stage      = role === 'خادم مرحلة' ? (servantData.stage      || null) : null;

  const row = {
    full_name:          servantData.fullName          || null,
    nickname:           servantData.nickname          || null,
    gender:             servantData.gender            || null,
    birth_date:         servantData.birthDate         || null,
    email:              servantData.email             || null,
    phone:              servantData.phone             || null,
    secondary_phone:    servantData.secondaryPhone    || null,
    role,
    stage_group:        stageGroup,
    stage,
    service_start_date: servantData.serviceStartDate  || null,
    status:             servantData.status            || 'نشط',
    supervisor_name:    servantData.supervisorName    || null,
    address:            servantData.address           || null,
    nearest_church:     servantData.nearestChurch     || null,
    hobbies:            servantData.hobbies           || null,
    notes:              servantData.notes             || null,
    medical_notes:      servantData.medicalNotes      || null,
  };

  console.log('[insertServant] payload →', row);
  const { data, error } = await supabase.from('servants').insert(row).select().single();
  console.log('[insertServant] response →', data);
  if (error) {
    console.error('[insertServant] error →', error);
    throw error;
  }
  return data;
}

// ─── ATTENDANCE ───────────────────────────────────────────────────────────────

/** Fetch all attendance records for a given date (defaults: today) */
export async function fetchAttendanceForDate(date = todayISO()) {
  const { data, error } = await supabase
    .from('attendance_records')
    .select('student_id, status')
    .eq('attendance_date', date);
  if (error) throw error;
  // Return as { [student_id]: status }
  return Object.fromEntries(data.map(r => [r.student_id, r.status]));
}

/** 
 * Fetch the latest previous attendance date (status='حاضر') for each student, strictly before the targetDate.
 * Used to populate the "آخر حضور" column in the Attendance page dynamically.
 */
export async function fetchLastAttendancesBeforeDate(targetDate) {
  // We fetch all records with status='حاضر' to strictly filter and group them client-side.
  // This explicitly prevents any DB timezone `.lt` parsing bugs from returning future dates.
  const { data, error } = await supabase
    .from('attendance_records')
    .select('student_id, attendance_date')
    .eq('status', 'حاضر');

  if (error) {
    console.error('[fetchLastAttendancesBeforeDate] error:', error);
    return {};
  }

  const grouped = {};
  for (const r of data || []) {
    const dateStr = r.attendance_date ? r.attendance_date.split('T')[0] : null;
    if (!dateStr) continue;
    
    // 1. Ensure comparison only considers attendance_date strictly LESS THAN selected_friday
    //    and automatically excludes targetDate itself or any future dates.
    if (dateStr < targetDate) {
      if (!grouped[r.student_id]) grouped[r.student_id] = [];
      grouped[r.student_id].push(dateStr);
    }
  }

  const map = {};
  for (const [studentId, dates] of Object.entries(grouped)) {
    // 2. Sort descending to grab the absolute max previous date
    dates.sort((a, b) => b.localeCompare(a));
    const maxDateStr = dates[0];
    
    if (maxDateStr.includes('-')) {
      const [y, m, d] = maxDateStr.split('-');
      if (y && m && d) {
        // Build isolated local time ensuring no rolling offsets
        const localDate = new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10));
        map[studentId] = localDate.toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' });
      } else {
        map[studentId] = maxDateStr;
      }
    } else {
      map[studentId] = maxDateStr;
    }
  }
  
  return map;
}

/** Fetch full attendance history for a single student */
export async function fetchStudentAttendance(studentId) {
  const { data, error } = await supabase
    .from('attendance_records')
    .select('attendance_date, status')
    .eq('student_id', studentId)
    .order('attendance_date', { ascending: false })
    .limit(20);
  if (error) throw error;
  return data.map(r => ({
    date: formatDate(r.attendance_date),
    status: r.status,
  }));
}

/** Upsert a batch of attendance records for today */
export async function saveAttendance(records, date = todayISO()) {
  const rows = Object.entries(records)
    .filter(([, status]) => status)
    .map(([student_id, status]) => ({
      student_id,
      attendance_date: date,
      status,
    }));

  if (rows.length === 0) return;

  const { error } = await supabase
    .from('attendance_records')
    .upsert(rows, { onConflict: 'student_id,attendance_date' });
  if (error) throw error;
}

// ─── FOLLOW-UPS ───────────────────────────────────────────────────────────────

/** Fetch all active follow-up tasks */
export async function fetchFollowUps() {
  const { data, error } = await supabase
    .from('follow_ups')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

/** Fetch the active follow-up task for a single student (or null) */
export async function fetchFollowUpByStudentId(studentId) {
  const { data, error } = await supabase
    .from('follow_ups')
    .select('*')
    .eq('student_id', studentId)
    .maybeSingle();
  if (error) throw error;
  return data; // null if no follow-up exists
}

/** Insert or update a follow-up task for a student */
export async function upsertFollowUp(followUpData) {
  const { error } = await supabase
    .from('follow_ups')
    .upsert(followUpData, { onConflict: 'student_id' });
  if (error) throw error;
}

// ─── FOLLOW-UP LOGS ───────────────────────────────────────────────────────────

/** Fetch follow-up log entries. Pass studentId to scope to one student. */
export async function fetchFollowUpLogs(limit = 10, studentId = null, profile = null) {
  // Scope to SERVANT group if applicable
  let scopedStudentIds = null;
  if (profile?.role === 'SERVANT' && !studentId) {
    const { data: scopedStudents, error: scopeErr } = await supabase
      .from('students')
      .select('id')
      .eq('grade', profile.assigned_grade)
      .eq('gender', profile.assigned_gender);
    if (scopeErr) throw scopeErr;
    scopedStudentIds = (scopedStudents || []).map(s => s.id);
    if (scopedStudentIds.length === 0) return []; // No students -> no logs
  }

  let query = supabase
    .from('follow_up_logs')
    .select(`
      *,
      students!student_id (name),
      profiles!recorded_by (full_name)
    `)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (studentId) {
    query = query.eq('student_id', studentId);
  } else if (scopedStudentIds) {
    query = query.in('student_id', scopedStudentIds);
  }

  const { data, error } = await query;
  if (error) throw error;
  
  return data.map(log => ({
    ...log,
    // Derive student_name from join
    student_name: log.students?.name || 'مخدوم غير معروف',
    // Servant name derived from profiles
    servant_name: log.profiles?.full_name || log.recorded_by,
    time: timeAgo(log.created_at),
  }));
}

/** Save a new follow-up log entry */
export async function saveFollowUpLog({ studentId, followUpId, type, notes, contactStatus }) {
  // Try to get the current authenticated user safely
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;

  const payload = {
    student_id:    studentId,
    type,
    notes,
    contact_status: contactStatus,
  };
  
  if (followUpId) {
    payload.follow_up_id = followUpId;
  }

  // Only append recorded_by if we have a valid UUID reference
  if (userId) {
    payload.recorded_by = userId;
  }

  console.log('[saveFollowUpLog] Executing insert with payload:', payload);

  const { data, error } = await supabase.from('follow_up_logs').insert(payload).select();
  if (error) {
    console.error('[saveFollowUpLog] Supabase error encountered:', error);
    throw error;
  }
  
  console.log('[saveFollowUpLog] Success:', data);
}

/** Update an existing follow-up log entry */
export async function updateFollowUpLog(logId, { type, notes }) {
  const payload = {
    type,
    notes,
  };

  const { data, error } = await supabase
    .from('follow_up_logs')
    .update(payload)
    .eq('id', logId)
    .select();

  if (error) {
    console.error('[updateFollowUpLog] Supabase error:', error);
    throw error;
  }

  return data;
}

// ─── FOLLOW-UP COUNT (shared truth) ───────────────────────────────────────────

/**
 * Count unique students who have at least one "غائب" record within the
 * given Friday dates.  This is the canonical source for the follow-up
 * count — both the dashboard card and the follow-up page use this logic
 * so they always agree.
 *
 * @param {string[]} recentFridays  ISO Friday dates (from getRecentFridays()).
 * @returns {Promise<number>}
 */
export async function fetchFollowUpCount(recentFridays, profile = null) {
  // Use the updated candidate logic to reflect the correct count of active unresolved cases natively
  const candidates = await fetchFollowUpCandidates(recentFridays, profile);
  return candidates.length;
}

// ─── DASHBOARD STATS ──────────────────────────────────────────────────────────

/**
 * Fetch all stats needed for the dashboard summary cards.
 *
 * @param {string} fridayDate  ISO date of the active Friday cycle (YYYY-MM-DD).
 *                             Use getActiveFriday() from attendanceCycle.js.
 *
 * Returns:
 *   totalStudents   — total enrolled students
 *   totalServants   — total registered servants  (future card: إجمالي الخدام)
 *   presentCount    — students marked حاضر for this Friday
 *   absentCount     — students marked غائب for this Friday
 *   excusedCount    — students marked معتذر for this Friday
 *   attendanceRate  — percentage (present / total * 100)
 *   needFollowUp    — count of active follow-up tasks  (future: trend data)
 *   avatarStudents  — small slice of students for mini-avatar row
 *
 * Uses Promise.allSettled so a single failing query never crashes the page.
 * Each field falls back to a safe zero/empty value on error.
 */
export async function fetchDashboardStats(fridayDate, profile = null) {
  // Shared Friday window — same as the follow-up page uses
  const recentFridays = getRecentFridays(8);

  // Build scoped student-count query
  let studentCountQuery = supabase.from('students').select('*', { count: 'exact', head: true });
  studentCountQuery = applyServantScope(studentCountQuery, profile);

  // For scoped attendance we need the student IDs first (only for SERVANT)
  let scopedStudentIds = null;
  if (profile?.role === 'SERVANT') {
    const { data: scopedStudents } = await supabase
      .from('students')
      .select('id')
      .eq('grade', profile.assigned_grade)
      .eq('gender', profile.assigned_gender);
    scopedStudentIds = (scopedStudents || []).map(s => s.id);
  }

  // Build scoped attendance query
  let attendanceQuery = supabase
    .from('attendance_records')
    .select('status')
    .eq('attendance_date', fridayDate);
  if (scopedStudentIds) {
    attendanceQuery = attendanceQuery.in('student_id', scopedStudentIds);
  }

  // Build scoped avatar row query
  let avatarQuery = supabase.from('students').select('id, avatar, avatar_color').limit(6);
  avatarQuery = applyServantScope(avatarQuery, profile);

  const results = await Promise.allSettled([
    // 0 — total students (scoped)
    studentCountQuery,
    // 1 — attendance records for the active Friday cycle (scoped)
    attendanceQuery,
    // 2 — follow-up candidate count (scoped)
    fetchFollowUpCount(recentFridays, profile),
    // 3 — small set of students for the avatar row (scoped)
    avatarQuery,
    // 4 — total servants (not scoped — servants are global)
    supabase.from('servants').select('*', { count: 'exact', head: true }),
  ]);

  const safe = (i, fallback) =>
    results[i].status === 'fulfilled' ? results[i].value : fallback;

  const totalStudents  = safe(0, { count: 0 }).count || 0;
  const attendanceRows = (safe(1, { data: [] }).data) || [];
  // fetchFollowUpCount returns a plain number, not a Supabase response object
  const needFollowUp   = results[2].status === 'fulfilled' ? (results[2].value ?? 0) : 0;
  const avatarStudents = (safe(3, { data: [] }).data) || [];
  const totalServants  = safe(4, { count: 0 }).count || 0;

  const presentCount  = attendanceRows.filter(r => r.status === 'حاضر').length;
  const absentCount   = attendanceRows.filter(r => r.status === 'غائب').length;
  const excusedCount  = attendanceRows.filter(r => r.status === 'معتذر').length;
  const attendanceRate = totalStudents
    ? Math.round((presentCount / totalStudents) * 100)
    : 0;

  return {
    totalStudents,
    totalServants,
    presentCount,
    absentCount,
    excusedCount,
    attendanceRate,
    needFollowUp,
    avatarStudents,
  };
}

/**
 * Fetch the list of absent students for a specific attendance date.
 * Used by the dashboard "بانتظار الافتقاد" section.
 *
 * @param {string} date  ISO date — defaults to today for backward compat.
 */
export async function fetchAbsentForDate(date = todayISO(), profile = null) {
  const { data: absences, error: e1 } = await supabase
    .from('attendance_records')
    .select('student_id')
    .eq('attendance_date', date)
    .eq('status', 'غائب');
  if (e1) throw e1;
  if (!absences || absences.length === 0) return [];

  const ids = absences.map(r => r.student_id);
  let studsQuery = supabase
    .from('students')
    .select('id, name, grade, avatar, avatar_color, parent_phone')
    .in('id', ids);
  // For SERVANT: further restrict to only their assigned group
  studsQuery = applyServantScope(studsQuery, profile);
  studsQuery = studsQuery.limit(10);
  const { data: studs, error: e2 } = await studsQuery;
  if (e2) throw e2;
  return studs || [];
}

/** @deprecated Use fetchAbsentForDate(date) instead */
export async function fetchAbsentToday() {
  return fetchAbsentForDate(todayISO());
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function formatDate(isoDate) {
  if (!isoDate) return '';
  
  if (isoDate.includes('-')) {
    const [y, m, d] = isoDate.split('T')[0].split('-');
    if (y && m && d) {
      const local = new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10));
      return local.toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' });
    }
  }

  const d = new Date(isoDate);
  return d.toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' });
}

function timeAgo(isoString) {
  if (!isoString) return '';
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins <  1)  return 'الآن';
  if (mins <  60) return `منذ ${mins} دقيقة`;
  const hrs = Math.floor(mins / 60);
  if (hrs  <  24) return `منذ ${hrs} ساعة`;
  const days = Math.floor(hrs / 24);
  return `منذ ${days} يوم`;
}

// ─── SYSTEM ALERTS ────────────────────────────────────────────────────────────

/** Fetch currently active alerts based on start and end dates */
export async function fetchActiveAlerts() {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('alerts')
    .select('*')
    .lte('starts_at', now)
    .gte('ends_at', now)
    .order('created_at', { ascending: false });

  if (error) {
    console.warn('[fetchActiveAlerts] Error fetching alerts:', error.message);
    return []; // Return empty gracefully if table is missing or RLS blocks
  }
  return data || [];
}

/** Insert a new system alert */
export async function saveSystemAlert({ title, text, type, durationDays }) {
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;

  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(startDate.getDate() + durationDays);

  const payload = {
    title,
    description: text,
    alert_type: type || 'تنبيه',
    priority: 1,
    is_active: true,
    starts_at: startDate.toISOString(),
    ends_at: endDate.toISOString(),
  };

  if (userId) payload.created_by = userId;

  console.log('[saveSystemAlert] payload:', payload);
  const { data, error } = await supabase.from('alerts').insert(payload).select();
  if (error) {
    console.error('[saveSystemAlert] Supabase error:', error);
    throw error;
  }
}

// ─── GLOBAL SEARCH ────────────────────────────────────────────────────────────

export async function performGlobalSearch(query, context = 'all') {
  if (!query) return [];
  const safeQuery = `%${query}%`;
  
  const promises = [];
  
  if (context === 'all' || context === 'students') {
    promises.push(
      supabase.from('students')
        .select('id, name, code, avatar_color')
        .or(`name.ilike.${safeQuery},code.ilike.${safeQuery}`)
        .limit(6)
        .then(res => ({ type: 'student', data: res.data || [] }))
    );
  }
  
  if (context === 'all' || context === 'servants') {
    promises.push(
      supabase.from('profiles')
        .select('id, full_name, role')
        .ilike('full_name', safeQuery)
        .limit(4)
        .then(res => ({ type: 'servant', data: res.data || [] }))
    );
  }
  
  const results = await Promise.all(promises);
  let finalItems = [];
  
  results.forEach(res => {
    if (res.type === 'student') {
      res.data.forEach(s => finalItems.push({ ...s, type: 'student' }));
    } else if (res.type === 'servant') {
      res.data.forEach(s => finalItems.push({ ...s, type: 'servant' }));
    }
  });
  
  return finalItems;
}

