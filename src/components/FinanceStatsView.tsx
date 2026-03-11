import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DollarSign, TrendingUp, Users, Calendar, ChevronLeft, ChevronRight, Activity } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths, addMonths, eachWeekOfInterval, startOfWeek, endOfWeek, isWithinInterval } from 'date-fns';
import { ru } from 'date-fns/locale';

interface FinanceStatsViewProps {
  lang: 'en' | 'ru';
}

interface PackageRecord {
  id: string;
  user_id: string;
  total_sessions: number;
  used_sessions: number;
  is_active: boolean;
  purchased_at: string;
  package_name: string;
}

interface LedgerEntry {
  id: string;
  user_id: string;
  delta: number;
  reason: string;
  created_at: string;
  package_id: string;
}

interface SessionRecord {
  id: string;
  user_id: string;
  session_date: string;
  is_recurring: boolean;
  is_deducted: boolean;
}

interface ProfileRecord {
  user_id: string;
  full_name: string;
}

const PRICE_MAP: Record<number, number> = {
  1: 100,
  8: 750,
  12: 1030,
  20: 1599,
};

// Clients who always pay €100 per session (no package)
const PAY_PER_SESSION_NAMES = ['boris', 'nitay', 'eugeny'];
// Clients who train for free
const FREE_CLIENT_NAMES = ['rom', 'natali', 'alexander'];

function isPayPerSession(name: string): boolean {
  const lower = name.toLowerCase();
  return PAY_PER_SESSION_NAMES.some(n => lower.includes(n));
}

function isFreeClient(name: string): boolean {
  const lower = name.toLowerCase();
  return FREE_CLIENT_NAMES.some(n => lower.includes(n));
}

function getPackagePrice(totalSessions: number): number {
  return PRICE_MAP[totalSessions] || totalSessions * 85;
}

function getPerSessionPrice(totalSessions: number): number {
  const price = getPackagePrice(totalSessions);
  return Math.round(price / totalSessions);
}

