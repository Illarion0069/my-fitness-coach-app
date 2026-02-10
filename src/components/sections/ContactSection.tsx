import { motion } from 'framer-motion';
import { Phone, MapPin, Facebook, Instagram, Send, MessageCircle } from 'lucide-react';
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
        className="font-display text-4xl tracking-wide mb-7"
      >
        {t(contact.title)}
      </motion.h2>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="bg-card rounded-2xl p-5 space-y-5 mb-6 border border-border/50"
      >
        <a href="tel:+35795144819" className="flex items-center gap-3.5 hover:text-primary transition-colors">
          <div className="w-11 h-11 rounded-xl gradient-primary flex items-center justify-center">
            <Phone className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="text-sm font-semibold">{contact.phone}</span>
        </a>

        <a
          href="https://maps.app.goo.gl/Jh2iDYPA7HyZGLbH7"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3.5 hover:text-primary transition-colors"
        >
          <div className="w-11 h-11 rounded-xl bg-primary/15 flex items-center justify-center">
            <MapPin className="w-5 h-5 text-primary" />
          </div>
          <div>
            <span className="text-sm text-foreground block font-medium">{t(contact.address)}</span>
            <span className="text-xs text-primary font-semibold">{lang === 'en' ? 'Open in Maps →' : 'Открыть на карте →'}</span>
          </div>
        </a>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-2 gap-3"
      >
        {socials.map((s, i) => (
          <a
            key={i}
            href={s.href}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-card rounded-2xl p-4 flex items-center gap-3 border border-border/50 hover:border-primary/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <s.icon className="w-5 h-5 text-primary" />
            <span className="text-sm font-semibold">{s.label}</span>
          </a>
        ))}
      </motion.div>
    </section>
  );
};

export default ContactSection;
