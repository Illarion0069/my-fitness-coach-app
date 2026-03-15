import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Gift, Sparkles, X, Star } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import achievementLogo from '@/assets/achievement-logo.png';

interface GoldRewardCelebrationProps {
  show: boolean;
  onDismiss: () => void;
  weeksCount?: number;
}

// Confetti particle component
const ConfettiParticle = ({ delay, x, color }: { delay: number; x: number; color: string }) => (
  <motion.div
    initial={{ opacity: 1, y: -20, x, rotate: 0, scale: 1 }}
    animate={{
      opacity: [1, 1, 0],
      y: [0, 400, 600],
      x: [x, x + (Math.random() - 0.5) * 120],
      rotate: [0, Math.random() * 720 - 360],
      scale: [1, 0.8, 0.3],
    }}
    transition={{ duration: 2.5 + Math.random(), delay, ease: 'easeOut' }}
    className="absolute top-0 pointer-events-none"
    style={{
      width: 8 + Math.random() * 6,
      height: 8 + Math.random() * 6,
      borderRadius: Math.random() > 0.5 ? '50%' : '2px',
      backgroundColor: color,
    }}
  />
);

const CONFETTI_COLORS = [
  'hsl(48, 96%, 53%)',   // gold
  'hsl(36, 100%, 50%)',  // orange-gold
  'hsl(142, 71%, 45%)',  // green
  'hsl(217, 91%, 60%)',  // blue
  'hsl(280, 87%, 65%)',  // purple
  'hsl(0, 84%, 60%)',    // red
  'hsl(48, 100%, 67%)',  // light gold
];

const GoldRewardCelebration = ({ show, onDismiss, weeksCount = 3 }: GoldRewardCelebrationProps) => {
  const { lang } = useLanguage();
  const [confettiParticles, setConfettiParticles] = useState<{ id: number; delay: number; x: number; color: string }[]>([]);

  useEffect(() => {
    if (show) {
      const particles = Array.from({ length: 60 }, (_, i) => ({
        id: i,
        delay: Math.random() * 0.8,
        x: Math.random() * 320 - 160,
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      }));
      setConfettiParticles(particles);
    }
  }, [show]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[200] flex items-center justify-center"
          onClick={onDismiss}
        >
          {/* Dark overlay with golden glow */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 bg-background/90 backdrop-blur-md"
          />

          {/* Radial golden glow */}
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1.5, opacity: 0.3 }}
            transition={{ duration: 1, ease: 'easeOut' }}
            className="absolute w-80 h-80 rounded-full"
            style={{
              background: 'radial-gradient(circle, hsla(48, 96%, 53%, 0.4) 0%, transparent 70%)',
            }}
          />

          {/* Confetti */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none flex justify-center">
            {confettiParticles.map((p) => (
              <ConfettiParticle key={p.id} delay={p.delay} x={p.x} color={p.color} />
            ))}
          </div>

          {/* Main card */}
          <motion.div
            initial={{ scale: 0.3, opacity: 0, y: 50 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.3, opacity: 0, y: 50 }}
            transition={{ type: 'spring', damping: 12, stiffness: 200, delay: 0.1 }}
            className="relative bg-card border border-yellow-500/30 rounded-3xl p-8 mx-6 max-w-sm w-full text-center shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            style={{
              boxShadow: '0 0 60px hsla(48, 96%, 53%, 0.15), 0 20px 60px hsla(0, 0%, 0%, 0.3)',
            }}
          >
            {/* Subtle golden shimmer background */}
            <motion.div
              animate={{ rotate: [0, 360] }}
              transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
              className="absolute -top-20 -right-20 w-40 h-40 opacity-10"
              style={{
                background: 'conic-gradient(from 0deg, transparent, hsla(48, 96%, 53%, 0.5), transparent, hsla(48, 96%, 53%, 0.5), transparent)',
              }}
            />

            <button
              onClick={onDismiss}
              className="absolute top-3 right-3 text-muted-foreground hover:text-foreground z-10"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Logo + Trophy icon */}
            <div className="relative inline-block mb-4">
              <motion.div
                animate={{ scale: [1, 1.1, 1], rotate: [0, 3, -3, 0] }}
                transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
              >
                <div className="w-20 h-20 mx-auto rounded-2xl overflow-hidden border-2 border-yellow-500/40 shadow-lg">
                  <img src={achievementLogo} alt="Achievement" className="w-full h-full object-cover" />
                </div>
              </motion.div>

              {/* Orbiting stars */}
              {[0, 1, 2, 3].map((i) => (
                <motion.div
                  key={i}
                  animate={{ rotate: [i * 90, i * 90 + 360] }}
                  transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
                  className="absolute inset-0"
                  style={{ transformOrigin: 'center center' }}
                >
                  <Star
                    className="absolute -top-3 left-1/2 -translate-x-1/2 text-yellow-400"
                    style={{ width: 10 + i * 2, height: 10 + i * 2 }}
                    fill="currentColor"
                  />
                </motion.div>
              ))}

              <Sparkles className="absolute -top-2 -right-3 w-6 h-6 text-yellow-400 animate-pulse" />
              <Gift className="absolute -bottom-2 -left-3 w-5 h-5 text-primary animate-pulse" style={{ animationDelay: '0.5s' }} />
            </div>

            {/* Title */}
            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="text-xl font-extrabold font-heading text-foreground mb-2"
            >
              🎁 {lang === 'en' ? 'Free Session Earned!' : 'Бесплатная тренировка!'}
            </motion.h2>

            {/* Description */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55 }}
              className="space-y-2 mb-6"
            >
              <div className="flex items-center justify-center gap-2">
                <span className="text-3xl">🥇</span>
                <span className="text-3xl">🥇</span>
                <span className="text-3xl">🥇</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {lang === 'en'
                  ? `You earned Gold nutrition rating for ${weeksCount} consecutive weeks! As a reward, a free training session has been added to your package.`
                  : `Вы получили Gold рейтинг питания ${weeksCount} недель подряд! В награду бесплатная тренировка добавлена в ваш пакет.`}
              </p>
            </motion.div>

            {/* Stats badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.7 }}
              className="inline-flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-4 py-2 mb-6"
            >
              <span className="text-xs font-bold text-yellow-500">+1</span>
              <span className="text-xs text-muted-foreground">
                {lang === 'en' ? 'session added' : 'тренировка добавлена'}
              </span>
            </motion.div>

            {/* CTA button */}
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.85 }}
              whileTap={{ scale: 0.95 }}
              onClick={onDismiss}
              className="w-full py-3.5 rounded-xl font-bold text-sm text-primary-foreground"
              style={{
                background: 'linear-gradient(135deg, hsl(48, 96%, 45%), hsl(36, 100%, 50%))',
              }}
            >
              {lang === 'en' ? '🎉 Amazing!' : '🎉 Потрясающе!'}
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default GoldRewardCelebration;
