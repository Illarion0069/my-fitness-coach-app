import { useState, useRef, useCallback } from 'react';
import { Clock3, RotateCw, Trash2, X, GripVertical, Check, ChevronUp, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface TimelineEntry {
  id: string;
  kind: 'session' | 'block';
  title: string;
  subtitle?: string;
  time: string;
  durationMinutes: number;
  isRecurring: boolean;
  tone: 'session' | 'travel' | 'blocked' | 'neutral' | 'reload' | 'personal' | 'guest';
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
  onMoveEntry?: (entry: TimelineEntry, newTime: string) => void;
  onMoveEntryDay?: (entry: TimelineEntry, newTime: string) => void;
}

const SLOT_HEIGHT = 44;
const SNAP_MINUTES = 30;

const getMinutes = (time: string) => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + (minutes || 0);
};

const minutesToTime = (m: number) => {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
};

const snapToSlot = (minutes: number) => Math.round(minutes / SNAP_MINUTES) * SNAP_MINUTES;

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
    while (active.some((item) => item.lane === lane)) lane += 1;
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
  session: 'border-red-400/30 bg-red-500/15 text-foreground',
  travel: 'border-orange-400/30 bg-orange-500/15 text-foreground',
  blocked: 'border-destructive/20 bg-destructive/10 text-foreground',
  neutral: 'border-border bg-secondary text-foreground',
  reload: 'border-teal-400/30 bg-teal-500/15 text-foreground',
  personal: 'border-blue-400/30 bg-blue-500/15 text-foreground',
  guest: 'border-amber-400/40 bg-amber-500/15 text-foreground',
};

