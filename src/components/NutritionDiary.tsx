import { useState, useEffect, useRef, useMemo, forwardRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown, Camera, Loader2, Trash2, Plus, Droplets, Coffee, Wine, Minus, Sparkles, Edit3, ImagePlus, Flame, X, Check, PencilLine, HelpCircle, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { computeNutritionTotals } from '@/lib/nutritionTotals';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { showAppError } from '@/components/AppErrorDialog';
import { useTrainingDayKey } from '@/hooks/useTrainingDayKey';
import { motion, AnimatePresence } from 'framer-motion';
import NutritionCalcInfo from './NutritionCalcInfo';
import { compressImage } from '@/lib/imageCompress';


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
  manual_entries: any[] | null;
}

interface FoodPhoto {
  id: string;
  log_date: string;
  photo_url: string;
  meal_note: string | null;
  meal_type: string;
  meal_time: string | null;
  created_at: string;
}

interface DetectedFood {
  name: string;
  portion_g: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

interface ManualEntry {
  id: string;
  meal_type: string;
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  portion_g?: number;
  meal_time?: string;
  created_at: string;
  photo_id?: string; // links auto-detected entries to their source photo
}

interface Props {
  userId?: string;
  lang: string;
  isTrainer?: boolean;
  calorieGoal?: number | null;
  /** Opens the "Add meal" chooser (photo / manual) immediately on mount. */
  autoOpenAdd?: boolean;
}

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

const MAX_PHOTOS_PER_DAY = 15;
const MAX_ANALYSES_PER_DAY = 12;

// ---- Client-side cache -------------------------------------------------
// Keeps the diary stable when the user leaves the module and comes back:
// data renders instantly from cache (no flicker / no "jumping" numbers)
// and the auto-analysis fingerprint survives unmount so we never re-run
// the AI for a day that was already analysed.
const diaryCache = new Map<string, { log: any; photos: any[]; ts: number }>();
const DIARY_CACHE_TTL = 5 * 60 * 1000;
const cacheKey = (uid: string, d: string) => `${uid}::${d}`;

const fingerprintKey = (uid: string, d: string) => `nutri_fp_${uid}_${d}`;
const readFingerprint = (uid: string, d: string): { kcal: number; meals: string; key: string } | null => {
  try {
    const raw = localStorage.getItem(fingerprintKey(uid, d));
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
};
const writeFingerprint = (uid: string, d: string, fp: { kcal: number; meals: string; key: string }) => {
  try { localStorage.setItem(fingerprintKey(uid, d), JSON.stringify(fp)); } catch { /* ignore */ }
};

// A re-analysis is only worth it if the day changed meaningfully:
// a new meal type appeared, or calories moved by more than these thresholds.
const MIN_KCAL_DELTA = 80;
const MIN_KCAL_DELTA_RATIO = 0.12;
const VALID_MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

const MEAL_TYPES: { key: MealType; labelRu: string; labelEn: string; emoji: string; icon: string }[] = [
  { key: 'breakfast', labelRu: 'Завтрак', labelEn: 'Breakfast', emoji: '🌅', icon: '☀️' },
  { key: 'lunch', labelRu: 'Обед', labelEn: 'Lunch', emoji: '☀️', icon: '🍽' },
  { key: 'dinner', labelRu: 'Ужин', labelEn: 'Dinner', emoji: '🌙', icon: '🌙' },
  { key: 'snack', labelRu: 'Перекус', labelEn: 'Snack', emoji: '🍎', icon: '🍏' },
];

const scoreColor = (s: number) => s >= 75 ? 'text-green-400' : s >= 50 ? 'text-yellow-400' : 'text-red-400';

const scoreToGrade = (s: number) => {
  if (s >= 90) return 'A';
  if (s >= 75) return 'B';
  if (s >= 50) return 'C';
  return 'D';
};

const gradeStyle = (grade: string) => {
  switch (grade) {
    case 'A': return { bg: 'bg-green-500', text: 'text-white', ring: 'ring-green-500/30' };
    case 'B': return { bg: 'bg-yellow-500', text: 'text-black', ring: 'ring-yellow-500/30' };
    case 'C': return { bg: 'bg-orange-500', text: 'text-white', ring: 'ring-orange-500/30' };
    default: return { bg: 'bg-red-500', text: 'text-white', ring: 'ring-red-500/30' };
  }
};

const ScoreBadge = ({ score, className }: { score: number; className?: string }) => {
  const grade = scoreToGrade(score);
  const style = gradeStyle(grade);
  return (
    <div className={`w-7 h-7 rounded-full ${style.bg} ${style.text} ring-2 ring-offset-1 ring-offset-background/60 ${style.ring} flex items-center justify-center text-[11px] font-black ${className || ''}`}>
      {grade}
    </div>
  );
};


// Animated number component with smooth rolling effect
const AnimatedNumber = ({ value, className, duration = 0.6 }: { value: number; className?: string; duration?: number }) => {
  const [displayed, setDisplayed] = useState(value);
  const prevRef = useRef(value);

  useEffect(() => {
    const from = prevRef.current;
    const to = value;
    if (from === to) return;
    prevRef.current = to;
    const startTime = performance.now();
    const animate = (now: number) => {
      const elapsed = (now - startTime) / (duration * 1000);
      if (elapsed >= 1) {
        setDisplayed(to);
        return;
      }
      // ease-out cubic
      const t = 1 - Math.pow(1 - elapsed, 3);
      setDisplayed(Math.round(from + (to - from) * t));
      requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [value, duration]);

  return <span className={className}>{displayed}</span>;
};

// Macro ring component
const MacroRing = ({ value, max, color, size = 40, strokeWidth = 3.5 }: { value: number; max?: number; color: string; size?: number; strokeWidth?: number }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = max ? Math.min(value / max, 1) : 0;
  const dashOffset = circumference * (1 - progress);

  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="hsl(var(--muted))" strokeWidth={strokeWidth} opacity={0.3} />
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth}
        strokeDasharray={circumference} strokeDashoffset={dashOffset} strokeLinecap="round"
        className="transition-all duration-700 ease-out" />
    </svg>
  );
};

const NutritionDiary = forwardRef<HTMLDivElement, Props>(({ userId, lang, isTrainer = false, calorieGoal, autoOpenAdd = false }, ref) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const effectiveUserId = userId || user?.id;
  const isReadOnly = !!userId && !isTrainer;

  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  // Training slots for this date (recalculated live on cancel / reschedule)
  const trainingDayKey = useTrainingDayKey(effectiveUserId, date);

  const [log, setLog] = useState<NutritionLog | null>(null);
  const [photos, setPhotos] = useState<FoodPhoto[]>([]);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<FoodPhoto | null>(null);
  const [showSourcePicker, setShowSourcePicker] = useState(false);
  const [showMealPicker, setShowMealPicker] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingMealType, setPendingMealType] = useState<MealType | null>(null);
  const [pendingMealTime, setPendingMealTime] = useState<string>('');
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideScore, setOverrideScore] = useState('');
  const [overrideNote, setOverrideNote] = useState('');
  const [analysisCount, setAnalysisCount] = useState(0);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickAddMeal, setQuickAddMeal] = useState<MealType>('snack');
  const [quickAddName, setQuickAddName] = useState('');
  const [quickAddCal, setQuickAddCal] = useState('');
  const [quickAddProtein, setQuickAddProtein] = useState('');
  const [quickAddCarbs, setQuickAddCarbs] = useState('');
  const [quickAddFat, setQuickAddFat] = useState('');
  const [showAddMenu, setShowAddMenu] = useState(autoOpenAdd);
  const [quickAddTime, setQuickAddTime] = useState<string>('');
  const [foodSuggestions, setFoodSuggestions] = useState<any[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const suggestTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [quickAddPortion, setQuickAddPortion] = useState('100');
  const [quickAddBase, setQuickAddBase] = useState<{ cal: number; protein: number; carbs: number; fat: number } | null>(null);
  const [showLiquids, setShowLiquids] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [showFeedbackHint, setShowFeedbackHint] = useState(false);
  const [showCalcInfo, setShowCalcInfo] = useState(false);
  const [showCalcInfoButton, setShowCalcInfoButton] = useState(false);
  const calcInfoScrollRef = useRef<HTMLDivElement>(null);
  const [showCalcInfoHint, setShowCalcInfoHint] = useState(false);

  const [expandedMeal, setExpandedMeal] = useState<MealType | null>(null);
  const [editingFood, setEditingFood] = useState<{ mealType: MealType; index: number } | null>(null);
  const [editFoodName, setEditFoodName] = useState('');
  const [editFoodPortion, setEditFoodPortion] = useState('');
  const [editFoodCal, setEditFoodCal] = useState('');
  const [editFoodProtein, setEditFoodProtein] = useState('');
  const [editFoodCarbs, setEditFoodCarbs] = useState('');
  const [editFoodFat, setEditFoodFat] = useState('');
  // Snapshot of original food at edit-start — used to auto-scale macros when portion changes
  const [editFoodOrig, setEditFoodOrig] = useState<{ portion_g: number; calories: number; protein_g: number; carbs_g: number; fat_g: number } | null>(null);
  const [editFoodRecalcLoading, setEditFoodRecalcLoading] = useState(false);
  const [editingManualId, setEditingManualId] = useState<string | null>(null);
  const [editManualName, setEditManualName] = useState('');
  const [editManualPortion, setEditManualPortion] = useState('');
  const [editManualCal, setEditManualCal] = useState('');
  const [editManualProtein, setEditManualProtein] = useState('');
  const [editManualCarbs, setEditManualCarbs] = useState('');
  const [editManualFat, setEditManualFat] = useState('');
  const [editManualOrig, setEditManualOrig] = useState<{ portion_g: number; calories: number; protein_g: number; carbs_g: number; fat_g: number } | null>(null);
  const [editManualRecalcLoading, setEditManualRecalcLoading] = useState(false);
  const [confirmDeleteManualId, setConfirmDeleteManualId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const applyLogData = useCallback((logData: any, photosData: any[]) => {
    setLog(logData || null);
    setPhotos((photosData as FoodPhoto[]) || []);
    const analysisData = logData?.ai_analysis as Record<string, any> | null;
    setAnalysisCount(analysisData?.analysis_count || (logData?.ai_score != null ? 1 : 0));
  }, []);

  const fetchData = useCallback(async () => {
    if (!effectiveUserId) return;
    const ck = cacheKey(effectiveUserId, date);
    const cached = diaryCache.get(ck);
    // Instant paint from cache — avoids the "numbers jump" effect on remount,
    // then always revalidate in the background (stale-while-revalidate).
    if (cached && Date.now() - cached.ts < DIARY_CACHE_TTL) applyLogData(cached.log, cached.photos);

    const [logRes, photosRes] = await Promise.all([
      supabase.from('nutrition_logs').select('*').eq('user_id', effectiveUserId).eq('log_date', date).maybeSingle(),
      supabase.from('food_photos').select('*').eq('user_id', effectiveUserId).eq('log_date', date).order('created_at', { ascending: true }),
    ]);
    diaryCache.set(ck, { log: logRes.data || null, photos: photosRes.data || [], ts: Date.now() });
    applyLogData(logRes.data, (photosRes.data as any[]) || []);
  }, [effectiveUserId, date, applyLogData]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ---- 14-day history strip (calories + score per day) ----
  const [history, setHistory] = useState<Record<string, { calories: number; protein: number; carbs: number; fat: number; score: number | null }>>({});

  const loadHistory = useCallback(async () => {
    if (!effectiveUserId) return;
    const from = new Date(date + 'T12:00:00');
    from.setDate(from.getDate() - 20);
    const fromStr = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, '0')}-${String(from.getDate()).padStart(2, '0')}`;
    const { data } = await supabase
      .from('nutrition_logs')
      .select('log_date, ai_analysis, manual_entries, coffee_cups, tea_cups, alcohol_ml, water_ml, ai_score, trainer_override_score')
      .eq('user_id', effectiveUserId)
      .gte('log_date', fromStr)
      .order('log_date', { ascending: true });
    const map: Record<string, { calories: number; protein: number; carbs: number; fat: number; score: number | null }> = {};
    for (const row of (data as any[]) || []) {
      const t = computeNutritionTotals(row as any);
      map[row.log_date] = { ...t, score: row.trainer_override_score ?? row.ai_score ?? null };
    }
    setHistory(map);
  }, [effectiveUserId, date]);

  useEffect(() => { loadHistory(); }, [loadHistory]);
  // Keep the strip in sync with the currently open day's live totals
  useEffect(() => {
    if (!log) return;
    const t = computeNutritionTotals(log as any);
    setHistory(prev => ({ ...prev, [date]: { ...t, score: log.trainer_override_score ?? log.ai_score ?? null } }));
  }, [log, date]);


  // Keep the cache in sync with optimistic local updates.
  // Never overwrite a warm cache with the empty initial state on remount —
  // that would bring back the "numbers jump" flicker before the fetch lands.
  useEffect(() => {
    if (!effectiveUserId) return;
    if (!log && photos.length === 0 && diaryCache.has(cacheKey(effectiveUserId, date))) return;
    diaryCache.set(cacheKey(effectiveUserId, date), { log, photos, ts: Date.now() });
  }, [effectiveUserId, date, log, photos]);



  useEffect(() => {
    const seen = localStorage.getItem('nutrition_feedback_hint_seen');
    if (!seen) setShowFeedbackHint(true);
  }, []);

  useEffect(() => {
    const seen = localStorage.getItem('nutrition_calc_info_hint_seen');
    if (!seen) setShowCalcInfoHint(true);
  }, []);

  // Show the "Got it" button in the calc-info modal only after the user
  // scrolls to the very bottom. If the content is short, show it immediately.
  useEffect(() => {
    if (!showCalcInfo) {
      setShowCalcInfoButton(false);
      return;
    }
    const el = calcInfoScrollRef.current;
    if (!el) return;
    const check = () => {
      setShowCalcInfoButton(el.scrollTop + el.clientHeight >= el.scrollHeight - 24);
    };
    check();
    el.addEventListener('scroll', check, { passive: true });
    // Recheck after content (NutritionCalcInfo) renders and fetches data.
    const r1 = requestAnimationFrame(check);
    const t = setTimeout(check, 250);
    return () => {
      el.removeEventListener('scroll', check);
      cancelAnimationFrame(r1);
      clearTimeout(t);
    };
  }, [showCalcInfo]);

  const todayStr = (() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  })();

  const navigateDate = (dir: -1 | 1) => {
    const d = new Date(date + 'T12:00:00');
    d.setDate(d.getDate() + dir);
    const newDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (newDate > todayStr) return;
    setDate(newDate);
  };

  const isToday = date === todayStr;

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
      if (!error) setLog(data as any);
    } else {
      const { data, error } = await supabase.from('nutrition_logs').insert(payload).select().single();
      if (!error) setLog(data as any);
    }
  };

  const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'];

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    // Android cameras often hand over files with no extension (or "image"), so
    // trust the MIME type first and only fall back to the extension check.
    const looksLikeImage = file.type.startsWith('image/') || ALLOWED_EXTENSIONS.includes(ext);
    if (!looksLikeImage) {
      toast({ title: lang === 'en' ? 'Only image files allowed' : 'Только изображения (jpg, png, webp)', variant: 'destructive' });
      if (fileRef.current) fileRef.current.value = '';
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      toast({ title: lang === 'en' ? 'File too large (max 25MB)' : 'Файл слишком большой (макс 25МБ)', variant: 'destructive' });
      if (fileRef.current) fileRef.current.value = '';
      return;
    }
    if (photos.length >= MAX_PHOTOS_PER_DAY) {
      toast({ title: lang === 'en' ? 'Photo limit reached' : 'Лимит фото достигнут', variant: 'destructive' });
      if (fileRef.current) fileRef.current.value = '';
      return;
    }
    setPendingFile(file);
    // Meal type & time were already chosen BEFORE opening the file picker — upload immediately
    setTimeout(() => handleUploadWithTime(file), 0);
    if (fileRef.current) fileRef.current.value = '';
  };


  const handleUploadWithTime = async (fileOverride?: File, mealTypeOverride?: string, mealTimeOverride?: string | null) => {
    const original = fileOverride || pendingFile;
    const mealType = mealTypeOverride || pendingMealType;
    const mealTime = mealTimeOverride !== undefined ? mealTimeOverride : (pendingMealTime || null);
    if (!original || !user || !mealType) return;
    if (!VALID_MEAL_TYPES.includes(mealType)) return;
    setUploading(true);
    let path = '';

    try {
      // Shrink big Android/iPhone camera shots so the upload survives weak mobile networks.
      const file = await compressImage(original);
      const rawExt = (file.name.split('.').pop() || '').toLowerCase();
      const ext = /^(jpg|jpeg|png|webp|heic|heif)$/.test(rawExt) ? rawExt : 'jpg';
      path = `${user.id}/${date}_${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('food-photos')
        .upload(path, file, { upsert: true, contentType: file.type || 'image/jpeg' });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('food-photos').getPublicUrl(path);
      const { data: validation, error: valError } = await supabase.functions.invoke('validate-food-photo', {
        body: { photo_url: publicUrl },
      });
      if (!valError && validation && !validation.is_food) {
        await supabase.storage.from('food-photos').remove([path]);
        toast({ title: lang === 'en' ? 'Not a food photo' : 'Это не фото еды', variant: 'destructive' });
        return;
      }
      const detectedItems = Array.isArray(validation?.items) ? validation.items : [];
      const { data: insertedPhoto, error: insertError } = await supabase.from('food_photos').insert({
        user_id: user.id, log_date: date, photo_url: publicUrl, meal_type: mealType, meal_time: mealTime,
      } as any).select('id').single();
      if (insertError) {
        await supabase.storage.from('food-photos').remove([path]);
        throw insertError;
      }
      const photoId = (insertedPhoto as any)?.id || crypto.randomUUID();

      if (detectedItems.length > 0) {
        const currentEntries = (log?.manual_entries || []) as ManualEntry[];
        const newEntries = detectedItems.map((item: any) => ({
          id: crypto.randomUUID(),
          meal_type: mealType,
          name: item.name || 'Food',
          calories: Math.max(0, Math.round(Number(item.calories) || 0)),
          protein_g: Math.max(0, Math.round(Number(item.protein_g) || 0)),
          carbs_g: Math.max(0, Math.round(Number(item.carbs_g) || 0)),
          fat_g: Math.max(0, Math.round(Number(item.fat_g) || 0)),
          meal_time: mealTime || undefined,
          created_at: new Date().toISOString(),
          photo_id: photoId,
        }));
        const allEntries = [...currentEntries, ...newEntries];

        setLog(prev => prev
          ? { ...prev, manual_entries: allEntries } as any
          : { id: '', log_date: date, water_ml: 0, coffee_cups: 0, tea_cups: 0, alcohol_ml: 0, notes: null, ai_score: null, ai_feedback: null, ai_analysis: null, trainer_override_score: null, trainer_override_note: null, manual_entries: allEntries } as any
        );

        const { error: logUpsertError } = await supabase.from('nutrition_logs').upsert({
          user_id: user.id,
          log_date: date,
          manual_entries: allEntries as any,
        } as any, { onConflict: 'user_id,log_date' });

        if (logUpsertError) {
          console.error('Failed to upsert instant nutrition entries', logUpsertError);
        }
      }
      const mealLabel = MEAL_TYPES.find(m => m.key === mealType);
      toast({ title: `${mealLabel?.emoji} ${lang === 'en' ? 'Photo added' : 'Фото добавлено'}` });
      fetchData();
    } catch (err: any) {
      try { await supabase.storage.from('food-photos').remove([path]); } catch {}
      showAppError({
        detailEn: err.message,
        detailRu: err.message,
        source: 'nutrition-diary:upload',
        onRetry: () => handleUploadWithTime(original, mealType, mealTime),
      });
    } finally {
      setPendingFile(null);
      setPendingMealType(null);
      setUploading(false);
    }
  };

  const handleDeletePhoto = async (photo: FoodPhoto) => {
    const hasAnalysis = log?.ai_score != null;
    if (hasAnalysis) {
      const confirmed = window.confirm(lang === 'en' ? 'Delete this photo? AI score will be recalculated on next analysis.' : 'Удалить фото? AI-оценка будет пересчитана при следующем анализе.');
      if (!confirmed) return;
    }
    try {
      const urlParts = photo.photo_url.split('/food-photos/');
      const storagePath = urlParts[1] ? decodeURIComponent(urlParts[1]) : null;
      if (storagePath) await supabase.storage.from('food-photos').remove([storagePath]);
      await supabase.from('food_photos').delete().eq('id', photo.id);

      // Remove auto-detected manual entries linked to this photo
      const currentEntries = ((log?.manual_entries || []) as ManualEntry[]);
      const filteredEntries = currentEntries.filter(e => e.photo_id !== photo.id);
      const entriesChanged = filteredEntries.length !== currentEntries.length;

      // Optimistic update for instant counter animation
      if (entriesChanged) {
        setLog(prev => prev ? { ...prev, manual_entries: filteredEntries } as any : prev);
      }

      if (log?.id) {
        const updatePayload: Record<string, any> = {};
        if (entriesChanged) updatePayload.manual_entries = filteredEntries;
        if (hasAnalysis) {
          const prevAnalysis = log.ai_analysis as Record<string, any> | null;
          const preservedCount = Math.max(0, (prevAnalysis?.analysis_count || analysisCount) - 1);
          updatePayload.ai_score = null;
          updatePayload.ai_feedback = null;
          updatePayload.ai_analysis = { ...prevAnalysis, invalidated: true, analysis_count: preservedCount };
          updatePayload.trainer_override_score = null;
          updatePayload.trainer_override_note = null;
          setAnalysisCount(preservedCount);
        }
        if (Object.keys(updatePayload).length > 0) {
          await supabase.from('nutrition_logs').update(updatePayload).eq('id', log.id);
        }
      }

      toast({ title: lang === 'en' ? 'Photo deleted' : 'Фото удалено' });
      setSelectedPhoto(null);
      fetchData();
    } catch (err: any) {
      showAppError({ detailEn: err.message, detailRu: err.message });
    }
  };

  const handleAnalyzeRef = useRef<((opts?: { silent?: boolean }) => Promise<void>) | null>(null);
  // Анализ выполняется на сервере. Если телефон заблокировали и соединение оборвалось,
  // сервер всё равно досчитает и запишет результат — мы просто дожидаемся его из базы.
  const awaitingResultRef = useRef(false);
  const pollTimerRef = useRef<number | null>(null);

  const stopPolling = useCallback(() => {
    awaitingResultRef.current = false;
    if (pollTimerRef.current) {
      window.clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  // Ждём, пока сервер запишет свежий анализ (до 5 минут), затем обновляем экран.
  const waitForServerResult = useCallback((baselineCount: number) => {
    if (!effectiveUserId) return;
    awaitingResultRef.current = true;
    setAnalyzing(true);
    const startedAt = Date.now();

    const check = async () => {
      if (!awaitingResultRef.current) return;
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
      if (Date.now() - startedAt > 5 * 60 * 1000) {
        stopPolling();
        setAnalyzing(false);
        return;
      }
      const { data } = await supabase
        .from('nutrition_logs')
        .select('ai_score, ai_analysis')
        .eq('user_id', effectiveUserId)
        .eq('log_date', date)
        .maybeSingle();
      const count = ((data?.ai_analysis as any)?.analysis_count as number) || 0;
      if (data && count > baselineCount) {
        stopPolling();
        setAnalysisCount(count);
        setAnalyzing(false);
        fetchData();
      }
    };

    if (pollTimerRef.current) window.clearInterval(pollTimerRef.current);
    pollTimerRef.current = window.setInterval(check, 4000);
    check();
  }, [effectiveUserId, date, fetchData, stopPolling]);

  // Вернулись в приложение — сразу проверяем, готов ли результат.
  useEffect(() => {
    const onWake = () => {
      if (!awaitingResultRef.current) return;
      fetchData();
    };
    document.addEventListener('visibilitychange', onWake);
    window.addEventListener('online', onWake);
    window.addEventListener('focus', onWake);
    return () => {
      document.removeEventListener('visibilitychange', onWake);
      window.removeEventListener('online', onWake);
      window.removeEventListener('focus', onWake);
      if (pollTimerRef.current) window.clearInterval(pollTimerRef.current);
    };
  }, [fetchData]);

  const handleAnalyze = useCallback(async (opts?: { silent?: boolean }) => {
    if (!effectiveUserId) return;
    if (analysisCount >= MAX_ANALYSES_PER_DAY) {
      if (!opts?.silent) toast({ title: lang === 'en' ? 'Analysis limit reached' : 'Лимит анализов достигнут', variant: 'destructive' });
      return;
    }
    const baselineCount = analysisCount;
    setAnalyzing(true);
    try {
      // keepalive: запрос остаётся в сетевом стеке браузера даже если экран
      // заблокировали или вкладку заморозили — сервер доводит анализ до конца.
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-nutrition`, {
        method: 'POST',
        keepalive: true,
        headers: {
          'Content-Type': 'application/json',
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ user_id: effectiveUserId, log_date: date, lang }),
      });
      const data = await res.json().catch(() => ({} as any));

      const errMsg = (data?.error || (res.ok ? '' : `HTTP ${res.status}`)) as string;
      const isCredits = data?.code === 'credits' || /credit|402|403/i.test(errMsg);
      if (isCredits) {
        setAnalyzing(false);
        return;
      }
      if (errMsg) {
        // Серверная ошибка — пробуем дождаться результата, экран не пугаем.
        waitForServerResult(baselineCount);
        return;
      }
      stopPolling();
      if (!opts?.silent) toast({ title: lang === 'en' ? `Score: ${data.score}%` : `Оценка: ${data.score}%` });
      setAnalysisCount(prev => prev + 1);
      setAnalyzing(false);
      fetchData();
    } catch {
      // Связь оборвалась (блокировка экрана, слабый Wi-Fi) — расчёт уже идёт
      // на сервере. Молча ждём результат и покажем его, когда клиент вернётся.
      waitForServerResult(baselineCount);
    }
  }, [effectiveUserId, analysisCount, lang, date, fetchData, toast, waitForServerResult, stopPolling]);

  handleAnalyzeRef.current = handleAnalyze;


  // Auto-trigger analysis when the day changes MEANINGFULLY.
  // A tiny addition (e.g. one cucumber) should not rewrite the recommendations —
  // only a new meal type or a noticeable calorie change triggers a fresh analysis.
  const autoAnalyzeKeyRef = useRef<string>('');
  const lastAnalyzedRef = useRef<{ kcal: number; meals: string } | null>(null);
  // Rehydrate the fingerprint from localStorage whenever user/date changes,
  // so leaving and re-entering the module never re-triggers the AI.
  useEffect(() => {
    if (!effectiveUserId) return;
    const fp = readFingerprint(effectiveUserId, date);
    autoAnalyzeKeyRef.current = fp?.key || '';
    lastAnalyzedRef.current = fp ? { kcal: fp.kcal, meals: fp.meals } : null;
  }, [effectiveUserId, date]);
  useEffect(() => {
    if (isReadOnly || userId) return; // only for the owner's own diary
    if (analyzing) return;
    if (analysisCount >= MAX_ANALYSES_PER_DAY) return;
    const manual = ((log?.manual_entries || []) as ManualEntry[]);
    const hasFood = photos.length > 0 || manual.length > 0;
    if (!hasFood) return;
    const manualIdsKey = manual.map((e: any) => `${e.id || ''}:${e.calories || 0}`).sort().join('|');
    const photoIdsKey = photos.map(p => p.id).sort().join('|');
    // Liquids are part of the day too: coarse buckets so tiny sips don't re-run the AI,
    // but coffee/alcohol/meaningful water changes do.
    const liquidsKey = [
      Math.round((log?.water_ml || 0) / 500),
      log?.coffee_cups || 0,
      log?.tea_cups || 0,
      Math.round((log?.alcohol_ml || 0) / 100),
    ].join(':');
    // Schedule is part of the day's context: a cancelled or moved session must
    // regenerate the advice (training day vs rest day) without manual action.
    if (trainingDayKey === null) return; // schedule still loading
    const key = `${date}::${photoIdsKey}::${manualIdsKey}::${liquidsKey}::sched:${trainingDayKey}`;
    if (autoAnalyzeKeyRef.current === key) return;
    const firstRun = autoAnalyzeKeyRef.current === '';
    autoAnalyzeKeyRef.current = key;
    const fb = (log?.ai_feedback || '') as string;
    const analysisFailed = /Не удалось обработать|Failed to process/i.test(fb);

    const currentKcal = computeNutritionTotals({
      ai_analysis: log?.ai_analysis,
      manual_entries: manual,
      water_ml: log?.water_ml,
      coffee_cups: log?.coffee_cups,
      tea_cups: log?.tea_cups,
      alcohol_ml: log?.alcohol_ml,
    } as any).calories;

    // Include the training slots so a schedule change bypasses the calorie-delta
    // gate below and always yields fresh, date-accurate recommendations.
    const mealsKey = 'sched:' + trainingDayKey + '|' + Array.from(new Set([
      ...manual.map((e: any) => String(e.meal_type || 'snack')),
      ...photos.map((p: any) => String(p.meal_type || 'snack')),
    ])).sort().join(',');

    const remember = () => {
      lastAnalyzedRef.current = { kcal: currentKcal, meals: mealsKey };
      if (effectiveUserId) writeFingerprint(effectiveUserId, date, { kcal: currentKcal, meals: mealsKey, key });
    };

    // On the very first render: skip only if already analyzed successfully and nothing new to do.
    if (firstRun && log?.ai_score != null && !analysisFailed) {
      remember();

      return;
    }

    const prev = lastAnalyzedRef.current;
    if (prev && !analysisFailed) {
      const kcalDelta = Math.abs(currentKcal - prev.kcal);
      const threshold = Math.max(MIN_KCAL_DELTA, prev.kcal * MIN_KCAL_DELTA_RATIO);
      const sameMeals = prev.meals === mealsKey;
      // Minor tweak inside an already-analyzed meal → keep existing recommendations.
      if (sameMeals && kcalDelta < threshold) return;
    }

    const t = setTimeout(() => {
      remember();
      handleAnalyze({ silent: true });
    }, 1200);
    return () => clearTimeout(t);
  }, [photos, log?.manual_entries, log?.ai_score, log?.ai_feedback, log?.ai_analysis, analyzing, analysisCount, date, isReadOnly, userId, effectiveUserId, trainingDayKey, handleAnalyze]);





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
    if (!error) {
      toast({ title: lang === 'en' ? 'Score overridden' : 'Оценка скорректирована' });
      setShowOverrideModal(false);
      fetchData();
    }
  };

  const handleQuickAdd = async () => {
    if (!user) return;
    const cal = parseInt(quickAddCal) || 0;
    const pro = parseInt(quickAddProtein) || 0;
    const carb = parseInt(quickAddCarbs) || 0;
    const fat = parseInt(quickAddFat) || 0;
    if (cal === 0 && pro === 0 && carb === 0 && fat === 0) {
      toast({ title: lang === 'en' ? 'Enter at least calories' : 'Введите хотя бы калории', variant: 'destructive' });
      return;
    }
    const entry: ManualEntry = {
      id: crypto.randomUUID(),
      meal_type: quickAddMeal,
      name: quickAddName.trim() || (lang === 'en' ? 'Quick add' : 'Быстрый ввод'),
      calories: cal,
      protein_g: pro,
      carbs_g: carb,
      fat_g: fat,
      meal_time: quickAddTime || undefined,
      created_at: new Date().toISOString(),
    };
    const currentEntries = (log?.manual_entries || []) as ManualEntry[];
    const newEntries = [...currentEntries, entry];
    // Optimistic update — update local state immediately so totals refresh instantly
    setLog(prev => prev ? { ...prev, manual_entries: newEntries } as any : { id: '', log_date: date, water_ml: 0, coffee_cups: 0, tea_cups: 0, alcohol_ml: 0, notes: null, ai_score: null, ai_feedback: null, ai_analysis: null, trainer_override_score: null, trainer_override_note: null, manual_entries: newEntries } as any);
    setShowQuickAdd(false);
    setQuickAddName(''); setQuickAddCal(''); setQuickAddProtein(''); setQuickAddCarbs(''); setQuickAddFat('');
    setQuickAddPortion('100'); setQuickAddBase(null); setQuickAddTime('');
    setFoodSuggestions([]);
    toast({ title: lang === 'en' ? 'Added' : 'Добавлено' });
    if (log?.id) {
      await supabase.from('nutrition_logs').update({ manual_entries: newEntries as any }).eq('id', log.id);
    } else {
      await supabase.from('nutrition_logs').insert({
        user_id: user.id, log_date: date, manual_entries: newEntries as any,
      } as any);
    }
    await fetchData();
  };

  // ---- Two-way sync between the AI "detected" list and the editable entries ----
  const normName = (s: string) => (s || '').trim().toLowerCase();

  const recalcAnalysisTotals = (a: any) => {
    const meals = (a.meals || []).map((m: any) => {
      const foods = m.detected_foods || [];
      return {
        ...m,
        estimated_calories: foods.reduce((s: number, f: any) => s + (f.calories || 0), 0),
        protein_g: foods.reduce((s: number, f: any) => s + (f.protein_g || 0), 0),
        carbs_g: foods.reduce((s: number, f: any) => s + (f.carbs_g || 0), 0),
        fat_g: foods.reduce((s: number, f: any) => s + (f.fat_g || 0), 0),
      };
    });
    return {
      ...a,
      meals,
      total_calories: meals.reduce((s: number, m: any) => s + (m.estimated_calories || 0), 0),
      total_protein_g: meals.reduce((s: number, m: any) => s + (m.protein_g || 0), 0),
      total_carbs_g: meals.reduce((s: number, m: any) => s + (m.carbs_g || 0), 0),
      total_fat_g: meals.reduce((s: number, m: any) => s + (m.fat_g || 0), 0),
    };
  };

  // patch === null -> delete the matching detected food
  const applyToAiFood = (mealType: string, oldName: string, patch: Partial<DetectedFood> | null) => {
    const a = analysis as any;
    if (!a || a.invalidated || !Array.isArray(a.meals)) return null;
    const meals = a.meals.map((m: any) => ({ ...m, detected_foods: [...(m.detected_foods || [])] }));
    const meal = meals.find((m: any) => m.meal_type === mealType);
    if (!meal) return null;
    const idx = meal.detected_foods.findIndex((f: any) => normName(f.name) === normName(oldName));
    if (idx === -1) return null;
    if (patch === null) meal.detected_foods.splice(idx, 1);
    else meal.detected_foods[idx] = { ...meal.detected_foods[idx], ...patch };
    return recalcAnalysisTotals({ ...a, meals });
  };

  // patch === null -> delete the matching editable entry
  const applyToManualEntry = (mealType: string, oldName: string, patch: Partial<ManualEntry> | null) => {
    const entries = (log?.manual_entries || []) as ManualEntry[];
    const idx = entries.findIndex(e => e.meal_type === mealType && normName(e.name) === normName(oldName));
    if (idx === -1) return null;
    if (patch === null) return entries.filter((_, i) => i !== idx);
    return entries.map((e, i) => (i === idx ? { ...e, ...patch } : e));
  };

  const handleDeleteManualEntry = async (entryId: string) => {

    if (!log?.id) return;
    const target = ((log.manual_entries || []) as ManualEntry[]).find(e => e.id === entryId);
    const entries = ((log.manual_entries || []) as ManualEntry[]).filter(e => e.id !== entryId);
    // Keep the AI "detected" list in sync with the editable list
    const syncedAnalysis = target
      ? applyToAiFood(target.meal_type, target.name, null)
      : null;
    // Optimistic update
    setLog(prev => prev ? { ...prev, manual_entries: entries, ...(syncedAnalysis ? { ai_analysis: syncedAnalysis } : {}) } as any : prev);
    await supabase.from('nutrition_logs').update({
      manual_entries: entries as any,
      ...(syncedAnalysis ? { ai_analysis: syncedAnalysis as any } : {}),
    }).eq('id', log.id);
    await fetchData();
  };


  const startEditManual = (entry: ManualEntry) => {
    setEditingManualId(entry.id);
    setEditManualName(entry.name || '');
    setEditManualPortion(entry.portion_g ? String(entry.portion_g) : '');
    setEditManualCal(String(entry.calories || ''));
    setEditManualProtein(String(entry.protein_g || ''));
    setEditManualCarbs(String(entry.carbs_g || ''));
    setEditManualFat(String(entry.fat_g || ''));
    setEditManualOrig({
      portion_g: Number(entry.portion_g) || 0,
      calories: Number(entry.calories) || 0,
      protein_g: Number(entry.protein_g) || 0,
      carbs_g: Number(entry.carbs_g) || 0,
      fat_g: Number(entry.fat_g) || 0,
    });
  };

  // Auto-scale manual entry macros when portion changes (uses snapshot at edit-start)
  const handleManualPortionChange = (value: string) => {
    setEditManualPortion(value);
    if (!editManualOrig || !editManualOrig.portion_g) return;
    const newPortion = parseInt(value);
    if (!newPortion || newPortion <= 0) return;
    const ratio = newPortion / editManualOrig.portion_g;
    setEditManualCal(String(Math.round(editManualOrig.calories * ratio)));
    setEditManualProtein(String(Math.round(editManualOrig.protein_g * ratio)));
    setEditManualCarbs(String(Math.round(editManualOrig.carbs_g * ratio)));
    setEditManualFat(String(Math.round(editManualOrig.fat_g * ratio)));
  };

  const handleRecalcManualMacros = async () => {
    const name = editManualName.trim();
    if (!name) {
      toast({ title: lang === 'en' ? 'Enter a name first' : 'Сначала введите название', variant: 'destructive' });
      return;
    }
    const portion = parseInt(editManualPortion) || 100;
    setEditManualRecalcLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('food-suggest', {
        body: { query: name, lang },
      });
      if (error) throw error;
      const top = data?.suggestions?.[0];
      if (!top) {
        toast({ title: lang === 'en' ? 'No match found' : 'Не нашли совпадений', variant: 'destructive' });
        return;
      }
      const k = portion / 100;
      const cal = Math.round((Number(top.calories) || 0) * k);
      const p = Math.round((Number(top.protein_g) || 0) * k);
      const c = Math.round((Number(top.carbs_g) || 0) * k);
      const f = Math.round((Number(top.fat_g) || 0) * k);
      setEditManualCal(String(cal));
      setEditManualProtein(String(p));
      setEditManualCarbs(String(c));
      setEditManualFat(String(f));
      setEditManualOrig({ portion_g: portion, calories: cal, protein_g: p, carbs_g: c, fat_g: f });
      toast({ title: lang === 'en' ? 'Recalculated ✨' : 'Пересчитано ✨' });
    } catch (e: any) {
      toast({ title: lang === 'en' ? 'Recalc failed' : 'Ошибка пересчёта', description: e?.message, variant: 'destructive' });
    } finally {
      setEditManualRecalcLoading(false);
    }
  };

  const handleSaveManualEntry = async () => {
    if (!log?.id || !editingManualId) return;
    const portionVal = parseInt(editManualPortion);
    const original = ((log.manual_entries || []) as ManualEntry[]).find(e => e.id === editingManualId);
    const patch = {
      name: editManualName.trim() || original?.name || '',
      portion_g: portionVal > 0 ? portionVal : original?.portion_g,
      calories: parseInt(editManualCal) || 0,
      protein_g: parseInt(editManualProtein) || 0,
      carbs_g: parseInt(editManualCarbs) || 0,
      fat_g: parseInt(editManualFat) || 0,
    };
    const entries = ((log.manual_entries || []) as ManualEntry[]).map(e =>
      e.id === editingManualId ? { ...e, ...patch } : e
    );
    // Mirror the change onto the AI "detected" list so both cards show the same numbers
    const syncedAnalysis = original
      ? applyToAiFood(original.meal_type, original.name, patch as Partial<DetectedFood>)
      : null;
    setLog(prev => prev ? { ...prev, manual_entries: entries, ...(syncedAnalysis ? { ai_analysis: syncedAnalysis } : {}) } as any : prev);
    setEditingManualId(null);
    setEditManualOrig(null);
    await supabase.from('nutrition_logs').update({
      manual_entries: entries as any,
      ...(syncedAnalysis ? { ai_analysis: syncedAnalysis as any } : {}),
    }).eq('id', log.id);
    await fetchData();

  };


  const handleDeleteAiFood = async (mealType: MealType, foodIndex: number) => {
    if (!log?.id || !analysis || analysis.invalidated) return;
    const a = analysis as any;
    const meals = (a.meals || []).map((m: any) => ({ ...m, detected_foods: [...(m.detected_foods || [])] }));
    const meal = meals.find((m: any) => m.meal_type === mealType);
    if (!meal) return;
    const removed = meal.detected_foods[foodIndex];
    meal.detected_foods.splice(foodIndex, 1);
    const updatedAnalysis = recalcAnalysisTotals({ ...a, meals });
    // Mirror onto the editable entries list
    const syncedEntries = removed ? applyToManualEntry(mealType, removed.name, null) : null;
    setLog(prev => prev ? { ...prev, ai_analysis: updatedAnalysis, ...(syncedEntries ? { manual_entries: syncedEntries } : {}) } as any : prev);
    await supabase.from('nutrition_logs').update({
      ai_analysis: updatedAnalysis,
      ...(syncedEntries ? { manual_entries: syncedEntries as any } : {}),
    }).eq('id', log.id);
    fetchData();
  };

  const handleEditAiFood = async () => {
    if (!log?.id || !analysis || !editingFood) return;
    const a = analysis as any;
    const meals = (a.meals || []).map((m: any) => ({ ...m, detected_foods: [...(m.detected_foods || [])] }));
    const meal = meals.find((m: any) => m.meal_type === editingFood.mealType);
    if (!meal) return;
    const prevFood = meal.detected_foods[editingFood.index];
    const patch = {
      name: editFoodName.trim() || prevFood?.name,
      portion_g: parseInt(editFoodPortion) || prevFood?.portion_g,
      calories: parseInt(editFoodCal) || 0,
      protein_g: parseInt(editFoodProtein) || 0,
      carbs_g: parseInt(editFoodCarbs) || 0,
      fat_g: parseInt(editFoodFat) || 0,
    };
    meal.detected_foods[editingFood.index] = { ...prevFood, ...patch };
    const updatedAnalysis = recalcAnalysisTotals({ ...a, meals });
    const syncedEntries = prevFood
      ? applyToManualEntry(editingFood.mealType, prevFood.name, patch as Partial<ManualEntry>)
      : null;
    setLog(prev => prev ? { ...prev, ai_analysis: updatedAnalysis, ...(syncedEntries ? { manual_entries: syncedEntries } : {}) } as any : prev);
    await supabase.from('nutrition_logs').update({
      ai_analysis: updatedAnalysis,
      ...(syncedEntries ? { manual_entries: syncedEntries as any } : {}),
    }).eq('id', log.id);
    setEditingFood(null);
    fetchData();
    toast({ title: lang === 'en' ? 'Updated' : 'Обновлено' });
  };


  const startEditFood = (mealType: MealType, index: number, food: any) => {
    setEditingFood({ mealType, index });
    setEditFoodName(food.name || '');
    setEditFoodPortion(String(food.portion_g || ''));
    setEditFoodCal(String(food.calories || ''));
    setEditFoodProtein(String(food.protein_g || ''));
    setEditFoodCarbs(String(food.carbs_g || ''));
    setEditFoodFat(String(food.fat_g || ''));
    setEditFoodOrig({
      portion_g: Number(food.portion_g) || 0,
      calories: Number(food.calories) || 0,
      protein_g: Number(food.protein_g) || 0,
      carbs_g: Number(food.carbs_g) || 0,
      fat_g: Number(food.fat_g) || 0,
    });
  };

  // When user edits the portion (g), auto-scale macros proportionally
  // from the snapshot taken at edit-start. User can still override fields after.
  const handlePortionChange = (newPortionStr: string) => {
    setEditFoodPortion(newPortionStr);
    if (!editFoodOrig || !editFoodOrig.portion_g) return;
    const newPortion = parseInt(newPortionStr);
    if (!newPortion || newPortion <= 0) return;
    const ratio = newPortion / editFoodOrig.portion_g;
    setEditFoodCal(String(Math.round(editFoodOrig.calories * ratio)));
    setEditFoodProtein(String(Math.round(editFoodOrig.protein_g * ratio)));
    setEditFoodCarbs(String(Math.round(editFoodOrig.carbs_g * ratio)));
    setEditFoodFat(String(Math.round(editFoodOrig.fat_g * ratio)));
  };

  // Recalculate KBJU from current name+portion via food-suggest AI
  const handleRecalcFoodMacros = async () => {
    const name = editFoodName.trim();
    if (!name) {
      toast({ title: lang === 'en' ? 'Enter a name first' : 'Сначала введите название', variant: 'destructive' });
      return;
    }
    const portion = parseInt(editFoodPortion) || 100;
    setEditFoodRecalcLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('food-suggest', {
        body: { query: name, lang },
      });
      if (error) throw error;
      const top = data?.suggestions?.[0];
      if (!top) {
        toast({ title: lang === 'en' ? 'No match found' : 'Не нашли совпадений', variant: 'destructive' });
        return;
      }
      // food-suggest returns values per 100g
      const k = portion / 100;
      const cal = Math.round((Number(top.calories) || 0) * k);
      const p = Math.round((Number(top.protein_g) || 0) * k);
      const c = Math.round((Number(top.carbs_g) || 0) * k);
      const f = Math.round((Number(top.fat_g) || 0) * k);
      setEditFoodCal(String(cal));
      setEditFoodProtein(String(p));
      setEditFoodCarbs(String(c));
      setEditFoodFat(String(f));
      // Reset baseline so future portion-change scales from the new values
      setEditFoodOrig({ portion_g: portion, calories: cal, protein_g: p, carbs_g: c, fat_g: f });
      toast({ title: lang === 'en' ? 'Recalculated ✨' : 'Пересчитано ✨' });
    } catch (e: any) {
      toast({ title: lang === 'en' ? 'Recalc failed' : 'Ошибка пересчёта', description: e?.message, variant: 'destructive' });
    } finally {
      setEditFoodRecalcLoading(false);
    }
  };

  // Computed totals — recover analysis from ai_feedback if ai_analysis is broken
  const analysis = useMemo(() => {
    const raw = log?.ai_analysis;
    // If analysis has valid meals, use it
    if (raw && Array.isArray(raw.meals) && raw.meals.length > 0) return raw;
    // Try to recover from ai_feedback if it contains JSON
    const feedback = log?.ai_feedback;
    if (feedback && typeof feedback === 'string' && (feedback.startsWith('{') || feedback.startsWith('```'))) {
      try {
        const jsonStr = feedback.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const parsed = JSON.parse(jsonStr);
        if (parsed && Array.isArray(parsed.meals)) return parsed;
      } catch { /* ignore parse errors */ }
    }
    return raw;
  }, [log?.ai_analysis, log?.ai_feedback]);

  const aiMeals = (analysis?.meals || []) as any[];
  const manualEntries = ((log?.manual_entries || []) as ManualEntry[]);
  const displayScore = log?.trainer_override_score ?? log?.ai_score;
  const isOverridden = log?.trainer_override_score != null;
  const analysisAtLimit = analysisCount >= MAX_ANALYSES_PER_DAY;

  // IDs of manual entries the AI already analyzed — avoid double-counting
  const includedManualIds = useMemo(() => {
    if (!analysis || analysis.invalidated) return new Set<string>();
    const ids = (analysis.included_manual_ids || []) as string[];
    return new Set(ids);
  }, [analysis]);

  const totals = useMemo(
    () => computeNutritionTotals({
      ai_analysis: analysis,
      manual_entries: manualEntries,
      water_ml: log?.water_ml,
      coffee_cups: log?.coffee_cups,
      tea_cups: log?.tea_cups,
      alcohol_ml: log?.alcohol_ml,
    } as any),
    [analysis, manualEntries, log?.water_ml, log?.coffee_cups, log?.tea_cups, log?.alcohol_ml]
  );


  // Per-meal data
  const mealData = useMemo(() => {
    const data: Record<MealType, { calories: number; protein: number; carbs: number; fat: number; photos: FoodPhoto[]; aiMeal: any; manualItems: ManualEntry[] }> = {
      breakfast: { calories: 0, protein: 0, carbs: 0, fat: 0, photos: [], aiMeal: null, manualItems: [] },
      lunch: { calories: 0, protein: 0, carbs: 0, fat: 0, photos: [], aiMeal: null, manualItems: [] },
      dinner: { calories: 0, protein: 0, carbs: 0, fat: 0, photos: [], aiMeal: null, manualItems: [] },
      snack: { calories: 0, protein: 0, carbs: 0, fat: 0, photos: [], aiMeal: null, manualItems: [] },
    };
    // Photos
    for (const p of photos) {
      const mt = (VALID_MEAL_TYPES.includes(p.meal_type as MealType) ? p.meal_type : 'snack') as MealType;
      data[mt].photos.push(p);
    }
    // AI meals
    for (const m of aiMeals) {
      const mt = (VALID_MEAL_TYPES.includes(m.meal_type) ? m.meal_type : 'snack') as MealType;
      data[mt].aiMeal = m;
      data[mt].calories += m.estimated_calories || 0;
      data[mt].protein += m.protein_g || 0;
      data[mt].carbs += m.carbs_g || 0;
      data[mt].fat += m.fat_g || 0;
    }
    // Manual entries — skip those already counted in AI analysis
    const aiActive = analysis && !analysis.invalidated;
    const hasIncludedList = aiActive && Array.isArray(analysis.included_manual_ids);
    for (const e of manualEntries) {
      const mt = (VALID_MEAL_TYPES.includes(e.meal_type as MealType) ? e.meal_type : 'snack') as MealType;
      data[mt].manualItems.push(e);
      // Already counted by AI analysis
      if (includedManualIds.has(e.id)) continue;
      // Legacy analyses without included list: assume photo items were counted
      if (aiActive && !hasIncludedList && e.photo_id) continue;
      data[mt].calories += e.calories || 0;
      data[mt].protein += e.protein_g || 0;
      data[mt].carbs += e.carbs_g || 0;
      data[mt].fat += e.fat_g || 0;
    }
    return data;
  }, [photos, aiMeals, manualEntries, analysis, includedManualIds]);

  const waterMl = log?.water_ml || 0;
  const coffeeCups = log?.coffee_cups || 0;
  const teaCups = log?.tea_cups || 0;
  const alcoholMl = log?.alcohol_ml || 0;
  const dateLabel = new Date(date + 'T00:00:00').toLocaleDateString(lang === 'en' ? 'en-US' : 'ru-RU', { weekday: 'short', day: 'numeric', month: 'short' });
  const photosAtLimit = photos.length >= MAX_PHOTOS_PER_DAY;

  const macros = [
    { key: 'protein', label: lang === 'en' ? 'Protein' : 'Белки', short: 'P', value: totals.protein, unit: 'g', color: 'hsl(142, 71%, 45%)', macroRatio: 0.30 },
    { key: 'carbs', label: lang === 'en' ? 'Carbs' : 'Углеводы', short: 'C', value: totals.carbs, unit: 'g', color: 'hsl(45, 93%, 47%)', macroRatio: 0.40 },
    { key: 'fat', label: lang === 'en' ? 'Fat' : 'Жиры', short: 'F', value: totals.fat, unit: 'g', color: 'hsl(280, 65%, 60%)', macroRatio: 0.30 },
  ];

  const liquidItems = [
    { key: 'water_ml', emoji: '💧', label: lang === 'en' ? 'Water' : 'Вода', value: waterMl, display: `${(waterMl / 1000).toFixed(1)}л`, step: 250 },
    { key: 'coffee_cups', emoji: '☕', label: lang === 'en' ? 'Coffee' : 'Кофе', value: coffeeCups, display: `${coffeeCups}`, step: 1 },
    { key: 'tea_cups', emoji: '🍵', label: lang === 'en' ? 'Tea' : 'Чай', value: teaCups, display: `${teaCups}`, step: 1 },
    { key: 'alcohol_ml', emoji: '🍷', label: lang === 'en' ? 'Alcohol' : 'Алкоголь', value: alcoholMl, display: `${(alcoholMl / 1000).toFixed(1)}л`, step: 250 },
  ];

  return (
    <div ref={ref} className="space-y-4 pb-4">
      {/* Date Navigation */}
      <div className="flex items-center justify-between px-1">
        <button onClick={() => navigateDate(-1)} className="w-8 h-8 rounded-full bg-secondary/60 flex items-center justify-center active:scale-95 transition-transform">
          <ChevronLeft className="w-4 h-4 text-foreground" />
        </button>
        <div className="text-center">
          <p className="text-sm font-bold text-foreground capitalize">{isToday ? (lang === 'en' ? 'Today' : 'Сегодня') : dateLabel}</p>
          {isToday && <p className="text-[10px] text-muted-foreground capitalize">{dateLabel}</p>}
        </div>
        <button onClick={() => navigateDate(1)} disabled={isToday} className="w-8 h-8 rounded-full bg-secondary/60 flex items-center justify-center active:scale-95 transition-transform disabled:opacity-30">
          <ChevronRight className="w-4 h-4 text-foreground" />
        </button>
      </div>

      {/* 14-day strip — tap a day to open it */}
      <div className="overflow-x-auto -mx-1 px-1 pb-1" data-no-swipe>
        <div className="flex gap-1.5 min-w-max">
          {Array.from({ length: 14 }).map((_, i) => {
            const d = new Date(todayStr + 'T12:00:00');
            d.setDate(d.getDate() - (13 - i));
            const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            const h = history[ds];
            const active = ds === date;
            const kcal = h?.calories || 0;
            const pct = calorieGoal && calorieGoal > 0 ? Math.min(1, kcal / calorieGoal) : (kcal > 0 ? 1 : 0);
            return (
              <button
                key={ds}
                onClick={() => setDate(ds)}
                className={`w-[44px] rounded-xl px-1 py-1.5 flex flex-col items-center gap-1 border transition-colors ${
                  active ? 'bg-primary/15 border-primary/50' : 'bg-secondary/40 border-transparent'
                }`}
              >
                <span className={`text-[9px] font-bold uppercase ${active ? 'text-primary' : 'text-muted-foreground'}`}>
                  {d.toLocaleDateString(lang === 'en' ? 'en-US' : 'ru-RU', { weekday: 'short' })}
                </span>
                <span className="text-[11px] font-extrabold text-foreground">{d.getDate()}</span>
                <span className="w-full h-1 rounded-full bg-border/60 overflow-hidden">
                  <span
                    className="block h-full rounded-full"
                    style={{
                      width: `${pct * 100}%`,
                      background: calorieGoal > 0 && kcal > calorieGoal ? 'hsl(0, 72%, 51%)' : 'hsl(var(--primary))',
                    }}
                  />
                </span>
                <span className="text-[8.5px] text-muted-foreground leading-none">{kcal > 0 ? Math.round(kcal) : '—'}</span>
              </button>
            );
          })}
        </div>
      </div>


      {/* Hero Dashboard — Cal AI inspired large ring + macro rings */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-card border border-border/40 rounded-3xl p-5 relative overflow-hidden">
        <AnimatePresence>
          {analyzing && (
            <motion.div
              initial={{ opacity: 0, height: 0, marginBottom: 0 }}
              animate={{ opacity: 1, height: 'auto', marginBottom: 12 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              className="overflow-hidden"
            >
              <div className="flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-xl px-3 py-2">
                <Loader2 className="w-3.5 h-3.5 text-primary animate-spin flex-shrink-0" />
                <span className="text-[11px] font-semibold text-primary">
                  {lang === 'en' ? 'Recalculating totals & score…' : 'Пересчитываю калории и оценку…'}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* AI Score badge */}
        {displayScore != null && (
          <button
            onClick={() => isTrainer && log?.ai_score != null ? (setOverrideScore(String(log?.trainer_override_score ?? log?.ai_score ?? '')), setOverrideNote(log?.trainer_override_note || ''), setShowOverrideModal(true)) : undefined}
            className={`absolute top-4 right-4 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full ${
              displayScore >= 75 ? 'bg-green-500/15 text-green-400' : displayScore >= 50 ? 'bg-yellow-500/15 text-yellow-400' : 'bg-red-500/15 text-red-400'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="text-sm font-extrabold">{displayScore}</span>
            {isTrainer && <Edit3 className="w-3 h-3 opacity-50" />}
          </button>
        )}

        <div className="flex flex-col items-center pt-2">
          {/* Large calorie ring */}
          <div className="relative">
            <MacroRing
              value={calorieGoal && calorieGoal > 0 ? Math.min(totals.calories, calorieGoal) : totals.calories}
              max={calorieGoal && calorieGoal > 0 ? calorieGoal : Math.max(totals.calories, 1)}
              color={calorieGoal > 0 && totals.calories > calorieGoal ? 'hsl(0, 72%, 51%)' : 'hsl(var(--primary))'}
              size={160}
              strokeWidth={10}
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                {!isToday ? (lang === 'en' ? 'Eaten' : 'Съедено') : (calorieGoal && calorieGoal > 0 ? (lang === 'en' ? 'Remaining' : 'Осталось') : '')}
              </span>
              <span className={`text-5xl font-black tracking-tight mt-0.5 ${calorieGoal > 0 && totals.calories > calorieGoal ? 'text-destructive' : 'text-foreground'}`}>
                <AnimatedNumber value={!isToday ? totals.calories : (calorieGoal && calorieGoal > 0 ? Math.max(0, calorieGoal - totals.calories) : totals.calories)} />
              </span>
              <span className="text-[10px] text-muted-foreground mt-1">
                {calorieGoal && calorieGoal > 0
                  ? `${Math.round(totals.calories)} / ${calorieGoal} ${lang === 'en' ? 'kcal' : 'ккал'}`
                  : (lang === 'en' ? 'kcal consumed' : 'ккал за день')}
              </span>
            </div>
          </div>

          {/* Macro rings — Cal AI style thin rings around/below the main ring */}
          <div className="flex items-center justify-center gap-6 mt-6">
            {macros.map(m => {
              const goal = (calorieGoal && calorieGoal > 0) ? Math.round((calorieGoal * m.macroRatio) / (m.key === 'fat' ? 9 : 4)) : null;
              const ringMax = goal && goal > 0 ? goal : Math.max(m.value, 1);
              const ringValue = goal && goal > 0 ? Math.min(m.value, goal) : m.value;
              const centerValue = !isToday ? m.value : (goal && goal > 0 ? Math.max(0, goal - m.value) : m.value);
              const over = goal && goal > 0 && m.value > goal;
              return (
                <div key={m.key} className="flex flex-col items-center">
                  <div className="relative">
                    <MacroRing value={ringValue} max={ringMax} color={over ? 'hsl(0, 72%, 51%)' : m.color} size={56} strokeWidth={4.5} />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className={`text-[10px] font-bold ${over ? 'text-destructive' : 'text-foreground'}`}>{Math.round(centerValue)}</span>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-muted-foreground mt-1.5 uppercase tracking-wider">{m.short}</span>
                  <span className="text-[9px] text-muted-foreground/80 leading-none mt-0.5">
                    {goal && goal > 0 ? `${Math.round(m.value)}/${goal}${lang === 'en' ? 'g' : 'г'}` : `${Math.round(m.value)}${lang === 'en' ? 'g' : 'г'}`}
                  </span>
                </div>
              );
            })}
          </div>


          {/* How we calculate info */}
          <button
            onClick={() => {
              setShowCalcInfo(true);
              localStorage.setItem('nutrition_calc_info_hint_seen', '1');
              setShowCalcInfoHint(false);
            }}
            className="mt-4 flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            <span className="relative flex items-center justify-center">
              <HelpCircle className="w-4 h-4" />
              {showCalcInfoHint && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-primary rounded-full animate-ping" />
              )}
            </span>
            {lang === 'en' ? 'How we calculate' : 'Как мы считаем'}
          </button>
        </div>
      </motion.div>

      {/* AI Feedback — collapsible */}
      {displayScore != null && (
        <div className={`rounded-2xl border border-border/30 overflow-hidden ${
          displayScore >= 75 ? 'bg-green-500/5' : displayScore >= 50 ? 'bg-yellow-500/5' : 'bg-red-500/5'
        }`}>
          <div
            role="button"
            tabIndex={0}
            onClick={() => {
              setShowFeedback(!showFeedback);
              localStorage.setItem('nutrition_feedback_hint_seen', '1');
              setShowFeedbackHint(false);
            }}
            className="w-full flex items-center justify-between p-3.5 text-left active:bg-secondary/30 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-sm font-bold text-foreground">
                {lang === 'en' ? 'Recommendations' : 'Рекомендации'}
              </span>
              {showFeedbackHint && (
                <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full animate-pulse">
                  {lang === 'en' ? 'Tap to expand' : 'Нажмите, чтобы развернуть'}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              {!isReadOnly && !userId && (
                <button
                  type="button"
                  aria-label={lang === 'en' ? 'Recalculate' : 'Пересчитать'}
                  disabled={analyzing}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAnalyze();
                  }}
                  className="w-7 h-7 rounded-lg bg-secondary/60 flex items-center justify-center text-muted-foreground active:scale-95 transition disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${analyzing ? 'animate-spin' : ''}`} />
                </button>
              )}
              <motion.div animate={{ rotate: showFeedback ? 180 : 0 }} transition={{ duration: 0.2 }}>
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              </motion.div>
            </div>
          </div>

          <AnimatePresence>
            {showFeedback && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden"
              >
                <div className="px-3.5 pb-3.5 space-y-2">
                  {isOverridden && log?.trainer_override_note && (
                    <p className="text-[11px] text-foreground/80 leading-relaxed italic">✏️ {log.trainer_override_note}</p>
                  )}
                  {/* Summary text */}
                  {(() => {
                    const summaryText = (lang === 'en' ? analysis?.summary_en : analysis?.summary_ru) 
                      || analysis?.summary_ru || analysis?.summary_en || '';
                    const cleanSummary = typeof summaryText === 'string' && !summaryText.startsWith('{') && !summaryText.startsWith('```')
                      ? summaryText : '';
                    return cleanSummary ? (
                      <p className="text-[11px] text-muted-foreground leading-relaxed">{cleanSummary}</p>
                    ) : null;
                  })()}
                  {/* Per-meal breakdown */}
                  {analysis?.meals && (analysis.meals as any[]).length > 0 && (
                    <div className="space-y-1.5">
                      {(analysis.meals as any[]).map((m: any, i: number) => {
                        const mealScore = m.score as number;
                        const scoreColor = mealScore >= 75 ? 'text-green-400' : mealScore >= 50 ? 'text-yellow-400' : 'text-red-400';
                        const mealLabel = m.meal_type === 'breakfast' ? (lang === 'en' ? 'Breakfast' : 'Завтрак')
                          : m.meal_type === 'lunch' ? (lang === 'en' ? 'Lunch' : 'Обед')
                          : m.meal_type === 'dinner' ? (lang === 'en' ? 'Dinner' : 'Ужин')
                          : (lang === 'en' ? 'Snack' : 'Перекус');
                        const killers = Array.isArray(m.score_killers) ? m.score_killers : [];
                        return (
                          <div key={i} className="text-[10px]">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-foreground/80">{mealLabel}</span>
                              <span className={`font-bold ${scoreColor}`}>{mealScore}/100</span>
                              {m.estimated_calories > 0 && (
                                <span className="text-muted-foreground/60">· {Math.round(m.estimated_calories)} kcal</span>
                              )}
                            </div>
                            {m.positives?.length > 0 && (
                              <p className="text-green-400/80 ml-2">✓ {(m.positives as string[]).join(', ')}</p>
                            )}
                            {m.issues?.length > 0 && (
                              <p className="text-red-400/80 ml-2">✗ {(m.issues as string[]).join(', ')}</p>
                            )}
                            {killers.length > 0 && (
                              <div className="ml-2 mt-0.5 space-y-0.5">
                                {killers.map((k: any, ki: number) => (
                                  <div key={ki} className="flex items-start gap-1 text-[10px]">
                                    <span className="text-orange-400 font-bold whitespace-nowrap">−{k.points_lost || 0}</span>
                                    <span className="text-muted-foreground">
                                      <span className="text-foreground/70">{k.food}</span>
                                      {' → '}
                                      <span className="text-green-400/90">{lang === 'en' ? (k.swap_en || k.swap_ru) : (k.swap_ru || k.swap_en)}</span>
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {/* Boost potential — motivational card */}
                  {analysis?.boost_potential && Array.isArray((analysis.boost_potential as any).tips) && (analysis.boost_potential as any).tips.length > 0 && (() => {
                    const bp = analysis.boost_potential as any;
                    const current = log?.ai_score ?? 0;
                    const target = Math.max(current, Math.min(95, Number(bp.achievable_today) || current));
                    const delta = target - current;
                    if (delta <= 0) return null;
                    return (
                      <div className="rounded-lg border border-primary/30 bg-gradient-to-br from-primary/10 to-primary/5 p-2.5">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] font-bold text-primary uppercase tracking-wider">
                            🎯 {lang === 'en' ? 'How to boost today' : 'Как добрать сегодня'}
                          </span>
                          <span className="text-[10px] font-bold">
                            <span className="text-muted-foreground">{current}</span>
                            <span className="text-primary"> → {target}%</span>
                            <span className="text-green-400 ml-1">+{delta}</span>
                          </span>
                        </div>
                        <div className="space-y-1">
                          {(bp.tips as any[]).slice(0, 3).map((t: any, ti: number) => (
                            <div key={ti} className="flex items-start gap-1.5 text-[10px]">
                              <span className="text-green-400 font-bold whitespace-nowrap">+{t.points_gain || 0}</span>
                              <span className="text-foreground/85">{lang === 'en' ? (t.action_en || t.action_ru) : (t.action_ru || t.action_en)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                  {isOverridden && log?.ai_score != null && (
                    <p className="text-[10px] text-muted-foreground/60">AI: {log.ai_score}%</p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Meal Cards */}
      <div className="space-y-2.5">
        {MEAL_TYPES.map(mt => {
          const meal = mealData[mt.key];
          const hasContent = meal.photos.length > 0 || meal.manualItems.length > 0;
          const isExpanded = expandedMeal === mt.key;
          const aiDetectedFoods = meal.aiMeal?.detected_foods || [];

          return (
            <motion.div key={mt.key} layout className="bg-card border border-border/40 rounded-2xl overflow-hidden">
              <button
                onClick={() => setExpandedMeal(isExpanded ? null : mt.key)}
                className="w-full flex items-center gap-3 p-3.5 text-left active:bg-secondary/30 transition-colors"
              >
                <span className="text-xl">{mt.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground">{lang === 'en' ? mt.labelEn : mt.labelRu}</p>
                  {hasContent && (
                    <p className="text-[10px] text-muted-foreground">
                      {meal.calories > 0 && `${Math.round(meal.calories)} ${lang === 'en' ? 'kcal' : 'ккал'}`}
                      {meal.protein > 0 && ` · ${Math.round(meal.protein)}P`}
                      {meal.carbs > 0 && ` · ${Math.round(meal.carbs)}C`}
                      {meal.fat > 0 && ` · ${Math.round(meal.fat)}F`}
                    </p>
                  )}
                </div>
                {/* Photo thumbnails */}
                {meal.photos.length > 0 && (
                  <div className="flex -space-x-2">
                    {meal.photos.slice(0, 3).map(p => (
                      <img key={p.id} src={p.photo_url} className="w-8 h-8 rounded-lg object-cover border-2 border-card" />
                    ))}
                    {meal.photos.length > 3 && (
                      <div className="w-8 h-8 rounded-lg bg-secondary/80 border-2 border-card flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                        +{meal.photos.length - 3}
                      </div>
                    )}
                  </div>
                )}
                {!hasContent && (
                  <span className="text-[10px] text-muted-foreground/50">{lang === 'en' ? 'No entries' : 'Пусто'}</span>
                )}
              </button>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-3.5 pb-3.5 space-y-2">
                      {/* Photos grid */}
                      {meal.photos.length > 0 && (
                        <div className="grid grid-cols-3 gap-1.5">
                          {meal.photos.map(photo => {
                            const score = meal.aiMeal?.score ?? displayScore;
                            return (
                              <motion.button key={photo.id} whileTap={{ scale: 0.95 }} onClick={() => setSelectedPhoto(photo)}
                                className="relative rounded-xl overflow-hidden aspect-square">
                                <img src={photo.photo_url} alt="" className="w-full h-full object-cover" />
                                {score != null && <ScoreBadge score={score} className="absolute top-1.5 right-1.5 z-10" />}
                                <span className="absolute bottom-0.5 left-0.5 text-[7px] bg-black/50 text-white/80 px-1 py-0.5 rounded">
                                  {photo.meal_time ? photo.meal_time.slice(0, 5) : new Date(photo.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </motion.button>
                            );
                          })}
                        </div>
                      )}

                      {/* AI detected ingredients */}
                      {aiDetectedFoods.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
                            {lang === 'en' ? 'Detected' : 'Обнаружено'}
                          </p>
                          {aiDetectedFoods.map((food: any, i: number) => {
                            const f = typeof food === 'string' ? { name: food } : food;
                            const isEditing = editingFood?.mealType === mt.key && editingFood?.index === i;
                            
                            if (isEditing) {
                              return (
                                <div key={i} className="bg-secondary/50 rounded-xl p-3 space-y-2 border border-primary/30">
                                  <input value={editFoodName} onChange={e => setEditFoodName(e.target.value)}
                                    className="w-full bg-background border border-border/50 rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary/50"
                                    placeholder={lang === 'en' ? 'Food name' : 'Название'} />
                                  <div className="grid grid-cols-5 gap-1.5">
                                     <div>
                                      <label className="text-[8px] text-muted-foreground block mb-0.5">g</label>
                                      <input type="number" value={editFoodPortion} onChange={e => handlePortionChange(e.target.value)}
                                        className="w-full bg-background border border-border/50 rounded-lg px-1.5 py-1 text-[11px] text-foreground focus:outline-none focus:border-primary/50" />
                                    </div>
                                    <div>
                                      <label className="text-[8px] text-muted-foreground block mb-0.5">kcal</label>
                                      <input type="number" value={editFoodCal} onChange={e => setEditFoodCal(e.target.value)}
                                        className="w-full bg-background border border-border/50 rounded-lg px-1.5 py-1 text-[11px] text-foreground focus:outline-none focus:border-primary/50" />
                                    </div>
                                    <div>
                                      <label className="text-[8px] text-muted-foreground block mb-0.5">P</label>
                                      <input type="number" value={editFoodProtein} onChange={e => setEditFoodProtein(e.target.value)}
                                        className="w-full bg-background border border-border/50 rounded-lg px-1.5 py-1 text-[11px] text-foreground focus:outline-none focus:border-primary/50" />
                                    </div>
                                    <div>
                                      <label className="text-[8px] text-muted-foreground block mb-0.5">C</label>
                                      <input type="number" value={editFoodCarbs} onChange={e => setEditFoodCarbs(e.target.value)}
                                        className="w-full bg-background border border-border/50 rounded-lg px-1.5 py-1 text-[11px] text-foreground focus:outline-none focus:border-primary/50" />
                                    </div>
                                    <div>
                                      <label className="text-[8px] text-muted-foreground block mb-0.5">F</label>
                                      <input type="number" value={editFoodFat} onChange={e => setEditFoodFat(e.target.value)}
                                        className="w-full bg-background border border-border/50 rounded-lg px-1.5 py-1 text-[11px] text-foreground focus:outline-none focus:border-primary/50" />
                                    </div>
                                  </div>
                                  <button
                                    onClick={handleRecalcFoodMacros}
                                    disabled={editFoodRecalcLoading || !editFoodName.trim()}
                                    className="w-full h-7 rounded-lg bg-primary/10 border border-primary/30 text-[10px] font-bold text-primary disabled:opacity-50 flex items-center justify-center gap-1"
                                  >
                                    {editFoodRecalcLoading
                                      ? <Loader2 className="w-3 h-3 animate-spin" />
                                      : <Sparkles className="w-3 h-3" />}
                                    {lang === 'en' ? 'Recalculate KBJU from name & portion' : 'Пересчитать КБЖУ по названию и порции'}
                                  </button>
                                  <div className="flex gap-1.5">
                                    <button onClick={() => { setEditingFood(null); setEditFoodOrig(null); }} className="flex-1 h-8 rounded-lg bg-secondary/50 text-[11px] font-bold text-muted-foreground">
                                      {lang === 'en' ? 'Cancel' : 'Отмена'}
                                    </button>
                                    <button onClick={() => { handleEditAiFood(); setEditFoodOrig(null); }} className="flex-1 h-8 rounded-lg bg-primary text-[11px] font-bold text-primary-foreground">
                                      <Check className="w-3 h-3 inline mr-1" />{lang === 'en' ? 'Save' : 'OK'}
                                    </button>
                                  </div>
                                </div>
                              );
                            }

                            return (
                              <div key={i} className="flex items-center justify-between bg-secondary/30 rounded-xl px-3 py-2 group">
                                <button onClick={() => !isReadOnly && startEditFood(mt.key, i, f)} className="flex-1 min-w-0 text-left">
                                  <p className="text-xs font-medium text-foreground truncate">{f.name}</p>
                                  {f.portion_g && <p className="text-[10px] text-muted-foreground">{f.portion_g}g</p>}
                                </button>
                                <div className="flex items-center gap-2">
                                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                                    {f.calories && <span className="font-bold text-foreground">{f.calories}</span>}
                                    {f.protein_g != null && <span style={{ color: 'hsl(142, 71%, 45%)' }}>P{f.protein_g}</span>}
                                    {f.carbs_g != null && <span style={{ color: 'hsl(45, 93%, 47%)' }}>C{f.carbs_g}</span>}
                                    {f.fat_g != null && <span style={{ color: 'hsl(280, 65%, 60%)' }}>F{f.fat_g}</span>}
                                  </div>
                                  {(!isReadOnly || isTrainer) && (
                                    <button onClick={() => handleDeleteAiFood(mt.key, i)} className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground/40 hover:text-destructive transition-colors">
                                      <X className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* AI meal score bar */}
                      {meal.aiMeal?.score != null && (
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-muted/30 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${
                              meal.aiMeal.score >= 75 ? 'bg-green-400' : meal.aiMeal.score >= 50 ? 'bg-yellow-400' : 'bg-red-400'
                            }`} style={{ width: `${meal.aiMeal.score}%` }} />
                          </div>
                          <span className={`text-[10px] font-bold ${scoreColor(meal.aiMeal.score)}`}>{meal.aiMeal.score}%</span>
                        </div>
                      )}

                      {/* Manual entries */}
                      {meal.manualItems.map(entry => {
                        const isEditingManual = editingManualId === entry.id;
                        if (isEditingManual) {
                          return (
                            <div key={entry.id} className="bg-secondary/50 rounded-xl p-3 space-y-2 border border-primary/30">
                              <input value={editManualName} onChange={e => setEditManualName(e.target.value)}
                                className="w-full bg-background border border-border/50 rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary/50"
                                placeholder={lang === 'en' ? 'Food name' : 'Название'} />
                              <div className="grid grid-cols-5 gap-1.5">
                                <div>
                                  <label className="text-[8px] text-muted-foreground block mb-0.5">g</label>
                                  <input type="number" value={editManualPortion} onChange={e => handleManualPortionChange(e.target.value)}
                                    className="w-full bg-background border border-border/50 rounded-lg px-1.5 py-1 text-[11px] text-foreground focus:outline-none focus:border-primary/50" />
                                </div>
                                <div>
                                  <label className="text-[8px] text-muted-foreground block mb-0.5">kcal</label>
                                  <input type="number" value={editManualCal} onChange={e => setEditManualCal(e.target.value)}
                                    className="w-full bg-background border border-border/50 rounded-lg px-1.5 py-1 text-[11px] text-foreground focus:outline-none focus:border-primary/50" />
                                </div>
                                <div>
                                  <label className="text-[8px] text-muted-foreground block mb-0.5">P</label>
                                  <input type="number" value={editManualProtein} onChange={e => setEditManualProtein(e.target.value)}
                                    className="w-full bg-background border border-border/50 rounded-lg px-1.5 py-1 text-[11px] text-foreground focus:outline-none focus:border-primary/50" />
                                </div>
                                <div>
                                  <label className="text-[8px] text-muted-foreground block mb-0.5">C</label>
                                  <input type="number" value={editManualCarbs} onChange={e => setEditManualCarbs(e.target.value)}
                                    className="w-full bg-background border border-border/50 rounded-lg px-1.5 py-1 text-[11px] text-foreground focus:outline-none focus:border-primary/50" />
                                </div>
                                <div>
                                  <label className="text-[8px] text-muted-foreground block mb-0.5">F</label>
                                  <input type="number" value={editManualFat} onChange={e => setEditManualFat(e.target.value)}
                                    className="w-full bg-background border border-border/50 rounded-lg px-1.5 py-1 text-[11px] text-foreground focus:outline-none focus:border-primary/50" />
                                </div>
                              </div>
                              <button
                                onClick={handleRecalcManualMacros}
                                disabled={editManualRecalcLoading || !editManualName.trim()}
                                className="w-full h-7 rounded-lg bg-primary/10 border border-primary/30 text-[10px] font-bold text-primary disabled:opacity-50 flex items-center justify-center gap-1"
                              >
                                {editManualRecalcLoading
                                  ? <Loader2 className="w-3 h-3 animate-spin" />
                                  : <Sparkles className="w-3 h-3" />}
                                {lang === 'en' ? 'Recalculate KBJU from name & portion' : 'Пересчитать КБЖУ по названию и порции'}
                              </button>
                              <div className="flex gap-1.5">
                                <button onClick={() => { setEditingManualId(null); setEditManualOrig(null); }} className="flex-1 h-8 rounded-lg bg-secondary/50 text-[11px] font-bold text-muted-foreground">
                                  {lang === 'en' ? 'Cancel' : 'Отмена'}
                                </button>
                                <button onClick={handleSaveManualEntry} className="flex-1 h-8 rounded-lg bg-primary text-[11px] font-bold text-primary-foreground">
                                  <Check className="w-3 h-3 inline mr-1" />{lang === 'en' ? 'Save' : 'OK'}
                                </button>
                              </div>
                            </div>
                          );
                        }
                        return (
                          <div key={entry.id} className="flex items-center justify-between gap-2 bg-secondary/30 rounded-xl px-2 py-2">
                            {!isReadOnly && (
                              <button
                                type="button"
                                aria-label={lang === 'en' ? 'Edit entry' : 'Редактировать запись'}
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  startEditManual(entry);
                                }}
                                className="w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-primary active:bg-secondary/60 transition-colors flex-shrink-0"
                              >
                                <PencilLine className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (!isReadOnly) startEditManual(entry);
                              }}
                              disabled={isReadOnly}
                              className="flex-1 min-w-0 text-left disabled:cursor-default"
                            >
                              <p className="text-xs font-medium text-foreground truncate">{entry.name}</p>
                              <p className="text-[10px] text-muted-foreground">
                                {entry.calories}{lang === 'en' ? 'kcal' : 'ккал'}
                                {entry.protein_g > 0 && ` · P${entry.protein_g}`}
                                {entry.carbs_g > 0 && ` · C${entry.carbs_g}`}
                                {entry.fat_g > 0 && ` · F${entry.fat_g}`}
                              </p>
                            </button>
                            {(!isReadOnly || isTrainer) && (
                              confirmDeleteManualId === entry.id ? (
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  <button
                                    type="button"
                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirmDeleteManualId(null); }}
                                    className="h-8 px-2 rounded-lg bg-secondary/50 text-[11px] font-bold text-muted-foreground"
                                  >
                                    {lang === 'en' ? 'Cancel' : 'Отмена'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDeleteManualEntry(entry.id); setConfirmDeleteManualId(null); }}
                                    className="h-8 px-2 rounded-lg bg-destructive text-[11px] font-bold text-destructive-foreground"
                                  >
                                    <Check className="w-3 h-3 inline mr-1" />{lang === 'en' ? 'Delete' : 'Удалить'}
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirmDeleteManualId(entry.id); }}
                                  className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors flex-shrink-0"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              )
                            )}
                          </div>
                        );
                      })}


                      {!hasContent && (
                        <p className="text-center text-[11px] text-muted-foreground/50 py-2">
                          {lang === 'en' ? 'No food logged' : 'Ничего не записано'}
                        </p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      {/* Liquids section */}
      <button onClick={() => setShowLiquids(!showLiquids)}
        className="w-full flex items-center justify-between bg-card border border-border/40 rounded-2xl p-3.5 active:bg-secondary/30 transition-colors">
        <div className="flex items-center gap-2">
          <Droplets className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-bold text-foreground">{lang === 'en' ? 'Liquids' : 'Жидкости'}</span>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          {waterMl > 0 && <span>💧{(waterMl / 1000).toFixed(1)}л</span>}
          {coffeeCups > 0 && <span>☕{coffeeCups}</span>}
          {teaCups > 0 && <span>🍵{teaCups}</span>}
          {alcoholMl > 0 && <span>🍷{(alcoholMl / 1000).toFixed(1)}л</span>}
        </div>
      </button>

      <AnimatePresence>
        {showLiquids && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden">
            <div className="grid grid-cols-2 gap-2">
              {liquidItems.map(item => (
                <div key={item.key} className="bg-card border border-border/40 rounded-2xl p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{item.emoji}</span>
                    <div>
                      <p className="text-[10px] text-muted-foreground">{item.label}</p>
                      <p className="text-sm font-extrabold text-foreground">{item.display}</p>
                    </div>
                  </div>
                  {!isReadOnly && !userId && (
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => upsertLog(item.key, Math.max(0, item.value - item.step))} disabled={item.value <= 0}
                        className="flex-1 h-7 rounded-lg bg-secondary/50 flex items-center justify-center active:scale-95 disabled:opacity-30">
                        <Minus className="w-3 h-3 text-muted-foreground" />
                      </button>
                      <button onClick={() => upsertLog(item.key, item.value + item.step)}
                        className="flex-[2] h-7 rounded-lg bg-primary/15 flex items-center justify-center active:scale-95">
                        <Plus className="w-3 h-3 text-primary" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Analysis status — fully automatic, no manual button.
          Shows a subtle spinner while running, or a retry button only when the previous
          analysis failed (so the user is never stuck). */}
      {(() => {
        const hasFood = photos.length > 0 || manualEntries.length > 0;
        if (!hasFood) return null;
        const fb = (log?.ai_feedback || '') as string;
        const analysisFailed = /Не удалось обработать|Failed to process/i.test(fb);
        if (analyzing) {
          return (
            <div className="w-full flex items-center justify-center gap-2 border rounded-2xl p-3 bg-primary/10 border-primary/20">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <span className="text-xs font-semibold text-primary">
                {lang === 'en' ? 'Analyzing your meals…' : 'Анализирую приёмы пищи…'}
              </span>
            </div>
          );
        }
        if (analysisFailed && !analysisAtLimit) {
          return (
            <motion.button whileTap={{ scale: 0.97 }} onClick={() => handleAnalyze()}
              className="w-full flex items-center justify-center gap-2 border rounded-2xl p-3 bg-destructive/10 hover:bg-destructive/20 border-destructive/30">
              <Sparkles className="w-4 h-4 text-destructive" />
              <span className="text-sm font-bold text-destructive">
                {lang === 'en' ? 'Retry analysis' : 'Повторить анализ'}
              </span>
            </motion.button>
          );
        }
        if (log?.ai_score != null && !analysisAtLimit) {
          return (
            <motion.button whileTap={{ scale: 0.97 }} onClick={() => handleAnalyze()}
              className="w-full flex items-center justify-center gap-2 border rounded-2xl p-2.5 bg-muted/40 hover:bg-muted/60 border-border/40">
              <Sparkles className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-[11px] font-semibold text-muted-foreground">
                {lang === 'en' ? 'Totals & score update automatically · tap to recalculate' : 'Калории и оценка обновляются автоматически · нажмите для пересчёта'}
              </span>
            </motion.button>
          );
        }
        return null;
      })()}


      {/* FAB - Add meal */}
      {!isReadOnly && !userId && (
        <div className="fixed z-[90] right-4" style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 72px)' }}>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => setShowAddMenu(true)}
            className="w-14 h-14 rounded-full bg-primary shadow-lg shadow-primary/30 flex items-center justify-center"
          >
            <Plus className="w-6 h-6 text-primary-foreground" />
          </motion.button>
        </div>
      )}

      {/* Hidden file inputs */}
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { setShowSourcePicker(false); handleFileSelect(e); }} disabled={uploading} />
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { setShowSourcePicker(false); handleFileSelect(e); }} disabled={uploading} />

      {/* Add Menu Modal */}
      <AnimatePresence>
        {showAddMenu && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAddMenu(false)}
            className="fixed inset-0 z-[200] bg-black/60 flex items-end justify-center pb-[calc(env(safe-area-inset-bottom,0px)+60px)]">
            <motion.div initial={{ y: 200 }} animate={{ y: 0 }} exit={{ y: 200 }} transition={{ type: 'spring', damping: 25 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-md bg-card rounded-3xl p-5 pb-6 space-y-2 border border-border/40">
              <div className="w-10 h-1 bg-muted-foreground/20 rounded-full mx-auto mb-3" />
              <p className="text-sm font-bold text-foreground text-center mb-2">
                {lang === 'en' ? 'Add meal' : 'Добавить приём пищи'}
              </p>

              <button onClick={() => {
                  setShowAddMenu(false);
                  // Auto-infer meal & time from current time of day
                  const now = new Date();
                  const h = now.getHours();
                  const inferred: MealType = h < 11 ? 'breakfast' : h < 16 ? 'lunch' : h < 22 ? 'dinner' : 'snack';
                  setPendingMealType(inferred);
                  const hh = String(h).padStart(2, '0');
                  const mm = String(Math.floor(now.getMinutes() / 15) * 15).padStart(2, '0');
                  setPendingMealTime(`${hh}:${mm}`);
                  setShowSourcePicker(true);
                }}
                disabled={photosAtLimit || uploading}
                className="w-full flex items-center gap-3 bg-secondary/50 hover:bg-secondary/70 rounded-2xl p-4 transition-colors active:scale-[0.98] disabled:opacity-40">
                <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
                  <Camera className="w-5 h-5 text-primary" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-bold text-foreground">{lang === 'en' ? 'Take photo' : 'Сфотографировать еду'}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {photosAtLimit
                      ? (lang === 'en' ? `Daily photo limit reached (${MAX_PHOTOS_PER_DAY}) — use Quick add` : `Лимит фото на сегодня (${MAX_PHOTOS_PER_DAY}) — используйте быстрый ввод`)
                      : (lang === 'en' ? 'AI will detect food and macros' : 'ИИ определит еду и КБЖУ')}
                  </p>
                </div>
              </button>


              <button onClick={() => { setShowAddMenu(false); const now = new Date(); const h = now.getHours(); setQuickAddMeal(h < 11 ? 'breakfast' : h < 16 ? 'lunch' : h < 22 ? 'dinner' : 'snack'); setQuickAddTime(`${String(h).padStart(2,'0')}:00`); setShowQuickAdd(true); }}
                className="w-full flex items-center gap-3 bg-secondary/50 hover:bg-secondary/70 rounded-2xl p-4 transition-colors active:scale-[0.98]">
                <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
                  <PencilLine className="w-5 h-5 text-primary" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-bold text-foreground">{lang === 'en' ? 'Quick add' : 'Быстрый ввод'}</p>
                  <p className="text-[10px] text-muted-foreground">{lang === 'en' ? 'Enter calories and macros manually' : 'Ввести КБЖУ вручную'}</p>
                </div>
              </button>

              <button onClick={() => setShowAddMenu(false)}
                className="w-full text-xs text-muted-foreground py-3 text-center">
                {lang === 'en' ? 'Cancel' : 'Отмена'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Combined Meal + Time + Source Picker Modal */}
      <AnimatePresence>
        {showSourcePicker && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowSourcePicker(false)}
            className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-sm bg-card rounded-3xl p-5 space-y-4 border border-border/40">
              <p className="text-sm font-bold text-foreground text-center">{lang === 'en' ? 'Meal & time' : 'Приём пищи и время'}</p>

              <div className="grid grid-cols-2 gap-2">
                {MEAL_TYPES.map(mt => {
                  const selected = pendingMealType === mt.key;
                  return (
                    <button key={mt.key} onClick={() => setPendingMealType(mt.key)}
                      className={`flex items-center gap-2.5 rounded-2xl p-3 transition-colors active:scale-95 border ${
                        selected ? 'bg-primary/15 border-primary/60' : 'bg-secondary/50 hover:bg-secondary/70 border-transparent'
                      }`}>
                      <span className="text-xl">{mt.emoji}</span>
                      <span className="text-sm font-bold text-foreground">{lang === 'en' ? mt.labelEn : mt.labelRu}</span>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center justify-center">
                <input type="time" value={pendingMealTime} onChange={e => setPendingMealTime(e.target.value)}
                  className="bg-secondary/50 border border-border/50 rounded-2xl px-5 py-2.5 text-xl font-bold text-foreground text-center focus:outline-none focus:border-primary/50" />
              </div>

              <div className="pt-1 space-y-2">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground text-center">{lang === 'en' ? 'Photo source' : 'Источник фото'}</p>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => { setShowSourcePicker(false); cameraRef.current?.click(); }}
                    disabled={!pendingMealType}
                    className="flex flex-col items-center gap-1.5 bg-primary/15 hover:bg-primary/25 rounded-2xl p-4 transition-colors active:scale-95 disabled:opacity-40">
                    <Camera className="w-5 h-5 text-primary" />
                    <span className="text-sm font-bold text-foreground">{lang === 'en' ? 'Camera' : 'Камера'}</span>
                  </button>
                  <button onClick={() => { setShowSourcePicker(false); fileRef.current?.click(); }}
                    disabled={!pendingMealType}
                    className="flex flex-col items-center gap-1.5 bg-secondary/50 hover:bg-secondary/70 rounded-2xl p-4 transition-colors active:scale-95 disabled:opacity-40">
                    <ImagePlus className="w-5 h-5 text-primary" />
                    <span className="text-sm font-bold text-foreground">{lang === 'en' ? 'Gallery' : 'Галерея'}</span>
                  </button>
                </div>
              </div>

              <button onClick={() => setShowSourcePicker(false)} className="w-full text-xs text-muted-foreground py-2 text-center">
                {lang === 'en' ? 'Cancel' : 'Отмена'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>



      {/* Quick Add Modal */}
      <AnimatePresence>
        {showQuickAdd && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowQuickAdd(false)}
            className="fixed inset-0 z-[200] bg-black/60 flex items-end justify-center pb-[calc(env(safe-area-inset-bottom,0px)+60px)]">
            <motion.div initial={{ y: 200 }} animate={{ y: 0 }} exit={{ y: 200 }} transition={{ type: 'spring', damping: 25 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-md bg-card rounded-3xl p-5 pb-6 space-y-4 border border-border/40">
              <div className="w-10 h-1 bg-muted-foreground/20 rounded-full mx-auto" />
              <p className="text-sm font-bold text-foreground text-center">{lang === 'en' ? 'Quick Add' : 'Быстрый ввод'}</p>

              {/* Meal type selector */}
              <div className="flex gap-1.5">
                {MEAL_TYPES.map(mt => (
                  <button key={mt.key} onClick={() => setQuickAddMeal(mt.key)}
                    className={`flex-1 py-2 rounded-xl text-[10px] font-bold transition-colors ${
                      quickAddMeal === mt.key ? 'bg-primary text-primary-foreground' : 'bg-secondary/50 text-muted-foreground'
                    }`}>
                    {mt.emoji} {lang === 'en' ? mt.labelEn.slice(0, 4) : mt.labelRu.slice(0, 4)}
                  </button>
                ))}
              </div>

              <div className="relative">
                <input value={quickAddName} onChange={e => {
                  const val = e.target.value;
                  setQuickAddName(val);
                  setFoodSuggestions([]);
                  if (suggestTimeoutRef.current) clearTimeout(suggestTimeoutRef.current);
                  if (val.trim().length >= 2) {
                    setSuggestLoading(true);
                    suggestTimeoutRef.current = setTimeout(async () => {
                      try {
                        const { data, error } = await supabase.functions.invoke('food-suggest', {
                          body: { query: val.trim(), lang },
                        });
                        if (!error && data?.suggestions) {
                          setFoodSuggestions(data.suggestions);
                        }
                      } catch {} finally {
                        setSuggestLoading(false);
                      }
                    }, 500);
                  } else {
                    setSuggestLoading(false);
                  }
                }}
                  placeholder={lang === 'en' ? 'Food name (e.g. chicken)' : 'Название (напр. кальмары)'}
                  className="w-full h-10 bg-secondary/50 border border-border/40 rounded-xl px-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                {suggestLoading && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  </div>
                )}
                {foodSuggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-10 mt-1 max-h-48 overflow-y-auto bg-card border border-border/60 rounded-xl shadow-lg">
                    {foodSuggestions.map((s: any, i: number) => (
                      <button key={i} onClick={() => {
                        setQuickAddName(lang === 'en' ? s.name_en : s.name_ru);
                        const base = { cal: s.calories || 0, protein: s.protein_g || 0, carbs: s.carbs_g || 0, fat: s.fat_g || 0 };
                        setQuickAddBase(base);
                        setQuickAddPortion('100');
                        setQuickAddCal(String(base.cal));
                        setQuickAddProtein(String(base.protein));
                        setQuickAddCarbs(String(base.carbs));
                        setQuickAddFat(String(base.fat));
                        setFoodSuggestions([]);
                      }}
                        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-secondary/50 active:bg-secondary/70 transition-colors border-b border-border/20 last:border-0">
                        <div className="text-left">
                          <p className="text-sm font-medium text-foreground">{lang === 'en' ? s.name_en : s.name_ru}</p>
                          <p className="text-[10px] text-muted-foreground">{s.portion_g}g • {s.calories}kcal</p>
                        </div>
                        <div className="text-[9px] text-muted-foreground text-right">
                          <span className="text-blue-400">P{s.protein_g}</span>{' '}
                          <span className="text-amber-400">C{s.carbs_g}</span>{' '}
                          <span className="text-orange-400">F{s.fat_g}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Portion size with +/- */}
              {quickAddBase && (
                <div>
                  <label className="text-[9px] font-bold text-muted-foreground uppercase mb-1 block">{lang === 'en' ? 'Portion' : 'Порция'} (g)</label>
                  <div className="flex items-center gap-2">
                    <button onClick={() => {
                      const cur = Math.max(25, (parseInt(quickAddPortion) || 100) - 25);
                      setQuickAddPortion(String(cur));
                      const m = cur / 100;
                      setQuickAddCal(String(Math.round(quickAddBase.cal * m)));
                      setQuickAddProtein(String(Math.round(quickAddBase.protein * m)));
                      setQuickAddCarbs(String(Math.round(quickAddBase.carbs * m)));
                      setQuickAddFat(String(Math.round(quickAddBase.fat * m)));
                    }} className="w-10 h-10 rounded-xl bg-secondary/50 flex items-center justify-center active:scale-95">
                      <Minus className="w-4 h-4 text-muted-foreground" />
                    </button>
                    <input type="number" value={quickAddPortion} onChange={e => {
                      const val = e.target.value;
                      setQuickAddPortion(val);
                      const g = parseInt(val) || 0;
                      if (g > 0) {
                        const m = g / 100;
                        setQuickAddCal(String(Math.round(quickAddBase.cal * m)));
                        setQuickAddProtein(String(Math.round(quickAddBase.protein * m)));
                        setQuickAddCarbs(String(Math.round(quickAddBase.carbs * m)));
                        setQuickAddFat(String(Math.round(quickAddBase.fat * m)));
                      }
                    }}
                      className="flex-1 h-10 bg-secondary/50 border border-border/40 rounded-xl px-3 text-sm text-foreground text-center font-bold focus:outline-none focus:ring-2 focus:ring-primary/50" />
                    <button onClick={() => {
                      const cur = (parseInt(quickAddPortion) || 100) + 25;
                      setQuickAddPortion(String(cur));
                      const m = cur / 100;
                      setQuickAddCal(String(Math.round(quickAddBase.cal * m)));
                      setQuickAddProtein(String(Math.round(quickAddBase.protein * m)));
                      setQuickAddCarbs(String(Math.round(quickAddBase.carbs * m)));
                      setQuickAddFat(String(Math.round(quickAddBase.fat * m)));
                    }} className="w-10 h-10 rounded-xl bg-secondary/50 flex items-center justify-center active:scale-95">
                      <Plus className="w-4 h-4 text-muted-foreground" />
                    </button>
                  </div>
                  <div className="flex gap-1 mt-1.5">
                    {[50, 100, 150, 200, 250, 300].map(g => (
                      <button key={g} onClick={() => {
                        setQuickAddPortion(String(g));
                        const m = g / 100;
                        setQuickAddCal(String(Math.round(quickAddBase.cal * m)));
                        setQuickAddProtein(String(Math.round(quickAddBase.protein * m)));
                        setQuickAddCarbs(String(Math.round(quickAddBase.carbs * m)));
                        setQuickAddFat(String(Math.round(quickAddBase.fat * m)));
                      }}
                        className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-colors ${
                          quickAddPortion === String(g) ? 'bg-primary text-primary-foreground' : 'bg-secondary/40 text-muted-foreground'
                        }`}>
                        {g}g
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] font-bold text-muted-foreground uppercase mb-1 block">{lang === 'en' ? 'Calories' : 'Калории'}</label>
                  <input type="number" value={quickAddCal} onChange={e => { setQuickAddCal(e.target.value); setQuickAddBase(null); }}
                    placeholder="0" className="w-full h-10 bg-secondary/50 border border-border/40 rounded-xl px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
                </div>
                <div>
                  <label className="text-[9px] font-bold text-muted-foreground uppercase mb-1 block">{lang === 'en' ? 'Protein' : 'Белки'} (g)</label>
                  <input type="number" value={quickAddProtein} onChange={e => { setQuickAddProtein(e.target.value); setQuickAddBase(null); }}
                    placeholder="0" className="w-full h-10 bg-secondary/50 border border-border/40 rounded-xl px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
                </div>
                <div>
                  <label className="text-[9px] font-bold text-muted-foreground uppercase mb-1 block">{lang === 'en' ? 'Carbs' : 'Углеводы'} (g)</label>
                  <input type="number" value={quickAddCarbs} onChange={e => { setQuickAddCarbs(e.target.value); setQuickAddBase(null); }}
                    placeholder="0" className="w-full h-10 bg-secondary/50 border border-border/40 rounded-xl px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
                </div>
                <div>
                  <label className="text-[9px] font-bold text-muted-foreground uppercase mb-1 block">{lang === 'en' ? 'Fat' : 'Жиры'} (g)</label>
                  <input type="number" value={quickAddFat} onChange={e => { setQuickAddFat(e.target.value); setQuickAddBase(null); }}
                    placeholder="0" className="w-full h-10 bg-secondary/50 border border-border/40 rounded-xl px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
                </div>
              </div>

              {/* Time picker */}
              <div className="flex items-center justify-between">
                <label className="text-[9px] font-bold text-muted-foreground uppercase">{lang === 'en' ? 'Time' : 'Время'}</label>
                <div className="flex items-center gap-2">
                  <button onClick={() => {
                    const [h] = (quickAddTime || '12:00').split(':').map(Number);
                    const newH = (h - 1 + 24) % 24;
                    setQuickAddTime(`${String(newH).padStart(2, '0')}:00`);
                  }} className="w-8 h-8 rounded-lg bg-secondary/50 flex items-center justify-center active:scale-95 text-muted-foreground">
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <input type="time" value={quickAddTime} onChange={e => setQuickAddTime(e.target.value)}
                    className="bg-secondary/50 border border-border/40 rounded-xl px-3 py-1.5 text-sm font-bold text-foreground text-center focus:outline-none focus:ring-2 focus:ring-primary/50 w-24" />
                  <button onClick={() => {
                    const [h] = (quickAddTime || '12:00').split(':').map(Number);
                    const newH = (h + 1) % 24;
                    setQuickAddTime(`${String(newH).padStart(2, '0')}:00`);
                  }} className="w-8 h-8 rounded-lg bg-secondary/50 flex items-center justify-center active:scale-95 text-muted-foreground">
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="flex gap-2">
                <button onClick={() => setShowQuickAdd(false)} className="flex-1 h-11 rounded-xl bg-secondary/50 text-sm font-bold text-muted-foreground active:scale-95">
                  {lang === 'en' ? 'Cancel' : 'Отмена'}
                </button>
                <button onClick={handleQuickAdd} className="flex-1 h-11 rounded-xl bg-primary text-sm font-bold text-primary-foreground active:scale-95">
                  <Check className="w-4 h-4 inline mr-1" />{lang === 'en' ? 'Add' : 'Добавить'}
                </button>
              </div>
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
              className="w-full max-w-md bg-card rounded-3xl p-5 space-y-4 border border-border/40">
              <p className="text-sm font-bold text-foreground text-center">{lang === 'en' ? 'Override Score' : 'Корректировка оценки'}</p>
              <div>
                <label className="text-[9px] font-bold text-muted-foreground uppercase mb-1 block">{lang === 'en' ? 'Score (0-100)' : 'Оценка (0-100)'}</label>
                <input type="number" min="0" max="100" value={overrideScore} onChange={e => setOverrideScore(e.target.value)}
                  className="w-full h-10 bg-secondary/50 border border-border/40 rounded-xl px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </div>
              <div>
                <label className="text-[9px] font-bold text-muted-foreground uppercase mb-1 block">{lang === 'en' ? 'Note' : 'Комментарий'}</label>
                <textarea value={overrideNote} onChange={e => setOverrideNote(e.target.value)} rows={2}
                  className="w-full bg-secondary/50 border border-border/40 rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                  placeholder={lang === 'en' ? 'Optional note' : 'Необязательный комментарий'} />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowOverrideModal(false)} className="flex-1 h-10 rounded-xl bg-secondary/50 text-xs font-bold text-muted-foreground">{lang === 'en' ? 'Cancel' : 'Отмена'}</button>
                <button onClick={handleTrainerOverride} className="flex-1 h-10 rounded-xl bg-primary text-xs font-bold text-primary-foreground">{lang === 'en' ? 'Save' : 'Сохранить'}</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Calculation Info Modal — same detailed info as in ClientSettings */}
      <AnimatePresence>
        {showCalcInfo && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setShowCalcInfo(false)}
            className="fixed inset-0 z-[200] bg-black/50 flex items-end justify-center p-4 pb-[calc(env(safe-area-inset-bottom,0px)+72px)]">
            <motion.div initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-md bg-card/95 backdrop-blur-md rounded-3xl border border-border/40 max-h-[70vh] flex flex-col overflow-hidden">
              {/* Sticky header — close button stays visible while scrolling */}
              <div className="sticky top-0 z-10 bg-card/95 backdrop-blur-md border-b border-border/30 px-5 pt-4 pb-3 flex items-center justify-between shrink-0">
                <p className="text-sm font-bold text-foreground">
                  {lang === 'en' ? 'How we calculate' : 'Как мы считаем'}
                </p>
                <button onClick={() => setShowCalcInfo(false)} className="p-1.5 rounded-full hover:bg-secondary/60 transition-colors">
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>

              <div
                ref={calcInfoScrollRef}
                className="flex-1 overflow-y-auto px-5 py-4"
              >
                {effectiveUserId ? (
                  <NutritionCalcInfo userId={effectiveUserId} />
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {lang === 'en' ? 'Sign in to see your personal calculation.' : 'Войдите, чтобы увидеть персональный расчёт.'}
                  </p>
                )}

                {/* Button appears only when the user scrolls to the very bottom */}
                <AnimatePresence>
                  {showCalcInfoButton && (
                    <motion.div
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 16 }}
                      className="pt-4 pb-2"
                    >
                      <button
                        onClick={() => setShowCalcInfo(false)}
                        className="w-full h-10 rounded-xl bg-primary text-xs font-bold text-primary-foreground"
                      >
                        {lang === 'en' ? 'Got it' : 'Понятно'}
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
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
              <img src={selectedPhoto.photo_url} alt="" className="max-w-full max-h-[80vh] rounded-2xl object-contain" />
              {(!isReadOnly || isTrainer) && (
                <button onClick={() => handleDeletePhoto(selectedPhoto)} className="absolute top-3 right-3 w-10 h-10 bg-destructive/80 rounded-full flex items-center justify-center shadow-lg">
                  <Trash2 className="w-4 h-4 text-white" />
                </button>
              )}
              <p className="text-center text-xs text-white/60 mt-2">
                {MEAL_TYPES.find(m => m.key === selectedPhoto.meal_type)?.emoji}{' '}
                {lang === 'en' ? MEAL_TYPES.find(m => m.key === selectedPhoto.meal_type)?.labelEn : MEAL_TYPES.find(m => m.key === selectedPhoto.meal_type)?.labelRu}
                {' · '}{selectedPhoto.meal_time ? selectedPhoto.meal_time.slice(0, 5) : new Date(selectedPhoto.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Upload indicator */}
      {uploading && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] bg-card border border-border/40 rounded-2xl px-4 py-3 flex items-center gap-2 shadow-lg">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          <span className="text-xs font-bold text-foreground">{lang === 'en' ? 'Uploading...' : 'Загрузка...'}</span>
        </div>
      )}
    </div>
  );
});

NutritionDiary.displayName = 'NutritionDiary';
export default NutritionDiary;
