import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useHint, markHintSeen } from './HintDot';

/**
 * One-time bar above the bottom nav explaining that sections can be swiped.
 */
const SwipeHint = () => {
  const { lang } = useLanguage();
  const { visible, dismiss } = useHint('swipe_sections');
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!visible) return;
    // Не показываем подсказку поверх открытых модалок/шторок
    const overlayOpen = () =>
      !!document.querySelector('[role="dialog"], .fixed.inset-0.z-50, .fixed.inset-0.z-\\[60\\], .fixed.inset-0.z-\\[70\\]');

    let shown = false;
    let hideTimer: ReturnType<typeof setTimeout> | undefined;

    const tick = setInterval(() => {
      if (!shown) {
        if (!overlayOpen()) {
          shown = true;
          setShow(true);
          markHintSeen('swipe_sections');
          hideTimer = setTimeout(() => { setShow(false); dismiss(); }, 8500);
        }
      } else if (overlayOpen()) {
        setShow(false);
        dismiss();
        clearInterval(tick);
      }
    }, 800);

    const start = setTimeout(() => {}, 0);
    return () => { clearInterval(tick); clearTimeout(start); if (hideTimer) clearTimeout(hideTimer); };
  }, [visible, dismiss]);



  if (!visible) return null;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ type: 'spring', damping: 24, stiffness: 300 }}
          className="fixed left-4 z-[80] w-[calc(100%-6rem)] max-w-[280px]"
          style={{ bottom: 'calc(4.75rem + env(safe-area-inset-bottom, 0px))' }}
        >
          <div className="flex items-center gap-2 rounded-full bg-card/95 backdrop-blur-md border border-border/50 shadow-xl px-3 py-2">
            <motion.div
              animate={{ x: [-3, 3, -3] }}
              transition={{ repeat: Infinity, duration: 1.6, ease: 'easeInOut' }}
              className="flex items-center text-primary"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <ChevronRight className="w-3.5 h-3.5" />
            </motion.div>
            <p className="flex-1 text-[11px] font-medium text-foreground leading-snug">
              {lang === 'en'
                ? 'Tip: swipe left or right to switch between sections'
                : 'Подсказка: свайпайте влево или вправо, чтобы менять разделы'}
            </p>
            <button
              onClick={() => { setShow(false); dismiss(); }}
              aria-label="Close"
              className="w-6 h-6 rounded-full bg-muted/70 flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors shrink-0"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SwipeHint;
