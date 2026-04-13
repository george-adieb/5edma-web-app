/**
 * attendanceCycle.js
 *
 * Attendance in this system is Friday-based.
 * Each service Friday opens a 7-day window (Fri → Thu).
 * During that window, servants can record or edit attendance for that Friday.
 * The next Friday automatically becomes the new active cycle.
 *
 * All functions are pure (no side-effects, no imports). Pass `new Date()` or
 * a specific Date object to make them testable and time-travel friendly.
 */

/**
 * Return the ISO date string (YYYY-MM-DD) of the most recent Friday
 * relative to a given date.
 *
 * - If `date` is a Friday  → return that same day
 * - If `date` is Sat–Thu  → return the most recent Friday
 *
 * Day indices: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
 */
export function getActiveFriday(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0–6
  // daysBack: how many days to subtract to land on the previous (or current) Friday
  // Fri(5)→0, Sat(6)→1, Sun(0)→2, Mon(1)→3, Tue(2)→4, Wed(3)→5, Thu(4)→6
  const daysBack = (day + 2) % 7;
  d.setDate(d.getDate() - daysBack);
  return toISO(d);
}

/**
 * Return the ISO date string of the Friday one week before the given Friday ISO.
 */
export function getPreviousFriday(fridayISO) {
  const d = new Date(fridayISO);
  d.setDate(d.getDate() - 7);
  return toISO(d);
}

/**
 * Return the ISO date string of the Friday one week after the given Friday ISO.
 */
export function getNextFriday(fridayISO) {
  const d = new Date(fridayISO);
  d.setDate(d.getDate() + 7);
  return toISO(d);
}

/**
 * True if the given Friday ISO is the current active Friday cycle.
 * Used to disable the "next" navigation button.
 */
export function isCurrentCycle(fridayISO, today = new Date()) {
  return fridayISO === getActiveFriday(today);
}

/**
 * True if the given Friday ISO is in the future relative to today's active cycle.
 * Used to block access to future cycles entirely.
 */
export function isFutureCycle(fridayISO, today = new Date()) {
  return fridayISO > getActiveFriday(today);
}

/**
 * Format a Friday ISO date into a human-readable Arabic label.
 * e.g. "2025-04-25" → "الجمعة ٢٥ أبريل ٢٠٢٥"
 */
export function formatFridayLabel(fridayISO) {
  const d = new Date(fridayISO + 'T00:00:00'); // force local midnight
  return d.toLocaleDateString('ar-EG', {
    weekday: 'long',
    day:     'numeric',
    month:   'long',
    year:    'numeric',
  });
}

/**
 * Return a short label for the Friday cycle.
 * e.g. "الجمعة ٢٥/٤/٢٠٢٥"
 */
export function formatFridayShort(fridayISO) {
  const d = new Date(fridayISO + 'T00:00:00');
  return d.toLocaleDateString('ar-EG', {
    day:   'numeric',
    month: 'numeric',
    year:  'numeric',
  });
}

// ─── Internal helper ──────────────────────────────────────────

function toISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
