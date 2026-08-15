import { describe, it, expect } from 'vitest';
import { computeTrainingDayKey, trainingSlotsFor, weekdayOf, type ScheduleRow } from './trainingDay';

// 2026-08-17 is a Monday, 2026-08-18 Tuesday, 2026-08-24 next Monday.
const MON = '2026-08-17';
const TUE = '2026-08-18';
const NEXT_MON = '2026-08-24';

const recurring = (over: Partial<ScheduleRow> = {}): ScheduleRow => ({
  is_recurring: true,
  recurrence_day: 1, // Monday
  recurrence_time: '18:00:00',
  session_date: '2026-08-03',
  recurring_exceptions: [],
  ...over,
});

const oneOff = (date: string, time = '10:00:00'): ScheduleRow => ({
  is_recurring: false,
  session_date: date,
  session_time: time,
});

describe('weekdayOf', () => {
  it('is noon-anchored so timezone never shifts the day', () => {
    expect(weekdayOf(MON)).toBe(1);
    expect(weekdayOf(TUE)).toBe(2);
  });
});

describe('trainingSlotsFor — one-off sessions', () => {
  it('returns the slot on the session date', () => {
    expect(trainingSlotsFor([oneOff(MON)], MON)).toEqual(['10:00']);
  });

  it('is a rest day when the session was rescheduled to another date', () => {
    const rows = [oneOff(TUE)]; // moved from Monday to Tuesday
    expect(computeTrainingDayKey(rows, MON)).toBe('');
    expect(computeTrainingDayKey(rows, TUE)).toBe('10:00');
  });

  it('reflects a time change on the same date', () => {
    expect(computeTrainingDayKey([oneOff(MON, '19:30:00')], MON)).toBe('19:30');
  });

  it('is a rest day when the session was cancelled (row removed)', () => {
    expect(computeTrainingDayKey([], MON)).toBe('');
  });
});

describe('trainingSlotsFor — recurring series', () => {
  it('matches the recurrence weekday only', () => {
    expect(computeTrainingDayKey([recurring()], MON)).toBe('18:00');
    expect(computeTrainingDayKey([recurring()], TUE)).toBe('');
  });

  it('skips a single cancelled occurrence via recurring_exceptions', () => {
    const rows = [recurring({ recurring_exceptions: [MON] })];
    expect(computeTrainingDayKey(rows, MON)).toBe('');
    expect(computeTrainingDayKey(rows, NEXT_MON)).toBe('18:00');
  });

  it('stops after recurrence_end_date but keeps history intact', () => {
    const rows = [recurring({ recurrence_end_date: MON })];
    expect(computeTrainingDayKey(rows, MON)).toBe('18:00');
    expect(computeTrainingDayKey(rows, NEXT_MON)).toBe('');
  });

  it('does not apply before the series start date', () => {
    const rows = [recurring({ session_date: NEXT_MON })];
    expect(computeTrainingDayKey(rows, MON)).toBe('');
    expect(computeTrainingDayKey(rows, NEXT_MON)).toBe('18:00');
  });

  it('falls back to created_at when session_date is missing', () => {
    const rows = [recurring({ session_date: null, created_at: `${NEXT_MON}T09:00:00Z` })];
    expect(computeTrainingDayKey(rows, MON)).toBe('');
    expect(computeTrainingDayKey(rows, NEXT_MON)).toBe('18:00');
  });

  it('tolerates a null recurring_exceptions array', () => {
    expect(computeTrainingDayKey([recurring({ recurring_exceptions: null })], MON)).toBe('18:00');
  });
});

describe('computeTrainingDayKey — key stability', () => {
  it('is stable regardless of row order and duplicates', () => {
    const a = computeTrainingDayKey([oneOff(MON, '20:00:00'), recurring()], MON);
    const b = computeTrainingDayKey([recurring(), oneOff(MON, '20:00:00')], MON);
    expect(a).toBe('18:00,20:00');
    expect(a).toBe(b);
  });

  it('de-duplicates identical slots so no spurious re-analysis is triggered', () => {
    expect(computeTrainingDayKey([oneOff(MON, '18:00:00'), recurring()], MON)).toBe('18:00');
  });

  it('changes when a session is moved — this is what forces fresh advice', () => {
    const before = computeTrainingDayKey([oneOff(MON, '10:00:00')], MON);
    const after = computeTrainingDayKey([oneOff(MON, '18:00:00')], MON);
    expect(before).not.toBe(after);
  });

  it('ignores unrelated rows and empty input', () => {
    expect(computeTrainingDayKey([], MON)).toBe('');
    expect(computeTrainingDayKey([oneOff('2026-09-01')], MON)).toBe('');
  });
});
