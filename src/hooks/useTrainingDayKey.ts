import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Returns a stable fingerprint of the client's training slots for a given date.
 * Recomputes automatically when sessions are cancelled, moved or a recurring
 * series is edited — so nutrition advice can be re-generated for the real
 * training/rest day without any manual action.
 *
 * Format: "18:00,20:00" or "" (rest day). `null` while loading.
 */
export function useTrainingDayKey(userId?: string | null, date?: string) {
  const [key, setKey] = useState<string | null>(null);

  useEffect(() => {
    if (!userId || !date) { setKey(null); return; }
    let cancelled = false;

    const load = async () => {
      const { data, error } = await supabase
        .from('scheduled_sessions')
        .select('session_date, session_time, is_recurring, recurrence_day, recurrence_time, recurrence_end_date, recurring_exceptions, created_at')
        .eq('user_id', userId);
      if (cancelled) return;
      if (error || !data) { setKey(''); return; }

      // Noon avoids UTC shifting (Asia/Nicosia rule).
      const d = new Date(`${date}T12:00:00`);
      const weekday = d.getDay();
      const times: string[] = [];

      for (const s of data as any[]) {
        if (s.is_recurring) {
          if (s.recurrence_day !== weekday) continue;
          if (s.recurrence_end_date && date > s.recurrence_end_date) continue;
          const startedOn = (s.session_date || String(s.created_at || '').slice(0, 10));
          if (startedOn && date < startedOn) continue;
          const exceptions: string[] = s.recurring_exceptions || [];
          if (exceptions.includes(date)) continue;
          times.push((s.recurrence_time || '').slice(0, 5));
        } else if (s.session_date === date) {
          times.push((s.session_time || '').slice(0, 5));
        }
      }

      setKey(Array.from(new Set(times)).sort().join(','));
    };

    load();

    const channel = supabase
      .channel(`training-day-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'scheduled_sessions', filter: `user_id=eq.${userId}` },
        () => { load(); },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [userId, date]);

  return key;
}
