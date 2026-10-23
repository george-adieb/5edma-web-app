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
