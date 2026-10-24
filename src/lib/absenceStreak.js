// Single definition of "consecutive absences" for pending follow-up (Dashboard + Follow-up page).
//
// Attendance is Friday-based (attendance_records: student_id, attendance_date, status
// حاضر | غائب | معتذر, unique per student+date). Rules:
//   • A "session" is a Friday on which at least one record exists in the data we were allowed to read.
//     Fridays with no records at all (service not held / not entered) are skipped, not counted.
//   • Walk sessions newest → oldest. غائب extends the streak.
//   • حاضر or معتذر (excused) ends it — an excused absence is not an unexcused one.
//   • A session with NO record for this student is unknown: it ends the streak (never assumed absent).
//   • Only the supplied window is inspected, so a streak is capped by the look-back length.

const ABSENT = 'غائب';

/** Distinct session dates (newest first) present in the records. */
export function sessionDatesFrom(records) {
  return [...new Set(records.map(r => r.attendance_date))].sort((a, b) => b.localeCompare(a));
}

/**
 * @param {Map<string,string>|Object} statusByDate  this student's status per attendance_date
 * @param {string[]} sessionDates  newest-first session dates (see sessionDatesFrom)
 */
export function consecutiveAbsences(statusByDate, sessionDates) {
  const get = statusByDate instanceof Map ? d => statusByDate.get(d) : d => statusByDate[d];
  let n = 0;
  for (const d of sessionDates) {
    if (get(d) !== ABSENT) break;
    n++;
  }
  return n;
}

/** { [studentId]: consecutive absences } for every student that has ≥1 record. Duplicates collapse per date. */
export function buildStreakMap(records, { sessionDates = sessionDatesFrom(records) } = {}) {
  const byStudent = new Map();
  for (const r of records) {
    const key = String(r.student_id);
    if (!byStudent.has(key)) byStudent.set(key, new Map());
    byStudent.get(key).set(r.attendance_date, r.status);
  }
  const out = {};
  for (const [id, byDate] of byStudent) out[id] = consecutiveAbsences(byDate, sessionDates);
  return out;
}

/** Arabic label: غائب مرة واحدة / مرتين متتاليتين / ٣ مرات متتالية … Empty when there is no confirmed streak. */
export function absenceStreakLabel(n) {
  if (!n || n < 1) return '';
  if (n === 1) return 'غائب مرة واحدة';
  if (n === 2) return 'غائب مرتين متتاليتين';
  const num = n.toLocaleString('ar-EG');
  return n <= 10 ? `غائب ${num} مرات متتالية` : `غائب ${num} مرة متتالية`;
}

/** Badge colours: 1 = soft, 2 = amber, 3+ = red. */
export function absenceStreakTone(n) {
  if (n >= 3) return { bg: '#FEE2E2', color: '#B91C1C' };
  if (n === 2) return { bg: '#FFEDD5', color: '#C2410C' };
  return { bg: '#FEF3C7', color: '#92400E' };
}
