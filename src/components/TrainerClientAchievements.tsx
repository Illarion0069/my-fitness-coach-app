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

function getWeekStart(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split('T')[0];
}

interface WeekData {
  week: string;
  avg: number;
  count: number;
  qualified: boolean;
}

const TrainerClientAchievements = ({ userId, lang }: Props) => {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [weeklyData, setWeeklyData] = useState<WeekData[]>([]);
  const [consecutiveWeeks, setConsecutiveWeeks] = useState(0);
  const [currentWeekAvg, setCurrentWeekAvg] = useState<number | null>(null);
  const [currentWeekDays, setCurrentWeekDays] = useState(0);

  useEffect(() => {
    const fetchAll = async () => {
      const [achRes, logsRes] = await Promise.all([
        supabase
          .from('client_achievements')
          .select('id, achievement_key, achievement_type, icon, title_en, title_ru, earned_at')
          .eq('user_id', userId)
          .order('earned_at', { ascending: false }),
        supabase
          .from('nutrition_logs')
          .select('ai_score, log_date')
          .eq('user_id', userId)
          .gte('log_date', new Date(Date.now() - 84 * 86400000).toISOString().split('T')[0])
          .not('ai_score', 'is', null)
          .order('log_date', { ascending: true }),
      ]);

      setAchievements(achRes.data || []);

      // Compute weekly averages
      const logs = logsRes.data || [];
      const weekScores: Record<string, number[]> = {};
      for (const log of logs) {
        const ws = getWeekStart(new Date(log.log_date + 'T00:00:00'));
        if (!weekScores[ws]) weekScores[ws] = [];
        weekScores[ws].push(log.ai_score!);
      }

      const today = new Date();
      const currentWS = getWeekStart(today);

      // Current week stats
      const cwScores = weekScores[currentWS] || [];
      setCurrentWeekDays(cwScores.length);
      setCurrentWeekAvg(cwScores.length > 0 ? Math.round(cwScores.reduce((a, b) => a + b, 0) / cwScores.length) : null);

      // Past completed weeks
      const sortedWeeks = Object.keys(weekScores).filter(w => w < currentWS).sort();
      const computed: WeekData[] = [];
      for (const w of sortedWeeks) {
        const scores = weekScores[w];
        if (scores.length >= 5) {
          const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
          computed.push({ week: w, avg, count: scores.length, qualified: avg >= 80 });
        }
      }
      setWeeklyData(computed);

      // Consecutive qualifying weeks from most recent
      let consec = 0;
      for (let i = computed.length - 1; i >= 0; i--) {
        if (computed[i].qualified) consec++;
        else break;
      }
      setConsecutiveWeeks(consec);

      setLoading(false);
    };
    fetchAll();
  }, [userId]);

  if (loading) return null;

  const earnedIcons = new Set(achievements.map(a => a.icon));
  const freeSessionCount = achievements.filter(a => a.achievement_key.startsWith('nutrition_3week_reward_')).length;
  const weeksInCycle = consecutiveWeeks % 3;

  return (
    <div className="space-y-2">
      {/* Weekly Progress Widget */}
      <div className="bg-gradient-to-br from-orange-500/10 to-amber-500/5 border border-orange-500/20 rounded-xl p-3 space-y-2.5">
        <div className="flex items-center gap-1.5">
          <TrendingUp className="w-3.5 h-3.5 text-orange-400" />
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
            {lang === 'en' ? 'Free Session Progress' : 'Прогресс до бесплатной'}
          </span>
        </div>

        {/* Current week */}
        <div className="bg-background/50 rounded-lg p-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] text-muted-foreground font-semibold">
              {lang === 'en' ? 'This week' : 'Эта неделя'}
            </span>
            <span className="text-[9px] text-muted-foreground">
              {currentWeekDays}/5 {lang === 'en' ? 'days' : 'дней'}
            </span>
          </div>
          {currentWeekAvg !== null ? (
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${currentWeekAvg >= 80 ? 'bg-green-500' : currentWeekAvg >= 60 ? 'bg-amber-500' : 'bg-red-400'}`}
                  style={{ width: `${Math.min(currentWeekAvg, 100)}%` }}
                />
              </div>
              <span className={`text-xs font-bold ${currentWeekAvg >= 80 ? 'text-green-500' : currentWeekAvg >= 60 ? 'text-amber-500' : 'text-red-400'}`}>
                {currentWeekAvg}%
              </span>
            </div>
          ) : (
            <span className="text-[9px] text-muted-foreground/50">{lang === 'en' ? 'No data yet' : 'Пока нет данных'}</span>
          )}
        </div>

        {/* 3-week cycle progress */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[9px] text-muted-foreground font-semibold">
              {lang === 'en' ? '3-week cycle (≥80%)' : 'Цикл 3 недели (≥80%)'}
            </span>
            <span className="text-[10px] font-bold text-foreground">{weeksInCycle}/3</span>
          </div>
          <div className="flex gap-1">
            {[0, 1, 2].map(i => (
              <div key={i} className="flex-1 h-2 rounded-full overflow-hidden bg-secondary">
                <div
                  className={`h-full rounded-full transition-all ${i < weeksInCycle ? 'bg-primary' : ''}`}
                  style={{ width: i < weeksInCycle ? '100%' : '0%' }}
                />
              </div>
            ))}
          </div>
          {weeksInCycle > 0 && (
            <p className="text-[8px] text-primary mt-1">
              {lang === 'en' ? `${3 - weeksInCycle} more week(s) to free session!` : `Ещё ${3 - weeksInCycle} нед. до бесплатной!`}
            </p>
          )}
          {weeksInCycle === 0 && consecutiveWeeks === 0 && (
            <p className="text-[8px] text-muted-foreground/60 mt-1">
              {lang === 'en' ? 'Need ≥80% avg for a full week (5+ days)' : 'Нужен ≥80% за полную неделю (5+ дней)'}
            </p>
          )}
        </div>

        {/* Recent weeks history */}
        {weeklyData.length > 0 && (
          <div className="space-y-1">
            <span className="text-[8px] text-muted-foreground/60 font-semibold uppercase">
              {lang === 'en' ? 'Recent weeks' : 'Прошлые недели'}
            </span>
            {weeklyData.slice(-4).reverse().map(w => (
              <div key={w.week} className="flex items-center gap-2 text-[9px]">
                <span className="text-muted-foreground w-16">
                  {new Date(w.week + 'T00:00:00').toLocaleDateString(lang === 'en' ? 'en-US' : 'ru-RU', { day: 'numeric', month: 'short' })}
                </span>
                <div className="flex-1 h-1 bg-secondary rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${w.qualified ? 'bg-green-500' : 'bg-amber-500'}`}
                    style={{ width: `${Math.min(w.avg, 100)}%` }}
                  />
                </div>
                <span className={`font-bold ${w.qualified ? 'text-green-500' : 'text-amber-500'}`}>
                  {w.avg}%
                </span>
                {w.qualified && <Target className="w-2.5 h-2.5 text-green-500" />}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Badges */}
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
