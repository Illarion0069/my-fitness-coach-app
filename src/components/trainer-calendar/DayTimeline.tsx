import { useState } from 'react';
import { Clock3, RotateCw, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface TimelineEntry {
  id: string;
  kind: 'session' | 'block';
  title: string;
  subtitle?: string;
  time: string;
  durationMinutes: number;
  isRecurring: boolean;
  tone: 'session' | 'travel' | 'blocked' | 'neutral';
}

interface PositionedEntry extends TimelineEntry {
  startMinutes: number;
  endMinutes: number;
  lane: number;
  laneCount: number;
}

interface Props {
  lang: string;
  slots: string[];
  entries: TimelineEntry[];
  isToday: boolean;
  onDeleteEntry: (entry: TimelineEntry) => void;
  onDeleteEntryDay: (entry: TimelineEntry) => void;
  onDeleteEntrySeries: (entry: TimelineEntry) => void;
  onSelectTime: (time: string) => void;
}

const SLOT_HEIGHT = 44;

const getMinutes = (time: string) => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + (minutes || 0);
};

const overlap = (a: PositionedEntry, b: PositionedEntry) => a.startMinutes < b.endMinutes && a.endMinutes > b.startMinutes;

const positionEntries = (entries: TimelineEntry[]) => {
  const laidOut: PositionedEntry[] = [...entries]
    .sort((a, b) => getMinutes(a.time) - getMinutes(b.time) || b.durationMinutes - a.durationMinutes)
    .map((entry) => ({
      ...entry,
      startMinutes: getMinutes(entry.time),
      endMinutes: getMinutes(entry.time) + Math.max(entry.durationMinutes, 30),
      lane: 0,
      laneCount: 1,
    }));

  const active: Array<{ lane: number; endMinutes: number }> = [];

  laidOut.forEach((entry) => {
    for (let index = active.length - 1; index >= 0; index -= 1) {
      if (active[index].endMinutes <= entry.startMinutes) {
        active.splice(index, 1);
      }
    }

    let lane = 0;
    while (active.some((item) => item.lane === lane)) {
      lane += 1;
    }

    entry.lane = lane;
    active.push({ lane, endMinutes: entry.endMinutes });
  });

  laidOut.forEach((entry) => {
    const overlappingEntries = laidOut.filter((candidate) => overlap(entry, candidate));
    entry.laneCount = Math.max(...overlappingEntries.map((candidate) => candidate.lane + 1), 1);
  });

  return laidOut;
};

const toneClasses: Record<TimelineEntry['tone'], string> = {
  session: 'border-primary/20 bg-primary/10 text-foreground',
  travel: 'border-accent bg-accent text-accent-foreground',
  blocked: 'border-destructive/20 bg-destructive/10 text-foreground',
  neutral: 'border-border bg-secondary text-foreground',
};

