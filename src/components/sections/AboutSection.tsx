import { useState } from 'react';
import { motion } from 'framer-motion';
import { Award, Shield, Target, Handshake, Gem, Star, Phone, MapPin, Facebook, Instagram, Send, MessageCircle, ArrowUpRight, Bot, ChevronLeft, ChevronRight } from 'lucide-react';
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

const fade = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { delay, duration: 0.45 },
});

const AboutSection = () => {
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

  return (
    <section className="min-h-screen pb-28" style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 0px)' }}>

      {/* ── Hero: Full-width trainer photo with overlay ── */}
      <motion.div {...fade(0)} className="relative">
        <img
          src={trainerPhoto}
          alt="Illarion Ientin"
          className="w-full h-64 object-cover object-top"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 px-5 pb-5">
          <h1 className="text-3xl font-extrabold uppercase tracking-tight font-heading leading-none">
            {lang === 'en' ? 'ILLARION IENTIN' : 'ИЛЛАРИОН ЕНТИН'}
          </h1>
          <div className="flex items-center gap-1.5 mt-1.5">
            <Shield className="w-3.5 h-3.5 text-primary" />
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

        {/* ── Bio ── */}
        <motion.div {...fade(0.15)} className="mb-8">
          <p className="text-sm text-muted-foreground leading-relaxed">
            {t(about.bio)}
          </p>
        </motion.div>

        {/* ── Why me ── */}
        <motion.div {...fade(0.2)} className="mb-8">
          <h2 className="text-sm font-extrabold uppercase tracking-wider mb-4">
            {lang === 'en' ? 'Why Train With Me' : 'Почему я'}
          </h2>
          <div className="space-y-3">
            {reasons.map((reason, i) => {
              const Icon = reason.icon;
              return (
                <div key={i} className="flex gap-3.5 items-start">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold mb-0.5">{t(reason.title)}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">{t(reason.desc)}</p>
                  </div>
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

        {/* ── Reviews ── */}
        <motion.div {...fade(0.3)} className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-extrabold uppercase tracking-wider">{t(reviews.title)}</h2>
            <a
              href="https://maps.app.goo.gl/BfsgGGsJaB5QCvsD9"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs font-bold text-primary"
            >
              <Star className="w-3.5 h-3.5 fill-primary text-primary" />
              5.0 Google
            </a>
          </div>
          <div className="space-y-3">
            {reviews.items.map((review, i) => (
              <div key={i} className="bg-card rounded-2xl border border-border/50 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center text-primary-foreground font-bold text-xs">
                    {t(review.name).split(' ').map(w => w[0]).join('')}
                  </div>
                  <div className="flex-1">
                    <h4 className="text-xs font-bold">{t(review.name)}</h4>
                    <div className="flex gap-0.5">
                      {Array.from({ length: review.rating }).map((_, j) => (
                        <Star key={j} className="w-2.5 h-2.5 fill-primary text-primary" />
                      ))}
                    </div>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">{t(review.desc)}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* ── Certifications ── */}
        <motion.div {...fade(0.35)} className="mb-8">
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

        {/* ── Contact ── */}
        <motion.div {...fade(0.4)} className="mb-6">
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
            href="https://maps.app.goo.gl/BfsgGGsJaB5QCvsD9"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 text-xs text-primary font-semibold mt-2 hover:underline"
          >
            {lang === 'en' ? 'Open in Google Maps' : 'Открыть в Google Картах'}
            <ArrowUpRight className="w-3.5 h-3.5" />
          </a>
        </motion.div>
      </div>
    </section>
  );
};

export default AboutSection;
