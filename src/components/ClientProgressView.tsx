import { useState, useEffect } from 'react';
import { Camera } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { AnimatePresence, motion } from 'framer-motion';

interface ProgressPhoto {
  id: string;
  photo_type: 'before' | 'after';
  photo_url: string;
  taken_at: string;
}

interface Props {
  userId: string;
  lang: string;
}

const ClientProgressView = ({ userId, lang }: Props) => {
  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [expandedPhoto, setExpandedPhoto] = useState<string | null>(null);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from('client_progress_photos')
        .select('*')
        .eq('user_id', userId)
        .order('taken_at', { ascending: false });
      setPhotos((data as ProgressPhoto[]) || []);
    };
    fetch();
  }, [userId]);

  if (photos.length === 0) {
    return (
      <div className="text-center py-4">
        <Camera className="w-6 h-6 text-muted-foreground/30 mx-auto mb-1" />
        <p className="text-xs text-muted-foreground">
          {lang === 'en' ? 'No progress photos yet' : 'Пока нет фото прогресса'}
        </p>
      </div>
    );
  }

  // Group by date
  const grouped = photos.reduce<Record<string, ProgressPhoto[]>>((acc, p) => {
    if (!acc[p.taken_at]) acc[p.taken_at] = [];
    acc[p.taken_at].push(p);
    return acc;
  }, {});

  return (
    <>
      <div className="space-y-3">
        {Object.entries(grouped)
          .sort(([a], [b]) => b.localeCompare(a))
          .map(([date, datePhotos]) => (
            <div key={date}>
              <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mb-1.5">
                {new Date(date).toLocaleDateString(lang === 'en' ? 'en-US' : 'ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {datePhotos.map(photo => (
                  <div
                    key={photo.id}
                    className="relative rounded-xl overflow-hidden cursor-pointer"
                    onClick={() => setExpandedPhoto(photo.photo_url)}
                  >
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
                  </div>
                ))}
              </div>
            </div>
          ))}
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {expandedPhoto && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setExpandedPhoto(null)}
            className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-8"
          >
            <motion.img
              src={expandedPhoto}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              className="max-w-full max-h-full rounded-2xl object-contain"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default ClientProgressView;