const FinanceStatsView = ({ lang }: FinanceStatsViewProps) => {
  const [packages, setPackages] = useState<PackageRecord[]>([]);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [profiles, setProfiles] = useState<ProfileRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  useEffect(() => {
    const fetch = async () => {
      const [{ data: pkgs }, { data: ldg }, { data: sess }, { data: profs }] = await Promise.all([
        supabase.from('client_packages').select('*').order('purchased_at', { ascending: false }),
        supabase.from('session_ledger').select('*').order('created_at', { ascending: false }),
        supabase.from('scheduled_sessions').select('id, user_id, session_date, is_recurring, is_deducted'),
        supabase.from('profiles').select('user_id, full_name'),
      ]);
      setPackages((pkgs || []) as PackageRecord[]);
      setLedger((ldg || []) as LedgerEntry[]);
      setSessions((sess || []) as SessionRecord[]);
      setProfiles((profs || []) as ProfileRecord[]);
      setLoading(false);
    };
    fetch();
  }, []);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);

  // Revenue from packages sold this month
  const monthlyRevenue = useMemo(() => {
    return packages
      .filter(p => {
        const d = new Date(p.purchased_at);
        return d >= monthStart && d <= monthEnd;
      })
      .reduce((sum, p) => sum + getPackagePrice(p.total_sessions), 0);
  }, [packages, monthStart, monthEnd]);

  // Sessions delivered this month (from ledger, delta > 0 means deduction)
  const sessionsDelivered = useMemo(() => {
    return ledger.filter(e => {
      const d = new Date(e.created_at);
      return d >= monthStart && d <= monthEnd && e.delta > 0;
    }).length;
  }, [ledger, monthStart, monthEnd]);

  // Revenue per delivered session (earned revenue)
  const earnedRevenue = useMemo(() => {
    let total = 0;
    ledger
      .filter(e => {
        const d = new Date(e.created_at);
        return d >= monthStart && d <= monthEnd && e.delta > 0;
      })
      .forEach(entry => {
        const pkg = packages.find(p => p.id === entry.package_id);
        if (pkg) {
          total += getPerSessionPrice(pkg.total_sessions);
        }
      });
    return total;
  }, [ledger, packages, monthStart, monthEnd]);

  // Expected revenue = all active packages' remaining sessions * per-session price
  const expectedMonthlyRevenue = useMemo(() => {
    // Based on active packages and weekly frequency, estimate this month's delivery
    const activeClients = new Set(packages.filter(p => p.is_active).map(p => p.user_id));
    let expectedSessions = 0;

    activeClients.forEach(userId => {
      // Count recurring sessions for this user
      const recurring = sessions.filter(s => s.user_id === userId && s.is_recurring);
      const oneOff = sessions.filter(s => {
        if (s.is_recurring) return false;
        const d = new Date(s.session_date + 'T00:00:00');
        return s.user_id === userId && d >= monthStart && d <= monthEnd;
      });
      
      // Recurring = sessions per week * weeks in month
      const weeksInMonth = eachWeekOfInterval({ start: monthStart, end: monthEnd }, { weekStartsOn: 1 }).length;
      expectedSessions += recurring.length * weeksInMonth + oneOff.length;
    });

    // Average per-session price across active packages
    const activePkgs = packages.filter(p => p.is_active);
    if (activePkgs.length === 0) return 0;
    const avgPrice = activePkgs.reduce((s, p) => s + getPerSessionPrice(p.total_sessions), 0) / activePkgs.length;
    
    return Math.round(expectedSessions * avgPrice);
  }, [packages, sessions, monthStart, monthEnd]);

  // Active clients count
  const activeClientsCount = useMemo(() => {
    return new Set(packages.filter(p => p.is_active).map(p => p.user_id)).size;
  }, [packages]);

  // Client frequency stats
  const clientFrequency = useMemo(() => {
    const monthDeductions = ledger.filter(e => {
      const d = new Date(e.created_at);
      return d >= monthStart && d <= monthEnd && e.delta > 0;
    });

    const perClient: Record<string, number> = {};
    monthDeductions.forEach(e => {
      perClient[e.user_id] = (perClient[e.user_id] || 0) + 1;
    });

    const entries = Object.entries(perClient)
      .map(([userId, count]) => ({
        userId,
        name: profiles.find(p => p.user_id === userId)?.full_name || '?',
        count,
      }))
      .sort((a, b) => b.count - a.count);

    const total = entries.reduce((s, e) => s + e.count, 0);
    const avg = entries.length > 0 ? (total / entries.length).toFixed(1) : '0';

    return { entries, avg, total };
  }, [ledger, profiles, monthStart, monthEnd]);

  // Packages sold this month
  const packagesSold = useMemo(() => {
    return packages
      .filter(p => {
        const d = new Date(p.purchased_at);
        return d >= monthStart && d <= monthEnd;
      })
      .map(p => ({
        ...p,
        clientName: profiles.find(pr => pr.user_id === p.user_id)?.full_name || '?',
        price: getPackagePrice(p.total_sessions),
      }))
      .sort((a, b) => new Date(b.purchased_at).getTime() - new Date(a.purchased_at).getTime());
  }, [packages, profiles, monthStart, monthEnd]);

  const monthLabel = format(currentMonth, 'LLLL yyyy', { locale: lang === 'ru' ? ru : undefined });

  if (loading) return <div className="p-6 text-center text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-4">
      {/* Month selector */}
      <div className="flex items-center justify-between">
        <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-2 rounded-lg hover:bg-secondary/50 transition-colors">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <h2 className="text-sm font-bold capitalize">{monthLabel}</h2>
        <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-2 rounded-lg hover:bg-secondary/50 transition-colors">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Key metrics grid */}
      <div className="grid grid-cols-2 gap-3">
        <MetricCard
          icon={<DollarSign className="w-4 h-4" />}
          label={lang === 'en' ? 'Revenue (sold)' : 'Выручка (продажи)'}
          value={`€${monthlyRevenue.toLocaleString()}`}
          color="text-green-500"
          bgColor="bg-green-500/10"
        />
        <MetricCard
          icon={<TrendingUp className="w-4 h-4" />}
          label={lang === 'en' ? 'Earned (delivered)' : 'Заработано (факт)'}
          value={`€${earnedRevenue.toLocaleString()}`}
          color="text-blue-500"
          bgColor="bg-blue-500/10"
        />
        <MetricCard
          icon={<Calendar className="w-4 h-4" />}
          label={lang === 'en' ? 'Expected' : 'Ожидаемо'}
          value={`€${expectedMonthlyRevenue.toLocaleString()}`}
          color="text-amber-500"
          bgColor="bg-amber-500/10"
        />
        <MetricCard
          icon={<Activity className="w-4 h-4" />}
          label={lang === 'en' ? 'Sessions' : 'Тренировок'}
          value={String(sessionsDelivered)}
          sub={`${clientFrequency.avg} ${lang === 'en' ? 'avg/client' : 'ср/клиент'}`}
          color="text-purple-500"
          bgColor="bg-purple-500/10"
        />
      </div>

      {/* Active clients */}
      <div className="bg-card border border-border/50 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Users className="w-4 h-4 text-primary" />
          <h3 className="text-xs font-bold">
            {lang === 'en' ? `Active clients: ${activeClientsCount}` : `Активных клиентов: ${activeClientsCount}`}
          </h3>
        </div>

        {/* Frequency breakdown */}
        {clientFrequency.entries.length > 0 ? (
          <div className="space-y-1.5">
            {clientFrequency.entries.map(e => (
              <div key={e.userId} className="flex items-center justify-between text-xs">
                <span className="truncate mr-2">{e.name}</span>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="w-16 h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full"
                      style={{ width: `${Math.min(100, (e.count / 20) * 100)}%` }}
                    />
                  </div>
                  <span className="text-muted-foreground w-12 text-right">
                    {e.count} {lang === 'en' ? 'sess' : 'тр.'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">{lang === 'en' ? 'No sessions this month' : 'Нет тренировок в этом месяце'}</p>
        )}
      </div>

      {/* Packages sold */}
      <div className="bg-card border border-border/50 rounded-2xl p-4">
        <h3 className="text-xs font-bold mb-3 flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-green-500" />
          {lang === 'en' ? 'Packages sold' : 'Проданные пакеты'}
        </h3>
        {packagesSold.length > 0 ? (
          <div className="space-y-2">
            {packagesSold.map(p => (
              <div key={p.id} className="flex items-center justify-between text-xs bg-secondary/30 rounded-xl px-3 py-2">
                <div>
                  <p className="font-semibold">{p.clientName}</p>
                  <p className="text-muted-foreground">{p.package_name}</p>
                </div>
                <span className="font-bold text-green-500">€{p.price}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">{lang === 'en' ? 'No packages sold this month' : 'Нет продаж в этом месяце'}</p>
        )}
      </div>
    </div>
  );
};

function MetricCard({ icon, label, value, sub, color, bgColor }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  color: string;
  bgColor: string;
}) {
  return (
    <div className="bg-card border border-border/50 rounded-2xl p-4">
      <div className={`w-8 h-8 rounded-xl ${bgColor} flex items-center justify-center ${color} mb-2`}>
        {icon}
      </div>
      <p className="text-[11px] text-muted-foreground mb-1">{label}</p>
      <p className="text-lg font-extrabold">{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

export default FinanceStatsView;
