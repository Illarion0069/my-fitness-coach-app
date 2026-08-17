import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';

/**
 * Reusable one-time micro-hint for new/undiscovered features.
 * Renders a pulsing dot plus a short tooltip that auto-collapses.
 * Once the user interacts (or dismisses), it is remembered in localStorage.
 */

const seenKey = (id: string) => `hint_seen_${id}`;
const showsKey = (id: string) => `hint_shows_${id}`;

export const markHintSeen = (id: string) => {
  try { localStorage.setItem(seenKey(id), '1'); } catch { /* ignore */ }
};

/** Counts one display of the hint; returns the new total. */
export const countHintShown = (id: string) => {
  try {
    const next = (parseInt(localStorage.getItem(showsKey(id)) || '0', 10) || 0) + 1;
    localStorage.setItem(showsKey(id), String(next));
    return next;
  } catch { return 1; }
};

export const getHintShows = (id: string) => {
  try { return parseInt(localStorage.getItem(showsKey(id)) || '0', 10) || 0; } catch { return 0; }
};

/** Clears both the "seen" flag and the display counter (admin replay). */
export const resetHint = (id: string) => {
  try {
    localStorage.removeItem(seenKey(id));
    localStorage.removeItem(showsKey(id));
  } catch { /* ignore */ }
};

/**
 * @param maxShows how many separate visits the hint may appear in (default 1)
 */
export const useHint = (id: string, maxShows = 1) => {
  const [visible, setVisible] = useState(() => {
    try {
      if (localStorage.getItem(seenKey(id))) return false;
      return getHintShows(id) < maxShows;
    } catch { return false; }
  });
  const dismiss = useCallback(() => {
    markHintSeen(id);
    setVisible(false);
  }, [id]);
  const replay = useCallback(() => {
    resetHint(id);
    setVisible(true);
  }, [id]);
  return { visible, dismiss, replay };
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
    // Once the hint has been displayed, it is considered seen — it never shows again,
    // even if the user doesn't tap it. New features get a new `id` to show once more.
    const t2 = setTimeout(() => {
      setExpanded(false);
      markHintSeen(id);
    }, delay + duration);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [visible, delay, duration, id]);

  if (!visible) return null;

  return (
    <span className={`absolute z-20 ${className}`}>
      <span className="relative flex items-center">
        <button
          type="button"
          aria-label={lang === 'en' ? en : ru}
          onClick={(e) => {
            e.stopPropagation();
            markHintSeen(id);
            setExpanded((v) => !v);
          }}
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
