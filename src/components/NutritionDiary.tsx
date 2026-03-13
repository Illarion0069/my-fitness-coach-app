import { useState, useEffect, useRef, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Camera, Loader2, Trash2, Plus, Droplets, Coffee, Wine, Minus, Sparkles, Edit3 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';

interface NutritionLog {
  id: string;
  log_date: string;
  water_ml: number;
  coffee_cups: number;
  tea_cups: number;
  alcohol_ml: number;
  notes: string | null;
  ai_score: number | null;
  ai_feedback: string | null;
  ai_analysis: any | null;
  trainer_override_score: number | null;
  trainer_override_note: string | null;
}

interface FoodPhoto {
  id: string;
  log_date: string;
  photo_url: string;
  meal_note: string | null;
  meal_type: string;
  created_at: string;
}

interface Props {
  userId?: string;
  lang: string;
  isTrainer?: boolean;
}

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

const MAX_PHOTOS_PER_DAY = 8;
const MAX_ANALYSES_PER_DAY = 3;
const VALID_MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

const MEAL_TYPES: { key: MealType; labelRu: string; labelEn: string; emoji: string }[] = [
  { key: 'breakfast', labelRu: 'Завтрак', labelEn: 'Breakfast', emoji: '🌅' },
  { key: 'lunch', labelRu: 'Обед', labelEn: 'Lunch', emoji: '☀️' },
  { key: 'dinner', labelRu: 'Ужин', labelEn: 'Dinner', emoji: '🌙' },
  { key: 'snack', labelRu: 'Перекус', labelEn: 'Snack', emoji: '🍎' },
];

const Sparkline = ({ data, height = 32, width = 120 }: { data: number[]; height?: number; width?: number }) => {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(' ');
  const last = data[data.length - 1];
  const color = last >= 80 ? 'hsl(142, 71%, 45%)' : last >= 50 ? 'hsl(45, 93%, 47%)' : 'hsl(0, 84%, 60%)';
  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" points={points} />
      <circle cx={width} cy={height - ((last - min) / range) * (height - 4) - 2} r="2.5" fill={color} />
    </svg>
  );
};

const scoreColor = (s: number) => s >= 80 ? 'text-green-400' : s >= 50 ? 'text-yellow-400' : 'text-red-400';
const scoreBg = (s: number) => s >= 80 ? 'bg-green-500/15' : s >= 50 ? 'bg-yellow-500/15' : 'bg-red-500/15';
const scoreBarColor = (s: number) => s >= 80 ? 'bg-green-400' : s >= 50 ? 'bg-yellow-400' : 'bg-red-400';

