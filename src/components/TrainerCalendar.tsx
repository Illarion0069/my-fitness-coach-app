import React, { useEffect, useMemo, useState } from 'react';
import { addDays, format, isSameDay, startOfWeek } from 'date-fns';
import { enUS, ru } from 'date-fns/locale';
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, Plus, RotateCw, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import TrainerBlockModal from './TrainerBlockModal';
import DayTimeline, { type TimelineEntry } from './trainer-calendar/DayTimeline';

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
}

interface ScheduledSession {
  id: string;
  user_id: string;
  trainer_user_id: string;
  session_date: string;
  session_time: string | null;
  is_recurring: boolean;
  recurrence_day: number | null;
  recurrence_time: string | null;
  is_deducted: boolean;
  duration_minutes: number;
  recurring_exceptions: string[];
  notes: string | null;
  package_id?: string | null;
}

interface TrainerBlock {
  id: string;
  trainer_user_id: string;
  block_type: string;
  title: string | null;
  block_date: string | null;
  block_time: string;
  duration_minutes: number;
  is_recurring: boolean;
  recurrence_day: number | null;
  linked_session_id: string | null;
  recurring_exceptions: string[];
}

interface TrainerWorkingHours {
  work_start_hour: number;
  work_end_hour: number;
  days_off: number[];
}

interface Props {
  lang: string;
  clients: Profile[];
  onSessionChange?: () => void;
}

