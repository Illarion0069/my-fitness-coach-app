import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ArrowDownRight, ArrowUpLeft, Repeat, CalendarDays, SlidersHorizontal, Loader2 } from 'lucide-react';

type Lang = 'en' | 'ru';

interface LedgerRow {
  id: string;
  created_at: string;
  delta: number;
  reason: string;
  session_id: string | null;
  package_id: string | null;
  used_after: number;
}

interface Props {
  userId: string;
  lang: Lang;
  /** Compact mode renders a shorter list (used inside the admin accordion) */
  limit?: number;
}

const REASON_LABEL: Record<string, { en: string; ru: string }> = {
  cron_deduct: { en: 'Session held', ru: 'Тренировка проведена' },
  debt_deduct: { en: 'Session held (on credit)', ru: 'Тренировка в долг' },
  client_book: { en: 'Booked by client', ru: 'Записался клиент' },
  trainer_book: { en: 'Booked by trainer', ru: 'Запись от тренера' },
  trainer_cancel: { en: 'Cancelled by trainer', ru: 'Отмена тренером' },
  refund_cancelled: { en: 'Refund — cancelled', ru: 'Возврат — отмена' },
  refund_double_charge: { en: 'Refund — double charge', ru: 'Возврат — двойное списание' },
  refund_premature_booking_charge: { en: 'Refund — early charge', ru: 'Возврат — раннее списание' },
  correction_ended_series: { en: 'Correction — ended series', ru: 'Коррекция — серия завершена' },
  manual_adjust: { en: 'Manual adjustment', ru: 'Ручная корректировка' },
  trainer_adjustment: { en: 'Manual adjustment', ru: 'Ручная корректировка' },
};

const SessionLedgerHistory = ({ userId, lang, limit }: Props) => {
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [kinds, setKinds] = useState<Record<string, boolean>>({});
  const [totals, setTotals] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      const [{ data: ledger }, { data: sessions }, { data: pkgs }] = await Promise.all([
        supabase
          .from('session_ledger')
          .select('id, created_at, delta, reason, session_id, package_id, used_after')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(500),
        supabase.from('scheduled_sessions').select('id, is_recurring').eq('user_id', userId),
        supabase.from('client_packages').select('id, total_sessions').eq('user_id', userId),
      ]);
      if (!active) return;
      setRows((ledger as LedgerRow[]) || []);
      setKinds(Object.fromEntries(((sessions as any[]) || []).map((s) => [s.id, !!s.is_recurring])));
      setTotals(Object.fromEntries(((pkgs as any[]) || []).map((p) => [p.id, p.total_sessions])));
      setLoading(false);
    };
    load();

    const channel = supabase
      .channel(`ledger-history-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'session_ledger', filter: `user_id=eq.${userId}` },
        load,
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const visible = useMemo(() => (limit ? rows.slice(0, limit) : rows), [rows, limit]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6 text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <p className="text-xs text-muted-foreground py-3">
        {lang === 'en' ? 'No history yet' : 'История пока пуста'}
      </p>
    );
  }

  return (
    <div className="space-y-1.5">
      {visible.map((row) => {
        const isRefund = row.delta < 0;
        const isManual = row.reason.startsWith('manual') || row.reason.startsWith('trainer_adjust') || row.reason.startsWith('correction');
        const label = REASON_LABEL[row.reason]?.[lang] || row.reason;
        const date = new Date(row.created_at).toLocaleDateString(lang === 'en' ? 'en-GB' : 'ru-RU', {
          timeZone: 'Asia/Nicosia',
          day: '2-digit',
          month: 'short',
          year: '2-digit',
        });
        const recurring = row.session_id ? kinds[row.session_id] : undefined;
        const total = row.package_id ? totals[row.package_id] : undefined;
        const left = total != null ? total - row.used_after : null;

        return (
          <div key={row.id} className="flex items-center gap-2.5 rounded-lg bg-secondary/50 px-2.5 py-2">
            <div
              className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${
                isManual ? 'bg-muted text-muted-foreground' : isRefund ? 'bg-primary/15 text-primary' : 'bg-destructive/15 text-destructive'
              }`}
            >
              {isManual ? (
                <SlidersHorizontal className="w-3 h-3" />
              ) : isRefund ? (
                <ArrowUpLeft className="w-3 h-3" />
              ) : (
                <ArrowDownRight className="w-3 h-3" />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold truncate">{label}</p>
              <p className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                <span>{date}</span>
                {recurring !== undefined && (
                  <span className="flex items-center gap-0.5">
                    {recurring ? <Repeat className="w-2.5 h-2.5" /> : <CalendarDays className="w-2.5 h-2.5" />}
                    {recurring
                      ? lang === 'en' ? 'series' : 'серия'
                      : lang === 'en' ? 'one-off' : 'разовая'}
                  </span>
                )}
              </p>
            </div>

            <div className="text-right shrink-0">
              <p className={`text-[11px] font-bold ${isRefund ? 'text-primary' : 'text-destructive'}`}>
                {isRefund ? `+${-row.delta}` : `−${row.delta}`}
              </p>
              {left != null && (
                <p className="text-[9px] text-muted-foreground">
                  {lang === 'en' ? `${left} left` : `остаток ${left}`}
                </p>
              )}
            </div>
          </div>
        );
      })}
      {limit && rows.length > limit && (
        <p className="text-[10px] text-muted-foreground text-center pt-1">
          {lang === 'en' ? `+${rows.length - limit} more entries` : `ещё ${rows.length - limit} записей`}
        </p>
      )}
    </div>
  );
};

export default SessionLedgerHistory;
