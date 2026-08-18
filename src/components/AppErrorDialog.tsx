import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X, RotateCcw } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import headSad from '@/assets/illarion-head-sad.png';

export interface AppErrorPayload {
  /** Optional short reason in plain language (already localized by the caller) */
  detailEn?: string;
  detailRu?: string;
  /** Called when the client taps "Try again" */
  onRetry?: () => void | Promise<void>;
}

type Listener = (p: AppErrorPayload | null) => void;
const listeners = new Set<Listener>();

/** Show the global "something went wrong" card from anywhere in the app. */
export function showAppError(payload: AppErrorPayload = {}) {
  listeners.forEach((l) => l(payload));
}

export function hideAppError() {
  listeners.forEach((l) => l(null));
}

// Dev-only helper for visual QA of the error card
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).showAppError = showAppError;
}


const AppErrorDialog = () => {
  const { lang } = useLanguage();
  const [payload, setPayload] = useState<AppErrorPayload | null>(null);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    const listener: Listener = (p) => {
      setRetrying(false);
      setPayload(p);
    };
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);

  const close = () => setPayload(null);

  const handleRetry = async () => {
    if (!payload?.onRetry) return close();
    setRetrying(true);
    try {
      await payload.onRetry();
    } finally {
      setRetrying(false);
      setPayload(null);
    }
  };

  const title = lang === 'en' ? 'Oops, my bad' : 'Упс, у меня тут сбой';
  const body = lang === 'en'
    ? 'Something went wrong on my side. Try again — I already know about it and I am fixing it.'
    : 'Что-то пошло не так с моей стороны. Попробуй ещё раз — я уже в курсе и чиню.';
  const detail = lang === 'en' ? payload?.detailEn : payload?.detailRu;

  return createPortal(
    <AnimatePresence>
      {payload && (
        <motion.div
          className="fixed inset-0 z-[120] flex items-center justify-center p-5 bg-background/80 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={close}
        >
          <div className="relative w-full max-w-sm">
            {/* Sad head peeking from behind the modal, asymmetrically */}
            <motion.div
              className="absolute -top-7 -left-8 z-0"
              initial={{ y: 20, rotate: -28, scale: 0.8, opacity: 0 }}
              animate={{ y: 0, rotate: -14, scale: 1, opacity: 1 }}
              transition={{ delay: 0.06, type: 'spring', stiffness: 260, damping: 18 }}
            >
              <div className="h-24 w-24 overflow-hidden rounded-full border-2 border-destructive/50 bg-card shadow-[0_10px_28px_-8px_hsl(var(--destructive)/0.6)]">
                <img
                  src={headSad}
                  alt=""
                  className="h-full w-full scale-[1.22] object-cover object-top"
                />
              </div>
            </motion.div>

            <motion.div
              className="relative z-10 w-full rounded-3xl border border-destructive/40 bg-card p-6 pt-14 text-center shadow-2xl"
              initial={{ opacity: 0, y: 24, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 320, damping: 26 }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={close}
                aria-label={lang === 'en' ? 'Close' : 'Закрыть'}
                className="absolute right-3 top-3 rounded-full p-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>

              <h3 className="text-xl font-bold text-destructive">{title}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{body}</p>
              {detail && (
                <p className="mt-3 rounded-xl bg-destructive/10 px-3 py-2 text-xs text-destructive">{detail}</p>
              )}

              <div className="mt-5 flex gap-2">
                <Button variant="outline" className="flex-1" onClick={close}>
                  {lang === 'en' ? 'Close' : 'Закрыть'}
                </Button>
                <Button className="flex-1 gap-2" onClick={handleRetry} disabled={retrying}>
                  <RotateCcw className={`w-4 h-4 ${retrying ? 'animate-spin' : ''}`} />
                  {lang === 'en' ? 'Try again' : 'Ещё раз'}
                </Button>
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
};

export default AppErrorDialog;
