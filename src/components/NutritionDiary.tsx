import { useState, useEffect, useRef, useMemo, forwardRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Camera, Loader2, Trash2, Plus, Droplets, Coffee, Wine, Minus, Sparkles, Edit3, ImagePlus, Flame, X, Check, PencilLine } from 'lucide-react';
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
  manual_entries: any[] | null;
}

interface FoodPhoto {
  id: string;
  log_date: string;
  photo_url: string;
  meal_note: string | null;
  meal_type: string;
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

const MEAL_TYPES: { key: MealType; labelRu: string; labelEn: string; emoji: string; icon: string }[] = [
  { key: 'breakfast', labelRu: 'Завтрак', labelEn: 'Breakfast', emoji: '🌅', icon: '☀️' },
  { key: 'lunch', labelRu: 'Обед', labelEn: 'Lunch', emoji: '☀️', icon: '🍽' },
  { key: 'dinner', labelRu: 'Ужин', labelEn: 'Dinner', emoji: '🌙', icon: '🌙' },
  { key: 'snack', labelRu: 'Перекус', labelEn: 'Snack', emoji: '🍎', icon: '🍏' },
];

const scoreColor = (s: number) => s >= 80 ? 'text-green-400' : s >= 50 ? 'text-yellow-400' : 'text-red-400';

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

const NutritionDiary = forwardRef<HTMLDivElement, Props>(({ userId, lang, isTrainer = false }, ref) => {
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
  const [showSourcePicker, setShowSourcePicker] = useState(false);
  const [showMealPicker, setShowMealPicker] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
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
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showLiquids, setShowLiquids] = useState(false);
  const [expandedMeal, setExpandedMeal] = useState<MealType | null>(null);
  const [editingFood, setEditingFood] = useState<{ mealType: MealType; index: number } | null>(null);
  const [editFoodName, setEditFoodName] = useState('');
  const [editFoodPortion, setEditFoodPortion] = useState('');
  const [editFoodCal, setEditFoodCal] = useState('');
  const [editFoodProtein, setEditFoodProtein] = useState('');
  const [editFoodCarbs, setEditFoodCarbs] = useState('');
  const [editFoodFat, setEditFoodFat] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const fetchData = useCallback(async () => {
    if (!effectiveUserId) return;
    const [logRes, photosRes] = await Promise.all([
      supabase.from('nutrition_logs').select('*').eq('user_id', effectiveUserId).eq('log_date', date).maybeSingle(),
      supabase.from('food_photos').select('*').eq('user_id', effectiveUserId).eq('log_date', date).order('created_at', { ascending: true }),
    ]);
    setLog((logRes.data as any) || null);
    setPhotos((photosRes.data as FoodPhoto[]) || []);
    const analysis = logRes.data?.ai_analysis;
    const analysisData = analysis as Record<string, any> | null;
    setAnalysisCount(analysisData?.analysis_count || (logRes.data?.ai_score != null ? 1 : 0));
  }, [effectiveUserId, date]);

  useEffect(() => { fetchData(); }, [fetchData]);

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
      toast({ title: lang === 'en' ? 'Photo limit reached' : 'Лимит фото достигнут', variant: 'destructive' });
      if (fileRef.current) fileRef.current.value = '';
      return;
    }
    setPendingFile(file);
    setShowMealPicker(true);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleUploadWithMealType = async (mealType: MealType) => {
    if (!pendingFile || !user) return;
    if (!VALID_MEAL_TYPES.includes(mealType)) return;
    setShowMealPicker(false);
    setUploading(true);
    const ext = pendingFile.name.split('.').pop();
    const path = `${user.id}/${date}_${Date.now()}.${ext}`;
    try {
      const { error: uploadError } = await supabase.storage.from('food-photos').upload(path, pendingFile, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('food-photos').getPublicUrl(path);
      const { data: validation, error: valError } = await supabase.functions.invoke('validate-food-photo', {
        body: { photo_url: publicUrl },
      });
      if (!valError && validation && !validation.is_food) {
        await supabase.storage.from('food-photos').remove([path]);
        toast({ title: lang === 'en' ? 'Not a food photo' : 'Это не фото еды', variant: 'destructive' });
        setPendingFile(null);
        setUploading(false);
        return;
      }
      const { error: insertError } = await supabase.from('food_photos').insert({
        user_id: user.id, log_date: date, photo_url: publicUrl, meal_type: mealType,
      });
      if (insertError) {
        await supabase.storage.from('food-photos').remove([path]);
        throw insertError;
      }
      const mealLabel = MEAL_TYPES.find(m => m.key === mealType);
      toast({ title: `${mealLabel?.emoji} ${lang === 'en' ? 'Photo added' : 'Фото добавлено'}` });
      fetchData();
    } catch (err: any) {
      try { await supabase.storage.from('food-photos').remove([path]); } catch {}
      toast({ title: lang === 'en' ? 'Error' : 'Ошибка', description: err.message, variant: 'destructive' });
    }
    setPendingFile(null);
    setUploading(false);
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
      // Mark analysis as stale but keep data visible; don't reset analysis_count
      if (log?.id && hasAnalysis) {
        const prevAnalysis = log.ai_analysis as Record<string, any> | null;
        const preservedCount = Math.max(0, (prevAnalysis?.analysis_count || analysisCount) - 1);
        await supabase.from('nutrition_logs').update({
          ai_score: null, ai_feedback: null,
          ai_analysis: { ...prevAnalysis, invalidated: true, analysis_count: preservedCount },
          trainer_override_score: null, trainer_override_note: null,
        }).eq('id', log.id);
        setAnalysisCount(preservedCount);
      }
      toast({ title: lang === 'en' ? 'Photo deleted' : 'Фото удалено' });
      setSelectedPhoto(null);
      fetchData();
    } catch (err: any) {
      toast({ title: lang === 'en' ? 'Error' : 'Ошибка', description: err.message, variant: 'destructive' });
    }
  };

