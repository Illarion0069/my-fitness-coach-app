import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Plus, X, Clock, Pencil, Trash2, Ban, Car, Calendar as CalIcon } from 'lucide-react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format, addDays, addMonths, startOfWeek, startOfMonth, endOfMonth, isSameDay, isToday, isSameMonth, eachDayOfInterval, getDay } from 'date-fns';
import { ru, enUS } from 'date-fns/locale';
import TrainerBlockModal from './TrainerBlockModal';

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
}

interface ScheduledSession {
  id: string;
  user_id: string;
  session_date: string;
  session_time: string | null;
  is_recurring: boolean;
  recurrence_day: number | null;
  recurrence_time: string | null;
  is_deducted: boolean;
  duration_minutes: number;
  recurring_exceptions: string[];
  notes: string | null;
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
}

interface Props {
  lang: string;
  clients: Profile[];
  onSessionChange?: () => void;
}

const HOURS = Array.from({ length: 17 }, (_, i) => i + 6); // 6:00 — 22:00
const ROW_HEIGHT = 52; // px per hour slot

const minutesToTimeStr = (totalMinutes: number) => {
  const h = Math.max(6, Math.min(22, Math.floor(totalMinutes / 60)));
  const m = Math.round(totalMinutes % 60 / 5) * 5;
  return `${String(h).padStart(2, '0')}:${String(m >= 60 ? 0 : m).padStart(2, '0')}`;
};

