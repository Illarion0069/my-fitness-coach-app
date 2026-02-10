import { motion } from 'framer-motion';
import { Phone, MapPin, ArrowUpRight } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { translations } from '@/i18n/translations';

const ContactSection = () => {
  const { t, lang } = useLanguage();
  const contact = translations.contact;

  const socials = [
    { label: 'Facebook', href: 'https://www.facebook.com/illarion.ientin/' },
    { label: 'Instagram', href: 'https://www.instagram.com/illarion_ientin/' },
    { label: 'Telegram', href: 'https://t.me/Illarion_Ientin' },
    { label: 'WhatsApp', href: 'https://wa.me/35795144819' },
  ];

  return (
    <section className="min-h-screen px-5 pt-8 pb-24">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
      >
        <div className="editorial-line mb-4" />
        <h2 className="text-3xl font-bold mb-8">{t(contact.title)}</h2>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="space-y-6 mb-10"
      >
        <a href="tel:+35795144819" className="flex items-center gap-4 group">
          <div className="w-10 h-10 border border-border flex items-center justify-center group-hover:border-primary transition-colors">
            <Phone className="w-4 h-4 text-primary" />
          </div>
          <span className="text-sm font-medium font-sans">{contact.phone}</span>
        </a>

        <a
          href="https://maps.app.goo.gl/Jh2iDYPA7HyZGLbH7"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-4 group"
        >
          <div className="w-10 h-10 border border-border flex items-center justify-center group-hover:border-primary transition-colors">
            <MapPin className="w-4 h-4 text-primary" />
          </div>
          <div>
            <span className="text-sm font-sans block">{t(contact.address)}</span>
            <span className="text-[10px] text-primary font-medium font-sans uppercase tracking-wider">
              {lang === 'en' ? 'Open in Maps' : 'Открыть карту'} →
            </span>
          </div>
        </a>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.1 }}
        className="space-y-px"
      >
        <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-4 font-sans">Social</p>
        {socials.map((s, i) => (
          <a
            key={i}
            href={s.href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between py-4 border-t border-border group hover:text-primary transition-colors"
          >
            <span className="text-sm font-medium font-sans">{s.label}</span>
            <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </a>
        ))}
      </motion.div>
    </section>
  );
};

export default ContactSection;