const dayNamesRu = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const dayNamesEn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const TrainerCalendar = ({ lang, clients, onSessionChange }: Props) => {
  const { toast } = useToast();
  const locale = lang === 'en' ? enUS : ru;

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [sessions, setSessions] = useState<ScheduledSession[]>([]);
  const [blocks, setBlocks] = useState<TrainerBlock[]>([]);
  const [clientRemaining, setClientRemaining] = useState<Record<string, { remaining: number; total: number }>>({});
  const [selectedClientId, setSelectedClientId] = useState('');
  const [addTime, setAddTime] = useState('09:00');
  const [showBlockModal, setShowBlockModal] = useState<string | null>(null);
  
  const [workingHours, setWorkingHours] = useState<TrainerWorkingHours>({
    work_start_hour: 7,
    work_end_hour: 19,
    days_off: [0],
  });

  const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
  const dayOfWeek = selectedDate.getDay();
  const dayNames = lang === 'en' ? dayNamesEn : dayNamesRu;
  const isDayOff = workingHours.days_off.includes(dayOfWeek);

  const fetchSessions = async () => {
    const { data } = await supabase
      .from('scheduled_sessions')
      .select('*')
      .order('session_date', { ascending: true });

    setSessions((data as ScheduledSession[]) || []);
  };

  const fetchBlocks = async () => {
    const { data } = await supabase
      .from('trainer_blocks')
      .select('*')
      .order('block_time', { ascending: true });

    setBlocks((data as TrainerBlock[]) || []);
  };

  const fetchClientPackages = async () => {
    const { data } = await supabase
      .from('client_packages')
      .select('user_id, total_sessions, used_sessions, is_active, created_at')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    const nextMap: Record<string, { remaining: number; total: number }> = {};
    (data || []).forEach((pkg) => {
      const remaining = pkg.total_sessions - pkg.used_sessions;
      if (remaining > 0 && !nextMap[pkg.user_id]) {
        nextMap[pkg.user_id] = { remaining, total: pkg.total_sessions };
      }
    });
    setClientRemaining(nextMap);
  };

  const fetchWorkingHours = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { data } = await supabase
      .from('trainer_working_hours')
      .select('work_start_hour, work_end_hour, days_off')
      .eq('trainer_user_id', user.id)
      .maybeSingle();

    if (data) {
      setWorkingHours({
        work_start_hour: data.work_start_hour,
        work_end_hour: data.work_end_hour,
        days_off: data.days_off || [0],
      });
    }
  };

  useEffect(() => {
    Promise.all([fetchSessions(), fetchBlocks(), fetchClientPackages(), fetchWorkingHours()]);
  }, []);

  useEffect(() => {
    setSelectedEntryId(null);
  }, [selectedDateStr]);

  const daySessions = useMemo(() => {
    const items = sessions.filter((session) => {
      if (session.is_recurring && session.recurrence_day === dayOfWeek) {
        return !session.recurring_exceptions?.includes(selectedDateStr);
      }
      return !session.is_recurring && session.session_date === selectedDateStr;
    });

    return items.sort((a, b) => {
      const timeA = (a.is_recurring ? a.recurrence_time : a.session_time) || '99:99';
      const timeB = (b.is_recurring ? b.recurrence_time : b.session_time) || '99:99';
      return timeA.localeCompare(timeB);
    });
  }, [sessions, dayOfWeek, selectedDateStr]);

  const dayBlocks = useMemo(() => {
    const items = blocks.filter((block) => {
      if (block.is_recurring && block.recurrence_day === dayOfWeek) {
        return !block.recurring_exceptions?.includes(selectedDateStr);
      }
      return !block.is_recurring && block.block_date === selectedDateStr;
    });

    return items.sort((a, b) => a.block_time.localeCompare(b.block_time));
  }, [blocks, dayOfWeek, selectedDateStr]);

  const getClientName = (session: ScheduledSession) => {
    const manualMatch = session.notes?.match(/^👤 (.+?) \(manual\)$/);
    if (manualMatch?.[1]) return manualMatch[1];
    return clients.find((client) => client.user_id === session.user_id)?.full_name || '—';
  };

  const addSession = async () => {
    if (!selectedClientId || !addTime) return;

    const res = await supabase.functions.invoke('book-session', {
      body: {
        action: 'trainerBook',
        client_user_id: selectedClientId,
        date: selectedDateStr,
        time: addTime,
      },
    });

    if (res.error || !res.data?.success) {
      toast({
        title: res.data?.error || res.error?.message || (lang === 'en' ? 'Failed to add session' : 'Не удалось добавить тренировку'),
        variant: 'destructive',
      });
      return;
    }

    setSelectedClientId('');
    setAddTime('09:00');
    await Promise.all([fetchSessions(), fetchClientPackages()]);
    onSessionChange?.();
    toast({ title: lang === 'en' ? 'Session added' : 'Тренировка добавлена' });
  };

  const deleteOneOffSession = async (session: ScheduledSession) => {
    const {
      data: { session: authSession },
    } = await supabase.auth.getSession();
    const token = authSession?.access_token;

    const res = await supabase.functions.invoke('restore-session', {
      body: { sessionId: session.id, userId: session.user_id },
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    if (res.error) {
      toast({ title: lang === 'en' ? 'Error removing session' : 'Ошибка при удалении', variant: 'destructive' });
      return;
    }

    setSelectedEntryId(null);
    await Promise.all([fetchSessions(), fetchClientPackages()]);
    onSessionChange?.();
    toast({ title: lang === 'en' ? 'Session removed' : 'Тренировка удалена' });
  };

  const deleteRecurringForDay = async (session: ScheduledSession) => {
    const exceptions = [...(session.recurring_exceptions || []), selectedDateStr];
    await supabase.from('scheduled_sessions').update({ recurring_exceptions: exceptions }).eq('id', session.id);

    setSelectedEntryId(null);
    await fetchSessions();
    onSessionChange?.();
    toast({ title: lang === 'en' ? 'Occurrence removed' : 'Тренировка на этот день удалена' });
  };

  const deleteRecurringSeries = async (session: ScheduledSession) => {
    await supabase.from('scheduled_sessions').delete().eq('id', session.id);
    setSelectedEntryId(null);
    await Promise.all([fetchSessions(), fetchClientPackages()]);
    onSessionChange?.();
    toast({ title: lang === 'en' ? 'Series removed' : 'Серия удалена' });
  };

  const deleteBlockForDay = async (block: TrainerBlock) => {
    const exceptions = [...(block.recurring_exceptions || []), selectedDateStr];
    await supabase.from('trainer_blocks').update({ recurring_exceptions: exceptions }).eq('id', block.id);

    setSelectedEntryId(null);
    await fetchBlocks();
    toast({ title: lang === 'en' ? 'Occurrence removed' : 'Блок на этот день удалён' });
  };

  const deleteBlockSeries = async (block: TrainerBlock) => {
    await supabase.from('trainer_blocks').delete().eq('id', block.id);
    setSelectedEntryId(null);
    await fetchBlocks();
    toast({ title: lang === 'en' ? 'Series removed' : 'Серия удалена' });
  };

  const saveBlock = async (block: {
    block_type: string;
    title: string | null;
    block_time: string;
    duration_minutes: number;
    is_recurring: boolean;
    recurrence_day: number | null;
    block_date: string | null;
  }) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('trainer_blocks').insert({
      trainer_user_id: user.id,
      ...block,
    });

    setShowBlockModal(null);
    await fetchBlocks();
    toast({ title: lang === 'en' ? 'Block added' : 'Блок добавлен' });
  };

  const onAddSessionFromModal = async ({
    clientId,
    manualName,
    time,
    travelMinutes,
    isRecurring,
    recurrenceDay,
  }: {
    clientId: string;
    manualName: string;
    time: string;
    travelMinutes: number;
    isRecurring: boolean;
    recurrenceDay: number | null;
  }) => {
    setShowBlockModal(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    if (clientId && !isRecurring) {
      const res = await supabase.functions.invoke('book-session', {
        body: {
          action: 'trainerBook',
          client_user_id: clientId,
          date: selectedDateStr,
          time,
        },
      });

      if (res.error || !res.data?.success) {
        toast({
          title: res.data?.error || res.error?.message || (lang === 'en' ? 'Failed to add session' : 'Не удалось добавить тренировку'),
          variant: 'destructive',
        });
        return;
      }
    } else {
      const notes = manualName && !clientId ? `👤 ${manualName} (manual)` : null;
      await supabase.from('scheduled_sessions').insert({
        user_id: clientId || user.id,
        trainer_user_id: user.id,
        session_date: selectedDateStr,
        session_time: isRecurring ? null : time || null,
        is_recurring: isRecurring,
        recurrence_day: isRecurring ? recurrenceDay : null,
        recurrence_time: isRecurring ? time || null : null,
        notes,
      });
    }

    if (travelMinutes > 0 && time) {
      const [hours, minutes] = time.split(':').map(Number);
      const startMinutes = hours * 60 + (minutes || 0) - travelMinutes;
      const travelHour = Math.max(0, Math.floor(startMinutes / 60));
      const travelMinute = Math.max(0, startMinutes % 60);
      const travelTime = `${String(travelHour).padStart(2, '0')}:${String(travelMinute).padStart(2, '0')}`;

      await supabase.from('trainer_blocks').insert({
        trainer_user_id: user.id,
        block_type: 'travel',
        title: lang === 'en' ? 'Travel' : 'В пути',
        block_time: travelTime,
        duration_minutes: travelMinutes,
        is_recurring: isRecurring,
        recurrence_day: isRecurring ? recurrenceDay : null,
        block_date: isRecurring ? null : selectedDateStr,
      });
    }

    await Promise.all([fetchSessions(), fetchBlocks(), fetchClientPackages()]);
    onSessionChange?.();
    toast({ title: lang === 'en' ? 'Session added' : 'Тренировка добавлена' });
  };

  const blockTypeLabel = (block: TrainerBlock) => {
    if (block.title) return block.title;
    if (block.block_type === 'travel') return lang === 'en' ? 'Travel' : 'В пути';
    if (block.block_type === 'reload') return 'Reload';
    if (block.block_type === 'personal') return lang === 'en' ? 'Personal' : 'Личное';
    return lang === 'en' ? 'Blocked' : 'Закрыто';
  };

  const slots = useMemo(() => {
    const endHour = Math.max(workingHours.work_end_hour, workingHours.work_start_hour + 1);
    const count = (endHour - workingHours.work_start_hour) * 2;

    return Array.from({ length: count }, (_, index) => {
      const totalMinutes = workingHours.work_start_hour * 60 + index * 30;
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    });
  }, [workingHours.work_end_hour, workingHours.work_start_hour]);

  const weekDays = useMemo(() => {
    const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1, locale });
    return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  }, [locale, selectedDate]);

  const timelineEntries = useMemo<TimelineEntry[]>(() => {
    const sessionEntries = daySessions.map((session) => {
      const time = session.is_recurring ? session.recurrence_time : session.session_time;
      const remaining = clientRemaining[session.user_id];

      return {
        id: session.id,
        kind: 'session' as const,
        title: getClientName(session),
        subtitle: remaining ? `${lang === 'en' ? 'Left' : 'Осталось'}: ${remaining.remaining}/${remaining.total}` : session.notes || undefined,
        time: time || '09:00',
        durationMinutes: session.duration_minutes || 60,
        isRecurring: session.is_recurring,
        tone: 'session' as const,
      };
    });

    const blockEntries = dayBlocks.map((block) => ({
      id: block.id,
      kind: 'block' as const,
      title: blockTypeLabel(block),
      subtitle: `${block.duration_minutes} ${lang === 'en' ? 'min' : 'мин'}`,
      time: block.block_time,
      durationMinutes: block.duration_minutes,
      isRecurring: block.is_recurring,
      tone:
        block.block_type === 'travel'
          ? ('travel' as const)
          : block.block_type === 'block'
            ? ('blocked' as const)
            : ('neutral' as const),
    }));

    return [...sessionEntries, ...blockEntries].sort((a, b) => a.time.localeCompare(b.time));
  }, [clientRemaining, dayBlocks, daySessions, lang]);

  const selectedSession = selectedEntryId ? daySessions.find((session) => session.id === selectedEntryId) || null : null;
  const selectedBlock = selectedEntryId ? dayBlocks.find((block) => block.id === selectedEntryId) || null : null;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={() => setSelectedDate(addDays(selectedDate, -1))}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-secondary/50"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <div className="min-w-0 flex-1 text-center">
            <p className="text-xs text-muted-foreground">{lang === 'en' ? 'Selected day' : 'Выбранный день'}</p>
            <p className="truncate font-semibold">{format(selectedDate, 'EEEE, d MMMM', { locale })}</p>
          </div>

          <button
            onClick={() => setSelectedDate(addDays(selectedDate, 1))}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-secondary/50"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-2">
          {weekDays.map((date) => {
            const active = isSameDay(date, selectedDate);
            return (
              <button
                key={date.toISOString()}
                type="button"
                onClick={() => setSelectedDate(date)}
                className={`rounded-2xl border px-2 py-2 text-center transition-colors ${
                  active
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-secondary/30 text-foreground hover:bg-secondary/50'
                }`}
              >
                <p className={`text-[10px] font-medium ${active ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                  {dayNames[date.getDay()]}
                </p>
                <p className="text-sm font-semibold">{format(date, 'd')}</p>
              </button>
            );
          })}
        </div>

        <div className="grid gap-2 sm:grid-cols-[1fr_120px_auto]">
          <select
            value={selectedClientId}
            onChange={(e) => setSelectedClientId(e.target.value)}
            className="h-11 rounded-xl border border-border bg-secondary/40 px-3 text-sm"
          >
            <option value="">{lang === 'en' ? 'Choose client' : 'Выберите клиента'}</option>
            {clients.map((client) => {
              const remaining = clientRemaining[client.user_id];
              const suffix = remaining ? ` · ${remaining.remaining}/${remaining.total}` : '';
              return (
                <option key={client.user_id} value={client.user_id}>
                  {client.full_name}{suffix}
                </option>
              );
            })}
          </select>

          <input
            type="time"
            step={1800}
            value={addTime}
            onChange={(e) => setAddTime(e.target.value)}
            className="h-11 rounded-xl border border-border bg-secondary/40 px-3 text-sm"
          />

          <div className="flex gap-2">
            <button
              onClick={addSession}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
            >
              <Plus className="h-4 w-4" />
              {lang === 'en' ? 'Add' : 'Добавить'}
            </button>
            <button
              onClick={() => setShowBlockModal(addTime)}
              className="h-11 rounded-xl border border-border bg-secondary/50 px-4 text-sm font-semibold"
            >
              {lang === 'en' ? 'Block' : 'Блок'}
            </button>
          </div>
        </div>
      </div>

      {isDayOff && (
        <div className="rounded-2xl border border-border bg-secondary/30 px-4 py-3 text-sm text-muted-foreground">
          {lang === 'en' ? 'This day is marked as a day off, but you can still schedule manually.' : 'Этот день отмечен как выходной, но ты всё равно можешь добавить событие вручную.'}
        </div>
      )}

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-semibold">{lang === 'en' ? 'Day calendar' : 'Календарь дня'}</h3>
        </div>

        <DayTimeline
          lang={lang}
          slots={slots}
          entries={timelineEntries}
          isToday={selectedDateStr === format(new Date(), 'yyyy-MM-dd')}
          onDeleteEntry={(entry) => {
            const session = daySessions.find((s) => s.id === entry.id);
            const block = dayBlocks.find((b) => b.id === entry.id);
            if (session) deleteOneOffSession(session);
            if (block) deleteBlockSeries(block);
          }}
          onDeleteEntryDay={(entry) => {
            const session = daySessions.find((s) => s.id === entry.id);
            const block = dayBlocks.find((b) => b.id === entry.id);
            if (session) deleteRecurringForDay(session);
            if (block) deleteBlockForDay(block);
          }}
          onDeleteEntrySeries={(entry) => {
            const session = daySessions.find((s) => s.id === entry.id);
            const block = dayBlocks.find((b) => b.id === entry.id);
            if (session) deleteRecurringSeries(session);
            if (block) deleteBlockSeries(block);
          }}
          onSelectTime={(time) => {
            setAddTime(time);
            setShowBlockModal(time);
          }}
        />
      </section>

      {showBlockModal !== null && (
        <TrainerBlockModal
          lang={lang}
          hour={parseInt(showBlockModal.split(':')[0] || '9', 10)}
          initialTime={showBlockModal}
          date={selectedDateStr}
          dayOfWeek={dayOfWeek}
          clients={clients}
          onClose={() => setShowBlockModal(null)}
          onSaveBlock={saveBlock}
          onAddSession={onAddSessionFromModal}
        />
      )}
    </div>
  );
};

export default TrainerCalendar;
