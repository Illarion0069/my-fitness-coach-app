import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Gift, Sparkles, X, Star } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import achievementLogo from '@/assets/achievement-logo.png';

interface GoldRewardCelebrationProps {
  show: boolean;
  onDismiss: () => void;
  weeksCount?: number;
}

/* ═══════════ Firework burst ═══════════ */
const FireworkBurst = ({ x, y, delay, size = 1 }: { x: number; y: number; delay: number; size?: number }) => {
  const colors = [
    'hsl(48, 96%, 53%)', 'hsl(36, 100%, 50%)', 'hsl(0, 84%, 60%)',
    'hsl(280, 87%, 65%)', 'hsl(142, 71%, 45%)', 'hsl(217, 91%, 60%)',
  ];
  const rays = 12;
  return (
    <>
      {Array.from({ length: rays }).map((_, i) => {
        const angle = (i / rays) * Math.PI * 2;
        const dist = (40 + Math.random() * 60) * size;
        const color = colors[Math.floor(Math.random() * colors.length)];
        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, x, y, scale: 0 }}
            animate={{
              opacity: [0, 1, 1, 0],
              x: x + Math.cos(angle) * dist,
              y: y + Math.sin(angle) * dist,
              scale: [0, 1.2, 0.8, 0],
            }}
            transition={{ duration: 1.2 + Math.random() * 0.5, delay: delay + Math.random() * 0.15, ease: 'easeOut' }}
            className="absolute pointer-events-none rounded-full"
            style={{
              width: 4 + Math.random() * 4,
              height: 4 + Math.random() * 4,
              backgroundColor: color,
              boxShadow: `0 0 6px ${color}, 0 0 12px ${color}`,
            }}
          />
        );
      })}
      {/* Center flash */}
      <motion.div
        initial={{ opacity: 0, x: x - 15, y: y - 15, scale: 0 }}
        animate={{ opacity: [0, 0.8, 0], scale: [0, 1.5, 0] }}
        transition={{ duration: 0.6, delay }}
        className="absolute pointer-events-none rounded-full"
        style={{
          width: 30 * size, height: 30 * size,
          background: `radial-gradient(circle, hsla(48,96%,70%,0.8) 0%, transparent 70%)`,
        }}
      />
    </>
  );
};

/* ═══════════ Sparkle trail particles ═══════════ */
const SparkleRain = () => (
  <>
    {Array.from({ length: 40 }).map((_, i) => {
      const x = Math.random() * 100;
      const delay = Math.random() * 2;
      const duration = 2 + Math.random() * 2;
      const size = 2 + Math.random() * 3;
      const color = Math.random() > 0.5 ? 'hsl(48, 96%, 53%)' : 'hsl(36, 100%, 60%)';
      return (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: -10, x: `${x}vw` }}
          animate={{
            opacity: [0, 1, 1, 0],
            y: ['0vh', '100vh'],
          }}
          transition={{ duration, delay, repeat: 1, ease: 'linear' }}
          className="fixed pointer-events-none z-[201]"
          style={{
            width: size, height: size,
            borderRadius: '50%',
            backgroundColor: color,
            boxShadow: `0 0 4px ${color}`,
            left: 0, top: 0,
          }}
        />
      );
    })}
  </>
);

/* ═══════════ Confetti pieces ═══════════ */
const CONFETTI_COLORS = [
  'hsl(48, 96%, 53%)', 'hsl(36, 100%, 50%)', 'hsl(142, 71%, 45%)',
  'hsl(217, 91%, 60%)', 'hsl(280, 87%, 65%)', 'hsl(0, 84%, 60%)',
  'hsl(48, 100%, 67%)', 'hsl(330, 80%, 60%)',
];

const ConfettiPiece = ({ delay, startX }: { delay: number; startX: number }) => {
  const color = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
  const w = 6 + Math.random() * 8;
  const h = 4 + Math.random() * 6;
  const isCircle = Math.random() > 0.6;
  return (
    <motion.div
      initial={{ opacity: 1, y: -20, x: startX, rotate: 0, scale: 1 }}
      animate={{
        opacity: [1, 1, 1, 0],
        y: [0, 200, 500, 700],
        x: [startX, startX + (Math.random() - 0.5) * 200],
        rotate: [0, Math.random() * 1080 - 540],
        scale: [1, 1, 0.8, 0.3],
      }}
      transition={{ duration: 3 + Math.random() * 1.5, delay, ease: 'easeOut' }}
      className="absolute top-0 pointer-events-none"
      style={{
        width: w, height: isCircle ? w : h,
        borderRadius: isCircle ? '50%' : '2px',
        backgroundColor: color,
      }}
    />
  );
};

