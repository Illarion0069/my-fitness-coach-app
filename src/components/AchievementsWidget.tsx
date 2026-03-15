import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Sparkles, X, Gift } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import GoldRewardCelebration from './GoldRewardCelebration';

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

const TYPE_COLORS: Record<string, string> = {
  nutrition_streak: 'from-orange-500/20 to-orange-500/5 border-orange-500/30',
  nutrition_quality: 'from-green-500/20 to-green-500/5 border-green-500/30',
  gold_streak_reward: 'from-yellow-500/20 to-yellow-500/5 border-yellow-500/30',
};

const ALL_MILESTONES = [
  { icon: '🎯', title_en: '1 Session', title_ru: '1 тренировка', desc_en: 'Complete your first training session with the coach.', desc_ru: 'Завершите первую тренировку с тренером.' },
  { icon: '💪', title_en: '5 Sessions', title_ru: '5 тренировок', desc_en: 'Complete 5 training sessions. Keep showing up!', desc_ru: 'Завершите 5 тренировок. Продолжайте приходить!' },
  { icon: '🔥', title_en: '10 Sessions', title_ru: '10 тренировок', desc_en: 'Complete 10 sessions. You\'re building a habit!', desc_ru: 'Завершите 10 тренировок. Привычка формируется!' },
  { icon: '⭐', title_en: '25 Sessions', title_ru: '25 тренировок', desc_en: 'Complete 25 sessions. Consistency is key!', desc_ru: 'Завершите 25 тренировок. Постоянство — залог успеха!' },
  { icon: '📸', title_en: '3-Day Streak', title_ru: '3 дня подряд', desc_en: 'Log food photos for 3 consecutive days.', desc_ru: 'Фотографируйте еду 3 дня подряд.' },
  { icon: '📷', title_en: '7-Day Streak', title_ru: '7 дней подряд', desc_en: 'Log food photos for 7 consecutive days. A full week!', desc_ru: 'Фотографируйте еду 7 дней подряд. Целая неделя!' },
  { icon: '🎞️', title_en: '14-Day Streak', title_ru: '14 дней подряд', desc_en: 'Log food photos for 14 days straight!', desc_ru: 'Фотографируйте еду 14 дней подряд!' },
  { icon: '🥉', title_en: 'Bronze Nutrition', title_ru: 'Бронза питания', desc_en: 'Achieve a weekly average nutrition score ≥ 60%.', desc_ru: 'Достигните среднего балла питания за неделю ≥ 60%.' },
  { icon: '🥈', title_en: 'Silver Nutrition', title_ru: 'Серебро питания', desc_en: 'Achieve a weekly average nutrition score ≥ 80%.', desc_ru: 'Достигните среднего балла питания за неделю ≥ 80%.' },
  { icon: '🥇', title_en: 'Gold Nutrition', title_ru: 'Золото питания', desc_en: 'Achieve a weekly average nutrition score ≥ 95%.', desc_ru: 'Достигните среднего балла питания за неделю ≥ 95%.' },
  { icon: '🎁', title_en: 'Gold Streak Reward', title_ru: 'Gold серия', desc_en: 'Get Gold nutrition for 3 consecutive weeks to earn a FREE session!', desc_ru: 'Получите Gold рейтинг питания 3 недели подряд и получите БЕСПЛАТНУЮ тренировку!' },
];

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
        
        // Check for gold streak reward
        if (res.data.gold_reward_granted) {
          setShowGoldReward(true);
        }
        
        const newOnes = res.data.new_achievements || [];
        if (newOnes.length > 0) {
          const allAch = res.data.achievements || [];
          const newFull = allAch.filter((a: Achievement) =>
            newOnes.some((n: { achievement_key: string }) => n.achievement_key === a.achievement_key)
          );
          setNewAchievements(newFull);
          if (newFull.length > 0 && !res.data.gold_reward_granted) {
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
    // Show next achievement if any
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

  // Filter out already earned milestones for locked display
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
                <span className="text-2xl block mb-1">{a.icon}</span>
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

        {/* Locked milestones (always shown — tappable) */}
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
                  animate={{ opacity: 0.6, scale: 1 }}
                  transition={{ delay: i * 0.05 }}
                  whileTap={{ scale: 0.93 }}
                  onClick={() => setSelectedLocked(item)}
                  className="shrink-0 bg-gradient-to-b from-muted/40 to-muted/10 border border-border/30 rounded-2xl px-3 py-2.5 min-w-[90px] text-center relative overflow-hidden hover:border-primary/30 transition-colors"
                >
                  <div className="absolute inset-0 flex items-center justify-center z-10">
                    <span className="text-lg opacity-50">🔒</span>
                  </div>
                  <span className="text-2xl block mb-1 blur-[2px]">{item.icon}</span>
                  <p className="text-[10px] font-bold text-muted-foreground leading-tight blur-[1px]">
                    {lang === 'en' ? item.title_en : item.title_ru}
                  </p>
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
                <span className="text-5xl block opacity-40">{selectedLocked.icon}</span>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-2xl">🔒</span>
                </div>
              </div>

              <h3 className="text-base font-extrabold font-heading text-foreground mb-1">
                {lang === 'en' ? selectedLocked.title_en : selectedLocked.title_ru}
              </h3>
              <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
                {lang === 'en' ? selectedLocked.desc_en : selectedLocked.desc_ru}
              </p>

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

      {/* ═══════════ Celebration Modal ═══════════ */}
      <AnimatePresence>
        {showCelebration && celebratingAchievement && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm"
            onClick={dismissCelebration}
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ type: 'spring', damping: 15, stiffness: 300 }}
              className="relative bg-card border border-border/50 rounded-3xl p-8 mx-6 max-w-xs w-full text-center shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={dismissCelebration}
                className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="relative inline-block mb-4">
                <motion.div
                  animate={{ rotate: [0, 5, -5, 0] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                >
                  <span className="text-6xl">{celebratingAchievement.icon}</span>
                </motion.div>
                <Sparkles className="absolute -top-2 -right-2 w-6 h-6 text-yellow-400 animate-pulse" />
                <Sparkles className="absolute -bottom-1 -left-2 w-4 h-4 text-primary animate-pulse" style={{ animationDelay: '0.5s' }} />
              </div>

              <h3 className="text-lg font-extrabold font-heading text-foreground mb-1">
                {lang === 'en' ? '🎉 New Achievement!' : '🎉 Новое достижение!'}
              </h3>
              <p className="text-base font-bold text-primary mb-2">
                {lang === 'en' ? celebratingAchievement.title_en : celebratingAchievement.title_ru}
              </p>
              <p className="text-sm text-muted-foreground">
                {lang === 'en' ? celebratingAchievement.description_en : celebratingAchievement.description_ru}
              </p>

              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={dismissCelebration}
                className="mt-6 w-full gradient-primary text-primary-foreground font-bold py-3 rounded-xl text-sm"
              >
                {lang === 'en' ? 'Awesome!' : 'Круто!'}
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
