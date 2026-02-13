import { motion } from 'framer-motion';
import { Phone, MapPin, Facebook, Instagram, Send, MessageCircle, ArrowUpRight, Bot } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { translations } from '@/i18n/translations';
import type { Language } from '@/i18n/translations';

const ContactSection = () => {
  const { t, lang } = useLanguage();
  const contact = translations.contact;

  const socials = [
    { icon: Facebook, label: 'Facebook', href: 'https://www.facebook.com/illarion.ientin/' },
    { icon: Instagram, label: 'Instagram', href: 'https://www.instagram.com/illarion_ientin/' },
    { icon: Send, label: 'Telegram', href: 'https://t.me/Illarion_Ientin' },
    { icon: MessageCircle, label: 'WhatsApp', href: 'https://wa.me/35795144819' },
  ];

  return (
    <section className="min-h-screen px-5 pt-8 pb-28">
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-2xl font-extrabold uppercase tracking-tight mb-6"
      >
        {t(contact.title)}
      </motion.h2>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="space-y-3 mb-6"
      >
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
          href="https://maps.app.goo.gl/Jh2iDYPA7HyZGLbH7"
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
          href="https://t.me/LimassolFitness_bot"
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
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.1 }}
      >
        <h3 className="text-sm font-extrabold text-foreground uppercase tracking-wider mb-3">
          {lang === 'en' ? 'Social' : 'Соцсети'}
        </h3>
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
    </section>
  );
};

export default ContactSection;
