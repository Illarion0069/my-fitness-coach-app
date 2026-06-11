import React, { useEffect, useMemo, useState } from 'react';
import { addDays, format, isSameDay, startOfWeek } from 'date-fns';
import { enUS, ru } from 'date-fns/locale';
import { CalendarDays, ChevronLeft, ChevronRight, Ban } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import TrainerBlockModal from './TrainerBlockModal';
import DayTimeline, { type TimelineEntry } from './trainer-calendar/DayTimeline';
import { sessionAdded, sessionCancelled, sessionMoved, type BiText } from '@/lib/scheduleNotifications';

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

interface GuestBooking {
  id: string;
  guest_name: string;
  guest_phone: string;
  session_date: string;
  session_time: string | null;
  status: string;
  notes: string | null;
}

interface Props {
  lang: string;
  clients: Profile[];
  onSessionChange?: () => void;
}

const WORK_START = 7;
const WORK_END = 19;
const WEEKEND_DAYS = [0, 6]; // Sun, Sat — always off

const dayNamesRu = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const dayNamesEn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface NotifyPrompt {
  clientUserId: string;
  clientName: string;
  actionType: string;
  details: BiText;
}

const TrainerCalendar = ({ lang, clients, onSessionChange }: Props) => {
  const { toast } = useToast();
  const locale = lang === 'en' ? enUS : ru;

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [sessions, setSessions] = useState<ScheduledSession[]>([]);
  const [blocks, setBlocks] = useState<TrainerBlock[]>([]);
  const [guestBookings, setGuestBookings] = useState<GuestBooking[]>([]);
  const [clientRemaining, setClientRemaining] = useState<Record<string, { remaining: number; total: number }>>({});
  const [showBlockModal, setShowBlockModal] = useState<string | null>(null);
  const [blockedDates, setBlockedDates] = useState<string[]>([]);
  const [notifyPrompt, setNotifyPrompt] = useState<NotifyPrompt | null>(null);

  const showNotifyPrompt = (session: ScheduledSession, actionType: string, details: BiText) => {
    const manualMatch = session.notes?.match(/^👤 (.+?) \(manual\)$/);
    if (manualMatch) return; // manual entries have no real client
    const client = clients.find(c => c.user_id === session.user_id);
    if (!client) return;
    setNotifyPrompt({ clientUserId: session.user_id, clientName: client.full_name, actionType, details });
  };

  const confirmNotify = async () => {
    if (!notifyPrompt) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('pending_notifications').insert({
          client_user_id: notifyPrompt.clientUserId,
          trainer_user_id: user.id,
          action_type: notifyPrompt.actionType,
          details: notifyPrompt.details.ru, // legacy fallback (trainer UI)
          details_en: notifyPrompt.details.en,
          details_ru: notifyPrompt.details.ru,
        });
      }
    } catch (e) {
      console.error('Queue notification failed', e);
    }
    setNotifyPrompt(null);
  };

  const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
  const dayOfWeek = selectedDate.getDay();
  const dayNames = lang === 'en' ? dayNamesEn : dayNamesRu;
  const isDayOff = WEEKEND_DAYS.includes(dayOfWeek);
  const isBlockedDate = blockedDates.includes(selectedDateStr);

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

  const fetchBlockedDates = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('trainer_working_hours')
      .select('blocked_dates')
      .eq('trainer_user_id', user.id)
      .maybeSingle();

    if (data) {
      setBlockedDates(data.blocked_dates || []);
    }
  };

  const fetchGuestBookings = async () => {
    const { data } = await supabase
      .from('guest_bookings')
      .select('*')
      .order('session_date', { ascending: true });
    setGuestBookings((data as GuestBooking[]) || []);
  };

  useEffect(() => {
    Promise.all([fetchSessions(), fetchBlocks(), fetchClientPackages(), fetchBlockedDates(), fetchGuestBookings()]);
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

  const dayGuests = useMemo(() => {
    return guestBookings
      .filter((g) => g.session_date === selectedDateStr && g.status !== 'cancelled' && g.status !== 'rejected')
      .sort((a, b) => (a.session_time || '99:99').localeCompare(b.session_time || '99:99'));
  }, [guestBookings, selectedDateStr]);

  const deleteGuestBooking = async (id: string) => {
    const { error } = await supabase.from('guest_bookings').delete().eq('id', id);
    if (error) {
      toast({ title: lang === 'en' ? 'Error' : 'Ошибка', variant: 'destructive' });
      return;
    }
    await fetchGuestBookings();
    toast({ title: lang === 'en' ? 'Guest booking removed' : 'Гостевая запись удалена' });
  };

  const getClientName = (session: ScheduledSession) => {
    const manualMatch = session.notes?.match(/^👤 (.+?) \(manual\)$/);
    if (manualMatch?.[1]) return manualMatch[1];
    return clients.find((client) => client.user_id === session.user_id)?.full_name || '—';
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

    await Promise.all([fetchSessions(), fetchClientPackages()]);
    onSessionChange?.();
    toast({ title: lang === 'en' ? 'Session removed' : 'Тренировка удалена' });

    showNotifyPrompt(session, 'session_cancelled', sessionCancelled({ date: session.session_date, time: session.session_time }));
  };

  const deleteRecurringForDay = async (session: ScheduledSession) => {
    const exceptions = [...(session.recurring_exceptions || []), selectedDateStr];
    await supabase.from('scheduled_sessions').update({ recurring_exceptions: exceptions }).eq('id', session.id);

    // Auto-refund if this date was already deducted
    if (session.package_id) {
      try {
        await supabase.functions.invoke('refund-cancelled-session', {
          body: { session_id: session.id, cancelled_date: selectedDateStr },
        });
      } catch (e) {
        console.error('Refund check failed:', e);
      }
    }

    await Promise.all([fetchSessions(), fetchClientPackages()]);
    onSessionChange?.();
    toast({ title: lang === 'en' ? 'Occurrence removed' : 'Тренировка на этот день удалена' });

    showNotifyPrompt(session, 'session_cancelled', sessionCancelled({ date: selectedDateStr, time: session.recurrence_time }));
  };

  const deleteRecurringSeries = async (session: ScheduledSession) => {
    await supabase.from('scheduled_sessions').delete().eq('id', session.id);
    await Promise.all([fetchSessions(), fetchClientPackages()]);
    onSessionChange?.();
    toast({ title: lang === 'en' ? 'Series removed' : 'Серия удалена' });
    showNotifyPrompt(session, 'session_cancelled', sessionCancelled({ seriesEnded: true }));
  };

  const deleteBlockForDay = async (block: TrainerBlock) => {
    const exceptions = [...(block.recurring_exceptions || []), selectedDateStr];
    await supabase.from('trainer_blocks').update({ recurring_exceptions: exceptions }).eq('id', block.id);

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
        let errorMsg = res.data?.error || '';
        if (!errorMsg && res.error) {
          try {
            const ctx = (res.error as any).context;
            if (ctx && typeof ctx.json === 'function') {
              const body = await ctx.json();
              errorMsg = body?.error || '';
            }
          } catch {}
          if (!errorMsg) errorMsg = res.error.message;
        }
        toast({
          title: errorMsg || (lang === 'en' ? 'Failed to add session' : 'Не удалось добавить тренировку'),
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

    // Show notify prompt for real clients
    if (clientId) {
      const client = clients.find(c => c.user_id === clientId);
      if (client) {
        const recurDayEn = dayNamesEn[recurrenceDay];
        const recurDayRu = dayNamesRu[recurrenceDay];
        const details = sessionAdded(
          isRecurring
            ? { mode: 'recurring', time, recurDayEn, recurDayRu }
            : { mode: 'once', date: selectedDateStr, time }
        );
        setNotifyPrompt({
          clientUserId: clientId,
          clientName: client.full_name,
          actionType: 'session_added',
          details,
        });
      }
    }
  };

  const blockTypeLabel = (block: TrainerBlock) => {
    if (block.title) return block.title;
    if (block.block_type === 'travel') return lang === 'en' ? 'Travel' : 'В пути';
    if (block.block_type === 'reload') return 'Reload';
    if (block.block_type === 'personal') return lang === 'en' ? 'Personal' : 'Личное';
    return lang === 'en' ? 'Blocked' : 'Закрыто';
  };

  const toggleBlockedDate = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const newBlocked = isBlockedDate
      ? blockedDates.filter(d => d !== selectedDateStr)
      : [...blockedDates, selectedDateStr].sort();

    const { error } = await supabase
      .from('trainer_working_hours')
      .upsert({
        trainer_user_id: user.id,
        work_start_hour: WORK_START,
        work_end_hour: WORK_END,
        days_off: WEEKEND_DAYS,
        blocked_dates: newBlocked,
      }, { onConflict: 'trainer_user_id' });

    if (!error) {
      setBlockedDates(newBlocked);
      toast({
        title: isBlockedDate
          ? (lang === 'en' ? 'Day opened' : 'День открыт')
          : (lang === 'en' ? 'Day closed' : 'День закрыт'),
      });
    }
  };

  const slots = useMemo(() => {
    const endHour = Math.max(WORK_END, WORK_START + 1);
    const count = (endHour - WORK_START + 1) * 2;

    return Array.from({ length: count }, (_, index) => {
      const totalMinutes = WORK_START * 60 + index * 30;
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    });
  }, []);

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
          : block.block_type === 'reload'
            ? ('reload' as const)
            : block.block_type === 'personal'
              ? ('personal' as const)
              : block.block_type === 'block'
                ? ('blocked' as const)
                : ('neutral' as const),
    }));

    const guestEntries = dayGuests.map((g) => ({
      id: `guest:${g.id}`,
      kind: 'session' as const,
      title: `👤 ${g.guest_name}`,
      subtitle: `${lang === 'en' ? 'Guest' : 'Гость'} · ${g.guest_phone}`,
      time: (g.session_time || '09:00').slice(0, 5),
      durationMinutes: 60,
      isRecurring: false,
      tone: 'guest' as const,
    }));

    return [...sessionEntries, ...blockEntries, ...guestEntries].sort((a, b) => a.time.localeCompare(b.time));
  }, [clientRemaining, dayBlocks, daySessions, dayGuests, lang]);


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
            {!isSameDay(selectedDate, new Date()) && (
              <button
                type="button"
                onClick={() => setSelectedDate(new Date())}
                className="mt-1 text-[11px] font-medium text-primary hover:underline"
              >
                {lang === 'en' ? 'Today' : 'Сегодня'}
              </button>
            )}
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
            const isCurrentDay = isSameDay(date, new Date());
            const dateStr = format(date, 'yyyy-MM-dd');
            const isBlocked = blockedDates.includes(dateStr);
            const isWeeklyOff = WEEKEND_DAYS.includes(date.getDay());
            return (
              <button
                key={date.toISOString()}
                type="button"
                onClick={() => setSelectedDate(date)}
                className={`rounded-2xl border px-2 py-2 text-center transition-colors relative ${
                  active
                    ? 'border-primary bg-primary text-primary-foreground'
                    : isCurrentDay
                      ? 'border-primary/60 bg-primary/10 text-foreground'
                      : isBlocked
                        ? 'border-destructive/30 bg-destructive/10 text-destructive'
                        : isWeeklyOff
                          ? 'border-dashed border-border bg-secondary/20 text-muted-foreground'
                          : 'border-border bg-secondary/30 text-foreground hover:bg-secondary/50'
                }`}
              >
                <p className={`text-[10px] font-medium ${active ? 'text-primary-foreground/80' : isCurrentDay ? 'text-primary' : isBlocked ? 'text-destructive/70' : 'text-muted-foreground'}`}>
                  {dayNames[date.getDay()]}
                </p>
                <p className={`text-sm font-semibold ${isBlocked && !active ? 'line-through' : ''}`}>{format(date, 'd')}</p>
              </button>
            );
          })}
        </div>

      </div>

      {(isDayOff || isBlockedDate) && (
        <div className="rounded-2xl border border-border bg-secondary/30 px-4 py-3 flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {isBlockedDate
              ? (lang === 'en' ? 'This day is closed' : 'Этот день закрыт')
              : (lang === 'en' ? 'Weekend — closed for clients, open for you' : 'Выходной — клиенты не видят, но вы можете добавлять')
            }
          </span>
          {isBlockedDate && (
            <button
              onClick={toggleBlockedDate}
              className="text-xs font-semibold text-primary bg-primary/10 px-3 py-1.5 rounded-lg hover:bg-primary/20 transition-colors"
            >
              {lang === 'en' ? 'Open' : 'Открыть'}
            </button>
          )}
        </div>
      )}

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-semibold">{lang === 'en' ? 'Day calendar' : 'Календарь дня'}</h3>
          </div>
          {!isBlockedDate && (
            <button
              onClick={toggleBlockedDate}
              className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground hover:text-destructive bg-secondary/50 hover:bg-destructive/10 px-2.5 py-1.5 rounded-lg transition-colors"
            >
              <Ban className="w-3 h-3" />
              {lang === 'en' ? 'Close day' : 'Закрыть день'}
            </button>
          )}
        </div>

        <DayTimeline
          lang={lang}
          slots={slots}
          entries={timelineEntries}
          isToday={selectedDateStr === format(new Date(), 'yyyy-MM-dd')}
          onDeleteEntry={(entry) => {
            if (entry.id.startsWith('guest:')) {
              deleteGuestBooking(entry.id.slice(6));
              return;
            }
            const session = daySessions.find((s) => s.id === entry.id);
            const block = dayBlocks.find((b) => b.id === entry.id);
            if (session) deleteOneOffSession(session);
            if (block) deleteBlockSeries(block);
          }}
          onDeleteEntryDay={(entry) => {
            if (entry.id.startsWith('guest:')) {
              deleteGuestBooking(entry.id.slice(6));
              return;
            }
            const session = daySessions.find((s) => s.id === entry.id);
            const block = dayBlocks.find((b) => b.id === entry.id);
            if (session) deleteRecurringForDay(session);
            if (block) deleteBlockForDay(block);
          }}
          onDeleteEntrySeries={(entry) => {
            if (entry.id.startsWith('guest:')) {
              deleteGuestBooking(entry.id.slice(6));
              return;
            }
            const session = daySessions.find((s) => s.id === entry.id);
            const block = dayBlocks.find((b) => b.id === entry.id);
            if (session) deleteRecurringSeries(session);
            if (block) deleteBlockSeries(block);
          }}
          onSelectTime={(time) => {
            setShowBlockModal(time);
          }}
          onMoveEntryDay={async (entry, newTime) => {
            if (entry.id.startsWith('guest:')) {
              await supabase.from('guest_bookings').update({ session_time: newTime }).eq('id', entry.id.slice(6));
              await fetchGuestBookings();
              toast({ title: lang === 'en' ? 'Time updated' : 'Время обновлено' });
              return;
            }
            const session = daySessions.find((s) => s.id === entry.id);
            const block = dayBlocks.find((b) => b.id === entry.id);

            if (session && session.is_recurring) {
              // Add exception for this date
              const exceptions = [...(session.recurring_exceptions || []), selectedDateStr];
              await supabase.from('scheduled_sessions').update({ recurring_exceptions: exceptions }).eq('id', session.id);
              // Create one-off session for this date with new time
              await supabase.from('scheduled_sessions').insert({
                user_id: session.user_id,
                trainer_user_id: session.trainer_user_id,
                session_date: selectedDateStr,
                session_time: newTime,
                is_recurring: false,
                duration_minutes: session.duration_minutes,
                notes: session.notes,
                package_id: session.package_id,
              });
              await fetchSessions();
              onSessionChange?.();
            } else if (block && block.is_recurring) {
              const exceptions = [...(block.recurring_exceptions || []), selectedDateStr];
              await supabase.from('trainer_blocks').update({ recurring_exceptions: exceptions }).eq('id', block.id);
              await supabase.from('trainer_blocks').insert({
                trainer_user_id: block.trainer_user_id,
                block_type: block.block_type,
                title: block.title,
                block_date: selectedDateStr,
                block_time: newTime,
                duration_minutes: block.duration_minutes,
                is_recurring: false,
              });
              await fetchBlocks();
            }

            toast({ title: lang === 'en' ? 'Time updated for this day' : 'Время обновлено на этот день' });
            if (session) {
              showNotifyPrompt(session, 'session_moved', sessionMoved({ date: selectedDateStr, newTime, variant: 'rescheduled' }));
            }
          }}
          onMoveEntry={async (entry, newTime) => {
            if (entry.id.startsWith('guest:')) {
              await supabase.from('guest_bookings').update({ session_time: newTime }).eq('id', entry.id.slice(6));
              await fetchGuestBookings();
              toast({ title: lang === 'en' ? 'Time updated' : 'Время обновлено' });
              return;
            }
            const session = daySessions.find((s) => s.id === entry.id);
            const block = dayBlocks.find((b) => b.id === entry.id);

            if (session) {
              if (session.is_recurring) {
                await supabase.from('scheduled_sessions').update({ recurrence_time: newTime }).eq('id', session.id);
              } else {
                await supabase.from('scheduled_sessions').update({ session_time: newTime }).eq('id', session.id);
              }
              await fetchSessions();
              onSessionChange?.();
            } else if (block) {
              await supabase.from('trainer_blocks').update({ block_time: newTime }).eq('id', block.id);
              await fetchBlocks();
            }

            toast({ title: lang === 'en' ? 'Time updated' : 'Время обновлено' });
            if (session) {
              showNotifyPrompt(session, 'session_moved', sessionMoved({ date: selectedDateStr, newTime, wholeSeries: session.is_recurring, variant: 'time-changed' }));
            }
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

      {notifyPrompt && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setNotifyPrompt(null)}>
          <div
            className="bg-card border border-border/50 rounded-2xl w-full max-w-sm mx-4 shadow-xl animate-in zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-5 pt-5 space-y-3 pb-5">
              <p className="text-sm font-bold text-center">
                {lang === 'en' ? 'Send notification?' : 'Отправить уведомление?'}
              </p>
              <p className="text-xs text-muted-foreground text-center">
                {lang === 'en'
                  ? `Notify ${notifyPrompt.clientName} about this change?`
                  : `Уведомить ${notifyPrompt.clientName} об этом изменении?`}
              </p>
              <button
                onClick={confirmNotify}
                className="w-full gradient-primary text-primary-foreground text-sm font-bold py-3 rounded-xl active:scale-[0.98] transition-transform"
              >
                {lang === 'en' ? 'Send' : 'Отправить'}
              </button>
              <button
                onClick={() => setNotifyPrompt(null)}
                className="w-full bg-secondary/50 text-muted-foreground text-sm font-medium py-3 rounded-xl active:scale-[0.98] transition-transform"
              >
                {lang === 'en' ? 'Don\'t send' : 'Не отправлять'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TrainerCalendar;
