import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Activity, LogOut, CalendarDays, RotateCw, XCircle, Loader2, Ruler, ClipboardCheck, ChevronDown, ChevronRight, History, Camera, KeyRound, Eye, EyeOff, Settings } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import WhoopWidget from './WhoopWidget';
import BodyMeasurementsDetail from './BodyMeasurementsDetail';
import ClientTestHistory from './ClientTestHistory';
import ClientProgressView from './ClientProgressView';

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

interface AccordionSectionProps {
  icon: React.ReactNode;
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  badge?: string | number;
}

const AccordionSection = ({ icon, title, isOpen, onToggle, children, badge }: AccordionSectionProps) => (
  <div className="border border-border/30 rounded-xl overflow-hidden">
    <button
      onClick={onToggle}
      className="w-full flex items-center gap-2.5 px-3.5 py-3 hover:bg-secondary/30 transition-colors"
    >
      {icon}
      <span className="text-sm font-semibold flex-1 text-left">{title}</span>
      {badge != null && (
        <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-md font-bold">{badge}</span>
      )}
      <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
    </button>
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="overflow-hidden"
        >
          <div className="px-3.5 pb-3.5">
            {children}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  </div>
);

const ClientProfileDrawer = ({ open, onClose }: ClientProfileDrawerProps) => {
  const { user, profile, signOut } = useAuth();
  const { lang } = useLanguage();
  const { toast } = useToast();
  const [pkg, setPkg] = useState<ClientPackage | null>(null);
  const [sessions, setSessions] = useState<ScheduledSession[]>([]);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [measurementsOpen, setMeasurementsOpen] = useState(false);
  const [measurements, setMeasurements] = useState<any[]>([]);
  const [pastSessions, setPastSessions] = useState<ScheduledSession[]>([]);
  const [showChangePwd, setShowChangePwd] = useState(false);
  const [newPwd, setNewPwd] = useState('');
  const [newPwd2, setNewPwd2] = useState('');
  const [pwdVisible, setPwdVisible] = useState(false);
  const [pwdSaving, setPwdSaving] = useState(false);

  const handleChangePassword = async () => {
    if (newPwd.length < 8) {
      toast({ title: lang === 'en' ? 'Min 8 characters' : 'Минимум 8 символов', variant: 'destructive' });
      return;
    }
    if (newPwd !== newPwd2) {
      toast({ title: lang === 'en' ? 'Passwords do not match' : 'Пароли не совпадают', variant: 'destructive' });
      return;
    }
    setPwdSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('reset-password', {
        body: { action: 'change_password', new_password: newPwd },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).message || (data as any).error);
      toast({ title: lang === 'en' ? 'Password updated' : 'Пароль обновлён' });
      setNewPwd(''); setNewPwd2(''); setShowChangePwd(false);
    } catch (e: any) {
      const msg = String(e?.message || '');
      toast({
        title: lang === 'en' ? 'Failed to update password' : 'Не удалось обновить пароль',
        description: msg.toLowerCase().includes('pwned') || msg.toLowerCase().includes('breach')
          ? (lang === 'en' ? 'This password was found in a breach. Choose another.' : 'Этот пароль скомпрометирован. Выберите другой.')
          : msg,
        variant: 'destructive',
      });
    } finally {
      setPwdSaving(false);
    }
  };

  const dayNames = lang === 'en' ? DAY_NAMES_EN : DAY_NAMES_RU;

  const toggleSection = (id: string) => setOpenSection(prev => prev === id ? null : id);

  const canCancel = (s: ScheduledSession) => {
    if (s.is_recurring) return true;
    if (!s.session_time) return true;
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
    try {
      const { data, error } = await supabase.functions.invoke('book-session', {
        body: { action: 'cancel', session_id: session.id },
      });
      if (error || data?.error) {
        toast({ title: lang === 'en' ? 'Error' : 'Ошибка', description: data?.error || error?.message, variant: 'destructive' });
      } else {
        setSessions(prev => prev.filter(s => s.id !== session.id));
        const { data: updatedPkg } = await supabase
          .from('client_packages')
          .select('*')
          .eq('user_id', user!.id)
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        setPkg(updatedPkg);
        toast({ title: lang === 'en' ? 'Session cancelled — balance restored' : 'Тренировка отменена — занятие возвращено' });
      }
    } catch (e: any) {
      toast({ title: lang === 'en' ? 'Error' : 'Ошибка', description: e.message, variant: 'destructive' });
    }
    setCancellingId(null);
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
    const fetchPastSessions = async () => {
      const { data } = await supabase
        .from('scheduled_sessions')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_deducted', true)
        .order('session_date', { ascending: false })
        .limit(20);
      setPastSessions((data as ScheduledSession[]) || []);
    };
    const fetchMeasurements = async () => {
      const { data } = await supabase
        .from('body_measurements')
        .select('*')
        .eq('user_id', user.id)
        .order('measured_at', { ascending: false })
        .limit(50);
      setMeasurements(data || []);
    };
    fetchPkg();
    fetchSessions();
    fetchPastSessions();
    fetchMeasurements();

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
    <>
    <AnimatePresence>
      {open && (
        <motion.div key="drawer-wrapper" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed top-0 left-0 bottom-0 z-[100] w-[85%] max-w-[320px] bg-card border-r border-border/50 shadow-2xl flex flex-col"
          >
            {/* Header — client card */}
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

            {/* Session balance — always visible */}
            <div className="px-5 pb-3">
              {pkg ? (
                <div className="bg-background border border-border/50 rounded-2xl p-3">
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${low ? 'bg-destructive/20' : 'gradient-primary'}`}>
                      <Activity className={`w-4 h-4 ${low ? 'text-destructive' : 'text-primary-foreground'}`} />
                    </div>
                    <div>
                      <p className="text-xl font-extrabold font-heading">
                        {remaining} <span className="text-sm font-normal text-muted-foreground">/ {total}</span>
                      </p>
                    </div>
                  </div>
                  <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                      className={`h-full rounded-full ${low ? 'bg-destructive' : 'gradient-primary'}`}
                    />
                  </div>
                </div>
              ) : (
                <div className="bg-background border border-border/50 rounded-2xl p-3 text-center">
                  <Activity className="w-6 h-6 text-muted-foreground/30 mx-auto mb-1" />
                  <p className="text-xs text-muted-foreground">
                    {lang === 'en' ? 'No active package' : 'Нет активного пакета'}
                  </p>
                </div>
              )}
            </div>

            {/* Accordion menu */}
            <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-2">
              {/* Schedule */}
              <AccordionSection
                icon={<CalendarDays className="w-4 h-4 text-primary" />}
                title={lang === 'en' ? 'Schedule' : 'Расписание'}
                isOpen={openSection === 'schedule'}
                onToggle={() => toggleSection('schedule')}
                badge={sessions.length || undefined}
              >
                {sessions.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">
                    {lang === 'en' ? 'No scheduled sessions' : 'Нет запланированных тренировок'}
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {sessions.filter(s => s.is_recurring).map(s => (
                      <div key={s.id} className="flex items-center justify-between bg-secondary/30 rounded-lg p-2.5">
                        <div className="flex items-center gap-2">
                          <RotateCw className="w-3.5 h-3.5 text-primary shrink-0" />
                          <span className="text-xs font-medium">
                            {lang === 'en' ? 'Every' : 'Каждый'} {dayNames[s.recurrence_day!]}
                            {s.recurrence_time ? ` ${s.recurrence_time.slice(0, 5)}` : ''}
                          </span>
                        </div>
                        {confirmCancelId === s.id ? (
                          <div className="flex items-center gap-1">
                            <button onClick={() => setConfirmCancelId(null)} className="h-7 px-2 rounded-md bg-secondary text-[10px] font-bold text-muted-foreground">{lang === 'en' ? 'No' : 'Нет'}</button>
                            <button onClick={() => { setConfirmCancelId(null); handleCancel(s); }} disabled={cancellingId === s.id} className="h-7 px-2 rounded-md bg-destructive text-[10px] font-bold text-destructive-foreground">
                              {cancellingId === s.id ? <Loader2 className="w-3 h-3 animate-spin" /> : (lang === 'en' ? 'Cancel' : 'Отменить')}
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => setConfirmCancelId(s.id)} className="text-destructive/60 hover:text-destructive transition-colors">
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                    {sessions.filter(s => !s.is_recurring).map(s => {
                      const cancelable = canCancel(s);
                      return (
                        <div key={s.id} className="flex items-center justify-between bg-secondary/30 rounded-lg p-2.5">
                          <div className="flex items-center gap-2">
                            <CalendarDays className="w-3.5 h-3.5 text-primary shrink-0" />
                            <span className="text-xs">
                              {new Date(s.session_date).toLocaleDateString(lang === 'en' ? 'en-US' : 'ru-RU', { day: 'numeric', month: 'short', weekday: 'short' })}
                              {s.session_time ? ` ${s.session_time.slice(0, 5)}` : ''}
                            </span>
                          </div>
                          {cancelable ? (
                            confirmCancelId === s.id ? (
                              <div className="flex items-center gap-1">
                                <button onClick={() => setConfirmCancelId(null)} className="h-7 px-2 rounded-md bg-secondary text-[10px] font-bold text-muted-foreground">{lang === 'en' ? 'No' : 'Нет'}</button>
                                <button onClick={() => { setConfirmCancelId(null); handleCancel(s); }} disabled={cancellingId === s.id} className="h-7 px-2 rounded-md bg-destructive text-[10px] font-bold text-destructive-foreground">
                                  {cancellingId === s.id ? <Loader2 className="w-3 h-3 animate-spin" /> : (lang === 'en' ? 'Cancel' : 'Отменить')}
                                </button>
                              </div>
                            ) : (
                              <button onClick={() => setConfirmCancelId(s.id)} className="text-destructive hover:text-destructive/80 transition-colors">
                                <XCircle className="w-4 h-4" />
                              </button>
                            )
                          ) : (
                            <span className="text-[10px] text-muted-foreground/50">{lang === 'en' ? '< 24h' : '< 24ч'}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </AccordionSection>

              {/* Training History */}
              <AccordionSection
                icon={<History className="w-4 h-4 text-primary" />}
                title={lang === 'en' ? 'Training History' : 'История тренировок'}
                isOpen={openSection === 'history'}
                onToggle={() => toggleSection('history')}
                badge={pastSessions.length || undefined}
              >
                {pastSessions.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">
                    {lang === 'en' ? 'No completed sessions yet' : 'Пока нет завершённых тренировок'}
                  </p>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {pastSessions.map(s => (
                      <div key={s.id} className="flex items-center gap-2 bg-secondary/30 rounded-lg p-2.5">
                        <CalendarDays className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span className="text-xs text-muted-foreground">
                          {new Date(s.session_date).toLocaleDateString(lang === 'en' ? 'en-US' : 'ru-RU', { day: 'numeric', month: 'short', weekday: 'short' })}
                          {s.session_time ? ` ${s.session_time.slice(0, 5)}` : ''}
                        </span>
                        <span className="ml-auto text-[10px] text-primary/60 font-medium">✓</span>
                      </div>
                    ))}
                  </div>
                )}
              </AccordionSection>

              {/* Body Measurements — direct open */}
              <button
                onClick={() => setMeasurementsOpen(true)}
                className="w-full border border-border/30 rounded-xl flex items-center gap-2.5 px-3.5 py-3 hover:bg-secondary/30 transition-colors"
              >
                <Ruler className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold flex-1 text-left">{lang === 'en' ? 'Body Progress' : 'Замеры тела'}</span>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </button>

              {/* Health Tests */}

              {/* Progress Photos */}
              <AccordionSection
                icon={<Camera className="w-4 h-4 text-primary" />}
                title={lang === 'en' ? 'Progress Photos' : 'Фото прогресса'}
                isOpen={openSection === 'photos'}
                onToggle={() => toggleSection('photos')}
              >
                <ClientProgressView userId={user.id} lang={lang} />
              </AccordionSection>

              {/* Health Tests */}
              <AccordionSection
                icon={<ClipboardCheck className="w-4 h-4 text-primary" />}
                title={lang === 'en' ? 'Health Tests' : 'Тесты здоровья'}
                isOpen={openSection === 'tests'}
                onToggle={() => toggleSection('tests')}
              >
                <ClientTestHistory userId={user.id} lang={lang} />
              </AccordionSection>

              {/* Whoop */}
              <AccordionSection
                icon={<Activity className="w-4 h-4 text-primary" />}
                title="Whoop"
                isOpen={openSection === 'whoop'}
                onToggle={() => toggleSection('whoop')}
              >
                <WhoopWidget />
              </AccordionSection>

              {/* Buy package */}
              <div className="border border-border/30 rounded-xl p-3.5 mt-2">
                <p className="text-xs font-extrabold text-foreground uppercase tracking-wider mb-2">
                  {lang === 'en' ? 'Buy a Package' : 'Купить пакет'}
                </p>
                <div className="space-y-1.5">
                  {[
                    { id: 'consultation', label: { en: 'Consultation (1h)', ru: 'Консультация (1 час)' }, price: 50 },
                    { id: 'single', label: { en: 'Single Session', ru: 'Разовая тренировка' }, price: 100 },
                    { id: 'pack8', label: { en: '8 sessions', ru: '8 занятий' }, price: 750 },
                    { id: 'pack12', label: { en: '12 sessions', ru: '12 занятий' }, price: 1030 },
                    { id: 'pack20', label: { en: '20 sessions', ru: '20 занятий' }, price: 1599 },
                  ].map((p) => (
                    <a
                      key={p.id}
                      href="https://revolut.me/illarion"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between bg-secondary/20 rounded-lg p-2.5 hover:bg-secondary/40 transition-colors"
                    >
                      <span className="text-xs font-bold">{p.label[lang]}</span>
                      <span className="text-xs font-extrabold text-primary">{p.price}€</span>
                    </a>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground/60 mt-2 text-center">
                  {lang === 'en'
                    ? 'Payment via Revolut. Gym membership 150€/month paid separately.'
                    : 'Оплата через Revolut. Абонемент зала 150€/мес оплачивается отдельно.'}
                </p>
              </div>
            </div>

            {/* Change password + Sign out */}
            <div className="p-5 pt-2 border-t border-border/50 space-y-2">
              {!showChangePwd ? (
                <button
                  onClick={() => setShowChangePwd(true)}
                  className="w-full flex items-center justify-center gap-2 text-xs font-semibold text-muted-foreground py-2.5 rounded-xl hover:bg-secondary/40 hover:text-foreground transition-colors"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  {lang === 'en' ? 'Change password' : 'Сменить пароль'}
                </button>
              ) : (
                <div className="space-y-2 p-3 bg-secondary/20 rounded-xl border border-border/30">
                  <p className="text-xs font-semibold">{lang === 'en' ? 'New password' : 'Новый пароль'}</p>
                  <div className="relative">
                    <input
                      type={pwdVisible ? 'text' : 'password'}
                      value={newPwd}
                      onChange={(e) => setNewPwd(e.target.value)}
                      placeholder={lang === 'en' ? 'Min 8 characters' : 'Минимум 8 символов'}
                      className="w-full bg-background border border-border/50 rounded-lg px-3 py-2 pr-9 text-sm focus:outline-none focus:border-primary"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setPwdVisible(v => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {pwdVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <input
                    type={pwdVisible ? 'text' : 'password'}
                    value={newPwd2}
                    onChange={(e) => setNewPwd2(e.target.value)}
                    placeholder={lang === 'en' ? 'Repeat password' : 'Повторите пароль'}
                    className="w-full bg-background border border-border/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                    autoComplete="new-password"
                  />
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => { setShowChangePwd(false); setNewPwd(''); setNewPwd2(''); }}
                      disabled={pwdSaving}
                      className="flex-1 text-xs font-semibold py-2 rounded-lg border border-border/50 hover:bg-secondary/40 transition-colors disabled:opacity-50"
                    >
                      {lang === 'en' ? 'Cancel' : 'Отмена'}
                    </button>
                    <button
                      onClick={handleChangePassword}
                      disabled={pwdSaving || newPwd.length < 8 || newPwd !== newPwd2}
                      className="flex-1 text-xs font-bold py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                    >
                      {pwdSaving && <Loader2 className="w-3 h-3 animate-spin" />}
                      {lang === 'en' ? 'Save' : 'Сохранить'}
                    </button>
                  </div>
                </div>
              )}
              <button
                onClick={async () => { await signOut(); onClose(); }}
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

    <BodyMeasurementsDetail
      open={measurementsOpen}
      onClose={() => setMeasurementsOpen(false)}
      measurements={measurements}
      lang={lang}
    />
    </>
  );
};

export default ClientProfileDrawer;
