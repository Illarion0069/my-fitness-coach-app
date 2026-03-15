import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Sparkles, X, Gift, Star } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import GoldRewardCelebration from './GoldRewardCelebration';

import badgeStreak3 from '@/assets/badges/streak-3.png';
import badgeStreak7 from '@/assets/badges/streak-7.png';
import badgeStreak14 from '@/assets/badges/streak-14.png';
import badgeStreak30 from '@/assets/badges/streak-30.png';
import badgeStreak60 from '@/assets/badges/streak-60.png';
import badgeStreak90 from '@/assets/badges/streak-90.png';
import badgeBronze from '@/assets/badges/nutrition-bronze.png';
import badgeSilver from '@/assets/badges/nutrition-silver.png';
import badgeGold from '@/assets/badges/nutrition-gold.png';

interface Achievement {
  id: string;
  achievement_key: string;
  achievement_type: string;
  title_en: string;
  title_ru: string;
  description_en: string;
  description_ru: string;
  icon: string;
  earned_at: string;
}

interface AchievementsWidgetProps {
  userId: string;
  isTrainer?: boolean;
}

// Map emoji icon keys to custom badge images
const BADGE_IMAGES: Record<string, string> = {
  '📸': badgeStreak3,
  '📷': badgeStreak7,
  '🎞️': badgeStreak14,
  '🌟': badgeStreak30,
  '💎': badgeStreak60,
  '🔱': badgeStreak90,
  '🥉': badgeBronze,
  '🥈': badgeSilver,
  '🥇': badgeGold,
};

const BadgeIcon = ({ icon, size = 'md', className = '' }: { icon: string; size?: 'sm' | 'md' | 'lg' | 'xl'; className?: string }) => {
  const src = BADGE_IMAGES[icon];
  const sizeClasses = { sm: 'w-6 h-6', md: 'w-10 h-10', lg: 'w-14 h-14', xl: 'w-20 h-20' };
  if (src) {
    return <img src={src} alt="" className={`${sizeClasses[size]} object-contain ${className}`} />;
  }
  return <span className={`block ${size === 'xl' ? 'text-5xl' : size === 'lg' ? 'text-3xl' : 'text-2xl'} ${className}`}>{icon}</span>;
};

const TYPE_COLORS: Record<string, string> = {
  nutrition_streak: 'from-orange-500/20 to-orange-500/5 border-orange-500/30',
  nutrition_quality: 'from-green-500/20 to-green-500/5 border-green-500/30',
};

const ALL_MILESTONES = [
  // ═══ Серия фото еды (стрики) ═══
  { icon: '📸', title_en: '3-Day Streak', title_ru: '3 дня подряд', desc_en: 'Log food photos for 3 consecutive days.', desc_ru: 'Фотографируйте еду 3 дня подряд.' },
  { icon: '📷', title_en: '7-Day Streak', title_ru: '7 дней подряд', desc_en: 'Log food photos for 7 consecutive days. A full week!', desc_ru: 'Фотографируйте еду 7 дней подряд. Целая неделя!' },
  { icon: '🎞️', title_en: '14-Day Streak', title_ru: '14 дней подряд', desc_en: 'Log food photos for 14 consecutive days!', desc_ru: 'Фотографируйте еду 14 дней подряд!' },
  { icon: '🌟', title_en: '30-Day Streak', title_ru: '30 дней подряд', desc_en: 'Log food photos for 30 consecutive days. A full month!', desc_ru: 'Фотографируйте еду 30 дней подряд. Целый месяц!' },
  { icon: '💎', title_en: '60-Day Streak', title_ru: '60 дней подряд', desc_en: 'Log food photos for 60 consecutive days!', desc_ru: 'Фотографируйте еду 60 дней подряд!' },
  { icon: '🔱', title_en: '90-Day Streak', title_ru: '90 дней подряд', desc_en: 'Log food photos for 90 consecutive days. Legendary!', desc_ru: 'Фотографируйте еду 90 дней подряд. Легенда!' },
  // ═══ Качество питания ═══
  { icon: '🥉', title_en: 'Bronze Nutrition', title_ru: 'Бронза питания', desc_en: 'Achieve a weekly average nutrition score ≥ 60%. Min 3 days with scores.', desc_ru: 'Средний балл питания за неделю ≥ 60%. Минимум 3 дня с оценками.' },
  { icon: '🥈', title_en: 'Silver Nutrition', title_ru: 'Серебро питания', desc_en: 'Achieve ≥ 80% weekly score → FREE training session! Min 3 days.', desc_ru: 'Средний балл ≥ 80% за неделю → БЕСПЛАТНАЯ тренировка! Мин. 3 дня.' },
  { icon: '🥇', title_en: 'Gold Nutrition', title_ru: 'Золото питания', desc_en: 'Achieve ≥ 95% weekly score → FREE training session! Min 3 days.', desc_ru: 'Средний балл ≥ 95% за неделю → БЕСПЛАТНАЯ тренировка! Мин. 3 дня.' },
];

