import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, CalendarDays, Clock, Check, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { format, addMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, isBefore, startOfDay, isSameMonth, getDay } from 'date-fns';
import { ru, enUS } from 'date-fns/locale';

interface BookingModalProps {
  open: boolean;
  onClose: () => void;
  onLoginRequest?: () => void;
}

interface TimeSlot {
  time: string;
  available: boolean;
}

interface MySession {
  id: string;
  session_date: string;
  session_time: string | null;
}

type Step = 'date' | 'time' | 'confirm' | 'done' | 'my-sessions';

const BookingModal = ({ open, onClose, onLoginRequest }: BookingModalProps) => {
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
  const [trainerDaysOff, setTrainerDaysOff] = useState<number[]>([0, 6]);

  // Fetch trainer days off on mount
  useEffect(() => {
    (async () => {
      const { data: trainers } = await supabase.from('user_roles').select('user_id').eq('role', 'trainer').limit(1);
      const trainerId = trainers?.[0]?.user_id;
      if (trainerId) {
        const { data: wh } = await supabase.from('trainer_working_hours').select('days_off').eq('trainer_user_id', trainerId).maybeSingle();
        if (wh?.days_off) setTrainerDaysOff(wh.days_off);
      }
    })();
  }, []);

  // Reset on open
  useEffect(() => {
    if (open) {
      setStep('date');
      setCurrentMonth(new Date());
      setSelectedDate(null);
      setSelectedTime(null);
      setSlots([]);
    }
  }, [open]);

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
        body: { action: 'getSlots', date: dateStr },
      });
      if (data?.dayOff) {
        setIsDayOff(true);
        setSlots([]);
      } else {
        setSlots(data?.slots || []);
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

  const handleDateSelect = (day: Date) => {
    if (isBefore(day, startOfDay(new Date()))) return;
    setSelectedDate(day);
    setSelectedTime(null);
    fetchSlots(day);
    setStep('time');
  };

  const handleBook = async () => {
    if (!selectedDate || !selectedTime) return;
    if (!user) {
      onClose();
      if (onLoginRequest) {
        onLoginRequest();
      } else {
        toast({
          title: lang === 'en' ? 'Please log in' : 'Войдите в аккаунт',
          description: lang === 'en' ? 'You need to be logged in to book a session' : 'Для записи необходимо авторизоваться',
          variant: 'destructive',
        });
      }
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('book-session', {
        body: {
          action: 'book',
          date: format(selectedDate, 'yyyy-MM-dd'),
          time: selectedTime,
        },
      });
      if (error || data?.error) {
        const msg = data?.error || error?.message || '';
        if (msg.includes('Unauthorized') || msg.includes('401')) {
          toast({
            title: lang === 'en' ? 'Session expired' : 'Сессия истекла',
            description: lang === 'en' ? 'Please log in again to book' : 'Войдите заново для записи',
            variant: 'destructive',
          });
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
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center"
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
                {step === 'confirm' && (
                  <button onClick={() => setStep('time')} className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-secondary transition-colors">
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                )}
                <h2 className="text-lg font-bold">
                  {step === 'done'
                    ? (lang === 'en' ? 'Booked!' : 'Записано!')
                    : step === 'my-sessions'
                      ? (lang === 'en' ? 'My Sessions' : 'Мои записи')
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
                {['date', 'time', 'confirm'].map((s, i) => (
                  <div
                    key={s}
                    className={`h-1 flex-1 rounded-full transition-colors ${
                      ['date', 'time', 'confirm'].indexOf(step) >= i ? 'bg-primary' : 'bg-secondary'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="p-5 flex-1" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 100px)' }}>
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

                    return (
                      <button
                        key={day.toISOString()}
                        disabled={past || !inMonth || isDayOff}
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
                  <p className="text-xs text-muted-foreground text-center mt-4">
                    {lang === 'en' ? 'Please log in to book a session' : 'Войдите, чтобы записаться'}
                  </p>
                )}
              </div>
            )}

            {/* === TIME STEP === */}
            {step === 'time' && selectedDate && (
              <div>
                <p className="text-sm text-muted-foreground mb-4">
                  {format(selectedDate, 'EEEE, d MMMM', { locale })}
                </p>

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
                        onClick={() => { setSelectedTime(slot.time); setStep('confirm'); }}
                        className={`py-3 rounded-xl text-sm font-semibold transition-all ${
                          !slot.available
                            ? 'bg-secondary/50 text-muted-foreground/40 cursor-not-allowed line-through'
                            : selectedTime === slot.time
                              ? 'bg-primary text-primary-foreground shadow-md'
                              : 'bg-secondary hover:bg-primary/10 hover:text-primary text-foreground'
                        }`}
                      >
                        {slot.time}
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

            {/* === CONFIRM STEP === */}
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

                <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-3">
                  <p className="text-xs text-destructive font-medium">
                    ⚠️ {lang === 'en'
                      ? 'Free cancellation up to 24 hours before the session. After that, the session will be deducted from your package.'
                      : 'Бесплатная отмена за 24 часа до тренировки. После этого занятие будет списано из пакета.'}
                  </p>
                </div>

                <button
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
                  onClick={onClose}
                  className="gradient-primary text-primary-foreground font-bold py-3 px-8 rounded-2xl text-sm"
                >
                  {lang === 'en' ? 'Done' : 'Готово'}
                </button>
              </div>
            )}

            {/* === MY SESSIONS === */}
            {step === 'my-sessions' && (
              <div>
                <button
                  onClick={() => setStep('date')}
                  className="text-xs text-primary font-semibold mb-4 flex items-center gap-1"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  {lang === 'en' ? 'Back to booking' : 'Назад к записи'}
                </button>

                {loading ? (
                  <div className="flex justify-center py-10">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : mySessions.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-10">
                    {lang === 'en' ? 'No upcoming sessions' : 'Нет предстоящих записей'}
                  </p>
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
