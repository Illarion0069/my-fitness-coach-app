import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Stethoscope, X, ChevronLeft } from 'lucide-react';
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
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const hasVisited = localStorage.getItem(VISITED_KEY);
    const wasDismissed = localStorage.getItem(STORAGE_KEY);

    if (hasVisited || wasDismissed) {
      setDismissed(true);
      return;
    }

    localStorage.setItem(VISITED_KEY, 'true');
    const timer = setTimeout(() => setVisible(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  // Auto-expand after 2s to draw attention, then collapse after 4s
  useEffect(() => {
    if (!visible) return;
    const expandTimer = setTimeout(() => setExpanded(true), 1500);
    const collapseTimer = setTimeout(() => setExpanded(false), 6000);
    return () => { clearTimeout(expandTimer); clearTimeout(collapseTimer); };
  }, [visible]);

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
        initial={{ x: 100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 100, opacity: 0 }}
        transition={{ type: 'spring', damping: 20, stiffness: 300 }}
        className="fixed right-0 top-1/2 -translate-y-1/2 z-50 flex items-stretch"
      >
        {/* Expanded panel */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 'auto', opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="overflow-hidden"
            >
              <div className="bg-card border border-border/50 border-r-0 rounded-l-2xl p-4 pr-2 flex flex-col gap-3 min-w-[200px] shadow-xl">
                {/* Close button */}
                <button
                  onClick={handleDismiss}
                  className="absolute top-2 left-2 w-6 h-6 rounded-full bg-muted/80 flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
                  aria-label="Close"
                >
                  <X className="w-3.5 h-3.5" />
                </button>

                <div className="mt-4">
                  <p className="text-xs font-bold text-primary uppercase tracking-wider mb-1">
                    {lang === 'en' ? 'First visit?' : 'Впервые?'}
                  </p>
                  <p className="text-sm font-bold text-foreground leading-tight">
                    {lang === 'en' ? 'Personal consultation' : 'Персональная консультация'}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
                    {lang === 'en' 
                      ? '1 hour: body measurements, health assessment & personal plan' 
                      : '1 час: замеры тела, оценка здоровья и персональный план'}
                  </p>
                </div>

                <button
                  onClick={handleClick}
                  className="gradient-primary text-primary-foreground font-bold py-2 px-4 rounded-xl text-xs glow-primary hover:scale-[1.02] transition-transform active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  <Stethoscope className="w-3.5 h-3.5" />
                  {lang === 'en' ? 'Book — 50€' : 'Записаться — 50€'}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tab / handle */}
        <button
          onClick={() => setExpanded(prev => !prev)}
          className="relative flex flex-col items-center justify-center gap-1 bg-primary rounded-l-xl px-1.5 py-4 shadow-[−4px_0_20px_−4px_hsl(var(--primary)/0.4)] hover:bg-primary/90 transition-colors group"
          style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
        >
          {/* Pulse indicator */}
          {!expanded && (
            <span className="absolute -left-1 top-3 w-2.5 h-2.5 rounded-full bg-destructive animate-ping" />
          )}
          {!expanded && (
            <span className="absolute -left-1 top-3 w-2.5 h-2.5 rounded-full bg-destructive" />
          )}

          <ChevronLeft className={`w-3.5 h-3.5 text-primary-foreground transition-transform ${expanded ? 'rotate-180' : ''}`} />
          <span className="text-[10px] font-extrabold text-primary-foreground tracking-wider uppercase">
            50€
          </span>
          <Stethoscope className="w-4 h-4 text-primary-foreground" />
        </button>
      </motion.div>
    </AnimatePresence>
  );
};

export default ConsultationBanner;
