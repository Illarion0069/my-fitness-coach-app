import React, { useEffect, useMemo, useState } from 'react';
import { addDays, format } from 'date-fns';
import { enUS, ru } from 'date-fns/locale';
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, Plus, RotateCw, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import TrainerBlockModal from './TrainerBlockModal';

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
  const [showBlockModal, setShowBlockModal] = useState<number | null>(null);

  const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
  const dayOfWeek = selectedDate.getDay();
  const dayNames = lang === 'en' ? dayNamesEn : dayNamesRu;

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

  useEffect(() => {
    fetchSessions();
    fetchBlocks();
    fetchClientPackages();
  }, []);

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
    const { data: { session: authSession } } = await supabase.auth.getSession();
    const token = authSession?.access_token;

    const res = await supabase.functions.invoke('restore-session', {
      body: { sessionId: session.id, userId: session.user_id },
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    if (res.error) {
      toast({ title: lang === 'en' ? 'Error removing session' : 'Ошибка при удалении', variant: 'destructive' });
      return;
    }

    await Promise.all([fetchSessions(), fetchClientPackages()]);
    onSessionChange?.();
    toast({ title: lang === 'en' ? 'Session removed' : 'Тренировка удалена' });
  };

  const deleteRecurringForDay = async (session: ScheduledSession) => {
    const exceptions = [...(session.recurring_exceptions || []), selectedDateStr];
    await supabase
      .from('scheduled_sessions')
      .update({ recurring_exceptions: exceptions })
      .eq('id', session.id);

    await fetchSessions();
    onSessionChange?.();
    toast({ title: lang === 'en' ? 'Occurrence removed' : 'Тренировка на этот день удалена' });
  };

  const deleteRecurringSeries = async (session: ScheduledSession) => {
    await supabase.from('scheduled_sessions').delete().eq('id', session.id);
    await Promise.all([fetchSessions(), fetchClientPackages()]);
    onSessionChange?.();
    toast({ title: lang === 'en' ? 'Series removed' : 'Серия удалена' });
  };

  const deleteBlockForDay = async (block: TrainerBlock) => {
    const exceptions = [...(block.recurring_exceptions || []), selectedDateStr];
    await supabase
      .from('trainer_blocks')
      .update({ recurring_exceptions: exceptions })
      .eq('id', block.id);

    await fetchBlocks();
    toast({ title: lang === 'en' ? 'Occurrence removed' : 'Блок на этот день удалён' });
  };

  const deleteBlockSeries = async (block: TrainerBlock) => {
    await supabase.from('trainer_blocks').delete().eq('id', block.id);
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
    const { data: { user } } = await supabase.auth.getUser();
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

    const { data: { user } } = await supabase.auth.getUser();
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
        session_time: isRecurring ? null : (time || null),
        is_recurring: isRecurring,
        recurrence_day: isRecurring ? recurrenceDay : null,
        recurrence_time: isRecurring ? (time || null) : null,
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

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-2xl p-4 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={() => setSelectedDate(addDays(selectedDate, -1))}
            className="h-10 w-10 rounded-xl border border-border bg-secondary/50 flex items-center justify-center"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="text-center min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">{lang === 'en' ? 'Selected day' : 'Выбранный день'}</p>
            <p className="font-semibold truncate">{format(selectedDate, 'EEEE, d MMMM', { locale })}</p>
          </div>

          <button
            onClick={() => setSelectedDate(addDays(selectedDate, 1))}
            className="h-10 w-10 rounded-xl border border-border bg-secondary/50 flex items-center justify-center"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
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
            value={addTime}
            onChange={(e) => setAddTime(e.target.value)}
            className="h-11 rounded-xl border border-border bg-secondary/40 px-3 text-sm"
          />

          <div className="flex gap-2">
            <button
              onClick={addSession}
              className="h-11 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-semibold inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              {lang === 'en' ? 'Add' : 'Добавить'}
            </button>
            <button
              onClick={() => setShowBlockModal(parseInt(addTime.split(':')[0] || '9', 10))}
              className="h-11 px-4 rounded-xl border border-border bg-secondary/50 text-sm font-semibold"
            >
              {lang === 'en' ? 'Block' : 'Блок'}
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="bg-card border border-border rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-muted-foreground" />
            <h3 className="font-semibold">{lang === 'en' ? 'Sessions' : 'Тренировки'}</h3>
          </div>

          {daySessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">{lang === 'en' ? 'No sessions for this day' : 'На этот день тренировок нет'}</p>
          ) : (
            <div className="space-y-3">
              {daySessions.map((session) => {
                const time = session.is_recurring ? session.recurrence_time : session.session_time;
                const remaining = clientRemaining[session.user_id];
                return (
                  <div key={session.id} className="rounded-2xl border border-border bg-secondary/30 p-3 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{getClientName(session)}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <Clock3 className="w-3 h-3" />
                            {time ? time.slice(0, 5) : '—'}
                          </span>
                          {session.is_recurring && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-primary">
                              <RotateCw className="w-3 h-3" />
                              {lang === 'en' ? `Every ${dayNames[session.recurrence_day || 0]}` : `Каждый ${dayNames[session.recurrence_day || 0]}`}
                            </span>
                          )}
                          {remaining && (
                            <span>
                              {lang === 'en' ? 'Left' : 'Осталось'}: {remaining.remaining}/{remaining.total}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {!session.is_recurring ? (
                        <button
                          onClick={() => deleteOneOffSession(session)}
                          className="rounded-xl border border-border px-3 py-2 text-xs font-medium inline-flex items-center gap-1.5"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          {lang === 'en' ? 'Delete' : 'Удалить'}
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => deleteRecurringForDay(session)}
                            className="rounded-xl border border-border px-3 py-2 text-xs font-medium"
                          >
                            {lang === 'en' ? 'Delete this day' : 'Удалить этот день'}
                          </button>
                          <button
                            onClick={() => deleteRecurringSeries(session)}
                            className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive"
                          >
                            {lang === 'en' ? 'Delete series' : 'Удалить серию'}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="bg-card border border-border rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-muted-foreground" />
            <h3 className="font-semibold">{lang === 'en' ? 'Blocks' : 'Блоки'}</h3>
          </div>

          {dayBlocks.length === 0 ? (
            <p className="text-sm text-muted-foreground">{lang === 'en' ? 'No blocks for this day' : 'На этот день блоков нет'}</p>
          ) : (
            <div className="space-y-3">
              {dayBlocks.map((block) => (
                <div key={block.id} className="rounded-2xl border border-border bg-secondary/30 p-3 space-y-3">
                  <div>
                    <p className="font-semibold">{blockTypeLabel(block)}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Clock3 className="w-3 h-3" />
                        {block.block_time.slice(0, 5)} · {block.duration_minutes} {lang === 'en' ? 'min' : 'мин'}
                      </span>
                      {block.is_recurring && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-primary">
                          <RotateCw className="w-3 h-3" />
                          {lang === 'en' ? `Every ${dayNames[block.recurrence_day || 0]}` : `Каждый ${dayNames[block.recurrence_day || 0]}`}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {!block.is_recurring ? (
                      <button
                        onClick={() => deleteBlockSeries(block)}
                        className="rounded-xl border border-border px-3 py-2 text-xs font-medium inline-flex items-center gap-1.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        {lang === 'en' ? 'Delete' : 'Удалить'}
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => deleteBlockForDay(block)}
                          className="rounded-xl border border-border px-3 py-2 text-xs font-medium"
                        >
                          {lang === 'en' ? 'Delete this day' : 'Удалить этот день'}
                        </button>
                        <button
                          onClick={() => deleteBlockSeries(block)}
                          className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive"
                        >
                          {lang === 'en' ? 'Delete series' : 'Удалить серию'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {showBlockModal !== null && (
        <TrainerBlockModal
          lang={lang}
          hour={showBlockModal}
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
