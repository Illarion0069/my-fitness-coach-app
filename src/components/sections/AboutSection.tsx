import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Award, Shield, Target, Handshake, Gem, ChevronRight, ChevronDown, Star, ExternalLink, Phone, MapPin, Facebook, Instagram, Send, MessageCircle, ArrowUpRight, Bot, Quote } from 'lucide-react';
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
    stat: { value: '200+', label: { en: 'clients', ru: 'клиентов' } },
  },
  {
    icon: Handshake,
    title: { en: 'Full Support', ru: 'Полная поддержка' },
    desc: {
      en: 'Mentoring, accompaniment and monitoring throughout your training journey.',
      ru: 'Наставничество, сопровождение и контроль на протяжении всего пути.',
    },
    stat: { value: '24/7', label: { en: 'support', ru: 'на связи' } },
  },
  {
    icon: Gem,
    title: { en: 'Great Value', ru: 'Отличная ценность' },
    desc: {
      en: 'Measurements, progress analysis, professional coaching all included.',
      ru: 'Замеры, анализ прогресса, профессиональный коучинг — всё включено.',
    },
    stat: { value: '8+', label: { en: 'years exp', ru: 'лет опыта' } },
  },
];

const AboutSection = () => {
  const { t, lang } = useLanguage();
  const { profile } = useAuth();
  const about = translations.about;
  const reviews = translations.reviews;
  const contact = translations.contact;
  const transformations = translations.transformations;
  const [photoExpanded, setPhotoExpanded] = useState(false);
  const [expandedReason, setExpandedReason] = useState<number | null>(null);
  const [transformationsOpen, setTransformationsOpen] = useState(false);

  const botLink = profile?.telegram_link_code
    ? `https://t.me/LimassolFitness_bot?start=${profile.telegram_link_code}`
    : 'https://t.me/LimassolFitness_bot';

  const socials = [
    { icon: Facebook, label: 'Facebook', href: 'https://www.facebook.com/illarion.ientin/' },
    { icon: Instagram, label: 'Instagram', href: 'https://www.instagram.com/illarion_ientin/' },
    { icon: Send, label: 'Telegram', href: 'https://t.me/Illarion_Ientin' },
    { icon: MessageCircle, label: 'WhatsApp', href: 'https://wa.me/35795144819' },
  ];

  return (
    <section className="min-h-screen px-5 pb-28" style={{ paddingTop: 'max(env(safe-area-inset-top, 32px), 32px)' }}>
      {/* Hero banner with trainer photo */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative rounded-3xl overflow-hidden mb-6"
      >
        <img
          src={trainerPhoto}
          alt="Illarion Ientin"
          onClick={() => setPhotoExpanded(true)}
          className="w-full h-48 object-cover object-top cursor-pointer"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-5">
          <h2 className="text-2xl font-extrabold uppercase tracking-tight font-heading">
            {lang === 'en' ? 'ILLARION IENTIN' : 'ИЛЛАРИОН ЕНТИН'}
          </h2>
          <div className="flex items-center gap-1.5 mt-1">
            <Shield className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs text-primary font-bold">{t(about.accreditation)}</span>
          </div>
        </div>
      </motion.div>

      {/* Stats row */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-3 gap-3 mb-6"
      >
        {[
          { value: '200+', label: lang === 'en' ? 'Clients' : 'Клиентов' },
          { value: '8+', label: lang === 'en' ? 'Years' : 'Лет' },
          { value: 'EQF 4', label: lang === 'en' ? 'Level' : 'Уровень' },
        ].map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 + i * 0.1 }}
            className="bg-card border border-border/50 rounded-2xl p-3 text-center"
          >
            <div className="text-xl font-extrabold text-primary font-heading">{stat.value}</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">{stat.label}</div>
          </motion.div>
        ))}
      </motion.div>

      {/* ─── Transformations (collapsible) ─── */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="mb-6"
      >
        <button
          onClick={() => setTransformationsOpen(!transformationsOpen)}
          className="w-full flex items-center justify-between mb-1"
        >
          <div>
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-left">{t(transformations.title)}</h3>
            <p className="text-xs text-muted-foreground text-left">{t(transformations.subtitle)}</p>
          </div>
          <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform shrink-0 ml-2 ${transformationsOpen ? 'rotate-180' : ''}`} />
        </button>
        <AnimatePresence>
          {transformationsOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <div className="space-y-3 mt-3">
                {transformations.items.map((item, i) => {
                  const photos = transformationPhotos[i];
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -15 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.08 }}
                      className="bg-card rounded-2xl border border-border/50 p-4"
                    >
                      {photos && (
                        <div className="grid grid-cols-2 gap-2 mb-3">
                          <div className="relative rounded-xl overflow-hidden">
                            <img src={photos.before} alt="Before" className="w-full h-44 object-cover object-top" />
                            <span className="absolute bottom-1 left-1 bg-black/60 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase">
                              {lang === 'en' ? 'Before' : 'До'}
                            </span>
                          </div>
                          <div className="relative rounded-xl overflow-hidden">
                            <img src={photos.after} alt="After" className="w-full h-44 object-cover object-top" />
                            <span className="absolute bottom-1 left-1 bg-primary/80 text-primary-foreground text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase">
                              {lang === 'en' ? 'After' : 'После'}
                            </span>
                          </div>
                        </div>
                      )}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center text-primary-foreground font-bold text-sm">
                            {t(item.name).charAt(0)}
                          </div>
                          <div>
                            <h4 className="text-sm font-bold">{t(item.name)}</h4>
                            <p className="text-[10px] text-muted-foreground">{t(item.duration)}</p>
                          </div>
                        </div>
                        <div className="bg-primary/15 text-primary text-xs font-extrabold px-2.5 py-1 rounded-lg">
                          {item.metric}
                        </div>
                      </div>
                      <p className="text-xs font-bold text-primary mb-1">{t(item.result)}</p>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">{t(item.desc)}</p>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ─── Reviews (Google Maps embed) ─── */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mb-6"
      >
        <div className="flex items-end justify-between mb-3">
          <h3 className="text-sm font-extrabold uppercase tracking-wider">{t(reviews.title)}</h3>
          <a
            href="https://maps.app.goo.gl/BfsgGGsJaB5QCvsD9"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 bg-card px-2.5 py-1 rounded-xl border border-border/50 text-xs font-bold text-primary shrink-0"
          >
            <Star className="w-3.5 h-3.5 fill-primary text-primary" />
            5.0
          </a>
        </div>

        {/* Google Maps Place Embed */}
        <div className="rounded-2xl overflow-hidden border border-border/50 mb-3">
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
          className="flex items-center justify-center gap-2 text-xs text-primary font-semibold hover:underline"
        >
          {lang === 'en' ? 'See all reviews on Google Maps' : 'Все отзывы на Google Картах'}
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </motion.div>

      {/* ─── Why me cards ─── */}
      <div className="space-y-3 mb-6">
        {reasons.map((reason, i) => {
          const Icon = reason.icon;
          const isExpanded = expandedReason === i;
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + i * 0.1 }}
              onClick={() => setExpandedReason(isExpanded ? null : i)}
              className={`bg-card rounded-2xl border cursor-pointer transition-all duration-300 ${
                isExpanded ? 'border-primary shadow-lg shadow-primary/10' : 'border-border/50'
              }`}
            >
              <div className="p-4 flex items-center gap-3">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center transition-colors ${
                  isExpanded ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary'
                }`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-bold">{t(reason.title)}</h4>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-xs font-extrabold text-primary">{reason.stat.value}</span>
                    <span className="text-[10px] text-muted-foreground">{t(reason.stat.label)}</span>
                  </div>
                </div>
                <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform duration-300 ${isExpanded ? 'rotate-90' : ''}`} />
              </div>
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden"
                  >
                    <p className="px-4 pb-4 text-xs text-muted-foreground leading-relaxed">
                      {t(reason.desc)}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      {/* Certifications */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="bg-card rounded-2xl border border-border/50 p-4 mb-6"
      >
        <div className="flex items-center gap-2 mb-3">
          <Award className="w-4 h-4 text-primary" />
          <h3 className="text-xs font-bold uppercase tracking-wider">{t(about.certifications)}</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {about.certs.map((cert, i) => (
            <motion.span
              key={cert}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.7 + i * 0.05 }}
              className="px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-bold border border-primary/20"
            >
              {cert}
            </motion.span>
          ))}
        </div>
      </motion.div>

      {/* ─── Contact ─── */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
      >
        <h3 className="text-sm font-extrabold uppercase tracking-wider mb-3">{t(contact.title)}</h3>
        <div className="space-y-3 mb-4">
          <a href="tel:+35795144819" className="flex items-center gap-4 bg-card rounded-2xl p-4 border border-border/50 hover:border-primary/30 transition-colors">
            <div className="w-11 h-11 rounded-xl gradient-primary flex items-center justify-center shrink-0">
              <Phone className="w-5 h-5 text-primary-foreground" />
            </div>
            <div className="flex-1">
              <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">{lang === 'en' ? 'Call' : 'Позвонить'}</p>
              <p className="text-sm font-bold text-foreground">{contact.phone}</p>
            </div>
            <ArrowUpRight className="w-4 h-4 text-muted-foreground" />
          </a>

          <a
            href="https://maps.app.goo.gl/BfsgGGsJaB5QCvsD9"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-4 bg-card rounded-2xl p-4 border border-border/50 hover:border-primary/30 transition-colors"
          >
            <div className="w-11 h-11 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
              <MapPin className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">{lang === 'en' ? 'Location' : 'Адрес'}</p>
              <p className="text-sm font-bold text-foreground">{t(contact.address)}</p>
            </div>
            <ArrowUpRight className="w-4 h-4 text-muted-foreground" />
          </a>

          <a
            href={botLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-4 bg-card rounded-2xl p-4 border border-border/50 hover:border-primary/30 transition-colors"
          >
            <div className="w-11 h-11 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
              <Bot className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Telegram Bot</p>
              <p className="text-sm font-bold text-foreground">
                {lang === 'en' ? 'Get notifications' : 'Получать уведомления'}
              </p>
            </div>
            <ArrowUpRight className="w-4 h-4 text-muted-foreground" />
          </a>
        </div>

        <h4 className="text-xs font-extrabold text-foreground uppercase tracking-wider mb-3">
          {lang === 'en' ? 'Social' : 'Соцсети'}
        </h4>
        <div className="grid grid-cols-2 gap-3">
          {socials.map((s, i) => (
            <a
              key={i}
              href={s.href}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-card rounded-2xl p-4 flex items-center gap-3 border border-border/50 hover:border-primary/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <s.icon className="w-5 h-5 text-primary" />
              <span className="text-sm font-bold">{s.label}</span>
            </a>
          ))}
        </div>
      </motion.div>

      {/* Photo lightbox */}
      <AnimatePresence>
        {photoExpanded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setPhotoExpanded(false)}
            className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-8"
          >
            <motion.img
              src={trainerPhoto}
              alt="Illarion Ientin"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ type: 'spring', damping: 25 }}
              className="max-w-full max-h-[70vh] rounded-2xl object-cover shadow-2xl"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};

export default AboutSection;
