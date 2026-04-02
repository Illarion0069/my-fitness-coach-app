import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, CalendarDays, Clock, Check, Loader2, CreditCard, Package, User, Phone } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { format, addMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, isBefore, startOfDay, isSameMonth, getDay } from 'date-fns';
import { ru, enUS } from 'date-fns/locale';
import PhoneInput from '@/components/PhoneInput';

interface BookingModalProps {
  open: boolean;
  onClose: () => void;
  onLoginRequest?: () => void;
  onBooked?: () => void;
  initialStep?: 'date' | 'my-sessions';
  forceClientView?: boolean;
}

interface TimeSlot {
  time: string;
  available: boolean;
  booked?: number;
}

interface MySession {
  id: string;
  session_date: string;
  session_time: string | null;
}

type Step = 'date' | 'time' | 'guest-info' | 'payment' | 'confirm' | 'done' | 'my-sessions';

const REVOLUT_LINK = 'https://revolut.me/illarion';

const PACKAGES = [
  { id: 'consultation', sessions: 1, price: 50, label: { en: 'Consultation (1h)', ru: 'Консультация (1 час)' }, isConsultation: true },
  { id: 'single', sessions: 1, price: 100, label: { en: 'Single Session', ru: 'Разовая тренировка' } },
  { id: 'pack8', sessions: 8, price: 750, label: { en: '8 Sessions', ru: '8 занятий' } },
  { id: 'pack12', sessions: 12, price: 1030, label: { en: '12 Sessions', ru: '12 занятий' } },
  { id: 'pack20', sessions: 20, price: 1599, label: { en: '20 Sessions', ru: '20 занятий' } },
];