const DayTimeline = ({ lang, slots, entries, isToday, onDeleteEntry, onDeleteEntryDay, onDeleteEntrySeries, onSelectTime }: Props) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const positionedEntries = positionEntries(entries);
  const startMinutes = slots.length > 0 ? getMinutes(slots[0]) : 0;
  const totalHeight = Math.max(slots.length * SLOT_HEIGHT, SLOT_HEIGHT * 8);
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const showNowLine = isToday && nowMinutes >= startMinutes && nowMinutes <= startMinutes + slots.length * 30;

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden pt-2">
      <div className="grid grid-cols-[58px_minmax(0,1fr)]">
        <div className="border-r border-border/60 bg-secondary/20">
          {slots.map((slot) => (
            <div key={slot} className="h-11 border-t border-border/60 pr-2 text-right text-[11px] text-muted-foreground first:border-t-0">
              <span className="relative -top-2 inline-block rounded bg-card px-1">{slot}</span>
            </div>
          ))}
        </div>

        <div className="relative" style={{ height: totalHeight }}>
          {slots.map((slot, index) => (
            <button
              key={slot}
              type="button"
              onClick={() => onSelectTime(slot)}
              className="absolute left-0 right-0 border-t border-border/60 text-left transition-colors hover:bg-secondary/30 first:border-t-0"
              style={{ top: index * SLOT_HEIGHT, height: SLOT_HEIGHT }}
              aria-label={lang === 'en' ? `Add event at ${slot}` : `Добавить событие на ${slot}`}
            />
          ))}

          {showNowLine && (
            <div className="pointer-events-none absolute left-0 right-0 z-10" style={{ top: ((nowMinutes - startMinutes) / 30) * SLOT_HEIGHT }}>
              <div className="h-px bg-primary/70" />
              <div className="absolute -left-1.5 -top-1.5 h-3 w-3 rounded-full bg-primary" />
            </div>
          )}

          {positionedEntries.map((entry) => {
            const top = ((entry.startMinutes - startMinutes) / 30) * SLOT_HEIGHT + 2;
            const baseHeight = Math.max((Math.max(entry.durationMinutes, 30) / 30) * SLOT_HEIGHT - 4, 36);
            const isExpanded = expandedId === entry.id;
            const expandedHeight = entry.isRecurring ? baseHeight + 72 : baseHeight + 40;
            const height = isExpanded ? Math.max(expandedHeight, baseHeight) : baseHeight;
            const width = `calc(${100 / entry.laneCount}% - 8px)`;
            const left = `calc(${(100 / entry.laneCount) * entry.lane}% + 4px)`;
            const compact = baseHeight < 70;

            return (
              <div
                key={entry.id}
                className={cn(
                  'absolute z-20 rounded-xl border shadow-sm transition-all',
                  toneClasses[entry.tone],
                  isExpanded && 'z-30 ring-2 ring-primary/30 shadow-lg',
                )}
                style={{ top, left, width, height: isExpanded ? 'auto' : height, minHeight: height }}
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpandedId(isExpanded ? null : entry.id);
                  }}
                  className="w-full px-2 py-2 text-left"
                >
                  <div className="flex items-start justify-between gap-1">
                    <p className="min-w-0 truncate text-[11px] font-semibold leading-tight">{entry.title}</p>
                    <div className="flex items-center gap-0.5 shrink-0">
                      {entry.isRecurring && <RotateCw className="h-3 w-3 opacity-70" />}
                      {isExpanded && (
                        <X className="h-3 w-3 opacity-50" />
                      )}
                    </div>
                  </div>
                  <div className="mt-0.5 flex items-center gap-1 text-[10px] opacity-75">
                    <Clock3 className="h-3 w-3 shrink-0" />
                    <span>{entry.time.slice(0, 5)}</span>
                    {!compact && <span>· {entry.durationMinutes} {lang === 'en' ? 'min' : 'мин'}</span>}
                  </div>
                  {!compact && !isExpanded && entry.subtitle && (
                    <p className="mt-0.5 overflow-hidden text-[10px] leading-tight opacity-70">{entry.subtitle}</p>
                  )}
                </button>

                {isExpanded && (
                  <div className="px-2 pb-2 flex flex-wrap gap-1.5" onClick={(e) => e.stopPropagation()}>
                    {!entry.isRecurring ? (
                      <button
                        onClick={() => { onDeleteEntry(entry); setExpandedId(null); }}
                        className="inline-flex items-center gap-1 rounded-lg border border-destructive/30 bg-destructive/10 px-2 py-1 text-[10px] font-medium text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                        {lang === 'en' ? 'Delete' : 'Удалить'}
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => { onDeleteEntryDay(entry); setExpandedId(null); }}
                          className="rounded-lg border border-border bg-card px-2 py-1 text-[10px] font-medium"
                        >
                          {lang === 'en' ? 'This day' : 'Этот день'}
                        </button>
                        <button
                          onClick={() => { onDeleteEntrySeries(entry); setExpandedId(null); }}
                          className="inline-flex items-center gap-1 rounded-lg border border-destructive/30 bg-destructive/10 px-2 py-1 text-[10px] font-medium text-destructive"
                        >
                          <Trash2 className="h-3 w-3" />
                          {lang === 'en' ? 'Series' : 'Серию'}
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {entries.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-muted-foreground">
              {lang === 'en' ? 'No events yet — tap any slot to add one.' : 'Событий пока нет — нажми на любой слот, чтобы добавить.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DayTimeline;