/* ═══════════ Firework burst for celebration ═══════════ */
const CelebrationFirework = ({ x, y, delay }: { x: number; y: number; delay: number }) => {
  const colors = ['hsl(48,96%,53%)', 'hsl(0,84%,60%)', 'hsl(280,87%,65%)', 'hsl(142,71%,45%)', 'hsl(217,91%,60%)'];
  return (
    <>
      {Array.from({ length: 10 }).map((_, i) => {
        const angle = (i / 10) * Math.PI * 2;
        const dist = 30 + Math.random() * 50;
        const color = colors[Math.floor(Math.random() * colors.length)];
        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, x, y, scale: 0 }}
            animate={{
              opacity: [0, 1, 1, 0],
              x: x + Math.cos(angle) * dist,
              y: y + Math.sin(angle) * dist,
              scale: [0, 1, 0.6, 0],
            }}
            transition={{ duration: 1 + Math.random() * 0.4, delay: delay + Math.random() * 0.1, ease: 'easeOut' }}
            className="absolute pointer-events-none rounded-full"
            style={{
              width: 3 + Math.random() * 4, height: 3 + Math.random() * 4,
              backgroundColor: color,
              boxShadow: `0 0 4px ${color}`,
            }}
          />
        );
      })}
    </>
  );
};

/* ═══════════ Confetti for celebration ═══════════ */
const CelebrationConfetti = ({ count = 60 }: { count?: number }) => {
  const colors = ['hsl(48,96%,53%)', 'hsl(36,100%,50%)', 'hsl(142,71%,45%)', 'hsl(217,91%,60%)', 'hsl(280,87%,65%)', 'hsl(0,84%,60%)', 'hsl(330,80%,60%)'];
  return (
    <>
      {Array.from({ length: count }).map((_, i) => {
        const startX = Math.random() * 320 - 160;
        const color = colors[Math.floor(Math.random() * colors.length)];
        return (
          <motion.div
            key={i}
            initial={{ opacity: 1, y: -10, x: startX, rotate: 0 }}
            animate={{
              opacity: [1, 1, 1, 0],
              y: [0, 200, 450, 650],
              x: [startX, startX + (Math.random() - 0.5) * 180],
              rotate: [0, Math.random() * 1080 - 540],
            }}
            transition={{ duration: 2.5 + Math.random() * 1.5, delay: Math.random() * 1, ease: 'easeOut' }}
            className="absolute top-0 pointer-events-none"
            style={{
              width: 5 + Math.random() * 7, height: 4 + Math.random() * 5,
              borderRadius: Math.random() > 0.5 ? '50%' : '2px',
              backgroundColor: color,
            }}
          />
        );
      })}
    </>
  );
};

