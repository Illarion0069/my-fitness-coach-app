import { useState, useEffect } from 'react';
import { CalendarDays, Plus, X, RotateCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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

const DAY_NAMES_RU = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const DAY_NAMES_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface Props {
  userId: string;
  lang: string;
  onSessionChange?: () => void;
}

const ClientSchedule = ({ userId, lang, onSessionChange }: Props) => {
  const { toast } = useToast();
  const [sessions, setSessions] = useState<ScheduledSession[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [mode, setMode] = useState<'once' | 'recurring'>('once');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [recurDay, setRecurDay] = useState(1);
  const [recurTime, setRecurTime] = useState('');

  const dayNames = lang === 'en' ? DAY_NAMES_EN : DAY_NAMES_RU;

  const fetchSessions = async () => {
    const { data } = await supabase
      .from('scheduled_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('session_date', { ascending: true });
    setSessions((data as ScheduledSession[]) || []);
  };

  useEffect(() => { fetchSessions(); }, [userId]);

  const sendNotification = async (clientUserId: string, clientMsg: string, trainerMsg: string) => {
    try {
      const { data: { session: authSession } } = await supabase.auth.getSession();
      if (!authSession?.access_token) return;
      await supabase.functions.invoke('send-telegram', {
        body: { action: 'sendReminder', client_user_id: clientUserId, message: clientMsg },
      });
      await supabase.functions.invoke('send-telegram', {
        body: { message: trainerMsg },
      });
    } catch (e) {
      console.error('Notification failed', e);
    }
  };

  const addSession = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (mode === 'once') {
      if (!date) return;
      await supabase.from('scheduled_sessions').insert({
        user_id: userId,
        trainer_user_id: user.id,
        session_date: date,
        session_time: time || null,
        is_recurring: false,
      });

      // Auto-deduct from active package
      const { data: pkgs } = await supabase
        .from('client_packages')
        .select('*')
        .eq('user_id', userId)
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

      // Notify
      const displayDate = new Date(date + 'T00:00:00').toLocaleDateString(lang === 'en' ? 'en-US' : 'ru-RU', { day: 'numeric', month: 'long', weekday: 'short' });
      const timeDisplay = time ? ` в ${time}` : '';
      const { data: clientProfile } = await supabase.from('profiles').select('full_name').eq('user_id', userId).maybeSingle();
      const clientName = clientProfile?.full_name || '?';
      const remaining = pkg ? pkg.total_sessions - pkg.used_sessions - 1 : '?';

      sendNotification(
        userId,
        `📅 <b>Новая тренировка!</b>\n\n📆 ${displayDate}${timeDisplay}\n📍 Eleftherias 119, Limassol\n\nДо встречи! 💪`,
        `📅 <b>Тренировка добавлена</b>\n\n👤 ${clientName}\n📆 ${displayDate}${timeDisplay}\n📦 Осталось: ${remaining} занятий`
      );
    } else {
      await supabase.from('scheduled_sessions').insert({
        user_id: userId,
        trainer_user_id: user.id,
        session_date: new Date().toISOString().split('T')[0],
        is_recurring: true,
        recurrence_day: recurDay,
        recurrence_time: recurTime || null,
      });

      // Notify about recurring
      const dayName = dayNames[recurDay];
      const timeDisplay = recurTime ? ` в ${recurTime}` : '';
      const { data: clientProfile } = await supabase.from('profiles').select('full_name').eq('user_id', userId).maybeSingle();
      const clientName = clientProfile?.full_name || '?';

      sendNotification(
        userId,
        `🔄 <b>Регулярная тренировка!</b>\n\nКаждый ${dayName}${timeDisplay}\n📍 Eleftherias 119, Limassol`,
        `🔄 <b>Регулярная тренировка добавлена</b>\n\n👤 ${clientName}\nКаждый ${dayName}${timeDisplay}`
      );
    }

    setDate('');
    setTime('');
    setShowAdd(false);
    fetchSessions();
    if (onSessionChange) onSessionChange();
    toast({ title: lang === 'en' ? 'Session added' : 'Тренировка добавлена' });
  };

  const deleteSession = async (id: string) => {
    const session = sessions.find(s => s.id === id);

    await supabase.from('scheduled_sessions').delete().eq('id', id);

    // Auto-restore to active package (only for one-off sessions)
    if (session && !session.is_recurring) {
      const { data: pkgs } = await supabase
        .from('client_packages')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: true })
        .limit(1);
      const pkg = pkgs?.[0];
      if (pkg && pkg.used_sessions > 0) {
        await supabase
          .from('client_packages')
          .update({ used_sessions: pkg.used_sessions - 1 })
          .eq('id', pkg.id);
      }
    }

    // Notify about deletion
    if (session) {
      const { data: clientProfile } = await supabase.from('profiles').select('full_name').eq('user_id', userId).maybeSingle();
      const clientName = clientProfile?.full_name || '?';
      let dateDisplay: string;
      let timeDisplay = '';

      if (session.is_recurring) {
        dateDisplay = `каждый ${dayNames[session.recurrence_day || 0]}`;
        timeDisplay = session.recurrence_time ? ` в ${session.recurrence_time.slice(0, 5)}` : '';
      } else {
        dateDisplay = new Date(session.session_date + 'T00:00:00').toLocaleDateString(lang === 'en' ? 'en-US' : 'ru-RU', { day: 'numeric', month: 'long', weekday: 'short' });
        timeDisplay = session.session_time ? ` в ${session.session_time.slice(0, 5)}` : '';
      }

      sendNotification(
        userId,
        `❌ <b>Тренировка отменена тренером</b>\n\n📅 ${dateDisplay}${timeDisplay}\n\nЕсли у вас есть вопросы, свяжитесь с тренером.`,
        `❌ <b>Тренировка удалена</b>\n\n👤 ${clientName}\n📅 ${dateDisplay}${timeDisplay}`
      );
    }

    fetchSessions();
    if (onSessionChange) onSessionChange();
    toast({ title: lang === 'en' ? 'Session removed' : 'Тренировка удалена' });
  };

  const oneOff = sessions.filter(s => !s.is_recurring && !s.is_deducted);
  const recurring = sessions.filter(s => s.is_recurring);
  const past = sessions.filter(s => !s.is_recurring && s.is_deducted);

  return (
    <div className="bg-secondary/30 rounded-xl p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold flex items-center gap-1">
          <CalendarDays className="w-3 h-3" />
          {lang === 'en' ? 'Schedule' : 'Расписание'}
        </p>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="w-6 h-6 rounded-md bg-primary/20 flex items-center justify-center text-primary hover:bg-primary/30 transition-colors"
        >
          {showAdd ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
        </button>
      </div>

      {showAdd && (
        <div className="space-y-2 bg-secondary/50 rounded-lg p-2.5">
          <div className="flex gap-1">
            <button
              onClick={() => setMode('once')}
              className={`flex-1 text-[10px] font-bold py-1.5 rounded-md transition-colors ${mode === 'once' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}
            >
              {lang === 'en' ? 'One-time' : 'Разовая'}
            </button>
            <button
              onClick={() => setMode('recurring')}
              className={`flex-1 text-[10px] font-bold py-1.5 rounded-md transition-colors ${mode === 'recurring' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}
            >
              {lang === 'en' ? 'Recurring' : 'Повторяющаяся'}
            </button>
          </div>

          {mode === 'once' ? (
            <div className="flex gap-2">
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="flex-1 bg-background border border-border/50 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-primary/50"
              />
              <input
                type="time"
                value={time}
                onChange={e => setTime(e.target.value)}
                className="w-24 bg-background border border-border/50 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-primary/50"
              />
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex gap-1">
                {dayNames.map((name, i) => (
                  <button
                    key={i}
                    onClick={() => setRecurDay(i)}
                    className={`flex-1 text-[10px] font-bold py-1.5 rounded-md transition-colors ${recurDay === i ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground'}`}
                  >
                    {name}
                  </button>
                ))}
              </div>
              <input
                type="time"
                value={recurTime}
                onChange={e => setRecurTime(e.target.value)}
                className="w-full bg-background border border-border/50 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-primary/50"
                placeholder={lang === 'en' ? 'Time (optional)' : 'Время (необязательно)'}
              />
            </div>
          )}

          <button
            onClick={addSession}
            disabled={mode === 'once' && !date}
            className="w-full gradient-primary text-primary-foreground text-xs font-bold py-2 rounded-lg disabled:opacity-50"
          >
            {lang === 'en' ? 'Add' : 'Добавить'}
          </button>
        </div>
      )}

      {/* Recurring sessions */}
      {recurring.map(s => (
        <div key={s.id} className="flex items-center justify-between bg-secondary/50 rounded-lg px-2.5 py-2">
          <div className="flex items-center gap-1.5">
            <RotateCw className="w-3 h-3 text-primary" />
            <span className="text-xs font-medium">
              {dayNames[s.recurrence_day!]}{s.recurrence_time ? ` ${s.recurrence_time.slice(0, 5)}` : ''}
            </span>
          </div>
          <button onClick={() => deleteSession(s.id)} className="text-destructive hover:text-destructive/80">
            <X className="w-3 h-3" />
          </button>
        </div>
      ))}

      {/* Upcoming one-off */}
      {oneOff.map(s => (
        <div key={s.id} className="flex items-center justify-between bg-secondary/50 rounded-lg px-2.5 py-2">
          <span className="text-xs">
            {new Date(s.session_date).toLocaleDateString(lang === 'en' ? 'en-US' : 'ru-RU', { day: 'numeric', month: 'short' })}
            {s.session_time ? ` ${s.session_time.slice(0, 5)}` : ''}
          </span>
          <button onClick={() => deleteSession(s.id)} className="text-destructive hover:text-destructive/80">
            <X className="w-3 h-3" />
          </button>
        </div>
      ))}

      {recurring.length === 0 && oneOff.length === 0 && !showAdd && (
        <p className="text-[10px] text-muted-foreground">
          {lang === 'en' ? 'No scheduled sessions' : 'Нет запланированных тренировок'}
        </p>
      )}
    </div>
  );
};

export default ClientSchedule;
