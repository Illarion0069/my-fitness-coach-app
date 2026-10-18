import { useEffect, useRef, useState } from 'react';
import anatomy from '@/assets/body-anatomy-front.png';
import { Button } from '@/components/ui/button';
import { BODY_METRICS, bodyRatio, type BodyMetric, type BodyValues } from '@/lib/bodyModel';

interface Props { values: BodyValues; baseline: BodyValues; selected: BodyMetric; onSelect: (key: BodyMetric) => void; compare: boolean; lang: string }
const WIDTH = 512, HEIGHT = 768;
const ZONES: { key: BodyMetric; x: number; y: number; width: number; height: number }[] = [
  { key: 'chest_cm', x: 50, y: 23, width: 32, height: 9 },
  { key: 'waist_cm', x: 50, y: 37, width: 23, height: 8 },
  { key: 'hips_cm', x: 50, y: 47, width: 27, height: 8 },
  { key: 'right_arm_cm', x: 29, y: 29, width: 12, height: 11 },
  { key: 'left_arm_cm', x: 71, y: 29, width: 12, height: 11 },
  { key: 'right_leg_cm', x: 42, y: 60, width: 14, height: 12 },
  { key: 'left_leg_cm', x: 58, y: 60, width: 14, height: 12 },
];

export default function BodyAnatomy2D({ values, baseline, selected, onSelect, compare, lang }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [pixels, setPixels] = useState<ImageData | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
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
  }, []);

  useEffect(() => {
    const context = canvas.current?.getContext('2d');
    if (!context || !pixels) return;
    const output = context.createImageData(WIDTH, HEIGHT);
    const ratios = Object.fromEntries(BODY_METRICS.map(({ key }) => [key, bodyRatio(values[key], baseline[key]) - 1])) as Record<BodyMetric, number>;
    // Inverse horizontal warp with smooth influence fields: keeps muscle detail and avoids cut seams.
    for (let y = 0; y < HEIGHT; y++) {
      const normalizedY = y / HEIGHT;
      const bell = (center: number, width: number) => Math.exp(-(((normalizedY - center) / width) ** 2));
      const torso = ratios.chest_cm * bell(.23, .07) + ratios.waist_cm * bell(.37, .06) + ratios.hips_cm * bell(.47, .06);
      const arms = bell(.29, .075), legs = bell(.60, .10);
      for (let x = 0; x < WIDTH; x++) {
        const nx = (x / WIDTH - .5) * 2;
        const armInfluence = Math.exp(-(((Math.abs(nx) - .42) / .13) ** 4)) * arms;
        const torsoInfluence = Math.exp(-((nx / .34) ** 6));
        const arm = nx < 0 ? ratios.right_arm_cm : ratios.left_arm_cm;
        const leg = nx < 0 ? ratios.right_leg_cm : ratios.left_leg_cm;
        const axis = nx < 0 ? -.16 : .16;
        const offset = nx * torso * torsoInfluence + (nx - Math.sign(nx) * .42) * arm * armInfluence + (nx - axis) * leg * legs;
        const sourceX = Math.max(0, Math.min(WIDTH - 1.001, (nx - offset + 1) * WIDTH / 2));
        const first = Math.floor(sourceX), fraction = sourceX - first;
        const source = (y * WIDTH + first) * 4, destination = (y * WIDTH + x) * 4;
        for (let channel = 0; channel < 4; channel++) output.data[destination + channel] = pixels.data[source + channel] * (1 - fraction) + pixels.data[source + 4 + channel] * fraction;
      }
    }
    context.putImageData(output, 0, 0);
  }, [values, baseline, pixels]);

  if (failed) return <div className="h-full flex items-center justify-center text-muted-foreground">{lang === 'en' ? 'Anatomical image unavailable' : 'Анатомическая модель недоступна'}</div>;
  return <div className="h-full flex justify-center" data-testid="body-anatomy-2d">
    <div className="relative h-full aspect-[2/3] max-w-full">
      {compare && <img src={anatomy} width={1024} height={1536} alt="" className="absolute inset-0 h-full w-full object-contain opacity-30" />}
      <canvas ref={canvas} width={WIDTH} height={HEIGHT} role="img" aria-label={lang === 'en' ? 'Detailed front-view muscular anatomy' : 'Детализированная анатомия мышц, вид спереди'} className="relative h-full w-full" />
      {!pixels && <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">{lang === 'en' ? 'Loading anatomy…' : 'Загрузка анатомии…'}</div>}
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full pointer-events-none text-primary" aria-hidden="true">
        {ZONES.filter(zone => zone.key === selected).map(zone => <ellipse key={zone.key} cx={zone.x} cy={zone.y} rx={zone.width / 2} ry={zone.height / 3} fill="none" stroke="currentColor" strokeWidth="1" vectorEffect="non-scaling-stroke" />)}
      </svg>
      {ZONES.map(zone => {
        const metric = BODY_METRICS.find(item => item.key === zone.key);
        return <Button key={zone.key} variant="ghost" aria-label={lang === 'en' ? metric?.en : metric?.ru} title={lang === 'en' ? metric?.en : metric?.ru} aria-pressed={selected === zone.key} onClick={() => onSelect(zone.key)} className="absolute min-h-11 min-w-11 p-0 rounded-full -translate-x-1/2 -translate-y-1/2 hover:bg-primary/15 focus-visible:ring-primary" style={{ left: `${zone.x}%`, top: `${zone.y}%`, width: `${zone.width}%`, height: `${zone.height}%` }} />;
      })}
    </div>
  </div>;
}