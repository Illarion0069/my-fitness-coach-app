import { useState, useRef, useEffect } from 'react';
import { CalendarPlus } from 'lucide-react';

interface Props {
  date: string; // YYYY-MM-DD
  time: string; // HH:MM[:SS]
  durationMin?: number;
  title?: string;
  location?: string;
  description?: string;
  lang?: 'en' | 'ru' | string;
}

// Cyprus = Asia/Nicosia. We emit a *floating* wall-clock stamp (no Z, no offset)
// and let the calendar app resolve it via TZID / ctz. This is DST-safe because
// the calendar (Google/Apple) applies the Asia/Nicosia rules itself.
// We do pure string-based wall-clock arithmetic so the result never depends on
// the *browser's* local timezone (which could itself be in DST transition).
const pad = (n: number) => String(n).padStart(2, '0');

const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
const daysInMonth = (y: number, m: number) =>
  [31, isLeap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];

const toLocalStamp = (date: string, time: string, addMin = 0) => {
  const [Y, M, D] = date.split('-').map(Number);
  const [h, m] = time.split(':').map(Number);
  let year = Y, month = M, day = D, hour = h || 0, minute = (m || 0) + addMin;

  // Normalize minutes -> hours -> days -> months (wall-clock, no TZ involved)
  hour += Math.floor(minute / 60);
  minute = ((minute % 60) + 60) % 60;
  day += Math.floor(hour / 24);
  hour = ((hour % 24) + 24) % 24;
  while (day > daysInMonth(year, month)) {
    day -= daysInMonth(year, month);
    month += 1;
    if (month > 12) { month = 1; year += 1; }
  }
  while (day < 1) {
    month -= 1;
    if (month < 1) { month = 12; year -= 1; }
    day += daysInMonth(year, month);
  }

  return `${year}${pad(month)}${pad(day)}T${pad(hour)}${pad(minute)}00`;
};

const AddToCalendarButton = ({
  date,
  time,
  durationMin = 60,
  title = 'Limassol Fitness — Training',
  location = 'Limassol Fitness',
  description = '',
  lang = 'en',
}: Props) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const t = (time || '00:00').slice(0, 5);

  const googleUrl = (() => {
    const start = toLocalStamp(date, t);
    const end = toLocalStamp(date, t, durationMin);
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: title,
      dates: `${start}/${end}`,
      details: description,
      location,
      ctz: 'Asia/Nicosia',
    });
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  })();

  const downloadIcs = () => {
    const start = toLocalStamp(date, t);
    const end = toLocalStamp(date, t, durationMin);
    const uid = `${start}-${Math.random().toString(36).slice(2, 9)}@limassol-fitness.com`;
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Limassol Fitness//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${toLocalStamp(date, t)}`,
      `DTSTART;TZID=Asia/Nicosia:${start}`,
      `DTEND;TZID=Asia/Nicosia:${end}`,
      `SUMMARY:${title}`,
      `LOCATION:${location}`,
      `DESCRIPTION:${description}`,
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      'DESCRIPTION:Reminder',
      'TRIGGER:-PT1H',
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `training-${date}.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setOpen(false);
  };

  const labelGoogle = lang === 'ru' ? 'Google Календарь' : 'Google Calendar';
  const labelApple = lang === 'ru' ? 'Apple Календарь' : 'Apple Calendar';

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
        title={lang === 'ru' ? 'Добавить в календарь' : 'Add to calendar'}
        className="text-primary/80 bg-primary/10 hover:bg-primary/20 transition-colors px-2 py-1 rounded-lg flex items-center"
      >
        <CalendarPlus className="w-3.5 h-3.5" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-popover border border-border/50 rounded-lg shadow-lg overflow-hidden min-w-[160px]">
          <a
            href={googleUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className="block px-3 py-2 text-xs hover:bg-accent text-foreground"
          >
            {labelGoogle}
          </a>
          <button
            onClick={downloadIcs}
            className="w-full text-left block px-3 py-2 text-xs hover:bg-accent text-foreground border-t border-border/40"
          >
            {labelApple} (.ics)
          </button>
        </div>
      )}
    </div>
  );
};

export default AddToCalendarButton;
