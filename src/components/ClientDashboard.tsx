import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CalendarDays, Activity, LogOut, Ruler, ClipboardCheck, Camera,
  History, ChevronRight, ChevronDown, RotateCw, XCircle, Loader2,
  Upload, User, TrendingUp, TrendingDown, Minus, Dumbbell, Phone,
  KeyRound, Eye, EyeOff, ShoppingCart,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { computeNutritionTotals } from '@/lib/nutritionTotals';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import BodyMeasurementsDetail from './BodyMeasurementsDetail';
import ClientTestHistory from './ClientTestHistory';
import BookingModal from './BookingModal';
import NutritionDiary from './NutritionDiary';
import LanguageSwitch from './LanguageSwitch';
import { UtensilsCrossed, ArrowRight } from 'lucide-react';
import AchievementsWidget from './AchievementsWidget';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import AvatarTierBadge, { highestTierFromKeys, tierRingClass, type Tier } from './AvatarTierBadge';
import SessionLedgerHistory from './SessionLedgerHistory';

/* ──────────────────────── Sparkline ──────────────────────── */
const Sparkline = ({ data, color = 'hsl(var(--primary))', height = 28, width = 80 }: { data: number[]; color?: string; height?: number; width?: number }) => {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" points={points} />
      {/* Dot on last point */}
      <circle cx={(data.length - 1) / (data.length - 1) * width} cy={height - ((data[data.length - 1] - min) / range) * (height - 4) - 2} r="2.5" fill={color} />
    </svg>
  );
};

