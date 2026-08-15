/**
 * Pure helpers for resolving which training slots a client has on a given date.
 * Handles cancellations (recurring_exceptions), reschedules (moved one-off rows),
 * series end (recurrence_end_date) and series start (session_date / created_at).
 */

export interface ScheduleRow {
  session_date?: string | null;
  session_time?: string | null;
  is_recurring?: boolean | null;
  recurrence_day?: number | null;
  recurrence_time?: string | null;
  recurrence_end_date?: string | null;
  recurring_exceptions?: string[] | null;
  created_at?: string | null;
}

/** Weekday (0=Sun) for a YYYY-MM-DD date, noon-anchored to avoid UTC shifts. */
export const weekdayOf = (date: string): number => new Date(`${date}T12:00:00`).getDay();

/** Sorted, de-duplicated list of HH:MM training slots for `date`. */
export function trainingSlotsFor(rows: ScheduleRow[], date: string): string[] {
  const weekday = weekdayOf(date);
  const times: string[] = [];

  for (const s of rows || []) {
    if (s.is_recurring) {
      if (s.recurrence_day !== weekday) continue;
      if (s.recurrence_end_date && date > s.recurrence_end_date) continue;
      const startedOn = s.session_date || String(s.created_at || '').slice(0, 10);
      if (startedOn && date < startedOn) continue;
      if ((s.recurring_exceptions || []).includes(date)) continue;
      times.push((s.recurrence_time || '').slice(0, 5));
    } else if (s.session_date === date) {
      times.push((s.session_time || '').slice(0, 5));
    }
  }

  return Array.from(new Set(times)).sort();
}

/** Fingerprint string: "18:00,20:00" for a training day, "" for a rest day. */
export function computeTrainingDayKey(rows: ScheduleRow[], date: string): string {
  return trainingSlotsFor(rows, date).join(',');
}