  const handleAnalyze = async () => {
    if (!effectiveUserId) return;
    if (analysisCount >= MAX_ANALYSES_PER_DAY) {
      toast({ title: lang === 'en' ? 'Analysis limit reached' : 'Лимит анализов достигнут', variant: 'destructive' });
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
      created_at: new Date().toISOString(),
    };
    const currentEntries = (log?.manual_entries || []) as ManualEntry[];
    const newEntries = [...currentEntries, entry];
    if (log?.id) {
      await supabase.from('nutrition_logs').update({ manual_entries: newEntries as any }).eq('id', log.id);
    } else {
      await supabase.from('nutrition_logs').insert({
        user_id: user.id, log_date: date, manual_entries: newEntries as any,
      } as any);
    }
    setShowQuickAdd(false);
    setQuickAddName(''); setQuickAddCal(''); setQuickAddProtein(''); setQuickAddCarbs(''); setQuickAddFat('');
    fetchData();
    toast({ title: lang === 'en' ? 'Added' : 'Добавлено' });
  };

  const handleDeleteManualEntry = async (entryId: string) => {
    if (!log?.id) return;
    const entries = ((log.manual_entries || []) as ManualEntry[]).filter(e => e.id !== entryId);
    await supabase.from('nutrition_logs').update({ manual_entries: entries as any }).eq('id', log.id);
    fetchData();
  };

  const handleDeleteAiFood = async (mealType: MealType, foodIndex: number) => {
    if (!log?.id || !analysis || analysis.invalidated) return;
    const updatedAnalysis = { ...analysis };
    const meals = [...(updatedAnalysis.meals || [])];
    const mealIdx = meals.findIndex((m: any) => m.meal_type === mealType);
    if (mealIdx === -1) return;
    const meal = { ...meals[mealIdx] };
    const foods = [...(meal.detected_foods || [])];
    const removed = foods[foodIndex];
    foods.splice(foodIndex, 1);
    meal.detected_foods = foods;
    // Recalculate meal totals
    meal.estimated_calories = foods.reduce((s: number, f: any) => s + (f.calories || 0), 0);
    meal.protein_g = foods.reduce((s: number, f: any) => s + (f.protein_g || 0), 0);
    meal.carbs_g = foods.reduce((s: number, f: any) => s + (f.carbs_g || 0), 0);
    meal.fat_g = foods.reduce((s: number, f: any) => s + (f.fat_g || 0), 0);
    meals[mealIdx] = meal;
    updatedAnalysis.meals = meals;
    // Recalculate totals
    updatedAnalysis.total_calories = meals.reduce((s: number, m: any) => s + (m.estimated_calories || 0), 0);
    updatedAnalysis.total_protein_g = meals.reduce((s: number, m: any) => s + (m.protein_g || 0), 0);
    updatedAnalysis.total_carbs_g = meals.reduce((s: number, m: any) => s + (m.carbs_g || 0), 0);
    updatedAnalysis.total_fat_g = meals.reduce((s: number, m: any) => s + (m.fat_g || 0), 0);
    await supabase.from('nutrition_logs').update({ ai_analysis: updatedAnalysis }).eq('id', log.id);
    fetchData();
  };

