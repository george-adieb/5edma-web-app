// Central student-access rules for the UI.
//
// The database is the source of truth: RLS (public.can_access_student) already limits every
// student-related table to the caller's grade + gender, so these helpers are defence in depth
// and are used to build explicit queries / dropdowns. They mirror the SQL function exactly:
//   ADMIN → everything; SERVICE_HEAD / SERVANT → exact grade-label match AND gender match;
//   empty grades, missing gender or unknown role → NOTHING (never "all").

const NIL_UUID = '00000000-0000-0000-0000-000000000000';

export function assignedGrades(profile) {
  if (!profile) return [];
  if (Array.isArray(profile.assigned_grades) && profile.assigned_grades.length) return profile.assigned_grades;
  return profile.assigned_grade ? [profile.assigned_grade] : [];
}

export const isAdminRole = (profile) => profile?.role === 'ADMIN';

/** { all: true } for admin, otherwise the exact grades/gender allowed (possibly empty = no access). */
export function getStudentScope(profile) {
  if (isAdminRole(profile)) return { all: true, grades: [], gender: null };
  if (profile?.role === 'SERVICE_HEAD' || profile?.role === 'SERVANT') {
    const grades = assignedGrades(profile);
    const gender = profile.assigned_gender || null;
    return { all: false, grades: gender ? grades : [], gender };
  }
  return { all: false, grades: [], gender: null };
}

export function canAccessStudent(profile, student) {
  const scope = getStudentScope(profile);
  if (scope.all) return true;
  return !!student && scope.grades.includes(student.grade) && student.gender === scope.gender;
}

/** Add the scope filter to a supabase-js query on `students` (columns: grade, gender). */
export function applyStudentScope(query, profile) {
  const scope = getStudentScope(profile);
  if (scope.all) return query;
  if (!scope.grades.length || !scope.gender) return query.eq('id', NIL_UUID);
  return query.in('grade', scope.grades).eq('gender', scope.gender);
}

/** Grade labels the user may pick when adding/editing students (admin = null meaning "any"). */
export function allowedGradeLabels(profile) {
  const scope = getStudentScope(profile);
  return scope.all ? null : scope.grades;
}

// External booking site. Hiding the menu is UI-only: the booking site must enforce its own auth.
// Roles are literal profiles.role values (SERVICE_HEAD = أمين الخدمة; the app has no SERVICE_LEADER).
const BOOKING_ROLES = ['ADMIN', 'SERVICE_HEAD', 'GENERAL_SECRETARIAT'];
export const canSeeBooking = (profile) => !!profile && BOOKING_ROLES.includes(profile.role);

export const BOOKING_LINKS = [
  { href: 'https://booking-web-app-beta.vercel.app/book', label: 'حجز أماكن الكنيسة' },
  { href: 'https://booking-web-app-beta.vercel.app/abo-talat-booking', label: 'حجز أبو تلات' },
];
