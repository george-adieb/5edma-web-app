import { supabase } from './supabase';
import { GRADE_LABEL_MAP } from '../data/constants';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayISO() {
  return new Date().toISOString().split('T')[0]; // YYYY-MM-DD
}

// ─── STUDENTS ─────────────────────────────────────────────────────────────────

/** Fetch all students ordered by name */
export async function fetchStudents() {
  const { data, error } = await supabase
    .from('students')
    .select('*')
    .order('name');
  if (error) throw error;
  return data;
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
export async function fetchFollowUpLogs(limit = 10, studentId = null) {
  let query = supabase
    .from('follow_up_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (studentId) query = query.eq('student_id', studentId);

  const { data, error } = await query;
  if (error) throw error;
  return data.map(log => ({
    ...log,
    time: timeAgo(log.created_at),
  }));
}

/** Save a new follow-up log entry */
export async function saveFollowUpLog({ studentId, studentName, type, notes, contactStatus, servantName = 'أ. مينا كمال' }) {
  const { error } = await supabase.from('follow_up_logs').insert({
    student_id:    studentId,
    student_name:  studentName,
    type,
    notes,
    contact_status: contactStatus,
    servant_name:   servantName,
  });
  if (error) throw error;
}

// ─── DASHBOARD STATS ──────────────────────────────────────────────────────────

export async function fetchDashboardStats() {
  const today = todayISO();

  const [{ count: totalStudents }, attendanceRows, { count: needFollowUp }] = await Promise.all([
    supabase.from('students').select('*', { count: 'exact', head: true }),
    supabase.from('attendance_records').select('status').eq('attendance_date', today),
    supabase.from('students').select('*', { count: 'exact', head: true }).eq('status', 'يحتاج افتقاد'),
  ]);

  const records = attendanceRows.data || [];
  const presentToday = records.filter(r => r.status === 'حاضر').length;
  const absentToday  = records.filter(r => r.status === 'غائب').length;
  const excusedToday = records.filter(r => r.status === 'معتذر').length;

  return {
    totalStudents:  totalStudents || 0,
    presentToday,
    absentToday,
    excusedToday,
    needFollowUp:   needFollowUp || 0,
    attendanceRate: totalStudents ? Math.round((presentToday / totalStudents) * 100) : 0,
  };
}

/** Fetch students who are absent today */
export async function fetchAbsentToday() {
  const today = todayISO();
  const { data, error } = await supabase
    .from('attendance_records')
    .select('student_id')
    .eq('attendance_date', today)
    .eq('status', 'غائب');
  if (error) throw error;
  if (!data.length) return [];

  const ids = data.map(r => r.student_id);
  const { data: studs, error: e2 } = await supabase
    .from('students')
    .select('id, name, grade, avatar, avatar_color, parent_phone')
    .in('id', ids);
  if (e2) throw e2;
  return studs;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function formatDate(isoDate) {
  if (!isoDate) return '';
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