const GoldRewardCelebration = ({ show, onDismiss, weeksCount = 3 }: GoldRewardCelebrationProps) => {
  const { lang } = useLanguage();
  const [confetti, setConfetti] = useState<{ id: number; delay: number; x: number }[]>([]);
  const [fireworks, setFireworks] = useState<{ id: number; x: number; y: number; delay: number; size: number }[]>([]);

  useEffect(() => {
    if (show) {
      setConfetti(Array.from({ length: 80 }, (_, i) => ({
        id: i,
        delay: Math.random() * 1.2,
        x: Math.random() * 340 - 170,
      })));
      setFireworks([
        { id: 0, x: -80, y: -120, delay: 0.2, size: 1 },
        { id: 1, x: 90, y: -80, delay: 0.5, size: 0.8 },
        { id: 2, x: -30, y: -160, delay: 0.8, size: 1.2 },
        { id: 3, x: 60, y: -140, delay: 1.1, size: 0.7 },
        { id: 4, x: -100, y: -60, delay: 1.4, size: 0.9 },
        { id: 5, x: 110, y: -150, delay: 1.7, size: 1.1 },
      ]);
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
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 bg-background/90 backdrop-blur-lg"
          />

          {/* Pulsing golden aura */}
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: [1, 1.3, 1], opacity: [0.2, 0.4, 0.2] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute w-96 h-96 rounded-full"
            style={{ background: 'radial-gradient(circle, hsla(48,96%,53%,0.3) 0%, transparent 70%)' }}
          />

          {/* Sparkle rain */}
          <SparkleRain />

          {/* Fireworks */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none flex items-center justify-center">
            {fireworks.map(fw => (
              <FireworkBurst key={fw.id} x={fw.x} y={fw.y} delay={fw.delay} size={fw.size} />
            ))}
          </div>

          {/* Confetti */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none flex justify-center">
            {confetti.map(p => (
              <ConfettiPiece key={p.id} delay={p.delay} startX={p.x} />
            ))}
          </div>

          {/* Main card */}
          <motion.div
            initial={{ scale: 0.2, opacity: 0, y: 60 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.2, opacity: 0, y: 60 }}
            transition={{ type: 'spring', damping: 14, stiffness: 200, delay: 0.15 }}
            className="relative bg-card border border-yellow-500/40 rounded-3xl p-8 mx-6 max-w-sm w-full text-center overflow-hidden"
            onClick={e => e.stopPropagation()}
            style={{
              boxShadow: '0 0 80px hsla(48,96%,53%,0.2), 0 0 40px hsla(48,96%,53%,0.1), 0 25px 60px hsla(0,0%,0%,0.4)',
            }}
          >
            {/* Rotating shimmer */}
            <motion.div
              animate={{ rotate: [0, 360] }}
              transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
              className="absolute -top-32 -right-32 w-64 h-64 opacity-[0.07]"
              style={{
                background: 'conic-gradient(from 0deg, transparent, hsla(48,96%,53%,0.8), transparent, hsla(48,96%,53%,0.8), transparent)',
              }}
            />
            <motion.div
              animate={{ rotate: [360, 0] }}
              transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
              className="absolute -bottom-32 -left-32 w-64 h-64 opacity-[0.05]"
              style={{
                background: 'conic-gradient(from 0deg, transparent, hsla(280,87%,65%,0.6), transparent, hsla(217,91%,60%,0.6), transparent)',
              }}
            />

            <button
              onClick={onDismiss}
              className="absolute top-3 right-3 text-muted-foreground hover:text-foreground z-10"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Logo with orbiting stars */}
            <div className="relative inline-block mb-5">
              <motion.div
                animate={{ scale: [1, 1.08, 1], rotate: [0, 2, -2, 0] }}
                transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
              >
                <div className="w-24 h-24 mx-auto rounded-2xl overflow-hidden border-2 border-yellow-500/50 shadow-xl"
                  style={{ boxShadow: '0 0 30px hsla(48,96%,53%,0.3)' }}
                >
                  <img src={achievementLogo} alt="Achievement" className="w-full h-full object-cover" />
                </div>
              </motion.div>

              {[0, 1, 2, 3, 4].map(i => (
                <motion.div
                  key={i}
                  animate={{ rotate: [i * 72, i * 72 + 360] }}
                  transition={{ duration: 5, repeat: Infinity, ease: 'linear' }}
                  className="absolute inset-0"
                  style={{ transformOrigin: 'center center' }}
                >
                  <Star className="absolute -top-4 left-1/2 -translate-x-1/2 text-yellow-400"
                    style={{ width: 8 + i * 2, height: 8 + i * 2 }} fill="currentColor" />
                </motion.div>
              ))}

              <motion.div
                animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Sparkles className="absolute -top-3 -right-4 w-7 h-7 text-yellow-400" />
              </motion.div>
              <motion.div
                animate={{ scale: [1, 1.4, 1], opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 2.5, repeat: Infinity, delay: 0.5 }}
              >
                <Gift className="absolute -bottom-3 -left-4 w-6 h-6 text-primary" />
              </motion.div>
            </div>

            {/* Title */}
            <motion.h2
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="text-xl font-extrabold font-heading text-foreground mb-2"
            >
              🎁 {lang === 'en' ? 'Free Session Earned!' : 'Бесплатная тренировка!'}
            </motion.h2>

            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55 }}
              className="space-y-3 mb-6"
            >
              <div className="flex items-center justify-center gap-2">
                <motion.span animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 1, repeat: Infinity, delay: 0 }} className="text-3xl">🥇</motion.span>
                <motion.span animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 1, repeat: Infinity, delay: 0.2 }} className="text-3xl">🥇</motion.span>
                <motion.span animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 1, repeat: Infinity, delay: 0.4 }} className="text-3xl">🥇</motion.span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {lang === 'en'
                  ? `You earned Gold nutrition rating for ${weeksCount} consecutive weeks! As a reward, a free training session has been added to your package.`
                  : `Вы получили Gold рейтинг питания ${weeksCount} недель подряд! В награду бесплатная тренировка добавлена в ваш пакет.`}
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.7 }}
              className="inline-flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-5 py-2.5 mb-6"
            >
              <motion.span
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="text-sm font-extrabold text-yellow-500"
              >+1</motion.span>
              <span className="text-xs text-muted-foreground font-medium">
                {lang === 'en' ? 'session added to your package' : 'тренировка добавлена в пакет'}
              </span>
            </motion.div>

            <motion.button
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.85 }}
              whileTap={{ scale: 0.95 }}
              onClick={onDismiss}
              className="w-full py-3.5 rounded-xl font-bold text-sm text-primary-foreground"
              style={{ background: 'linear-gradient(135deg, hsl(48,96%,45%), hsl(36,100%,50%))' }}
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
