import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Activity } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';

interface Package {
  id: string;
  package_name: string;
  total_sessions: number;
  used_sessions: number;
  is_active: boolean;
}

const SessionWidget = () => {
  const { user } = useAuth();
  const { lang } = useLanguage();
  const [pkg, setPkg] = useState<Package | null>(null);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      // First try active packages
      const { data: active } = await supabase
        .from('client_packages')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (active) {
        setPkg(active);
        return;
      }

      // Fallback: show most recent package (even exhausted) so client sees 0/N
      const { data: latest } = await supabase
        .from('client_packages')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      setPkg(latest);
    };
    fetch();

    const channel = supabase
      .channel('client-packages')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'client_packages', filter: `user_id=eq.${user.id}` }, () => fetch())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  if (!user || !pkg) return null;

  const remaining = pkg.total_sessions - pkg.used_sessions;
  const pct = Math.round((remaining / pkg.total_sessions) * 100);
  const low = remaining <= 2;

  const exhausted = remaining <= 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border/50 rounded-2xl p-4 mb-4"
    >
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${exhausted ? 'bg-destructive/20' : low ? 'bg-destructive/20' : 'gradient-primary'}`}>
          <Activity className={`w-5 h-5 ${exhausted || low ? 'text-destructive' : 'text-primary-foreground'}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground">{pkg.package_name}</p>
          <p className="text-lg font-extrabold font-heading">
            {remaining} <span className="text-sm font-normal text-muted-foreground">/ {pkg.total_sessions} {lang === 'en' ? 'sessions left' : 'занятий осталось'}</span>
          </p>
          {exhausted && (
            <p className="text-xs text-destructive font-semibold mt-0.5">
              {lang === 'en' ? '⚠ Package exhausted — buy more sessions' : '⚠ Пакет исчерпан — докупите тренировки'}
            </p>
          )}
        </div>
      </div>
      <div className="mt-3 h-2 bg-secondary rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.max(pct, 0)}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className={`h-full rounded-full ${exhausted || low ? 'bg-destructive' : 'gradient-primary'}`}
        />
      </div>
    </motion.div>
  );
};

export default SessionWidget;
