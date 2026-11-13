// Private iCalendar (.ics) subscription feed of a trainer's trainings.
// Auth: secret token in the URL (calendar apps cannot send headers).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const TZ = 'Asia/Nicosia';
const PAST_DAYS = 60;
const FUTURE_DAYS = 180;

const VTIMEZONE = [
  'BEGIN:VTIMEZONE', 'TZID:Asia/Nicosia',
  'BEGIN:DAYLIGHT', 'TZOFFSETFROM:+0200', 'TZOFFSETTO:+0300', 'TZNAME:EEST',
  'DTSTART:19700329T030000', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU', 'END:DAYLIGHT',
  'BEGIN:STANDARD', 'TZOFFSETFROM:+0300', 'TZOFFSETTO:+0200', 'TZNAME:EET',
  'DTSTART:19701025T040000', 'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU', 'END:STANDARD',
  'END:VTIMEZONE',
];

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

function cyprusToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
function addDays(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const weekday = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay();

function localStamp(date: string, time: string, plusMin = 0): string {
  const [h, m] = time.slice(0, 5).split(':').map(Number);
  const total = h * 60 + m + plusMin;
  const day = addDays(date, Math.floor(total / 1440));
  const mm = ((total % 1440) + 1440) % 1440;
  const hh = String(Math.floor(mm / 60)).padStart(2, '0');
  const mi = String(mm % 60).padStart(2, '0');
  return `${day.replace(/-/g, '')}T${hh}${mi}00`;
}

Deno.serve(async (req) => {
  const token = new URL(req.url).searchParams.get('token') || '';
  if (!/^[a-f0-9]{32,64}$/.test(token)) return new Response('Not found', { status: 404 });

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: tok } = await db.from('calendar_feed_tokens').select('trainer_user_id').eq('token', token).maybeSingle();
  if (!tok) return new Response('Not found', { status: 404 });
  const trainerId = tok.trainer_user_id as string;

  const today = cyprusToday();
  const from = addDays(today, -PAST_DAYS);
  const to = addDays(today, FUTURE_DAYS);

  const [{ data: sessions, error: e1 }, { data: guests, error: e2 }] = await Promise.all([
    db.from('scheduled_sessions').select('*').eq('trainer_user_id', trainerId),
    db.from('guest_bookings').select('*').eq('trainer_user_id', trainerId).gte('session_date', from).lte('session_date', to),
  ]);
  if (e1 || e2) {
    console.error('calendar-feed query failed', e1, e2);
    return new Response('Error', { status: 500 });
  }

  const userIds = [...new Set((sessions || []).map((s: any) => s.user_id).filter(Boolean))];
  const names: Record<string, string> = {};
  if (userIds.length) {
    const { data: profs } = await db.from('profiles').select('user_id, full_name').in('user_id', userIds);
    (profs || []).forEach((p: any) => { names[p.user_id] = p.full_name || ''; });
  }

  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const lines: string[] = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Limassol Fitness//Trainer Calendar//EN',
    'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Limassol Fitness', `X-WR-TIMEZONE:${TZ}`,
    'REFRESH-INTERVAL;VALUE=DURATION:PT15M', 'X-PUBLISHED-TTL:PT15M', ...VTIMEZONE,
  ];

  const pushEvent = (uid: string, date: string, time: string, minutes: number, title: string, desc?: string) => {
    lines.push('BEGIN:VEVENT', `UID:${uid}@limassol-fitness.com`, `DTSTAMP:${stamp}`,
      `DTSTART;TZID=${TZ}:${localStamp(date, time)}`, `DTEND;TZID=${TZ}:${localStamp(date, time, minutes)}`,
      `SUMMARY:${esc(title)}`);
    if (desc) lines.push(`DESCRIPTION:${esc(desc)}`);
    lines.push('END:VEVENT');
  };

  const titleFor = (s: any) => {
    const manual = s.notes?.match(/^👤 (.+?) \(manual\)$/);
    const who = manual ? manual[1] : (names[s.user_id] || 'Client');
    return `🏋️ ${who}`;
  };

  for (const s of sessions || []) {
    const minutes = s.duration_minutes || 60;
    if (s.is_recurring) {
      const time = (s.recurrence_time || s.session_time || '').slice(0, 5);
      if (!time || s.recurrence_day == null) continue;
      const start = s.session_date || String(s.created_at || '').slice(0, 10);
      const exceptions: string[] = s.recurring_exceptions || [];
      for (let d = from; d <= to; d = addDays(d, 1)) {
        if (weekday(d) !== s.recurrence_day) continue;
        if (start && d < start) continue;
        if (s.recurrence_end_date && d > s.recurrence_end_date) continue;
        if (exceptions.includes(d)) continue;
        pushEvent(`${s.id}-${d}`, d, time, minutes, titleFor(s));
      }
    } else if (s.session_date && s.session_time && s.session_date >= from && s.session_date <= to) {
      pushEvent(s.id, s.session_date, s.session_time, minutes, titleFor(s));
    }
  }

  for (const g of guests || []) {
    if (g.status === 'cancelled' || !g.session_time) continue;
    const desc = [g.guest_phone && `📞 ${g.guest_phone}`, g.notes].filter(Boolean).join('\n');
    pushEvent(`guest-${g.id}`, g.session_date, g.session_time, 60, `👋 ${g.guest_name || 'Guest'} (guest)`, desc);
  }

  lines.push('END:VCALENDAR');
  // Fold to 75 octets per RFC 5545 (approx. by chars, safe for Apple/Google).
  const body = lines.map((l) => {
    const out: string[] = [];
    let rest = Array.from(l);
    while (rest.length > 60) { out.push(rest.slice(0, 60).join('')); rest = [' ', ...rest.slice(60)]; }
    out.push(rest.join(''));
    return out.join('\r\n');
  }).join('\r\n') + '\r\n';

  return new Response(body, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="limassol-fitness.ics"',
      'Cache-Control': 'no-cache',
    },
  });
});
