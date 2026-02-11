import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Calendar, Clock, MapPin, Check, Loader2, Send } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface GroupSession {
  id: string;
  session_date: string;
  start_time: string;
  end_time: string;
  max_participants: number;
  price_per_person: number;
  location: string | null;
}

interface GroupBooking {
  id: string;
  session_id: string;
  participant_name: string;
  spot_number: number;
}

// Fitness equipment SVG icons for spots
const DumbbellIcon = ({ className = '' }: { className?: string }) => (
  <svg viewBox="0 0 48 48" className={className} fill="currentColor">
    <rect x="4" y="18" width="6" height="12" rx="2" />
    <rect x="10" y="20" width="4" height="8" rx="1" />
    <rect x="34" y="20" width="4" height="8" rx="1" />
    <rect x="38" y="18" width="6" height="12" rx="2" />
    <rect x="14" y="22" width="20" height="4" rx="1" />
  </svg>
);

const KettlebellIcon = ({ className = '' }: { className?: string }) => (
  <svg viewBox="0 0 48 48" className={className} fill="currentColor">
    <path d="M24 8c-4 0-7 2-8 5h16c-1-3-4-5-8-5zm-6 6c-1 1-1 3 0 4h12c1-1 1-3 0-4H18z" opacity="0.7" />
    <ellipse cx="24" cy="30" rx="10" ry="12" />
    <ellipse cx="24" cy="30" rx="4" ry="5" fill="currentColor" opacity="0.3" />
  </svg>
);

const BarbellIcon = ({ className = '' }: { className?: string }) => (
  <svg viewBox="0 0 48 48" className={className} fill="currentColor">
    <rect x="2" y="16" width="5" height="16" rx="2" />
    <rect x="7" y="19" width="3" height="10" rx="1" />
    <rect x="38" y="19" width="3" height="10" rx="1" />
    <rect x="41" y="16" width="5" height="16" rx="2" />
    <rect x="10" y="22" width="28" height="4" rx="1" />
  </svg>
);

const spotIcons = [DumbbellIcon, KettlebellIcon, BarbellIcon];

const REVOLUT_LINK = ''; // TODO: Replace with your revolut.me link
const TELEGRAM_BOT_USERNAME = 'LimassolFitness_bot';

