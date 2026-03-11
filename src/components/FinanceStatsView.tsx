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
  price_paid: number | null;
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
  notes: string | null;
}

interface ProfileRecord {
  user_id: string;
  full_name: string;
}

const PRICE_MAP: Record<number, number> = {
  1: 100,
  8: 750,
  10: 1000,
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

function getPackagePrice(pkg: PackageRecord): number {
  if (pkg.price_paid != null) return pkg.price_paid;
  return PRICE_MAP[pkg.total_sessions] || pkg.total_sessions * 85;
}

function getPerSessionPrice(pkg: PackageRecord): number {
  const price = getPackagePrice(pkg);
  return Math.round(price / pkg.total_sessions);
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
        supabase.from('scheduled_sessions').select('id, user_id, session_date, is_recurring, is_deducted, notes'),
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

  // Helper: get no-package sessions delivered this month (from scheduled_sessions, not ledger)
  const noPackageMonthSessions = useMemo(() => {
    // Find users who have sessions in calendar but NO packages at all
    const usersWithPkgs = new Set(packages.map(p => p.user_id));
    
    return sessions.filter(s => {
      if (usersWithPkgs.has(s.user_id)) return false; // has a package, handled by ledger
      if (s.is_recurring) return false; // recurring without package — count separately below
      const d = new Date(s.session_date + 'T00:00:00');
      return d >= monthStart && d <= monthEnd;
    });
  }, [sessions, packages, monthStart, monthEnd]);

  // Recurring sessions for no-package users this month
  const noPackageRecurringSessions = useMemo(() => {
    const usersWithPkgs = new Set(packages.map(p => p.user_id));
    const recurring = sessions.filter(s => !usersWithPkgs.has(s.user_id) && s.is_recurring);
    const weeksInMonth = eachWeekOfInterval({ start: monthStart, end: monthEnd }, { weekStartsOn: 1 }).length;
    
    const perUser: Record<string, number> = {};
    recurring.forEach(s => {
      perUser[s.user_id] = (perUser[s.user_id] || 0) + weeksInMonth;
    });
    return perUser;
  }, [sessions, packages, monthStart, monthEnd]);

  // All no-package session counts per user
  const noPackageSessionCounts = useMemo(() => {
    const counts: Record<string, number> = { ...noPackageRecurringSessions };
    noPackageMonthSessions.forEach(s => {
      counts[s.user_id] = (counts[s.user_id] || 0) + 1;
    });
    return counts;
  }, [noPackageMonthSessions, noPackageRecurringSessions]);

  // Revenue from packages sold this month
  const monthlyRevenue = useMemo(() => {
    const pkgRevenue = packages
      .filter(p => {
        const d = new Date(p.purchased_at);
        return d >= monthStart && d <= monthEnd;
      })
      .reduce((sum, p) => sum + getPackagePrice(p.total_sessions), 0);

    // Add pay-per-session revenue (€100 per session for non-free no-package clients)
    let payPerSessionRevenue = 0;
    Object.entries(noPackageSessionCounts).forEach(([userId, count]) => {
      const name = profiles.find(p => p.user_id === userId)?.full_name || '';
      if (!isFreeClient(name)) {
        payPerSessionRevenue += count * 100;
      }
    });

    return pkgRevenue + payPerSessionRevenue;
  }, [packages, noPackageSessionCounts, profiles, monthStart, monthEnd]);

  // Total sessions delivered this month
  const sessionsDelivered = useMemo(() => {
    const ledgerSessions = ledger.filter(e => {
      const d = new Date(e.created_at);
      return d >= monthStart && d <= monthEnd && e.delta > 0;
    }).length;

    const noPackageTotal = Object.values(noPackageSessionCounts).reduce((s, c) => s + c, 0);
    return ledgerSessions + noPackageTotal;
  }, [ledger, noPackageSessionCounts, monthStart, monthEnd]);

  // Earned revenue (factual)
  const earnedRevenue = useMemo(() => {
    let total = 0;
    // From ledger (package clients)
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

    // From no-package clients
    Object.entries(noPackageSessionCounts).forEach(([userId, count]) => {
      const name = profiles.find(p => p.user_id === userId)?.full_name || '';
      if (!isFreeClient(name)) {
        total += count * 100;
      }
    });

    return total;
  }, [ledger, packages, noPackageSessionCounts, profiles, monthStart, monthEnd]);

  // Expected monthly revenue
  const expectedMonthlyRevenue = useMemo(() => {
    const weeksInMonth = eachWeekOfInterval({ start: monthStart, end: monthEnd }, { weekStartsOn: 1 }).length;
    let total = 0;

    // Package clients
    const activeClients = new Set(packages.filter(p => p.is_active).map(p => p.user_id));
    activeClients.forEach(userId => {
      const recurring = sessions.filter(s => s.user_id === userId && s.is_recurring);
      const oneOff = sessions.filter(s => {
        if (s.is_recurring) return false;
        const d = new Date(s.session_date + 'T00:00:00');
        return s.user_id === userId && d >= monthStart && d <= monthEnd;
      });
      const sessionCount = recurring.length * weeksInMonth + oneOff.length;
      const userPkg = packages.find(p => p.user_id === userId && p.is_active);
      if (userPkg) {
        total += sessionCount * getPerSessionPrice(userPkg.total_sessions);
      }
    });

    // No-package clients
    Object.entries(noPackageSessionCounts).forEach(([userId, count]) => {
      const name = profiles.find(p => p.user_id === userId)?.full_name || '';
      if (!isFreeClient(name)) {
        total += count * 100;
      }
    });

    return Math.round(total);
  }, [packages, sessions, noPackageSessionCounts, profiles, monthStart, monthEnd]);

  // Active clients count (including no-package)
  const activeClientsCount = useMemo(() => {
    const pkgClients = new Set(packages.filter(p => p.is_active).map(p => p.user_id));
    Object.keys(noPackageSessionCounts).forEach(id => pkgClients.add(id));
    return pkgClients.size;
  }, [packages, noPackageSessionCounts]);

  // Client frequency stats — include no-package clients
  const clientFrequency = useMemo(() => {
    const perClient: Record<string, number> = {};

    // From ledger (package clients)
    ledger.filter(e => {
      const d = new Date(e.created_at);
      return d >= monthStart && d <= monthEnd && e.delta > 0;
    }).forEach(e => {
      perClient[e.user_id] = (perClient[e.user_id] || 0) + 1;
    });

    // From no-package clients
    Object.entries(noPackageSessionCounts).forEach(([userId, count]) => {
      perClient[userId] = (perClient[userId] || 0) + count;
    });

    const entries = Object.entries(perClient)
      .map(([userId, count]) => {
        const name = profiles.find(p => p.user_id === userId)?.full_name || '?';
        return {
          userId,
          name,
          count,
          isFree: isFreeClient(name),
          isPayPerSession: isPayPerSession(name),
        };
      })
      .sort((a, b) => b.count - a.count);

    const total = entries.reduce((s, e) => s + e.count, 0);
    const avg = entries.length > 0 ? (total / entries.length).toFixed(1) : '0';

    return { entries, avg, total };
  }, [ledger, noPackageSessionCounts, profiles, monthStart, monthEnd]);

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
                <div className="flex items-center gap-1.5 truncate mr-2">
                  <span className="truncate">{e.name}</span>
                  {e.isFree && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground shrink-0">FREE</span>
                  )}
                  {e.isPayPerSession && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/15 text-primary shrink-0">€100</span>
                  )}
                </div>
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