const AchievementsWidget = ({ userId, isTrainer = false }: AchievementsWidgetProps) => {
  const { lang } = useLanguage();
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [newAchievements, setNewAchievements] = useState<Achievement[]>([]);
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebratingAchievement, setCelebratingAchievement] = useState<Achievement | null>(null);
  const [loading, setLoading] = useState(true);
  const [showGoldReward, setShowGoldReward] = useState(false);
  const [selectedLocked, setSelectedLocked] = useState<typeof ALL_MILESTONES[0] | null>(null);

  useEffect(() => {
    checkAchievements();
  }, [userId]);

  const checkAchievements = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await supabase.functions.invoke('check-achievements', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (res.data) {
        setAchievements(res.data.achievements || []);
        
        if (res.data.free_session_granted) {
          setShowGoldReward(true);
        }
        
        const newOnes = res.data.new_achievements || [];
        if (newOnes.length > 0) {
          const allAch = res.data.achievements || [];
          const newFull = allAch.filter((a: Achievement) =>
            newOnes.some((n: { achievement_key: string }) => n.achievement_key === a.achievement_key)
          );
          setNewAchievements(newFull);
          if (newFull.length > 0 && !res.data.free_session_granted) {
            setCelebratingAchievement(newFull[0]);
            setShowCelebration(true);
          }
        }
      }
    } catch (e) {
      console.error('Failed to check achievements:', e);
    } finally {
      setLoading(false);
    }
  };

  const dismissCelebration = () => {
    setShowCelebration(false);
    setCelebratingAchievement(null);
    const remaining = newAchievements.filter(
      a => a.achievement_key !== celebratingAchievement?.achievement_key
    );
    setNewAchievements(remaining);
    if (remaining.length > 0) {
      setTimeout(() => {
        setCelebratingAchievement(remaining[0]);
        setShowCelebration(true);
      }, 300);
    }
  };

  if (loading) return null;

  const earnedKeys = new Set(achievements.map(a => a.icon));
  const lockedMilestones = ALL_MILESTONES.filter(m => !earnedKeys.has(m.icon));
  const displayLocked = lockedMilestones.length > 0 ? lockedMilestones : ALL_MILESTONES;

  return (
    <>
      {/* ═══════════ Achievement badges row ═══════════ */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 px-1">
          <Trophy className="w-3.5 h-3.5 text-primary" />
          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
            {lang === 'en' ? 'Achievements' : 'Достижения'}
          </p>
          <span className="text-[10px] bg-primary/15 text-primary px-1.5 py-0.5 rounded-full font-bold ml-auto">
            {achievements.length}
          </span>
        </div>

        {/* Earned achievements */}
        {achievements.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide" onTouchStart={e => e.stopPropagation()} onTouchEnd={e => e.stopPropagation()}>
            {achievements.map((a, i) => (
              <motion.div
                key={a.id}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                className={`shrink-0 bg-gradient-to-b ${TYPE_COLORS[a.achievement_type] || 'from-primary/20 to-primary/5 border-primary/30'} border rounded-2xl px-3 py-2.5 min-w-[90px] text-center`}
              >
                <BadgeIcon icon={a.icon} size="md" className="mx-auto mb-1" />
                <p className="text-[10px] font-bold text-foreground leading-tight">
                  {lang === 'en' ? a.title_en : a.title_ru}
                </p>
                <p className="text-[8px] text-muted-foreground mt-0.5">
                  {new Date(a.earned_at).toLocaleDateString(lang === 'en' ? 'en-US' : 'ru-RU', {
                    day: 'numeric', month: 'short'
                  })}
                </p>
              </motion.div>
            ))}
          </div>
        )}

        {/* Locked milestones */}
        {displayLocked.length > 0 && (
          <div className="space-y-1.5">
            {achievements.length > 0 && (
              <p className="text-[10px] text-muted-foreground px-1 font-semibold">
                {lang === 'en' ? 'Next goals:' : 'Следующие цели:'}
              </p>
            )}
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide" onTouchStart={e => e.stopPropagation()} onTouchEnd={e => e.stopPropagation()}>
              {displayLocked.map((item, i) => (
                <motion.button
                  key={i}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: isTrainer ? 1 : 0.6, scale: 1 }}
                  transition={{ delay: i * 0.05 }}
                  whileTap={{ scale: 0.93 }}
                  onClick={() => setSelectedLocked(item)}
                  className={`shrink-0 bg-gradient-to-b ${isTrainer ? 'from-muted/60 to-muted/20 border-border/50' : 'from-muted/40 to-muted/10 border-border/30'} border rounded-2xl px-3 py-2.5 min-w-[90px] text-center relative overflow-hidden hover:border-primary/30 transition-colors`}
                >
                  {!isTrainer && (
                    <div className="absolute inset-0 flex items-center justify-center z-10">
                      <span className="text-lg opacity-50">🔒</span>
                    </div>
                  )}
                  <BadgeIcon icon={item.icon} size="md" className={`mx-auto mb-1 ${isTrainer ? '' : 'blur-[2px]'}`} />
                  <p className={`text-[10px] font-bold leading-tight ${isTrainer ? 'text-foreground/70' : 'text-muted-foreground blur-[1px]'}`}>
                    {lang === 'en' ? item.title_en : item.title_ru}
                  </p>
                  {isTrainer && (
                    <p className="text-[8px] text-muted-foreground mt-0.5 italic">
                      {lang === 'en' ? 'not earned' : 'не получен'}
                    </p>
                  )}
                </motion.button>
              ))}
            </div>
            {achievements.length === 0 && (
              <p className="text-[10px] text-muted-foreground text-center italic">
                {lang === 'en'
                  ? 'Tap any badge to learn how to unlock it!'
                  : 'Нажми на бейдж, чтобы узнать, как его получить!'}
              </p>
            )}
          </div>
        )}
      </div>

      {/* ═══════════ Locked Achievement Detail Modal ═══════════ */}
      <AnimatePresence>
        {selectedLocked && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm"
            onClick={() => setSelectedLocked(null)}
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ type: 'spring', damping: 18, stiffness: 300 }}
              className="relative bg-card border border-border/50 rounded-3xl p-7 mx-6 max-w-xs w-full text-center shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setSelectedLocked(null)}
                className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="relative inline-block mb-3">
                <BadgeIcon icon={selectedLocked.icon} size="xl" className="mx-auto opacity-40" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-2xl">🔒</span>
                </div>
              </div>

              <h3 className="text-base font-extrabold font-heading text-foreground mb-1">
                {lang === 'en' ? selectedLocked.title_en : selectedLocked.title_ru}
              </h3>
              <p className="text-sm text-muted-foreground mb-3 leading-relaxed">
                {lang === 'en' ? selectedLocked.desc_en : selectedLocked.desc_ru}
              </p>

              {/* Show free session indicator for Silver, Gold, Gold Streak */}
              {(selectedLocked.icon === '🥈' || selectedLocked.icon === '🥇') && (
                <div className="flex items-center justify-center gap-2 bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-3 py-2 mb-4">
                  <Gift className="w-4 h-4 text-yellow-500" />
                  <span className="text-xs font-bold text-yellow-500">
                    {lang === 'en' ? '+1 FREE session' : '+1 БЕСПЛАТНАЯ тренировка'}
                  </span>
                </div>
              )}

              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setSelectedLocked(null)}
                className="w-full gradient-primary text-primary-foreground font-bold py-3 rounded-xl text-sm"
              >
                {lang === 'en' ? 'Got it!' : 'Понятно!'}
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════════ Test Gold Reward Button (trainer only) ═══════════ */}
      {isTrainer && (
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowGoldReward(true)}
          className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-yellow-500/10 to-yellow-600/10 border border-yellow-500/20 rounded-2xl py-2.5 px-4 text-xs font-bold text-yellow-500 hover:from-yellow-500/20 hover:to-yellow-600/20 transition-all"
        >
          <Gift className="w-3.5 h-3.5" />
          {lang === 'en' ? '🎁 Preview Gold Reward' : '🎁 Превью Gold награды'}
        </motion.button>
      )}

      {/* ═══════════ Achievement Celebration Modal (premium fireworks) ═══════════ */}
      <AnimatePresence>
        {showCelebration && celebratingAchievement && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[150] flex items-center justify-center"
            onClick={dismissCelebration}
          >
            {/* Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 bg-background/90 backdrop-blur-lg"
            />

            {/* Pulsing aura */}
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: [1, 1.4, 1], opacity: [0.15, 0.3, 0.15] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute w-80 h-80 rounded-full"
              style={{ background: 'radial-gradient(circle, hsla(var(--primary)/0.4) 0%, transparent 70%)' }}
            />

            {/* Fireworks */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none flex items-center justify-center">
              <CelebrationFirework x={-70} y={-100} delay={0.2} />
              <CelebrationFirework x={80} y={-70} delay={0.5} />
              <CelebrationFirework x={-20} y={-140} delay={0.8} />
              <CelebrationFirework x={60} y={-120} delay={1.1} />
              <CelebrationFirework x={-90} y={-50} delay={1.4} />
            </div>

            {/* Confetti */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none flex justify-center">
              <CelebrationConfetti count={70} />
            </div>

            {/* Sparkle rain */}
            {Array.from({ length: 20 }).map((_, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: [0, 1, 0], y: ['0vh', '100vh'] }}
                transition={{ duration: 2 + Math.random() * 2, delay: Math.random() * 2, repeat: 1 }}
                className="fixed pointer-events-none z-[151]"
                style={{
                  left: `${Math.random() * 100}vw`,
                  width: 2 + Math.random() * 3, height: 2 + Math.random() * 3,
                  borderRadius: '50%',
                  backgroundColor: 'hsl(48, 96%, 53%)',
                  boxShadow: '0 0 4px hsl(48, 96%, 53%)',
                }}
              />
            ))}

            {/* Main card */}
            <motion.div
              initial={{ scale: 0.3, opacity: 0, y: 50 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.3, opacity: 0, y: 50 }}
              transition={{ type: 'spring', damping: 14, stiffness: 200, delay: 0.1 }}
              className="relative bg-card border border-primary/30 rounded-3xl p-8 mx-6 max-w-xs w-full text-center overflow-hidden"
              onClick={(e) => e.stopPropagation()}
              style={{
                boxShadow: '0 0 60px hsla(var(--primary)/0.15), 0 20px 60px hsla(0,0%,0%,0.3)',
              }}
            >
              {/* Rotating shimmer */}
              <motion.div
                animate={{ rotate: [0, 360] }}
                transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
                className="absolute -top-24 -right-24 w-48 h-48 opacity-[0.06]"
                style={{
                  background: 'conic-gradient(from 0deg, transparent, hsla(var(--primary)/0.8), transparent, hsla(var(--primary)/0.8), transparent)',
                }}
              />

              <button
                onClick={dismissCelebration}
                className="absolute top-3 right-3 text-muted-foreground hover:text-foreground z-10"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Icon with effects */}
              <div className="relative inline-block mb-4">
                <motion.div
                  animate={{ scale: [1, 1.1, 1], rotate: [0, 3, -3, 0] }}
                  transition={{ repeat: Infinity, duration: 2.5 }}
                >
                  <BadgeIcon icon={celebratingAchievement.icon} size="xl" className="mx-auto w-24 h-24" />
                </motion.div>

                {[0, 1, 2, 3].map(i => (
                  <motion.div
                    key={i}
                    animate={{ rotate: [i * 90, i * 90 + 360] }}
                    transition={{ duration: 5, repeat: Infinity, ease: 'linear' }}
                    className="absolute inset-0"
                    style={{ transformOrigin: 'center center' }}
                  >
                    <Star className="absolute -top-3 left-1/2 -translate-x-1/2 text-yellow-400"
                      style={{ width: 8 + i * 2, height: 8 + i * 2 }} fill="currentColor" />
                  </motion.div>
                ))}

                <motion.div animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }} transition={{ duration: 2, repeat: Infinity }}>
                  <Sparkles className="absolute -top-2 -right-3 w-6 h-6 text-yellow-400" />
                </motion.div>
                <motion.div animate={{ scale: [1, 1.4, 1], opacity: [0.4, 1, 0.4] }} transition={{ duration: 2.5, repeat: Infinity, delay: 0.5 }}>
                  <Sparkles className="absolute -bottom-1 -left-3 w-5 h-5 text-primary" />
                </motion.div>
              </div>

              <motion.h3
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-lg font-extrabold font-heading text-foreground mb-1"
              >
                {lang === 'en' ? '🎉 New Achievement!' : '🎉 Новое достижение!'}
              </motion.h3>
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.45 }}
                className="text-base font-bold text-primary mb-2"
              >
                {lang === 'en' ? celebratingAchievement.title_en : celebratingAchievement.title_ru}
              </motion.p>
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.55 }}
                className="text-sm text-muted-foreground leading-relaxed mb-6"
              >
                {lang === 'en' ? celebratingAchievement.description_en : celebratingAchievement.description_ru}
              </motion.p>

              <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                whileTap={{ scale: 0.95 }}
                onClick={dismissCelebration}
                className="w-full gradient-primary text-primary-foreground font-bold py-3.5 rounded-xl text-sm"
              >
                {lang === 'en' ? '🎉 Awesome!' : '🎉 Круто!'}
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════════ Gold Reward Celebration ═══════════ */}
      <GoldRewardCelebration
        show={showGoldReward}
        onDismiss={() => setShowGoldReward(false)}
      />
    </>
  );
};

export default AchievementsWidget;
