import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';

/**
 * Reusable one-time micro-hint for new/undiscovered features.
 * Renders a pulsing dot plus a short tooltip that auto-collapses.
 * Once the user interacts (or dismisses), it is remembered in localStorage.
 */

const seenKey = (id: string) => `hint_seen_${id}`;

export const markHintSeen = (id: string) => {
  try { localStorage.setItem(seenKey(id), '1'); } catch { /* ignore */ }
};

export const useHint = (id: string) => {
  const [visible, setVisible] = useState(() => {
    try { return !localStorage.getItem(seenKey(id)); } catch { return false; }
  });
  const dismiss = useCallback(() => {
    markHintSeen(id);
    setVisible(false);
  }, [id]);
  return { visible, dismiss };
};

interface HintDotProps {
  /** Unique id — used as the localStorage key */
  id: string;
  en: string;
  ru: string;
  /** Extra positioning classes for the wrapper (absolute positioning recommended) */
  className?: string;
  /** Which side the tooltip bubble grows to */
  side?: 'left' | 'right';
  /** Delay before the tooltip appears (ms) */
  delay?: number;
  /** How long the tooltip stays open before collapsing to a dot (ms) */
  duration?: number;
}

const HintDot = ({ id, en, ru, className = '', side = 'left', delay = 900, duration = 6000 }: HintDotProps) => {
  const { lang } = useLanguage();
  const { visible, dismiss } = useHint(id);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const t1 = setTimeout(() => setExpanded(true), delay);
    const t2 = setTimeout(() => setExpanded(false), delay + duration);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [visible, delay, duration]);

  if (!visible) return null;

  return (
    <span className={`absolute z-20 ${className}`}>
      <span className="relative flex items-center">
        <button
          type="button"
          aria-label={lang === 'en' ? en : ru}
          onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
          className="relative block w-2.5 h-2.5 rounded-full bg-primary"
        >
          <span className="absolute inset-0 rounded-full bg-primary animate-ping" />
        </button>

        <AnimatePresence>
          {expanded && (
            <motion.span
              initial={{ opacity: 0, scale: 0.9, x: side === 'left' ? 8 : -8 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: 'spring', damping: 22, stiffness: 320 }}
              onClick={(e) => { e.stopPropagation(); dismiss(); }}
              className={`absolute top-1/2 -translate-y-1/2 whitespace-nowrap rounded-full bg-foreground text-background text-[10px] font-semibold px-2.5 py-1 shadow-lg ${
                side === 'left' ? 'right-4' : 'left-4'
              }`}
            >
              {lang === 'en' ? en : ru}
            </motion.span>
          )}
        </AnimatePresence>
      </span>
    </span>
  );
};

export default HintDot;
