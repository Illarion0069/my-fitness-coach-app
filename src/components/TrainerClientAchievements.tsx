import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Gift, TrendingUp, Target } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

import badgeStreak3 from '@/assets/badges/streak-3.png';
import badgeStreak7 from '@/assets/badges/streak-7.png';
import badgeStreak14 from '@/assets/badges/streak-14.png';
import badgeStreak30 from '@/assets/badges/streak-30.png';
import badgeStreak60 from '@/assets/badges/streak-60.png';
import badgeStreak90 from '@/assets/badges/streak-90.png';
import badgeBronze from '@/assets/badges/nutrition-bronze.png';
import badgeSilver from '@/assets/badges/nutrition-silver.png';
import badgeGold from '@/assets/badges/nutrition-gold.png';

const BADGE_IMAGES: Record<string, string> = {
  '📸': badgeStreak3, '📷': badgeStreak7, '🎞️': badgeStreak14,
  '🌟': badgeStreak30, '💎': badgeStreak60, '🔱': badgeStreak90,
  '🥉': badgeBronze, '🥈': badgeSilver, '🥇': badgeGold,
};

const ALL_BADGES = [
  { icon: '📸', title_ru: '3 дня', title_en: '3d' },
  { icon: '📷', title_ru: '7 дней', title_en: '7d' },
  { icon: '🎞️', title_ru: '14 дней', title_en: '14d' },
  { icon: '🌟', title_ru: '30 дней', title_en: '30d' },
  { icon: '💎', title_ru: '60 дней', title_en: '60d' },
  { icon: '🔱', title_ru: '90 дней', title_en: '90d' },
  { icon: '🥉', title_ru: 'Бронза', title_en: 'Bronze' },
  { icon: '🥈', title_ru: 'Серебро', title_en: 'Silver' },
  { icon: '🥇', title_ru: 'Золото', title_en: 'Gold' },
];

interface Achievement {
  id: string;
  achievement_key: string;
  achievement_type: string;
  icon: string;
  title_en: string;
  title_ru: string;
  earned_at: string;
}

interface Props {
  userId: string;
  lang: string;
}

const TrainerClientAchievements = ({ userId, lang }: Props) => {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('client_achievements')
      .select('id, achievement_key, achievement_type, icon, title_en, title_ru, earned_at')
      .eq('user_id', userId)
      .order('earned_at', { ascending: false })
      .then(({ data }) => {
        setAchievements(data || []);
        setLoading(false);
      });
  }, [userId]);

  if (loading) return null;

  const earnedIcons = new Set(achievements.map(a => a.icon));
  const freeSessionCount = achievements.filter(a => a.achievement_key.startsWith('nutrition_3week_reward_')).length;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <Trophy className="w-3.5 h-3.5 text-primary" />
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
          {lang === 'en' ? 'Achievements' : 'Награды'}
        </span>
        <span className="text-[9px] bg-primary/15 text-primary px-1.5 py-0.5 rounded-full font-bold ml-auto">
          {achievements.length}
        </span>
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {ALL_BADGES.map((badge, i) => {
          const earned = earnedIcons.has(badge.icon);
          const earnedData = achievements.find(a => a.icon === badge.icon);
          const src = BADGE_IMAGES[badge.icon];
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.03 }}
              className={`relative flex flex-col items-center rounded-xl px-1.5 py-1.5 min-w-[52px] border transition-all ${
                earned
                  ? 'bg-gradient-to-b from-primary/15 to-primary/5 border-primary/30'
                  : 'bg-muted/30 border-border/20'
              }`}
            >
              {src ? (
                <img
                  src={src}
                  alt=""
                  className={`w-7 h-7 object-contain ${earned ? '' : 'grayscale opacity-30'}`}
                />
              ) : (
                <span className={`text-lg ${earned ? '' : 'grayscale opacity-30'}`}>{badge.icon}</span>
              )}
              <span className={`text-[7px] font-semibold mt-0.5 leading-tight ${earned ? 'text-foreground' : 'text-muted-foreground/50'}`}>
                {lang === 'en' ? badge.title_en : badge.title_ru}
              </span>
              {earned && earnedData && (
                <span className="text-[6px] text-muted-foreground">
                  {new Date(earnedData.earned_at).toLocaleDateString(lang === 'en' ? 'en-US' : 'ru-RU', { day: 'numeric', month: 'short' })}
                </span>
              )}
            </motion.div>
          );
        })}
      </div>

      {freeSessionCount > 0 && (
        <div className="flex items-center gap-1.5 bg-primary/10 border border-primary/20 rounded-lg px-2.5 py-1.5">
          <Gift className="w-3.5 h-3.5 text-primary" />
          <span className="text-[10px] font-bold text-foreground">
            {lang === 'en'
              ? `${freeSessionCount} free session${freeSessionCount > 1 ? 's' : ''} earned`
              : `${freeSessionCount} бесплатн. тренировок получено`}
          </span>
        </div>
      )}
    </div>
  );
};

export default TrainerClientAchievements;
