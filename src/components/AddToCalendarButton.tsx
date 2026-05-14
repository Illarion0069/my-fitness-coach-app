import { useState, useRef, useEffect } from 'react';
import { CalendarPlus, Apple } from 'lucide-react';

interface Props {
  date: string; // YYYY-MM-DD
  time: string; // HH:MM[:SS]
  durationMin?: number;
  title?: string;
  location?: string;
  description?: string;
  lang?: 'en' | 'ru' | string;
}

const pad = (n: number) => String(n).padStart(2, '0');
const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
const daysInMonth = (y: number, m: number) =>
  [31, isLeap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];

const escapeIcsText = (value: string) =>
  value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');

const toLocalStamp = (date: string, time: string, addMin = 0) => {
  const [Y, M, D] = date.split('-').map(Number);
  const [h, m] = time.split(':').map(Number);
  let year = Y, month = M, day = D, hour = h || 0, minute = (m || 0) + addMin;
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

const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;

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
  const start = toLocalStamp(date, t);
  const end = toLocalStamp(date, t, durationMin);

  const googleUrl = (() => {
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

  const buildIcs = () => {
    const uid = `${start}-${Math.random().toString(36).slice(2, 9)}@limassol-fitness.com`;
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    return [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Limassol Fitness//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:Limassol Fitness',
      'X-WR-TIMEZONE:Asia/Nicosia',
      'BEGIN:VTIMEZONE',
      'TZID:Asia/Nicosia',
      'BEGIN:STANDARD',
      'DTSTART:19701025T040000',
      'TZOFFSETFROM:+0300',
      'TZOFFSETTO:+0200',
      'TZNAME:EET',
      'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
      'END:STANDARD',
      'BEGIN:DAYLIGHT',
      'DTSTART:19700329T030000',
      'TZOFFSETFROM:+0200',
      'TZOFFSETTO:+0300',
      'TZNAME:EEST',
      'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
      'END:DAYLIGHT',
      'END:VTIMEZONE',
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${stamp}`,
      `DTSTART;TZID=Asia/Nicosia:${start}`,
      `DTEND;TZID=Asia/Nicosia:${end}`,
      `SUMMARY:${escapeIcsText(title)}`,
      `LOCATION:${escapeIcsText(location)}`,
      `DESCRIPTION:${escapeIcsText(description || title)}`,
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      'DESCRIPTION:Reminder',
      'TRIGGER:-PT1H',
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n') + '\r\n';
  };

  const openIcs = async () => {
    const ics = buildIcs();
    const fileName = `limassol-fitness-training-${date}.ics`;
    const file = new File([ics], fileName, { type: 'text/calendar' });

    if (isIOS() && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title, text: title });
        setOpen(false);
        return;
      } catch (error) {
        if ((error as DOMException)?.name === 'AbortError') {
          setOpen(false);
          return;
        }
      }
    }

    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    if (isIOS()) {
      window.open(url, '_blank');
    } else {
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    setOpen(false);
  };

  const labelGoogle = lang === 'ru' ? 'Google Календарь' : 'Google Calendar';
  const labelApple = lang === 'ru' ? 'Apple Календарь' : 'Apple Calendar';
  const labelTitle = lang === 'ru' ? 'Добавить в календарь' : 'Add to calendar';

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
        title={labelTitle}
        className="text-primary bg-primary/10 hover:bg-primary/20 active:scale-95 transition-all px-2 py-1 rounded-lg flex items-center"
      >
        <CalendarPlus className="w-3.5 h-3.5" />
      </button>
      {open && (
        <div
          className="absolute right-0 top-full mt-2 z-50 glass rounded-2xl shadow-2xl overflow-hidden min-w-[200px] animate-slide-up"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 pt-2.5 pb-1.5 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold border-b border-border/40">
            {labelTitle}
          </div>
          <a
            href={googleUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-3 py-2.5 text-sm hover:bg-primary/10 text-foreground transition-colors"
          >
            <span className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <CalendarPlus className="w-4 h-4" />
            </span>
            <span className="font-medium">{labelGoogle}</span>
          </a>
          <button
            onClick={openIcs}
            className="w-full text-left flex items-center gap-2.5 px-3 py-2.5 text-sm hover:bg-primary/10 text-foreground border-t border-border/40 transition-colors"
          >
            <span className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Apple className="w-4 h-4" />
            </span>
            <span className="font-medium">{labelApple}</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default AddToCalendarButton;
