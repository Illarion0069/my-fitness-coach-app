import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { calculateNutritionTargets } from '../../supabase/functions/_shared/nutritionTargets';

export function useNutritionTargets(userId?: string) {
  const [targets, setTargets] = useState(() => calculateNutritionTargets(null));
  useEffect(() => {
    if (!userId) { setTargets(calculateNutritionTargets(null)); return; }
    let cancelled = false;
    setTargets(calculateNutritionTargets(null));
    const load = async () => {
      const [profile, weight, baseline] = await Promise.all([
        supabase.from('profiles').select('height_cm, weight_kg, birth_date, gender, nutrition_goal, daily_calorie_goal, calorie_goal_auto').eq('user_id', userId).maybeSingle(),
        supabase.from('body_measurements').select('weight_kg').eq('user_id', userId).not('weight_kg', 'is', null).order('measured_at', { ascending: false }).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('test_results').select('answers').eq('user_id', userId).eq('test_type', 'baseline').order('created_at', { ascending: false }).limit(1).maybeSingle(),
      ]);
      if (cancelled) return;
      if (profile.error || weight.error || baseline.error) { console.error('Nutrition parameters could not be loaded'); return; }
      setTargets(calculateNutritionTargets(profile.data, weight.data?.weight_kg, baseline.data?.answers));
    };
    void load();
    const channel = supabase.channel(`nutrition-targets-${userId}-${Math.random()}`);
    for (const table of ['profiles', 'body_measurements', 'test_results']) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table, filter: `user_id=eq.${userId}` }, () => { void load(); });
    }
    channel.subscribe();
    window.addEventListener('focus', load);
    return () => { cancelled = true; window.removeEventListener('focus', load); void supabase.removeChannel(channel); };
  }, [userId]);
  return targets;
}