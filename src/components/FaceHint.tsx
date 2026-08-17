import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { markHintSeen, useHint } from './HintDot';
import headNeutral from '@/assets/illarion-head-neutral.png';
import headSmile from '@/assets/illarion-head-smile.png';

interface FaceHintProps {
  /** Unique id — used as the localStorage key (new feature = new id) */
  id: string;
  en: string;
  ru: string;
  /** Small call-to-action under the message */
  tapEn?: string;
  tapRu?: string;
  /** Fired after the smile animation finishes */
  onTap: () => void;
  /** Screen side the head slides in from */
  side?: 'left' | 'right';
  /** Delay before it slides in (ms) */
  delay?: number;
  /** Distance from the bottom of the screen */
  bottomClass?: string;
}

/**
 * "Illarion's face" announcement: a cut-out head slides in from the screen edge
 * with a speech bubble. On tap the face switches to a big smile, then the
 * related feature opens. Shown once per `id`.
 */
const FaceHint = ({
  id,
  en,
  ru,
  tapEn = 'tap',
  tapRu = 'нажми',
  onTap,
  side = 'right',
  delay = 1500,
  bottomClass = 'bottom-28',
}: FaceHintProps) => {
  const { lang } = useLanguage();
  const { visible, dismiss } = useHint(id);
  const [shown, setShown] = useState(false);
  const [smiling, setSmiling] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => setShown(true), delay);
    return () => clearTimeout(t);
  }, [visible, delay]);

  if (!visible) return null;

  const handleTap = () => {
    if (smiling) return;
    setSmiling(true);
    markHintSeen(id);
    setTimeout(() => {
      onTap();
      setShown(false);
      setTimeout(dismiss, 500);
    }, 850);
  };

  const isRight = side === 'right';

  return (
    <AnimatePresence>
      {shown && (
        <motion.div
          initial={{ x: isRight ? 130 : -130, y: 26, rotate: isRight ? 22 : -22, opacity: 0 }}
          animate={{ x: isRight ? 26 : -26, y: 0, rotate: isRight ? 12 : -12, opacity: 1 }}
          exit={{ x: isRight ? 150 : -150, y: 30, rotate: isRight ? 24 : -24, opacity: 0 }}
          transition={{ type: 'spring', damping: 20, stiffness: 140, mass: 0.9 }}
          className={`fixed ${bottomClass} ${isRight ? 'right-0' : 'left-0'} z-[60] flex items-end gap-1 ${
            isRight ? 'flex-row' : 'flex-row-reverse'
          }`}
          style={{ paddingBottom: 'env(safe-area-inset-bottom)', transformOrigin: 'bottom center', willChange: 'transform' }}
        >
          {/* Speech bubble */}
          <motion.button
            type="button"
            onClick={handleTap}
            initial={{ opacity: 0, scale: 0.9, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ delay: 0.45, type: 'spring', damping: 18, stiffness: 260 }}
            style={{ rotate: isRight ? -12 : 12 }}
            className={`relative max-w-[190px] text-left rounded-2xl bg-card border border-border shadow-xl px-3 py-2 mb-8 ${
              isRight ? 'rounded-br-sm' : 'rounded-bl-sm'
            }`}
          >
            <span className="block text-[11px] leading-snug font-medium text-foreground">
              {lang === 'en' ? en : ru}
            </span>
            <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-primary">
              <span className="relative flex w-1.5 h-1.5">
                <span className="absolute inset-0 rounded-full bg-primary animate-ping" />
                <span className="relative w-1.5 h-1.5 rounded-full bg-primary" />
              </span>
              {lang === 'en' ? tapEn : tapRu}
            </span>
          </motion.button>

          {/* Head — both frames stacked, only the mouth changes via a soft crossfade */}
          <motion.div
            className="relative"
            animate={{ y: smiling ? 0 : [0, -3, 0], rotate: smiling ? (isRight ? -2 : 2) : 0 }}
            transition={
              smiling
                ? { duration: 0.5, ease: [0.22, 1, 0.36, 1] }
                : { duration: 3.6, repeat: Infinity, ease: 'easeInOut' }
            }
          >
            <button
              type="button"
              onClick={handleTap}
              aria-label={lang === 'en' ? en : ru}
              className="block relative w-[96px]"
            >
              <img
                src={headNeutral}
                alt=""
                className="w-[96px] h-auto drop-shadow-2xl select-none pointer-events-none"
                draggable={false}
              />
              <motion.img
                src={headSmile}
                alt=""
                initial={{ opacity: 0 }}
                animate={{ opacity: smiling ? 1 : 0 }}
                transition={{ duration: 0.35, ease: 'easeInOut' }}
                className="absolute inset-0 w-[96px] h-auto drop-shadow-2xl select-none pointer-events-none"
                draggable={false}
              />
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setShown(false); dismiss(); }}
              aria-label="Close"
              className="absolute -top-1 left-0 w-5 h-5 rounded-full bg-muted/90 border border-border flex items-center justify-center text-muted-foreground"
            >
              <X className="w-3 h-3" />
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default FaceHint;
