import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CalendarDays, Activity, LogOut, Ruler, ClipboardCheck, Camera,
  History, ChevronDown, ChevronRight, RotateCw, XCircle, Loader2,
  Upload, User
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
}

const DAY_NAMES_RU = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const DAY_NAMES_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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
      className="w-full flex items-center gap-2.5 px-4 py-3.5 hover:bg-secondary/30 transition-colors"
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
          <div className="px-4 pb-4">
            {children}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  </div>
);

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
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [measurementsOpen, setMeasurementsOpen] = useState(false);
  const [measurements, setMeasurements] = useState<any[]>([]);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [bookingStep, setBookingStep] = useState<'date' | 'my-sessions'>('my-sessions');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dayNames = lang === 'en' ? DAY_NAMES_EN : DAY_NAMES_RU;

  const toggleSection = (id: string) => setOpenSection(prev => prev === id ? null : id);

  // Load avatar from profile
  useEffect(() => {
    if (!user) return;

    const loadAvatar = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('avatar_url')
        .eq('user_id', user.id)
        .maybeSingle();
      setAvatarUrl(data?.avatar_url || null);
    };

    const fetchPkg = async () => {
      const { data: active } = await supabase
        .from('client_packages')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (active) { setPkg(active); return; }

      const { data: latest } = await supabase
        .from('client_packages')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      setPkg(latest);
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

    const fetchPast = async () => {
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

    loadAvatar();
    fetchPkg();
    fetchSessions();
    fetchPast();
    fetchMeasurements();

    const channel = supabase
      .channel('dashboard-sessions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scheduled_sessions', filter: `user_id=eq.${user.id}` }, () => {
        fetchSessions();
        fetchPkg();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'client_packages', filter: `user_id=eq.${user.id}` }, fetchPkg)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

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

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
      // Add cache-busting
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

  const canCancel = (s: ScheduledSession) => {
    if (s.is_recurring) return true;
    if (!s.session_time) return true;
    const sessionDateTime = new Date(`${s.session_date}T${s.session_time}`);
    const hoursLeft = (sessionDateTime.getTime() - Date.now()) / (1000 * 60 * 60);
    return hoursLeft > 24;
  };

  const handleCancel = async (session: ScheduledSession) => {
    if (!canCancel(session)) {
      toast({
        title: lang === 'en' ? 'Cannot cancel' : 'Отмена невозможна',
        description: lang === 'en' ? 'Sessions can only be cancelled 24h+ in advance.' : 'Отмена возможна только за 24 часа до тренировки.',
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

  if (!user) return null;

  const remaining = pkg ? pkg.total_sessions - pkg.used_sessions : 0;
  const total = pkg?.total_sessions || 0;
  const pct = total > 0 ? Math.round((remaining / total) * 100) : 0;
  const low = remaining <= 2;
  const exhausted = remaining <= 0 && !!pkg;

  return (
    <div className="min-h-screen bg-background pb-32">
      {/* Avatar section */}
      <div className="flex flex-col items-center px-5 pt-8 pb-5">
        {/* Avatar */}
        <div className="relative mb-4">
          <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-primary/40 shadow-[0_4px_30px_hsl(var(--primary)/0.3)]">
            {avatarUrl ? (
              <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full gradient-primary flex items-center justify-center">
                <span className="text-primary-foreground font-extrabold text-3xl">{getInitials()}</span>
              </div>
            )}
          </div>
          {/* Upload button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingAvatar}
            className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center shadow-md hover:scale-110 transition-transform active:scale-95"
          >
            {uploadingAvatar
              ? <Loader2 className="w-4 h-4 text-primary-foreground animate-spin" />
              : <Camera className="w-4 h-4 text-primary-foreground" />
            }
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
        </div>

        {/* Name */}
        <h2 className="text-xl font-extrabold font-heading text-foreground">{profile?.full_name}</h2>
        <p className="text-xs text-muted-foreground mt-0.5">{profile?.phone}</p>
      </div>

      <div className="px-5 space-y-3">
        {/* Session balance widget */}
        {pkg && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card border border-border/50 rounded-2xl p-4"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${exhausted || low ? 'bg-destructive/20' : 'gradient-primary'}`}>
                <Activity className={`w-5 h-5 ${exhausted || low ? 'text-destructive' : 'text-primary-foreground'}`} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{pkg.package_name}</p>
                <p className="text-xl font-extrabold font-heading">
                  {remaining} <span className="text-sm font-normal text-muted-foreground">/ {total} {lang === 'en' ? 'sessions left' : 'занятий осталось'}</span>
                </p>
              </div>
            </div>
            {exhausted && (
              <p className="text-xs text-destructive font-semibold mb-2">
                ⚠ {lang === 'en' ? 'Package exhausted — buy more sessions' : 'Пакет исчерпан — докупите тренировки'}
              </p>
            )}
            <div className="h-2 bg-secondary rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(pct, 0)}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className={`h-full rounded-full ${exhausted || low ? 'bg-destructive' : 'gradient-primary'}`}
              />
            </div>
          </motion.div>
        )}

        {/* Schedule CTA */}
        <button
          onClick={() => { setBookingStep('my-sessions'); setBookingOpen(true); }}
          className="w-full gradient-primary text-primary-foreground font-bold py-4 rounded-2xl text-base glow-primary hover:scale-[1.02] transition-transform active:scale-[0.98] flex items-center justify-center gap-2"
        >
          <CalendarDays className="w-5 h-5" />
          {lang === 'en' ? 'My Schedule' : 'Моё расписание'}
        </button>

        {/* Upcoming sessions quick view */}
        {sessions.length > 0 && (
          <div className="space-y-1.5">
            {sessions.slice(0, 3).map(s => (
              <div key={s.id} className="flex items-center justify-between bg-card border border-border/30 rounded-xl px-4 py-3">
                <div className="flex items-center gap-2">
                  {s.is_recurring
                    ? <RotateCw className="w-3.5 h-3.5 text-primary shrink-0" />
                    : <CalendarDays className="w-3.5 h-3.5 text-primary shrink-0" />
                  }
                  <span className="text-sm font-medium">
                    {s.is_recurring
                      ? `${lang === 'en' ? 'Every' : 'Каждый'} ${dayNames[s.recurrence_day!]}${s.recurrence_time ? ` ${s.recurrence_time.slice(0, 5)}` : ''}`
                      : `${new Date(s.session_date + 'T00:00:00').toLocaleDateString(lang === 'en' ? 'en-US' : 'ru-RU', { weekday: 'short', day: 'numeric', month: 'short' })}${s.session_time ? ` ${s.session_time.slice(0, 5)}` : ''}`
                    }
                  </span>
                </div>
                {canCancel(s) ? (
                  <button
                    onClick={() => handleCancel(s)}
                    disabled={cancellingId === s.id}
                    className="text-xs text-destructive font-semibold bg-destructive/10 px-2.5 py-1 rounded-lg hover:bg-destructive/20 transition-colors"
                  >
                    {cancellingId === s.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : lang === 'en' ? 'Cancel' : 'Отменить'}
                  </button>
                ) : (
                  <span className="text-[10px] text-muted-foreground">{'< 24ч'}</span>
                )}
              </div>
            ))}
            {sessions.length > 3 && (
              <button
                onClick={() => { setBookingStep('my-sessions'); setBookingOpen(true); }}
                className="w-full text-xs text-primary font-semibold py-2 text-center"
              >
                {lang === 'en' ? `+${sessions.length - 3} more sessions` : `+${sessions.length - 3} ещё`}
              </button>
            )}
          </div>
        )}

        {/* Body Measurements */}
        <button
          onClick={() => setMeasurementsOpen(true)}
          className="w-full border border-border/30 rounded-xl flex items-center gap-2.5 px-4 py-3.5 hover:bg-secondary/30 transition-colors bg-card"
        >
          <Ruler className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold flex-1 text-left">{lang === 'en' ? 'Body Progress' : 'Замеры тела'}</span>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </button>

        {/* Training History */}
        <AccordionSection
          icon={<History className="w-4 h-4 text-primary" />}
          title={lang === 'en' ? 'Training History' : 'История тренировок'}
          isOpen={openSection === 'history'}
          onToggle={() => toggleSection('history')}
          badge={pastSessions.length || undefined}
        >
          {pastSessions.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">{lang === 'en' ? 'No completed sessions yet' : 'Пока нет завершённых тренировок'}</p>
          ) : (
            <div className="space-y-1.5 max-h-52 overflow-y-auto">
              {pastSessions.map(s => (
                <div key={s.id} className="flex items-center gap-2 bg-secondary/30 rounded-lg p-2.5">
                  <CalendarDays className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="text-xs text-muted-foreground">
                    {new Date(s.session_date + 'T00:00:00').toLocaleDateString(lang === 'en' ? 'en-US' : 'ru-RU', { day: 'numeric', month: 'short', weekday: 'short' })}
                    {s.session_time ? ` ${s.session_time.slice(0, 5)}` : ''}
                  </span>
                  <span className="ml-auto text-[10px] text-primary/60 font-medium">✓</span>
                </div>
              ))}
            </div>
          )}
        </AccordionSection>

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

        {/* Sign out */}
        <button
          onClick={signOut}
          className="w-full flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-destructive transition-colors py-3 mt-2"
        >
          <LogOut className="w-4 h-4" />
          {lang === 'en' ? 'Sign out' : 'Выйти'}
        </button>
      </div>

      {/* Body Measurements Detail */}
      {measurementsOpen && (
        <BodyMeasurementsDetail open={measurementsOpen} measurements={measurements} lang={lang} onClose={() => setMeasurementsOpen(false)} />
      )}

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
