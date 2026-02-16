import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Activity, LogOut, CalendarDays, RotateCw, XCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import WhoopWidget from './WhoopWidget';

interface ScheduledSession {
  id: string;
  session_date: string;
  session_time: string | null;
  is_recurring: boolean;
  recurrence_day: number | null;
  recurrence_time: string | null;
  is_deducted: boolean;
}

const DAY_NAMES_RU = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const DAY_NAMES_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface ClientPackage {
  id: string;
  package_name: string;
  total_sessions: number;
  used_sessions: number;
  is_active: boolean;
}

interface ClientProfileDrawerProps {
  open: boolean;
  onClose: () => void;
}

const ClientProfileDrawer = ({ open, onClose }: ClientProfileDrawerProps) => {
  const { user, profile, signOut } = useAuth();
  const { lang } = useLanguage();
  const { toast } = useToast();
  const [pkg, setPkg] = useState<ClientPackage | null>(null);
  const [sessions, setSessions] = useState<ScheduledSession[]>([]);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const dayNames = lang === 'en' ? DAY_NAMES_EN : DAY_NAMES_RU;

  const canCancel = (s: ScheduledSession) => {
    if (s.is_recurring) return true; // recurring can always be removed
    if (!s.session_time) return true; // no time = future, allow cancel
    const sessionDateTime = new Date(`${s.session_date}T${s.session_time}`);
    const now = new Date();
    const hoursLeft = (sessionDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    return hoursLeft > 24;
  };

  const handleCancel = async (session: ScheduledSession) => {
    if (!canCancel(session)) {
      toast({
        title: lang === 'en' ? 'Cannot cancel' : 'Отмена невозможна',
        description: lang === 'en'
          ? 'Sessions can only be cancelled more than 24 hours in advance.'
          : 'Отмена возможна только за 24 часа до тренировки.',
        variant: 'destructive',
      });
      return;
    }
    setCancellingId(session.id);
    const dateStr = new Date(session.session_date).toLocaleDateString(lang === 'en' ? 'en-US' : 'ru-RU', { day: 'numeric', month: 'short', weekday: 'short' });
    const timeStr = session.session_time ? ` ${session.session_time.slice(0, 5)}` : '';

    await supabase.from('scheduled_sessions').delete().eq('id', session.id).eq('user_id', user!.id);

    // Notify trainer via Telegram (best-effort)
    supabase.functions.invoke('send-telegram', {
      body: { action: 'cancelSession', message: `${dateStr}${timeStr}` },
    }).catch(() => {});

    setSessions(prev => prev.filter(s => s.id !== session.id));
    setCancellingId(null);
    toast({ title: lang === 'en' ? 'Session cancelled' : 'Тренировка отменена' });
  };

  useEffect(() => {
    if (!user || !open) return;
    const fetchPkg = async () => {
      const { data } = await supabase
        .from('client_packages')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      setPkg(data);
    };
    const fetchSessions = async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data } = await supabase
        .from('scheduled_sessions')
        .select('*')
        .eq('user_id', user.id)
        .or(`is_recurring.eq.true,session_date.gte.${today}`)
        .eq('is_deducted', false)
        .order('session_date', { ascending: true });
      setSessions((data as ScheduledSession[]) || []);
    };
    fetchPkg();
    fetchSessions();

    const channel = supabase
      .channel('client-sessions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scheduled_sessions', filter: `user_id=eq.${user.id}` }, () => {
        fetchSessions();
        fetchPkg();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, open]);

  if (!open || !user) return null;

  const remaining = pkg ? pkg.total_sessions - pkg.used_sessions : 0;
  const total = pkg?.total_sessions || 0;
  const pct = total > 0 ? Math.round((remaining / total) * 100) : 0;
  const low = remaining <= 2 && pkg;

  return (
    <AnimatePresence>
      {open && (
        <motion.div key="drawer-wrapper" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          {/* Drawer */}
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed top-0 left-0 bottom-0 z-[100] w-[85%] max-w-[320px] bg-card border-r border-border/50 shadow-2xl flex flex-col"
          >
            {/* Header */}
            <div className="p-5 pb-3 flex items-center justify-between" style={{ paddingTop: 'max(env(safe-area-inset-top, 20px), 20px)' }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
                  <span className="text-primary-foreground font-extrabold text-xs">
                    {(() => {
                      const name = profile?.full_name || '';
                      const parts = name.trim().split(/\s+/);
                      if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
                      return name.slice(0, 2).toUpperCase() || '?';
                    })()}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">{profile?.full_name}</p>
                  <p className="text-[11px] text-muted-foreground">{profile?.email}</p>
                </div>
              </div>
              <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Session balance */}
            <div className="px-5 py-4 flex-1 overflow-y-auto">
              <h3 className="text-xs font-extrabold text-foreground uppercase tracking-wider mb-3">
                {lang === 'en' ? 'My Sessions' : 'Мои занятия'}
              </h3>

              {pkg ? (
                <div className="bg-background border border-border/50 rounded-2xl p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${low ? 'bg-destructive/20' : 'gradient-primary'}`}>
                      <Activity className={`w-5 h-5 ${low ? 'text-destructive' : 'text-primary-foreground'}`} />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{pkg.package_name}</p>
                      <p className="text-xl font-extrabold font-heading">
                        {remaining} <span className="text-sm font-normal text-muted-foreground">/ {total}</span>
                      </p>
                    </div>
                  </div>
                  <div className="h-2 bg-secondary rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                      className={`h-full rounded-full ${low ? 'bg-destructive' : 'gradient-primary'}`}
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-2">
                    {lang === 'en'
                      ? `${remaining} sessions remaining`
                      : `${remaining} занятий осталось`}
                  </p>
                </div>
              ) : (
                <div className="bg-background border border-border/50 rounded-2xl p-4 text-center">
                  <Activity className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    {lang === 'en' ? 'No active package' : 'Нет активного пакета'}
                  </p>
                </div>
              )}

              {/* Renewal section */}
              <h3 className="text-xs font-extrabold text-foreground uppercase tracking-wider mt-6 mb-3">
                {lang === 'en' ? 'Buy a Package' : 'Купить пакет'}
              </h3>
              <div className="space-y-2">
                {[
                  { sessions: 8, price: 750 },
                  { sessions: 12, price: 1030 },
                  { sessions: 20, price: 1599 },
                ].map((p) => (
                  <a
                    key={p.sessions}
                    href="https://revolut.me/illarion"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between bg-background border border-border/50 rounded-xl p-3 hover:border-primary/30 transition-colors"
                  >
                    <div>
                      <p className="text-sm font-bold text-foreground">
                        {p.sessions} {lang === 'en' ? 'sessions' : 'занятий'}
                      </p>
                    </div>
                    <span className="text-sm font-extrabold text-primary">{p.price}€</span>
                  </a>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground/60 mt-2 text-center">
              {lang === 'en'
                  ? 'Payment via Revolut. Gym membership 150€/month paid separately.'
                  : 'Оплата через Revolut. Абонемент зала 150€/мес оплачивается отдельно.'}
              </p>

              {/* My Schedule */}
              {sessions.length > 0 && (
                <>
                  <h3 className="text-xs font-extrabold text-foreground uppercase tracking-wider mt-6 mb-3">
                    {lang === 'en' ? 'My Schedule' : 'Моё расписание'}
                  </h3>
                  <div className="space-y-2">
                    {sessions.filter(s => s.is_recurring).map(s => (
                      <div key={s.id} className="flex items-center justify-between bg-background border border-border/50 rounded-xl p-3">
                        <div className="flex items-center gap-2">
                          <RotateCw className="w-3.5 h-3.5 text-primary shrink-0" />
                          <span className="text-sm font-medium">
                            {lang === 'en' ? 'Every' : 'Каждый'} {dayNames[s.recurrence_day!]}
                            {s.recurrence_time ? ` ${s.recurrence_time.slice(0, 5)}` : ''}
                          </span>
                        </div>
                        <button
                          onClick={() => handleCancel(s)}
                          disabled={cancellingId === s.id}
                          className="text-destructive/60 hover:text-destructive transition-colors"
                          title={lang === 'en' ? 'Remove recurring session' : 'Убрать повторяющееся занятие'}
                        >
                          {cancellingId === s.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <X className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    ))}
                    {sessions.filter(s => !s.is_recurring).map(s => {
                      const cancelable = canCancel(s);
                      return (
                        <div key={s.id} className="flex items-center justify-between bg-background border border-border/50 rounded-xl p-3">
                          <div className="flex items-center gap-2">
                            <CalendarDays className="w-3.5 h-3.5 text-primary shrink-0" />
                            <span className="text-sm">
                              {new Date(s.session_date).toLocaleDateString(lang === 'en' ? 'en-US' : 'ru-RU', { day: 'numeric', month: 'short', weekday: 'short' })}
                              {s.session_time ? ` ${s.session_time.slice(0, 5)}` : ''}
                            </span>
                          </div>
                          {cancelable ? (
                            <button
                              onClick={() => handleCancel(s)}
                              disabled={cancellingId === s.id}
                              className="text-destructive hover:text-destructive/80 transition-colors"
                              title={lang === 'en' ? 'Cancel session' : 'Отменить'}
                            >
                              {cancellingId === s.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <XCircle className="w-4 h-4" />
                              )}
                            </button>
                          ) : (
                            <span className="text-[10px] text-muted-foreground/50">
                              {lang === 'en' ? '< 24h' : '< 24ч'}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {/* Whoop Integration */}
              <WhoopWidget />
            </div>

            {/* Sign out */}
            <div className="p-5 pt-2 border-t border-border/50">
              <button
                onClick={async () => {
                  await signOut();
                  onClose();
                }}
                className="w-full flex items-center justify-center gap-2 text-sm font-semibold text-destructive py-3 rounded-xl hover:bg-destructive/10 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                {lang === 'en' ? 'Sign out' : 'Выйти'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ClientProfileDrawer;
