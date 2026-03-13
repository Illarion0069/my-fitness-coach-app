import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Camera, Loader2, Trash2, Plus, Droplets, Coffee, Wine, Minus } from 'lucide-react';
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
}

interface FoodPhoto {
  id: string;
  log_date: string;
  photo_url: string;
  meal_note: string | null;
  created_at: string;
}

interface Props {
  userId?: string; // if provided, trainer view (read-only)
  lang: string;
}

const NutritionDiary = ({ userId, lang }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const effectiveUserId = userId || user?.id;
  const isReadOnly = !!userId;

  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [log, setLog] = useState<NutritionLog | null>(null);
  const [photos, setPhotos] = useState<FoodPhoto[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<FoodPhoto | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const fetchData = async () => {
    if (!effectiveUserId) return;
    const [logRes, photosRes] = await Promise.all([
      supabase.from('nutrition_logs').select('*').eq('user_id', effectiveUserId).eq('log_date', date).maybeSingle(),
      supabase.from('food_photos').select('*').eq('user_id', effectiveUserId).eq('log_date', date).order('created_at', { ascending: true }),
    ]);
    setLog((logRes.data as NutritionLog) || null);
    setPhotos((photosRes.data as FoodPhoto[]) || []);
  };

  useEffect(() => { fetchData(); }, [effectiveUserId, date]);

  const navigateDate = (dir: -1 | 1) => {
    const d = new Date(date + 'T00:00:00');
    d.setDate(d.getDate() + dir);
    const newDate = d.toISOString().split('T')[0];
    const today = new Date().toISOString().split('T')[0];
    if (newDate > today) return;
    setDate(newDate);
  };

  const isToday = date === new Date().toISOString().split('T')[0];

  const upsertLog = async (field: string, value: number) => {
    if (isReadOnly || !user) return;
    setSaving(true);
    const current = log || { water_ml: 0, coffee_cups: 0, tea_cups: 0, alcohol_ml: 0, notes: null };
    const payload = {
      user_id: user.id,
      log_date: date,
      water_ml: current.water_ml,
      coffee_cups: current.coffee_cups,
      tea_cups: current.tea_cups,
      alcohol_ml: current.alcohol_ml,
      [field]: Math.max(0, value),
    };

    if (log?.id) {
      const { data, error } = await supabase.from('nutrition_logs').update({ [field]: Math.max(0, value) }).eq('id', log.id).select().single();
      if (!error) setLog(data as NutritionLog);
    } else {
      const { data, error } = await supabase.from('nutrition_logs').insert(payload).select().single();
      if (!error) setLog(data as NutritionLog);
    }
    setSaving(false);
  };

  const handleIncrement = (field: string, currentVal: number, step: number) => {
    upsertLog(field, currentVal + step);
  };

  const handleDecrement = (field: string, currentVal: number, step: number) => {
    upsertLog(field, Math.max(0, currentVal - step));
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: lang === 'en' ? 'File too large (max 10MB)' : 'Файл слишком большой (макс 10МБ)', variant: 'destructive' });
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${user.id}/${date}_${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('food-photos').upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('food-photos').getPublicUrl(path);
      const { error: insertError } = await supabase.from('food_photos').insert({
        user_id: user.id,
        log_date: date,
        photo_url: publicUrl,
      });
      if (insertError) throw insertError;
      toast({ title: lang === 'en' ? 'Photo added' : 'Фото добавлено' });
      fetchData();
    } catch (err: any) {
      toast({ title: lang === 'en' ? 'Error' : 'Ошибка', description: err.message, variant: 'destructive' });
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleDeletePhoto = async (photo: FoodPhoto) => {
    try {
      const urlParts = photo.photo_url.split('/food-photos/');
      const storagePath = urlParts[1];
      if (storagePath) {
        await supabase.storage.from('food-photos').remove([storagePath]);
      }
      await supabase.from('food_photos').delete().eq('id', photo.id);
      toast({ title: lang === 'en' ? 'Photo deleted' : 'Фото удалено' });
      setSelectedPhoto(null);
      fetchData();
    } catch (err: any) {
      toast({ title: lang === 'en' ? 'Error' : 'Ошибка', description: err.message, variant: 'destructive' });
    }
  };

  const waterMl = log?.water_ml || 0;
  const coffeeCups = log?.coffee_cups || 0;
  const teaCups = log?.tea_cups || 0;
  const alcoholMl = log?.alcohol_ml || 0;

  const dateLabel = new Date(date + 'T00:00:00').toLocaleDateString(lang === 'en' ? 'en-US' : 'ru-RU', {
    weekday: 'short', day: 'numeric', month: 'short',
  });

  const liquidItems = [
    {
      key: 'water_ml',
      icon: <Droplets className="w-5 h-5" />,
      label: lang === 'en' ? 'Water' : 'Вода',
      value: waterMl,
      display: `${(waterMl / 1000).toFixed(1)} ${lang === 'en' ? 'L' : 'л'}`,
      step: 250,
      stepLabel: '+250ml',
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10',
    },
    {
      key: 'coffee_cups',
      icon: <Coffee className="w-5 h-5" />,
      label: lang === 'en' ? 'Coffee' : 'Кофе',
      value: coffeeCups,
      display: `${coffeeCups} ${lang === 'en' ? (coffeeCups === 1 ? 'cup' : 'cups') : (coffeeCups === 1 ? 'чашка' : coffeeCups < 5 ? 'чашки' : 'чашек')}`,
      step: 1,
      stepLabel: '+1',
      color: 'text-amber-400',
      bgColor: 'bg-amber-500/10',
    },
    {
      key: 'tea_cups',
      icon: (
        <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
          <path d="M4 19h16v2H4v-2zm17-3H3a1 1 0 01-1-1V4a1 1 0 011-1h16a1 1 0 011 1v1h1a2 2 0 012 2v6a2 2 0 01-2 2h-1v1a1 1 0 01-1 1zm1-10h-1v6h1V6zM18 5H4v9h14V5z"/>
        </svg>
      ),
      label: lang === 'en' ? 'Tea' : 'Чай',
      value: teaCups,
      display: `${teaCups} ${lang === 'en' ? (teaCups === 1 ? 'cup' : 'cups') : (teaCups === 1 ? 'чашка' : teaCups < 5 ? 'чашки' : 'чашек')}`,
      step: 1,
      stepLabel: '+1',
      color: 'text-green-400',
      bgColor: 'bg-green-500/10',
    },
    {
      key: 'alcohol_ml',
      icon: <Wine className="w-5 h-5" />,
      label: lang === 'en' ? 'Alcohol' : 'Алкоголь',
      value: alcoholMl,
      display: `${(alcoholMl / 1000).toFixed(1)} ${lang === 'en' ? 'L' : 'л'}`,
      step: 250,
      stepLabel: '+250ml',
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/10',
    },
  ];

  return (
    <div className="space-y-5">
      {/* Date Navigation */}
      <div className="flex items-center justify-between">
        <button onClick={() => navigateDate(-1)} className="w-9 h-9 rounded-xl bg-secondary/50 flex items-center justify-center hover:bg-secondary/70 transition-colors">
          <ChevronLeft className="w-4 h-4 text-foreground" />
        </button>
        <div className="text-center">
          <p className="text-sm font-bold text-foreground capitalize">{isToday ? (lang === 'en' ? 'Today' : 'Сегодня') : dateLabel}</p>
          {isToday && <p className="text-[10px] text-muted-foreground capitalize">{dateLabel}</p>}
        </div>
        <button
          onClick={() => navigateDate(1)}
          disabled={isToday}
          className="w-9 h-9 rounded-xl bg-secondary/50 flex items-center justify-center hover:bg-secondary/70 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronRight className="w-4 h-4 text-foreground" />
        </button>
      </div>

      {/* Liquids Section */}
      <div className="space-y-2">
        <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
          {lang === 'en' ? 'Liquids' : 'Жидкости'}
        </p>
        <div className="grid grid-cols-2 gap-2.5">
          {liquidItems.map(item => (
            <div key={item.key} className="bg-card border border-border/40 rounded-2xl p-3.5 space-y-2">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-xl ${item.bgColor} flex items-center justify-center ${item.color}`}>
                  {item.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-muted-foreground font-medium">{item.label}</p>
                  <p className="text-sm font-extrabold text-foreground">{item.display}</p>
                </div>
              </div>
              {!isReadOnly && (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleDecrement(item.key, item.value, item.step)}
                    disabled={item.value <= 0}
                    className="flex-1 h-8 rounded-lg bg-secondary/50 flex items-center justify-center hover:bg-secondary/70 transition-colors disabled:opacity-30 active:scale-95"
                  >
                    <Minus className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                  <button
                    onClick={() => handleIncrement(item.key, item.value, item.step)}
                    className="flex-[2] h-8 rounded-lg bg-primary/15 flex items-center justify-center gap-1 hover:bg-primary/25 transition-colors active:scale-95"
                  >
                    <Plus className="w-3 h-3 text-primary" />
                    <span className="text-[10px] font-bold text-primary">{item.stepLabel}</span>
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Food Photos Section */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
            {lang === 'en' ? 'Food Photos' : 'Фото еды'}
          </p>
          <span className="text-[10px] text-muted-foreground">{photos.length} {lang === 'en' ? 'photos' : 'фото'}</span>
        </div>

        {/* Upload button */}
        {!isReadOnly && (
          <label className="flex items-center justify-center gap-2 bg-secondary/50 rounded-xl p-3 cursor-pointer hover:bg-secondary/70 transition-colors active:scale-[0.98]">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handlePhotoUpload}
              disabled={uploading}
            />
            {uploading ? (
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
            ) : (
              <Camera className="w-4 h-4 text-primary" />
            )}
            <span className="text-xs font-bold text-foreground">
              {lang === 'en' ? 'Add photo' : 'Добавить фото'}
            </span>
          </label>
        )}

        {/* Photo grid */}
        {photos.length === 0 ? (
          <div className="text-center py-6">
            <Camera className="w-8 h-8 text-muted-foreground/20 mx-auto mb-1.5" />
            <p className="text-xs text-muted-foreground">
              {lang === 'en' ? 'No food photos for this day' : 'Нет фото еды за этот день'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {photos.map(photo => (
              <motion.button
                key={photo.id}
                whileTap={{ scale: 0.95 }}
                onClick={() => setSelectedPhoto(photo)}
                className="relative rounded-xl overflow-hidden aspect-square group"
              >
                <img src={photo.photo_url} alt="" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                <span className="absolute bottom-1 left-1 text-[8px] bg-black/50 text-white/80 px-1.5 py-0.5 rounded">
                  {new Date(photo.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </motion.button>
            ))}
          </div>
        )}
      </div>

      {/* Photo Lightbox */}
      <AnimatePresence>
        {selectedPhoto && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedPhoto(null)}
            className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              onClick={e => e.stopPropagation()}
              className="relative max-w-full max-h-full"
            >
              <img src={selectedPhoto.photo_url} alt="" className="max-w-full max-h-[80vh] rounded-xl object-contain" />
              {!isReadOnly && (
                <button
                  onClick={() => handleDeletePhoto(selectedPhoto)}
                  className="absolute top-3 right-3 w-10 h-10 bg-destructive/80 rounded-full flex items-center justify-center shadow-lg"
                >
                  <Trash2 className="w-4 h-4 text-white" />
                </button>
              )}
              <p className="text-center text-xs text-white/60 mt-2">
                {new Date(selectedPhoto.created_at).toLocaleString(lang === 'en' ? 'en-US' : 'ru-RU')}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NutritionDiary;
