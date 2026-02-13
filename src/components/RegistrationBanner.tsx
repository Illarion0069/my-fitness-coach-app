import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, UserPlus } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface RegistrationBannerProps {
  onRegister: () => void;
}

const RegistrationBanner = ({ onRegister }: RegistrationBannerProps) => {
  const { lang } = useLanguage();
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 4000);
    return () => clearTimeout(timer);
  }, []);

  if (dismissed || !visible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="fixed bottom-20 left-4 right-4 z-50 max-w-md mx-auto"
      >
        <div className="bg-card/95 backdrop-blur-xl border border-border/50 rounded-2xl p-4 shadow-[0_8px_40px_-8px_hsl(var(--primary)/0.3)]">
          <button
            onClick={() => setDismissed(true)}
            className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shrink-0">
              <UserPlus className="w-5 h-5 text-primary-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-foreground">
                {lang === 'en' ? 'Track your progress' : 'Отслеживайте прогресс'}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {lang === 'en'
                  ? 'Register to see your remaining sessions'
                  : 'Зарегистрируйтесь, чтобы видеть остаток занятий'}
              </p>
            </div>
            <button
              onClick={onRegister}
              className="gradient-primary text-primary-foreground text-xs font-bold py-2 px-4 rounded-xl shrink-0 hover:scale-[1.02] active:scale-[0.98] transition-transform"
            >
              {lang === 'en' ? 'Sign Up' : 'Войти'}
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default RegistrationBanner;