const GroupTrainingSection = () => {
  const { lang } = useLanguage();
  const { toast } = useToast();
  const [sessions, setSessions] = useState<GroupSession[]>([]);
  const [bookings, setBookings] = useState<GroupBooking[]>([]);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [bookingSpot, setBookingSpot] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [telegram, setTelegram] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [bookingComplete, setBookingComplete] = useState<string | null>(null); // booking ID after success

  useEffect(() => {
    fetchData();
    const channel = supabase
      .channel('group-bookings-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_bookings' }, () => {
        fetchBookings();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([fetchSessions(), fetchBookings()]);
    setLoading(false);
  };

  const fetchSessions = async () => {
    const { data } = await supabase
      .from('group_sessions')
      .select('*')
      .gte('session_date', new Date().toISOString().split('T')[0])
      .order('session_date', { ascending: true })
      .order('start_time', { ascending: true });
    if (data) setSessions(data);
  };

  const fetchBookings = async () => {
    const { data } = await supabase.from('group_bookings').select('*');
    if (data) setBookings(data);
  };

  const getSessionBookings = (sessionId: string) =>
    bookings.filter((b) => b.session_id === sessionId);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    const days = lang === 'en'
      ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
      : ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
    const months = lang === 'en'
      ? ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
      : ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
    return `${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]}`;
  };

  const formatTime = (t: string) => t.slice(0, 5);

  const handleBookSpot = async () => {
    if (!selectedSession || bookingSpot === null || !name.trim() || !phone.trim()) return;
    setSubmitting(true);
    try {
      const { data: insertedBooking, error } = await supabase.from('group_bookings').insert({
        session_id: selectedSession,
        participant_name: name.trim(),
        participant_phone: phone.trim(),
        participant_telegram: telegram.trim() || null,
        spot_number: bookingSpot,
        payment_status: 'pending',
      }).select('id').single();
      if (error) throw error;

      const sessionBookings = getSessionBookings(selectedSession);
      const session = sessions.find((s) => s.id === selectedSession);
      const spotsAfter = sessionBookings.length + 1;

      // Notify trainer via Telegram
      await supabase.functions.invoke('send-telegram', {
        body: {
          message: `🏋️ <b>Group Training Booking!</b>\n\n👤 ${name.trim()}\n📱 ${phone.trim()}${telegram.trim() ? `\n💬 @${telegram.trim()}` : ''}\n📅 ${session ? formatDate(session.session_date) : ''} ${session ? formatTime(session.start_time) : ''}\n💺 Spot ${bookingSpot}/${session?.max_participants || 3}\n💰 Payment: pending\n\n${spotsAfter >= (session?.max_participants || 3) ? '✅ GROUP IS FULL — CLASS CONFIRMED!' : `⏳ ${spotsAfter}/${session?.max_participants || 3} spots filled`}`,
        },
      });

      // If client provided Telegram, send them a confirmation
      if (telegram.trim()) {
        await supabase.functions.invoke('send-telegram', {
          body: {
            action: 'sendToClient',
            telegram_username: telegram.trim(),
            booking_id: insertedBooking?.id,
            message: lang === 'en'
              ? `✅ <b>Spot Booked!</b>\n\n📅 ${session ? formatDate(session.session_date) : ''} at ${session ? formatTime(session.start_time) : ''}\n💺 Spot ${bookingSpot}\n💰 Price: €${session?.price_per_person || 20}\n\n⏳ You will receive a second notification when all ${session?.max_participants || 3} spots are filled and the class is confirmed!\n\n📍 ${session?.location || 'Eleftherias 119, Limassol'}`
              : `✅ <b>Место забронировано!</b>\n\n📅 ${session ? formatDate(session.session_date) : ''} в ${session ? formatTime(session.start_time) : ''}\n💺 Место ${bookingSpot}\n💰 Цена: €${session?.price_per_person || 20}\n\n⏳ Вы получите второе уведомление, когда все ${session?.max_participants || 3} места будут заняты и тренировка будет подтверждена!\n\n📍 ${session?.location || 'Элефтериас 119, Лимассол'}`,
          },
        });
      }

      // If group is now full, notify all participants
      if (spotsAfter >= (session?.max_participants || 3)) {
        await supabase.functions.invoke('send-telegram', {
          body: {
            action: 'notifyGroupFull',
            session_id: selectedSession,
          },
        });
      }

      setBookingComplete(insertedBooking?.id || null);

      toast({
        title: lang === 'en' ? 'Spot booked!' : 'Место забронировано!',
        description: lang === 'en'
          ? 'Please complete payment via Revolut to confirm.'
          : 'Завершите оплату через Revolut для подтверждения.',
      });

      await fetchBookings();
    } catch (err: any) {
      const isDuplicate = err?.code === '23505';
      toast({
        title: lang === 'en' ? 'Error' : 'Ошибка',
        description: isDuplicate
          ? lang === 'en' ? 'This spot is already taken.' : 'Это место уже занято.'
          : lang === 'en' ? 'Failed to book. Try again.' : 'Не удалось забронировать. Попробуйте снова.',
        variant: 'destructive',
      });
    }
    setSubmitting(false);
  };

  const handlePayment = () => {
    if (REVOLUT_LINK) {
      window.open(REVOLUT_LINK, '_blank');
    } else {
      toast({
        title: lang === 'en' ? 'Payment' : 'Оплата',
        description: lang === 'en'
          ? 'Revolut payment link coming soon. Contact trainer directly.'
          : 'Ссылка на оплату скоро появится. Свяжитесь с тренером напрямую.',
      });
    }
    // Reset booking state
    setBookingComplete(null);
    setSelectedSession(null);
    setBookingSpot(null);
    setName('');
    setPhone('');
    setTelegram('');
  };

  if (loading) {
    return (
      <section className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </section>
    );
  }

  return (
    <section className="min-h-screen px-5 pt-8 pb-28">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-2">
          <Users className="w-6 h-6 text-primary" />
          <h2 className="text-2xl font-extrabold uppercase tracking-tight font-heading">
            {lang === 'en' ? 'Group Training' : 'Групповые тренировки'}
          </h2>
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          {lang === 'en'
            ? 'Pick your equipment & book your spot! Training happens when all 3 spots are filled.'
            : 'Выберите снаряд и забронируйте место! Тренировка состоится, когда соберутся 3 человека.'}
        </p>
      </motion.div>

      {sessions.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-card rounded-2xl p-8 border border-border/50 text-center">
          <Users className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">
            {lang === 'en' ? 'No upcoming group sessions scheduled yet.' : 'Пока нет запланированных групповых тренировок.'}
          </p>
        </motion.div>
      ) : (
        <div className="space-y-4">
          {sessions.map((session, idx) => {
            const sBookings = getSessionBookings(session.id);
            const spotsTaken = sBookings.length;
            const isFull = spotsTaken >= session.max_participants;
            const isSelected = selectedSession === session.id;

            return (
              <motion.div
                key={session.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className={`bg-card rounded-2xl border transition-all ${
                  isSelected ? 'border-primary shadow-lg shadow-primary/10' : 'border-border/50'
                }`}
              >
                {/* Session header */}
                <div
                  className="p-4 cursor-pointer"
                  onClick={() => {
                    setSelectedSession(isSelected ? null : session.id);
                    setBookingSpot(null);
                    setBookingComplete(null);
                  }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-primary" />
                      <span className="text-sm font-bold">{formatDate(session.session_date)}</span>
                    </div>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                      isFull ? 'bg-primary/20 text-primary' : 'bg-secondary text-secondary-foreground'
                    }`}>
                      {isFull
                        ? lang === 'en' ? '✅ Confirmed' : '✅ Подтверждено'
                        : `${spotsTaken}/${session.max_participants}`}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {formatTime(session.start_time)} – {formatTime(session.end_time)}
                    </span>
                    {session.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" />
                        {session.location}
                      </span>
                    )}
                  </div>

                  {/* Fitness equipment spots */}
                  <div className="flex gap-3 mt-4">
                    {Array.from({ length: session.max_participants }, (_, i) => {
                      const booking = sBookings.find((b) => b.spot_number === i + 1);
                      const SpotIcon = spotIcons[i % spotIcons.length];
                      return (
                        <div
                          key={i}
                          className={`flex-1 rounded-2xl flex flex-col items-center justify-center py-3 transition-all ${
                            booking
                              ? 'bg-primary/15 border-2 border-primary/40'
                              : 'bg-secondary/50 border-2 border-border/30'
                          }`}
                        >
                          <SpotIcon className={`w-8 h-8 mb-1.5 ${
                            booking ? 'text-primary' : 'text-muted-foreground/40'
                          }`} />
                          {booking ? (
                            <div className="flex items-center gap-1">
                              <Check className="w-3 h-3 text-primary" />
                              <span className="text-[10px] font-bold text-primary truncate max-w-[50px]">
                                {booking.participant_name.split(' ')[0]}
                              </span>
                            </div>
                          ) : (
                            <span className="text-[10px] font-bold text-muted-foreground/60">
                              {lang === 'en' ? `Spot ${i + 1}` : `Место ${i + 1}`}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Booking form */}
                <AnimatePresence>
                  {isSelected && !isFull && !bookingComplete && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 pt-1 border-t border-border/30">
                        <p className="text-xs font-bold text-foreground mb-3 mt-3">
                          {lang === 'en' ? 'Choose your equipment:' : 'Выберите снаряд:'}
                        </p>
                        <div className="flex gap-3 mb-4">
                          {Array.from({ length: session.max_participants }, (_, i) => {
                            const taken = sBookings.some((b) => b.spot_number === i + 1);
                            const SpotIcon = spotIcons[i % spotIcons.length];
                            const spotLabel = lang === 'en' ? `Spot ${i + 1}` : `Место ${i + 1}`;
                            return (
                              <button
                                key={i}
                                disabled={taken}
                                onClick={() => setBookingSpot(i + 1)}
                                className={`flex-1 py-3 rounded-2xl flex flex-col items-center gap-1.5 transition-all ${
                                  taken
                                    ? 'bg-primary/10 text-primary/30 cursor-not-allowed'
                                    : bookingSpot === i + 1
                                      ? 'bg-primary text-primary-foreground scale-105 shadow-lg shadow-primary/20'
                                      : 'bg-secondary hover:bg-secondary/80 text-secondary-foreground'
                                }`}
                              >
                                <SpotIcon className="w-7 h-7" />
                                <span className="text-[10px] font-bold">{taken ? '✓' : spotLabel}</span>
                              </button>
                            );
                          })}
                        </div>

                        {bookingSpot !== null && (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="space-y-3"
                          >
                            <input
                              type="text"
                              placeholder={lang === 'en' ? 'Your name' : 'Ваше имя'}
                              value={name}
                              onChange={(e) => setName(e.target.value)}
                              className="w-full bg-secondary/50 border border-border/50 rounded-xl px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
                              maxLength={100}
                            />
                            <input
                              type="tel"
                              placeholder={lang === 'en' ? 'Phone number' : 'Номер телефона'}
                              value={phone}
                              onChange={(e) => setPhone(e.target.value)}
                              className="w-full bg-secondary/50 border border-border/50 rounded-xl px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
                              maxLength={20}
                            />
                            <div className="relative">
                              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">@</span>
                              <input
                                type="text"
                                placeholder={lang === 'en' ? 'Telegram username (for notifications)' : 'Telegram username (для уведомлений)'}
                                value={telegram}
                                onChange={(e) => setTelegram(e.target.value.replace('@', ''))}
                                className="w-full bg-secondary/50 border border-border/50 rounded-xl pl-8 pr-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
                                maxLength={50}
                              />
                            </div>
                            <p className="text-[10px] text-muted-foreground/60 flex items-center gap-1">
                              <Send className="w-3 h-3" />
                              {lang === 'en'
                                ? `Message @${TELEGRAM_BOT_USERNAME} on Telegram first to receive notifications`
                                : `Напишите @${TELEGRAM_BOT_USERNAME} в Telegram, чтобы получать уведомления`}
                            </p>
                            <div className="flex items-center justify-between bg-primary/10 rounded-xl p-3">
                              <span className="text-xs text-muted-foreground">
                                {lang === 'en' ? 'Price per person' : 'Цена за место'}
                              </span>
                              <span className="text-lg font-extrabold text-primary">€{session.price_per_person}</span>
                            </div>
                            <button
                              onClick={handleBookSpot}
                              disabled={submitting || !name.trim() || !phone.trim()}
                              className="w-full gradient-primary text-primary-foreground font-bold py-3.5 rounded-xl disabled:opacity-50 transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2"
                            >
                              {submitting ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <>
                                  <Check className="w-4 h-4" />
                                  {lang === 'en' ? 'Book & Pay €' + session.price_per_person : 'Забронировать и оплатить €' + session.price_per_person}
                                </>
                              )}
                            </button>
                          </motion.div>
                        )}
                      </div>
                    </motion.div>
                  )}

                  {/* Payment redirect after booking */}
                  {isSelected && bookingComplete && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 pt-1 border-t border-border/30">
                        <div className="bg-primary/10 rounded-2xl p-5 text-center mt-3">
                          <Check className="w-10 h-10 text-primary mx-auto mb-2" />
                          <h4 className="font-bold text-sm mb-1">
                            {lang === 'en' ? 'Spot reserved!' : 'Место забронировано!'}
                          </h4>
                          <p className="text-xs text-muted-foreground mb-4">
                            {lang === 'en'
                              ? 'Complete payment via Revolut to confirm your booking.'
                              : 'Завершите оплату через Revolut для подтверждения брони.'}
                          </p>
                          <button
                            onClick={handlePayment}
                            className="w-full bg-[#0075EB] hover:bg-[#0066CC] text-white font-bold py-3.5 rounded-xl transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2"
                          >
                            💳 {lang === 'en' ? `Pay €${session.price_per_person} via Revolut` : `Оплатить €${session.price_per_person} через Revolut`}
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default GroupTrainingSection;
