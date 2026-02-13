import { useState, useEffect, useMemo, useRef } from 'react';
import { ChevronLeft, ChevronRight, Plus, X, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format, addDays, addMonths, startOfWeek, isSameDay, isToday } from 'date-fns';
import { ru, enUS } from 'date-fns/locale';

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
}

interface Props {
  lang: string;
  clients: Profile[];
}

const HOURS = Array.from({ length: 17 }, (_, i) => i + 6); // 6:00 — 22:00

const TrainerCalendar = ({ lang, clients }: Props) => {
  const { toast } = useToast();
  const locale = lang === 'en' ? enUS : ru;
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const touchStartX = useRef<number | null>(null);
  const [sessions, setSessions] = useState<ScheduledSession[]>([]);
  const [showAddForm, setShowAddForm] = useState<number | null>(null); // hour to add
  const [selectedClientId, setSelectedClientId] = useState('');
  const [addTime, setAddTime] = useState('');

  const weekDays = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  const fetchSessions = async () => {
    const { data } = await supabase
      .from('scheduled_sessions')
      .select('*')
      .order('session_time', { ascending: true });
    setSessions((data as ScheduledSession[]) || []);
  };

  useEffect(() => { fetchSessions(); }, []);

  const navigateWeek = (dir: number) => {
    const newStart = addDays(weekStart, dir * 7);
    setWeekStart(newStart);
    if (dir === 1) setSelectedDate(newStart);
    else setSelectedDate(addDays(newStart, 6));
  };

  const navigateMonth = (dir: number) => {
    const newDate = addMonths(selectedDate, dir);
    setSelectedDate(newDate);
    setWeekStart(startOfWeek(newDate, { weekStartsOn: 1 }));
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const diff = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(diff) > 50) {
      navigateWeek(diff < 0 ? 1 : -1);
    }
    touchStartX.current = null;
  };

  const dayOfWeek = selectedDate.getDay();
  const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');

  // Sessions for selected day: one-off matching date OR recurring matching day-of-week
  const daySessions = useMemo(() => {
    return sessions.filter(s => {
      if (s.is_recurring && s.recurrence_day === dayOfWeek) return true;
      if (!s.is_recurring && s.session_date === selectedDateStr) return true;
      return false;
    });
  }, [sessions, selectedDateStr, dayOfWeek]);

  // Group sessions by hour
  const sessionsByHour = useMemo(() => {
    const map: Record<number, (ScheduledSession & { clientName: string })[]> = {};
    daySessions.forEach(s => {
      const timeStr = s.is_recurring ? s.recurrence_time : s.session_time;
      const hour = timeStr ? parseInt(timeStr.split(':')[0], 10) : -1;
      if (!map[hour]) map[hour] = [];
      const client = clients.find(c => c.user_id === s.user_id);
      map[hour].push({ ...s, clientName: client?.full_name || '?' });
    });
    return map;
  }, [daySessions, clients]);

  const noTimeSessions = sessionsByHour[-1] || [];

  const addSession = async () => {
    if (!selectedClientId) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('scheduled_sessions').insert({
      user_id: selectedClientId,
      trainer_user_id: user.id,
      session_date: selectedDateStr,
      session_time: addTime || null,
      is_recurring: false,
    });

    setShowAddForm(null);
    setSelectedClientId('');
    setAddTime('');
    fetchSessions();
    toast({ title: lang === 'en' ? 'Session added' : 'Тренировка добавлена' });
  };

  const deleteSession = async (id: string) => {
    await supabase.from('scheduled_sessions').delete().eq('id', id);
    fetchSessions();
    toast({ title: lang === 'en' ? 'Session removed' : 'Тренировка удалена' });
  };

  return (
    <div className="space-y-0">
      {/* Month header */}
      <div className="flex items-center justify-between px-1 mb-3">
        <button onClick={() => navigateMonth(-1)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-secondary transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h2 className="text-base font-bold capitalize">
          {format(selectedDate, 'LLLL yyyy', { locale })}
        </h2>
        <button onClick={() => navigateMonth(1)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-secondary transition-colors">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Week strip — swipeable */}
      <div
        className="grid grid-cols-7 gap-1 mb-4 touch-pan-y"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {weekDays.map(day => {
          const active = isSameDay(day, selectedDate);
          const today = isToday(day);
          return (
            <button
              key={day.toISOString()}
              onClick={() => setSelectedDate(day)}
              className={`flex flex-col items-center py-2 rounded-xl transition-all ${
                active
                  ? 'bg-primary text-primary-foreground shadow-md'
                  : today
                    ? 'bg-primary/10 text-primary'
                    : 'hover:bg-secondary text-foreground'
              }`}
            >
              <span className="text-[10px] font-medium uppercase opacity-70">
                {format(day, 'EEE', { locale })}
              </span>
              <span className={`text-lg font-bold leading-tight`}>
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

      {/* Add form (top-level) */}
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
          {noTimeSessions.map(s => (
            <div key={s.id} className="flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-lg px-3 py-2">
              <div className="w-1 h-6 rounded-full bg-primary shrink-0" />
              <span className="text-xs font-medium flex-1">{s.clientName}</span>
              {s.is_deducted && <span className="text-[10px] text-muted-foreground">✓</span>}
              <button onClick={() => deleteSession(s.id)} className="text-destructive/60 hover:text-destructive">
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Timeline */}
      <div className="relative">
        {HOURS.map(hour => {
          const hourSessions = sessionsByHour[hour] || [];
          return (
            <div key={hour} className="flex min-h-[52px] group">
              {/* Time label */}
              <div className="w-12 shrink-0 text-right pr-3 pt-0">
                <span className="text-[10px] text-muted-foreground font-medium">
                  {String(hour).padStart(2, '0')}:00
                </span>
              </div>
              {/* Slot */}
              <div className="flex-1 border-t border-border/30 relative min-h-[52px]">
                {hourSessions.map(s => (
                  <div
                    key={s.id}
                    className="flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-lg px-3 py-1.5 mb-1 mt-1"
                  >
                    <div className="w-1 h-5 rounded-full bg-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate">{s.clientName}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {(s.is_recurring ? s.recurrence_time : s.session_time)?.slice(0, 5)}
                        {s.is_recurring && ` · ${lang === 'en' ? 'recurring' : 'повтор'}`}
                      </p>
                    </div>
                    {s.is_deducted && <span className="text-[10px] text-primary">✓</span>}
                    <button onClick={() => deleteSession(s.id)} className="text-destructive/60 hover:text-destructive">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {/* Tap to add */}
                {hourSessions.length === 0 && (
                  <button
                    onClick={() => {
                      setShowAddForm(-1);
                      setAddTime(`${String(hour).padStart(2, '0')}:00`);
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                  >
                    <span className="text-[10px] text-primary/50 flex items-center gap-1">
                      <Plus className="w-3 h-3" /> {lang === 'en' ? 'Add' : 'Добавить'}
                    </span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TrainerCalendar;
