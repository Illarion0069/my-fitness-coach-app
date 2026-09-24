import { useCallback, useEffect, useState } from 'react';
import { MessageCircle, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';

type Req = { id: string; name: string; unread: number; last: string };

/** Admin-panel block: open chats from new visitors with unread counts. Tap opens the conversation. */
const GuestChatRequests = () => {
  const { user } = useAuth();
  const { lang } = useLanguage();
  const [reqs, setReqs] = useState<Req[]>([]);
  const meId = user?.id;

  const load = useCallback(async () => {
    if (!meId) return;
    const { data: guests } = await supabase.from('guest_chats').select('id, guest_name').eq('trainer_user_id', meId).is('closed_at', null);
    const ids = (guests || []).map((g) => g.id);
    if (!ids.length) { setReqs([]); return; }
    const { data: msgs } = await supabase.from('direct_messages').select('client_user_id, sender_user_id, read_at, body, attachment_name, created_at')
      .in('client_user_id', ids).order('created_at', { ascending: false }).limit(500);
    const out: Req[] = [];
    for (const g of guests || []) {
      const mine = (msgs || []).filter((m) => m.client_user_id === g.id);
      if (!mine.length) continue;
      const unread = mine.filter((m) => !m.read_at && m.sender_user_id !== meId).length;
      out.push({ id: g.id, name: g.guest_name, unread, last: mine[0].body || (mine[0].attachment_name ? '📎 ' + mine[0].attachment_name : '') });
    }
    out.sort((a, b) => b.unread - a.unread);
    setReqs(out);
  }, [meId]);

  useEffect(() => {
    load();
    if (!meId) return;
    const ch = supabase.channel(`guest-req-${meId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'direct_messages', filter: `trainer_user_id=eq.${meId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load, meId]);

  if (!reqs.length) return null;
  const open = (r: Req) => window.dispatchEvent(new CustomEvent('open-direct-chat', { detail: { id: r.id } }));

  return (
    <div className="mb-5 rounded-2xl border border-primary/40 bg-primary/5 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-primary/20">
        <MessageCircle className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold text-foreground">
          {lang === 'en' ? 'Chat requests from new visitors' : 'Запросы в чат от новых посетителей'}
        </span>
      </div>
      {reqs.map((r) => (
        <button key={r.id} onClick={() => open(r)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-primary/10 border-b border-border/30 last:border-0">
          <div className="flex-1 min-w-0">
            <div className={`text-sm text-foreground truncate ${r.unread ? 'font-semibold' : ''}`}>{r.name}</div>
            <div className="text-xs text-muted-foreground truncate">{r.last}</div>
          </div>
          {r.unread > 0 && <span className="min-w-5 h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[11px] font-bold flex items-center justify-center">{r.unread}</span>}
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </button>
      ))}
    </div>
  );
};

export default GuestChatRequests;
