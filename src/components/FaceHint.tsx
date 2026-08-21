import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { countHintShown, markHintSeen, useHint } from './HintDot';
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
  /** How many separate visits it may appear in (default 2) */
  maxShows?: number;
  /** Increment this number to replay the hint (admin/preview mode) */
  replayToken?: number;
}

/**
 * "Illarion's face" announcement: a cut-out head slides in from the screen edge
 * with a speech bubble. On tap the face switches to a big smile, then the
 * related feature opens. Shown on the first `maxShows` visits per `id`.
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
  bottomClass = 'bottom-32',
  maxShows = 2,
  replayToken = 0,
}: FaceHintProps) => {
  const { lang } = useLanguage();
  const { visible, dismiss, replay } = useHint(id, maxShows);
  const [shown, setShown] = useState(false);
  const [smiling, setSmiling] = useState(false);
  const [vw, setVw] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 390));
  const [vh, setVh] = useState(() => (typeof window !== 'undefined' ? window.innerHeight : 800));

  useEffect(() => {
    const onResize = () => {
      setVw(window.innerWidth);
      setVh(window.innerHeight);
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {

      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);

  // Admin replay: reset the counters and show it again
  useEffect(() => {
    if (!replayToken) return;
    setSmiling(false);
    setShown(false);
    replay();
  }, [replayToken, replay]);

  // Scale the head with the viewport: never wider than ~34% of the screen,
  // never taller than ~22% of the height, and clamped for tiny/large screens.
  const headW = Math.max(88, Math.min(160, vw * 0.34, vh * 0.22 * (128 / 172)));

  useEffect(() => {
    if (!visible) return;
    countHintShown(id);
    const t = setTimeout(() => setShown(true), delay);
    return () => clearTimeout(t);
  }, [visible, delay, id]);

  // Never overlap an open sheet/modal
  const [sheetOpen, setSheetOpen] = useState(false);
  useEffect(() => {
    const check = () => setSheetOpen(!!document.querySelector('[data-app-sheet="true"]'));
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.body, { childList: true, subtree: true });
    return () => obs.disconnect();
  }, []);

  if (!visible || sheetOpen) return null;


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

  // Head size adapts to the viewport so it always peeks neatly at the edge
  const HEAD_W = Math.round(headW);
  const HEAD_H = Math.round(headW * (172 / 128));
  const PEEK = Math.round(HEAD_H * (96 / 172)); // hair -> forehead -> eyes above the edge
  const bubbleMax = Math.max(150, Math.min(230, vw - HEAD_W - 40));


  return (
    <AnimatePresence>
      {shown && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.25 } }}
          className={`fixed ${bottomClass} ${isRight ? 'right-2' : 'left-2'} z-[60] pointer-events-none flex items-end gap-2 ${
            isRight ? 'flex-row-reverse' : 'flex-row'
          }`}
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          {/* Head — rises slowly from behind the edge: hair, forehead, then the eyes */}
          <motion.div
            className="relative overflow-hidden"
            style={{ width: HEAD_W, height: PEEK }}
          >
            <motion.button
              type="button"
              onClick={handleTap}
              aria-label={lang === 'en' ? en : ru}
              className="absolute left-0 top-0 block pointer-events-auto"
              style={{ width: HEAD_W, height: HEAD_H, transformOrigin: 'bottom center', willChange: 'transform' }}
              initial={{ y: PEEK, rotate: isRight ? -10 : 10 }}
              animate={{ y: 0, rotate: isRight ? -6 : 6 }}
              exit={{ y: PEEK, rotate: isRight ? -10 : 10, transition: { duration: 0.4, ease: [0.4, 0, 1, 1] } }}
              transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
            >
              <img
                src={headNeutral}
                alt=""
                className="absolute inset-0 w-full h-auto drop-shadow-2xl select-none pointer-events-none"
                draggable={false}
              />
              <motion.img
                src={headSmile}
                alt=""
                initial={{ opacity: 0 }}
                animate={{ opacity: smiling ? 1 : 0 }}
                transition={{ duration: 0.4, ease: 'easeInOut' }}
                className="absolute inset-0 w-full h-auto drop-shadow-2xl select-none pointer-events-none"
                draggable={false}
              />
            </motion.button>
          </motion.div>

          {/* Speech bubble */}
          <motion.button
            type="button"
            onClick={handleTap}
            initial={{ opacity: 0, scale: 0.92, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ delay: 0.45, type: 'spring', damping: 18, stiffness: 240 }}
            style={{ maxWidth: bubbleMax }}
            className={`relative pointer-events-auto text-left rounded-2xl bg-card border border-border shadow-xl px-3 py-2 mb-4 ${
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
            <span
              onClick={(e) => { e.stopPropagation(); setShown(false); dismiss(); }}
              className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-muted border border-border flex items-center justify-center text-muted-foreground"
            >
              <X className="w-3 h-3" />
            </span>
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};


export default FaceHint;
