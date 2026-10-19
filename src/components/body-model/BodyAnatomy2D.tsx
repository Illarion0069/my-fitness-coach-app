import { useEffect, useRef, useState } from 'react';
import maleAnatomy from '@/assets/body-anatomy-male.png';
import femaleAnatomy from '@/assets/body-anatomy-female.png';
import { Button } from '@/components/ui/button';
import { BODY_METRICS, type BodyMetric, type BodyValues } from '@/lib/bodyModel';
import { ANATOMY_ZONES, anatomyRatios, anatomySourceX, type BodySilhouette } from '@/lib/bodyAnatomy';

interface Props { values: BodyValues; baseline: BodyValues; selected: BodyMetric; onSelect: (key: BodyMetric) => void; compare: boolean; lang: string; silhouette: BodySilhouette }
const WIDTH = 384, HEIGHT = 576;

export default function BodyAnatomy2D({ values, baseline, selected, onSelect, compare, lang, silhouette }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [pixels, setPixels] = useState<ImageData | null>(null);
  const [failed, setFailed] = useState(false);
  const target = useRef(anatomyRatios(values, baseline));
  const current = useRef(anatomyRatios(values, baseline));
  const anatomy = silhouette === 'female' ? femaleAnatomy : maleAnatomy;
  useEffect(() => { target.current = anatomyRatios(values, baseline); }, [values, baseline]);
  useEffect(() => {
    let active = true;
    setPixels(null); setFailed(false);
    const image = new Image();
    image.onload = () => {
      const source = document.createElement('canvas');
      source.width = WIDTH; source.height = HEIGHT;
      const context = source.getContext('2d');
      if (!context) { if (active) setFailed(true); return; }
      context.drawImage(image, 0, 0, WIDTH, HEIGHT);
      if (active) setPixels(context.getImageData(0, 0, WIDTH, HEIGHT));
    };
    image.onerror = () => { if (active) setFailed(true); };
    image.src = anatomy;
    return () => { active = false; };
  }, [anatomy]);

  useEffect(() => {
    const context = canvas.current?.getContext('2d');
    if (!context || !pixels) return;
    const output = context.createImageData(WIDTH, HEIGHT);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let frame = 0, last = 0, first = true;
    const draw = (now: number) => {
      frame = requestAnimationFrame(draw);
      if (now - last < 32) return;
      const amount = reduced ? 1 : 1 - Math.exp(-12 * Math.min((now - last) / 1000, .05));
      last = now;
      let dirty = first; first = false;
      for (const { key } of BODY_METRICS) {
        const difference = target.current[key] - current.current[key];
        if (Math.abs(difference) > .0001) dirty = true;
        current.current[key] += difference * amount;
      }
      if (!dirty) return;
      for (let y = 0; y < HEIGHT; y++) {
        for (let x = 0; x < WIDTH; x++) {
          const nx = (x / WIDTH - .5) * 2;
          const sourceX = Math.max(0, Math.min(WIDTH - 1.001, (anatomySourceX(nx, y / HEIGHT, current.current) + 1) * WIDTH / 2));
          const firstX = Math.floor(sourceX), fraction = sourceX - firstX;
          const source = (y * WIDTH + firstX) * 4, destination = (y * WIDTH + x) * 4;
          for (let channel = 0; channel < 4; channel++) output.data[destination + channel] = pixels.data[source + channel] * (1 - fraction) + pixels.data[source + 4 + channel] * fraction;
        }
      }
      context.putImageData(output, 0, 0);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [pixels]);

  const zone = ANATOMY_ZONES.find(item => item.key === selected);
  if (failed) return <div className="h-full flex items-center justify-center text-muted-foreground">{lang === 'en' ? 'Anatomical image unavailable' : 'Анатомическая модель недоступна'}</div>;
  return <div className="h-full flex justify-center" data-testid="body-anatomy-2d" data-silhouette={silhouette}>
    <div className="relative h-full aspect-[2/3] max-w-full anatomy-stage">
      {compare && <img src={anatomy} width={1024} height={1536} loading="lazy" alt="" className="absolute inset-0 h-full w-full object-contain opacity-25 scale-x-110 transition-opacity" />}
      <canvas ref={canvas} width={WIDTH} height={HEIGHT} role="img" aria-label={lang === 'en' ? `${silhouette} muscular anatomy` : `Мышечная анатомия: ${silhouette === 'female' ? 'женщина' : 'мужчина'}`} className="relative h-full w-full" />
      {!pixels && <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground animate-pulse">{lang === 'en' ? 'Loading anatomy…' : 'Загрузка анатомии…'}</div>}
      {zone && <svg viewBox="0 0 100 150" className="absolute inset-0 h-full w-full pointer-events-none text-primary anatomy-selection" aria-hidden="true">
        <path d={selected.includes('arm') ? `M ${zone.x - 4} ${zone.y * 1.5 - 7} Q ${zone.x - 8} ${zone.y * 1.5} ${zone.x - 3} ${zone.y * 1.5 + 7} M ${zone.x + 4} ${zone.y * 1.5 - 7} Q ${zone.x + 8} ${zone.y * 1.5} ${zone.x + 3} ${zone.y * 1.5 + 7}` : selected.includes('leg') ? `M ${zone.x - 6} 83 Q ${zone.x - 9} 91 ${zone.x - 5} 100 M ${zone.x + 6} 83 Q ${zone.x + 9} 91 ${zone.x + 5} 100` : `M ${selected === 'chest_cm' ? 34 : 37} ${zone.y * 1.5} Q 50 ${zone.y * 1.5 + 4} ${selected === 'chest_cm' ? 66 : 63} ${zone.y * 1.5}`} stroke="currentColor" strokeWidth="1" fill="none" strokeLinecap="round" />
      </svg>}
      {ANATOMY_ZONES.map(item => {
        const metric = BODY_METRICS.find(m => m.key === item.key);
        const active = selected === item.key;
        return <Button key={item.key} variant="ghost" aria-label={lang === 'en' ? metric?.en : metric?.ru} title={lang === 'en' ? metric?.en : metric?.ru} aria-pressed={active} onClick={() => onSelect(item.key)} className={`anatomy-hotspot absolute h-11 w-11 p-0 rounded-full -translate-x-1/2 -translate-y-1/2 ${active ? 'text-primary' : 'text-foreground'}`} style={{ left: `${item.x}%`, top: `${item.y}%` }}>
          <span className={`anatomy-pin ${active ? 'anatomy-pin-active' : ''}`} />
        </Button>;
      })}
    </div>
  </div>;
}
