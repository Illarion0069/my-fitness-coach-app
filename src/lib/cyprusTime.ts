/**
 * Booking times are stored as a plain date (YYYY-MM-DD) plus a Limassol
 * wall-clock reading (HH:MM). They are never converted to the phone's zone, so
 * an appointment always points at the same moment for the trainer and the
 * client, no matter where either of them is standing.
 *
 * These helpers make that explicit on the client's side: they turn a Limassol
 * wall-clock reading into a real instant (independent of the device zone) and
 * translate it back into the user's own clock.
 */

const CYPRUS_TZ = 'Asia/Nicosia';
const CYPRUS_ZONES = new Set(['Asia/Nicosia', 'Europe/Nicosia', 'Asia/Famagusta', 'Asia/Larnaca']);

let cachedDeviceTz: string | null = null;

/** The zone the phone/browser reports, e.g. 'Asia/Dubai'. Cached — it never changes at runtime. */
export const deviceTimezone = (): string => {
  if (cachedDeviceTz === null) {
    try {
      cachedDeviceTz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    } catch {
      cachedDeviceTz = '';
    }
  }
  return cachedDeviceTz;
};

/** True when the device already runs on Cyprus time — no translation needed. */
export const isCyprusDevice = (): boolean => CYPRUS_ZONES.has(deviceTimezone());

const partsIn = (at: Date, timeZone: string): Record<string, string> => {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const map: Record<string, string> = {};
  for (const p of dtf.formatToParts(at)) map[p.type] = p.value;
  return map;
};

/** How far the given zone's clock sits from UTC at that instant. */
const zoneOffsetAt = (at: Date, timeZone: string): number => {
  const m = partsIn(at, timeZone);
  const asUTC = Date.UTC(+m.year, +m.month - 1, +m.day, +m.hour, +m.minute, +m.second);
  return asUTC - at.getTime();
};

/**
 * Epoch milliseconds for a Limassol wall-clock reading such as
 * ('2026-09-18', '09:00'). Resolved twice so a daylight-saving boundary lands
 * on the right instant instead of drifting by an hour.
 */
export const cyprusInstant = (date: string, time = '00:00'): number => {
  const [y, mo, d] = (date || '').split('-').map(Number);
  if (!y || !mo || !d) return NaN;
  const [hh, mm] = (time || '00:00').slice(0, 5).split(':').map(Number);
  const target = Date.UTC(y, mo - 1, d, hh || 0, mm || 0);
  let t = target - zoneOffsetAt(new Date(target), CYPRUS_TZ);
  t = target - zoneOffsetAt(new Date(t), CYPRUS_TZ);
  return t;
};

/** Whole hours between now and a Limassol appointment (negative once it has passed). */
export const hoursUntilCyprus = (date: string, time = '00:00'): number => {
  const inst = cyprusInstant(date, time);
  if (Number.isNaN(inst)) return Infinity;
  return (inst - Date.now()) / 3600000;
};

export interface LocalTime {
  /** HH:MM on the user's own clock */
  time: string;
  /** -1 / 0 / +1 — whether their calendar day differs from the Limassol one */
  dayShift: number;
}

/**
 * The user's own clock for a Limassol appointment, or null when it would say
 * nothing new (same hour, same day, or no zone info available).
 */
export const localTimeFor = (date: string, time: string): LocalTime | null => {
  const tz = deviceTimezone();
  if (!tz || !date || !time) return null;
  const inst = cyprusInstant(date, time);
  if (Number.isNaN(inst)) return null;

  const local = partsIn(new Date(inst), tz);
  const cyprus = partsIn(new Date(inst), CYPRUS_TZ);
  const localTime = `${local.hour}:${local.minute}`;
  const dayShift = Math.round(
    (Date.UTC(+local.year, +local.month - 1, +local.day) -
      Date.UTC(+cyprus.year, +cyprus.month - 1, +cyprus.day)) / 86400000
  );

  if (localTime === time.slice(0, 5) && dayShift === 0) return null;
  return { time: localTime, dayShift };
};

/** Short label such as "10:00 у вас" / "10:00 your time · tomorrow". */
export const localTimeLabel = (date: string, time: string, lang: string): string | null => {
  const local = localTimeFor(date, time);
  if (!local) return null;
  const en = lang === 'en';
  const suffix = en ? 'your time' : 'у вас';
  if (local.dayShift === 0) return `${local.time} ${suffix}`;
  const day =
    local.dayShift > 0
      ? en ? 'tomorrow' : 'завтра'
      : en ? 'yesterday' : 'вчера';
  return `${local.time} ${suffix} · ${day}`;
};
