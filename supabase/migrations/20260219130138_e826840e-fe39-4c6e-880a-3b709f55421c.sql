
-- Create table for client progress photos
CREATE TABLE public.client_progress_photos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  trainer_user_id UUID NOT NULL,
  photo_type TEXT NOT NULL CHECK (photo_type IN ('before', 'after')),
  photo_url TEXT NOT NULL,
  notes TEXT,
  taken_at DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.client_progress_photos ENABLE ROW LEVEL SECURITY;

-- Trainer can manage all photos
CREATE POLICY "Trainers can manage progress photos"
ON public.client_progress_photos
FOR ALL
USING (public.has_role(auth.uid(), 'trainer'))
WITH CHECK (public.has_role(auth.uid(), 'trainer'));

-- Clients can view their own photos
CREATE POLICY "Clients can view their own progress photos"
ON public.client_progress_photos
FOR SELECT
USING (auth.uid() = user_id);

-- Timestamp trigger
CREATE TRIGGER update_client_progress_photos_updated_at
BEFORE UPDATE ON public.client_progress_photos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for progress photos
INSERT INTO storage.buckets (id, name, public) VALUES ('progress-photos', 'progress-photos', true);

-- Storage policies
CREATE POLICY "Trainers can upload progress photos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'progress-photos' AND public.has_role(auth.uid(), 'trainer'));

CREATE POLICY "Trainers can update progress photos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'progress-photos' AND public.has_role(auth.uid(), 'trainer'));

CREATE POLICY "Trainers can delete progress photos"
ON storage.objects FOR DELETE
USING (bucket_id = 'progress-photos' AND public.has_role(auth.uid(), 'trainer'));

CREATE POLICY "Progress photos are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'progress-photos');
