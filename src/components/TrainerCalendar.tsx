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
  recurring_exceptions: string[];
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
  const [contextMenuBlockId, setContextMenuBlockId] = useState<string | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Delete recurring choice dialog
  const [deleteChoiceSession, setDeleteChoiceSession] = useState<(ScheduledSession & { clientName: string }) | null>(null);
  const [deleteChoiceBlock, setDeleteChoiceBlock] = useState<TrainerBlock | null>(null);

  // Edit state (sessions)
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editTime, setEditTime] = useState('');
  const [editDuration, setEditDuration] = useState(60);

  // Edit state (blocks)
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [editBlockTime, setEditBlockTime] = useState('');
  const [editBlockDuration, setEditBlockDuration] = useState(60);

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
      .select('user_id, total_sessions, used_sessions, is_active, created_at')
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    if (data) {
      const map: Record<string, { remaining: number; total: number }> = {};
      data.forEach(p => {
        const remaining = p.total_sessions - p.used_sessions;
        if (!map[p.user_id]) {
          map[p.user_id] = { remaining, total: p.total_sessions };
        }
      });
      setClientRemaining(map);
    }
  };
...
            // Auto-deduct from the newest valid package if real client
            if (clientId) {
              const { data: pkgs } = await supabase
                .from('client_packages')
                .select('*')
                .eq('user_id', clientId)
                .eq('is_active', true)
                .order('created_at', { ascending: false })
                .limit(1);
              const pkg = pkgs?.[0];
              if (pkg && pkg.used_sessions < pkg.total_sessions) {
                const newUsed = pkg.used_sessions + 1;
                const updates: { used_sessions: number; is_active?: boolean } = { used_sessions: newUsed };
                if (newUsed >= pkg.total_sessions) {
                  updates.is_active = false;
                }

                await supabase
                  .from('client_packages')
                  .update(updates)
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

            // Queue notification for real clients
            if (clientId) {
              const dateDisplay = recurring
                ? `каждый ${['Вс','Пн','Вт','Ср','Чт','Пт','Сб'][recurrenceDay || 0]}`
                : new Date(selectedDateStr + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', weekday: 'short' });
              const timeDisplay = time ? ` в ${time}` : '';
              queueNotification(
                clientId,
                'session_added',
                `✅ <b>Тренировка добавлена</b>\n📅 ${dateDisplay}${timeDisplay}${recurring ? '\n🔄 Повторяющаяся' : ''}`
              );
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
