import { useState, useEffect } from 'react';
import { Camera, Loader2, Trash2, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

interface ProgressPhoto {
  id: string;
  photo_type: 'before' | 'after';
  photo_url: string;
  notes: string | null;
  taken_at: string;
}

interface Props {
  userId: string;
  lang: string;
}

const ClientProgressPhotos = ({ userId, lang }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadType, setUploadType] = useState<'before' | 'after'>('before');

  const fetchPhotos = async () => {
    const { data } = await supabase
      .from('client_progress_photos')
      .select('*')
      .eq('user_id', userId)
      .order('taken_at', { ascending: false });
    setPhotos((data as ProgressPhoto[]) || []);
  };

  useEffect(() => { fetchPhotos(); }, [userId]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'before' | 'after') => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${userId}/${Date.now()}_${type}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('progress-photos')
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('progress-photos').getPublicUrl(path);

      const { error: insertError } = await supabase.from('client_progress_photos').insert({
        user_id: userId,
        trainer_user_id: user.id,
        photo_type: type,
        photo_url: publicUrl,
        taken_at: new Date().toISOString().split('T')[0],
      });
      if (insertError) throw insertError;
      toast({ title: lang === 'en' ? 'Photo uploaded' : 'Фото загружено' });
      fetchPhotos();
    } catch (err: any) {
      toast({ title: lang === 'en' ? 'Error' : 'Ошибка', description: err.message, variant: 'destructive' });
    }
    setUploading(false);
  };

  const handleDelete = async (photo: ProgressPhoto) => {
    try {
      // Extract path from URL
      const urlParts = photo.photo_url.split('/progress-photos/');
      const storagePath = urlParts[1];
      if (storagePath) {
        await supabase.storage.from('progress-photos').remove([storagePath]);
      }
      await supabase.from('client_progress_photos').delete().eq('id', photo.id);
      toast({ title: lang === 'en' ? 'Photo deleted' : 'Фото удалено' });
      fetchPhotos();
    } catch (err: any) {
      toast({ title: lang === 'en' ? 'Error' : 'Ошибка', description: err.message, variant: 'destructive' });
    }
  };

  // Group photos by date
  const grouped = photos.reduce<Record<string, ProgressPhoto[]>>((acc, p) => {
    const key = p.taken_at;
    if (!acc[key]) acc[key] = [];
    acc[key].push(p);
    return acc;
  }, {});

  return (
    <div className="space-y-3">
      {/* Upload buttons */}
      <div className="grid grid-cols-2 gap-2">
        {(['before', 'after'] as const).map(type => (
          <label
            key={type}
            className="flex items-center justify-center gap-1.5 bg-secondary/50 rounded-lg p-2.5 cursor-pointer hover:bg-secondary/70 transition-colors"
          >
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleUpload(e, type)}
              disabled={uploading}
            />
            {uploading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
            ) : (
              <Plus className="w-3.5 h-3.5 text-primary" />
            )}
            <span className="text-xs font-bold">
              {type === 'before'
                ? (lang === 'en' ? 'Before' : 'До')
                : (lang === 'en' ? 'After' : 'После')}
            </span>
          </label>
        ))}
      </div>

      {/* Photo grid by date */}
      {Object.keys(grouped).length === 0 ? (
        <div className="text-center py-4">
          <Camera className="w-6 h-6 text-muted-foreground/30 mx-auto mb-1" />
          <p className="text-xs text-muted-foreground">
            {lang === 'en' ? 'No progress photos yet' : 'Пока нет фото прогресса'}
          </p>
        </div>
      ) : (
        Object.entries(grouped)
          .sort(([a], [b]) => b.localeCompare(a))
          .map(([date, datePhotos]) => (
            <div key={date}>
              <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mb-1.5">
                {new Date(date).toLocaleDateString(lang === 'en' ? 'en-US' : 'ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {datePhotos.map(photo => (
                  <div key={photo.id} className="relative rounded-xl overflow-hidden group">
                    <img src={photo.photo_url} alt={photo.photo_type} className="w-full h-32 object-cover object-top" />
                    <span className={`absolute bottom-1 left-1 text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase ${
                      photo.photo_type === 'before'
                        ? 'bg-black/60 text-white'
                        : 'bg-primary/80 text-primary-foreground'
                    }`}>
                      {photo.photo_type === 'before'
                        ? (lang === 'en' ? 'Before' : 'До')
                        : (lang === 'en' ? 'After' : 'После')}
                    </span>
                    <button
                      onClick={() => handleDelete(photo)}
                      className="absolute top-1 right-1 w-6 h-6 bg-destructive/80 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-3 h-3 text-white" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))
      )}
    </div>
  );
};

export default ClientProgressPhotos;
