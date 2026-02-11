import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Calendar, Clock, MapPin, Check, Loader2 } from 'lucide-react';
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

const GroupTrainingSection = () => {
  const { lang } = useLanguage();
  const { toast } = useToast();
  const [sessions, setSessions] = useState<GroupSession[]>([]);
  const [bookings, setBookings] = useState<GroupBooking[]>([]);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [bookingSpot, setBookingSpot] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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
      const { error } = await supabase.from('group_bookings').insert({
        session_id: selectedSession,
        participant_name: name.trim(),
        participant_phone: phone.trim(),
        spot_number: bookingSpot,
      });
      if (error) throw error;

      // Notify via edge function
      const sessionBookings = getSessionBookings(selectedSession);
      const session = sessions.find((s) => s.id === selectedSession);
      const spotsAfter = sessionBookings.length + 1;

      await supabase.functions.invoke('send-telegram', {
        body: {
          message: `🏋️ <b>Group Training Booking!</b>\n\n👤 ${name.trim()}\n📱 ${phone.trim()}\n📅 ${session ? formatDate(session.session_date) : ''} ${session ? formatTime(session.start_time) : ''}\n💺 Spot ${bookingSpot}/3\n\n${spotsAfter >= 3 ? '✅ GROUP IS FULL — CLASS CONFIRMED!' : `⏳ ${spotsAfter}/3 spots filled`}`,
        },
      });

      toast({
        title: lang === 'en' ? 'Spot booked!' : 'Место забронировано!',
        description: lang === 'en'
          ? spotsAfter >= 3
            ? 'Group is full — class confirmed! You will receive a confirmation.'
            : `${spotsAfter}/3 spots filled. We'll notify you when the group is complete.`
          : spotsAfter >= 3
            ? 'Группа собрана — занятие состоится! Вы получите подтверждение.'
            : `${spotsAfter}/3 мест занято. Мы уведомим вас, когда группа соберётся.`,
      });

      setSelectedSession(null);
      setBookingSpot(null);
      setName('');
      setPhone('');
      await fetchBookings();
    } catch (err: any) {
      const isDuplicate = err?.code === '23505';
      toast({
        title: lang === 'en' ? 'Error' : 'Ошибка',
        description: isDuplicate
          ? lang === 'en' ? 'This spot is already taken or you already booked this session.' : 'Это место уже занято или вы уже записаны на эту тренировку.'
          : lang === 'en' ? 'Failed to book. Please try again.' : 'Не удалось забронировать. Попробуйте снова.',
        variant: 'destructive',
      });
    }
    setSubmitting(false);
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
          <h2 className="text-2xl font-extrabold uppercase tracking-tight">
            {lang === 'en' ? 'Group Training' : 'Групповые тренировки'}
          </h2>
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          {lang === 'en'
            ? 'Book your spot! Training happens when all 3 spots are filled. €20 per person.'
            : 'Займите место! Тренировка состоится, когда соберутся 3 человека. €20 с человека.'}
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
                  onClick={() => setSelectedSession(isSelected ? null : session.id)}
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

                  {/* Spots visualization */}
                  <div className="flex gap-2 mt-3">
                    {Array.from({ length: session.max_participants }, (_, i) => {
                      const booking = sBookings.find((b) => b.spot_number === i + 1);
                      return (
                        <div
                          key={i}
                          className={`flex-1 h-10 rounded-xl flex items-center justify-center text-xs font-bold transition-all ${
                            booking
                              ? 'bg-primary/20 text-primary border border-primary/30'
                              : 'bg-secondary/50 text-muted-foreground border border-border/30'
                          }`}
                        >
                          {booking ? (
                            <div className="flex items-center gap-1">
                              <Check className="w-3.5 h-3.5" />
                              <span className="truncate max-w-[60px]">{booking.participant_name.split(' ')[0]}</span>
                            </div>
                          ) : (
                            <span>{lang === 'en' ? `Spot ${i + 1}` : `Место ${i + 1}`}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Booking form */}
                <AnimatePresence>
                  {isSelected && !isFull && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 pt-1 border-t border-border/30">
                        <p className="text-xs font-bold text-foreground mb-3 mt-3">
                          {lang === 'en' ? 'Choose your spot:' : 'Выберите место:'}
                        </p>
                        <div className="flex gap-2 mb-4">
                          {Array.from({ length: session.max_participants }, (_, i) => {
                            const taken = sBookings.some((b) => b.spot_number === i + 1);
                            return (
                              <button
                                key={i}
                                disabled={taken}
                                onClick={() => setBookingSpot(i + 1)}
                                className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${
                                  taken
                                    ? 'bg-primary/10 text-primary/50 cursor-not-allowed'
                                    : bookingSpot === i + 1
                                      ? 'bg-primary text-primary-foreground scale-105'
                                      : 'bg-secondary hover:bg-secondary/80 text-secondary-foreground'
                                }`}
                              >
                                {taken ? '✓' : i + 1}
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
                                  {lang === 'en' ? 'Book Spot' : 'Забронировать'}
                                </>
                              )}
                            </button>
                          </motion.div>
                        )}
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
