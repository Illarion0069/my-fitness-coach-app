import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { MessageCircle, X, Send, ChevronLeft, Search, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import HintDot from '@/components/HintDot';
import { toast } from 'sonner';

type Msg = {
  id: string;
  client_user_id: string;
  trainer_user_id: string;
  sender_user_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
};

const fmtTime = (iso: string, lang: string) =>
  new Date(iso).toLocaleString(lang === 'en' ? 'en-GB' : 'ru-RU', {
    timeZone: 'Asia/Nicosia', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });

/* ───────────── Conversation thread ───────────── */
const Thread = ({ clientUserId, meId, lang }: { clientUserId: string; meId: string; lang: string }) => {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const isTrainerSide = meId !== clientUserId;

  const markRead = useCallback(() => {
    supabase.rpc('mark_direct_messages_read', { _client_user_id: clientUserId }).then(({ error }) => {
      if (error) console.error('mark read failed', error);
    });
  }, [clientUserId]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data, error } = await supabase
        .from('direct_messages').select('*').eq('client_user_id', clientUserId)
        .order('created_at', { ascending: true }).limit(500);
      if (!alive) return;
      if (error) console.error(error);
      setMsgs((data as Msg[]) || []);
      setLoading(false);
      markRead();
    })();
    const ch = supabase
      .channel(`dm-thread-${clientUserId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages', filter: `client_user_id=eq.${clientUserId}` },
        (p) => {
          const m = p.new as Msg;
          setMsgs((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
          if (m.sender_user_id !== meId) markRead();
        })
      .subscribe();
    inputRef.current?.focus();
    return () => { alive = false; supabase.removeChannel(ch); };
  }, [clientUserId, meId, markRead]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs.length]);

  const send = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    const { data, error } = await supabase.functions.invoke('direct-message', {
      body: isTrainerSide ? { body, client_user_id: clientUserId } : { body },
    });
    setSending(false);
    if (error || !data?.message) {
      toast.error(lang === 'en' ? 'Message not sent. Try again.' : 'Сообщение не отправлено. Попробуйте ещё раз.');
      return;
    }
    const m = data.message as Msg;
    setMsgs((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
    setText('');
    inputRef.current?.focus();
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2" onTouchMove={(e) => e.stopPropagation()}>
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : msgs.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-10">
            {isTrainerSide
              ? (lang === 'en' ? 'No messages yet. Write first!' : 'Сообщений пока нет. Напишите первым!')
              : (lang === 'en' ? 'Ask Illarion anything — he will reply here.' : 'Задайте Иллариону любой вопрос — он ответит здесь.')}
          </p>
        ) : msgs.map((m) => {
          const mine = m.sender_user_id === meId;
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 ${mine ? 'bg-primary text-primary-foreground rounded-br-md' : 'bg-muted text-foreground rounded-bl-md'}`}>
                <p className="text-sm whitespace-pre-wrap break-words">{m.body}</p>
                <p className={`text-[10px] mt-0.5 ${mine ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                  {fmtTime(m.created_at, lang)}{mine && m.read_at ? ' · ✓✓' : ''}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      <div className="border-t border-border/50 p-3 flex items-end gap-2" style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 12px)' }}>
        <textarea
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 2000))}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          rows={1}
          placeholder={lang === 'en' ? 'Message…' : 'Сообщение…'}
          className="flex-1 resize-none max-h-32 rounded-2xl bg-muted px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/40"
        />
        <button
          onClick={send}
          disabled={!text.trim() || sending}
          aria-label={lang === 'en' ? 'Send' : 'Отправить'}
          className="w-10 h-10 shrink-0 rounded-full bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40"
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
};

/* ───────────── Trainer inbox ───────────── */
type Convo = { clientId: string; name: string; last?: Msg; unread: number };

const Inbox = ({ meId, lang, onOpen }: { meId: string; lang: string; onOpen: (id: string, name: string) => void }) => {
  const [convos, setConvos] = useState<Convo[]>([]);
  const [clients, setClients] = useState<{ user_id: string; full_name: string }[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [{ data: msgs }, { data: profs }, { data: trainers }] = await Promise.all([
      supabase.from('direct_messages').select('*').eq('trainer_user_id', meId).order('created_at', { ascending: false }).limit(1000),
      supabase.from('profiles').select('user_id, full_name, archived_at').is('archived_at', null).order('full_name'),
      supabase.from('user_roles').select('user_id').eq('role', 'trainer'),
    ]);
    const trainerIds = new Set((trainers || []).map((t) => t.user_id));
    const list = (profs || []).filter((p) => !trainerIds.has(p.user_id) && p.user_id !== meId);
    const names = new Map(list.map((p) => [p.user_id, p.full_name]));
    const map = new Map<string, Convo>();
    for (const m of (msgs as Msg[]) || []) {
      let c = map.get(m.client_user_id);
      if (!c) { c = { clientId: m.client_user_id, name: names.get(m.client_user_id) || '—', last: m, unread: 0 }; map.set(m.client_user_id, c); }
      if (!m.read_at && m.sender_user_id !== meId) c.unread++;
    }
    setConvos(Array.from(map.values()));
    setClients(list);
    setLoading(false);
  }, [meId]);

  useEffect(() => {
    load();
    const ch = supabase.channel('dm-inbox')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'direct_messages', filter: `trainer_user_id=eq.${meId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load, meId]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return null;
    return clients.filter((c) => c.full_name?.toLowerCase().includes(s)).slice(0, 30);
  }, [q, clients]);

  return (
    <div className="flex-1 overflow-y-auto" onTouchMove={(e) => e.stopPropagation()}>
      <div className="p-3 sticky top-0 bg-background z-10">
        <div className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2">
          <Search className="w-4 h-4 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={lang === 'en' ? 'Find a client to message' : 'Найти клиента, чтобы написать'}
            className="flex-1 bg-transparent text-sm outline-none text-foreground placeholder:text-muted-foreground" />
        </div>
      </div>
      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : filtered ? (
        filtered.length === 0
          ? <p className="text-center text-sm text-muted-foreground py-8">{lang === 'en' ? 'Nobody found' : 'Никого не нашли'}</p>
          : filtered.map((c) => (
            <button key={c.user_id} onClick={() => onOpen(c.user_id, c.full_name)} className="w-full text-left px-4 py-3 hover:bg-muted/40 border-b border-border/30 text-sm text-foreground">
              {c.full_name}
            </button>
          ))
      ) : convos.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-10 px-6">
          {lang === 'en' ? 'No conversations yet. Search a client above to write first.' : 'Переписок пока нет. Найдите клиента в поиске и напишите первым.'}
        </p>
      ) : convos.map((c) => (
        <button key={c.clientId} onClick={() => onOpen(c.clientId, c.name)} className="w-full text-left px-4 py-3 hover:bg-muted/40 border-b border-border/30 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/15 text-primary flex items-center justify-center text-sm font-semibold shrink-0">
            {c.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex justify-between gap-2">
              <span className={`text-sm truncate ${c.unread ? 'font-semibold text-foreground' : 'text-foreground'}`}>{c.name}</span>
              {c.last && <span className="text-[10px] text-muted-foreground shrink-0">{fmtTime(c.last.created_at, lang)}</span>}
            </div>
            <p className="text-xs text-muted-foreground truncate">{c.last?.sender_user_id === meId ? (lang === 'en' ? 'You: ' : 'Вы: ') : ''}{c.last?.body}</p>
          </div>
          {c.unread > 0 && <span className="min-w-5 h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[11px] font-bold flex items-center justify-center">{c.unread}</span>}
        </button>
      ))}
    </div>
  );
};

