import { useState } from 'react';
import { motion } from 'framer-motion';
import { Award, Shield, Target, Handshake, Gem, Star, Phone, MapPin, Facebook, Instagram, Send, MessageCircle, ArrowUpRight, Bot, ChevronLeft, ChevronRight, Sparkles, Dumbbell, Activity, HeartPulse, Languages, Clock, ChevronDown, Calendar, Building2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { translations } from '@/i18n/translations';
import trainerPhoto from '@/assets/trainer-photo.jpg';
import nataliaBefore from '@/assets/transformation-natalia-before.jpeg';
import nataliaAfter from '@/assets/transformation-natalia-after.jpeg';
import veronikaBefore from '@/assets/transformation-veronika-before.jpeg';
import veronikaAfter from '@/assets/transformation-veronika-after.jpeg';
import pavelBefore from '@/assets/transformation-pavel-before.jpeg';
import pavelAfter from '@/assets/transformation-pavel-after.jpeg';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

const transformationPhotos: Record<number, { before: string; after: string }> = {
  0: { before: nataliaBefore, after: nataliaAfter },
  1: { before: pavelBefore, after: pavelAfter },
  2: { before: veronikaBefore, after: veronikaAfter },
};

const reasons = [
  {
    icon: Target,
    title: { en: 'High Standards', ru: 'Высокие стандарты' },
    desc: {
      en: 'Programs designed according to latest fitness trends ensuring targeted results.',
      ru: 'Программы разработаны по последним трендам фитнеса для достижения целевых результатов.',
    },
  },
  {
    icon: Handshake,
    title: { en: 'Full Support', ru: 'Полная поддержка' },
    desc: {
      en: 'Mentoring, accompaniment and monitoring throughout your training journey.',
      ru: 'Наставничество, сопровождение и контроль на протяжении всего пути.',
    },
  },
  {
    icon: Gem,
    title: { en: 'Great Value', ru: 'Отличная ценность' },
    desc: {
      en: 'Measurements, progress analysis, professional coaching all included.',
      ru: 'Замеры, анализ прогресса, профессиональный коучинг — всё включено.',
    },
  },
];

const specializations = [
  { icon: Dumbbell, label: { en: 'Strength & Hypertrophy', ru: 'Сила и гипертрофия' } },
  { icon: Activity, label: { en: 'HIIT & Conditioning', ru: 'HIIT и кондиция' } },
  { icon: HeartPulse, label: { en: 'Posture & Rehab (MFR)', ru: 'Осанка и реабилитация (MFR)' } },
  { icon: Sparkles, label: { en: 'Fat Loss & Body Recomp', ru: 'Жиросжигание и рекомпозиция' } },
  { icon: Target, label: { en: 'TRX & Functional', ru: 'TRX и функционал' } },
  { icon: Award, label: { en: 'Procedos & Animal Flow', ru: 'Procedos и Animal Flow' } },
];

const philosophy = {
  title: { en: 'My Philosophy', ru: 'Моя философия' },
  items: [
    {
      n: '01',
      title: { en: 'Technique first', ru: 'Сначала техника' },
      desc: {
        en: 'No heavy weights until movement is clean. Every rep is coached.',
        ru: 'Никакого веса, пока движение не чистое. Каждое повторение под контролем.',
      },
    },
    {
      n: '02',
      title: { en: 'Data-driven progress', ru: 'Прогресс по данным' },
      desc: {
        en: 'Measurements, photos, performance — we track what matters and adjust.',
        ru: 'Замеры, фото, показатели — отслеживаем главное и корректируем план.',
      },
    },
    {
      n: '03',
      title: { en: 'Sustainable lifestyle', ru: 'Устойчивый образ жизни' },
      desc: {
        en: 'Nutrition, sleep, recovery. The plan fits your life, not the other way around.',
        ru: 'Питание, сон, восстановление. План подстраивается под вашу жизнь.',
      },
    },
  ],
};

const faq = [
  {
    q: { en: 'Do I need fitness experience to start?', ru: 'Нужен ли опыт, чтобы начать?' },
    a: {
      en: 'No. Most clients start from zero. The first session is an assessment — we build the program around your level and goals.',
      ru: 'Нет. Большинство клиентов начинают с нуля. Первая сессия — это диагностика, программа строится под ваш уровень и цели.',
    },
  },
  {
    q: { en: 'How long is a session?', ru: 'Сколько длится тренировка?' },
    a: {
      en: '55 minutes of training + warm-up and cooldown. Plan for ~1 hour at the gym.',
      ru: '55 минут тренировки + разминка и заминка. Закладывайте ~1 час в зале.',
    },
  },
  {
    q: { en: 'How many times a week should I train?', ru: 'Сколько раз в неделю тренироваться?' },
    a: {
      en: '2–3 personal sessions per week give the best ratio of results to recovery for most clients.',
      ru: '2–3 персональные тренировки в неделю — лучший баланс результата и восстановления для большинства.',
    },
  },
  {
    q: { en: 'Is gym membership included?', ru: 'Входит ли абонемент в зал в цену?' },
    a: {
      en: 'No. Reload gym access is paid separately (150€/month). Personal training is a separate service.',
      ru: 'Нет. Доступ в Reload оплачивается отдельно (150€/мес). Персональные тренировки — отдельная услуга.',
    },
  },
  {
    q: { en: 'What about cancellation?', ru: 'Что с отменой тренировки?' },
    a: {
      en: 'Cancel or reschedule at least 24h before the session at no cost. Later cancellations count as a used session.',
      ru: 'Отмена или перенос минимум за 24 часа — без потерь. Позже — тренировка списывается.',
    },
  },
  {
    q: { en: 'Do you offer nutrition guidance?', ru: 'Есть ли сопровождение по питанию?' },
    a: {
      en: 'Yes. Built-in nutrition diary, AI photo analysis, calorie targets and weekly check-ins are part of the program.',
      ru: 'Да. Встроенный дневник питания, AI-анализ фото, цели по калориям и еженедельные чек-ины — часть программы.',
    },
  },
];

const languagesList = [
  { code: 'RU', label: { en: 'Russian', ru: 'Русский' } },
  { code: 'EN', label: { en: 'English', ru: 'Английский' } },
  { code: 'UA', label: { en: 'Ukrainian', ru: 'Украинский' } },
];

const hours = [
  { day: { en: 'Mon – Fri', ru: 'Пн – Пт' }, time: '07:00 – 20:00' },
  { day: { en: 'Sat – Sun', ru: 'Сб – Вс' }, time: { en: 'Closed', ru: 'Выходной' } },
];

const fade = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { delay, duration: 0.45 },
});

