import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { MessageCircle, X, Send, ChevronLeft, Loader2, Paperclip, FileText, Lock } from 'lucide-react';
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
  attachment_path?: string | null;
  attachment_name?: string | null;
  attachment_type?: string | null;
  attachment_url?: string | null;
  is_system?: boolean;
};

const MAX_FILE = 10 * 1024 * 1024;
const T = (lang: string, en: string, ru: string) => (lang === 'en' ? en : ru);

const fmtTime = (iso: string, lang: string) =>
  new Date(iso).toLocaleString(lang === 'en' ? 'en-GB' : 'ru-RU', {
    timeZone: 'Asia/Nicosia', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });

const toB64 = (f: File) => new Promise<string>((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(String(r.result).split(',')[1] || '');
  r.onerror = rej;
  r.readAsDataURL(f);
});

const errText = async (error: unknown) => {
  const ctx = (error as { context?: Response }).context;
  try { return ctx ? await ctx.clone().json() : null; } catch { return null; }
};

/* ───────────── Message list + composer (shared) ───────────── */
const Bubbles = ({ msgs, me, lang, empty }: { msgs: Msg[]; me: string; lang: string; empty: string }) => {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs.length]);
  return (
    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2" onTouchMove={(e) => e.stopPropagation()}>
      {msgs.length === 0 && <p className="text-center text-sm text-muted-foreground py-10">{empty}</p>}
      {msgs.map((m) => {
        if (m.is_system) {
          const [ru, en] = m.body.split(' · ');
          return (
            <div key={m.id} className="flex justify-center py-2">
              <span className="text-xs text-muted-foreground bg-muted rounded-full px-3 py-1.5 flex items-center gap-1.5">
                <Lock className="w-3 h-3" />{lang === 'en' ? (en || ru) : ru}
              </span>
            </div>
          );
        }
        const mine = m.sender_user_id === me;
        const isImg = m.attachment_type?.startsWith('image/');
        return (
          <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 ${mine ? 'bg-primary text-primary-foreground rounded-br-md' : 'bg-muted text-foreground rounded-bl-md'}`}>
              {m.attachment_path && (
                m.attachment_url ? (
                  isImg ? (
                    <a href={m.attachment_url} target="_blank" rel="noreferrer">
                      <img src={m.attachment_url} alt={m.attachment_name || ''} className="rounded-xl max-h-64 mb-1 object-contain" />
                    </a>
                  ) : (
                    <a href={m.attachment_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm underline underline-offset-2 mb-1 break-all">
                      <FileText className="w-4 h-4 shrink-0" />{m.attachment_name || T(lang, 'File', 'Файл')}
                    </a>
                  )
                ) : <Loader2 className="w-4 h-4 animate-spin mb-1" />
              )}
              {m.body && <p className="text-sm whitespace-pre-wrap break-words">{m.body}</p>}
              <p className={`text-[10px] mt-0.5 ${mine ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                {fmtTime(m.created_at, lang)}{mine && m.read_at ? ' · ✓✓' : ''}
              </p>
            </div>
          </div>
        );
      })}
      <div ref={endRef} />
    </div>
  );
};