  const handleEditAiFood = async () => {
    if (!log?.id || !analysis || !editingFood) return;
    const updatedAnalysis = { ...analysis };
    const meals = [...(updatedAnalysis.meals || [])];
    const mealIdx = meals.findIndex((m: any) => m.meal_type === editingFood.mealType);
    if (mealIdx === -1) return;
    const meal = { ...meals[mealIdx] };
    const foods = [...(meal.detected_foods || [])];
    foods[editingFood.index] = {
      name: editFoodName.trim() || foods[editingFood.index].name,
      portion_g: parseInt(editFoodPortion) || foods[editingFood.index].portion_g,
      calories: parseInt(editFoodCal) || 0,
      protein_g: parseInt(editFoodProtein) || 0,
      carbs_g: parseInt(editFoodCarbs) || 0,
      fat_g: parseInt(editFoodFat) || 0,
    };
    meal.detected_foods = foods;
    meal.estimated_calories = foods.reduce((s: number, f: any) => s + (f.calories || 0), 0);
    meal.protein_g = foods.reduce((s: number, f: any) => s + (f.protein_g || 0), 0);
    meal.carbs_g = foods.reduce((s: number, f: any) => s + (f.carbs_g || 0), 0);
    meal.fat_g = foods.reduce((s: number, f: any) => s + (f.fat_g || 0), 0);
    meals[mealIdx] = meal;
    updatedAnalysis.meals = meals;
    updatedAnalysis.total_calories = meals.reduce((s: number, m: any) => s + (m.estimated_calories || 0), 0);
    updatedAnalysis.total_protein_g = meals.reduce((s: number, m: any) => s + (m.protein_g || 0), 0);
    updatedAnalysis.total_carbs_g = meals.reduce((s: number, m: any) => s + (m.carbs_g || 0), 0);
    updatedAnalysis.total_fat_g = meals.reduce((s: number, m: any) => s + (m.fat_g || 0), 0);
    await supabase.from('nutrition_logs').update({ ai_analysis: updatedAnalysis }).eq('id', log.id);
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
  };

  // Computed totals
  const analysis = log?.ai_analysis;
  const aiMeals = (analysis?.meals || []) as any[];
  const manualEntries = ((log?.manual_entries || []) as ManualEntry[]);
  const displayScore = log?.trainer_override_score ?? log?.ai_score;
  const isOverridden = log?.trainer_override_score != null;
  const analysisAtLimit = analysisCount >= MAX_ANALYSES_PER_DAY;

