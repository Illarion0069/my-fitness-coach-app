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
}

const TYPE_COLORS: Record<string, string> = {
  session_milestone: 'from-primary/20 to-primary/5 border-primary/30',
  nutrition_streak: 'from-orange-500/20 to-orange-500/5 border-orange-500/30',
  nutrition_quality: 'from-green-500/20 to-green-500/5 border-green-500/30',
};

const AchievementsWidget = ({ userId }: AchievementsWidgetProps) => {
  const { lang } = useLanguage();
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [newAchievements, setNewAchievements] = useState<Achievement[]>([]);
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebratingAchievement, setCelebratingAchievement] = useState<Achievement | null>(null);
  const [loading, setLoading] = useState(true);
  const [showGoldReward, setShowGoldReward] = useState(false);

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
        const newOnes = res.data.new_achievements || [];
        if (newOnes.length > 0) {
          // Find the full achievement data for the new ones
          const allAch = res.data.achievements || [];
          const newFull = allAch.filter((a: Achievement) =>
            newOnes.some((n: { achievement_key: string }) => n.achievement_key === a.achievement_key)
          );
          setNewAchievements(newFull);
          // Show celebration for first new achievement
          if (newFull.length > 0) {
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

  // Locked milestone previews for empty state
  const LOCKED_PREVIEWS = [
    { icon: '🎯', title_en: '1 Session', title_ru: '1 тренировка' },
    { icon: '📸', title_en: '3-Day Streak', title_ru: '3 дня подряд' },
    { icon: '🥉', title_en: 'Bronze Nutrition', title_ru: 'Бронза питания' },
    { icon: '💪', title_en: '5 Sessions', title_ru: '5 тренировок' },
    { icon: '📷', title_en: '7-Day Streak', title_ru: '7 дней подряд' },
  ];

  const hasAchievements = achievements.length > 0;

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

        {hasAchievements ? (
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
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
        ) : (
          /* ═══════════ Empty state with locked previews ═══════════ */
          <div className="space-y-2">
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {LOCKED_PREVIEWS.map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 0.5, scale: 1 }}
                  transition={{ delay: i * 0.05 }}
                  className="shrink-0 bg-gradient-to-b from-muted/40 to-muted/10 border border-border/30 rounded-2xl px-3 py-2.5 min-w-[90px] text-center relative overflow-hidden"
                >
                  <div className="absolute inset-0 flex items-center justify-center z-10">
                    <span className="text-lg opacity-60">🔒</span>
                  </div>
                  <span className="text-2xl block mb-1 blur-[2px]">{item.icon}</span>
                  <p className="text-[10px] font-bold text-muted-foreground leading-tight blur-[1px]">
                    {lang === 'en' ? item.title_en : item.title_ru}
                  </p>
                </motion.div>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground text-center italic">
              {lang === 'en'
                ? 'Complete sessions & log food to unlock achievements!'
                : 'Тренируйся и логируй питание, чтобы открыть награды!'}
            </p>
          </div>
        )}
      </div>

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

              {/* Confetti-like sparkles */}
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
    </>
  );
};

export default AchievementsWidget;
