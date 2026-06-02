import { useState, useRef, useEffect } from 'react';
import {
  Activity,
  ArrowRight,
  Check,
  ChevronDown,
  Loader2,
  ShoppingBag,
  Sparkles,
  Target,
  Waves,
  Zap,
  Shield,
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

const ShopSection = () => {
  const { lang } = useLanguage();
  const { toast } = useToast();
  const formRef = useRef<HTMLDivElement>(null);
  const programRef = useRef<HTMLDivElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [pkg, setPkg] = useState<PackageId>('basic');
  const [openFaq, setOpenFaq] = useState<number | null>(0);
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

  useEffect(() => {
    setOpenFaq(0);
  }, []);

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
    },
    {
      n: 2,
      title: isRu ? 'Quadruped: контроль в низкой позиции' : 'Quadruped Control',
      desc: isRu ? 'Сила и контроль в низких опорных позициях.' : 'Build strength and control in low positions.',
    },
    {
      n: 3,
      title: isRu ? 'Crab: задняя цепь и плечи' : 'Crab / Posterior Chain',
      desc: isRu ? 'Раскрытие плеч, активация ягодиц, обратная опора.' : 'Open shoulders, activate glutes, build reverse support.',
    },
    {
      n: 4,
      title: isRu ? 'Низкий присед и ape-style movement' : 'Low Squat & Ape-style Movement',
      desc: isRu ? 'Бёдра, голеностопы, латеральное движение и координация.' : 'Hips, ankles, lateral movement and coordination.',
    },
    {
      n: 5,
      title: isRu ? 'Переходы и сборка flow' : 'Transitions & Flow Building',
      desc: isRu ? 'Соединяем движения в короткие последовательности.' : 'Connect movements into short sequences.',
    },
    {
      n: 6,
      title: isRu ? 'Полный flow и финальный тест' : 'Full Flow Practice',
      desc: isRu ? 'Собираем итоговый flow и оцениваем прогресс.' : 'Build your final flow and test your progress.',
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

  return (
    <section className="min-h-screen bg-background text-foreground pb-28">
      {/* Trainer-only badge */}
      <div className="px-5 pt-5">
        <div className="max-w-2xl mx-auto flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
          <Shield className="w-3 h-3" />
          <span>{isRu ? 'Тренерский предпросмотр • виден только тебе' : 'Trainer preview • visible only to you'}</span>
        </div>
      </div>

      {/* HERO */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/10 via-transparent to-transparent pointer-events-none" />
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-primary/20 blur-3xl pointer-events-none" />
        <div className="relative max-w-2xl mx-auto px-5 pt-10 pb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/40 bg-primary/10 text-primary text-[10px] uppercase tracking-widest mb-5">
            <ShoppingBag className="w-3 h-3" />
            {isRu ? 'Founding group • Первый поток' : 'Founding group • First cohort'}
          </div>
          <h1 className="font-display text-5xl sm:text-6xl leading-[0.95] tracking-tight mb-4">
            GROUND MOVEMENT
            <br />
            <span className="text-primary">& FLOW SYSTEM</span>
          </h1>
          <p className="text-base text-muted-foreground leading-relaxed mb-2">
            {isRu
              ? '6-недельная онлайн-программа для развития мобильности, координации, контроля тела и свободного движения через работу с собственным весом, ground movement и flow.'
              : 'A 6-week online program to improve mobility, coordination and body control through ground-based bodyweight movement and flow training.'}
          </p>
          <p className="text-xs text-muted-foreground/70 mb-7">
            {isRu ? 'Автор: Илларион Иентин • Limassol, Cyprus' : 'By Illarion Ientin • Limassol, Cyprus'}
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button size="lg" onClick={() => scrollToForm()} className="font-display tracking-wider text-base">
              {isRu ? 'Записаться в первый поток' : 'Join the first group'}
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
            <Button size="lg" variant="outline" onClick={scrollToProgram} className="font-display tracking-wider text-base">
              {isRu ? 'Программа курса' : 'See the program'}
            </Button>
          </div>
          <div className="aspect-video mt-8 rounded-2xl border border-border/50 bg-gradient-to-br from-muted/40 to-muted/10 flex items-center justify-center text-muted-foreground text-xs uppercase tracking-widest">
            {isRu ? 'Видео-превью • скоро' : 'Video preview • coming soon'}
          </div>
        </div>
      </div>

      {/* PROBLEM */}
      <div className="px-5 py-12 bg-muted/20">
        <div className="max-w-2xl mx-auto">
          <h2 className="font-display text-3xl sm:text-4xl tracking-tight mb-6">
            {isRu ? 'ТЕЛО СОЗДАНО ДВИГАТЬСЯ — А НЕ ТОЛЬКО СИДЕТЬ И ПОВТОРЯТЬ' : 'YOUR BODY WAS BUILT TO MOVE — NOT JUST SIT, LIFT AND REPEAT'}
          </h2>
          <ul className="space-y-3 text-sm text-muted-foreground">
            {(isRu
              ? [
                  'Чувствуешь скованность в бёдрах, спине или плечах.',
                  'Обычные тренировки в зале стали однообразными.',
                  'Хочешь лучше мобильность, но не знаешь, с чего начать.',
                  'Хочешь двигаться с контролем и уверенностью.',
                  'Нужна структура, а не случайные упражнения из Instagram.',
                  'Хочешь тренироваться где угодно, без оборудования.',
                ]
              : [
                  'You feel stiff in your hips, back or shoulders.',
                  'Regular gym workouts feel repetitive.',
                  'You want better mobility but don\'t know what to do.',
                  'You want to move with more control and confidence.',
                  'You want a structured system, not random exercises from Instagram.',
                  'You want to train anywhere, without equipment.',
                ]
            ).map((t, i) => (
              <li key={i} className="flex gap-3">
                <span className="text-primary mt-1">—</span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* SOLUTION */}
      <div className="px-5 py-12">
        <div className="max-w-2xl mx-auto">
          <h2 className="font-display text-3xl sm:text-4xl tracking-tight mb-4">
            {isRu ? 'СТРУКТУРНАЯ СИСТЕМА ДВИЖЕНИЯ' : 'A STRUCTURED MOVEMENT SYSTEM'}
          </h2>
          <p className="text-base text-muted-foreground leading-relaxed">
            {isRu
              ? 'Ground Movement & Flow System — 6-недельная онлайн-программа, которая учит строить более сильное, мобильное и координированное тело через ground-based bodyweight movement. Начинаешь с базы, подготовки суставов и базовых позиций, потом переходишь к переходам и коротким flow-комбинациям.'
              : 'A 6-week online program that teaches you how to build a stronger, more mobile and coordinated body using ground-based bodyweight movement. Start with foundations, joint preparation and basic positions, then progress into transitions and short flow combinations.'}
          </p>
        </div>
      </div>

      {/* BENEFITS */}
      <div className="px-5 py-12 bg-muted/20">
        <div className="max-w-2xl mx-auto">
          <h2 className="font-display text-3xl sm:text-4xl tracking-tight mb-6">
            {isRu ? 'ЧТО ТЫ ПОЛУЧИШЬ' : 'WHAT YOU\'LL GAIN'}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {benefits.map((b, i) => (
              <div key={i} className="p-5 rounded-2xl border border-border/60 bg-card/50 backdrop-blur">
                <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center mb-3">
                  <b.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-display text-xl tracking-tight mb-1">{b.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* WHAT'S INSIDE */}
      <div className="px-5 py-12">
        <div className="max-w-2xl mx-auto">
          <h2 className="font-display text-3xl sm:text-4xl tracking-tight mb-6">
            {isRu ? 'ЧТО ВНУТРИ' : 'WHAT\'S INSIDE'}
          </h2>
          <div className="grid grid-cols-2 gap-3 mb-6">
            {[
              { v: '6', l: isRu ? 'недель' : 'weeks' },
              { v: '30+', l: isRu ? 'видеоуроков' : 'video lessons' },
              { v: '3', l: isRu ? 'сессии/неделя' : 'sessions/week' },
              { v: '15–35', l: isRu ? 'минут/сессия' : 'min/session' },
            ].map((s) => (
              <div key={s.l} className="p-4 rounded-2xl border border-border/60 bg-card/50 text-center">
                <div className="font-display text-3xl text-primary">{s.v}</div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider mt-1">{s.l}</div>
              </div>
            ))}
          </div>
          <ul className="space-y-2 text-sm">
            {(isRu
              ? [
                  'Подготовка запястий, плеч и бёдер',
                  'Основы ground movement',
                  'Flow-комбинации',
                  'PDF-гайд',
                  'Недельная прогрессия',
                  'Закрытая группа для founding cohort',
                  'Video feedback в Premium',
                ]
              : [
                  'Wrist, shoulder and hip preparation',
                  'Ground movement fundamentals',
                  'Flow combinations',
                  'PDF guide',
                  'Weekly progression',
                  'Private group for the founding cohort',
                  'Optional video feedback in Premium',
                ]
            ).map((t, i) => (
              <li key={i} className="flex gap-2 items-start">
                <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <span className="text-foreground/90">{t}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* CURRICULUM */}
      <div ref={programRef} className="px-5 py-12 bg-muted/20">
        <div className="max-w-2xl mx-auto">
          <h2 className="font-display text-3xl sm:text-4xl tracking-tight mb-6">
            {isRu ? 'ПРОГРАММА ПО НЕДЕЛЯМ' : 'CURRICULUM'}
          </h2>
          <div className="space-y-3">
            {weeks.map((w) => (
              <div key={w.n} className="p-5 rounded-2xl border border-border/60 bg-card/50">
                <div className="flex items-baseline gap-3 mb-1">
                  <span className="font-display text-4xl text-primary leading-none">{String(w.n).padStart(2, '0')}</span>
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Week</span>
                </div>
                <h3 className="font-display text-xl tracking-tight mt-2 mb-1">{w.title}</h3>
                <p className="text-sm text-muted-foreground">{w.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* PRICING */}
      <div className="px-5 py-12">
        <div className="max-w-2xl mx-auto">
          <h2 className="font-display text-3xl sm:text-4xl tracking-tight mb-6">
            {isRu ? 'ТАРИФЫ FOUNDING GROUP' : 'FOUNDING GROUP PRICING'}
          </h2>
          <div className="grid grid-cols-1 gap-4">
            {/* Basic */}
            <div className="p-6 rounded-2xl border border-border/60 bg-card/50">
              <div className="flex items-baseline justify-between mb-2">
                <h3 className="font-display text-2xl tracking-tight">BASIC</h3>
                <div className="font-display text-3xl">€149</div>
              </div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-4">{isRu ? 'Самостоятельно' : 'Self-paced'}</p>
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
              <Button className="w-full font-display tracking-wider" onClick={() => scrollToForm('basic')}>
                {isRu ? 'Выбрать Basic' : 'Choose Basic'}
              </Button>
            </div>

            {/* Premium */}
            <div className="p-6 rounded-2xl border-2 border-primary bg-gradient-to-br from-primary/10 to-card/50 relative">
              <div className="absolute -top-3 left-6 px-3 py-1 rounded-full bg-primary text-primary-foreground text-[10px] uppercase tracking-widest font-bold">
                {isRu ? 'С обратной связью' : 'With feedback'}
              </div>
              <div className="flex items-baseline justify-between mb-2 mt-2">
                <h3 className="font-display text-2xl tracking-tight text-primary">PREMIUM</h3>
                <div className="font-display text-3xl">€299</div>
              </div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-4">{isRu ? 'С контактом и обратной связью' : 'With coaching contact'}</p>
              <ul className="space-y-2 text-sm mb-5">
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
              <Button className="w-full font-display tracking-wider" onClick={() => scrollToForm('premium')}>
                {isRu ? 'Выбрать Premium' : 'Choose Premium'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* ABOUT */}
      <div className="px-5 py-12 bg-muted/20">
        <div className="max-w-2xl mx-auto">
          <h2 className="font-display text-3xl sm:text-4xl tracking-tight mb-6">
            {isRu ? 'ОБ ИЛЛАРИОНЕ' : 'ABOUT ILLARION'}
          </h2>
          <div className="p-6 rounded-2xl border border-border/60 bg-card/50 space-y-4 text-sm leading-relaxed">
            <p>
              {isRu
                ? 'Илларион Иентин — тренер по функциональному тренингу в Лимассоле, Кипр, с опытом работы более 10 лет. Он работает с премиальными клиентами, предпринимателями и людьми, которым важны сила, мобильность, качество движения и долгосрочная физическая форма.'
                : 'Illarion Ientin is a functional training coach based in Limassol, Cyprus, with over 10 years of coaching experience. He works with high-level private clients, entrepreneurs and performance-driven people who want to build strength, mobility and long-term physical capacity.'}
            </p>
            <p className="text-muted-foreground">
              {isRu
                ? 'Его подход сочетает функциональную силу, mobility, контроль тела, ground movement, опыт Animal Flow, TRX, Procedos и HYROX-style conditioning.'
                : 'His coaching combines functional strength, mobility, bodyweight control, ground movement, Animal Flow background, TRX, Procedos and HYROX-style conditioning.'}
            </p>
            <div className="p-3 rounded-xl bg-muted/40 border border-border/40 text-xs text-muted-foreground">
              {isRu
                ? 'Илларион — сертифицированный Animal Flow instructor. Эта программа является его авторской системой ground movement и не является официальной сертификацией Animal Flow.'
                : 'Illarion is a certified Animal Flow instructor. This program is his own ground-based movement system and is not an official Animal Flow certification.'}
            </div>
          </div>
        </div>
      </div>

      {/* FAQ */}
      <div className="px-5 py-12">
        <div className="max-w-2xl mx-auto">
          <h2 className="font-display text-3xl sm:text-4xl tracking-tight mb-6">FAQ</h2>
          <div className="space-y-2">
            {faqs.map((f, i) => (
              <div key={i} className="rounded-2xl border border-border/60 bg-card/50 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between p-4 text-left"
                >
                  <span className="font-semibold text-sm pr-3">{f.q}</span>
                  <ChevronDown className={`w-4 h-4 shrink-0 text-muted-foreground transition-transform ${openFaq === i ? 'rotate-180' : ''}`} />
                </button>
                {openFaq === i && (
                  <div className="px-4 pb-4 text-sm text-muted-foreground leading-relaxed">{f.a}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* FORM */}
      <div ref={formRef} className="px-5 py-12 bg-gradient-to-b from-primary/10 to-background">
        <div className="max-w-xl mx-auto">
          <h2 className="font-display text-3xl sm:text-4xl tracking-tight mb-3">
            {isRu ? 'ГОТОВ ДВИГАТЬСЯ ЛУЧШЕ?' : 'READY TO MOVE BETTER?'}
          </h2>
          <p className="text-sm text-muted-foreground mb-6">
            {isRu
              ? 'Запишись в первый founding group. После заявки Илларион свяжется с тобой по следующим шагам.'
              : 'Join the first founding group. After your application Illarion will reach out with the next steps.'}
          </p>

          {submitted ? (
            <div className="p-6 rounded-2xl border border-primary/40 bg-primary/10 text-center">
              <div className="w-12 h-12 mx-auto rounded-full bg-primary flex items-center justify-center mb-3">
                <Check className="w-6 h-6 text-primary-foreground" />
              </div>
              <h3 className="font-display text-2xl mb-2">{isRu ? 'СПАСИБО!' : 'THANK YOU!'}</h3>
              <p className="text-sm text-muted-foreground">
                {isRu
                  ? 'Заявка получена. Илларион свяжется с тобой по следующим шагам для founding group.'
                  : 'Your application has been received. Illarion will contact you with the next steps for the founding group.'}
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 p-5 rounded-2xl border border-border/60 bg-card/60 backdrop-blur">
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
            </form>
          )}
        </div>
      </div>
    </section>
  );
};

export default ShopSection;
