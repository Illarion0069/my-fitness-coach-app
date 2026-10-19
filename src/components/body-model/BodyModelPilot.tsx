import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ZoomIn, ZoomOut, Play, Pause, Scan, Info, Plus, Minus, UserRound, RotateCcw } from 'lucide-react';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import HintDot, { markHintSeen } from '@/components/HintDot';
import { BODY_METRICS, DEMO_BODY_HISTORY, formatBodyDate, interpolateBody, type BodyMeasurement, type BodyMetric } from '@/lib/bodyModel';
import BodyAnatomy2D from './BodyAnatomy2D';
import { profileSilhouette, type BodySilhouette } from '@/lib/bodyAnatomy';

export default function BodyModelPilot({ measurements, lang, name, gender, onClose, onAdd }: { measurements: BodyMeasurement[]; lang: string; name: string; gender?: string | null; onClose: () => void; onAdd: () => void }) {
  const en = lang === 'en';
  const [demo, setDemo] = useState(measurements.length === 0);
  const [silhouette, setSilhouette] = useState<BodySilhouette | null>(profileSilhouette(gender));
  useEffect(() => { setSilhouette(profileSilhouette(gender)); }, [gender]);
  const [selected, setSelected] = useState<BodyMetric>('waist_cm');
  const [position, setPosition] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [compare, setCompare] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const [sandbox, setSandbox] = useState(DEMO_BODY_HISTORY.map(row => ({ ...row })));
  const reduced = useRef(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const history = useMemo(() => demo ? sandbox : [...measurements].sort((a, b) => a.measured_at.localeCompare(b.measured_at)), [demo, sandbox, measurements]);
  const baseline = history[0];
  const max = Math.max(0, history.length - 1);
  const safePosition = Math.min(position, max);
  const left = history[Math.floor(safePosition)], right = history[Math.min(Math.ceil(safePosition), max)];
  const values = left && right ? interpolateBody(left, right, safePosition % 1) : null;
  const metric = BODY_METRICS.find(item => item.key === selected) ?? BODY_METRICS[0];
  const value = values?.[selected];
  const firstValue = baseline?.[selected];
  const delta = value != null && firstValue != null ? value - firstValue : null;
  const unit = en ? metric.unit : metric.unitRu;
  const adjustDemo = (next: number) => {
    if (!Number.isFinite(next) || next < 1 || next > 250) return;
    setPlaying(false); setPosition(max);
    setSandbox(rows => rows.map((row, index) => index === 3 ? { ...row, [selected]: next } : row));
  };

  useEffect(() => { setPosition(max); setPlaying(false); }, [demo, max]);
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', close);
    return () => { document.body.style.overflow = previous; document.removeEventListener('keydown', close); };
  }, [onClose]);
  useEffect(() => {
    if (!playing || max === 0) return;
    let frame = 0, last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.1); last = now;
      setPosition(current => {
        const next = current + dt * 0.45;
        if (next >= max) { setPlaying(false); return max; }
        return next;
      });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, max]);

  return createPortal(<div role="dialog" aria-modal="true" aria-label={en ? 'Body Measurements' : 'Замеры тела'} className="fixed inset-0 z-[190] bg-background flex flex-col overflow-y-auto" onTouchStart={event => event.stopPropagation()} onTouchEnd={event => event.stopPropagation()}>
    <header className="flex items-center gap-3 px-4 md:px-8 py-2 border-b border-border shrink-0 pt-[max(.5rem,env(safe-area-inset-top))]">
      <Button variant="ghost" size="icon" className="min-h-11 min-w-11" aria-label={en ? 'Close body model' : 'Закрыть модель'} onClick={onClose}><ArrowLeft /></Button>
      <div className="min-w-0 flex-1"><h2 className="text-2xl tracking-normal">{en ? 'Body Measurements' : 'Замеры тела'}</h2><p className="text-xs text-muted-foreground truncate">{name}</p></div>
      <Button size="icon" className="min-h-11 min-w-11" aria-label={en ? 'Add measurement' : 'Добавить замер'} title={en ? 'Add measurement' : 'Добавить замер'} onClick={onAdd}><Plus /></Button>
    </header>
    <div className="flex flex-col md:flex-row gap-2 md:gap-5 items-start md:items-center justify-between px-5 md:px-10 pt-3 shrink-0">
      <div className="flex gap-1 bg-secondary rounded-md p-1" role="group" aria-label={en ? 'Data source' : 'Источник данных'}>
        <Button size="sm" variant={!demo ? 'default' : 'ghost'} aria-pressed={!demo} onClick={() => setDemo(false)}>{en ? 'My measurements' : 'Мои замеры'}</Button>
        <Button size="sm" variant={demo ? 'default' : 'ghost'} aria-pressed={demo} onClick={() => setDemo(true)}>{en ? 'Demo' : 'Демонстрация'}</Button>
      </div>
       <div className="flex items-center gap-2"><Button variant={silhouette === 'male' ? 'secondary' : 'ghost'} size="icon" aria-label={en ? 'Male silhouette' : 'Мужской силуэт'} title={en ? 'Male silhouette' : 'Мужской силуэт'} aria-pressed={silhouette === 'male'} onClick={() => setSilhouette('male')}><span className="text-2xl" aria-hidden="true">♂</span></Button><Button variant={silhouette === 'female' ? 'secondary' : 'ghost'} size="icon" aria-label={en ? 'Female silhouette' : 'Женский силуэт'} title={en ? 'Female silhouette' : 'Женский силуэт'} aria-pressed={silhouette === 'female'} onClick={() => setSilhouette('female')}><span className="text-2xl" aria-hidden="true">♀</span></Button><span className="text-xs text-muted-foreground">{silhouette === 'female' ? (en ? 'Female' : 'Женщина') : silhouette === 'male' ? (en ? 'Male' : 'Мужчина') : (en ? 'Select silhouette' : 'Выберите силуэт')}</span></div>
       <p className="text-xs text-muted-foreground hidden md:block">{demo ? (en ? 'Sample values · not saved to your profile' : 'Примерные данные · не сохраняются в профиль') : (en ? `${history.length} saved measurement(s)` : `Сохранённых замеров: ${history.length}`)}</p>
    </div>
    <main className="grid md:grid-cols-[minmax(0,1fr)_340px] lg:grid-cols-[minmax(0,1fr)_400px] gap-4 md:gap-10 px-4 md:px-10 flex-1 min-h-0 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="relative min-w-0">
        <div className="flex items-center justify-between gap-2 py-2">
          <div className="flex items-center gap-2">
          <Scan className="w-4 h-4 text-primary"/><span className="text-xs text-muted-foreground">{en ? 'Anatomical view' : 'Анатомическая модель'}</span>
          </div>
          <Button variant="ghost" size="icon" className="min-h-11 min-w-11" aria-label={zoomed ? (en ? 'Reduce anatomy' : 'Уменьшить модель') : (en ? 'Enlarge anatomy' : 'Увеличить модель')} title={zoomed ? (en ? 'Reduce anatomy' : 'Уменьшить модель') : (en ? 'Enlarge anatomy' : 'Увеличить модель')} onClick={() => setZoomed(current => !current)}>{zoomed ? <ZoomOut /> : <ZoomIn />}</Button>
        </div>
        <div className={`${zoomed ? 'h-[min(65svh,580px)] md:h-[min(78vh,900px)]' : 'h-[clamp(330px,49svh,520px)] md:h-[min(65vh,760px)]'} md:min-h-[360px] w-full`} data-testid="body-scene">
          {values && baseline && silhouette ? <BodyAnatomy2D silhouette={silhouette} values={values} baseline={baseline} selected={selected} onSelect={key => { setSelected(key); markHintSeen('body-pilot-zones'); }} compare={compare} lang={lang} /> : <div className="h-full flex items-center justify-center text-muted-foreground">{!silhouette ? (en ? 'Select male or female silhouette' : 'Выберите мужской или женский силуэт') : (en ? 'No measurements yet' : 'Замеров пока нет')}</div>}
        </div>
        <HintDot id="body-pilot-zones" en="Tap a body region" ru="Нажмите на часть тела" className="left-4 top-20" side="right" />
<div className="body-value-strip border-y border-border py-3 px-4 rounded-md" aria-live="polite"><div><h3 className="text-xl tracking-normal" data-testid="body-selected-region">{en ? metric.en : metric.ru}</h3><div className="flex items-baseline gap-2 mt-2"><span className="text-3xl md:text-5xl font-heading" data-testid="body-selected-value">{value == null ? '—' : Number(value.toFixed(1))}</span><span className="text-sm text-muted-foreground">{unit}</span>{delta != null && <span className="text-sm text-primary ml-auto">{delta > 0 ? '+' : ''}{Number(delta.toFixed(1))} {unit}</span>}</div><p className="text-xs text-muted-foreground mt-2">{en ? metric.hintEn : metric.hintRu}</p></div></div>
        <div className="flex items-center justify-center gap-3 py-4"><Switch id="compare-body" checked={compare} onCheckedChange={setCompare} /><label htmlFor="compare-body" className="text-xs text-muted-foreground">{en ? 'Starting silhouette' : 'Контур первого замера'}</label></div>
        <div className="border-t border-border py-3 space-y-3">
          <div className="flex items-center justify-between gap-3"><p className="text-sm font-medium">{left ? formatBodyDate(left.measured_at, lang) : '—'}</p><Button size="icon" className="min-h-11 min-w-11" variant="outline" disabled={max === 0 || reduced.current} aria-label={playing ? (en ? 'Pause history' : 'Остановить историю') : (en ? 'Play history' : 'Воспроизвести историю')} onClick={() => { if (!playing) setPosition(0); setPlaying(current => !current); }}>{playing ? <Pause /> : <Play />}</Button></div>
          <Slider aria-label={en ? 'Measurement history' : 'История замеров'} min={0} max={Math.max(1, max)} step={0.01} value={[safePosition]} disabled={max === 0} onValueChange={([next]) => { setPlaying(false); setPosition(next); }} />
          <div className="flex justify-between text-[11px] text-muted-foreground"><span>{baseline ? formatBodyDate(baseline.measured_at, lang) : '—'}</span><span>{history[max] ? formatBodyDate(history[max].measured_at, lang) : '—'}</span></div>
          {!demo && max < 1 && <p className="text-xs text-muted-foreground">{en ? 'History comparison requires two saved measurements.' : 'Для сравнения нужны два сохранённых замера.'}</p>}
        </div>
      </div>
      <aside className="min-w-0 md:pt-6 pb-8 space-y-5">
        <div className="grid grid-cols-2 gap-2">
          {BODY_METRICS.map(item => <Button key={item.key} variant={item.key === selected ? 'default' : 'secondary'} className="h-auto min-h-14 py-2 px-3 flex-col items-start gap-0.5 whitespace-normal text-left transition-all duration-200" aria-pressed={item.key === selected} onClick={() => { setSelected(item.key); markHintSeen('body-pilot-zones'); }}><span className="text-xs">{en ? item.en : item.ru}</span><span className="text-sm font-semibold">{values?.[item.key] == null ? '—' : Number(values[item.key]?.toFixed(1))} <span className="text-[10px] opacity-70">{en ? item.unit : item.unitRu}</span></span></Button>)}
        </div>
        <div className="border-t border-border pt-4"><p className="text-xs text-muted-foreground mb-3">{en ? 'Measurement history' : 'История замера'}</p><div className="h-36">
          <ResponsiveContainer width="100%" height="100%"><LineChart data={history.map(row => ({ date: formatBodyDate(row.measured_at, lang), value: row[selected] }))} margin={{ top: 10, right: 12, bottom: 0, left: -25 }}><XAxis dataKey="date" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} /><YAxis domain={['auto', 'auto']} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} /><Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 6 }} /><Line dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} connectNulls={false} /></LineChart></ResponsiveContainer>
        </div></div>
        {demo && <div className="border-t border-border pt-4"><div className="flex items-center justify-between"><label htmlFor="demo-measurement" className="text-xs text-muted-foreground">{en ? `Demo: ${metric.en}, final measurement (${unit})` : `Демо: ${metric.ru}, последний замер (${unit})`}</label><Button variant="ghost" size="icon" aria-label={en ? 'Reset demo' : 'Сбросить демо'} title={en ? 'Reset demo' : 'Сбросить демо'} onClick={() => { setSandbox(DEMO_BODY_HISTORY.map(row => ({ ...row }))); setPlaying(false); }}><RotateCcw className="w-4 h-4" /></Button></div>
          <Slider className="my-5" aria-label={en ? 'Demo circumference' : 'Демо-обхват'} min={Math.max(1, (DEMO_BODY_HISTORY[3][selected] ?? 50) * .65)} max={(DEMO_BODY_HISTORY[3][selected] ?? 50) * 1.4} step={.5} value={[sandbox[3][selected] ?? 1]} onValueChange={([next]) => adjustDemo(next)} /><div className="flex gap-2 mt-2">
            <Button size="icon" variant="secondary" className="shrink-0 h-12 w-12" aria-label={en ? 'Decrease demo measurement' : 'Уменьшить демо-замер'} onClick={() => adjustDemo((sandbox[3][selected] ?? 1) - 0.5)}><Minus /></Button>
            <Input id="demo-measurement" className="h-12 text-base text-center" type="number" inputMode="decimal" min={1} max={250} step={0.5} value={sandbox[3][selected] ?? ''} onChange={event => adjustDemo(Number(event.target.value))} />
            <Button size="icon" variant="secondary" className="shrink-0 h-12 w-12" aria-label={en ? 'Increase demo measurement' : 'Увеличить демо-замер'} onClick={() => adjustDemo((sandbox[3][selected] ?? 1) + 0.5)}><Plus /></Button>
          </div></div>}
        <div className="flex gap-2 border-t border-border pt-4 text-xs text-muted-foreground"><Info className="w-4 h-4 shrink-0" /><p>{en ? 'Illustrative shape, not a body scan. Tape measurements cannot determine exact anatomy or body-fat percentage.' : 'Условная форма, не скан тела. Обхваты не определяют точную анатомию или процент жира.'}</p></div>
      </aside>
    </main>
  </div>, document.body);
}