const BookingModal = ({ open, onClose, onLoginRequest, onBooked, initialStep, forceClientView = false }: BookingModalProps) => {
  const { user } = useAuth();
  const { lang } = useLanguage();
  const { toast } = useToast();
  const locale = lang === 'en' ? enUS : ru;

  const [step, setStep] = useState<Step>('date');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isDayOff, setIsDayOff] = useState(false);
  const [mySessions, setMySessions] = useState<MySession[]>([]);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const trainerDaysOff = [0, 6]; // weekends always off
  const [trainerBlockedDates, setTrainerBlockedDates] = useState<string[]>([]);
  const [hasActivePackage, setHasActivePackage] = useState<boolean | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<typeof PACKAGES[0] | null>(null);
  const [paymentOpened, setPaymentOpened] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestCountryCode, setGuestCountryCode] = useState('+357');

  const COUNTRY_CODES = [
    { code: '+357', country: '🇨🇾', label: 'Cyprus' },
    { code: '+7', country: '🇷🇺', label: 'Russia' },
    { code: '+375', country: '🇧🇾', label: 'Belarus' },
    { code: '+380', country: '🇺🇦', label: 'Ukraine' },
    { code: '+44', country: '🇬🇧', label: 'UK' },
    { code: '+1', country: '🇺🇸', label: 'US' },
  ];

  // Fetch trainer blocked dates on mount
  useEffect(() => {
    (async () => {
      const { data: trainers } = await supabase.from('user_roles').select('user_id').eq('role', 'trainer').limit(1);
      const trainerId = trainers?.[0]?.user_id;
      if (trainerId) {
        const { data: wh } = await supabase.from('trainer_working_hours').select('blocked_dates').eq('trainer_user_id', trainerId).maybeSingle();
        if (wh?.blocked_dates) setTrainerBlockedDates(wh.blocked_dates);
      }
    })();
  }, []);

  // Reset on open
  useEffect(() => {
    if (open) {
      const startStep = initialStep || 'date';
      setStep(startStep);
      setCurrentMonth(new Date());
      setSelectedDate(null);
      setSelectedTime(null);
      setSlots([]);
      setHasActivePackage(null);
      setSelectedPackage(null);
      setPaymentOpened(false);
      setGuestName('');
      setGuestPhone('');
      if (startStep === 'my-sessions') {
        fetchMySessions();
      }
    }
  }, [open, initialStep]);

  const monthDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    // Pad to start on Monday
    const startDow = getDay(monthStart);
    const padStart = startDow === 0 ? 6 : startDow - 1;
    const start = new Date(monthStart);
    start.setDate(start.getDate() - padStart);
    // Pad to fill 6 rows
    const end = new Date(start);
    end.setDate(end.getDate() + 41);
    return eachDayOfInterval({ start, end: end > monthEnd ? end : monthEnd });
  }, [currentMonth]);

  const weekDays = lang === 'en'
    ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    : ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

  const fetchSlots = async (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    setLoading(true);
    setIsDayOff(false);
    try {
      const { data } = await supabase.functions.invoke('book-session', {
        body: { action: 'getSlots', date: dateStr, forceClientView },
      });
      if (data?.dayOff) {
        setIsDayOff(true);
        setSlots([]);
      } else {
        const normalizedSlots = ((data?.slots || []) as TimeSlot[]).map((slot) =>
          forceClientView
            ? { ...slot, available: slot.available && (slot.booked ?? 0) === 0, booked: 0 }
            : slot
        );
        setSlots(normalizedSlots);
      }
    } catch {
      setSlots([]);
    }
    setLoading(false);
  };

  const fetchMySessions = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.functions.invoke('book-session', {
        body: { action: 'mySessions' },
      });
      setMySessions(data?.sessions || []);
    } catch {
      setMySessions([]);
    }
    setLoading(false);
  };

  const checkActivePackage = useCallback(async () => {
    if (!user) return false;
    const { data } = await supabase
      .from('client_packages')
      .select('id, total_sessions, used_sessions, expires_at')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: true });
    // Check if any active package has remaining sessions AND is not expired
    const now = new Date();
    const hasRemaining = (data || []).some(p => 
      p.used_sessions < p.total_sessions && 
      (!p.expires_at || new Date(p.expires_at) > now)
    );
    setHasActivePackage(hasRemaining);
    return hasRemaining;
  }, [user]);

  const handleTimeSelect = async (time: string) => {
    setSelectedTime(time);
    if (!user) {
      // Guest flow: collect name + phone
      setStep('guest-info');
      return;
    }
    setLoading(true);
    const has = await checkActivePackage();
    setLoading(false);
    if (has) {
      setStep('confirm');
    } else {
      setSelectedPackage(null);
      setPaymentOpened(false);
      setStep('payment');
    }
  };

  const handleDateSelect = (day: Date) => {
    if (isBefore(day, startOfDay(new Date()))) return;
    setSelectedDate(day);
    setSelectedTime(null);
    fetchSlots(day);
    setStep('time');
  };

  const handleBook = async () => {
    if (!selectedDate || !selectedTime) return;
    
    // Guest booking (no auth)
    if (!user) {
      if (!guestName.trim() || !guestPhone.trim()) {
        toast({
          title: lang === 'en' ? 'Fill in all fields' : 'Заполните все поля',
          variant: 'destructive',
        });
        return;
      }
      setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke('book-session', {
          body: {
            action: 'guestBook',
            date: format(selectedDate, 'yyyy-MM-dd'),
            time: selectedTime,
            guest_name: guestName.trim(),
            guest_phone: `${guestCountryCode}${guestPhone.trim()}`,
          },
        });
        if (error || data?.error) {
          toast({
            title: lang === 'en' ? 'Error' : 'Ошибка',
            description: data?.error || error?.message || 'Unknown error',
            variant: 'destructive',
          });
        } else {
          setStep('done');
        }
      } catch (e: any) {
        toast({ title: 'Error', description: e.message, variant: 'destructive' });
      }
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const bookBody: any = {
        action: 'book',
        date: format(selectedDate, 'yyyy-MM-dd'),
        time: selectedTime,
      };
      // If client went through payment step, flag as pending payment
      if (hasActivePackage === false && selectedPackage) {
        bookBody.pendingPayment = true;
        bookBody.selectedPackageSessions = selectedPackage.sessions;
        bookBody.selectedPackagePrice = selectedPackage.price;
      }
      const { data, error } = await supabase.functions.invoke('book-session', {
        body: bookBody,
      });
      if (error || data?.error) {
        const msg = data?.error || error?.message || '';
        if (msg.includes('Unauthorized') || msg.includes('401')) {
          toast({
            title: lang === 'en' ? 'Session expired' : 'Сессия истекла',
            description: lang === 'en' ? 'Please log in again to book' : 'Войдите заново для записи',
            variant: 'destructive',
          });
        } else if (data?.requiresPayment) {
          // Server detected no balance — show payment step
          setHasActivePackage(false);
          setSelectedPackage(null);
          setPaymentOpened(false);
          setStep('payment');
        } else {
          toast({
            title: lang === 'en' ? 'Error' : 'Ошибка',
            description: msg || 'Unknown error',
            variant: 'destructive',
          });
        }
      } else {
        setStep('done');
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
    setLoading(false);
  };

  const handleCancel = async (sessionId: string) => {
    setCancellingId(sessionId);
    try {
      const { data, error } = await supabase.functions.invoke('book-session', {
        body: { action: 'cancel', session_id: sessionId },
      });
      if (error || data?.error) {
        toast({
          title: lang === 'en' ? 'Error' : 'Ошибка',
          description: data?.error || error?.message,
          variant: 'destructive',
        });
      } else {
        toast({ title: lang === 'en' ? 'Session cancelled' : 'Запись отменена' });
        fetchMySessions();
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
    setCancellingId(null);
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[210] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          onClick={e => e.stopPropagation()}
          className="bg-card w-full max-w-md rounded-t-3xl sm:rounded-3xl max-h-[85vh] min-h-[60vh] overflow-y-auto border border-border/50 shadow-2xl flex flex-col"
        >
          {/* Header */}
          <div className="sticky top-0 bg-card/95 backdrop-blur-md z-10 px-5 pt-5 pb-3 border-b border-border/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {step === 'time' && (
                  <button onClick={() => setStep('date')} className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-secondary transition-colors">
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                )}
                {step === 'guest-info' && (
                  <button onClick={() => setStep('time')} className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-secondary transition-colors">
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                )}
                {step === 'confirm' && (
                  <button onClick={() => setStep(!user ? 'guest-info' : hasActivePackage === false ? 'payment' : 'time')} className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-secondary transition-colors">
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                )}
                {step === 'payment' && (
                  <button onClick={() => setStep('time')} className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-secondary transition-colors">
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                )}
                <h2 className="text-lg font-bold">
                  {step === 'done'
                    ? (lang === 'en' ? 'Booked!' : 'Записано!')
                    : step === 'my-sessions'
                      ? (lang === 'en' ? 'My Sessions' : 'Мои записи')
                      : step === 'payment'
                        ? (lang === 'en' ? 'Payment' : 'Оплата')
                        : step === 'guest-info'
                          ? (lang === 'en' ? 'Your Info' : 'Ваши данные')
                          : (lang === 'en' ? 'Book Session' : 'Запись на тренировку')
                  }
                </h2>
              </div>
              <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-secondary transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Step indicators */}
            {step !== 'done' && step !== 'my-sessions' && (
              <div className="flex gap-1 mt-3">
                {(!user ? ['date', 'time', 'guest-info', 'confirm'] : hasActivePackage === false ? ['date', 'time', 'payment', 'confirm'] : ['date', 'time', 'confirm']).map((s, i, arr) => (
                  <div
                    key={s}
                    className={`h-1 flex-1 rounded-full transition-colors ${
                      arr.indexOf(step as string) >= i ? 'bg-primary' : 'bg-secondary'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="p-5 flex-1 pb-40">
            {/* === DATE STEP === */}
            {step === 'date' && (
              <div>
                {/* My sessions link */}
                {user && (
                  <button
                    onClick={() => { setStep('my-sessions'); fetchMySessions(); }}
                    className="w-full text-left text-xs text-primary font-semibold mb-4 flex items-center gap-1.5"
                  >
                    <CalendarDays className="w-3.5 h-3.5" />
                    {lang === 'en' ? 'View my upcoming sessions' : 'Мои предстоящие записи'}
                  </button>
                )}

                {/* Month nav */}
                <div className="flex items-center justify-between mb-4">
                  <button
                    onClick={() => setCurrentMonth(addMonths(currentMonth, -1))}
                    className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-secondary transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <h3 className="text-sm font-bold capitalize">
                    {format(currentMonth, 'LLLL yyyy', { locale })}
                  </h3>
                  <button
                    onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                    className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-secondary transition-colors"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>

                {/* Day headers */}
                <div className="grid grid-cols-7 gap-1 mb-1">
                  {weekDays.map(d => (
                    <div key={d} className="text-center text-[10px] font-semibold text-muted-foreground uppercase">{d}</div>
                  ))}
                </div>

                {/* Calendar grid */}
                <div className="grid grid-cols-7 gap-1">
                  {monthDays.map(day => {
                    const inMonth = isSameMonth(day, currentMonth);
                    const past = isBefore(day, startOfDay(new Date()));
                    const today = isToday(day);
                    const selected = selectedDate && isSameDay(day, selectedDate);
                    const dayOfWeek = getDay(day);
                    const isDayOff = trainerDaysOff.includes(dayOfWeek);
                    const isBlocked = trainerBlockedDates.includes(format(day, 'yyyy-MM-dd'));

                    return (
                      <button
                        key={day.toISOString()}
                        disabled={past || !inMonth || isDayOff || isBlocked}
                        onClick={() => handleDateSelect(day)}
                        className={`aspect-square rounded-xl flex items-center justify-center text-sm font-medium transition-all ${
                          selected
                            ? 'bg-primary text-primary-foreground shadow-md'
                            : today && !isDayOff
                              ? 'bg-primary/10 text-primary font-bold'
                              : past || !inMonth || isDayOff
                                ? 'text-muted-foreground/30 cursor-not-allowed'
                                : 'hover:bg-secondary text-foreground'
                        }`}
                      >
                        {format(day, 'd')}
                      </button>
                    );
                  })}
                </div>

                {!user && (
                  <p className="text-xs text-primary/70 text-center mt-4 font-medium">
                    {lang === 'en' ? '✨ No account needed — just pick a date!' : '✨ Аккаунт не нужен — просто выберите дату!'}
                  </p>
                )}
              </div>
            )}

            {/* === TIME STEP === */}
            {step === 'time' && selectedDate && (
              <div>
                <p className="text-sm text-muted-foreground mb-2">
                  {format(selectedDate, 'EEEE, d MMMM', { locale })}
                </p>
                {/* Show timezone hint if user is NOT in Cyprus */}
                {(() => {
                  const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
                  if (userTz !== 'Asia/Nicosia' && userTz !== 'Europe/Nicosia') {
                    return (
                      <p className="text-[10px] text-muted-foreground/60 mb-3">
                        {lang === 'en' ? '⏰ Times shown in Limassol time (Cyprus)' : '⏰ Время указано по Лимассолу (Кипр)'}
                      </p>
                    );
                  }
                  return null;
                })()}

                {loading ? (
                  <div className="flex justify-center py-10">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {slots.map(slot => (
                      <button
                        key={slot.time}
                        disabled={!slot.available}
                        onClick={() => handleTimeSelect(slot.time)}
                        className={`py-3 rounded-xl text-sm font-semibold transition-all relative ${
                          !slot.available
                            ? 'bg-secondary/50 text-muted-foreground/40 cursor-not-allowed line-through'
                            : selectedTime === slot.time
                              ? 'bg-primary text-primary-foreground shadow-md'
                              : slot.booked === 1
                                ? 'bg-primary/15 hover:bg-primary/25 text-primary border border-primary/30'
                                : 'bg-secondary hover:bg-primary/10 hover:text-primary text-foreground'
                        }`}
                      >
                        {slot.time}
                        {!forceClientView && slot.booked === 1 && slot.available && (
                          <span className="absolute top-0.5 right-1.5 text-[8px] font-bold text-primary/70">1/2</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {!loading && isDayOff && (
                  <p className="text-sm text-muted-foreground text-center mt-4">
                    {lang === 'en' ? 'Day off — no sessions available' : 'Выходной день — запись недоступна'}
                  </p>
                )}

                {!loading && !isDayOff && slots.filter(s => s.available).length === 0 && slots.length > 0 && (
                  <p className="text-sm text-muted-foreground text-center mt-4">
                    {lang === 'en' ? 'All slots are booked for this day' : 'Все слоты на этот день заняты'}
                  </p>
                )}

                {!loading && !isDayOff && slots.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center mt-4">
                    {lang === 'en' ? 'No available slots for this day' : 'Нет свободных слотов на этот день'}
                  </p>
                )}
              </div>
            )}

            {/* === GUEST INFO STEP === */}
            {step === 'guest-info' && selectedDate && selectedTime && (
              <div className="space-y-5">
                <div className="bg-secondary/50 rounded-2xl p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <CalendarDays className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-bold">{format(selectedDate, 'EEEE, d MMMM', { locale })}</p>
                    <p className="text-xs text-muted-foreground">{selectedTime}</p>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-semibold mb-1">
                    {lang === 'en' ? 'Your contact info' : 'Ваши контактные данные'}
                  </p>
                  <p className="text-xs text-muted-foreground mb-4">
                    {lang === 'en' ? 'We\'ll contact you to confirm the session' : 'Мы свяжемся с вами для подтверждения'}
                  </p>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                      {lang === 'en' ? 'Your name' : 'Ваше имя'}
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <input
                        type="text"
                        value={guestName}
                        onChange={(e) => setGuestName(e.target.value)}
                        placeholder={lang === 'en' ? 'John' : 'Иван'}
                        className="w-full h-11 rounded-xl border border-input bg-background pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                      {lang === 'en' ? 'Phone number' : 'Номер телефона'}
                    </label>
                    <PhoneInput
                      countryCode={guestCountryCode}
                      onCountryCodeChange={setGuestCountryCode}
                      phone={guestPhone}
                      onPhoneChange={setGuestPhone}
                      countryCodes={COUNTRY_CODES}
                    />
                  </div>
                </div>

                <button
                  onClick={() => {
                    if (!guestName.trim() || !guestPhone.trim()) {
                      toast({
                        title: lang === 'en' ? 'Fill in all fields' : 'Заполните все поля',
                        variant: 'destructive',
                      });
                      return;
                    }
                    setStep('confirm');
                  }}
                  disabled={!guestName.trim() || !guestPhone.trim()}
                  className="w-full gradient-primary text-primary-foreground font-bold py-4 rounded-2xl text-base glow-primary hover:scale-[1.02] transition-transform active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {lang === 'en' ? 'Continue' : 'Продолжить'}
                </button>
              </div>
            )}

            {step === 'payment' && selectedDate && selectedTime && (
              <div className="space-y-5">
                {/* Selected slot summary */}
                <div className="bg-secondary/50 rounded-2xl p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <CalendarDays className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-bold">{format(selectedDate, 'EEEE, d MMMM', { locale })}</p>
                    <p className="text-xs text-muted-foreground">{selectedTime}</p>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-semibold mb-1">
                    {lang === 'en' ? 'Choose a plan to continue' : 'Выберите вариант для продолжения'}
                  </p>
                  <p className="text-xs text-muted-foreground mb-4">
                    {lang === 'en'
                      ? 'You need to purchase a session or package to book a training.'
                      : 'Для записи на тренировку необходимо оплатить занятие или пакет.'}
                  </p>
                </div>

                <div className="space-y-2">
                  {PACKAGES.map(pkg => (
                    <button
                      key={pkg.id}
                      onClick={() => setSelectedPackage(pkg)}
                      className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${
                        selectedPackage?.id === pkg.id
                          ? 'border-primary bg-primary/5 shadow-md'
                          : 'border-border/50 bg-secondary/30 hover:border-primary/30'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                          selectedPackage?.id === pkg.id ? 'bg-primary text-primary-foreground' : 'bg-secondary'
                        }`}>
                          {pkg.sessions === 1
                            ? <CreditCard className="w-4 h-4" />
                            : <Package className="w-4 h-4" />
                          }
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-bold">{pkg.label[lang]}</p>
                          {(pkg as any).isConsultation ? (
                            <p className="text-[10px] text-muted-foreground">
                              {lang === 'en' ? 'Measurements, health check & plan' : 'Замеры, здоровье и план'}
                            </p>
                          ) : pkg.sessions > 1 ? (
                            <p className="text-[10px] text-muted-foreground">
                              {Math.round(pkg.price / pkg.sessions)}€ {lang === 'en' ? 'per session' : 'за занятие'}
                            </p>
                          ) : null}
                        </div>
                      </div>
                      <p className="text-base font-bold">{pkg.price}€</p>
                    </button>
                  ))}
                </div>

                {selectedPackage && !paymentOpened && (
                  <a
                    href={REVOLUT_LINK}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setPaymentOpened(true)}
                    className="w-full gradient-primary text-primary-foreground font-bold py-4 rounded-2xl text-base glow-primary hover:scale-[1.02] transition-transform active:scale-[0.98] flex items-center justify-center gap-2"
                  >
                    <CreditCard className="w-5 h-5" />
                    {lang === 'en' ? `Pay ${selectedPackage.price}€ via Revolut` : `Оплатить ${selectedPackage.price}€ через Revolut`}
                  </a>
                )}

                {paymentOpened && (
                  <div className="space-y-3">
                    <div className="bg-primary/5 border border-primary/20 rounded-xl p-3">
                      <p className="text-xs text-primary font-medium text-center">
                        💳 {lang === 'en'
                          ? 'Complete the payment in Revolut, then confirm below.'
                          : 'Завершите оплату в Revolut, затем подтвердите ниже.'}
                      </p>
                    </div>
                    <button
                      onClick={() => setStep('confirm')}
                      className="w-full gradient-primary text-primary-foreground font-bold py-4 rounded-2xl text-base glow-primary hover:scale-[1.02] transition-transform active:scale-[0.98] flex items-center justify-center gap-2"
                    >
                      <Check className="w-5 h-5" />
                      {lang === 'en' ? 'I have paid — Confirm booking' : 'Я оплатил — Подтвердить запись'}
                    </button>
                  </div>
                )}

                <p className="text-[10px] text-muted-foreground/60 text-center">
                  {lang === 'en'
                    ? 'Payment via Revolut. Gym membership 150€/month paid separately.'
                    : 'Оплата через Revolut. Абонемент зала 150€/мес оплачивается отдельно.'}
                </p>
              </div>
            )}

            {step === 'confirm' && selectedDate && selectedTime && (
              <div className="space-y-6">
                <div className="bg-secondary/50 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <CalendarDays className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{lang === 'en' ? 'Date' : 'Дата'}</p>
                      <p className="text-sm font-bold">{format(selectedDate, 'EEEE, d MMMM', { locale })}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Clock className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{lang === 'en' ? 'Time' : 'Время'}</p>
                      <p className="text-sm font-bold">{selectedTime}</p>
                    </div>
                  </div>
                </div>

                {/* Guest info summary */}
                {!user && guestName && (
                  <div className="bg-secondary/50 rounded-2xl p-5 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <User className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">{lang === 'en' ? 'Name' : 'Имя'}</p>
                        <p className="text-sm font-bold">{guestName}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Phone className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">{lang === 'en' ? 'Phone' : 'Телефон'}</p>
                        <p className="text-sm font-bold">{guestCountryCode}{guestPhone}</p>
                      </div>
                    </div>
                  </div>
                )}

                {user && (
                  <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-3">
                    <p className="text-xs text-destructive font-medium">
                      ⚠️ {lang === 'en'
                        ? 'Free cancellation up to 24 hours before the session. After that, the session will be deducted from your package.'
                        : 'Бесплатная отмена за 24 часа до тренировки. После этого занятие будет списано из пакета.'}
                    </p>
                  </div>
                )}

                <button
                  onClick={(e) => { e.stopPropagation(); handleBook(); }}
                  disabled={loading}
                  className="w-full gradient-primary text-primary-foreground font-bold py-4 rounded-2xl text-base glow-primary hover:scale-[1.02] transition-transform active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>{lang === 'en' ? 'Confirm Booking' : 'Подтвердить запись'}</>
                  )}
                </button>
              </div>
            )}

            {/* === DONE STEP === */}
            {step === 'done' && (
              <div className="text-center py-6 space-y-4">
                <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto">
                  <Check className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <p className="text-lg font-bold">{lang === 'en' ? 'You\'re booked!' : 'Вы записаны!'}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {selectedDate && format(selectedDate, 'EEEE, d MMMM', { locale })} {lang === 'en' ? 'at' : 'в'} {selectedTime}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  {lang === 'en'
                    ? 'You will receive a confirmation in Telegram'
                    : 'Вы получите подтверждение в Telegram'
                  }
                </p>
                <button
                  onClick={() => { onClose(); onBooked?.(); }}
                  className="gradient-primary text-primary-foreground font-bold py-3 px-8 rounded-2xl text-sm"
                >
                  {lang === 'en' ? 'Done' : 'Готово'}
                </button>
              </div>
            )}

            {/* === MY SESSIONS === */}
            {step === 'my-sessions' && (
              <div>
                {loading ? (
                  <div className="flex justify-center py-10">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : mySessions.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-sm text-muted-foreground mb-6">
                      {lang === 'en' ? 'No upcoming sessions' : 'Нет предстоящих записей'}
                    </p>
                    <button
                      onClick={() => setStep('date')}
                      className="w-full gradient-primary text-primary-foreground font-bold py-4 rounded-2xl text-base glow-primary hover:scale-[1.02] transition-transform active:scale-[0.98] flex items-center justify-center gap-2"
                    >
                      <CalendarDays className="w-5 h-5" />
                      {lang === 'en' ? 'Book a session' : 'Забронировать занятие'}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {mySessions.map(s => {
                      const sessionDate = new Date(s.session_date + 'T' + (s.session_time || '00:00') + ':00');
                      const hoursUntil = (sessionDate.getTime() - Date.now()) / (1000 * 60 * 60);
                      const canCancel = hoursUntil >= 24;

                      return (
                        <div key={s.id} className="flex items-center justify-between bg-secondary/50 rounded-xl px-4 py-3">
                          <div>
                            <p className="text-sm font-semibold">
                              {new Date(s.session_date + 'T00:00:00').toLocaleDateString(lang === 'en' ? 'en-US' : 'ru-RU', { weekday: 'short', day: 'numeric', month: 'short' })}
                            </p>
                            {s.session_time && (
                              <p className="text-xs text-muted-foreground">{s.session_time.slice(0, 5)}</p>
                            )}
                          </div>
                          {canCancel ? (
                            <button
                              onClick={() => handleCancel(s.id)}
                              disabled={cancellingId === s.id}
                              className="text-xs text-destructive font-semibold bg-destructive/10 px-3 py-1.5 rounded-lg hover:bg-destructive/20 transition-colors disabled:opacity-50"
                            >
                              {cancellingId === s.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                lang === 'en' ? 'Cancel' : 'Отменить'
                              )}
                            </button>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">
                              {lang === 'en' ? '< 24h' : '< 24ч'}
                            </span>
                          )}
                        </div>
                      );
                    })}

                    {/* Book new session CTA */}
                    <div className="pt-4">
                      <button
                        onClick={() => setStep('date')}
                        className="w-full gradient-primary text-primary-foreground font-bold py-4 rounded-2xl text-base glow-primary hover:scale-[1.02] transition-transform active:scale-[0.98] flex items-center justify-center gap-2"
                      >
                        <CalendarDays className="w-5 h-5" />
                        {lang === 'en' ? 'Book another session' : 'Добавить занятие'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default BookingModal;