const Composer = ({ lang, onSend, disabled }: { lang: string; onSend: (text: string, file: File | null) => Promise<boolean>; disabled?: boolean }) => {
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const pick = (f: File | undefined) => {
    if (!f) return;
    if (f.size > MAX_FILE) { toast.error(T(lang, 'File is larger than 10 MB', 'Файл больше 10 МБ')); return; }
    setFile(f);
  };

  const send = async () => {
    const body = text.trim();
    if ((!body && !file) || busy) return;
    setBusy(true);
    const ok = await onSend(body, file);
    setBusy(false);
    if (ok) { setText(''); setFile(null); inputRef.current?.focus(); }
  };

  return (
    <div className="border-t border-border/50 p-3" style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 12px)' }}>
      {file && (
        <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground bg-muted rounded-xl px-3 py-2">
          <Paperclip className="w-3.5 h-3.5" /><span className="flex-1 truncate">{file.name}</span>
          <button onClick={() => setFile(null)} aria-label="Remove"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}
      <div className="flex items-end gap-2">
        <input ref={fileRef} type="file" className="hidden" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
        <button onClick={() => fileRef.current?.click()} disabled={disabled || busy} aria-label={T(lang, 'Attach file', 'Прикрепить файл')}
          className="w-10 h-10 shrink-0 rounded-full bg-muted text-muted-foreground flex items-center justify-center disabled:opacity-40">
          <Paperclip className="w-4 h-4" />
        </button>
        <textarea
          ref={inputRef} value={text} rows={1} disabled={disabled}
          onChange={(e) => setText(e.target.value.slice(0, 2000))}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          onPaste={(e) => { const f = Array.from(e.clipboardData.files)[0]; if (f) { e.preventDefault(); pick(f); } }}
          placeholder={T(lang, 'Message…', 'Сообщение…')}
          className="flex-1 resize-none max-h-32 rounded-2xl bg-muted px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/40"
        />
        <button onClick={send} disabled={disabled || (!text.trim() && !file) || busy} aria-label={T(lang, 'Send', 'Отправить')}
          className="w-10 h-10 shrink-0 rounded-full bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
};

/* ───────────── Trainer: one guest conversation ───────────── */
const TrainerThread = ({ chatId, meId, lang, closed, onClosed }: { chatId: string; meId: string; lang: string; closed: boolean; onClosed: () => void }) => {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);

  const sign = useCallback(async (list: Msg[]) => Promise.all(list.map(async (m) => {
    if (!m.attachment_path || m.attachment_url) return m;
    const { data } = await supabase.storage.from('chat-files').createSignedUrl(m.attachment_path, 3600);
    return { ...m, attachment_url: data?.signedUrl ?? null };
  })), []);

  useEffect(() => {
    let alive = true;
    const markRead = () => supabase.rpc('mark_direct_messages_read', { _client_user_id: chatId });
    (async () => {
      const { data } = await supabase.from('direct_messages').select('*').eq('client_user_id', chatId)
        .order('created_at', { ascending: true }).limit(500);
      const signed = await sign((data as Msg[]) || []);
      if (!alive) return;
      setMsgs(signed); setLoading(false); markRead();
    })();
    const ch = supabase.channel(`dm-thread-${chatId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages', filter: `client_user_id=eq.${chatId}` },
        async (p) => {
          const [m] = await sign([p.new as Msg]);
          setMsgs((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
          if (m.sender_user_id !== meId) markRead();
        })
      .subscribe();
    return () => { alive = false; supabase.removeChannel(ch); };
  }, [chatId, meId, sign]);

  const send = async (body: string, file: File | null) => {
    const payload: Record<string, unknown> = { client_user_id: chatId, body };
    if (file) payload.file = { data: await toB64(file), name: file.name, type: file.type };
    const { data, error } = await supabase.functions.invoke('direct-message', { body: payload });
    if (error || !data?.message) { toast.error(T(lang, 'Message not sent. Try again.', 'Сообщение не отправлено. Попробуйте ещё раз.')); return false; }
    const m = data.message as Msg;
    setMsgs((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
    return true;
  };

  const closeChat = async () => {
    if (!confirm(T(lang, 'Close this chat? The visitor will be notified.', 'Закрыть чат? Посетитель получит уведомление, что диалог завершён.'))) return;
    setClosing(true);
    const { error } = await supabase.functions.invoke('direct-message', { body: { action: 'close', client_user_id: chatId } });
    setClosing(false);
    if (error) { toast.error(T(lang, 'Could not close chat', 'Не удалось закрыть чат')); return; }
    onClosed();
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {loading
        ? <div className="flex-1 flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        : <Bubbles msgs={msgs} me={meId} lang={lang} empty={T(lang, 'No messages yet', 'Сообщений пока нет')} />}
      {closed ? (
        <p className="text-center text-xs text-muted-foreground py-4 border-t border-border/50">{T(lang, 'Chat closed', 'Чат закрыт')}</p>
      ) : (
        <>
          <Composer lang={lang} onSend={send} />
          <div className="px-3 pb-3 -mt-1" style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 12px)' }}>
            <button onClick={closeChat} disabled={closing}
              className="w-full rounded-2xl border border-destructive/40 text-destructive py-2.5 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
              {closing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
              {T(lang, 'Close chat', 'Закрыть чат')}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

/* ───────────── Trainer inbox (new visitors only) ───────────── */
type Convo = { id: string; name: string; closed: boolean; last?: Msg; unread: number };

const Inbox = ({ meId, lang, onOpen }: { meId: string; lang: string; onOpen: (c: Convo) => void }) => {
  const [convos, setConvos] = useState<Convo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showClosed, setShowClosed] = useState(false);

  const load = useCallback(async () => {
    const [{ data: msgs }, { data: guests }] = await Promise.all([
      supabase.from('direct_messages').select('*').eq('trainer_user_id', meId).eq('is_guest', true)
        .order('created_at', { ascending: false }).limit(1000),
      supabase.from('guest_chats').select('id, guest_name, closed_at').eq('trainer_user_id', meId),
    ]);
    const map = new Map<string, Convo>();
    for (const g of (guests as { id: string; guest_name: string; closed_at: string | null }[]) || [])
      map.set(g.id, { id: g.id, name: g.guest_name, closed: !!g.closed_at, unread: 0 });
    for (const m of (msgs as Msg[]) || []) {
      const c = map.get(m.client_user_id);
      if (!c) continue;
      if (!c.last) c.last = m;
      if (!m.read_at && m.sender_user_id !== meId) c.unread++;
    }
    setConvos(Array.from(map.values()).filter((c) => c.last)
      .sort((a, b) => (b.last!.created_at > a.last!.created_at ? 1 : -1)));
    setLoading(false);
  }, [meId]);

  useEffect(() => {
    load();
    const ch = supabase.channel('dm-inbox')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'direct_messages', filter: `trainer_user_id=eq.${meId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load, meId]);

  const list = convos.filter((c) => c.closed === showClosed);

  return (
    <div className="flex-1 overflow-y-auto" onTouchMove={(e) => e.stopPropagation()}>
      <div className="flex gap-2 p-3">
        {[false, true].map((v) => (
          <button key={String(v)} onClick={() => setShowClosed(v)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold ${showClosed === v ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
            {v ? T(lang, 'Closed', 'Закрытые') : T(lang, 'Active', 'Активные')}
          </button>
        ))}
      </div>
      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : list.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-10 px-6">
          {showClosed ? T(lang, 'No closed chats', 'Закрытых чатов нет')
            : T(lang, 'No active chats. New visitors who write to you will appear here.', 'Активных чатов нет. Здесь появятся новые посетители, которые вам напишут.')}
        </p>
      ) : list.map((c) => (
        <button key={c.id} onClick={() => onOpen(c)} className="w-full text-left px-4 py-3 hover:bg-muted/40 border-b border-border/30 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/15 text-primary flex items-center justify-center text-sm font-semibold shrink-0">
            {c.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex justify-between gap-2">
              <span className={`text-sm truncate text-foreground ${c.unread ? 'font-semibold' : ''}`}>{c.name}</span>
              {c.last && <span className="text-[10px] text-muted-foreground shrink-0">{fmtTime(c.last.created_at, lang)}</span>}
            </div>
            <p className="text-xs text-muted-foreground truncate">
              {c.last?.sender_user_id === meId && !c.last?.is_system ? T(lang, 'You: ', 'Вы: ') : ''}
              {c.last?.body || (c.last?.attachment_path ? '📎 ' + (c.last.attachment_name || '') : '')}
            </p>
          </div>
          {c.unread > 0 && <span className="min-w-5 h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[11px] font-bold flex items-center justify-center">{c.unread}</span>}
        </button>
      ))}
    </div>
  );
};

/* ───────────── Guest (new visitor without account) ───────────── */
const GUEST_KEY = 'guest_chat_token';
const GuestThread = ({ lang }: { lang: string }) => {
  const [token, setToken] = useState<string | null>(() => { try { return localStorage.getItem(GUEST_KEY); } catch { return null; } });
  const [name, setName] = useState('');
  const [me, setMe] = useState('');
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [closed, setClosed] = useState(false);
  const [busy, setBusy] = useState(false);

  const forget = () => { try { localStorage.removeItem(GUEST_KEY); } catch { /* ignore */ } };

  const load = useCallback(async (tk: string) => {
    const { data, error } = await supabase.functions.invoke('direct-message', { body: { action: 'guest_list', token: tk } });
    if (error) {
      const status = (error as { context?: { status?: number } }).context?.status;
      if (status === 401) { forget(); setToken(null); }
      return;
    }
    setMe(data.me);
    setMsgs((prev) => (prev.length === data.messages.length ? prev : data.messages));
    if (data.closed) { setClosed(true); forget(); }
  }, []);

  useEffect(() => {
    if (!token || closed) return;
    load(token);
    const t = setInterval(() => { if (document.visibilityState === 'visible') load(token); }, 5000);
    return () => clearInterval(t);
  }, [token, load, closed]);

  const start = async () => {
    const n = name.trim();
    if (!n || busy) return;
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('direct-message', { body: { action: 'guest_start', name: n } });
    setBusy(false);
    if (error || !data?.token) { toast.error(T(lang, 'Could not start chat', 'Не удалось начать чат')); return; }
    try { localStorage.setItem(GUEST_KEY, data.token); } catch { /* ignore */ }
    setMe(data.chat_id); setMsgs([]); setClosed(false); setToken(data.token);
  };

  const send = async (body: string, file: File | null) => {
    if (!token) return false;
    const payload: Record<string, unknown> = { action: 'guest_send', token, body };
    if (file) payload.file = { data: await toB64(file), name: file.name, type: file.type };
    const { data, error } = await supabase.functions.invoke('direct-message', { body: payload });
    if (error || !data?.message) {
      const j = await errText(error);
      if (j?.closed) { load(token); return false; }
      toast.error(T(lang, 'Message not sent. Try again.', 'Сообщение не отправлено. Попробуйте ещё раз.'));
      return false;
    }
    setMsgs((p) => [...p, data.message as Msg]);
    return true;
  };

  if (!token) {
    return (
      <div className="flex-1 flex flex-col justify-center px-6 gap-4">
        <p className="text-sm text-muted-foreground text-center">
          {T(lang, 'Write to Illarion directly — he usually replies quickly. How should he call you?', 'Напишите Иллариону напрямую — он обычно отвечает быстро. Как к вам обращаться?')}
        </p>
        <input autoFocus value={name} onChange={(e) => setName(e.target.value.slice(0, 80))}
          onKeyDown={(e) => { if (e.key === 'Enter') start(); }}
          placeholder={T(lang, 'Your name', 'Ваше имя')}
          className="rounded-2xl bg-muted px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/40" />
        <button onClick={start} disabled={!name.trim() || busy}
          className="rounded-2xl bg-primary text-primary-foreground py-3 text-sm font-semibold disabled:opacity-40">
          {busy ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : T(lang, 'Start chat', 'Начать чат')}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <Bubbles msgs={msgs} me={me} lang={lang} empty={T(lang, 'Ask anything about training, prices or schedule.', 'Спросите что угодно о тренировках, ценах или расписании.')} />
      {closed ? (
        <div className="border-t border-border/50 p-4 text-center space-y-3" style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 16px)' }}>
          <p className="text-sm text-muted-foreground">{T(lang, 'Illarion has closed this chat.', 'Илларион завершил этот диалог.')}</p>
          <button onClick={() => { setToken(null); setClosed(false); setMsgs([]); }}
            className="rounded-2xl bg-primary text-primary-foreground px-5 py-2.5 text-sm font-semibold">
            {T(lang, 'Start a new chat', 'Начать новый чат')}
          </button>
        </div>
      ) : <Composer lang={lang} onSend={send} />}
    </div>
  );
};

/* ───────────── Launcher (floating button + panel) ───────────── */
const DirectChat = ({ asTrainer }: { asTrainer: boolean }) => {
  const { user } = useAuth();
  const { lang } = useLanguage();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [active, setActive] = useState<{ id: string; name: string; closed: boolean } | null>(null);
  const meId = user?.id;

  const refreshUnread = useCallback(async () => {
    if (!meId || !asTrainer) return;
    const { count } = await supabase.from('direct_messages').select('id', { count: 'exact', head: true })
      .eq('trainer_user_id', meId).eq('is_guest', true).is('read_at', null).neq('sender_user_id', meId);
    setUnread(count ?? 0);
  }, [meId, asTrainer]);

  useEffect(() => {
    if (!meId || !asTrainer) return;
    refreshUnread();
    const ch = supabase.channel(`dm-badge-${meId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'direct_messages', filter: `trainer_user_id=eq.${meId}` }, () => refreshUnread())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [meId, asTrainer, refreshUnread]);

  // Deep link from Telegram: /?chat=<guest chat id> opens that conversation directly
  useEffect(() => {
    if (!asTrainer || !meId) return;
    const params = new URLSearchParams(window.location.search);
    const id = params.get('chat');
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return;
    (async () => {
      const { data } = await supabase.from('guest_chats').select('id, guest_name, closed_at').eq('id', id).maybeSingle();
      if (!data) return;
      setActive({ id: data.id, name: data.guest_name, closed: !!data.closed_at });
      setOpen(true);
      params.delete('chat');
      const qs = params.toString();
      window.history.replaceState(null, '', window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash);
    })();
  }, [asTrainer, meId]);

  const title = asTrainer
    ? (active ? active.name : T(lang, 'New visitors', 'Новые посетители'))
    : T(lang, 'Chat with Illarion', 'Чат с Илларионом');

  const close = () => { setOpen(false); setActive(null); refreshUnread(); };

  return (
    <>
      <div className="fixed right-4 z-[80]" style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 80px)' }}>
        <button onClick={() => setOpen(true)} aria-label={title}
          className="relative w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center active:scale-95 transition-transform">
          <MessageCircle className="w-5 h-5" />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-foreground text-background text-[11px] font-bold flex items-center justify-center">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </button>
        <HintDot
          id={asTrainer ? 'direct_chat_trainer_v2' : 'direct_chat_client'}
          en={asTrainer ? 'New: chats with new visitors, files and a Close button' : 'New: message Illarion directly'}
          ru={asTrainer ? 'Новое: чаты с новыми посетителями, файлы и кнопка «Закрыть чат»' : 'Новое: пишите Иллариону напрямую'}
          className="absolute -top-1 -left-1"
          side="left"
        />
      </div>

      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div className="fixed inset-0 z-[200] bg-background flex flex-col"
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'tween', duration: 0.25 }}>
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
                  ? <TrainerThread key={active.id} chatId={active.id} meId={meId!} lang={lang} closed={active.closed}
                      onClosed={() => setActive({ ...active, closed: true })} />
                  : <Inbox meId={meId!} lang={lang} onOpen={(c) => setActive({ id: c.id, name: c.name, closed: c.closed })} />)
                : <GuestThread lang={lang} />}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
};

export default DirectChat;