const DayTimeline = ({
  lang, slots, entries, isToday,
  onDeleteEntry, onDeleteEntryDay, onDeleteEntrySeries, onSelectTime, onMoveEntry, onMoveEntryDay,
}: Props) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingTime, setEditingTime] = useState<string | null>(null);
  const [pendingMove, setPendingMove] = useState<{ entry: TimelineEntry; newTime: string } | null>(null);

  // Drag state
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const dragStartY = useRef(0);
  const dragStartTop = useRef(0);
  const dragEntryRef = useRef<TimelineEntry | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const positionedEntries = positionEntries(entries);
  const startMinutes = slots.length > 0 ? getMinutes(slots[0]) : 0;
  const totalHeight = Math.max(slots.length * SLOT_HEIGHT, SLOT_HEIGHT * 8);
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const showNowLine = isToday && nowMinutes >= startMinutes && nowMinutes <= startMinutes + slots.length * 30;

  // Touch drag handlers
  const handleTouchStart = useCallback((e: React.TouchEvent, entry: TimelineEntry, currentTop: number) => {
    if (!onMoveEntry) return;
    // Need a long press feel — we'll start immediately but require 8px movement to activate
    dragStartY.current = e.touches[0].clientY;
    dragStartTop.current = currentTop;
    dragEntryRef.current = entry;
    setDragId(entry.id);
    setDragOffsetY(0);
  }, [onMoveEntry]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!dragId) return;
    e.preventDefault();
    const deltaY = e.touches[0].clientY - dragStartY.current;
    setDragOffsetY(deltaY);
  }, [dragId]);

  const handleTouchEnd = useCallback(() => {
    if (!dragId || !dragEntryRef.current || !onMoveEntry) {
      setDragId(null);
      return;
    }

    const newTop = dragStartTop.current + dragOffsetY;
    const newMinutes = snapToSlot(startMinutes + (newTop / SLOT_HEIGHT) * 30);
    const newTime = minutesToTime(Math.max(newMinutes, startMinutes));
    const oldTime = dragEntryRef.current.time.slice(0, 5);

    if (newTime !== oldTime && Math.abs(dragOffsetY) > 8) {
      if (dragEntryRef.current.isRecurring && onMoveEntryDay) {
        setPendingMove({ entry: dragEntryRef.current, newTime });
      } else {
        onMoveEntry(dragEntryRef.current, newTime);
      }
    }

    setDragId(null);
    setDragOffsetY(0);
    dragEntryRef.current = null;
  }, [dragId, dragOffsetY, onMoveEntry, startMinutes]);

  // Time editor helpers
  const adjustTime = (currentTime: string, delta: number) => {
    const mins = getMinutes(currentTime) + delta;
    return minutesToTime(Math.max(0, Math.min(mins, 23 * 60 + 30)));
  };

  const startEditingTime = (entry: TimelineEntry) => {
    setEditingTime(entry.time.slice(0, 5));
    setExpandedId(entry.id);
  };

  const confirmTimeEdit = (entry: TimelineEntry) => {
    if (editingTime && onMoveEntry && editingTime !== entry.time.slice(0, 5)) {
      if (entry.isRecurring && onMoveEntryDay) {
        setPendingMove({ entry, newTime: editingTime });
      } else {
        onMoveEntry(entry, editingTime);
      }
    }
    setEditingTime(null);
    setExpandedId(null);
  };

  return (
    <>
    <div className="rounded-2xl border border-border bg-card overflow-hidden pt-2 pb-20">
      <div className="grid grid-cols-[58px_minmax(0,1fr)]">
        <div className="border-r border-border/60 bg-secondary/20">
          {slots.map((slot) => (
            <div key={slot} className="h-11 border-t border-border/60 pr-2 text-right text-[11px] text-muted-foreground first:border-t-0">
              <span className="relative -top-2 inline-block rounded bg-card px-1">{slot}</span>
            </div>
          ))}
        </div>

        <div
          ref={containerRef}
          className="relative"
          style={{ height: totalHeight }}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
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

          {/* Backdrop to close expanded card */}
          {expandedId && (
            <div
              className="absolute inset-0 z-25"
              style={{ height: totalHeight }}
              onClick={() => { setExpandedId(null); setEditingTime(null); }}
            />
          )}

          {positionedEntries.map((entry) => {
            const baseTop = ((entry.startMinutes - startMinutes) / 30) * SLOT_HEIGHT + 2;
            const baseHeight = Math.max((Math.max(entry.durationMinutes, 30) / 30) * SLOT_HEIGHT - 4, 36);
            const isExpanded = expandedId === entry.id;
            const isDragging = dragId === entry.id;
            const top = isDragging ? baseTop + dragOffsetY : baseTop;
            const width = `calc(${100 / entry.laneCount}% - 8px)`;
            const left = `calc(${(100 / entry.laneCount) * entry.lane}% + 4px)`;
            const compact = baseHeight < 70;

            const snapPreviewMinutes = isDragging
              ? snapToSlot(startMinutes + (top / SLOT_HEIGHT) * 30)
              : null;
            const snapPreviewTime = snapPreviewMinutes !== null ? minutesToTime(Math.max(snapPreviewMinutes, startMinutes)) : null;

            return (
              <div
                key={entry.id}
                className={cn(
                  'absolute rounded-xl border shadow-sm transition-[height,box-shadow]',
                  toneClasses[entry.tone],
                  isExpanded && 'z-30 ring-2 ring-primary/30 shadow-lg',
                  isDragging && 'z-40 shadow-xl opacity-90 scale-[1.03]',
                  !isDragging && !isExpanded && 'z-20',
                )}
                style={{
                  top,
                  left,
                  width,
                  height: isExpanded ? 'auto' : baseHeight,
                  minHeight: baseHeight,
                  touchAction: 'none',
                  transition: isDragging ? 'box-shadow 0.15s, transform 0.1s' : undefined,
                }}
              >
                <div className="flex items-start">
                  {onMoveEntry && (
                    <div
                      className="flex items-center justify-center w-6 h-full min-h-[36px] shrink-0 cursor-grab active:cursor-grabbing text-muted-foreground/40"
                      onTouchStart={(e) => handleTouchStart(e, entry, baseTop)}
                    >
                      <GripVertical className="w-3.5 h-3.5" />
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isDragging) return;
                      if (expandedId === entry.id) {
                        setExpandedId(null);
                        setEditingTime(null);
                      } else {
                        startEditingTime(entry);
                      }
                    }}
                    className="flex-1 px-1.5 py-2 text-left min-w-0"
                  >
                    <div className="flex items-start justify-between gap-1">
                      <p className="min-w-0 truncate text-[11px] font-semibold leading-tight">{entry.title}</p>
                      <div className="flex items-center gap-0.5 shrink-0">
                        {entry.isRecurring && <RotateCw className="h-3 w-3 opacity-70" />}
                        {isExpanded && <X className="h-3 w-3 opacity-50" />}
                      </div>
                    </div>
                    <div className="mt-0.5 flex items-center gap-1 text-[10px] opacity-75">
                      <Clock3 className="h-3 w-3 shrink-0" />
                      {isDragging && snapPreviewTime ? (
                        <span className="font-bold text-primary">{snapPreviewTime}</span>
                      ) : (
                        <span>{entry.time.slice(0, 5)}</span>
                      )}
                      {!compact && <span>· {entry.durationMinutes} {lang === 'en' ? 'min' : 'мин'}</span>}
                    </div>
                    {!compact && !isExpanded && entry.subtitle && (
                      <p className="mt-0.5 overflow-hidden text-[10px] leading-tight opacity-70">{entry.subtitle}</p>
                    )}
                  </button>
                </div>

                {isExpanded && (
                  <div className="px-2 pb-2 space-y-2" onClick={(e) => e.stopPropagation()}>
                    {onMoveEntry && editingTime && (
                      <div className="flex items-center gap-1.5 bg-secondary/50 rounded-lg px-2 py-1.5">
                        <Clock3 className="h-3 w-3 text-muted-foreground shrink-0" />
                        <button
                          onClick={() => setEditingTime(adjustTime(editingTime, -30))}
                          className="h-6 w-6 flex items-center justify-center rounded-md bg-card border border-border text-xs"
                        >
                          <ChevronDown className="h-3 w-3" />
                        </button>
                        <span className="text-sm font-bold tabular-nums min-w-[3rem] text-center">{editingTime}</span>
                        <button
                          onClick={() => setEditingTime(adjustTime(editingTime, 30))}
                          className="h-6 w-6 flex items-center justify-center rounded-md bg-card border border-border text-xs"
                        >
                          <ChevronUp className="h-3 w-3" />
                        </button>
                        {editingTime !== entry.time.slice(0, 5) && (
                          <button
                            onClick={() => confirmTimeEdit(entry)}
                            className="ml-auto h-6 w-6 flex items-center justify-center rounded-md bg-primary text-primary-foreground"
                          >
                            <Check className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    )}

                    <div className="flex flex-wrap gap-1.5">
                      {!entry.isRecurring ? (
                        <button
                          onClick={() => { onDeleteEntry(entry); setExpandedId(null); setEditingTime(null); }}
                          className="inline-flex items-center gap-1 rounded-lg border border-destructive/30 bg-destructive/10 px-2 py-1 text-[10px] font-medium text-destructive"
                        >
                          <Trash2 className="h-3 w-3" />
                          {lang === 'en' ? 'Delete' : 'Удалить'}
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => { onDeleteEntryDay(entry); setExpandedId(null); setEditingTime(null); }}
                            className="rounded-lg border border-border bg-card px-2 py-1 text-[10px] font-medium"
                          >
                            {lang === 'en' ? 'This day' : 'Этот день'}
                          </button>
                          <button
                            onClick={() => { onDeleteEntrySeries(entry); setExpandedId(null); setEditingTime(null); }}
                            className="inline-flex items-center gap-1 rounded-lg border border-destructive/30 bg-destructive/10 px-2 py-1 text-[10px] font-medium text-destructive"
                          >
                            <Trash2 className="h-3 w-3" />
                            {lang === 'en' ? 'Series' : 'Серию'}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {entries.length === 0 && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-muted-foreground">
              {lang === 'en' ? 'No events yet — tap any slot to add one.' : 'Событий пока нет — нажми на любой слот, чтобы добавить.'}
            </div>
          )}
        </div>
      </div>
    </div>

    {/* iPhone-style move confirmation modal for recurring entries */}
    {pendingMove && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setPendingMove(null)}>
        <div
          className="w-full max-w-sm mx-4 space-y-2 animate-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="rounded-2xl bg-card border border-border overflow-hidden">
            <div className="px-4 py-3 text-center border-b border-border">
              <p className="text-xs text-muted-foreground">
                {lang === 'en'
                  ? `Move "${pendingMove.entry.title}" to ${pendingMove.newTime}?`
                  : `Перенести «${pendingMove.entry.title}» на ${pendingMove.newTime}?`}
              </p>
            </div>
            <button
              className="w-full px-4 py-3 text-sm font-medium text-primary border-b border-border hover:bg-secondary/50 transition-colors"
              onClick={() => {
                onMoveEntryDay?.(pendingMove.entry, pendingMove.newTime);
                setPendingMove(null);
              }}
            >
              {lang === 'en' ? 'Move this day only' : 'Перенести только этот день'}
            </button>
            <button
              className="w-full px-4 py-3 text-sm font-medium text-primary hover:bg-secondary/50 transition-colors"
              onClick={() => {
                onMoveEntry?.(pendingMove.entry, pendingMove.newTime);
                setPendingMove(null);
              }}
            >
              {lang === 'en' ? 'Move entire series' : 'Перенести всю серию'}
            </button>
          </div>
          <button
            className="w-full rounded-2xl bg-card border border-border px-4 py-3 text-sm font-semibold text-primary hover:bg-secondary/50 transition-colors"
            onClick={() => setPendingMove(null)}
          >
            {lang === 'en' ? 'Cancel' : 'Отмена'}
          </button>
        </div>
      </div>
    )}
  </>
  );
};

export default DayTimeline;
