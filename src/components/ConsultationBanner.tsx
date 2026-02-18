import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Stethoscope } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface ConsultationBannerProps {
  onBook: () => void;
}

const STORAGE_KEY = 'consultation_banner_dismissed';
const VISITED_KEY = 'has_visited_before';

const ConsultationBanner = ({ onBook }: ConsultationBannerProps) => {
  const { lang } = useLanguage();
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Don't show if already visited before or dismissed
    const hasVisited = localStorage.getItem(VISITED_KEY);
    const wasDismissed = localStorage.getItem(STORAGE_KEY);

    if (hasVisited || wasDismissed) {
      setDismissed(true);
      return;
    }

    // Mark as visited for future
    localStorage.setItem(VISITED_KEY, 'true');

    // Show after 3 seconds
    const timer = setTimeout(() => setVisible(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setDismissed(true);
  };

  const handleClick = () => {
    handleDismiss();
    onBook();
  };

  if (dismissed || !visible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0, opacity: 0 }}
        transition={{ type: 'spring', damping: 15, stiffness: 300 }}
        className="fixed bottom-24 right-4 z-50"
      >
        <button
          onClick={handleClick}
          className="relative w-14 h-14 rounded-full gradient-primary shadow-[0_4px_20px_-4px_hsl(var(--primary)/0.5)] flex items-center justify-center hover:scale-110 active:scale-95 transition-transform"
        >
          {/* Pulse ring */}
          <span className="absolute inset-0 rounded-full bg-primary/30 animate-ping" />
          <Stethoscope className="w-6 h-6 text-primary-foreground relative z-10" />

          {/* Price badge */}
          <span className="absolute -top-1 -right-1 bg-foreground text-background text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-md z-20">
            50€
          </span>
        </button>

        {/* Dismiss tap area */}
        <button
          onClick={handleDismiss}
          className="absolute -top-1 -left-1 w-5 h-5 rounded-full bg-muted/80 flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors z-30"
          aria-label="Close"
        >
          <span className="text-[10px] font-bold">✕</span>
        </button>

        {/* Tooltip */}
        <motion.div
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 1 }}
          className="absolute right-full mr-2 top-1/2 -translate-y-1/2 whitespace-nowrap bg-card border border-border/50 text-foreground text-xs font-medium py-1.5 px-3 rounded-xl shadow-lg"
        >
          {lang === 'en' ? 'First visit? Book a consultation' : 'Впервые? Запишись на консультацию'}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ConsultationBanner;