const TrainerCalendar = ({ lang, clients, onSessionChange }: Props) => {
  const { toast } = useToast();
  const locale = lang === 'en' ? enUS : ru;
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [sessions, setSessions] = useState<ScheduledSession[]>([]);
  const [blocks, setBlocks] = useState<TrainerBlock[]>([]);
  const [clientRemaining, setClientRemaining] = useState<Record<string, { remaining: number; total: number }>>({});
  const [showAddForm, setShowAddForm] = useState<number | null>(null);
  const [showBlockModal, setShowBlockModal] = useState<number | null>(null); // hour for block modal
  const [selectedClientId, setSelectedClientId] = useState('');
  const [addTime, setAddTime] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Long-press context menu state
  const [contextMenuSessionId, setContextMenuSessionId] = useState<string | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Delete recurring choice dialog
  const [deleteChoiceSession, setDeleteChoiceSession] = useState<(ScheduledSession & { clientName: string }) | null>(null);

  // Edit state
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editTime, setEditTime] = useState('');
  const [editDuration, setEditDuration] = useState(60);

  // Drag state
  const [draggingSessionId, setDraggingSessionId] = useState<string | null>(null);
  const [dragPreviewTime, setDragPreviewTime] = useState<string | null>(null);
  const dragRawMinutes = useRef<number>(0); // unsnapped minutes for smooth visual
  const timelineRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef<number>(0);
  const dragStartMinutes = useRef<number>(0);
  const [swipeDir, setSwipeDir] = useState(0);

  // Generate all days for the month for smooth scrolling
  const monthDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const start = startOfWeek(monthStart, { weekStartsOn: 1 });
    // Extend to fill complete weeks
    const endDay = addDays(monthEnd, (7 - getDay(monthEnd) + 1) % 7 || 0);
    return eachDayOfInterval({ start, end: endDay > monthEnd ? endDay : monthEnd });
  }, [currentMonth]);

  const fetchSessions = async () => {
    const { data } = await supabase
      .from('scheduled_sessions')
      .select('*')
      .order('session_time', { ascending: true });
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
      .select('user_id, total_sessions, used_sessions, is_active')
      .eq('is_active', true);
    if (data) {
      const map: Record<string, { remaining: number; total: number }> = {};
      data.forEach(p => {
        const remaining = p.total_sessions - p.used_sessions;
        // Keep the one with fewer remaining (most urgent)
        if (!map[p.user_id] || remaining < map[p.user_id].remaining) {
          map[p.user_id] = { remaining, total: p.total_sessions };
        }
      });
      setClientRemaining(map);
    }
  };

  useEffect(() => { fetchSessions(); fetchBlocks(); fetchClientPackages(); }, []);

  const navigateMonth = (dir: number) => {
    const newDate = addMonths(currentMonth, dir);
    setCurrentMonth(newDate);
    setSelectedDate(startOfMonth(newDate));
  };

  // Scroll selected date into view
  useEffect(() => {
    if (scrollRef.current) {
      const el = scrollRef.current.querySelector('[data-selected="true"]');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    }
  }, [selectedDate]);

  const dayOfWeek = selectedDate.getDay();
  const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');

  const daySessions = useMemo(() => {
    return sessions.filter(s => {
      if (s.is_recurring && s.recurrence_day === dayOfWeek) {
        // Check if this date is in exceptions
        if (s.recurring_exceptions?.includes(selectedDateStr)) return false;
        return true;
      }
      if (!s.is_recurring && s.session_date === selectedDateStr) return true;
      return false;
    });
  }, [sessions, selectedDateStr, dayOfWeek]);

  // Compute which session occurrences are the "last" for each client
  const lastSessionKeys = useMemo(() => {
    const keys = new Set<string>(); // "sessionId_yyyy-MM-dd"
    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');

    // For each client with remaining sessions, find their Nth future session (N = remaining)
    const clientUserIds = new Set(sessions.map(s => s.user_id));
    clientUserIds.forEach(userId => {
      const pkg = clientRemaining[userId];
      if (!pkg || pkg.remaining <= 0) return;

      // Collect all future session occurrences for this client (next 8 weeks)
      const occurrences: { sessionId: string; date: string }[] = [];
      const clientSessions = sessions.filter(s => s.user_id === userId && !s.is_deducted);

      clientSessions.forEach(s => {
        if (s.is_recurring && s.recurrence_day != null) {
          // Expand recurring into next 8 weeks
          for (let w = 0; w < 8; w++) {
            const weekStart = addDays(today, w * 7);
            for (let d = 0; d < 7; d++) {
              const day = addDays(weekStart, d);
              const dayStr = format(day, 'yyyy-MM-dd');
              if (dayStr < todayStr) continue;
              if (day.getDay() === s.recurrence_day && !s.recurring_exceptions?.includes(dayStr)) {
                occurrences.push({ sessionId: s.id, date: dayStr });
              }
            }
          }
        } else if (!s.is_recurring && s.session_date >= todayStr) {
          occurrences.push({ sessionId: s.id, date: s.session_date });
        }
      });

      // Sort by date
      occurrences.sort((a, b) => a.date.localeCompare(b.date));

      // The "last" session is at index (remaining - 1)
      if (occurrences.length >= pkg.remaining && pkg.remaining > 0) {
        const lastOcc = occurrences[pkg.remaining - 1];
        keys.add(`${lastOcc.sessionId}_${lastOcc.date}`);
      }
    });

    return keys;
  }, [sessions, clientRemaining]);

  const enrichedSessions = useMemo(() => {
    return daySessions.map(s => {
      const manualMatch = s.notes?.match(/^👤 (.+?) \(manual\)$/);
      const client = manualMatch ? null : clients.find(c => c.user_id === s.user_id);
      const clientName = manualMatch?.[1] || client?.full_name || '?';
      const isLastSession = lastSessionKeys.has(`${s.id}_${selectedDateStr}`);
      return { ...s, clientName, isLastSession };
    });
  }, [daySessions, clients, lastSessionKeys, selectedDateStr]);

  const sessionsByHour = useMemo(() => {
    const map: Record<number, (ScheduledSession & { clientName: string; isLastSession: boolean })[]> = {};
    enrichedSessions.forEach(s => {
      const timeStr = s.is_recurring ? s.recurrence_time : s.session_time;
      const hour = timeStr ? parseInt(timeStr.split(':')[0], 10) : -1;
      if (!map[hour]) map[hour] = [];
      map[hour].push(s);
    });
    return map;
  }, [enrichedSessions]);

  // Filter blocks for the selected date
  const dayBlocks = useMemo(() => {
    return blocks.filter(b => {
      if (b.is_recurring && b.recurrence_day === dayOfWeek) return true;
      if (!b.is_recurring && b.block_date === selectedDateStr) return true;
      return false;
    });
  }, [blocks, selectedDateStr, dayOfWeek]);

  const blocksByHour = useMemo(() => {
    const map: Record<number, TrainerBlock[]> = {};
    dayBlocks.forEach(b => {
      const hour = parseInt(b.block_time.split(':')[0], 10);
      const durationHours = Math.ceil(b.duration_minutes / 60);
      for (let h = hour; h < hour + durationHours && h <= 22; h++) {
        if (!map[h]) map[h] = [];
        if (h === hour) map[h].push(b); // Only show card on start hour
      }
    });
    return map;
  }, [dayBlocks]);

  const noTimeSessions = sessionsByHour[-1] || [];

  const queueNotification = async (clientUserId: string, actionType: string, details: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from('pending_notifications').insert({
        client_user_id: clientUserId,
        trainer_user_id: user.id,
        action_type: actionType,
        details,
      });
    } catch (e) {
      console.error('Queue notification failed', e);
    }
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
      const message = res.error?.message || res.data?.error || (lang === 'en' ? 'Failed to add session' : 'Не удалось добавить тренировку');
      toast({ title: message, variant: 'destructive' });
      return;
    }

    setShowAddForm(null);
    setSelectedClientId('');
    setAddTime('');
    fetchSessions(); fetchClientPackages();
    if (onSessionChange) onSessionChange();
    toast({ title: lang === 'en' ? 'Session added' : 'Тренировка добавлена' });
  };

  const sendCancelNotification = async (session: ScheduledSession, dateStr: string) => {
    const displayDate = new Date(dateStr + 'T00:00:00').toLocaleDateString(lang === 'en' ? 'en-US' : 'ru-RU', { day: 'numeric', month: 'long', weekday: 'short' });
    const timeStr = session.is_recurring ? session.recurrence_time : session.session_time;
    const timeDisplay = timeStr ? ` в ${timeStr.slice(0, 5)}` : '';

    queueNotification(
      session.user_id,
      'session_deleted',
      `❌ <b>Тренировка отменена</b>\n📅 ${displayDate}${timeDisplay}`
    );
  };

  const deleteSession = async (id: string) => {
    const session = sessions.find(s => s.id === id);
    if (!session) return;

    const { data: { session: authSession } } = await supabase.auth.getSession();
    const token = authSession?.access_token;

    const res = await supabase.functions.invoke('restore-session', {
      body: { sessionId: id, userId: session.user_id },
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    if (res.error) {
      console.error('[TrainerCalendar.deleteSession] restore-session error:', res.error);
      toast({ title: lang === 'en' ? 'Error removing session' : 'Ошибка при удалении', variant: 'destructive' });
      return;
    }

    fetchSessions(); fetchClientPackages();
    if (onSessionChange) onSessionChange();
    toast({ title: lang === 'en' ? 'Session removed' : 'Тренировка удалена' });
  };

  const handleDeleteRecurringThis = async (session: ScheduledSession & { clientName: string }) => {
    // Add current date to exceptions
    const exceptions = [...(session.recurring_exceptions || []), selectedDateStr];
    await supabase
      .from('scheduled_sessions')
      .update({ recurring_exceptions: exceptions })
      .eq('id', session.id);
    
    await sendCancelNotification(session, selectedDateStr);
    setDeleteChoiceSession(null);
    fetchSessions();
    if (onSessionChange) onSessionChange();
    toast({ title: lang === 'en' ? 'This session cancelled' : 'Эта тренировка отменена' });
  };

  const handleDeleteRecurringAll = async (session: ScheduledSession & { clientName: string }) => {
    await sendCancelNotification(session, selectedDateStr);
    await supabase.from('scheduled_sessions').delete().eq('id', session.id);
    setDeleteChoiceSession(null);
    fetchSessions();
    if (onSessionChange) onSessionChange();
    toast({ title: lang === 'en' ? 'Recurring session deleted' : 'Повторяющаяся тренировка удалена' });
  };

  const handleDeleteClick = (session: ScheduledSession & { clientName: string }) => {
    if (session.is_recurring) {
      setDeleteChoiceSession(session);
    } else {
      sendCancelNotification(session, session.session_date);
      deleteSession(session.id);
    }
  };

  // --- Edit time & duration ---
  const startEditing = (session: ScheduledSession) => {
    const time = session.is_recurring ? session.recurrence_time : session.session_time;
    setEditingSessionId(session.id);
    setEditTime(time?.slice(0, 5) || '');
    setEditDuration(session.duration_minutes || 60);
  };

  const saveEditTime = async () => {
    if (!editingSessionId || !editTime) return;
    const session = sessions.find(s => s.id === editingSessionId);
    if (!session) return;

    const updateField = session.is_recurring
      ? { recurrence_time: editTime, duration_minutes: editDuration }
      : { session_time: editTime, duration_minutes: editDuration };

    await supabase.from('scheduled_sessions').update(updateField).eq('id', editingSessionId);

    setEditingSessionId(null);
    setEditTime('');
    setEditDuration(60);
    fetchSessions();
    toast({ title: lang === 'en' ? 'Session updated' : 'Тренировка обновлена' });
  };

  // --- Drag to reposition ---
  const getMinutesFromTime = (timeStr: string | null): number => {
    if (!timeStr) return 6 * 60;
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + (m || 0);
  };

  const handleDragStart = useCallback((sessionId: string, timeStr: string | null, clientY: number) => {
    const minutes = getMinutesFromTime(timeStr);
    setDraggingSessionId(sessionId);
    dragStartY.current = clientY;
    dragStartMinutes.current = minutes;
    dragRawMinutes.current = minutes;
    setDragPreviewTime(timeStr?.slice(0, 5) || null);
  }, []);

  const dragRAF = useRef<number>(0);
  const lastSnapped = useRef<string>('');

  const handleDragMove = useCallback((clientY: number) => {
    if (!draggingSessionId) return;
    const deltaY = clientY - dragStartY.current;
    const deltaMinutes = (deltaY / ROW_HEIGHT) * 60;
    const newMinutes = Math.max(6 * 60, Math.min(22 * 60, dragStartMinutes.current + deltaMinutes));
    dragRawMinutes.current = newMinutes;

    // Use RAF for smooth ~60fps updates
    cancelAnimationFrame(dragRAF.current);
    dragRAF.current = requestAnimationFrame(() => {
      const snapped = Math.round(newMinutes / 30) * 30;
      const snappedStr = minutesToTimeStr(snapped);
      // Only trigger re-render when snapped time actually changes or for position update
      if (snappedStr !== lastSnapped.current) {
        lastSnapped.current = snappedStr;
      }
      setDragPreviewTime(snappedStr);
    });
  }, [draggingSessionId]);

  const dragEndInProgress = useRef(false);

  const handleDragEnd = useCallback(async () => {
    if (dragEndInProgress.current) return; // prevent double-fire
    if (!draggingSessionId || !dragPreviewTime) {
      setDraggingSessionId(null);
      setDragPreviewTime(null);
      return;
    }

    dragEndInProgress.current = true;
    const sessionId = draggingSessionId;
    const newTime = dragPreviewTime;

    const session = sessions.find(s => s.id === sessionId);
    setDraggingSessionId(null);
    setDragPreviewTime(null);

    if (!session) { dragEndInProgress.current = false; return; }

    const updateField = session.is_recurring
      ? { recurrence_time: newTime }
      : { session_time: newTime };

    await supabase.from('scheduled_sessions').update(updateField).eq('id', sessionId);

    // Queue notification about time change
    const oldTime = session.is_recurring ? session.recurrence_time : session.session_time;
    const oldTimeDisplay = oldTime ? oldTime.slice(0, 5) : '—';
    const dateDisplay = session.is_recurring
      ? `каждый ${['Вс','Пн','Вт','Ср','Чт','Пт','Сб'][session.recurrence_day || 0]}`
      : new Date(session.session_date + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', weekday: 'short' });

    queueNotification(
      session.user_id,
      'session_moved',
      `🔄 <b>Тренировка перенесена</b>\n📅 ${dateDisplay}\n⏰ ${oldTimeDisplay} → ${newTime}`
    );

    fetchSessions();
    toast({ title: lang === 'en' ? `Moved to ${newTime}` : `Перенесено на ${newTime}` });
    dragEndInProgress.current = false;
  }, [draggingSessionId, dragPreviewTime, sessions, lang, toast]);

  // Touch handlers for drag
  const onSessionTouchStart = (sessionId: string, timeStr: string | null, e: React.TouchEvent) => {
    e.stopPropagation();
    handleDragStart(sessionId, timeStr, e.touches[0].clientY);
  };

  const onSessionTouchMove = useCallback((e: React.TouchEvent) => {
    if (draggingSessionId) {
      e.preventDefault();
      handleDragMove(e.touches[0].clientY);
    }
  }, [draggingSessionId, handleDragMove]);

  const onSessionTouchEnd = useCallback(() => {
    if (draggingSessionId) handleDragEnd();
  }, [draggingSessionId, handleDragEnd]);

  // Mouse handlers for drag
  useEffect(() => {
    if (!draggingSessionId) return;
    const onMouseMove = (e: MouseEvent) => handleDragMove(e.clientY);
    const onMouseUp = () => handleDragEnd();
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [draggingSessionId, handleDragMove, handleDragEnd]);

  // --- Block handlers ---
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
    fetchBlocks();
    toast({ title: lang === 'en' ? 'Block added' : 'Блок добавлен' });
  };

  const deleteBlock = async (blockId: string) => {
    await supabase.from('trainer_blocks').delete().eq('id', blockId);
    fetchBlocks();
    toast({ title: lang === 'en' ? 'Block removed' : 'Блок удалён' });
  };

  const renderBlockCard = (b: TrainerBlock) => {
    const blockColors: Record<string, string> = {
      block: 'bg-destructive/10 border-destructive/30 text-destructive',
      travel: 'bg-amber-500/10 border-amber-500/30 text-amber-600',
      personal: 'bg-blue-500/10 border-blue-500/30 text-blue-600',
    };
    const blockIcons: Record<string, typeof Ban> = {
      block: Ban,
      travel: Car,
      personal: CalIcon,
    };
    const Icon = blockIcons[b.block_type] || Ban;
    const colorClass = blockColors[b.block_type] || blockColors.block;
    const label = b.title || (b.block_type === 'block' ? (lang === 'en' ? 'Blocked' : 'Закрыто') : b.block_type === 'travel' ? (lang === 'en' ? 'Travel' : 'В пути') : '');

    return (
      <div key={b.id} className={`flex items-center gap-2 ${colorClass} border rounded-lg px-3 py-1.5 h-full`}>
        <Icon className="w-3.5 h-3.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold truncate">{label}</p>
          <p className="text-[10px] opacity-70">
            {b.block_time.slice(0, 5)} · {b.duration_minutes}{lang === 'en' ? 'min' : 'мин'}
            {b.is_recurring && ` · ${lang === 'en' ? 'weekly' : 'еженед.'}`}
          </p>
        </div>
        <button onClick={() => deleteBlock(b.id)} className="opacity-50 hover:opacity-100 transition-opacity">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  };

  const renderSessionCard = (s: ScheduledSession & { clientName: string; isLastSession?: boolean }) => {
    const timeStr = s.is_recurring ? s.recurrence_time : s.session_time;
    const isDragging = draggingSessionId === s.id;
    const isEditing = editingSessionId === s.id;

    if (isEditing) {
      return (
        <div
          key={s.id}
          className="flex items-center gap-2 bg-primary/20 border-2 border-primary rounded-lg px-3 py-2 mb-1 mt-1"
        >
          <div className="w-1 h-10 rounded-full bg-primary shrink-0" />
          <div className="flex-1 min-w-0 space-y-1.5">
            <p className="text-xs font-semibold truncate">{s.clientName}</p>
            <div className="flex gap-1.5">
              <input
                type="time"
                value={editTime}
                onChange={e => setEditTime(e.target.value)}
                autoFocus
                className="flex-1 bg-background border border-border rounded-md px-2 py-1 text-xs focus:outline-none focus:border-primary"
              />
              <select
                value={editDuration}
                onChange={e => setEditDuration(Number(e.target.value))}
                className="bg-background border border-border rounded-md px-1.5 py-1 text-xs focus:outline-none focus:border-primary"
              >
                <option value={30}>30m</option>
                <option value={45}>45m</option>
                <option value={60}>1h</option>
                <option value={90}>1.5h</option>
                <option value={120}>2h</option>
              </select>
            </div>
          </div>
          <button
            onClick={saveEditTime}
            className="bg-primary text-primary-foreground text-[10px] font-bold px-2 py-1 rounded-lg"
          >
            ✓
          </button>
          <button
            onClick={() => setEditingSessionId(null)}
            className="text-muted-foreground"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      );
    }

    // Tap vs long-press differentiation
    let touchTimer: ReturnType<typeof setTimeout> | null = null;
    let touchOrigin: { x: number; y: number } | null = null;
    let didActivateDrag = false;

    const handleCardTouchStart = (e: React.TouchEvent) => {
      e.stopPropagation();
      const touch = e.touches[0];
      touchOrigin = { x: touch.clientX, y: touch.clientY };
      didActivateDrag = false;

      touchTimer = setTimeout(() => {
        didActivateDrag = true;
        if (navigator.vibrate) navigator.vibrate(10);
        handleDragStart(s.id, timeStr, touch.clientY);
      }, 500);
    };

    const handleCardTouchMove = (e: React.TouchEvent) => {
      if (draggingSessionId === s.id) {
        e.preventDefault();
        handleDragMove(e.touches[0].clientY);
        return;
      }
      // Cancel long-press if finger moved
      if (touchOrigin) {
        const dx = e.touches[0].clientX - touchOrigin.x;
        const dy = e.touches[0].clientY - touchOrigin.y;
        if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
          if (touchTimer) { clearTimeout(touchTimer); touchTimer = null; }
        }
      }
    };

    const handleCardTouchEnd = (e: React.TouchEvent) => {
      if (touchTimer) { clearTimeout(touchTimer); touchTimer = null; }
      if (draggingSessionId === s.id) {
        handleDragEnd();
        return;
      }
      // If context menu is already showing, don't toggle it off —
      // let the button onClick handlers work naturally
      if (contextMenuSessionId === s.id) return;
      // If it was a short tap (not a drag), toggle context menu
      if (!didActivateDrag) {
        e.preventDefault();
        setContextMenuSessionId(s.id);
      }
    };

    // Mouse: click = context menu, no immediate drag on mousedown
    const handleMouseDown = (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
    };

    const handleClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      setContextMenuSessionId(prev => prev === s.id ? null : s.id);
    };

    return (
      <div
        key={s.id}
        className={`relative flex items-center gap-2 rounded-lg px-3 py-1.5 h-full select-none ${
          isDragging
            ? 'bg-primary/20 border-2 border-primary shadow-2xl scale-[1.03] z-50'
            : 'bg-primary/10 border border-primary/20 transition-colors'
        } ${contextMenuSessionId === s.id ? 'ring-2 ring-primary/60' : ''}`}
        onTouchStart={handleCardTouchStart}
        onTouchMove={handleCardTouchMove}
        onTouchEnd={handleCardTouchEnd}
        onMouseDown={handleMouseDown}
        onClick={handleClick}
        style={{ touchAction: isDragging ? 'none' : 'auto', cursor: 'pointer' }}
      >
        <div className="w-1 h-5 rounded-full bg-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-xs font-semibold truncate">{s.clientName}</p>
            {s.isLastSession && (
              <span className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-destructive/20 text-destructive">
                {lang === 'en' ? 'LAST' : 'ПОСЛ.'}
              </span>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground">
            {isDragging && dragPreviewTime
              ? <span className="text-primary font-bold">{dragPreviewTime}</span>
              : timeStr?.slice(0, 5)}
            {s.duration_minutes && s.duration_minutes !== 60 && (
              <span className="text-primary/70 ml-1">{s.duration_minutes}m</span>
            )}
            {s.is_recurring && ` · ${lang === 'en' ? 'recurring' : 'повтор'}`}
          </p>
        </div>
        {s.is_deducted && <span className="text-[10px] text-primary">✓</span>}

        {/* Context menu overlay */}
        {contextMenuSessionId === s.id && (() => {
          const timeVal = s.is_recurring ? s.recurrence_time : s.session_time;
          const hourVal = timeVal ? parseInt(timeVal.split(':')[0], 10) : -1;
          const sameSlotCount = hourVal >= 0 ? (sessionsByHour[hourVal]?.length || 0) : 0;
          const canSplit = sameSlotCount < 2;
          return (
          <div className="absolute inset-0 z-20 flex items-center justify-end gap-1.5 bg-card/95 backdrop-blur-sm rounded-lg px-2 animate-scale-in">
            <p className="flex-1 text-xs font-semibold truncate">{s.clientName}</p>
            {canSplit && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setContextMenuSessionId(null);
                  setShowAddForm(-1);
                  setAddTime(timeVal?.slice(0, 5) || '');
                }}
                className="flex items-center gap-1 bg-accent/20 text-accent-foreground text-[11px] font-semibold px-2.5 py-1.5 rounded-lg"
              >
                <Plus className="w-3 h-3" />
                {lang === 'en' ? 'Split' : 'Сплит'}
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); setContextMenuSessionId(null); startEditing(s); }}
              className="flex items-center gap-1 bg-primary/15 text-primary text-[11px] font-semibold px-2.5 py-1.5 rounded-lg"
            >
              <Pencil className="w-3 h-3" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setContextMenuSessionId(null); handleDeleteClick(s); }}
              className="flex items-center gap-1 bg-destructive/15 text-destructive text-[11px] font-semibold px-2.5 py-1.5 rounded-lg"
            >
              <Trash2 className="w-3 h-3" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setContextMenuSessionId(null); }}
              className="text-muted-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          );
        })()}
      </div>
    );
  };

  return (
    <div className="space-y-0">
      {/* Month header */}
      <div className="flex items-center justify-between px-1 mb-3">
        <button onClick={() => navigateMonth(-1)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-secondary transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h2 className="text-base font-bold capitalize">
          {format(currentMonth, 'LLLL yyyy', { locale })}
        </h2>
        <button onClick={() => navigateMonth(1)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-secondary transition-colors">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Scrollable day strip */}
      <div
        ref={scrollRef}
        className="flex gap-1 mb-4 overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-1 -mx-1 px-1"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {monthDays.map(day => {
          const active = isSameDay(day, selectedDate);
          const today = isToday(day);
          const inMonth = isSameMonth(day, currentMonth);
          return (
            <button
              key={day.toISOString()}
              data-selected={active ? 'true' : undefined}
              onClick={() => setSelectedDate(day)}
              className={`flex flex-col items-center py-2 px-2.5 rounded-xl transition-all snap-center shrink-0 min-w-[44px] ${
                active
                  ? 'bg-primary text-primary-foreground shadow-md'
                  : today
                    ? 'bg-primary/10 text-primary'
                    : inMonth
                      ? 'hover:bg-secondary text-foreground'
                      : 'hover:bg-secondary text-muted-foreground/40'
              }`}
            >
              <span className="text-[10px] font-medium uppercase opacity-70">
                {format(day, 'EEE', { locale })}
              </span>
              <span className="text-lg font-bold leading-tight">
                {format(day, 'd')}
              </span>
              {sessions.some(s =>
                (s.is_recurring && s.recurrence_day === day.getDay()) ||
                (!s.is_recurring && s.session_date === format(day, 'yyyy-MM-dd'))
              ) && (
                <div className={`w-1 h-1 rounded-full mt-0.5 ${active ? 'bg-primary-foreground' : 'bg-primary'}`} />
              )}
            </button>
          );
        })}
      </div>

      {/* Swipeable day content - stop propagation to prevent global tab swipe */}
      <div onTouchStart={e => e.stopPropagation()} onTouchEnd={e => e.stopPropagation()}>
      <AnimatePresence mode="wait" custom={swipeDir}>
        <motion.div
          key={selectedDateStr}
          custom={swipeDir}
          initial={{ x: swipeDir > 0 ? '40%' : '-40%', opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: swipeDir > 0 ? '-40%' : '40%', opacity: 0 }}
          transition={{ type: 'tween', duration: 0.2, ease: 'easeOut' }}
          drag={draggingSessionId ? false : "x"}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.15}
          onDragEnd={(_e: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
            if (draggingSessionId) return; // Don't navigate while dragging a session
            const threshold = 60;
            if (info.offset.x < -threshold) {
              setSwipeDir(1);
              setSelectedDate(prev => addDays(prev, 1));
            } else if (info.offset.x > threshold) {
              setSwipeDir(-1);
              setSelectedDate(prev => addDays(prev, -1));
            }
          }}
        >
          {/* Selected day label */}
          <div className="flex items-center justify-between mb-3 px-1">
            <p className="text-sm font-semibold capitalize">
              {format(selectedDate, 'EEEE, d MMMM', { locale })}
            </p>
            <button
              onClick={() => {
                setShowAddForm(-1);
                setAddTime('');
              }}
              className="w-7 h-7 rounded-lg gradient-primary flex items-center justify-center text-primary-foreground"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Add form */}
          {showAddForm === -1 && (
            <div className="bg-card border border-border/50 rounded-xl p-3 mb-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold">{lang === 'en' ? 'New session' : 'Новая тренировка'}</p>
                <button onClick={() => setShowAddForm(null)} className="text-muted-foreground"><X className="w-4 h-4" /></button>
              </div>
              <select
                value={selectedClientId}
                onChange={e => setSelectedClientId(e.target.value)}
                className="w-full bg-secondary/50 border border-border/50 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary/50"
              >
                <option value="">{lang === 'en' ? 'Select client' : 'Выберите клиента'}</option>
                {clients.map(c => (
                  <option key={c.user_id} value={c.user_id}>{c.full_name}</option>
                ))}
              </select>
              <input
                type="time"
                value={addTime}
                onChange={e => setAddTime(e.target.value)}
                className="w-full bg-secondary/50 border border-border/50 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary/50"
              />
              <button
                onClick={addSession}
                disabled={!selectedClientId}
                className="w-full gradient-primary text-primary-foreground text-xs font-bold py-2 rounded-lg disabled:opacity-50"
              >
                {lang === 'en' ? 'Add' : 'Добавить'}
              </button>
            </div>
          )}

          {/* No-time sessions */}
          {noTimeSessions.length > 0 && (
            <div className="mb-2 space-y-1">
              <p className="text-[10px] text-muted-foreground font-medium px-1">
                {lang === 'en' ? 'All day' : 'Весь день'}
              </p>
              {noTimeSessions.map(s => renderSessionCard(s))}
            </div>
          )}


          {/* Timeline */}
          <div
            ref={timelineRef}
            className="relative"
            style={{ touchAction: draggingSessionId ? 'none' : 'auto' }}
            onTouchMove={onSessionTouchMove}
            onTouchEnd={onSessionTouchEnd}
          >
            {/* Hour grid lines */}
            {HOURS.map(hour => (
              <div key={hour} className="flex group" style={{ height: ROW_HEIGHT }}>
                <div className="w-12 shrink-0 text-right pr-3 pt-0">
                  <span className="text-[10px] text-muted-foreground font-medium">
                    {String(hour).padStart(2, '0')}:00
                  </span>
                </div>
                <div className="flex-1 border-t border-border/30 relative">
                  {/* Half-hour line */}
                  <div className="absolute left-0 right-0 border-t border-border/15" style={{ top: ROW_HEIGHT / 2 }} />
                  {/* Clickable area for adding blocks */}
                  {!(sessionsByHour[hour]?.length) && !(blocksByHour[hour]?.length) && (
                    <button
                      onClick={() => setShowBlockModal(hour)}
                      className="absolute inset-0 w-full h-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                    >
                      <span className="text-[10px] text-primary/50 flex items-center gap-1">
                        <Plus className="w-3 h-3" /> {lang === 'en' ? 'Add' : 'Добавить'}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            ))}

            {/* Absolutely positioned sessions */}
            {enrichedSessions.filter(s => {
              const timeStr = s.is_recurring ? s.recurrence_time : s.session_time;
              return !!timeStr;
            }).map(s => {
              const timeStr = (s.is_recurring ? s.recurrence_time : s.session_time)!;
              const [h, m] = timeStr.split(':').map(Number);
              const totalMinutes = h * 60 + (m || 0);
              const startHour = HOURS[0]; // 6
              const topPx = ((totalMinutes - startHour * 60) / 60) * ROW_HEIGHT;
              const heightPx = ((s.duration_minutes || 60) / 60) * ROW_HEIGHT;

              // Check for overlapping sessions at same time for side-by-side layout
              const sameTimeSlot = enrichedSessions.filter(other => {
                const otherTime = other.is_recurring ? other.recurrence_time : other.session_time;
                if (!otherTime) return false;
                const [oh, om] = otherTime.split(':').map(Number);
                const otherStart = oh * 60 + (om || 0);
                const otherEnd = otherStart + (other.duration_minutes || 60);
                const thisEnd = totalMinutes + (s.duration_minutes || 60);
                return otherStart < thisEnd && otherEnd > totalMinutes;
              });
              const slotIndex = sameTimeSlot.findIndex(x => x.id === s.id);
              const slotCount = sameTimeSlot.length;

              const isDragging = draggingSessionId === s.id;

              // If dragging, use raw (unsnapped) minutes for smooth visual tracking
              const dragOffsetPx = isDragging
                ? ((dragRawMinutes.current - startHour * 60) / 60) * ROW_HEIGHT - topPx
                : 0;

              // Snapped position for the indicator line
              const snappedTopPx = isDragging && dragPreviewTime
                ? (() => {
                    const [ph, pm] = dragPreviewTime.split(':').map(Number);
                    return ((ph * 60 + (pm || 0) - startHour * 60) / 60) * ROW_HEIGHT;
                  })()
                : null;

              return (
                <React.Fragment key={s.id}>
                  {/* Ghost placeholder at original position */}
                  {isDragging && (
                    <div
                      className="absolute pointer-events-none"
                      style={{
                        top: topPx,
                        height: heightPx,
                        left: `calc(48px + (100% - 48px) * ${slotIndex / slotCount})`,
                        width: `calc((100% - 48px) / ${slotCount})`,
                        zIndex: 5,
                        padding: '1px 2px',
                      }}
                    >
                      <div className="h-full bg-primary/5 border-2 border-dashed border-primary/20 rounded-lg" />
                    </div>
                  )}
                  {/* Snap indicator line showing target 30-min slot */}
                  {isDragging && snappedTopPx != null && (
                    <div
                      className="absolute pointer-events-none"
                      style={{
                        top: snappedTopPx,
                        left: 48,
                        right: 0,
                        zIndex: 45,
                      }}
                    >
                      <div className="flex items-center gap-1">
                        <div className="h-[2px] flex-1 bg-primary/60 rounded-full" />
                        <span className="text-[10px] font-bold text-primary bg-background/90 px-1.5 py-0.5 rounded-md border border-primary/30 shrink-0">
                          {dragPreviewTime}
                        </span>
                      </div>
                    </div>
                  )}
                  {/* Actual card — uses transform for GPU-accelerated smooth movement */}
                  <div
                    className={`absolute ${isDragging ? 'z-50' : ''}`}
                    style={{
                      top: topPx,
                      height: heightPx,
                      left: isDragging ? '12px' : `calc(48px + (100% - 48px) * ${slotIndex / slotCount})`,
                      width: isDragging ? 'calc(100% - 24px)' : `calc((100% - 48px) / ${slotCount})`,
                      zIndex: isDragging ? 50 : 10,
                      padding: '1px 2px',
                      transform: isDragging ? `translateY(${dragOffsetPx}px)` : 'none',
                      willChange: isDragging ? 'transform' : 'auto',
                      transition: isDragging ? 'none' : 'top 0.3s ease-out, left 0.3s ease-out, width 0.3s ease-out',
                    }}
                  >
                    <div className="h-full">
                      {renderSessionCard(s)}
                    </div>
                  </div>
                </React.Fragment>
              );
            })}

            {/* Absolutely positioned blocks */}
            {dayBlocks.map(b => {
              const [h, m] = b.block_time.split(':').map(Number);
              const totalMinutes = h * 60 + (m || 0);
              const startHour = HOURS[0];
              const topPx = ((totalMinutes - startHour * 60) / 60) * ROW_HEIGHT;
              const heightPx = (b.duration_minutes / 60) * ROW_HEIGHT;

              return (
                <div
                  key={b.id}
                  className="absolute"
                  style={{
                    top: topPx,
                    height: Math.max(heightPx, 28),
                    left: 48,
                    right: 0,
                    zIndex: 5,
                    padding: '1px 2px',
                  }}
                >
                  {renderBlockCard(b)}
                </div>
              );
            })}
          </div>
        </motion.div>
      </AnimatePresence>
      </div>
      {deleteChoiceSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setDeleteChoiceSession(null)}>
          <div className="bg-card border border-border rounded-2xl p-5 mx-4 max-w-sm w-full space-y-3 shadow-xl animate-scale-in" onClick={e => e.stopPropagation()}>
            <p className="text-sm font-bold text-center">
              {lang === 'en' ? 'Delete recurring session' : 'Удалить повторяющуюся тренировку'}
            </p>
            <p className="text-xs text-muted-foreground text-center">
              {deleteChoiceSession.clientName} · {format(selectedDate, 'EEEE', { locale })}
              {deleteChoiceSession.recurrence_time ? ` ${deleteChoiceSession.recurrence_time.slice(0, 5)}` : ''}
            </p>
            <div className="space-y-2 pt-1">
              <button
                onClick={() => handleDeleteRecurringThis(deleteChoiceSession)}
                className="w-full bg-destructive/10 text-destructive text-xs font-semibold py-2.5 rounded-xl hover:bg-destructive/20 transition-colors"
              >
                {lang === 'en' ? 'Cancel only this session' : 'Отменить только эту тренировку'}
              </button>
              <button
                onClick={() => handleDeleteRecurringAll(deleteChoiceSession)}
                className="w-full bg-destructive text-destructive-foreground text-xs font-semibold py-2.5 rounded-xl hover:bg-destructive/90 transition-colors"
              >
                {lang === 'en' ? 'Delete entire series' : 'Удалить весь ряд навсегда'}
              </button>
              <button
                onClick={() => setDeleteChoiceSession(null)}
                className="w-full text-muted-foreground text-xs font-medium py-2 rounded-xl hover:bg-secondary transition-colors"
              >
                {lang === 'en' ? 'Cancel' : 'Отмена'}
              </button>
            </div>
          </div>
        </div>
      )}
      {showBlockModal !== null && (
        <TrainerBlockModal
          lang={lang}
          hour={showBlockModal}
          date={selectedDateStr}
          dayOfWeek={dayOfWeek}
          clients={clients}
          onClose={() => setShowBlockModal(null)}
          onSaveBlock={saveBlock}
          onAddSession={async ({ clientId, manualName: name, time, travelMinutes, isRecurring: recurring, recurrenceDay }) => {
            setShowBlockModal(null);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Create session
            const notes = name && !clientId ? `👤 ${name} (manual)` : null;
            const userId = clientId || user.id;
            await supabase.from('scheduled_sessions').insert({
              user_id: userId,
              trainer_user_id: user.id,
              session_date: selectedDateStr,
              session_time: recurring ? null : (time || null),
              is_recurring: recurring,
              recurrence_day: recurring ? recurrenceDay : null,
              recurrence_time: recurring ? (time || null) : null,
              notes,
            });

            // Auto-deduct from package if real client
            if (clientId) {
              const { data: pkgs } = await supabase
                .from('client_packages')
                .select('*')
                .eq('user_id', clientId)
                .eq('is_active', true)
                .order('created_at', { ascending: true })
                .limit(1);
              const pkg = pkgs?.[0];
              if (pkg && pkg.used_sessions < pkg.total_sessions) {
                await supabase
                  .from('client_packages')
                  .update({ used_sessions: pkg.used_sessions + 1 })
                  .eq('id', pkg.id);
              }
            }

            // Create travel block if specified
            if (travelMinutes > 0 && time) {
              const [h, m] = time.split(':').map(Number);
              const travelStart = h * 60 + (m || 0) - travelMinutes;
              const th = Math.max(0, Math.floor(travelStart / 60));
              const tm = travelStart % 60;
              const travelTime = `${String(th).padStart(2, '0')}:${String(tm < 0 ? 0 : tm).padStart(2, '0')}`;
              await supabase.from('trainer_blocks').insert({
                trainer_user_id: user.id,
                block_type: 'travel',
                title: lang === 'en' ? 'Travel' : 'В пути',
                block_time: travelTime,
                duration_minutes: travelMinutes,
                is_recurring: recurring,
                recurrence_day: recurring ? recurrenceDay : null,
                block_date: recurring ? null : selectedDateStr,
              });
              fetchBlocks();
            }

            fetchSessions();
            if (onSessionChange) onSessionChange();
            toast({ title: lang === 'en' ? 'Session added' : 'Тренировка добавлена' });
          }}
        />
      )}
    </div>
  );
};

export default TrainerCalendar;