interface AboutSectionProps {
  onNavigate?: (section: string) => void;
  onBookClick?: () => void;
}

const AboutSection = ({ onNavigate, onBookClick }: AboutSectionProps) => {
  const { t, lang } = useLanguage();
  const { profile } = useAuth();
  const about = translations.about;
  const reviews = translations.reviews;
  const contact = translations.contact;
  const transformations = translations.transformations;
  const [activeTransformation, setActiveTransformation] = useState(0);

  const botLink = profile?.telegram_link_code
    ? `https://t.me/LimassolFitness_bot?start=${profile.telegram_link_code}`
    : 'https://t.me/LimassolFitness_bot';

  const socials = [
    { icon: Facebook, label: 'Facebook', href: 'https://www.facebook.com/illarion.ientin/' },
    { icon: Instagram, label: 'Instagram', href: 'https://www.instagram.com/illarion_ientin/' },
    { icon: Send, label: 'Telegram', href: 'https://t.me/Illarion_Ientin' },
    { icon: MessageCircle, label: 'WhatsApp', href: 'https://wa.me/35795144819' },
  ];

  const currentTransform = transformations.items[activeTransformation];
  const currentPhotos = transformationPhotos[activeTransformation];

  const handleBook = () => {
    if (onBookClick) onBookClick();
    else if (onNavigate) onNavigate('pricing');
  };

  return (
    <section className="min-h-screen pb-32" style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 0px)' }}>

      {/* ── Hero: Tall trainer photo with overlay ── */}
      <motion.div {...fade(0)} className="relative">
        <img
          src={trainerPhoto}
          alt="Illarion Ientin"
          className="w-full h-[70vh] max-h-[640px] min-h-[420px] object-cover object-top"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 px-5 pb-6">
          <span className="inline-block text-[10px] font-extrabold uppercase tracking-[0.25em] text-primary mb-2">
            {lang === 'en' ? 'Personal Trainer · Limassol' : 'Персональный тренер · Лимассол'}
          </span>
          <h1 className="text-5xl font-extrabold uppercase tracking-tight font-heading leading-[0.9]">
            {lang === 'en' ? 'ILLARION\nIENTIN' : 'ИЛЛАРИОН\nЕНТИН'}
          </h1>
          <div className="flex items-center gap-1.5 mt-3">
            <Shield className="w-4 h-4 text-primary" />
            <span className="text-xs text-primary font-bold">{t(about.accreditation)}</span>
          </div>
        </div>
      </motion.div>

      <div className="px-5">

        {/* ── Stats ── */}
        <motion.div {...fade(0.1)} className="grid grid-cols-3 gap-3 mt-5 mb-6">
          {[
            { value: '200+', label: lang === 'en' ? 'Clients' : 'Клиентов' },
            { value: '8+', label: lang === 'en' ? 'Years' : 'Лет опыта' },
            { value: 'EQF 4', label: lang === 'en' ? 'Level' : 'Уровень' },
          ].map((stat, i) => (
            <div key={i} className="text-center py-3 rounded-2xl bg-card border border-border/50">
              <div className="text-xl font-extrabold text-primary font-heading">{stat.value}</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold mt-0.5">{stat.label}</div>
            </div>
          ))}
        </motion.div>

        {/* ── Primary CTA: Book ── */}
        <motion.button
          {...fade(0.12)}
          onClick={handleBook}
          className="w-full mb-6 rounded-2xl gradient-primary text-primary-foreground py-4 px-5 flex items-center justify-center gap-2 font-extrabold uppercase tracking-wider text-sm shadow-lg shadow-primary/30 active:scale-[0.98] transition-transform"
        >
          <Calendar className="w-5 h-5" />
          {lang === 'en' ? 'Book a session' : 'Записаться на тренировку'}
        </motion.button>

        {/* ── Bio ── */}
        <motion.div {...fade(0.15)} className="mb-8">
          <p className="text-sm text-muted-foreground leading-relaxed">
            {t(about.bio)}
          </p>
        </motion.div>

        {/* ── Philosophy ── */}
        <motion.div {...fade(0.18)} className="mb-8">
          <h2 className="text-sm font-extrabold uppercase tracking-wider mb-4">
            {t(philosophy.title)}
          </h2>
          <div className="space-y-2.5">
            {philosophy.items.map((p, i) => (
              <div key={i} className="bg-card rounded-2xl border border-border/50 p-4 flex gap-3">
                <div className="text-2xl font-heading font-extrabold text-primary/70 leading-none shrink-0 w-9">{p.n}</div>
                <div>
                  <h3 className="text-sm font-extrabold mb-1">{t(p.title)}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{t(p.desc)}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* ── Specializations ── */}
        <motion.div {...fade(0.2)} className="mb-8">
          <h2 className="text-sm font-extrabold uppercase tracking-wider mb-4">
            {lang === 'en' ? 'Specializations' : 'Специализации'}
          </h2>
          <div className="grid grid-cols-2 gap-2.5">
            {specializations.map((s, i) => {
              const Icon = s.icon;
              return (
                <div key={i} className="flex items-center gap-2.5 bg-card border border-border/50 rounded-xl p-3">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-primary" />
                  </div>
                  <span className="text-xs font-bold leading-tight">{t(s.label)}</span>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* ── Why me ── */}
        <motion.div {...fade(0.22)} className="mb-8">
          <h2 className="text-sm font-extrabold uppercase tracking-wider mb-4">
            {lang === 'en' ? 'Why Train With Me' : 'Почему я'}
          </h2>
          <div className="grid grid-cols-3 gap-3">
            {reasons.map((reason, i) => {
              const Icon = reason.icon;
              const colors = [
                'from-primary/20 to-primary/5 border-primary/20',
                'from-blue-500/20 to-blue-500/5 border-blue-500/20',
                'from-emerald-500/20 to-emerald-500/5 border-emerald-500/20',
              ];
              return (
                <div key={i} className={`rounded-2xl border bg-gradient-to-br ${colors[i]} p-3.5 text-center`}>
                  <div className="w-11 h-11 rounded-xl bg-background/50 flex items-center justify-center mx-auto mb-2.5">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="text-[11px] font-extrabold mb-1 leading-tight">{t(reason.title)}</h3>
                  <p className="text-[9px] text-muted-foreground leading-relaxed">{t(reason.desc)}</p>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* ── Transformations — carousel ── */}
        <motion.div {...fade(0.25)} className="mb-8">
          <h2 className="text-sm font-extrabold uppercase tracking-wider mb-1">
            {t(transformations.title)}
          </h2>
          <p className="text-xs text-muted-foreground mb-4">{t(transformations.subtitle)}</p>

          {/* Before/After photos */}
          {currentPhotos && (
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="relative rounded-2xl overflow-hidden">
                <img src={currentPhotos.before} alt="Before" className="w-full h-48 object-cover object-top" />
                <span className="absolute bottom-2 left-2 bg-background/80 backdrop-blur-sm text-foreground text-[10px] font-bold px-2 py-0.5 rounded-lg uppercase">
                  {lang === 'en' ? 'Before' : 'До'}
                </span>
              </div>
              <div className="relative rounded-2xl overflow-hidden">
                <img src={currentPhotos.after} alt="After" className="w-full h-48 object-cover object-top" />
                <span className="absolute bottom-2 left-2 bg-primary/90 text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-lg uppercase">
                  {lang === 'en' ? 'After' : 'После'}
                </span>
              </div>
            </div>
          )}

          {/* Info card */}
          <div className="bg-card rounded-2xl border border-border/50 p-4 mb-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center text-primary-foreground font-bold text-sm">
                  {t(currentTransform.name).charAt(0)}
                </div>
                <div>
                  <h4 className="text-sm font-bold">{t(currentTransform.name)}</h4>
                  <p className="text-[10px] text-muted-foreground">{t(currentTransform.duration)}</p>
                </div>
              </div>
              <div className="bg-primary/15 text-primary text-xs font-extrabold px-2.5 py-1 rounded-lg">
                {currentTransform.metric}
              </div>
            </div>
            <p className="text-xs font-bold text-primary mb-1">{t(currentTransform.result)}</p>
            <p className="text-[11px] text-muted-foreground leading-relaxed">{t(currentTransform.desc)}</p>
          </div>

          {/* Carousel dots + arrows */}
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => setActiveTransformation((activeTransformation - 1 + transformations.items.length) % transformations.items.length)}
              className="w-8 h-8 rounded-full bg-card border border-border/50 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex gap-2">
              {transformations.items.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActiveTransformation(i)}
                  className={`w-2 h-2 rounded-full transition-all ${
                    i === activeTransformation ? 'bg-primary w-5' : 'bg-muted-foreground/30'
                  }`}
                />
              ))}
            </div>
            <button
              onClick={() => setActiveTransformation((activeTransformation + 1) % transformations.items.length)}
              className="w-8 h-8 rounded-full bg-card border border-border/50 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </motion.div>

        {/* ── Reviews from Google ── */}
        <motion.div {...fade(0.3)} className="mb-8">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-sm font-extrabold uppercase tracking-wider">{t(reviews.title)}</h2>
            <a
              href="https://maps.app.goo.gl/WYfEfPT6yYauYg3j7"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 bg-card px-3 py-1.5 rounded-xl border border-border/50 text-xs font-bold text-primary shrink-0"
            >
              <Star className="w-3.5 h-3.5 fill-primary text-primary" />
              5.0
            </a>
          </div>
          <p className="text-[11px] text-muted-foreground mb-4">{t(reviews.subtitle)}</p>
          <div className="space-y-3">
            {reviews.items.map((review, i) => (
              <div key={i} className="bg-card rounded-2xl border border-border/50 p-4 relative">
                <div className="flex items-center gap-2.5 mb-2.5">
                  <div className="w-9 h-9 rounded-full gradient-primary flex items-center justify-center text-primary-foreground font-bold text-sm">
                    {t(review.name).charAt(0)}
                  </div>
                  <div className="flex-1">
                    <h4 className="text-xs font-bold">{t(review.name)}</h4>
                    <div className="flex items-center gap-2 mt-0.5">
                      <div className="flex gap-0.5">
                        {Array.from({ length: review.rating }).map((_, j) => (
                          <Star key={j} className="w-2.5 h-2.5 fill-primary text-primary" />
                        ))}
                      </div>
                      <span className="text-[10px] text-muted-foreground/60">{t(review.timeAgo)}</span>
                    </div>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">{t(review.desc)}</p>
              </div>
            ))}
          </div>
          <a
            href="https://maps.app.goo.gl/WYfEfPT6yYauYg3j7"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 flex items-center justify-center gap-2 text-xs text-primary font-semibold hover:underline"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4"><path fill="currentColor" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
            {lang === 'en' ? 'All reviews on Google Maps' : 'Все отзывы на Google Картах'}
          </a>
        </motion.div>

        {/* ── Certifications ── */}
        <motion.div {...fade(0.32)} className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <Award className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-extrabold uppercase tracking-wider">{t(about.certifications)}</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {about.certs.map((cert, i) => (
              <span
                key={i}
                className="px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-bold border border-primary/20"
              >
                {cert}
              </span>
            ))}
          </div>
        </motion.div>

        {/* ── Languages ── */}
        <motion.div {...fade(0.34)} className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <Languages className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-extrabold uppercase tracking-wider">
              {lang === 'en' ? 'Languages' : 'Языки'}
            </h2>
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            {languagesList.map((l, i) => (
              <div key={i} className="bg-card border border-border/50 rounded-xl p-3 text-center">
                <div className="text-base font-heading font-extrabold text-primary">{l.code}</div>
                <div className="text-[11px] font-bold mt-1">{t(l.label)}</div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* ── Working Hours ── */}
        <motion.div {...fade(0.36)} className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-extrabold uppercase tracking-wider">
              {lang === 'en' ? 'Working Hours' : 'Часы работы'}
            </h2>
          </div>
          <div className="bg-card border border-border/50 rounded-2xl overflow-hidden">
            {hours.map((h, i) => (
              <div
                key={i}
                className={`flex items-center justify-between px-4 py-3 ${
                  i < hours.length - 1 ? 'border-b border-border/40' : ''
                }`}
              >
                <span className="text-xs font-bold">{t(h.day)}</span>
                <span className="text-xs font-bold text-primary tabular-nums">
                  {typeof h.time === 'string' ? h.time : t(h.time)}
                </span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* ── Gym: Reload ── */}
        <motion.div {...fade(0.38)} className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <Building2 className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-extrabold uppercase tracking-wider">
              {lang === 'en' ? 'Training Gym' : 'Тренируемся в'}
            </h2>
          </div>
          <a
            href="https://reload-fitness.com"
            target="_blank"
            rel="noopener noreferrer"
            className="relative block overflow-hidden rounded-2xl border border-border/50 bg-foreground hover:border-primary/40 transition-colors active:scale-[0.99]"
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/0.18),transparent_60%)] pointer-events-none" />
            <div className="relative p-5 flex items-center gap-4">
              {/* Reload brand mark (matches their minimal black/white identity) */}
              <div className="shrink-0 flex flex-col items-center justify-center px-3 py-2 border-2 border-background rounded">
                <span className="text-background text-2xl font-heading font-extrabold uppercase tracking-[0.12em] leading-none">
                  Reload
                </span>
                <span className="text-background/70 text-[8px] font-bold uppercase tracking-[0.3em] leading-none mt-1">
                  Fitness Studio
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-background text-sm font-bold leading-snug">
                  {lang === 'en' ? 'Our training partner in Limassol' : 'Наш зал-партнёр в Лимассоле'}
                </p>
                <p className="text-background/70 text-[11px] mt-1 leading-snug">{t(contact.address)}</p>
                <p className="text-primary text-[11px] font-extrabold uppercase tracking-wider mt-2 flex items-center gap-1">
                  reload-fitness.com
                  <ArrowUpRight className="w-3 h-3" />
                </p>
              </div>
            </div>
          </a>
        </motion.div>

        {/* ── FAQ ── */}
        <motion.div {...fade(0.4)} className="mb-8">
          <h2 className="text-sm font-extrabold uppercase tracking-wider mb-3">
            {lang === 'en' ? 'FAQ' : 'Частые вопросы'}
          </h2>
          <div className="bg-card border border-border/50 rounded-2xl px-4">
            <Accordion type="single" collapsible className="w-full">
              {faq.map((item, i) => (
                <AccordionItem
                  key={i}
                  value={`item-${i}`}
                  className={`${i === faq.length - 1 ? 'border-b-0' : 'border-border/40'}`}
                >
                  <AccordionTrigger className="text-left text-xs font-bold hover:no-underline py-3.5">
                    {t(item.q)}
                  </AccordionTrigger>
                  <AccordionContent className="text-[11px] text-muted-foreground leading-relaxed pb-3.5">
                    {t(item.a)}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </motion.div>

        {/* ── Contact ── */}
        <motion.div {...fade(0.42)} className="mb-6">
          <h2 className="text-sm font-extrabold uppercase tracking-wider mb-3">{t(contact.title)}</h2>

          <div className="space-y-3 mb-4">
            <a href="tel:+35795144819" className="flex items-center gap-3 bg-card rounded-2xl p-3.5 border border-border/50 hover:border-primary/30 transition-colors">
              <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shrink-0">
                <Phone className="w-5 h-5 text-primary-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">{lang === 'en' ? 'Call' : 'Позвонить'}</p>
                <p className="text-sm font-bold">{contact.phone}</p>
              </div>
              <ArrowUpRight className="w-4 h-4 text-muted-foreground shrink-0" />
            </a>

            <a
              href={botLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 bg-card rounded-2xl p-3.5 border border-border/50 hover:border-primary/30 transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
                <Bot className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Telegram Bot</p>
                <p className="text-sm font-bold">{lang === 'en' ? 'Get notifications' : 'Получать уведомления'}</p>
              </div>
              <ArrowUpRight className="w-4 h-4 text-muted-foreground shrink-0" />
            </a>
          </div>

          {/* Socials */}
          <div className="grid grid-cols-4 gap-2 mb-6">
            {socials.map((s, i) => (
              <a
                key={i}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-card rounded-xl p-3 flex flex-col items-center gap-1.5 border border-border/50 hover:border-primary/30 transition-all active:scale-95"
              >
                <s.icon className="w-5 h-5 text-primary" />
                <span className="text-[9px] font-bold text-muted-foreground">{s.label}</span>
              </a>
            ))}
          </div>
        </motion.div>

        {/* ── Map (at the very bottom) ── */}
        <motion.div {...fade(0.45)}>
          <div className="flex items-center gap-3 mb-3">
            <MapPin className="w-4 h-4 text-primary shrink-0" />
            <div>
              <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">{lang === 'en' ? 'Location' : 'Адрес'}</p>
              <p className="text-sm font-bold">{t(contact.address)}</p>
            </div>
          </div>
          <div className="rounded-2xl overflow-hidden border border-border/50">
            <iframe
              src="https://www.google.com/maps?q=Limassol+Fitness,+Eleftherias+109,+Limassol,+Cyprus&output=embed"
              width="100%"
              height="200"
              style={{ border: 0 }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="Limassol Fitness on Google Maps"
            />
          </div>
          <a
            href="https://maps.app.goo.gl/WYfEfPT6yYauYg3j7"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 text-xs text-primary font-semibold mt-2 hover:underline"
          >
            {lang === 'en' ? 'Open in Google Maps' : 'Открыть в Google Картах'}
            <ArrowUpRight className="w-3.5 h-3.5" />
          </a>
        </motion.div>

        {/* ── Final CTA: Book ── */}
        <motion.button
          {...fade(0.48)}
          onClick={handleBook}
          className="w-full mt-8 rounded-2xl gradient-primary text-primary-foreground py-4 px-5 flex items-center justify-center gap-2 font-extrabold uppercase tracking-wider text-sm shadow-lg shadow-primary/30 active:scale-[0.98] transition-transform"
        >
          <Calendar className="w-5 h-5" />
          {lang === 'en' ? 'Book a session' : 'Записаться на тренировку'}
        </motion.button>
      </div>
    </section>
  );
};

export default AboutSection;
