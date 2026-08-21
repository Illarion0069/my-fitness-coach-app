import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Square, Loader2, Keyboard, Check, Trash2, X, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface VoiceFoodItem {
  name: string;
  portion_g: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

interface Props {
  open: boolean;
  lang: string;
  /** Shown above the recorder, e.g. "Tell us what's on the photo" */
  title?: string;
  onClose: () => void;
  onConfirm: (items: VoiceFoodItem[]) => void | Promise<void>;
}

const MAX_SECONDS = 60;

const t = (lang: string, en: string, ru: string) => (lang === 'en' ? en : ru);

const pickMime = (): { mime: string; format: string } => {
  const candidates: { mime: string; format: string }[] = [
    { mime: 'audio/webm;codecs=opus', format: 'webm' },
    { mime: 'audio/webm', format: 'webm' },
    { mime: 'audio/mp4', format: 'm4a' },
    { mime: 'audio/aac', format: 'aac' },
  ];
  for (const c of candidates) {
    try {
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(c.mime)) return c;
    } catch { /* ignore */ }
  }
  return { mime: '', format: 'webm' };
};

const blobToBase64 = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

export default function VoiceFoodInput({ open, lang, title, onClose, onConfirm }: Props) {
  const { toast } = useToast();
  const [mode, setMode] = useState<'voice' | 'text'>('voice');
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [text, setText] = useState('');
  const [transcript, setTranscript] = useState('');
  const [items, setItems] = useState<VoiceFoodItem[] | null>(null);
  const [levels, setLevels] = useState<number[]>(Array(16).fill(0.15));

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rafRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const formatRef = useRef('webm');

  const cleanup = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    try { audioCtxRef.current?.close(); } catch { /* ignore */ }
    audioCtxRef.current = null;
    streamRef.current?.getTracks().forEach(tr => tr.stop());
    streamRef.current = null;
    recorderRef.current = null;
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  useEffect(() => {
    if (open) return;
    cleanup();
    setRecording(false); setSeconds(0); setProcessing(false); setSaving(false);
    setText(''); setTranscript(''); setItems(null); setMode('voice');
  }, [open, cleanup]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const analyse = useCallback(async (payload: { audio_base64?: string; format?: string; text?: string }) => {
    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('transcribe-food', {
        body: { ...payload, lang },
      });
      if (error) throw error;
      if (data?.error && !Array.isArray(data?.items)) throw new Error(data.error);
      const list: VoiceFoodItem[] = Array.isArray(data?.items) ? data.items : [];
      setTranscript(String(data?.transcript || payload.text || ''));
      setItems(list);
      if (list.length === 0) {
        toast({
          title: t(lang, 'No food recognised', 'Еда не распознана'),
          description: t(lang, 'Try again and name the dishes and amounts.', 'Попробуйте ещё раз и назовите блюда и количество.'),
          variant: 'destructive',
        });
      }
    } catch (e: any) {
      console.error('transcribe-food failed', e);
      toast({
        title: t(lang, 'Could not process', 'Не удалось обработать'),
        description: t(lang, 'Please try again.', 'Попробуйте ещё раз.'),
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  }, [lang, toast]);

  const stopRecording = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
    setRecording(false);
  }, []);

  const startRecording = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setMode('text');
      toast({ title: t(lang, 'Voice input is not available on this device', 'Голосовой ввод недоступен на этом устройстве') });
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const { mime, format } = pickMime();
      formatRef.current = format;
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = ev => { if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data); };
      rec.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: mime || 'audio/webm' });
        cleanup();
        setSeconds(0);
        if (blob.size < 1200) {
          toast({ title: t(lang, 'Recording too short', 'Слишком короткая запись'), variant: 'destructive' });
          return;
        }
        const b64 = await blobToBase64(blob);
        await analyse({ audio_base64: b64, format: formatRef.current });
      };
      recorderRef.current = rec;
      rec.start();
      setRecording(true);
      setSeconds(0);
      timerRef.current = setInterval(() => {
        setSeconds(s => {
          if (s + 1 >= MAX_SECONDS) { stopRecording(); return MAX_SECONDS; }
          return s + 1;
        });
      }, 1000);

      // live waveform
      try {
        const Ctx = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new Ctx();
        audioCtxRef.current = ctx;
        const src = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        src.connect(analyser);
        const buf = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => {
          analyser.getByteFrequencyData(buf);
          const next: number[] = [];
          const step = Math.floor(buf.length / 16) || 1;
          for (let i = 0; i < 16; i++) {
            next.push(Math.max(0.15, Math.min(1, (buf[i * step] || 0) / 180)));
          }
          setLevels(next);
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      } catch { /* waveform is decorative */ }
    } catch {
      setMode('text');
      toast({
        title: t(lang, 'Microphone blocked', 'Микрофон недоступен'),
        description: t(lang, 'You can type what you ate instead.', 'Можно просто написать, что вы съели.'),
      });
    }
  }, [analyse, cleanup, lang, stopRecording, toast]);

  const patchItem = (idx: number, patch: Partial<VoiceFoodItem>) => {
    setItems(prev => prev ? prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)) : prev);
  };

  const scalePortion = (idx: number, portion: number) => {
    setItems(prev => {
      if (!prev) return prev;
      return prev.map((it, i) => {
        if (i !== idx) return it;
        const base = it.portion_g || 0;
        if (!base || !portion) return { ...it, portion_g: portion };
        const r = portion / base;
        return {
          ...it,
          portion_g: portion,
          calories: Math.round(it.calories * r),
          protein_g: Math.round(it.protein_g * r),
          carbs_g: Math.round(it.carbs_g * r),
          fat_g: Math.round(it.fat_g * r),
        };
      });
    });
  };

  const total = (items || []).reduce((a, i) => a + (i.calories || 0), 0);

  const confirm = async () => {
    const list = (items || []).filter(i => (i.calories || 0) > 0 || (i.protein_g || 0) > 0);
    if (list.length === 0) return;
    setSaving(true);
    try {
      await onConfirm(list);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={() => !recording && !processing && onClose()}
        className="fixed inset-0 z-[220] bg-black/70 flex items-end justify-center"
      >
        <motion.div
          initial={{ y: 260 }} animate={{ y: 0 }} exit={{ y: 260 }} transition={{ type: 'spring', damping: 26 }}
          onClick={e => e.stopPropagation()}
          className="w-full max-w-md bg-card rounded-t-3xl border border-border/40 p-5 pb-[calc(env(safe-area-inset-bottom,0px)+20px)] max-h-[88vh] overflow-y-auto"
        >
          <div className="w-10 h-1 bg-muted-foreground/20 rounded-full mx-auto mb-3" />
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-bold text-foreground">
              {title || t(lang, 'Say what you ate', 'Расскажите, что вы съели')}
            </p>
            <button onClick={onClose} className="p-1.5 rounded-full hover:bg-secondary/60" aria-label="close">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          {/* ---- Capture step ---- */}
          {!items && (
            <div className="space-y-4">
              {mode === 'voice' ? (
                <div className="flex flex-col items-center gap-4 py-2">
                  <div className="flex items-end justify-center gap-1 h-12">
                    {levels.map((v, i) => (
                      <motion.span
                        key={i}
                        animate={{ height: `${(recording ? v : 0.15) * 100}%` }}
                        transition={{ duration: 0.12 }}
                        className={`w-1.5 rounded-full ${recording ? 'bg-primary' : 'bg-muted-foreground/25'}`}
                        style={{ height: '15%' }}
                      />
                    ))}
                  </div>

                  <p className="text-xs text-muted-foreground text-center px-4">
                    {recording
                      ? `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')} / 01:00`
                      : t(lang,
                          'Example: “Three scrambled eggs, a slice of rye bread and a cappuccino”',
                          'Например: «Омлет из трёх яиц, кусок ржаного хлеба и капучино»')}
                  </p>

                  {processing ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground py-3">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {t(lang, 'Recognising…', 'Распознаю…')}
                    </div>
                  ) : (
                    <motion.button
                      whileTap={{ scale: 0.93 }}
                      onClick={recording ? stopRecording : startRecording}
                      className={`w-20 h-20 rounded-full flex items-center justify-center shadow-lg transition-colors ${
                        recording ? 'bg-destructive shadow-destructive/30' : 'bg-primary shadow-primary/30'
                      }`}
                    >
                      {recording
                        ? <Square className="w-7 h-7 text-primary-foreground" />
                        : <Mic className="w-8 h-8 text-primary-foreground" />}
                    </motion.button>
                  )}

                  {!recording && !processing && (
                    <button onClick={() => setMode('text')} className="flex items-center gap-1.5 text-xs text-muted-foreground py-1">
                      <Keyboard className="w-3.5 h-3.5" />
                      {t(lang, 'Type instead', 'Написать текстом')}
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <textarea
                    value={text}
                    onChange={e => setText(e.target.value.slice(0, 1000))}
                    rows={4}
                    autoFocus
                    placeholder={t(lang,
                      'Three scrambled eggs, a slice of rye bread and a cappuccino',
                      'Омлет из трёх яиц, кусок ржаного хлеба и капучино')}
                    className="w-full bg-secondary/50 border border-border/50 rounded-2xl p-3 text-sm text-foreground focus:outline-none focus:border-primary/50 resize-none"
                  />
                  <button
                    disabled={processing || text.trim().length < 2}
                    onClick={() => analyse({ text: text.trim() })}
                    className="w-full bg-primary text-primary-foreground rounded-2xl py-3 text-sm font-bold disabled:opacity-40 flex items-center justify-center gap-2"
                  >
                    {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    {t(lang, 'Recognise', 'Распознать')}
                  </button>
                  <button onClick={() => setMode('voice')} className="w-full flex items-center justify-center gap-1.5 text-xs text-muted-foreground py-1">
                    <Mic className="w-3.5 h-3.5" />
                    {t(lang, 'Use voice', 'Записать голосом')}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ---- Confirm step ---- */}
          {items && (
            <div className="space-y-3">
              {transcript && (
                <p className="text-[11px] text-muted-foreground italic bg-secondary/40 rounded-xl px-3 py-2">“{transcript}”</p>
              )}

              {items.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">
                  {t(lang, 'Nothing recognised. Try again.', 'Ничего не распознано. Попробуйте ещё раз.')}
                </p>
              )}

              <div className="space-y-2">
                {items.map((it, idx) => (
                  <div key={idx} className="bg-secondary/40 rounded-2xl p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        value={it.name}
                        onChange={e => patchItem(idx, { name: e.target.value.slice(0, 80) })}
                        className="flex-1 bg-transparent text-sm font-bold text-foreground focus:outline-none"
                      />
                      <button onClick={() => setItems(prev => (prev || []).filter((_, i) => i !== idx))}
                        className="p-1.5 rounded-lg hover:bg-destructive/15" aria-label="remove">
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </button>
                    </div>
                    <div className="grid grid-cols-5 gap-1.5">
                      {([
                        ['portion_g', t(lang, 'g', 'г')],
                        ['calories', t(lang, 'kcal', 'ккал')],
                        ['protein_g', t(lang, 'P', 'Б')],
                        ['carbs_g', t(lang, 'C', 'У')],
                        ['fat_g', t(lang, 'F', 'Ж')],
                      ] as [keyof VoiceFoodItem, string][]).map(([field, label]) => (
                        <div key={String(field)} className="text-center">
                          <input
                            type="number"
                            inputMode="numeric"
                            value={String(it[field] ?? 0)}
                            onChange={e => {
                              const v = Math.max(0, parseInt(e.target.value) || 0);
                              if (field === 'portion_g') scalePortion(idx, v);
                              else patchItem(idx, { [field]: v } as Partial<VoiceFoodItem>);
                            }}
                            className="w-full bg-background/60 border border-border/40 rounded-lg px-1 py-1.5 text-xs font-bold text-foreground text-center focus:outline-none focus:border-primary/50"
                          />
                          <span className="text-[9px] text-muted-foreground">{label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {items.length > 0 && (
                <div className="flex items-center justify-between px-1 text-xs">
                  <span className="text-muted-foreground">{t(lang, 'Total', 'Итого')}</span>
                  <span className="font-bold text-foreground">{total} {t(lang, 'kcal', 'ккал')}</span>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => { setItems(null); setTranscript(''); setText(''); }}
                  className="flex-1 bg-secondary/60 text-foreground rounded-2xl py-3 text-sm font-bold flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  {t(lang, 'Redo', 'Заново')}
                </button>
                <button
                  onClick={confirm}
                  disabled={items.length === 0 || saving}
                  className="flex-1 bg-primary text-primary-foreground rounded-2xl py-3 text-sm font-bold disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {t(lang, 'Confirm', 'Подтвердить')}
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