  const totals = useMemo(() => {
    let calories = 0, protein = 0, carbs = 0, fat = 0;
    // From AI analysis — use top-level totals, fallback to summing meals
    if (analysis && !analysis.invalidated) {
      const meals = (analysis.meals || []) as any[];
      if (analysis.total_calories > 0) {
        calories += (analysis.total_calories || 0);
        protein += (analysis.total_protein_g || 0);
        carbs += (analysis.total_carbs_g || 0);
        fat += (analysis.total_fat_g || 0);
      } else {
        // Fallback: sum from individual meals
        for (const m of meals) {
          calories += m.estimated_calories || 0;
          protein += m.protein_g || 0;
          carbs += m.carbs_g || 0;
          fat += m.fat_g || 0;
        }
      }
    }
    // From manual entries
    for (const e of manualEntries) {
      calories += e.calories || 0;
      protein += e.protein_g || 0;
      carbs += e.carbs_g || 0;
      fat += e.fat_g || 0;
    }
    return { calories: Math.round(calories), protein: Math.round(protein), carbs: Math.round(carbs), fat: Math.round(fat) };
  }, [analysis, manualEntries]);

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
    // Manual entries
    for (const e of manualEntries) {
      const mt = (VALID_MEAL_TYPES.includes(e.meal_type as MealType) ? e.meal_type : 'snack') as MealType;
      data[mt].manualItems.push(e);
      data[mt].calories += e.calories || 0;
      data[mt].protein += e.protein_g || 0;
      data[mt].carbs += e.carbs_g || 0;
      data[mt].fat += e.fat_g || 0;
    }
    return data;
  }, [photos, aiMeals, manualEntries]);

  const waterMl = log?.water_ml || 0;
  const coffeeCups = log?.coffee_cups || 0;
  const teaCups = log?.tea_cups || 0;
  const alcoholMl = log?.alcohol_ml || 0;
  const dateLabel = new Date(date + 'T00:00:00').toLocaleDateString(lang === 'en' ? 'en-US' : 'ru-RU', { weekday: 'short', day: 'numeric', month: 'short' });
  const photosAtLimit = photos.length >= MAX_PHOTOS_PER_DAY;

  const macros = [
    { label: lang === 'en' ? 'Protein' : 'Белки', value: totals.protein, unit: 'g', color: 'hsl(142, 71%, 45%)' },
    { label: lang === 'en' ? 'Carbs' : 'Углеводы', value: totals.carbs, unit: 'g', color: 'hsl(45, 93%, 47%)' },
    { label: lang === 'en' ? 'Fat' : 'Жиры', value: totals.fat, unit: 'g', color: 'hsl(280, 65%, 60%)' },
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

      {/* Calories Dashboard */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-card border border-border/40 rounded-3xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-baseline gap-2">
              <Flame className="w-5 h-5 text-primary" />
              <span className="text-3xl font-black text-foreground tracking-tight">{totals.calories}</span>
              <span className="text-sm text-muted-foreground font-medium">{lang === 'en' ? 'kcal' : 'ккал'}</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">{lang === 'en' ? 'consumed today' : 'потреблено за день'}</p>
          </div>

          {/* AI Score badge */}
          {displayScore != null && (
            <button
              onClick={() => isTrainer && log?.ai_score != null ? (setOverrideScore(String(log?.trainer_override_score ?? log?.ai_score ?? '')), setOverrideNote(log?.trainer_override_note || ''), setShowOverrideModal(true)) : undefined}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full ${
                displayScore >= 80 ? 'bg-green-500/15 text-green-400' : displayScore >= 50 ? 'bg-yellow-500/15 text-yellow-400' : 'bg-red-500/15 text-red-400'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span className="text-sm font-extrabold">{displayScore}</span>
              {isTrainer && <Edit3 className="w-3 h-3 opacity-50" />}
            </button>
          )}
        </div>

        {/* Macro indicators */}
        <div className="grid grid-cols-3 gap-3">
          {macros.map(m => (
            <div key={m.label} className="text-center">
              <p className="text-lg font-black text-foreground" style={{ color: m.color }}>{m.value}<span className="text-[10px] font-medium text-muted-foreground">{m.unit}</span></p>
              <p className="text-[10px] text-muted-foreground font-medium">{m.label}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* AI Feedback */}
      {displayScore != null && log?.ai_feedback && (
        <div className={`rounded-2xl p-3.5 border border-border/30 ${
          displayScore >= 80 ? 'bg-green-500/5' : displayScore >= 50 ? 'bg-yellow-500/5' : 'bg-red-500/5'
        }`}>
          {isOverridden && log?.trainer_override_note && (
            <p className="text-[11px] text-foreground/80 leading-relaxed mb-1.5 italic">✏️ {log.trainer_override_note}</p>
          )}
          <p className="text-[11px] text-muted-foreground leading-relaxed">{log.ai_feedback}</p>
          {isOverridden && log?.ai_score != null && (
            <p className="text-[10px] text-muted-foreground/60 mt-1">AI: {log.ai_score}%</p>
          )}
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
                          {meal.photos.map(photo => (
                            <motion.button key={photo.id} whileTap={{ scale: 0.95 }} onClick={() => setSelectedPhoto(photo)}
                              className="relative rounded-xl overflow-hidden aspect-square">
                              <img src={photo.photo_url} alt="" className="w-full h-full object-cover" />
                              <span className="absolute bottom-0.5 left-0.5 text-[7px] bg-black/50 text-white/80 px-1 py-0.5 rounded">
                                {new Date(photo.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </motion.button>
                          ))}
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
                            return (
                              <div key={i} className="flex items-center justify-between bg-secondary/30 rounded-xl px-3 py-2">
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium text-foreground truncate">{f.name}</p>
                                  {f.portion_g && <p className="text-[10px] text-muted-foreground">{f.portion_g}g</p>}
                                </div>
                                <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                                  {f.calories && <span className="font-bold text-foreground">{f.calories}</span>}
                                  {f.protein_g != null && <span className="text-green-400">P{f.protein_g}</span>}
                                  {f.carbs_g != null && <span className="text-yellow-400">C{f.carbs_g}</span>}
                                  {f.fat_g != null && <span className="text-purple-400">F{f.fat_g}</span>}
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
                              meal.aiMeal.score >= 80 ? 'bg-green-400' : meal.aiMeal.score >= 50 ? 'bg-yellow-400' : 'bg-red-400'
                            }`} style={{ width: `${meal.aiMeal.score}%` }} />
                          </div>
                          <span className={`text-[10px] font-bold ${scoreColor(meal.aiMeal.score)}`}>{meal.aiMeal.score}%</span>
                        </div>
                      )}

                      {/* Manual entries */}
                      {meal.manualItems.map(entry => (
                        <div key={entry.id} className="flex items-center justify-between bg-secondary/30 rounded-xl px-3 py-2">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <PencilLine className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                            <div>
                              <p className="text-xs font-medium text-foreground truncate">{entry.name}</p>
                              <p className="text-[10px] text-muted-foreground">
                                {entry.calories}{lang === 'en' ? 'kcal' : 'ккал'}
                                {entry.protein_g > 0 && ` · P${entry.protein_g}`}
                                {entry.carbs_g > 0 && ` · C${entry.carbs_g}`}
                                {entry.fat_g > 0 && ` · F${entry.fat_g}`}
                              </p>
                            </div>
                          </div>
                          {(!isReadOnly || isTrainer) && (
                            <button onClick={() => handleDeleteManualEntry(entry.id)} className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ))}

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

      {/* Analyze Button — show when photos exist and either no score yet or score was invalidated */}
      {photos.length > 0 && !analysisAtLimit && (log?.ai_score == null) && (
        <motion.button whileTap={{ scale: 0.97 }} onClick={handleAnalyze} disabled={analyzing}
          className="w-full flex items-center justify-center gap-2 border rounded-2xl p-3.5 transition-colors bg-primary/15 hover:bg-primary/25 border-primary/30">
          {analyzing ? <Loader2 className="w-4 h-4 animate-spin text-primary" /> : <Sparkles className="w-4 h-4 text-primary" />}
          <span className="text-sm font-bold text-primary">
            {analyzing ? (lang === 'en' ? 'Analyzing...' : 'Анализирую...') : (lang === 'en' ? 'Get AI Score' : 'Получить оценку ИИ')}
          </span>
          {analysisCount > 0 && <span className="text-[10px] text-primary/60">({analysisCount}/{MAX_ANALYSES_PER_DAY})</span>}
        </motion.button>
      )}

      {/* FAB - Add meal */}
      {!isReadOnly && !userId && (
        <div className="fixed z-[60] right-4" style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 72px)' }}>
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

              <button onClick={() => { setShowAddMenu(false); setShowSourcePicker(true); }}
                disabled={photosAtLimit || uploading}
                className="w-full flex items-center gap-3 bg-secondary/50 hover:bg-secondary/70 rounded-2xl p-4 transition-colors active:scale-[0.98] disabled:opacity-40">
                <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
                  <Camera className="w-5 h-5 text-primary" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-bold text-foreground">{lang === 'en' ? 'Take photo' : 'Сфотографировать еду'}</p>
                  <p className="text-[10px] text-muted-foreground">{lang === 'en' ? 'AI will detect food and macros' : 'ИИ определит еду и КБЖУ'}</p>
                </div>
              </button>

              <button onClick={() => { setShowAddMenu(false); setShowQuickAdd(true); }}
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

      {/* Source Picker Modal */}
      <AnimatePresence>
        {showSourcePicker && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowSourcePicker(false)}
            className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-sm bg-card rounded-3xl p-5 space-y-3 border border-border/40">
              <p className="text-sm font-bold text-foreground text-center">{lang === 'en' ? 'Photo source' : 'Источник фото'}</p>
              <button onClick={() => { setShowSourcePicker(false); cameraRef.current?.click(); }}
                className="w-full flex items-center gap-3 bg-secondary/50 hover:bg-secondary/70 rounded-2xl p-4 transition-colors active:scale-95">
                <Camera className="w-5 h-5 text-primary" />
                <span className="text-sm font-bold text-foreground">{lang === 'en' ? 'Camera' : 'Камера'}</span>
              </button>
              <button onClick={() => { setShowSourcePicker(false); fileRef.current?.click(); }}
                className="w-full flex items-center gap-3 bg-secondary/50 hover:bg-secondary/70 rounded-2xl p-4 transition-colors active:scale-95">
                <ImagePlus className="w-5 h-5 text-primary" />
                <span className="text-sm font-bold text-foreground">{lang === 'en' ? 'Gallery' : 'Галерея'}</span>
              </button>
              <button onClick={() => setShowSourcePicker(false)} className="w-full text-xs text-muted-foreground py-2 text-center">
                {lang === 'en' ? 'Cancel' : 'Отмена'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Meal Type Picker Modal */}
      <AnimatePresence>
        {showMealPicker && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => { setShowMealPicker(false); setPendingFile(null); }}
            className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-sm bg-card rounded-3xl p-5 space-y-3 border border-border/40">
              <p className="text-sm font-bold text-foreground text-center">{lang === 'en' ? 'What meal?' : 'Какой приём пищи?'}</p>
              <div className="grid grid-cols-2 gap-2">
                {MEAL_TYPES.map(mt => (
                  <button key={mt.key} onClick={() => handleUploadWithMealType(mt.key)}
                    className="flex items-center gap-2.5 bg-secondary/50 hover:bg-secondary/70 rounded-2xl p-3.5 transition-colors active:scale-95">
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

              <input value={quickAddName} onChange={e => setQuickAddName(e.target.value)}
                placeholder={lang === 'en' ? 'Food name (optional)' : 'Название (необязательно)'}
                className="w-full h-10 bg-secondary/50 border border-border/40 rounded-xl px-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50"
              />

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] font-bold text-muted-foreground uppercase mb-1 block">{lang === 'en' ? 'Calories' : 'Калории'}</label>
                  <input type="number" value={quickAddCal} onChange={e => setQuickAddCal(e.target.value)}
                    placeholder="0" className="w-full h-10 bg-secondary/50 border border-border/40 rounded-xl px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
                </div>
                <div>
                  <label className="text-[9px] font-bold text-muted-foreground uppercase mb-1 block">{lang === 'en' ? 'Protein' : 'Белки'} (g)</label>
                  <input type="number" value={quickAddProtein} onChange={e => setQuickAddProtein(e.target.value)}
                    placeholder="0" className="w-full h-10 bg-secondary/50 border border-border/40 rounded-xl px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
                </div>
                <div>
                  <label className="text-[9px] font-bold text-muted-foreground uppercase mb-1 block">{lang === 'en' ? 'Carbs' : 'Углеводы'} (g)</label>
                  <input type="number" value={quickAddCarbs} onChange={e => setQuickAddCarbs(e.target.value)}
                    placeholder="0" className="w-full h-10 bg-secondary/50 border border-border/40 rounded-xl px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
                </div>
                <div>
                  <label className="text-[9px] font-bold text-muted-foreground uppercase mb-1 block">{lang === 'en' ? 'Fat' : 'Жиры'} (g)</label>
                  <input type="number" value={quickAddFat} onChange={e => setQuickAddFat(e.target.value)}
                    placeholder="0" className="w-full h-10 bg-secondary/50 border border-border/40 rounded-xl px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
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
                {' · '}{new Date(selectedPhoto.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
