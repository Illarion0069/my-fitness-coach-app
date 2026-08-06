import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X, Send, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const ChatAssistant = () => {
  const { lang } = useLanguage();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, open]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content: text }];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('chat-assistant', {
        body: { messages: nextMessages },
      });
      if (error || data?.error) {
        setMessages([
          ...nextMessages,
          {
            role: 'assistant',
            content:
              lang === 'en'
                ? 'Something went wrong. Please try again or message us on WhatsApp/Telegram.'
                : 'Что-то пошло не так. Попробуйте ещё раз или напишите нам в WhatsApp/Telegram.',
          },
        ]);
      } else {
        setMessages([...nextMessages, { role: 'assistant', content: data.reply }]);
      }
    } catch {
      setMessages([
        ...nextMessages,
        { role: 'assistant', content: lang === 'en' ? 'Something went wrong.' : 'Что-то пошло не так.' },
      ]);
    }
    setLoading(false);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed z-[95] w-12 h-12 rounded-full gradient-primary text-primary-foreground shadow-xl flex items-center justify-center glow-primary active:scale-95 transition-transform"
        style={{ right: '16px', bottom: 'calc(env(safe-area-inset-bottom, 0px) + 84px)' }}
        aria-label="Chat"
      >
        <MessageCircle className="w-6 h-6" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[220] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center"
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card w-full max-w-md rounded-t-3xl sm:rounded-3xl h-[80vh] sm:h-[70vh] overflow-hidden border border-border/50 shadow-2xl flex flex-col"
            >
              <div className="sticky top-0 bg-card/95 backdrop-blur-md z-10 px-5 pt-5 pb-3 border-b border-border/30 flex items-center justify-between">
                <h2 className="text-lg font-bold">
                  {lang === 'en' ? 'Ask Limassol Fitness' : 'Спросить Limassol Fitness'}
                </h2>
                <button
                  onClick={() => setOpen(false)}
                  className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-secondary transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                {messages.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center mt-8">
                    {lang === 'en'
                      ? 'Ask about pricing, availability, or book a session right here 👋'
                      : 'Спросите про цены, свободное время или запишитесь прямо здесь 👋'}
                  </p>
                )}
                {messages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                        m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground'
                      }`}
                    >
                      {m.content}
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex justify-start">
                    <div className="bg-secondary rounded-2xl px-4 py-2.5">
                      <Loader2 className="w-4 h-4 animate-spin" />
                    </div>
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-border/30 flex items-center gap-2">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && send()}
                  placeholder={lang === 'en' ? 'Type a message...' : 'Напишите сообщение...'}
                  className="flex-1 h-11 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <button
                  onClick={send}
                  disabled={loading || !input.trim()}
                  className="w-11 h-11 rounded-xl gradient-primary text-primary-foreground flex items-center justify-center disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default ChatAssistant;
