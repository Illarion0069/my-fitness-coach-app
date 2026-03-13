import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CalendarDays, Activity, LogOut, Ruler, ClipboardCheck, Camera,
  History, ChevronRight, RotateCw, XCircle, Loader2,
  Upload, User, TrendingUp, TrendingDown, Minus, Dumbbell, Phone
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import WhoopWidget from './WhoopWidget';
import BodyMeasurementsDetail from './BodyMeasurementsDetail';
import ClientTestHistory from './ClientTestHistory';
import ClientProgressView from './ClientProgressView';
import BookingModal from './BookingModal';
import NutritionDiary from './NutritionDiary';
import { UtensilsCrossed } from 'lucide-react';

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
            <h2 className="text-base font-bold text-foreground">{title}</h2>
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
const ClientDashboard = () => {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const { lang } = useLanguage();
  const { toast } = useToast();

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [pkg, setPkg] = useState<ClientPackage | null>(null);
  const [sessions, setSessions] = useState<ScheduledSession[]>([]);
  const [pastSessions, setPastSessions] = useState<ScheduledSession[]>([]);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [measurements, setMeasurements] = useState<any[]>([]);
  const [testResults, setTestResults] = useState<{ overall_percentage: number; created_at: string }[]>([]);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [bookingStep, setBookingStep] = useState<'date' | 'my-sessions'>('my-sessions');

  // Fullscreen module states
  const [measurementsOpen, setMeasurementsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [photosOpen, setPhotosOpen] = useState(false);
  const [testsOpen, setTestsOpen] = useState(false);
  const [whoopOpen, setWhoopOpen] = useState(false);
  const [nutritionOpen, setNutritionOpen] = useState(false);
  const [showAllSessions, setShowAllSessions] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dayNames = lang === 'en' ? DAY_NAMES_EN : DAY_NAMES_RU;

  // ─── Data loading ───
  useEffect(() => {
    if (!user) return;

    const loadAvatar = async () => {
      const { data } = await supabase.from('profiles').select('avatar_url').eq('user_id', user.id).maybeSingle();
      setAvatarUrl(data?.avatar_url || null);
    };

    const fetchPkg = async () => {
      const { data: active } = await supabase
        .from('client_packages').select('*').eq('user_id', user.id).eq('is_active', true)
        .order('created_at', { ascending: true }).limit(1).maybeSingle();
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
      const { data } = await supabase
        .from('scheduled_sessions').select('*').eq('user_id', user.id).eq('is_deducted', true)
        .order('session_date', { ascending: false }).limit(20);
      setPastSessions((data as ScheduledSession[]) || []);
    };

    const fetchMeasurements = async () => {
      const { data } = await supabase
        .from('body_measurements').select('*').eq('user_id', user.id)
        .order('measured_at', { ascending: false }).limit(50);
      setMeasurements(data || []);
    };

    const fetchTests = async () => {
      const { data } = await supabase
        .from('test_results').select('overall_percentage, created_at').eq('user_id', user.id)
        .order('created_at', { ascending: true }).limit(20);
      setTestResults(data || []);
    };

    loadAvatar(); fetchPkg(); fetchSessions(); fetchPast(); fetchMeasurements(); fetchTests();

    const channel = supabase
      .channel('dashboard-sessions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scheduled_sessions', filter: `user_id=eq.${user.id}` }, () => { fetchSessions(); fetchPkg(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'client_packages', filter: `user_id=eq.${user.id}` }, fetchPkg)
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

      <div className="px-5 space-y-4 mt-2">
        {/* ═══════════ Session Balance Card ═══════════ */}
        {pkg && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`relative overflow-hidden rounded-2xl p-5 ${
              exhausted ? 'bg-destructive/10 border border-destructive/30' : 'gradient-primary'
            }`}
          >
            {/* Decorative circles */}
            {!exhausted && (
              <>
                <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-white/10" />
                <div className="absolute -bottom-4 -left-4 w-16 h-16 rounded-full bg-white/5" />
              </>
            )}
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-3">
                <p className={`text-xs font-medium ${exhausted ? 'text-destructive' : 'text-primary-foreground/80'}`}>
                  {pkg.package_name}
                </p>
                <Activity className={`w-5 h-5 ${exhausted ? 'text-destructive' : 'text-primary-foreground/60'}`} />
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
            </div>
          </motion.div>
        )}

        {/* ═══════════ Schedule Button ═══════════ */}
        <motion.button
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => { setBookingStep('my-sessions'); setBookingOpen(true); }}
          className="w-full bg-card border border-border/40 rounded-2xl p-4 flex items-center gap-3 hover:border-primary/30 transition-all"
        >
          <div className="w-11 h-11 rounded-xl gradient-primary flex items-center justify-center shrink-0 glow-primary">
            <CalendarDays className="w-5 h-5 text-primary-foreground" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-bold text-foreground">{lang === 'en' ? 'My Schedule' : 'Моё расписание'}</p>
            <p className="text-[11px] text-muted-foreground">
              {sessions.length > 0
                ? (lang === 'en' ? `${sessions.length} upcoming` : `${sessions.length} запланировано`)
                : (lang === 'en' ? 'No sessions yet' : 'Нет записей')}
            </p>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </motion.button>


        {/* ═══════════ Upcoming Sessions ═══════════ */}
        {sessions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
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
                transition={{ delay: 0.2 + i * 0.05 }}
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
                  <button
                    onClick={() => handleCancel(s)}
                    disabled={cancellingId === s.id}
                    className="text-[11px] text-destructive/80 font-semibold bg-destructive/8 px-2.5 py-1 rounded-lg hover:bg-destructive/15 transition-colors"
                  >
                    {cancellingId === s.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                  </button>
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
            {/* Body Measurements */}
            <ModuleCard
              icon={<Ruler className="w-4.5 h-4.5 text-primary" />}
              title={lang === 'en' ? 'Body Progress' : 'Замеры тела'}
              subtitle={measurements.length > 0
                ? `${measurements.length} ${lang === 'en' ? 'records' : 'записей'}`
                : (lang === 'en' ? 'No data yet' : 'Нет данных')}
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

            {/* Training History */}
            <ModuleCard
              icon={<History className="w-4.5 h-4.5 text-primary" />}
              title={lang === 'en' ? 'History' : 'История'}
              subtitle={pastSessions.length > 0
                ? `${pastSessions.length} ${lang === 'en' ? 'sessions done' : 'тренировок'}`
                : (lang === 'en' ? 'No sessions yet' : 'Нет данных')}
              onClick={() => setHistoryOpen(true)}
              badge={pastSessions.length || undefined}
            />

            {/* Progress Photos */}
            <ModuleCard
              icon={<Camera className="w-4.5 h-4.5 text-primary" />}
              title={lang === 'en' ? 'Photos' : 'Фото'}
              subtitle={lang === 'en' ? 'Progress photos' : 'Фото прогресса'}
              onClick={() => setPhotosOpen(true)}
            />

            {/* Health Tests */}
            <ModuleCard
              icon={<ClipboardCheck className="w-4.5 h-4.5 text-primary" />}
              title={lang === 'en' ? 'Tests' : 'Тесты'}
              subtitle={lastTestPct != null
                ? `${lang === 'en' ? 'Last score' : 'Последний'}: ${lastTestPct}%`
                : (lang === 'en' ? 'Health assessment' : 'Оценка здоровья')}
              onClick={() => setTestsOpen(true)}
              preview={testSparkData.length >= 2 ? (
                <div className="space-y-1">
                  <div className="flex items-center gap-1">
                    <span className="text-lg font-extrabold font-heading text-foreground">{lastTestPct}%</span>
                    {testSparkData.length >= 2 && (
                      <span className={`text-[10px] font-bold ml-auto ${testSparkData[testSparkData.length - 1] >= testSparkData[testSparkData.length - 2] ? 'text-green-400' : 'text-orange-400'}`}>
                        {testSparkData[testSparkData.length - 1] >= testSparkData[testSparkData.length - 2] ? <TrendingUp className="w-3 h-3 inline" /> : <TrendingDown className="w-3 h-3 inline" />}
                      </span>
                    )}
                  </div>
                  <Sparkline data={testSparkData} color="hsl(142, 71%, 45%)" />


            {/* Nutrition Diary */}
            <ModuleCard
              icon={<UtensilsCrossed className="w-4.5 h-4.5 text-primary" />}
              title={lang === 'en' ? 'Nutrition' : 'Питание'}
              subtitle={lang === 'en' ? 'Food & drink log' : 'Еда и напитки'}
              onClick={() => setNutritionOpen(true)}
              accentColor="bg-orange-500/15"
            />
          </div>
              ) : undefined}
            />
          </div>

          {/* Whoop — full width */}
          <div className="mt-3">
            <ModuleCard
              icon={<Activity className="w-4.5 h-4.5 text-primary" />}
              title="Whoop"
              subtitle={lang === 'en' ? 'Recovery & strain tracking' : 'Восстановление и нагрузка'}
              onClick={() => setWhoopOpen(true)}
              accentColor="bg-green-500/15"
            />
          </div>
        </motion.div>

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

        {/* ═══════════ Sign Out ═══════════ */}
        <button
          onClick={signOut}
          className="w-full flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-destructive transition-colors py-4 mt-2"
        >
          <LogOut className="w-4 h-4" />
          {lang === 'en' ? 'Sign out' : 'Выйти'}
        </button>
      </div>

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
        {pastSessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Dumbbell className="w-10 h-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">{lang === 'en' ? 'No completed sessions yet' : 'Пока нет завершённых тренировок'}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {pastSessions.map(s => (
              <div key={s.id} className="flex items-center gap-3 bg-card border border-border/30 rounded-xl p-3.5">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <CalendarDays className="w-3.5 h-3.5 text-primary/60" />
                </div>
                <span className="text-sm text-foreground font-medium flex-1">
                  {new Date(s.session_date + 'T00:00:00').toLocaleDateString(lang === 'en' ? 'en-US' : 'ru-RU', { day: 'numeric', month: 'long', weekday: 'short' })}
                  {s.session_time ? ` · ${s.session_time.slice(0, 5)}` : ''}
                </span>
                <span className="text-xs text-primary/50">✓</span>
              </div>
            ))}
          </div>
        )}
      </FullscreenModule>

      <FullscreenModule
        open={photosOpen}
        onClose={() => setPhotosOpen(false)}
        title={lang === 'en' ? 'Progress Photos' : 'Фото прогресса'}
        icon={<Camera className="w-5 h-5 text-primary" />}
      >
        <ClientProgressView userId={user.id} lang={lang} />
      </FullscreenModule>

      <FullscreenModule
        open={testsOpen}
        onClose={() => setTestsOpen(false)}
        title={lang === 'en' ? 'Health Tests' : 'Тесты здоровья'}
        icon={<ClipboardCheck className="w-5 h-5 text-primary" />}
      >
        <ClientTestHistory userId={user.id} lang={lang} />
      </FullscreenModule>

      <FullscreenModule
        open={whoopOpen}
        onClose={() => setWhoopOpen(false)}
        title="Whoop"
        icon={<Activity className="w-5 h-5 text-green-400" />}
      >
        <WhoopWidget />
      </FullscreenModule>

      <FullscreenModule
        open={nutritionOpen}
        onClose={() => setNutritionOpen(false)}
        title={lang === 'en' ? 'Nutrition Diary' : 'Дневник питания'}
        icon={<UtensilsCrossed className="w-5 h-5 text-orange-400" />}
      >
        <NutritionDiary lang={lang} />
      </FullscreenModule>

      {/* Booking Modal */}
      <BookingModal
        open={bookingOpen}
        onClose={() => setBookingOpen(false)}
        initialStep={bookingStep}
        onBooked={() => setBookingOpen(false)}
      />
    </div>
  );
};

export default ClientDashboard;
