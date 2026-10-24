// Single definition of "is this student exempt from automatic follow-up?" for the UI.
// (The AI Assistant Edge Function mirrors it in supabase/functions/ai-assistant/index.ts.)
//
// A student with status 'منقطع بسبب' (absence reason known) is never put in an automatic
// pending-follow-up list. When the status is later changed, students.follow_up_baseline_date
// is set by the database and attendance on or before that date is ignored — historical absences
// from the exempt period never resurface as new follow-up tasks.

export const INTERRUPTED_WITH_REASON = 'منقطع بسبب';

export const isFollowUpExempt = (student) => student?.status === INTERRUPTED_WITH_REASON;

/** Attendance records that may count towards automatic follow-up for this student. */
export function eligibleAttendance(records, student) {
  const baseline = student?.follow_up_baseline_date;
  return baseline ? records.filter(r => r.attendance_date > baseline) : records;
}

// ── Pending follow-up ordering ────────────────────────────────────────────────
// Values are the real students.status DB values (labels live in StudentStatusField STATUS_OPTIONS).
export const STATUS_DISCONNECTED = 'يحتاج افتقاد'; // منقطع (يحتاج افتقاد)
export const STATUS_NEW = 'جديد';                   // مخدوم جديد (يحتاج زيارة)
export const STATUS_REGULAR = 'منتظم';              // مخدوم منتظم

/** 1 = most urgent. Anything else (incl. null) sorts last. */
export function getFollowUpPriority(student) {
  switch (student?.status) {
    case STATUS_DISCONNECTED: return 1;
    case STATUS_NEW: return 2;
    case STATUS_REGULAR: return 3;
    default: return 99;
  }
}

/** Badge shown on pending follow-up rows; null for regular students (they keep the plain absence badge). */
export function followUpStatusBadge(student) {
  switch (getFollowUpPriority(student)) {
    case 1: return { label: 'منقطع', bg: '#FEE2E2', color: '#DC2626' };
    case 2: return { label: 'مخدوم جديد', bg: '#FEF3C7', color: '#B45309' };
    default: return null;
  }
}

/** Priority asc, then absenceConsecutive desc; remaining ties keep their incoming order. Returns a new array. */
export function sortByFollowUpPriority(list) {
  return list
    .map((s, i) => [s, i])
    .sort((a, b) => getFollowUpPriority(a[0]) - getFollowUpPriority(b[0])
      || (b[0].absenceConsecutive || 0) - (a[0].absenceConsecutive || 0)
      || a[1] - b[1])
    .map(([s]) => s);
}
