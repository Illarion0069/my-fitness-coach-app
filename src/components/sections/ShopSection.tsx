import { useState, useRef, useEffect } from 'react';
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Award,
  Check,
  ChevronDown,
  Clock,
  Flame,
  Loader2,
  MapPin,
  PlayCircle,
  Quote,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Star,
  Target,
  TrendingUp,
  Users,
  Waves,
  X,
  Zap,
  HeartPulse,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import trainerPhoto from '@/assets/trainer-photo.jpg';
import heroVideoAsset from '@/assets/hero-flow.mp4.asset.json';
import heroPosterAsset from '@/assets/hero-flow-poster.jpg.asset.json';
import { z } from 'zod';

const leadSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(255),
  whatsapp: z.string().trim().max(50).optional().or(z.literal('')),
  preferred_language: z.string().max(50).optional().or(z.literal('')),
  fitness_level: z.string().max(50).optional().or(z.literal('')),
  main_goal: z.string().trim().max(500).optional().or(z.literal('')),
  injuries_limitations: z.string().trim().max(500).optional().or(z.literal('')),
  selected_package: z.enum(['basic', 'premium']),
  referral_source: z.string().trim().max(200).optional().or(z.literal('')),
});

type PackageId = 'basic' | 'premium';

// Founding cohort capacity — update when spots fill to keep scarcity honest
const FOUNDING_TOTAL = 30;
const FOUNDING_TAKEN = 7;

