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
    <section className="px-4 pt-6 pb-24">
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-2xl font-bold mb-6"
      >
        {t(contact.title)}
      </motion.h2>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="glass rounded-2xl p-5 space-y-4 mb-6"
      >
        <a href="tel:+35795144819" className="flex items-center gap-3 hover:text-primary transition-colors">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Phone className="w-5 h-5 text-primary" />
          </div>
          <span className="text-sm font-medium">{contact.phone}</span>
        </a>

        <a
          href="https://maps.app.goo.gl/Jh2iDYPA7HyZGLbH7"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 hover:text-primary transition-colors"
        >
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <MapPin className="w-5 h-5 text-primary" />
          </div>
          <div>
            <span className="text-sm text-muted-foreground block">{t(contact.address)}</span>
            <span className="text-xs text-primary font-medium">{lang === 'en' ? 'Open in Google Maps →' : 'Открыть в Google Картах →'}</span>
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
            className="glass rounded-2xl p-4 flex items-center gap-3 hover:border-primary/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <s.icon className="w-5 h-5 text-primary" />
            <span className="text-sm font-medium">{s.label}</span>
          </a>
        ))}
      </motion.div>
    </section>
  );
};

export default ContactSection;
