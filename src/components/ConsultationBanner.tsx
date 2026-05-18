import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Stethoscope, X, ChevronLeft } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface ConsultationBannerProps {
  onBook: () => void;
  alwaysShow?: boolean;
}

const STORAGE_KEY = 'consultation_banner_dismissed';
const VISITED_KEY = 'has_visited_before';

const ConsultationBanner = ({ onBook, alwaysShow = false }: ConsultationBannerProps) => {
  const { lang } = useLanguage();
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    // Always show for trainer / preview
    if (alwaysShow) {
      const timer = setTimeout(() => setVisible(true), 1000);
      return () => clearTimeout(timer);
    }

    const hasVisited = localStorage.getItem(VISITED_KEY);
    const wasDismissed = localStorage.getItem(STORAGE_KEY);

    if (hasVisited || wasDismissed) {
      setDismissed(true);
      return;
    }

    localStorage.setItem(VISITED_KEY, 'true');
    const timer = setTimeout(() => setVisible(true), 3000);
    return () => clearTimeout(timer);
  }, [alwaysShow]);

  // Auto-expand after 2s to draw attention, then collapse after 4s
  useEffect(() => {
    if (!visible) return;
    const expandTimer = setTimeout(() => setExpanded(true), 1500);
    const collapseTimer = setTimeout(() => setExpanded(false), 6000);
    return () => { clearTimeout(expandTimer); clearTimeout(collapseTimer); };
  }, [visible]);

  const handleDismiss = () => {
    if (!alwaysShow) localStorage.setItem(STORAGE_KEY, 'true');
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
        initial={{ x: 60, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 60, opacity: 0 }}
        transition={{ type: 'spring', damping: 20, stiffness: 300 }}
        className="fixed right-0 bottom-24 z-50"
      >
        <AnimatePresence mode="wait">
          {expanded ? (
            <motion.div
              key="panel"
              initial={{ x: 200, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 200, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="bg-card border border-border/50 rounded-l-2xl p-3 pl-4 shadow-xl mr-0 max-w-[220px]"
            >
              <button
                onClick={handleDismiss}
                className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-muted/80 flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
                aria-label="Close"
              >
                <X className="w-3 h-3" />
              </button>

              <p className="text-[10px] font-bold text-primary uppercase tracking-wider">
                {lang === 'en' ? 'First visit?' : 'Впервые?'}
              </p>
              <p className="text-xs font-bold text-foreground leading-tight mt-0.5">
                {lang === 'en' ? 'Personal consultation' : 'Консультация'}
              </p>
              <p className="text-[10px] text-muted-foreground mt-1 leading-snug">
                {lang === 'en'
                  ? '1h: measurements, health check & plan'
                  : '1 час: замеры, здоровье и план'}
              </p>

              <button
                onClick={handleClick}
                className="gradient-primary text-primary-foreground font-bold py-1.5 px-3 rounded-lg text-[11px] glow-primary hover:scale-[1.02] transition-transform active:scale-[0.98] mt-2 w-full"
              >
                {lang === 'en' ? 'Book — 50€' : 'Записаться — 50€'}
              </button>
            </motion.div>
          ) : (
            <motion.button
              key="tab"
              initial={{ x: 40 }}
              animate={{ x: 0 }}
              onClick={() => setExpanded(true)}
              className="relative flex items-center gap-1.5 bg-primary rounded-l-full pl-3 pr-2 py-2 shadow-lg hover:bg-primary/90 transition-colors"
            >
              {/* Pulse dot */}
              <span className="absolute -top-0.5 -left-0.5 w-2 h-2 rounded-full bg-destructive animate-ping" />
              <span className="absolute -top-0.5 -left-0.5 w-2 h-2 rounded-full bg-destructive" />

              <span className="text-[11px] font-bold text-primary-foreground whitespace-nowrap">
                50€
              </span>
              <ChevronLeft className="w-3 h-3 text-primary-foreground/70" />
            </motion.button>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
};

export default ConsultationBanner;