const ShopSection = () => {
  const { lang } = useLanguage();
  const { toast } = useToast();
  const formRef = useRef<HTMLDivElement>(null);
  const programRef = useRef<HTMLDivElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [pkg, setPkg] = useState<PackageId>('basic');
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [showStickyCta, setShowStickyCta] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    whatsapp: '',
    preferred_language: '',
    fitness_level: '',
    main_goal: '',
    injuries_limitations: '',
    referral_source: '',
  });

  const isRu = lang === 'ru';

  // Sticky CTA appears after the hero scrolls off and hides when form is in view
  useEffect(() => {
    const onScroll = () => {
      const formTop = formRef.current?.getBoundingClientRect().top ?? Infinity;
      setShowStickyCta(window.scrollY > 400 && formTop > window.innerHeight - 100 && !submitted);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, [submitted]);

  const scrollToForm = (selected?: PackageId) => {
    if (selected) setPkg(selected);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  const scrollToProgram = () => {
    programRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = leadSchema.safeParse({ ...form, selected_package: pkg });
    if (!parsed.success) {
      toast({
        title: isRu ? 'Проверь поля' : 'Check the fields',
        description: isRu ? 'Имя и email обязательны.' : 'Name and email are required.',
        variant: 'destructive',
      });
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from('flow_course_leads').insert({
      name: parsed.data.name,
      email: parsed.data.email,
      whatsapp: parsed.data.whatsapp || null,
      preferred_language: parsed.data.preferred_language || null,
      fitness_level: parsed.data.fitness_level || null,
      main_goal: parsed.data.main_goal || null,
      injuries_limitations: parsed.data.injuries_limitations || null,
      selected_package: parsed.data.selected_package,
      referral_source: parsed.data.referral_source || null,
    });
    setSubmitting(false);
    if (error) {
      toast({
        title: isRu ? 'Не получилось отправить' : 'Submission failed',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }
    setSubmitted(true);
  };

  const spotsLeft = FOUNDING_TOTAL - FOUNDING_TAKEN;
  const progressPct = Math.round((FOUNDING_TAKEN / FOUNDING_TOTAL) * 100);

  const benefits = [
    { icon: Activity, title: isRu ? 'Мобильность' : 'Mobility', desc: isRu ? 'Активная мобильность бёдер, плеч, позвоночника и голеностопов.' : 'Active mobility in hips, shoulders, spine and ankles.' },
    { icon: Target, title: isRu ? 'Контроль тела' : 'Body control', desc: isRu ? 'Управление телом близко к полу и в низких позициях.' : 'Learn to control your body close to the floor.' },
    { icon: Waves, title: isRu ? 'Координация' : 'Coordination', desc: isRu ? 'Связь между верхом, низом и корпусом.' : 'Better connection between upper body, lower body and core.' },
    { icon: Zap, title: isRu ? 'Сила' : 'Strength', desc: isRu ? 'Практическая сила собственного веса через движение.' : 'Practical bodyweight strength through movement.' },
    { icon: Sparkles, title: 'Flow', desc: isRu ? 'Соединяй простые паттерны в плавные комбинации.' : 'Connect simple patterns into smooth combinations.' },
    { icon: HeartPulse, title: isRu ? 'Уверенность' : 'Confidence', desc: isRu ? 'Свобода двигаться вне обычного спортзала.' : 'Feel confident moving outside traditional gym exercises.' },
  ];

  const weeks = [
    {
      n: 1,
      title: isRu ? 'Фундамент: запястья, плечи, бёдра' : 'Foundation, Wrists, Shoulders & Hips',
      desc: isRu ? 'Подготовка тела к работе на полу.' : 'Prepare your body for floor-based movement.',
      outcome: isRu ? 'К концу недели: безопасный контакт с полом и базовая позиция quadruped.' : 'By end of week: safe floor contact and base quadruped position.',
    },
    {
      n: 2,
      title: isRu ? 'Quadruped: контроль в низкой позиции' : 'Quadruped Control',
      desc: isRu ? 'Сила и контроль в низких опорных позициях.' : 'Build strength and control in low positions.',
      outcome: isRu ? 'К концу недели: контролируемый crawl вперёд и назад.' : 'By end of week: controlled forward and backward crawl.',
    },
    {
      n: 3,
      title: isRu ? 'Crab: задняя цепь и плечи' : 'Crab / Posterior Chain',
      desc: isRu ? 'Раскрытие плеч, активация ягодиц, обратная опора.' : 'Open shoulders, activate glutes, build reverse support.',
      outcome: isRu ? 'К концу недели: уверенная позиция crab и переход beast↔crab.' : 'By end of week: confident crab and beast↔crab transition.',
    },
    {
      n: 4,
      title: isRu ? 'Низкий присед и ape-style movement' : 'Low Squat & Ape-style Movement',
      desc: isRu ? 'Бёдра, голеностопы, латеральное движение и координация.' : 'Hips, ankles, lateral movement and coordination.',
      outcome: isRu ? 'К концу недели: латеральное передвижение из низкого приседа.' : 'By end of week: lateral movement from a deep squat.',
    },
    {
      n: 5,
      title: isRu ? 'Переходы и сборка flow' : 'Transitions & Flow Building',
      desc: isRu ? 'Соединяем движения в короткие последовательности.' : 'Connect movements into short sequences.',
      outcome: isRu ? 'К концу недели: свой 4-движенческий flow.' : 'By end of week: your own 4-movement flow.',
    },
    {
      n: 6,
      title: isRu ? 'Полный flow и финальный тест' : 'Full Flow Practice',
      desc: isRu ? 'Собираем итоговый flow и оцениваем прогресс.' : 'Build your final flow and test your progress.',
      outcome: isRu ? 'К концу недели: записанный финальный flow и mobility re-test.' : 'By end of week: recorded final flow and mobility re-test.',
    },
  ];

  const faqs = [
    {
      q: isRu ? 'Это официальная сертификация Animal Flow?' : 'Is this an official Animal Flow certification?',
      a: isRu
        ? 'Нет. Это не официальная сертификация Animal Flow и не даёт права официально преподавать Animal Flow. Это независимая авторская программа Иллариона Иентина, направленная на развитие мобильности, координации, контроля тела, ground-based movement и flow training.'
        : 'No. This is not an official Animal Flow certification and does not certify you to teach Animal Flow. This is an independent movement program created by Illarion Ientin, focused on mobility, coordination, body control, ground-based bodyweight movement and flow training.',
    },
    {
      q: isRu ? 'А если программа мне не подойдёт?' : 'What if the program isn\'t right for me?',
      a: isRu
        ? 'У тебя есть 7 дней с момента старта потока, чтобы решить. Если программа не подходит — напиши на почту, и мы вернём 100% оплаты без вопросов.'
        : 'You have 7 days from the cohort start to decide. If the program is not right for you, email me and we refund 100% — no questions asked.',
    },
    {
      q: isRu ? 'Нужен ли опыт?' : 'Do I need experience?',
      a: isRu
        ? 'Нет. Программа начинается с базы. Нужно уметь опуститься на пол и удерживать вес тела — каждая сессия включает более лёгкие варианты.'
        : 'No. The program starts from foundations. You should be able to get down to the floor and support your bodyweight, but every session includes easier variations.',
    },
    {
      q: isRu ? 'Нужно ли оборудование?' : 'Do I need equipment?',
      a: isRu ? 'Нет. Нужно тело, немного места и в идеале коврик.' : 'No. You need your body, a little space and ideally a mat.',
    },
    {
      q: isRu ? 'Сколько длятся тренировки?' : 'How long are the sessions?',
      a: isRu ? 'Большинство сессий — 15–35 минут.' : 'Most sessions are 15–35 minutes.',
    },
    {
      q: isRu ? 'Подойдёт ли, если я тренируюсь в зале?' : 'Can I do this if I train in the gym?',
      a: isRu
        ? 'Да. Программа дополняет силовые тренировки, бег, падел, HYROX и общий фитнес.'
        : 'Yes. This program complements strength training, running, padel, HYROX or general fitness.',
    },
    {
      q: isRu ? 'Это для лечения боли или реабилитации?' : 'Is this for pain or rehabilitation?',
      a: isRu
        ? 'Нет. Это не медицинская и не реабилитационная программа. При боли, травме или ограничениях проконсультируйся со специалистом перед началом.'
        : 'No. This is not a medical or rehabilitation program. If you have pain, injury or medical restrictions, consult a qualified healthcare professional before starting.',
    },
    {
      q: isRu ? 'На каком языке курс?' : 'What language is the course in?',
      a: isRu
        ? 'Первая версия — на английском, с поддержкой на русском/украинском в группе при необходимости.'
        : 'The first version is in English, with Russian/Ukrainian support in the group if needed.',
    },
  ];

  const forYou = isRu
    ? ['Тебе 25–50, чувствуешь скованность.', 'Ты любишь зал, бег, падел, HYROX и хочешь добавить качества движения.', 'Тебе нужна структура, а не случайные ролики.', 'Хочешь тренироваться дома, без оборудования.', 'Готов уделять 3 сессии в неделю по 15–35 минут.']
    : ['You are 25–50 and feel stiff.', 'You train in the gym, run, play padel or HYROX and want to add movement quality.', 'You want structure, not random Instagram clips.', 'You want to train at home, no equipment.', 'You can commit to 3 sessions per week, 15–35 min each.'];

  const notForYou = isRu
    ? ['Ищешь официальную сертификацию Animal Flow.', 'Ждёшь реабилитации или лечения боли.', 'Хочешь похудеть без работы над движением.', 'Не готов выделять 2 часа в неделю на практику.']
    : ['You need an official Animal Flow certification.', 'You expect rehab or pain treatment.', 'You want weight loss without movement work.', 'You can\'t commit ~2 hours per week.'];

  const transformations = isRu
    ? [
        { before: 'Скованные плечи и запястья', after: 'Подготовленные суставы и уверенная опора на пол' },
        { before: 'Случайные упражнения из Instagram', after: 'Понятная недельная структура с прогрессией' },
        { before: 'Деревянное движение в низком приседе', after: 'Контролируемые переходы и латеральные шаги' },
        { before: 'Нет ощущения flow', after: 'Свой записанный 4–6-движенческий flow' },
      ]
    : [
        { before: 'Stiff shoulders and wrists', after: 'Prepared joints and confident floor support' },
        { before: 'Random Instagram exercises', after: 'Clear weekly structure with progression' },
        { before: 'Stuck and rigid in a low squat', after: 'Controlled transitions and lateral steps' },
        { before: 'No sense of flow', after: 'Your own recorded 4–6 movement flow' },
      ];

  // Marquee tape items (Mindvalley / Skillshare-style scrolling tape)
  const tape = isRu
    ? ['MOBILITY', 'GROUND MOVEMENT', 'BODY CONTROL', 'FLOW', 'COORDINATION', 'STRENGTH', 'NO EQUIPMENT', '6 WEEKS']
    : ['MOBILITY', 'GROUND MOVEMENT', 'BODY CONTROL', 'FLOW', 'COORDINATION', 'STRENGTH', 'NO EQUIPMENT', '6 WEEKS'];

  // Comparison table rows (Future / Mindvalley pattern)
  const compareRows = isRu
    ? [
        { label: 'Структура и прогрессия', self: false, pt: true, mine: true },
        { label: 'Метод и обратная связь', self: false, pt: true, mine: 'premium' },
        { label: 'Цена за 6 недель', self: '€0', pt: '€480+', mine: '€149' },
        { label: 'Доступ к комьюнити', self: false, pt: false, mine: true },
        { label: 'Гибкий график', self: true, pt: false, mine: true },
      ]
    : [
        { label: 'Structure & progression', self: false, pt: true, mine: true },
        { label: 'Method & feedback', self: false, pt: true, mine: 'premium' },
        { label: 'Price for 6 weeks', self: '€0', pt: '€480+', mine: '€149' },
        { label: 'Community access', self: false, pt: false, mine: true },
        { label: 'Flexible schedule', self: true, pt: false, mine: true },
      ];

  return (
    <section className="min-h-screen bg-background text-foreground pb-28 relative overflow-x-hidden">
      {/* Trainer-only badge */}
      <div className="px-5 pt-5">
        <div className="max-w-3xl mx-auto flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
          <ShieldCheck className="w-3 h-3" />
          <span>{isRu ? 'Тренерский предпросмотр • виден только тебе' : 'Trainer preview • visible only to you'}</span>
        </div>
      </div>

      {/* ───────────────────────── HERO ───────────────────────── */}
      <div className="relative overflow-hidden">
        {/* Layered atmospheric background */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.18),transparent_60%)] pointer-events-none" />
        <div className="absolute -top-40 -right-40 w-[28rem] h-[28rem] rounded-full bg-primary/20 blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 -left-32 w-72 h-72 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
        {/* Subtle grid */}
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage: 'linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />

        <div className="relative max-w-3xl mx-auto px-5 pt-8 pb-14">
          {/* Editorial meta line — MasterClass-style */}
          <div className="flex items-center justify-between mb-6 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
            <span className="flex items-center gap-2">
              <span className="w-6 h-px bg-primary" />
              {isRu ? 'Серия № 001' : 'Series № 001'}
            </span>
            <span>{isRu ? 'Лимассол · Онлайн' : 'Limassol · Online'}</span>
          </div>

          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/40 bg-primary/10 text-primary text-[10px] uppercase tracking-widest mb-6">
            <Flame className="w-3 h-3" />
            {isRu ? 'Founding cohort • Первый поток' : 'Founding cohort • First intake'}
          </div>

          {/* Massive editorial display */}
          <h1 className="font-display text-[clamp(3rem,12vw,6.5rem)] leading-[0.88] tracking-tight mb-5">
            GROUND
            <br />
            MOVEMENT
            <br />
            <span className="text-primary italic">& flow</span>
          </h1>

          <p className="text-lg text-foreground/80 leading-snug max-w-xl mb-6">
            {isRu
              ? 'Авторская 6-недельная программа Иллариона Иентина. Двигайся свободнее, владей телом на полу и собирай свои flow — без оборудования.'
              : 'A 6-week original program by Illarion Ientin. Move freer, own your body on the floor, build your own flows — no equipment.'}
          </p>

          {/* Trust strip */}
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-[11px] text-muted-foreground mb-7">
            <span className="flex items-center gap-1.5"><Award className="w-3.5 h-3.5 text-primary" /> {isRu ? '10+ лет тренерства' : '10+ years coaching'}</span>
            <span className="flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-primary" /> Certified Animal Flow instructor</span>
            <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-primary" /> Limassol & online</span>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 mb-8">
            <Button size="lg" onClick={() => scrollToForm()} className="font-display tracking-wider text-base group">
              {isRu ? 'Занять место в потоке' : 'Claim your spot'}
              <ArrowRight className="w-4 h-4 ml-1 transition-transform group-hover:translate-x-1" />
            </Button>
            <Button size="lg" variant="outline" onClick={scrollToProgram} className="font-display tracking-wider text-base">
              <PlayCircle className="w-4 h-4 mr-2" />
              {isRu ? 'Программа курса' : 'See the program'}
            </Button>
          </div>

          {/* Video preview placeholder — Masterclass cinematic frame */}
          <div className="relative aspect-video rounded-3xl border border-border/60 bg-card overflow-hidden group">
            <video
              src={heroVideoAsset.url}
              poster={heroPosterAsset.url}
              autoPlay
              loop
              muted
              playsInline
              preload="metadata"
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background/70 via-transparent to-transparent pointer-events-none" />
            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-[10px] uppercase tracking-widest text-white/80">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                {isRu ? 'Live · Sunset flow' : 'Live · Sunset flow'}
              </span>
              <span>Cyprus · 2024</span>
            </div>
          </div>

          {/* Scarcity bar */}
          <div className="mt-6 p-4 rounded-2xl border border-primary/30 bg-card/60 backdrop-blur">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="flex items-center gap-1.5 text-foreground font-semibold">
                <Users className="w-3.5 h-3.5 text-primary" />
                {isRu ? `Founding · ${FOUNDING_TAKEN} из ${FOUNDING_TOTAL} мест` : `Founding · ${FOUNDING_TAKEN}/${FOUNDING_TOTAL} spots`}
              </span>
              <span className="text-primary font-bold">{isRu ? `${spotsLeft} мест` : `${spotsLeft} left`}</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-gradient-to-r from-primary to-primary/60 rounded-full" style={{ width: `${progressPct}%` }} />
            </div>
            <p className="text-[11px] text-muted-foreground mt-2 flex items-center gap-1.5">
              <Clock className="w-3 h-3" />
              {isRu ? 'Цена €149 / €299 действует до закрытия группы. Дальше — выше.' : 'Founding price €149 / €299 holds until the group closes. Then up.'}
            </p>
          </div>
        </div>
      </div>

      {/* ───────────────────────── MARQUEE TAPE ───────────────────────── */}
      <div className="relative border-y border-border/60 bg-primary text-primary-foreground overflow-hidden py-3">
        <div className="flex gap-8 whitespace-nowrap animate-[scroll_30s_linear_infinite] will-change-transform">
          {[...tape, ...tape, ...tape].map((t, i) => (
            <span key={i} className="font-display text-2xl tracking-widest flex items-center gap-8">
              {t}
              <span className="w-2 h-2 rounded-full bg-primary-foreground/60" />
            </span>
          ))}
        </div>
        <style>{`@keyframes scroll { from { transform: translateX(0); } to { transform: translateX(-33.33%); } }`}</style>
      </div>

      {/* ───────────────────────── STATS BY THE NUMBERS ───────────────────────── */}
      <div className="px-5 py-14">
        <div className="max-w-3xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-px bg-border/60 rounded-3xl overflow-hidden border border-border/60">
          {[
            { v: '6', l: isRu ? 'недель' : 'weeks' },
            { v: '30+', l: isRu ? 'уроков' : 'lessons' },
            { v: '3×', l: isRu ? 'в неделю' : 'per week' },
            { v: '15–35', l: isRu ? 'минут' : 'minutes' },
          ].map((s, i) => (
            <div key={i} className="bg-background p-5 text-center">
              <div className="font-display text-4xl sm:text-5xl text-primary leading-none">{s.v}</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-widest mt-2">{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ───────────────────────── PROBLEM ───────────────────────── */}
      <div className="px-5 py-14 bg-muted/20">
        <div className="max-w-3xl mx-auto">
          <span className="text-[10px] uppercase tracking-widest text-primary font-semibold">{isRu ? '01 · Контекст' : '01 · Context'}</span>
          <h2 className="font-display text-4xl sm:text-5xl tracking-tight mt-2 mb-7 leading-[0.95]">
            {isRu ? 'ТЕЛО СОЗДАНО ДВИГАТЬСЯ — А НЕ ПОВТОРЯТЬ' : 'YOUR BODY WAS BUILT TO MOVE — NOT REPEAT'}
          </h2>
          <ul className="space-y-3 text-base text-foreground/80">
            {(isRu
              ? [
                  'Чувствуешь скованность в бёдрах, спине или плечах.',
                  'Зал стал однообразным.',
                  'Хочешь лучше мобильность, но не знаешь, с чего начать.',
                  'Хочешь двигаться с контролем и уверенностью.',
                  'Нужна структура, а не случайные ролики из Instagram.',
                  'Хочешь тренироваться где угодно, без оборудования.',
                ]
              : [
                  'You feel stiff in hips, back or shoulders.',
                  'Regular gym workouts feel repetitive.',
                  'You want better mobility but don\'t know where to start.',
                  'You want to move with more control and confidence.',
                  'You want structure, not random Instagram clips.',
                  'You want to train anywhere, with no equipment.',
                ]
            ).map((t, i) => (
              <li key={i} className="flex gap-3 items-start border-b border-border/40 pb-3">
                <span className="font-display text-primary text-sm pt-1 w-6">{String(i + 1).padStart(2, '0')}</span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* ───────────────────────── PULL QUOTE ───────────────────────── */}
      <div className="px-5 py-16 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,hsl(var(--primary)/0.12),transparent_60%)]" />
        <div className="relative max-w-3xl mx-auto">
          <Quote className="w-10 h-10 text-primary/40 mb-4" />
          <p className="font-display text-3xl sm:text-4xl leading-[1.1] tracking-tight">
            {isRu
              ? '«Мобильность — это не растяжка. Это право твоего тела свободно выбирать любое движение.»'
              : '"Mobility isn\'t stretching. It\'s your body\'s right to choose any movement freely."'}
          </p>
          <div className="mt-5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center font-display text-primary">II</div>
            <div className="text-xs">
              <div className="font-semibold">Illarion Ientin</div>
              <div className="text-muted-foreground">{isRu ? 'Создатель программы' : 'Program creator'}</div>
            </div>
          </div>
        </div>
      </div>

      {/* ───────────────────────── TRANSFORMATION ───────────────────────── */}
      <div className="px-5 py-14 bg-muted/20">
        <div className="max-w-3xl mx-auto">
          <span className="text-[10px] uppercase tracking-widest text-primary font-semibold">{isRu ? '02 · Результат' : '02 · Outcome'}</span>
          <h2 className="font-display text-4xl sm:text-5xl tracking-tight mt-2 mb-7 leading-[0.95]">
            {isRu ? 'ОТ — К' : 'FROM — TO'}
          </h2>
          <div className="space-y-3">
            {transformations.map((t, i) => (
              <div key={i} className="grid grid-cols-[1fr_auto_1fr] gap-3 items-center p-4 sm:p-5 rounded-2xl border border-border/60 bg-card/50 hover:border-primary/40 transition-colors">
                <div className="text-sm text-muted-foreground line-through decoration-destructive/60">{t.before}</div>
                <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                  <ArrowRight className="w-4 h-4 text-primary" />
                </div>
                <div className="text-sm text-foreground font-medium">{t.after}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ───────────────────────── BENEFITS BENTO ───────────────────────── */}
      <div className="px-5 py-14">
        <div className="max-w-3xl mx-auto">
          <span className="text-[10px] uppercase tracking-widest text-primary font-semibold">{isRu ? '03 · Что получишь' : '03 · What you gain'}</span>
          <h2 className="font-display text-4xl sm:text-5xl tracking-tight mt-2 mb-7 leading-[0.95]">
            {isRu ? 'ШЕСТЬ КАЧЕСТВ ДВИЖЕНИЯ' : 'SIX QUALITIES OF MOVEMENT'}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {benefits.map((b, i) => (
              <div
                key={i}
                className={`relative p-5 rounded-2xl border bg-card/50 backdrop-blur overflow-hidden group hover:border-primary/50 transition-all ${
                  i === 0 ? 'col-span-2 sm:col-span-2 border-primary/30 bg-gradient-to-br from-primary/10 to-card/50' : 'border-border/60'
                }`}
              >
                <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-primary/10 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative">
                  <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center mb-3">
                    <b.icon className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="font-display text-xl tracking-tight mb-1">{b.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{b.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ───────────────────────── FOR WHOM ───────────────────────── */}
      <div className="px-5 py-14 bg-muted/20">
        <div className="max-w-3xl mx-auto">
          <span className="text-[10px] uppercase tracking-widest text-primary font-semibold">{isRu ? '04 · Для кого' : '04 · For whom'}</span>
          <h2 className="font-display text-4xl sm:text-5xl tracking-tight mt-2 mb-7 leading-[0.95]">
            {isRu ? 'ЭТО ТВОЁ — ИЛИ НЕТ' : 'IS IT YOURS — OR NOT'}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-5 rounded-2xl border border-primary/40 bg-gradient-to-br from-primary/10 to-transparent">
              <div className="flex items-center gap-2 mb-3">
                <Check className="w-4 h-4 text-primary" />
                <span className="font-display text-sm uppercase tracking-wider text-primary">{isRu ? 'Для тебя, если' : 'For you if'}</span>
              </div>
              <ul className="space-y-2 text-sm">
                {forYou.map((t) => (
                  <li key={t} className="flex gap-2 items-start">
                    <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="p-5 rounded-2xl border border-border/60 bg-card/50">
              <div className="flex items-center gap-2 mb-3">
                <X className="w-4 h-4 text-muted-foreground" />
                <span className="font-display text-sm uppercase tracking-wider text-muted-foreground">{isRu ? 'Не для тебя, если' : 'Not for you if'}</span>
              </div>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {notForYou.map((t) => (
                  <li key={t} className="flex gap-2 items-start">
                    <X className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* ───────────────────────── CURRICULUM — MasterClass episode list ───────────────────────── */}
      <div ref={programRef} className="px-5 py-14">
        <div className="max-w-3xl mx-auto">
          <span className="text-[10px] uppercase tracking-widest text-primary font-semibold">{isRu ? '05 · Программа' : '05 · Curriculum'}</span>
          <h2 className="font-display text-4xl sm:text-5xl tracking-tight mt-2 mb-2 leading-[0.95]">
            {isRu ? 'ШЕСТЬ НЕДЕЛЬ · ШЕСТЬ ГЛАВ' : 'SIX WEEKS · SIX CHAPTERS'}
          </h2>
          <p className="text-sm text-muted-foreground mb-7">{isRu ? 'Каждая глава — конкретный результат, а не список упражнений.' : 'Every chapter ends with a concrete outcome, not just an exercise list.'}</p>

          <div className="border border-border/60 rounded-3xl overflow-hidden bg-card/40 backdrop-blur divide-y divide-border/60">
            {weeks.map((w) => (
              <div key={w.n} className="group p-5 hover:bg-primary/5 transition-colors">
                <div className="flex items-start gap-5">
                  <div className="flex flex-col items-center shrink-0 w-12">
                    <span className="font-display text-3xl text-primary leading-none">{String(w.n).padStart(2, '0')}</span>
                    <span className="text-[9px] uppercase tracking-widest text-muted-foreground mt-1">Week</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-display text-xl tracking-tight mb-1 group-hover:text-primary transition-colors">{w.title}</h3>
                    <p className="text-sm text-muted-foreground mb-3">{w.desc}</p>
                    <div className="flex gap-2 items-start text-xs p-2.5 rounded-lg bg-primary/5 border border-primary/20">
                      <Target className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                      <span className="text-foreground/90">{w.outcome}</span>
                    </div>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-muted-foreground shrink-0 group-hover:text-primary group-hover:rotate-45 transition-all" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ───────────────────────── COMPARISON TABLE ───────────────────────── */}
      <div className="px-5 py-14 bg-muted/20">
        <div className="max-w-3xl mx-auto">
          <span className="text-[10px] uppercase tracking-widest text-primary font-semibold">{isRu ? '06 · Сравнение' : '06 · Compare'}</span>
          <h2 className="font-display text-4xl sm:text-5xl tracking-tight mt-2 mb-7 leading-[0.95]">
            {isRu ? 'ПОЧЕМУ ИМЕННО ЭТО' : 'WHY THIS, NOT THAT'}
          </h2>
          <div className="border border-border/60 rounded-2xl overflow-hidden bg-card/40">
            <div className="grid grid-cols-[1.4fr_1fr_1fr_1fr] text-[10px] uppercase tracking-widest bg-muted/30 border-b border-border/60">
              <div className="p-3 text-muted-foreground"> </div>
              <div className="p-3 text-center text-muted-foreground">{isRu ? 'YouTube' : 'YouTube'}</div>
              <div className="p-3 text-center text-muted-foreground">{isRu ? '1-на-1' : '1-on-1'}</div>
              <div className="p-3 text-center text-primary font-bold">{isRu ? 'Эта программа' : 'This'}</div>
            </div>
            {compareRows.map((r, i) => (
              <div key={i} className={`grid grid-cols-[1.4fr_1fr_1fr_1fr] text-xs ${i % 2 ? 'bg-background/40' : ''} border-b border-border/40 last:border-0`}>
                <div className="p-3 font-medium">{r.label}</div>
                <div className="p-3 text-center text-muted-foreground">{typeof r.self === 'boolean' ? (r.self ? <Check className="w-4 h-4 inline" /> : <X className="w-4 h-4 inline opacity-40" />) : r.self}</div>
                <div className="p-3 text-center text-muted-foreground">{typeof r.pt === 'boolean' ? (r.pt ? <Check className="w-4 h-4 inline" /> : <X className="w-4 h-4 inline opacity-40" />) : r.pt}</div>
                <div className="p-3 text-center font-bold text-primary">
                  {r.mine === 'premium' ? (isRu ? 'Premium' : 'Premium') : typeof r.mine === 'boolean' ? (r.mine ? <Check className="w-4 h-4 inline" /> : <X className="w-4 h-4 inline opacity-40" />) : r.mine}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ───────────────────────── PRICING ───────────────────────── */}
      <div className="px-5 py-14">
        <div className="max-w-3xl mx-auto">
          <span className="text-[10px] uppercase tracking-widest text-primary font-semibold">{isRu ? '07 · Тарифы' : '07 · Pricing'}</span>
          <h2 className="font-display text-4xl sm:text-5xl tracking-tight mt-2 mb-2 leading-[0.95]">
            {isRu ? 'ВЫБЕРИ СВОЙ ВХОД' : 'CHOOSE YOUR ENTRY'}
          </h2>
          <p className="text-xs text-muted-foreground mb-7">
            {isRu ? 'Для контекста: одна персональная сессия с Илларионом стоит €80. Здесь — 6 недель структуры.' : 'For context: one private session with Illarion is €80. This is 6 weeks of structured training.'}
          </p>
          <div className="grid grid-cols-1 gap-4">
            {/* Basic */}
            <div className="p-6 rounded-3xl border border-border/60 bg-card/50">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-display text-2xl tracking-tight">BASIC</h3>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">{isRu ? 'Самостоятельно' : 'Self-paced'}</p>
                </div>
                <div className="text-right">
                  <div className="font-display text-4xl leading-none">€149</div>
                  <div className="text-[10px] text-muted-foreground mt-1">{isRu ? '€25/нед' : '€25/week'}</div>
                </div>
              </div>
              <ul className="space-y-2 text-sm mb-5">
                {(isRu
                  ? ['Доступ к 6-недельной программе', '30+ видеоуроков', 'PDF-гайд', 'Недельный план', 'Доступ на 6 месяцев', 'Участие в founding group']
                  : ['6-week course access', '30+ video lessons', 'PDF guide', 'Weekly plan', '6 months access', 'Founding group access']
                ).map((t) => (
                  <li key={t} className="flex gap-2 items-start">
                    <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
              <Button variant="outline" className="w-full font-display tracking-wider" onClick={() => scrollToForm('basic')}>
                {isRu ? 'Выбрать Basic' : 'Choose Basic'}
              </Button>
            </div>

            {/* Premium */}
            <div className="relative p-[1.5px] rounded-3xl bg-gradient-to-br from-primary via-primary/40 to-primary/0 overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/0.3),transparent_60%)]" />
              <div className="relative p-6 rounded-[calc(1.5rem-1.5px)] bg-card">
                <div className="absolute -top-3 right-6 px-3 py-1 rounded-full bg-primary text-primary-foreground text-[10px] uppercase tracking-widest font-bold flex items-center gap-1">
                  <Star className="w-3 h-3 fill-current" />
                  {isRu ? 'Выбор большинства' : 'Most chosen'}
                </div>
                <div className="flex items-start justify-between mb-3 mt-2">
                  <div>
                    <h3 className="font-display text-2xl tracking-tight text-primary">PREMIUM</h3>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">{isRu ? 'С обратной связью' : 'With coaching'}</p>
                  </div>
                  <div className="text-right">
                    <div className="font-display text-4xl leading-none">€299</div>
                    <div className="text-[10px] text-muted-foreground mt-1">{isRu ? '€50/нед' : '€50/week'}</div>
                  </div>
                </div>
                <ul className="space-y-2 text-sm mb-4">
                  {(isRu
                    ? ['Всё из Basic', 'Закрытая Telegram/WhatsApp группа', '1 live session в неделю', '1 video feedback от Иллариона', 'Ответы на вопросы', 'Рекомендации по прогрессиям']
                    : ['Everything in Basic', 'Private Telegram/WhatsApp group', '1 live session per week', '1 video feedback from Illarion', 'Q&A support', 'Progression recommendations']
                  ).map((t) => (
                    <li key={t} className="flex gap-2 items-start">
                      <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
                <div className="p-3 rounded-xl bg-primary/10 border border-primary/30 mb-5 space-y-1.5">
                  <div className="text-[10px] uppercase tracking-widest text-primary font-bold flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3" /> {isRu ? 'Бонусы founding group' : 'Founding bonuses'}
                  </div>
                  <div className="text-xs flex gap-2 items-start"><Sparkles className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" /><span>{isRu ? 'Mobility-аудит на старте (15 мин Zoom)' : 'Personal mobility audit (15 min Zoom)'}</span></div>
                  <div className="text-xs flex gap-2 items-start"><Sparkles className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" /><span>{isRu ? 'Скидка 30% на Cyprus Flow & Performance Camp' : '30% off Cyprus Flow & Performance Camp'}</span></div>
                  <div className="text-xs flex gap-2 items-start"><Sparkles className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" /><span>{isRu ? 'Фикс цены навсегда — €299 на любой будущий запуск' : 'Lifetime price lock — €299 for any future cohort'}</span></div>
                </div>
                <Button className="w-full font-display tracking-wider" onClick={() => scrollToForm('premium')}>
                  {isRu ? 'Выбрать Premium' : 'Choose Premium'}
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          </div>

          {/* Risk reversal */}
          <div className="mt-6 p-5 rounded-2xl border border-primary/30 bg-card/50 flex gap-4 items-start">
            <div className="w-12 h-12 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h3 className="font-display text-lg tracking-tight mb-1">{isRu ? '7-ДНЕВНАЯ ГАРАНТИЯ ВОЗВРАТА' : '7-DAY MONEY-BACK GUARANTEE'}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {isRu
                  ? 'Попробуй первую неделю. Если не подходит — напиши на почту в течение 7 дней с момента старта, и я верну 100% оплаты. Без вопросов.'
                  : 'Try the first week. If not for you, email me within 7 days of the start — I refund 100%. No questions asked.'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ───────────────────────── ABOUT — Founder signature ───────────────────────── */}
      <div className="px-5 py-14 bg-muted/20">
        <div className="max-w-3xl mx-auto">
          <span className="text-[10px] uppercase tracking-widest text-primary font-semibold">{isRu ? '08 · Автор' : '08 · Founder'}</span>
          <h2 className="font-display text-4xl sm:text-5xl tracking-tight mt-2 mb-7 leading-[0.95]">
            {isRu ? 'КТО ВЕДЁТ КУРС' : 'WHO LEADS THIS'}
          </h2>
          <div className="rounded-3xl border border-border/60 bg-card/50 overflow-hidden">
            <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr]">
              <div className="relative aspect-square sm:aspect-auto bg-gradient-to-br from-primary/20 via-primary/5 to-muted/40 overflow-hidden">
                <img
                  src={trainerPhoto}
                  alt="Illarion Ientin"
                  className="absolute inset-0 w-full h-full object-cover"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-tr from-background/40 via-transparent to-transparent" />
              </div>
              <div className="p-6 space-y-3 text-sm leading-relaxed">
                <div>
                  <div className="font-display text-2xl tracking-tight">ILLARION IENTIN</div>
                  <div className="text-xs text-muted-foreground uppercase tracking-widest mt-1">{isRu ? 'Functional movement coach · Limassol' : 'Functional movement coach · Limassol'}</div>
                </div>
                <p className="text-foreground/85">
                  {isRu
                    ? '10+ лет тренерства. Работает с предпринимателями и людьми, которым важны сила, мобильность и качество движения.'
                    : '10+ years coaching. Works with entrepreneurs and performance-driven people who care about strength, mobility and movement quality.'}
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {['Animal Flow', 'TRX', 'Procedos', 'HYROX', 'Mobility'].map((tag) => (
                    <span key={tag} className="px-2 py-1 rounded-full bg-primary/10 border border-primary/30 text-[10px] uppercase tracking-wider text-primary">{tag}</span>
                  ))}
                </div>
                <div className="pt-2 text-xs text-muted-foreground border-t border-border/40 mt-3">
                  {isRu
                    ? 'Сертифицированный Animal Flow instructor. Эта программа — авторская система ground movement, не официальная сертификация Animal Flow.'
                    : 'Certified Animal Flow instructor. This program is an original ground movement system, not an official Animal Flow certification.'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ───────────────────────── FAQ ───────────────────────── */}
      <div className="px-5 py-14">
        <div className="max-w-3xl mx-auto">
          <span className="text-[10px] uppercase tracking-widest text-primary font-semibold">{isRu ? '09 · Вопросы' : '09 · Questions'}</span>
          <h2 className="font-display text-4xl sm:text-5xl tracking-tight mt-2 mb-7 leading-[0.95]">FAQ</h2>
          <div className="space-y-2">
            {faqs.map((f, i) => (
              <div key={i} className={`rounded-2xl border bg-card/50 overflow-hidden transition-colors ${openFaq === i ? 'border-primary/40' : 'border-border/60'}`}>
                <button
                  type="button"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between p-4 text-left gap-3"
                >
                  <span className="font-semibold text-sm">{f.q}</span>
                  <ChevronDown className={`w-4 h-4 shrink-0 text-muted-foreground transition-transform ${openFaq === i ? 'rotate-180 text-primary' : ''}`} />
                </button>
                {openFaq === i && (
                  <div className="px-4 pb-4 text-sm text-muted-foreground leading-relaxed">{f.a}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ───────────────────────── FORM ───────────────────────── */}
      <div ref={formRef} className="px-5 py-14 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.18),transparent_70%)]" />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-primary/15 blur-3xl" />
        <div className="relative max-w-xl mx-auto">
          <span className="text-[10px] uppercase tracking-widest text-primary font-semibold">{isRu ? '10 · Заявка' : '10 · Apply'}</span>
          <h2 className="font-display text-4xl sm:text-5xl tracking-tight mt-2 mb-3 leading-[0.95]">
            {isRu ? 'ГОТОВ ДВИГАТЬСЯ ЛУЧШЕ?' : 'READY TO MOVE BETTER?'}
          </h2>
          <p className="text-sm text-muted-foreground mb-6 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            {isRu
              ? `Founding group · осталось ${spotsLeft} мест. После заявки Илларион свяжется лично.`
              : `Founding group · ${spotsLeft} spots left. Illarion will reach out personally after your application.`}
          </p>

          {submitted ? (
            <div className="p-8 rounded-3xl border border-primary/40 bg-primary/10 text-center">
              <div className="w-14 h-14 mx-auto rounded-full bg-primary flex items-center justify-center mb-4 shadow-xl shadow-primary/30">
                <Check className="w-7 h-7 text-primary-foreground" />
              </div>
              <h3 className="font-display text-3xl mb-2">{isRu ? 'СПАСИБО!' : 'THANK YOU!'}</h3>
              <p className="text-sm text-muted-foreground">
                {isRu
                  ? 'Заявка получена. Илларион свяжется с тобой по следующим шагам для founding group.'
                  : 'Your application has been received. Illarion will contact you with the next steps for the founding group.'}
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 p-5 sm:p-6 rounded-3xl border border-border/60 bg-card/80 backdrop-blur-xl shadow-2xl shadow-primary/10">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPkg('basic')}
                  className={`p-3 rounded-xl border text-sm font-semibold transition ${pkg === 'basic' ? 'border-primary bg-primary/15 text-primary' : 'border-border bg-muted/30 text-muted-foreground'}`}
                >
                  Basic — €149
                </button>
                <button
                  type="button"
                  onClick={() => setPkg('premium')}
                  className={`p-3 rounded-xl border text-sm font-semibold transition ${pkg === 'premium' ? 'border-primary bg-primary/15 text-primary' : 'border-border bg-muted/30 text-muted-foreground'}`}
                >
                  Premium — €299
                </button>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="name">{isRu ? 'Имя' : 'Name'} *</Label>
                <Input id="name" required maxLength={120} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email *</Label>
                <Input id="email" type="email" required maxLength={255} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="whatsapp">WhatsApp</Label>
                <Input id="whatsapp" maxLength={50} placeholder="+357..." value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>{isRu ? 'Язык' : 'Language'}</Label>
                  <Select value={form.preferred_language} onValueChange={(v) => setForm({ ...form, preferred_language: v })}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="ru">Русский</SelectItem>
                      <SelectItem value="uk">Українська</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>{isRu ? 'Уровень' : 'Level'}</Label>
                  <Select value={form.fitness_level} onValueChange={(v) => setForm({ ...form, fitness_level: v })}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="beginner">{isRu ? 'Начинающий' : 'Beginner'}</SelectItem>
                      <SelectItem value="intermediate">{isRu ? 'Средний' : 'Intermediate'}</SelectItem>
                      <SelectItem value="advanced">{isRu ? 'Продвинутый' : 'Advanced'}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="goal">{isRu ? 'Главная цель' : 'Main goal'}</Label>
                <Textarea id="goal" rows={2} maxLength={500} value={form.main_goal} onChange={(e) => setForm({ ...form, main_goal: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="inj">{isRu ? 'Травмы / ограничения' : 'Injuries / limitations'}</Label>
                <Textarea id="inj" rows={2} maxLength={500} value={form.injuries_limitations} onChange={(e) => setForm({ ...form, injuries_limitations: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ref">{isRu ? 'Откуда узнал о программе?' : 'How did you hear about this program?'}</Label>
                <Input id="ref" maxLength={200} value={form.referral_source} onChange={(e) => setForm({ ...form, referral_source: e.target.value })} />
              </div>

              <Button type="submit" size="lg" className="w-full font-display tracking-wider text-base" disabled={submitting}>
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : (isRu ? 'Отправить заявку' : 'Submit application')}
              </Button>
              <p className="text-[11px] text-muted-foreground text-center flex items-center justify-center gap-1.5">
                <ShieldCheck className="w-3 h-3" />
                {isRu ? '7-дневная гарантия возврата средств' : '7-day money-back guarantee'}
              </p>
            </form>
          )}
        </div>
      </div>

      {/* Sticky bottom CTA */}
      {showStickyCta && (
        <div className="fixed left-0 right-0 bottom-16 z-40 px-3 pointer-events-none animate-in fade-in slide-in-from-bottom-4" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
          <div className="max-w-md mx-auto pointer-events-auto rounded-2xl border border-primary/40 bg-card/95 backdrop-blur-xl shadow-2xl shadow-primary/20 p-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="text-[10px] uppercase tracking-widest text-primary font-semibold">{isRu ? `${spotsLeft} мест осталось` : `${spotsLeft} spots left`}</div>
              <div className="text-xs text-foreground/90 truncate">{isRu ? 'Ground Movement & Flow · от €149' : 'Ground Movement & Flow · from €149'}</div>
            </div>
            <Button size="sm" onClick={() => scrollToForm()} className="font-display tracking-wider shrink-0">
              {isRu ? 'Записаться' : 'Join'}
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </section>
  );
};

export default ShopSection;