/* ──────────────────────── History grouped by month ──────────────────────── */
const HistoryByMonth = ({
  sessions,
  lang,
}: {
  sessions: Array<{ id: string; session_date: string; session_time: string | null }>;
  lang: 'en' | 'ru';
}) => {
  const groups = useMemo(() => {
    const map = new Map<string, typeof sessions>();
    for (const s of sessions) {
      const key = s.session_date.slice(0, 7); // YYYY-MM
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [sessions]);

  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    groups[0] ? { [groups[0][0]]: true } : {}
  );

  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Dumbbell className="w-10 h-10 text-muted-foreground/30 mb-3" />
        <p className="text-sm text-muted-foreground">
          {lang === 'en' ? 'No completed sessions yet' : 'Пока нет завершённых тренировок'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {groups.map(([monthKey, items]) => {
        const isOpen = !!open[monthKey];
        const monthLabel = new Date(monthKey + '-01T12:00:00').toLocaleDateString(
          lang === 'en' ? 'en-US' : 'ru-RU',
          { month: 'long', year: 'numeric' }
        );
        return (
          <div key={monthKey} className="bg-card border border-border/30 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setOpen(prev => ({ ...prev, [monthKey]: !prev[monthKey] }))}
              className="w-full flex items-center gap-3 p-3.5 hover:bg-muted/30 transition-colors"
            >
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <CalendarDays className="w-3.5 h-3.5 text-primary/60" />
              </div>
              <div className="flex-1 text-left">
                <div className="text-sm font-medium text-foreground capitalize">{monthLabel}</div>
                <div className="text-xs text-muted-foreground">
                  {items.length} {lang === 'en' ? 'sessions' : 'тренировок'}
                </div>
              </div>
              <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
              <div className="border-t border-border/30 p-2 space-y-1.5">
                {items.map(s => (
                  <div key={s.id} className="flex items-center gap-3 px-2 py-2 rounded-lg">
                    <span className="text-xs text-primary/50 w-4">✓</span>
                    <span className="text-sm text-foreground flex-1">
                      {new Date(s.session_date + 'T12:00:00').toLocaleDateString(
                        lang === 'en' ? 'en-US' : 'ru-RU',
                        { day: 'numeric', month: 'long', weekday: 'short' }
                      )}
                      {s.session_time ? ` · ${s.session_time.slice(0, 5)}` : ''}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

interface ScheduledSession {
  id: string;
  session_date: string;
  session_time: string | null;
  is_recurring: boolean;
  recurrence_day: number | null;
  recurrence_time: string | null;
  is_deducted: boolean;
}

interface ClientPackage {
  id: string;
  package_name: string;
  total_sessions: number;
  used_sessions: number;
  is_active: boolean;
  expires_at: string | null;
}

const DAY_NAMES_RU = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const DAY_NAMES_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/* ──────────────────────── Module Card ──────────────────────── */
interface ModuleCardProps {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  preview?: React.ReactNode;
  onClick: () => void;
  accentColor?: string;
  badge?: string | number;
}

const ModuleCard = ({ icon, title, subtitle, preview, onClick, accentColor, badge }: ModuleCardProps) => (
  <motion.button
    onClick={onClick}
    whileTap={{ scale: 0.97 }}
    className="w-full bg-card border border-border/40 rounded-2xl p-4 text-left hover:border-primary/30 transition-all group"
  >
    <div className="flex items-start justify-between mb-2">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${accentColor || 'bg-primary/15'}`}>
        {icon}
      </div>
      {badge != null && (
        <span className="text-[10px] bg-primary/15 text-primary px-2 py-0.5 rounded-full font-bold">{badge}</span>
      )}
    </div>
    <h3 className="text-[13px] font-bold text-foreground leading-tight">{title}</h3>
    {subtitle && <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>}
    {preview && <div className="mt-2">{preview}</div>}
    <div className="flex items-center gap-1 mt-2 text-[10px] text-primary/70 font-semibold group-hover:text-primary transition-colors">
      <ChevronRight className="w-3 h-3" />
    </div>
  </motion.button>
);

/* ──────────────────────── Fullscreen Module ──────────────────────── */
interface FullscreenModuleProps {
  open: boolean;
  onClose: () => void;
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}

const FullscreenModule = ({ open, onClose, title, icon, children }: FullscreenModuleProps) => (
  <AnimatePresence>
    {open && (
      <motion.div
        initial={{ opacity: 0, y: '100%' }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="fixed inset-0 z-50 bg-background overflow-y-auto"
      >
        <div className="sticky top-0 z-10 bg-background/90 backdrop-blur-md border-b border-border/30">
          <div className="flex items-center gap-3 px-5 py-4" style={{ paddingTop: 'max(env(safe-area-inset-top, 16px), 16px)' }}>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
              <ChevronRight className="w-5 h-5 rotate-180" />
            </button>
            {icon}
            <h2 className="text-base font-bold text-foreground flex-1 truncate">{title}</h2>
            <LanguageSwitch />
          </div>
        </div>

        <div className="px-5 py-4 pb-32">
          {children}
        </div>
      </motion.div>
    )}
  </AnimatePresence>
);

/* ──────────────────────── Main Dashboard ──────────────────────── */
interface ClientDashboardProps {
  forceClientView?: boolean;
  onNavigate?: (section: string) => void;
}

const ClientDashboard = ({ forceClientView = false, onNavigate }: ClientDashboardProps) => {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const { lang } = useLanguage();
  const { toast } = useToast();

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [calorieGoal, setCalorieGoal] = useState<number | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [tier, setTier] = useState<Tier>(null);
  const [pkg, setPkg] = useState<ClientPackage | null>(null);
  const [sessions, setSessions] = useState<ScheduledSession[]>([]);
  const [pastSessions, setPastSessions] = useState<ScheduledSession[]>([]);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);
  const [measurements, setMeasurements] = useState<any[]>([]);
  const [testResults, setTestResults] = useState<{ overall_percentage: number; created_at: string; test_type?: string | null }[]>([]);
  const [todayKcal, setTodayKcal] = useState<number>(0);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [bookingStep, setBookingStep] = useState<'date' | 'my-sessions'>('my-sessions');

  // Fullscreen module states
  const [measurementsOpen, setMeasurementsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [testsOpen, setTestsOpen] = useState(false);
  const [testsInitial, setTestsInitial] = useState<null | 'baseline' | 'progress_2m'>(null);
  const [nutritionOpen, setNutritionOpen] = useState(false);
  const [showAllSessions, setShowAllSessions] = useState(false);
  const [balanceExpanded, setBalanceExpanded] = useState(false);

  // Account actions
  const [showChangePwd, setShowChangePwd] = useState(false);
  const [newPwd, setNewPwd] = useState('');
  const [newPwd2, setNewPwd2] = useState('');
  const [pwdVisible, setPwdVisible] = useState(false);
  const [pwdSaving, setPwdSaving] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);

  // Personal data (synced with body measurements form — same profiles fields)
  const [showMyData, setShowMyData] = useState(false);
  const [myHeight, setMyHeight] = useState('');
  const [myBirth, setMyBirth] = useState('');
  const [myGender, setMyGender] = useState('');
  const [myDataSaving, setMyDataSaving] = useState(false);

  const loadMyData = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('profiles').select('height_cm, birth_date, gender').eq('user_id', user.id).maybeSingle();
    setMyHeight((data as any)?.height_cm ? String((data as any).height_cm) : '');
    setMyBirth((data as any)?.birth_date || '');
    setMyGender((data as any)?.gender || '');
  };

  const myAge = useMemo(() => {
    if (!myBirth) return null;
    const b = new Date(`${myBirth}T12:00:00`);
    if (isNaN(b.getTime())) return null;
    const now = new Date();
    let a = now.getFullYear() - b.getFullYear();
    const m = now.getMonth() - b.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < b.getDate())) a--;
    return a >= 0 && a < 120 ? a : null;
  }, [myBirth]);

  const handleSaveMyData = async () => {
    if (!user) return;
    const h = myHeight ? Math.round(parseFloat(myHeight)) : null;
    if (h != null && (isNaN(h) || h < 100 || h > 250)) {
      toast({ title: lang === 'en' ? 'Height must be 100–250 cm' : 'Рост должен быть 100–250 см', variant: 'destructive' });
      return;
    }
    setMyDataSaving(true);
    try {
      const { error } = await supabase.from('profiles')
        .update({ height_cm: h, birth_date: myBirth || null, gender: myGender || null })
        .eq('user_id', user.id);
      if (error) throw error;
      await refreshProfile();
      toast({ title: lang === 'en' ? 'Saved' : 'Сохранено' });
      setShowMyData(false);
    } catch (e: any) {
      toast({ title: lang === 'en' ? 'Failed to save' : 'Не удалось сохранить', description: e?.message, variant: 'destructive' });
    } finally {
      setMyDataSaving(false);
    }
  };

  // Two-way sync: re-read profile data after the measurements module closes
  useEffect(() => {
    if (!measurementsOpen) loadMyData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measurementsOpen]);



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

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dayNames = lang === 'en' ? DAY_NAMES_EN : DAY_NAMES_RU;

  // ─── Data loading ───
  useEffect(() => {
    if (!user) return;

    const loadAvatar = async () => {
      const { data } = await supabase.from('profiles').select('avatar_url, daily_calorie_goal, height_cm, birth_date, gender').eq('user_id', user.id).maybeSingle();
      setAvatarUrl(data?.avatar_url || null);
      setCalorieGoal((data as any)?.daily_calorie_goal || null);
      setMyHeight((data as any)?.height_cm ? String((data as any).height_cm) : '');
      setMyBirth((data as any)?.birth_date || '');
      setMyGender((data as any)?.gender || '');
    };

    const fetchPkg = async () => {
      const { data: active } = await supabase
        .from('client_packages').select('*').eq('user_id', user.id).eq('is_active', true)
        .order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (active) { setPkg(active); return; }
      const { data: latest } = await supabase
        .from('client_packages').select('*').eq('user_id', user.id)
        .order('created_at', { ascending: false }).limit(1).maybeSingle();
      setPkg(latest);
    };

    const fetchSessions = async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data } = await supabase
        .from('scheduled_sessions').select('*').eq('user_id', user.id)
        .or(`is_recurring.eq.true,session_date.gte.${today}`)
        .eq('is_deducted', false).order('session_date', { ascending: true });
      setSessions((data as ScheduledSession[]) || []);
    };

    const fetchPast = async () => {
      // Pull from session_ledger so the full history is visible — scheduled_sessions
      // only stores the latest occurrence for recurring templates.
      const { data: ledger } = await supabase
        .from('session_ledger')
        .select('id, session_id, delta, reason, created_at')
        .eq('user_id', user.id)
        .gt('delta', 0)
        .order('created_at', { ascending: false })
        .limit(500);

      const items = (ledger || []).map((row: any) => {
        // Cron runs just after midnight Cyprus, so the Cyprus date of created_at
        // is the actual training day.
        const dateStr = new Date(row.created_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Nicosia' });
        return {
          id: row.id,
          session_id: row.session_id,
          session_date: dateStr,
          session_time: null,
          reason: row.reason,
        } as any;
      });
      setPastSessions(items);
    };

    const fetchMeasurements = async () => {
      const { data } = await supabase
        .from('body_measurements').select('*').eq('user_id', user.id)
        .order('measured_at', { ascending: false }).limit(50);
      setMeasurements(data || []);
    };

    const fetchTests = async () => {
      const { data } = await supabase
        .from('test_results').select('overall_percentage, created_at, test_type').eq('user_id', user.id)
        .order('created_at', { ascending: true }).limit(20);
      setTestResults((data || []) as any);
    };


    const fetchTodayKcal = async () => {
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Nicosia' });
      const { data } = await supabase
        .from('nutrition_logs').select('ai_analysis, manual_entries')
        .eq('user_id', user.id).eq('log_date', today).maybeSingle();
      setTodayKcal(computeNutritionTotals(data).calories);
    };

    const fetchTier = async () => {
      const { data } = await supabase
        .from('client_achievements').select('achievement_key')
        .eq('user_id', user.id)
        .like('achievement_key', 'nutrition_quality_week_%');
      setTier(highestTierFromKeys((data || []).map((r: any) => r.achievement_key)));
    };

    loadAvatar(); fetchPkg(); fetchSessions(); fetchPast(); fetchMeasurements(); fetchTests();
    fetchTodayKcal(); fetchTier();

    const channel = supabase
      .channel('dashboard-sessions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scheduled_sessions', filter: `user_id=eq.${user.id}` }, () => { fetchSessions(); fetchPast(); fetchPkg(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'session_ledger', filter: `user_id=eq.${user.id}` }, () => { fetchPast(); fetchPkg(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'client_packages', filter: `user_id=eq.${user.id}` }, fetchPkg)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'nutrition_logs', filter: `user_id=eq.${user.id}` }, fetchTodayKcal)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'food_photos', filter: `user_id=eq.${user.id}` }, fetchTodayKcal)
      .subscribe();



    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // ─── Avatar upload ───
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: lang === 'en' ? 'File too large (max 5MB)' : 'Файл слишком большой (макс. 5МБ)', variant: 'destructive' });
      return;
    }
    setUploadingAvatar(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${user.id}/avatar.${ext}`;
      const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
      const urlWithBust = `${publicUrl}?t=${Date.now()}`;
      await supabase.from('profiles').update({ avatar_url: urlWithBust }).eq('user_id', user.id);
      setAvatarUrl(urlWithBust);
      await refreshProfile();
      toast({ title: lang === 'en' ? 'Photo updated!' : 'Фото обновлено!' });
    } catch (e: any) {
      toast({ title: lang === 'en' ? 'Upload failed' : 'Ошибка загрузки', description: e.message, variant: 'destructive' });
    }
    setUploadingAvatar(false);
  };

  // ─── Cancel session ───
  const canCancel = (s: ScheduledSession) => {
    if (s.is_recurring) return true;
    if (!s.session_time) return true;
    const sessionDateTime = new Date(`${s.session_date}T${s.session_time}`);
    return (sessionDateTime.getTime() - Date.now()) / (1000 * 60 * 60) > 24;
  };

  const handleCancel = async (session: ScheduledSession) => {
    if (!canCancel(session)) {
      toast({ title: lang === 'en' ? 'Cannot cancel' : 'Отмена невозможна', description: lang === 'en' ? 'Sessions can only be cancelled 24h+ in advance.' : 'Отмена возможна только за 24 часа до тренировки.', variant: 'destructive' });
      return;
    }
    setCancellingId(session.id);
    try {
      const { data, error } = await supabase.functions.invoke('book-session', { body: { action: 'cancel', session_id: session.id } });
      if (error || data?.error) {
        toast({ title: lang === 'en' ? 'Error' : 'Ошибка', description: data?.error || error?.message, variant: 'destructive' });
      } else {
        setSessions(prev => prev.filter(s => s.id !== session.id));
        toast({ title: lang === 'en' ? 'Session cancelled — balance restored' : 'Тренировка отменена — занятие возвращено' });
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
    setCancellingId(null);
  };

  const getInitials = () => {
    const name = profile?.full_name || '';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase() || '?';
  };

  // Weight sparkline data + trend
  const weightSparkData = useMemo(() => {
    const sorted = [...measurements].filter(m => m.weight_kg).sort((a, b) => new Date(a.measured_at).getTime() - new Date(b.measured_at).getTime());
    return sorted.map(m => Number(m.weight_kg));
  }, [measurements]);

  const weightTrend = useMemo(() => {
    if (weightSparkData.length < 2) return null;
    const first = weightSparkData[0];
    const last = weightSparkData[weightSparkData.length - 1];
    const diff = last - first;
    return { current: last, diff: Math.round(diff * 10) / 10 };
  }, [weightSparkData]);

  // Test sparkline data
  const testSparkData = useMemo(() => testResults.map(t => t.overall_percentage), [testResults]);
  const lastTestPct = testSparkData.length > 0 ? testSparkData[testSparkData.length - 1] : null;

  // Sessions completed this month
  const monthSessionsCount = useMemo(() => {
    const now = new Date();
    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return pastSessions.filter(s => s.session_date?.startsWith(monthStr)).length;
  }, [pastSessions]);

  // Nutrition progress
  const kcalPct = calorieGoal && calorieGoal > 0 ? Math.min(Math.round((todayKcal / calorieGoal) * 100), 100) : 0;
  const kcalOver = calorieGoal != null && todayKcal > calorieGoal;

  if (!user) return null;

  const remaining = pkg ? pkg.total_sessions - pkg.used_sessions : 0;
  const total = pkg?.total_sessions || 0;
  const pct = total > 0 ? Math.round((remaining / total) * 100) : 0;
  const low = remaining <= 2;
  const exhausted = remaining <= 0 && !!pkg;

  const formatSessionDate = (s: ScheduledSession) => {
    if (s.is_recurring) {
      return `${lang === 'en' ? 'Every' : 'Кажд.'} ${dayNames[s.recurrence_day!]}${s.recurrence_time ? ` · ${s.recurrence_time.slice(0, 5)}` : ''}`;
    }
    const d = new Date(s.session_date + 'T00:00:00');
    const dateStr = d.toLocaleDateString(lang === 'en' ? 'en-US' : 'ru-RU', { weekday: 'short', day: 'numeric', month: 'short' });
    return `${dateStr}${s.session_time ? ` · ${s.session_time.slice(0, 5)}` : ''}`;
  };

  return (
    <div className="min-h-screen bg-background pb-32">
      {/* ═══════════ Profile Header ═══════════ */}
      <div className="px-5 pt-4 pb-2">
        <div className="flex items-center gap-4">
          {/* Compact avatar */}
          <div className="relative shrink-0">
            {!avatarUrl && (
              <div className="absolute inset-0 rounded-full gradient-primary opacity-25 animate-ping" style={{ animationDuration: '2.5s' }} />
            )}
            <div
              onClick={() => fileInputRef.current?.click()}
              className={`relative w-16 h-16 rounded-full overflow-hidden cursor-pointer transition-transform hover:scale-105 active:scale-95 ${
                avatarUrl ? 'border-3 border-primary/30' : 'border-3 border-primary shadow-[0_0_0_3px_hsl(var(--primary)/0.2)]'
              }`}
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full gradient-primary flex items-center justify-center">
                  <span className="text-primary-foreground font-extrabold text-lg">{getInitials()}</span>
                </div>
              )}
            </div>
            <AvatarTierBadge tier={tier} size={26} />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingAvatar}
              className="absolute -bottom-0.5 -right-0.5 w-7 h-7 rounded-full bg-primary flex items-center justify-center shadow-md"
            >
              {uploadingAvatar ? <Loader2 className="w-3.5 h-3.5 text-primary-foreground animate-spin" /> : <Camera className="w-3.5 h-3.5 text-primary-foreground" />}
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
          </div>
          {/* Name + greeting */}
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">
              {lang === 'en' ? 'Welcome back' : 'С возвращением'} 👋
            </p>
            <h2 className="text-lg font-extrabold font-heading text-foreground truncate">{profile?.full_name}</h2>
          </div>
        </div>
      </div>


      <div className="px-5 space-y-4 mt-3">
        {/* ═══════════ Session Balance Card ═══════════ */}
        {pkg && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`relative overflow-hidden rounded-2xl ${
              exhausted ? 'bg-destructive/10 border border-destructive/30' : 'gradient-primary'
            }`}
          >
            {/* Decorative circles */}
            {!exhausted && (
              <>
                <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-white/10 pointer-events-none" />
                <div className="absolute -bottom-4 -left-4 w-16 h-16 rounded-full bg-white/5 pointer-events-none" />
              </>
            )}
            <button
              type="button"
              onClick={() => setBalanceExpanded(v => !v)}
              className="relative z-10 w-full text-left p-5 active:scale-[0.99] transition-transform"
            >
              <div className="flex items-center justify-between mb-3">
                <p className={`text-xs font-medium ${exhausted ? 'text-destructive' : 'text-primary-foreground/80'}`}>
                  {pkg.package_name}
                </p>
                <div className="flex items-center gap-2">
                  <Activity className={`w-5 h-5 ${exhausted ? 'text-destructive' : 'text-primary-foreground/60'}`} />
                  <motion.div animate={{ rotate: balanceExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
                    <ChevronDown className={`w-4 h-4 ${exhausted ? 'text-destructive' : 'text-primary-foreground/70'}`} />
                  </motion.div>
                </div>
              </div>
              <div className="flex items-baseline gap-1.5 mb-3">
                <span className={`text-3xl font-extrabold font-heading ${exhausted ? 'text-destructive' : 'text-primary-foreground'}`}>
                  {remaining}
                </span>
                <span className={`text-sm ${exhausted ? 'text-destructive/70' : 'text-primary-foreground/70'}`}>
                  / {total} {lang === 'en' ? 'sessions' : 'занятий'}
                </span>
              </div>
              {exhausted && (
                <p className="text-xs text-destructive font-semibold mb-2">
                  ⚠ {lang === 'en' ? 'Package exhausted' : 'Пакет исчерпан'}
                </p>
              )}
              <div className={`h-1.5 rounded-full overflow-hidden ${exhausted ? 'bg-destructive/20' : 'bg-white/20'}`}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.max(pct, 0)}%` }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                  className={`h-full rounded-full ${exhausted ? 'bg-destructive' : 'bg-white/90'}`}
                />
              </div>
              {/* Package expiry */}
              {pkg.expires_at && (() => {
                const daysLeft = Math.ceil((new Date(pkg.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                if (daysLeft <= 0) return (
                  <p className={`text-[10px] mt-2 font-medium ${exhausted ? 'text-destructive/80' : 'text-primary-foreground/60'}`}>
                    {lang === 'en' ? 'Expired' : 'Срок истёк'}
                  </p>
                );
                return (
                  <p className={`text-[10px] mt-2 font-medium ${exhausted ? 'text-destructive/60' : 'text-primary-foreground/50'}`}>
                    {lang === 'en'
                      ? `${daysLeft} day${daysLeft !== 1 ? 's' : ''} left`
                      : `${daysLeft} ${daysLeft === 1 ? 'день' : daysLeft < 5 ? 'дня' : 'дней'} осталось`}
                  </p>
                );
              })()}
            </button>

            {/* ═════ Expanded: history + buy more ═════ */}
            <AnimatePresence initial={false}>
              {balanceExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                  className="relative z-10 overflow-hidden"
                >
                  <div className={`px-5 pb-5 pt-1 border-t ${exhausted ? 'border-destructive/20' : 'border-white/15'}`}>
                    <p className={`text-[10px] font-bold uppercase tracking-wider mt-3 mb-2 ${exhausted ? 'text-destructive/70' : 'text-primary-foreground/70'}`}>
                      {lang === 'en' ? 'Recent sessions' : 'История тренировок'}
                    </p>
                    {pastSessions.length === 0 ? (
                      <p className={`text-xs ${exhausted ? 'text-destructive/60' : 'text-primary-foreground/60'}`}>
                        {lang === 'en' ? 'No completed sessions yet' : 'Пока нет завершённых тренировок'}
                      </p>
                    ) : (
                      <div className="space-y-1.5">
                        {pastSessions.slice(0, 5).map(s => (
                          <div
                            key={s.id}
                            className={`flex items-center gap-2 rounded-lg px-2.5 py-2 ${exhausted ? 'bg-destructive/10' : 'bg-white/10'}`}
                          >
                            <CalendarDays className={`w-3.5 h-3.5 shrink-0 ${exhausted ? 'text-destructive/70' : 'text-primary-foreground/70'}`} />
                            <span className={`text-xs font-medium flex-1 ${exhausted ? 'text-destructive' : 'text-primary-foreground'}`}>
                              {new Date(s.session_date + 'T00:00:00').toLocaleDateString(lang === 'en' ? 'en-US' : 'ru-RU', { day: 'numeric', month: 'short', weekday: 'short' })}
                              {s.session_time ? ` · ${s.session_time.slice(0, 5)}` : ''}
                            </span>
                            <span className={`text-[10px] ${exhausted ? 'text-destructive/60' : 'text-primary-foreground/60'}`}>✓</span>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setHistoryOpen(true); }}
                          className={`w-full text-[11px] font-semibold py-2 mt-1 rounded-lg border ${exhausted ? 'text-destructive border-destructive/30 hover:bg-destructive/10' : 'text-primary-foreground/90 border-white/20 hover:bg-white/10'}`}
                        >
                          {lang === 'en' ? `Show all history (${pastSessions.length})` : `Показать всю историю (${pastSessions.length})`}
                        </button>
                      </div>
                    )}

                    {onNavigate && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onNavigate('pricing'); }}
                        className={`mt-4 w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold transition-colors ${
                          exhausted
                            ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                            : 'bg-white text-primary hover:bg-white/90'
                        }`}
                      >
                        <ShoppingCart className="w-3.5 h-3.5" />
                        {lang === 'en' ? 'Buy more sessions' : 'Докупить тренировки'}
                      </button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* ═══════════ Upcoming Sessions ═══════════ */}
        {sessions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="space-y-2"
          >
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider px-1">
              {lang === 'en' ? 'Upcoming' : 'Ближайшие'}
            </p>
            {sessions.slice(0, showAllSessions ? sessions.length : 3).map((s, i) => (
              <motion.div
                key={s.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 + i * 0.05 }}
                className="flex items-center gap-3 bg-card/60 border border-border/30 rounded-xl px-4 py-3"
              >
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  {s.is_recurring
                    ? <RotateCw className="w-3.5 h-3.5 text-primary" />
                    : <Dumbbell className="w-3.5 h-3.5 text-primary" />
                  }
                </div>
                <span className="text-[13px] font-medium flex-1">{formatSessionDate(s)}</span>
                {canCancel(s) ? (
                  confirmCancelId === s.id ? (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); setConfirmCancelId(null); }}
                        className="h-7 px-2 rounded-lg bg-secondary/60 text-[10px] font-bold text-muted-foreground"
                      >
                        {lang === 'en' ? 'No' : 'Нет'}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setConfirmCancelId(null); handleCancel(s); }}
                        disabled={cancellingId === s.id}
                        className="h-7 px-2 rounded-lg bg-destructive text-[10px] font-bold text-destructive-foreground"
                      >
                        {cancellingId === s.id ? <Loader2 className="w-3 h-3 animate-spin" /> : (lang === 'en' ? 'Cancel' : 'Отменить')}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); setConfirmCancelId(s.id); }}
                      className="text-[11px] text-destructive/80 font-semibold bg-destructive/8 px-2.5 py-1 rounded-lg hover:bg-destructive/15 transition-colors"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                    </button>
                  )
                ) : (
                  <span className="text-[9px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">{'<24h'}</span>
                )}
              </motion.div>
            ))}
            {sessions.length > 3 && (
              <button
                onClick={() => setShowAllSessions(prev => !prev)}
                className="w-full text-xs text-primary font-semibold py-1.5 text-center hover:underline"
              >
                {showAllSessions
                  ? (lang === 'en' ? 'Show less' : 'Свернуть')
                  : `+${sessions.length - 3} ${lang === 'en' ? 'more' : 'ещё'}`}
              </button>
            )}
          </motion.div>
        )}

        {/* ═══════════ Book Session Button ═══════════ */}
        <motion.button
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => { setBookingStep('date'); setBookingOpen(true); }}
          className="w-full gradient-primary rounded-2xl py-4 px-6 flex items-center justify-center gap-2.5 glow-primary hover:scale-[1.01] transition-transform active:scale-[0.99]"
        >
          <CalendarDays className="w-5 h-5 text-primary-foreground" />
          <span className="text-base font-bold text-primary-foreground">
            {lang === 'en' ? 'Book a Session' : 'Забронировать занятие'}
          </span>
        </motion.button>


        {/* ═══════════ Test #1 banner (baseline not yet taken) ═══════════ */}
        {(() => {
          const hasBaseline = testResults.some(t => t.test_type === 'baseline' || !t.test_type);
          const dismissed = typeof window !== 'undefined' && localStorage.getItem('test1_banner_dismissed') === '1';
          if (hasBaseline || dismissed) return null;
          return (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative overflow-hidden rounded-2xl p-4 mb-4 border border-primary/30 bg-gradient-to-br from-primary/15 via-card to-card"
            >
              <button
                onClick={() => { localStorage.setItem('test1_banner_dismissed', '1'); setTestResults(t => [...t]); }}
                aria-label="dismiss"
                className="absolute top-2 right-2 w-6 h-6 rounded-full bg-background/60 text-muted-foreground hover:text-foreground flex items-center justify-center text-xs"
              >
                ×
              </button>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center glow-primary shrink-0">
                  <ClipboardCheck className="w-5 h-5 text-primary-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-primary uppercase tracking-wider mb-0.5">
                    {lang === 'en' ? 'Test #1 · Baseline' : 'Тест №1 · Старт'}
                  </p>
                  <p className="text-sm font-extrabold mb-1">
                    {lang === 'en' ? 'Take the baseline test to set your starting point' : 'Пройдите стартовый тест, чтобы зафиксировать точку отсчёта'}
                  </p>
                  <p className="text-[11px] text-muted-foreground mb-3">
                    {lang === 'en' ? '16 questions · 3 minutes' : '16 вопросов · 3 минуты'}
                  </p>
                  <button
                    onClick={() => { setTestsInitial('baseline'); setTestsOpen(true); }}
                    className="inline-flex items-center gap-1.5 gradient-primary text-primary-foreground font-bold text-xs px-4 py-2 rounded-lg glow-primary hover:scale-[1.03] transition-transform"
                  >
                    {lang === 'en' ? 'Take Test #1' : 'Пройти тест №1'}
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </motion.div>
          );
        })()}

        {/* ═══════════ Test #2 banner (60+ days, no progress test yet) ═══════════ */}
        {(() => {
          const createdAt = user?.created_at ? new Date(user.created_at) : null;
          const daysSinceSignup = createdAt ? (Date.now() - createdAt.getTime()) / 86400000 : 0;
          const hasProgress2m = testResults.some(t => t.test_type === 'progress_2m');
          const hasBaseline = testResults.some(t => t.test_type === 'baseline' || !t.test_type);
          const dismissed = typeof window !== 'undefined' && localStorage.getItem('test2_banner_dismissed') === '1';
          if (!hasBaseline || daysSinceSignup < 60 || hasProgress2m || dismissed) return null;
          return (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative overflow-hidden rounded-2xl p-4 mb-4 border border-primary/30 bg-gradient-to-br from-primary/15 via-card to-card"
            >
              <button
                onClick={() => { localStorage.setItem('test2_banner_dismissed', '1'); setTestResults(t => [...t]); }}
                aria-label="dismiss"
                className="absolute top-2 right-2 w-6 h-6 rounded-full bg-background/60 text-muted-foreground hover:text-foreground flex items-center justify-center text-xs"
              >
                ×
              </button>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center glow-primary shrink-0">
                  <ClipboardCheck className="w-5 h-5 text-primary-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-primary uppercase tracking-wider mb-0.5">
                    {lang === 'en' ? 'Test #2 · Progress check' : 'Тест №2 · Проверка прогресса'}
                  </p>
                  <p className="text-sm font-extrabold mb-1">
                    {lang === 'en' ? 'Time to measure your 2-month results' : 'Пора измерить результаты за 2 месяца'}
                  </p>
                  <p className="text-[11px] text-muted-foreground mb-3">
                    {lang === 'en' ? '10 questions · 2 minutes' : '10 вопросов · 2 минуты'}
                  </p>
                  <button
                    onClick={() => { setTestsInitial('progress_2m'); setTestsOpen(true); }}
                    className="inline-flex items-center gap-1.5 gradient-primary text-primary-foreground font-bold text-xs px-4 py-2 rounded-lg glow-primary hover:scale-[1.03] transition-transform"
                  >
                    {lang === 'en' ? 'Take Test #2' : 'Пройти тест №2'}
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </motion.div>
          );
        })()}

        {/* ═══════════ Modules Grid ═══════════ */}

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider px-1 mb-3">
            {lang === 'en' ? 'My Progress' : 'Мой прогресс'}
          </p>
          <div className="grid grid-cols-2 gap-3">
            {/* ═════ Nutrition — HERO BENTO (full width) ═════ */}
            <motion.button
              onClick={() => setNutritionOpen(true)}
              whileTap={{ scale: 0.98 }}
              className="col-span-2 relative overflow-hidden bg-gradient-to-br from-orange-500/15 via-card to-card border border-orange-500/25 rounded-2xl p-4 text-left hover:border-orange-500/50 transition-all group"
            >
              <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-orange-500/10 blur-2xl" />
              <div className="relative flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-orange-500/20 flex items-center justify-center shrink-0">
                  <UtensilsCrossed className="w-5 h-5 text-orange-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold text-orange-400/80 uppercase tracking-wider">
                    {lang === 'en' ? 'Today' : 'Сегодня'}
                  </p>
                  <div className="flex items-baseline gap-1.5 mt-0.5">
                    <span className={`text-2xl font-extrabold font-heading ${kcalOver ? 'text-destructive' : 'text-foreground'}`}>
                      {todayKcal}
                    </span>
                    {calorieGoal ? (
                      <span className="text-xs text-muted-foreground">/ {calorieGoal} {lang === 'en' ? 'kcal' : 'ккал'}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">{lang === 'en' ? 'kcal' : 'ккал'}</span>
                    )}
                  </div>
                  {calorieGoal ? (
                    <div className="mt-2 h-1.5 rounded-full bg-secondary/60 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${kcalPct}%` }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                        className={`h-full rounded-full ${kcalOver ? 'bg-destructive' : 'bg-orange-400'}`}
                      />
                    </div>
                  ) : (
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {lang === 'en' ? 'Tap to log meal' : 'Откройте, чтобы добавить'}
                    </p>
                  )}
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground/50 shrink-0" />
              </div>
            </motion.button>

            {/* ═════ Body Measurements ═════ */}
            <ModuleCard
              icon={<Ruler className="w-4.5 h-4.5 text-primary" />}
              title={lang === 'en' ? 'Body' : 'Замеры'}
              subtitle={measurements.length === 0
                ? (lang === 'en' ? 'Add first record' : 'Добавьте замер')
                : `${measurements.length} ${lang === 'en' ? 'records' : 'записей'}`}
              onClick={() => setMeasurementsOpen(true)}
              preview={weightSparkData.length >= 2 ? (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-lg font-extrabold font-heading text-foreground">{weightTrend!.current}</span>
                    <span className="text-[10px] text-muted-foreground">kg</span>
                    <span className={`text-[10px] font-bold flex items-center gap-0.5 ml-auto ${weightTrend!.diff < 0 ? 'text-green-400' : weightTrend!.diff > 0 ? 'text-orange-400' : 'text-muted-foreground'}`}>
                      {weightTrend!.diff > 0 ? <TrendingUp className="w-3 h-3" /> : weightTrend!.diff < 0 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                      {weightTrend!.diff > 0 ? '+' : ''}{weightTrend!.diff}
                    </span>
                  </div>
                  <Sparkline data={weightSparkData} />
                </div>
              ) : undefined}
            />

            {/* ═════ Health Tests ═════ */}
            <ModuleCard
              icon={<ClipboardCheck className="w-4.5 h-4.5 text-primary" />}
              title={lang === 'en' ? 'Tests' : 'Тесты'}
              subtitle={lastTestPct == null
                ? (lang === 'en' ? 'Take first test' : 'Пройдите тест')
                : `${testResults.length} ${lang === 'en' ? 'taken' : 'пройдено'}`}
              onClick={() => { setTestsInitial(null); setTestsOpen(true); }}
              preview={testSparkData.length >= 1 ? (
                <div className="space-y-1.5">
                  <div className="flex items-baseline gap-1">
                    <span className="text-lg font-extrabold font-heading text-foreground">{lastTestPct}</span>
                    <span className="text-[10px] text-muted-foreground">%</span>
                    {testSparkData.length >= 2 && (
                      <span className={`text-[10px] font-bold ml-auto ${testSparkData[testSparkData.length - 1] >= testSparkData[testSparkData.length - 2] ? 'text-green-400' : 'text-orange-400'}`}>
                        {testSparkData[testSparkData.length - 1] >= testSparkData[testSparkData.length - 2] ? <TrendingUp className="w-3 h-3 inline" /> : <TrendingDown className="w-3 h-3 inline" />}
                      </span>
                    )}
                  </div>
                  {testSparkData.length >= 2 && <Sparkline data={testSparkData} color="hsl(142, 71%, 45%)" />}
                </div>
              ) : undefined}
            />

            {/* Photos and History moved out of modules grid — history lives inside the balance card */}

          </div>
        </motion.div>

        {/* ═══════════ Achievements (collapsible) ═══════════ */}
        <Collapsible defaultOpen={false}>
          <CollapsibleTrigger className="w-full">
            <div className="flex items-center justify-between px-1 py-2">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                {lang === 'en' ? 'Achievements' : 'Достижения'}
              </span>
              <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform data-[state=open]:rotate-180" />
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <AchievementsWidget userId={user.id} isTrainer={forceClientView} />
          </CollapsibleContent>
        </Collapsible>

        {/* ═══════════ Contact Trainer ═══════════ */}
        <div className="flex items-center justify-center gap-2 mt-4">
          <span className="text-[11px] text-muted-foreground">{lang === 'en' ? 'Contact trainer' : 'Написать тренеру'}:</span>
          <a href="https://wa.me/35795144819" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors no-underline">
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-[hsl(142,70%,45%)]"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            <span className="text-[11px] font-medium">WhatsApp</span>
          </a>
          <span className="text-muted-foreground/30">·</span>
          <a href="https://t.me/+35795144819" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors no-underline">
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-[hsl(200,80%,50%)]"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
            <span className="text-[11px] font-medium">Telegram</span>
          </a>
        </div>

        {/* ═══════════ Account ═══════════ */}
        <div className="mt-4 border-t border-border/30 pt-4 space-y-2">
          {/* ── My data (synced with measurements) ── */}
          <button
            onClick={() => setShowMyData(v => !v)}
            className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border border-border/50 hover:bg-secondary/40 transition-colors"
          >
            <span className="flex items-center gap-2 text-xs font-bold">
              <Ruler className="w-3.5 h-3.5 text-primary" />
              {lang === 'en' ? 'My data' : 'Мои данные'}
            </span>
            <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
              {myHeight ? `${myHeight} ${lang === 'en' ? 'cm' : 'см'}` : '—'}
              {myAge != null && ` · ${myAge} ${lang === 'en' ? 'y.o.' : 'лет'}`}
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showMyData ? 'rotate-180' : ''}`} />
            </span>
          </button>

          <AnimatePresence initial={false}>
            {showMyData && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="p-3 space-y-2.5 bg-secondary/20 rounded-xl border border-border/30">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] uppercase tracking-wide text-muted-foreground font-bold">
                        {lang === 'en' ? 'Height, cm' : 'Рост, см'}
                      </label>
                      <input
                        type="number" inputMode="numeric" value={myHeight}
                        onChange={(e) => setMyHeight(e.target.value)}
                        placeholder="175"
                        className="mt-1 w-full bg-background border border-border/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-wide text-muted-foreground font-bold">
                        {lang === 'en' ? 'Birth date' : 'Дата рождения'}
                      </label>
                      <input
                        type="date" value={myBirth}
                        onChange={(e) => setMyBirth(e.target.value)}
                        className="mt-1 w-full bg-background border border-border/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] uppercase tracking-wide text-muted-foreground font-bold">
                      {lang === 'en' ? 'Gender' : 'Пол'}
                    </label>
                    <div className="mt-1 grid grid-cols-2 gap-2">
                      {[
                        { v: 'male', en: 'Male', ru: 'Мужской' },
                        { v: 'female', en: 'Female', ru: 'Женский' },
                      ].map(g => (
                        <button
                          key={g.v}
                          onClick={() => setMyGender(myGender === g.v ? '' : g.v)}
                          className={`text-xs font-semibold py-2 rounded-lg border transition-colors ${
                            myGender === g.v
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'border-border/50 hover:bg-secondary/40'
                          }`}
                        >
                          {lang === 'en' ? g.en : g.ru}
                        </button>
                      ))}
                    </div>
                  </div>

                  {myAge != null && (
                    <p className="text-[11px] text-muted-foreground">
                      {lang === 'en' ? `Age: ${myAge}` : `Возраст: ${myAge}`}
                    </p>
                  )}
                  <p className="text-[10px] text-muted-foreground/80">
                    {lang === 'en'
                      ? 'Synced with your measurements — used for personal calorie, protein and water targets.'
                      : 'Синхронизировано с замерами — используется для персональных норм калорий, белка и воды.'}
                  </p>

                  <button
                    onClick={handleSaveMyData}
                    disabled={myDataSaving}
                    className="w-full text-xs font-bold py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    {myDataSaving && <Loader2 className="w-3 h-3 animate-spin" />}
                    {lang === 'en' ? 'Save' : 'Сохранить'}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence initial={false}>

            {showChangePwd && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="p-3 space-y-2 bg-secondary/20 rounded-xl border border-border/30">
                  <p className="text-xs font-bold flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-primary" />
                    {lang === 'en' ? 'New password' : 'Новый пароль'}
                  </p>
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
              </motion.div>
            )}
          </AnimatePresence>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setShowChangePwd(v => !v)}
              className="flex items-center justify-center gap-1.5 text-xs font-bold py-3 rounded-xl border border-border/50 hover:bg-secondary/40 transition-colors"
            >
              <KeyRound className="w-3.5 h-3.5" />
              {lang === 'en' ? 'Password' : 'Пароль'}
            </button>
            <button
              onClick={() => setConfirmSignOut(true)}
              className="flex items-center justify-center gap-1.5 text-xs font-bold text-destructive py-3 rounded-xl border border-destructive/30 hover:bg-destructive/10 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              {lang === 'en' ? 'Sign out' : 'Выйти'}
            </button>
          </div>
        </div>
      </div>

      {/* ═══════════ Sign-out confirmation ═══════════ */}
      <AnimatePresence>
        {confirmSignOut && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setConfirmSignOut(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card border border-border/50 rounded-2xl p-5 w-full max-w-xs shadow-2xl"
            >
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-9 h-9 rounded-xl bg-destructive/15 flex items-center justify-center">
                  <LogOut className="w-4 h-4 text-destructive" />
                </div>
                <p className="text-sm font-bold">
                  {lang === 'en' ? 'Sign out?' : 'Выйти из аккаунта?'}
                </p>
              </div>
              <p className="text-xs text-muted-foreground mb-4">
                {lang === 'en'
                  ? 'You will need to sign in again to access your profile.'
                  : 'Чтобы вернуться в кабинет, потребуется снова войти.'}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmSignOut(false)}
                  className="flex-1 text-xs font-semibold py-2.5 rounded-lg border border-border/50 hover:bg-secondary/40 transition-colors"
                >
                  {lang === 'en' ? 'Cancel' : 'Отмена'}
                </button>
                <button
                  onClick={async () => { setConfirmSignOut(false); await signOut(); }}
                  className="flex-1 text-xs font-bold py-2.5 rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
                >
                  {lang === 'en' ? 'Sign out' : 'Выйти'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════════ Fullscreen Modules ═══════════ */}
      {measurementsOpen && (
        <BodyMeasurementsDetail open={measurementsOpen} measurements={measurements} lang={lang} onClose={() => setMeasurementsOpen(false)} />
      )}

      <FullscreenModule
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        title={lang === 'en' ? 'Training History' : 'История тренировок'}
        icon={<History className="w-5 h-5 text-primary" />}
      >
        <HistoryByMonth sessions={pastSessions} lang={lang} />
        <div className="mt-6">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
            {lang === 'en' ? 'Deductions & refunds' : 'Списания и возвраты'}
          </p>
          <SessionLedgerHistory userId={user.id} lang={lang} />
        </div>

      </FullscreenModule>


      <FullscreenModule
        open={testsOpen}
        onClose={() => { setTestsOpen(false); setTestsInitial(null); }}
        title={lang === 'en' ? 'Health Tests' : 'Тесты здоровья'}
        icon={<ClipboardCheck className="w-5 h-5 text-primary" />}
      >
        <ClientTestHistory
          userId={user.id}
          lang={lang}
          initialTest={testsInitial}
          onAllDone={() => { setTestsOpen(false); setTestsInitial(null); }}
        />
      </FullscreenModule>


      <FullscreenModule
        open={nutritionOpen}
        onClose={() => setNutritionOpen(false)}
        title={lang === 'en' ? 'Nutrition Diary' : 'Дневник питания'}
        icon={<UtensilsCrossed className="w-5 h-5 text-orange-400" />}
      >
        <NutritionDiary lang={lang} calorieGoal={calorieGoal} />
      </FullscreenModule>

      {/* Booking Modal */}
      <BookingModal
        open={bookingOpen}
        onClose={() => {
          setBookingOpen(false);
          setBookingStep('date');
        }}
        initialStep={bookingStep}
        onBooked={() => {
          setBookingOpen(false);
          setBookingStep('date');
        }}
        forceClientView={forceClientView}
        restorePendingPayment
      />
    </div>
  );
};

export default ClientDashboard;