/* ───────────── Launcher (floating button + panel) ───────────── */
const DirectChat = ({ asTrainer }: { asTrainer: boolean }) => {
  const { user } = useAuth();
  const { lang } = useLanguage();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [active, setActive] = useState<{ id: string; name: string } | null>(null);
  const meId = user?.id;

  const refreshUnread = useCallback(async () => {
    if (!meId) return;
    const col = asTrainer ? 'trainer_user_id' : 'client_user_id';
    const { count } = await supabase.from('direct_messages').select('id', { count: 'exact', head: true })
      .eq(col, meId).is('read_at', null).neq('sender_user_id', meId);
    setUnread(count ?? 0);
  }, [meId, asTrainer]);

  useEffect(() => {
    if (!meId) return;
    refreshUnread();
    const col = asTrainer ? 'trainer_user_id' : 'client_user_id';
    const ch = supabase.channel(`dm-badge-${meId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'direct_messages', filter: `${col}=eq.${meId}` }, () => refreshUnread())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [meId, asTrainer, refreshUnread]);

  if (!meId) return null;

  const title = asTrainer
    ? (active ? active.name : (lang === 'en' ? 'Messages' : 'Сообщения'))
    : (lang === 'en' ? 'Chat with Illarion' : 'Чат с Илларионом');

  const close = () => { setOpen(false); setActive(null); refreshUnread(); };

  return (
    <>
      <div className="fixed right-4 z-[80]" style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 80px)' }}>
        <button
          onClick={() => setOpen(true)}
          aria-label={title}
          className="relative w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center active:scale-95 transition-transform"
        >
          <MessageCircle className="w-5 h-5" />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-foreground text-background text-[11px] font-bold flex items-center justify-center">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </button>
        <HintDot
          id={asTrainer ? 'direct_chat_trainer' : 'direct_chat_client'}
          en={asTrainer ? 'New: reply to clients right here' : 'New: message Illarion directly'}
          ru={asTrainer ? 'Новое: отвечайте клиентам прямо здесь' : 'Новое: пишите Иллариону напрямую'}
          className="absolute -top-1 -left-1"
          side="left"
        />
      </div>

      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              className="fixed inset-0 z-[200] bg-background flex flex-col"
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'tween', duration: 0.25 }}
            >
              <div className="flex items-center gap-2 px-3 border-b border-border/50 h-14 shrink-0" style={{ marginTop: 'env(safe-area-inset-top, 0px)' }}>
                {asTrainer && active ? (
                  <button onClick={() => setActive(null)} aria-label="Back" className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-muted">
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                ) : <div className="w-2" />}
                <h2 className="flex-1 font-display text-xl tracking-wide text-foreground truncate">{title}</h2>
                <button onClick={close} aria-label="Close" className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-muted">
                  <X className="w-5 h-5" />
                </button>
              </div>
              {asTrainer
                ? (active
                  ? <Thread key={active.id} clientUserId={active.id} meId={meId} lang={lang} />
                  : <Inbox meId={meId} lang={lang} onOpen={(id, name) => setActive({ id, name })} />)
                : <Thread clientUserId={meId} meId={meId} lang={lang} />}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
};

export default DirectChat;