const NutritionDiary = ({ userId, lang, isTrainer = false }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const effectiveUserId = userId || user?.id;
  const isReadOnly = !!userId && !isTrainer;

  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [log, setLog] = useState<NutritionLog | null>(null);
  const [photos, setPhotos] = useState<FoodPhoto[]>([]);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<FoodPhoto | null>(null);
  const [scoreHistory, setScoreHistory] = useState<{ date: string; score: number }[]>([]);
  const [showMealPicker, setShowMealPicker] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideScore, setOverrideScore] = useState('');
  const [overrideNote, setOverrideNote] = useState('');
  const [analysisCount, setAnalysisCount] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchData = async () => {
    if (!effectiveUserId) return;
    const [logRes, photosRes] = await Promise.all([
      supabase.from('nutrition_logs').select('*').eq('user_id', effectiveUserId).eq('log_date', date).maybeSingle(),
      supabase.from('food_photos').select('*').eq('user_id', effectiveUserId).eq('log_date', date).order('created_at', { ascending: true }),
    ]);
    setLog((logRes.data as NutritionLog) || null);
    setPhotos((photosRes.data as FoodPhoto[]) || []);
    
    // Track how many times analysis was run today (from ai_analysis metadata)
    const analysis = logRes.data?.ai_analysis;
    const analysisData = analysis as Record<string, any> | null;
    setAnalysisCount(analysisData?.analysis_count || (logRes.data?.ai_score != null ? 1 : 0));
  };

  const fetchScoreHistory = async () => {
    if (!effectiveUserId) return;
    const { data } = await supabase
      .from('nutrition_logs')
      .select('log_date, ai_score, trainer_override_score')
      .eq('user_id', effectiveUserId)
      .not('ai_score', 'is', null)
      .order('log_date', { ascending: true })
      .limit(30);
    setScoreHistory((data || []).map(d => ({ 
      date: d.log_date, 
      score: (d as any).trainer_override_score ?? d.ai_score! 
    })));
  };

  useEffect(() => { fetchData(); }, [effectiveUserId, date]);
  useEffect(() => { fetchScoreHistory(); }, [effectiveUserId]);

  const navigateDate = (dir: -1 | 1) => {
    const d = new Date(date + 'T00:00:00');
    d.setDate(d.getDate() + dir);
    const newDate = d.toISOString().split('T')[0];
    if (newDate > new Date().toISOString().split('T')[0]) return;
    setDate(newDate);
  };

  const isToday = date === new Date().toISOString().split('T')[0];

  const upsertLog = async (field: string, value: number) => {
    if (isReadOnly || !user) return;
    const payload = {
      user_id: user.id,
      log_date: date,
      water_ml: log?.water_ml || 0,
      coffee_cups: log?.coffee_cups || 0,
      tea_cups: log?.tea_cups || 0,
      alcohol_ml: log?.alcohol_ml || 0,
      [field]: Math.max(0, value),
    };
    if (log?.id) {
      const { data, error } = await supabase.from('nutrition_logs').update({ [field]: Math.max(0, value) }).eq('id', log.id).select().single();
      if (!error) setLog(data as NutritionLog);
    } else {
      const { data, error } = await supabase.from('nutrition_logs').insert(payload).select().single();
      if (!error) setLog(data as NutritionLog);
    }
  };

  const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'];

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      toast({ title: lang === 'en' ? 'Only image files allowed' : 'Только изображения (jpg, png, webp)', variant: 'destructive' });
      if (fileRef.current) fileRef.current.value = '';
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: lang === 'en' ? 'File too large (max 10MB)' : 'Файл слишком большой (макс 10МБ)', variant: 'destructive' });
      if (fileRef.current) fileRef.current.value = '';
      return;
    }
    if (photos.length >= MAX_PHOTOS_PER_DAY) {
      toast({ 
        title: lang === 'en' ? 'Photo limit reached' : 'Лимит фото достигнут', 
        description: lang === 'en' ? `Maximum ${MAX_PHOTOS_PER_DAY} photos per day` : `Максимум ${MAX_PHOTOS_PER_DAY} фото в день`,
        variant: 'destructive' 
      });
      if (fileRef.current) fileRef.current.value = '';
      return;
    }
    if (!file.type.startsWith('image/')) {
      toast({ title: lang === 'en' ? 'Only image files allowed' : 'Только изображения', variant: 'destructive' });
      if (fileRef.current) fileRef.current.value = '';
      return;
    }
    setPendingFile(file);
    setShowMealPicker(true);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleUploadWithMealType = async (mealType: MealType) => {
    if (!pendingFile || !user) return;
    // Validate meal_type
    if (!VALID_MEAL_TYPES.includes(mealType)) return;
    
    setShowMealPicker(false);
    setUploading(true);
    
    const ext = pendingFile.name.split('.').pop();
    const path = `${user.id}/${date}_${Date.now()}.${ext}`;
    
    try {
      // Upload to storage first
      const { error: uploadError } = await supabase.storage.from('food-photos').upload(path, pendingFile, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('food-photos').getPublicUrl(path);

      // Validate: is this actually food?
      const { data: validation, error: valError } = await supabase.functions.invoke('validate-food-photo', {
        body: { photo_url: publicUrl },
      });

      if (!valError && validation && !validation.is_food) {
        // Not food — delete from storage and notify
        await supabase.storage.from('food-photos').remove([path]);
        toast({
          title: lang === 'en' ? 'Not a food photo' : 'Это не фото еды',
          description: lang === 'en' ? 'Please upload a photo of food or a meal' : 'Загрузите фото еды или приёма пищи',
          variant: 'destructive',
        });
        setPendingFile(null);
        setUploading(false);
        return;
      }

      // Save to DB
      const { error: insertError } = await supabase.from('food_photos').insert({
        user_id: user.id,
        log_date: date,
        photo_url: publicUrl,
        meal_type: mealType,
      });
      
      if (insertError) {
        // DB insert failed — clean up orphaned storage file
        await supabase.storage.from('food-photos').remove([path]);
        throw insertError;
      }

      const mealLabel = MEAL_TYPES.find(m => m.key === mealType);
      toast({ title: `${mealLabel?.emoji} ${lang === 'en' ? 'Photo added' : 'Фото добавлено'} — ${lang === 'en' ? mealLabel?.labelEn : mealLabel?.labelRu}` });
      fetchData();
    } catch (err: any) {
      // Attempt cleanup on any error after upload
      try { await supabase.storage.from('food-photos').remove([path]); } catch {}
      toast({ title: lang === 'en' ? 'Error' : 'Ошибка', description: err.message, variant: 'destructive' });
    }
    setPendingFile(null);
    setUploading(false);
  };

  const handleDeletePhoto = async (photo: FoodPhoto) => {
    // Warn if analysis exists
    if (log?.ai_score != null) {
      const confirmed = window.confirm(
        lang === 'en' 
          ? 'Deleting this photo will invalidate the AI score. Continue?' 
          : 'Удаление фото сбросит AI-оценку. Продолжить?'
      );
      if (!confirmed) return;
    }
    try {
      const urlParts = photo.photo_url.split('/food-photos/');
      const storagePath = urlParts[1];
      if (storagePath) await supabase.storage.from('food-photos').remove([storagePath]);
      await supabase.from('food_photos').delete().eq('id', photo.id);
      
      // Invalidate AI score if analysis existed
      if (log?.id && log?.ai_score != null) {
        // Preserve analysis_count to prevent rate limit bypass
        const prevAnalysis = log.ai_analysis as Record<string, any> | null;
        const preservedCount = prevAnalysis?.analysis_count || analysisCount;
        await supabase.from('nutrition_logs').update({ 
          ai_score: null, 
          ai_feedback: null, 
          ai_analysis: { invalidated: true, analysis_count: preservedCount },
          trainer_override_score: null,
          trainer_override_note: null,
        }).eq('id', log.id);
      }
      
      toast({ title: lang === 'en' ? 'Photo deleted' : 'Фото удалено' });
      setSelectedPhoto(null);
      fetchData();
      fetchScoreHistory();
    } catch (err: any) {
      toast({ title: lang === 'en' ? 'Error' : 'Ошибка', description: err.message, variant: 'destructive' });
    }
  };

  const handleAnalyze = async () => {
    if (!effectiveUserId) return;
    // Rate limit: max analyses per day
    if (analysisCount >= MAX_ANALYSES_PER_DAY) {
      toast({ 
        title: lang === 'en' ? 'Analysis limit reached' : 'Лимит анализов достигнут',
        description: lang === 'en' ? `Maximum ${MAX_ANALYSES_PER_DAY} analyses per day` : `Максимум ${MAX_ANALYSES_PER_DAY} анализа в день`,
        variant: 'destructive' 
      });
      return;
    }
    setAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-nutrition', {
        body: { user_id: effectiveUserId, log_date: date },
      });
      if (error) throw error;
      if (data?.error) {
        toast({ title: lang === 'en' ? 'Error' : 'Ошибка', description: data.error, variant: 'destructive' });
      } else {
        toast({ title: lang === 'en' ? `Score: ${data.score}%` : `Оценка: ${data.score}%` });
        setAnalysisCount(prev => prev + 1);
        fetchData();
        fetchScoreHistory();
      }
    } catch (err: any) {
      toast({ title: lang === 'en' ? 'Error' : 'Ошибка', description: err.message, variant: 'destructive' });
    }
    setAnalyzing(false);
  };

  const handleTrainerOverride = async () => {
    if (!log?.id || !isTrainer) return;
    const score = parseInt(overrideScore);
    if (isNaN(score) || score < 0 || score > 100) {
      toast({ title: lang === 'en' ? 'Score must be 0-100' : 'Оценка должна быть 0-100', variant: 'destructive' });
      return;
    }
    const { error } = await supabase.from('nutrition_logs').update({
      trainer_override_score: score,
      trainer_override_note: overrideNote.trim() || null,
    }).eq('id', log.id);
    if (error) {
      toast({ title: lang === 'en' ? 'Error' : 'Ошибка', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: lang === 'en' ? 'Score overridden' : 'Оценка скорректирована' });
      setShowOverrideModal(false);
      setOverrideScore('');
      setOverrideNote('');
      fetchData();
      fetchScoreHistory();
    }
  };

  const displayScore = log?.trainer_override_score ?? log?.ai_score;
  const isOverridden = log?.trainer_override_score != null;
  const waterMl = log?.water_ml || 0;
  const coffeeCups = log?.coffee_cups || 0;
  const teaCups = log?.tea_cups || 0;
  const alcoholMl = log?.alcohol_ml || 0;
  const dateLabel = new Date(date + 'T00:00:00').toLocaleDateString(lang === 'en' ? 'en-US' : 'ru-RU', { weekday: 'short', day: 'numeric', month: 'short' });
  const sparkData = useMemo(() => scoreHistory.map(s => s.score), [scoreHistory]);
  const avgScore = sparkData.length > 0 ? Math.round(sparkData.reduce((a, b) => a + b, 0) / sparkData.length) : null;
  const analysis = log?.ai_analysis;
  const meals = analysis?.meals || [];
  const photosAtLimit = photos.length >= MAX_PHOTOS_PER_DAY;
  const analysisAtLimit = analysisCount >= MAX_ANALYSES_PER_DAY;

  // Group photos by meal type
  const groupedPhotos = useMemo(() => {
    const groups: Record<string, FoodPhoto[]> = {};
    for (const mt of MEAL_TYPES) groups[mt.key] = [];
    for (const p of photos) {
      if (groups[p.meal_type]) groups[p.meal_type].push(p);
      else groups['snack'].push(p);
    }
    return groups;
  }, [photos]);

  const liquidItems = [
    { key: 'water_ml', icon: <Droplets className="w-5 h-5" />, label: lang === 'en' ? 'Water' : 'Вода', value: waterMl, display: `${(waterMl / 1000).toFixed(1)} ${lang === 'en' ? 'L' : 'л'}`, step: 250, stepLabel: '+250', color: 'text-blue-400', bgColor: 'bg-blue-500/10' },
    { key: 'coffee_cups', icon: <Coffee className="w-5 h-5" />, label: lang === 'en' ? 'Coffee' : 'Кофе', value: coffeeCups, display: `${coffeeCups}`, step: 1, stepLabel: '+1', color: 'text-amber-400', bgColor: 'bg-amber-500/10' },
    { key: 'tea_cups', icon: <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current"><path d="M4 19h16v2H4v-2zm17-3H3a1 1 0 01-1-1V4a1 1 0 011-1h16a1 1 0 011 1v1h1a2 2 0 012 2v6a2 2 0 01-2 2h-1v1a1 1 0 01-1 1zm1-10h-1v6h1V6zM18 5H4v9h14V5z"/></svg>, label: lang === 'en' ? 'Tea' : 'Чай', value: teaCups, display: `${teaCups}`, step: 1, stepLabel: '+1', color: 'text-green-400', bgColor: 'bg-green-500/10' },
    { key: 'alcohol_ml', icon: <Wine className="w-5 h-5" />, label: lang === 'en' ? 'Alcohol' : 'Алкоголь', value: alcoholMl, display: `${(alcoholMl / 1000).toFixed(1)} ${lang === 'en' ? 'L' : 'л'}`, step: 250, stepLabel: '+250', color: 'text-purple-400', bgColor: 'bg-purple-500/10' },
  ];

  return (
    <div className="space-y-5">
      {/* Score History Banner */}
      {sparkData.length >= 2 && (
        <div className="bg-card border border-border/40 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              {lang === 'en' ? 'Nutrition Score Trend' : 'Тренд оценки питания'}
            </p>
            {avgScore !== null && (
              <span className={`text-sm font-extrabold ${scoreColor(avgScore)}`}>ø {avgScore}%</span>
            )}
          </div>
          <Sparkline data={sparkData} width={280} height={36} />
        </div>
      )}

      {/* Date Navigation */}
      <div className="flex items-center justify-between">
        <button onClick={() => navigateDate(-1)} className="w-9 h-9 rounded-xl bg-secondary/50 flex items-center justify-center hover:bg-secondary/70 transition-colors">
          <ChevronLeft className="w-4 h-4 text-foreground" />
        </button>
        <div className="text-center">
          <p className="text-sm font-bold text-foreground capitalize">{isToday ? (lang === 'en' ? 'Today' : 'Сегодня') : dateLabel}</p>
          {isToday && <p className="text-[10px] text-muted-foreground capitalize">{dateLabel}</p>}
        </div>
        <button onClick={() => navigateDate(1)} disabled={isToday} className="w-9 h-9 rounded-xl bg-secondary/50 flex items-center justify-center hover:bg-secondary/70 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
          <ChevronRight className="w-4 h-4 text-foreground" />
        </button>
      </div>

      {/* AI Score Card */}
      {displayScore != null && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`rounded-2xl p-4 ${scoreBg(displayScore)} border border-border/30`}>
          <div className="flex items-center gap-3 mb-2">
            <div className={`w-12 h-12 rounded-xl ${scoreBg(displayScore)} flex items-center justify-center`}>
              <span className={`text-xl font-extrabold ${scoreColor(displayScore)}`}>{displayScore}</span>
            </div>
            <div className="flex-1">
              <p className="text-xs font-bold text-foreground">
                {isOverridden 
                  ? (lang === 'en' ? 'Trainer Score' : 'Оценка тренера')
                  : (lang === 'en' ? 'AI Nutrition Score' : 'ИИ оценка питания')
                }
              </p>
              <p className={`text-[10px] font-semibold ${scoreColor(displayScore)}`}>
                {displayScore >= 80 ? '🟢' : displayScore >= 50 ? '🟡' : '🔴'} {displayScore}%
                {isOverridden && log?.ai_score != null && (
                  <span className="text-muted-foreground ml-1">(AI: {log.ai_score}%)</span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-1">
              {isTrainer && log?.ai_score != null && (
                <button onClick={() => { 
                  setOverrideScore(String(log?.trainer_override_score ?? log?.ai_score ?? '')); 
                  setOverrideNote(log?.trainer_override_note || '');
                  setShowOverrideModal(true); 
                }} className="w-8 h-8 rounded-lg bg-background/50 flex items-center justify-center hover:bg-background/80 transition-colors">
                  <Edit3 className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              )}
              <Sparkles className={`w-5 h-5 ${scoreColor(displayScore)}`} />
            </div>
          </div>
          {isOverridden && log?.trainer_override_note && (
            <p className="text-[11px] text-foreground/80 leading-relaxed mb-1 italic">✏️ {log.trainer_override_note}</p>
          )}
          {log?.ai_feedback && <p className="text-[11px] text-muted-foreground leading-relaxed">{log.ai_feedback}</p>}
          {meals.length > 0 && (
            <div className="mt-3 space-y-1.5">
              {meals.map((meal: any, i: number) => (
                <div key={i} className="flex items-center gap-2 bg-background/50 rounded-lg px-2.5 py-1.5">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase w-14">
                    {meal.meal_type === 'breakfast' ? (lang === 'en' ? 'Brkfst' : 'Завтр') :
                     meal.meal_type === 'lunch' ? (lang === 'en' ? 'Lunch' : 'Обед') :
                     meal.meal_type === 'dinner' ? (lang === 'en' ? 'Dinner' : 'Ужин') : (lang === 'en' ? 'Snack' : 'Перек')}
                  </span>
                  <div className="flex-1 h-1.5 bg-muted/30 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${scoreBarColor(meal.score)}`} style={{ width: `${meal.score}%` }} />
                  </div>
                  <span className={`text-[10px] font-bold ${scoreColor(meal.score)}`}>{meal.score}%</span>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* Liquids */}
      <div className="space-y-2">
        <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{lang === 'en' ? 'Liquids' : 'Жидкости'}</p>
        <div className="grid grid-cols-2 gap-2.5">
          {liquidItems.map(item => (
            <div key={item.key} className="bg-card border border-border/40 rounded-2xl p-3.5 space-y-2">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-xl ${item.bgColor} flex items-center justify-center ${item.color}`}>{item.icon}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-muted-foreground font-medium">{item.label}</p>
                  <p className="text-sm font-extrabold text-foreground">{item.display}</p>
                </div>
              </div>
              {!isReadOnly && !userId && (
                <div className="flex items-center gap-1.5">
                  <button onClick={() => upsertLog(item.key, Math.max(0, item.value - item.step))} disabled={item.value <= 0} className="flex-1 h-8 rounded-lg bg-secondary/50 flex items-center justify-center hover:bg-secondary/70 transition-colors disabled:opacity-30 active:scale-95">
                    <Minus className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                  <button onClick={() => upsertLog(item.key, item.value + item.step)} className="flex-[2] h-8 rounded-lg bg-primary/15 flex items-center justify-center gap-1 hover:bg-primary/25 transition-colors active:scale-95">
                    <Plus className="w-3 h-3 text-primary" />
                    <span className="text-[10px] font-bold text-primary">{item.stepLabel}</span>
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Food Photos by Meal Type */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{lang === 'en' ? 'Food Photos' : 'Фото еды'}</p>
          <span className="text-[10px] text-muted-foreground">
            {photos.length}/{MAX_PHOTOS_PER_DAY} {lang === 'en' ? 'photos' : 'фото'}
          </span>
        </div>

        {/* Upload button */}
        {!isReadOnly && !userId && (
          <label className={`flex items-center justify-center gap-2 rounded-xl p-3 cursor-pointer transition-colors active:scale-[0.98] ${
            photosAtLimit ? 'bg-muted/30 cursor-not-allowed opacity-50' : 'bg-secondary/50 hover:bg-secondary/70'
          }`}>
            <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileSelect} disabled={uploading || photosAtLimit} />
            {uploading ? <Loader2 className="w-4 h-4 animate-spin text-primary" /> : <Camera className="w-4 h-4 text-primary" />}
            <span className="text-xs font-bold text-foreground">
              {uploading ? (lang === 'en' ? 'Uploading...' : 'Загрузка...') : 
               photosAtLimit ? (lang === 'en' ? 'Photo limit reached' : 'Лимит фото достигнут') :
               (lang === 'en' ? 'Add food photo' : 'Добавить фото еды')}
            </span>
          </label>
        )}

        {/* Photos grouped by meal */}
        {photos.length === 0 ? (
          <div className="text-center py-6">
            <Camera className="w-8 h-8 text-muted-foreground/20 mx-auto mb-1.5" />
            <p className="text-xs text-muted-foreground">{lang === 'en' ? 'No food photos for this day' : 'Нет фото еды за этот день'}</p>
          </div>
        ) : (
          MEAL_TYPES.filter(mt => groupedPhotos[mt.key].length > 0).map(mt => (
            <div key={mt.key}>
              <p className="text-[10px] font-semibold text-muted-foreground mb-1.5">
                {mt.emoji} {lang === 'en' ? mt.labelEn : mt.labelRu}
              </p>
              <div className="grid grid-cols-3 gap-2">
                {groupedPhotos[mt.key].map(photo => (
                  <motion.button key={photo.id} whileTap={{ scale: 0.95 }} onClick={() => setSelectedPhoto(photo)} className="relative rounded-xl overflow-hidden aspect-square group">
                    <img src={photo.photo_url} alt="" className="w-full h-full object-cover" />
                    <span className="absolute bottom-1 left-1 text-[8px] bg-black/50 text-white/80 px-1.5 py-0.5 rounded">
                      {new Date(photo.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </motion.button>
                ))}
              </div>
            </div>
          ))
        )}

        {/* Analyze Button */}
        {photos.length > 0 && (
          <motion.button whileTap={{ scale: 0.97 }} onClick={handleAnalyze} disabled={analyzing || analysisAtLimit}
            className={`w-full flex items-center justify-center gap-2 border rounded-xl p-3 transition-colors ${
              analysisAtLimit 
                ? 'bg-muted/20 border-border/20 cursor-not-allowed opacity-50' 
                : 'bg-primary/15 hover:bg-primary/25 border-primary/30'
            }`}>
            {analyzing ? <Loader2 className="w-4 h-4 animate-spin text-primary" /> : <Sparkles className="w-4 h-4 text-primary" />}
            <span className="text-xs font-bold text-primary">
              {analyzing ? (lang === 'en' ? 'Analyzing...' : 'Анализирую...') : 
               analysisAtLimit ? (lang === 'en' ? `Limit reached (${MAX_ANALYSES_PER_DAY}/day)` : `Лимит достигнут (${MAX_ANALYSES_PER_DAY}/день)`) :
               log?.ai_score != null ? (lang === 'en' ? `Re-analyze (${MAX_ANALYSES_PER_DAY - analysisCount} left)` : `Переоценить (осталось ${MAX_ANALYSES_PER_DAY - analysisCount})`) : 
               (lang === 'en' ? 'Get AI Score' : 'Получить оценку ИИ')}
            </span>
          </motion.button>
        )}
      </div>

      {/* Meal Type Picker Modal */}
      <AnimatePresence>
        {showMealPicker && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => { setShowMealPicker(false); setPendingFile(null); }}
            className="fixed inset-0 z-[200] bg-black/60 flex items-end justify-center p-4">
            <motion.div initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-md bg-card rounded-2xl p-5 space-y-3 border border-border/40">
              <p className="text-sm font-bold text-foreground text-center">
                {lang === 'en' ? 'What meal is this?' : 'Какой это приём пищи?'}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {MEAL_TYPES.map(mt => (
                  <button key={mt.key} onClick={() => handleUploadWithMealType(mt.key)}
                    className="flex items-center gap-2.5 bg-secondary/50 hover:bg-secondary/70 rounded-xl p-3.5 transition-colors active:scale-95">
                    <span className="text-xl">{mt.emoji}</span>
                    <span className="text-sm font-bold text-foreground">{lang === 'en' ? mt.labelEn : mt.labelRu}</span>
                  </button>
                ))}
              </div>
              <button onClick={() => { setShowMealPicker(false); setPendingFile(null); }}
                className="w-full text-xs text-muted-foreground py-2 text-center">
                {lang === 'en' ? 'Cancel' : 'Отмена'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Trainer Override Modal */}
      <AnimatePresence>
        {showOverrideModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowOverrideModal(false)}
            className="fixed inset-0 z-[200] bg-black/60 flex items-end justify-center p-4">
            <motion.div initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-md bg-card rounded-2xl p-5 space-y-4 border border-border/40">
              <p className="text-sm font-bold text-foreground text-center">
                {lang === 'en' ? 'Override AI Score' : 'Корректировка оценки'}
              </p>
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground mb-1 block">
                  {lang === 'en' ? 'New score (0-100)' : 'Новая оценка (0-100)'}
                </label>
                <input 
                  type="number" min="0" max="100" value={overrideScore} 
                  onChange={e => setOverrideScore(e.target.value)}
                  className="w-full h-10 bg-secondary/50 border border-border/40 rounded-xl px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground mb-1 block">
                  {lang === 'en' ? 'Note (optional)' : 'Комментарий (необязательно)'}
                </label>
                <textarea 
                  value={overrideNote} onChange={e => setOverrideNote(e.target.value)}
                  rows={2}
                  className="w-full bg-secondary/50 border border-border/40 rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                  placeholder={lang === 'en' ? 'Why are you changing the score?' : 'Почему меняете оценку?'}
                />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowOverrideModal(false)} className="flex-1 h-10 rounded-xl bg-secondary/50 text-xs font-bold text-muted-foreground">
                  {lang === 'en' ? 'Cancel' : 'Отмена'}
                </button>
                <button onClick={handleTrainerOverride} className="flex-1 h-10 rounded-xl bg-primary text-xs font-bold text-primary-foreground">
                  {lang === 'en' ? 'Save' : 'Сохранить'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Photo Lightbox */}
      <AnimatePresence>
        {selectedPhoto && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedPhoto(null)}
            className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} onClick={e => e.stopPropagation()} className="relative max-w-full max-h-full">
              <img src={selectedPhoto.photo_url} alt="" className="max-w-full max-h-[80vh] rounded-xl object-contain" />
              {!isReadOnly && !userId && (
                <button onClick={() => handleDeletePhoto(selectedPhoto)} className="absolute top-3 right-3 w-10 h-10 bg-destructive/80 rounded-full flex items-center justify-center shadow-lg">
                  <Trash2 className="w-4 h-4 text-white" />
                </button>
              )}
              <p className="text-center text-xs text-white/60 mt-2">
                {MEAL_TYPES.find(m => m.key === selectedPhoto.meal_type)?.emoji}{' '}
                {lang === 'en' ? MEAL_TYPES.find(m => m.key === selectedPhoto.meal_type)?.labelEn : MEAL_TYPES.find(m => m.key === selectedPhoto.meal_type)?.labelRu}
                {' · '}{new Date(selectedPhoto.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NutritionDiary;
