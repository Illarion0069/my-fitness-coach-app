
-- 1) Tighten storage listing for private buckets. Direct public URLs still work
--    (buckets remain public); only API listing/enumeration is restricted.

-- avatars: owner or any trainer can list; everyone can still load via public URL.
DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;
CREATE POLICY "Owners and trainers can list avatars"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'avatars'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR public.has_role(auth.uid(), 'trainer'::public.app_role)
  )
);

-- food-photos: owner or trainer only.
DROP POLICY IF EXISTS "Anyone can view food photos" ON storage.objects;
CREATE POLICY "Owners and trainers can list food photos"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'food-photos'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR public.has_role(auth.uid(), 'trainer'::public.app_role)
  )
);

-- progress-photos: owner or trainer only.
DROP POLICY IF EXISTS "Progress photos are publicly accessible" ON storage.objects;
CREATE POLICY "Owners and trainers can list progress photos"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'progress-photos'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR public.has_role(auth.uid(), 'trainer'::public.app_role)
  )
);

-- 2) Tighten guest_bookings INSERT — replace WITH CHECK (true) with a real check.
DROP POLICY IF EXISTS "Anyone can create guest bookings" ON public.guest_bookings;
CREATE POLICY "Guests can create pending bookings"
ON public.guest_bookings FOR INSERT
WITH CHECK (
  status = 'pending'
  AND trainer_user_id IS NOT NULL
  AND guest_name IS NOT NULL AND length(btrim(guest_name)) > 0
  AND guest_phone IS NOT NULL AND length(btrim(guest_phone)) >= 6
  AND session_date IS NOT NULL
  AND session_time IS NOT NULL
  AND session_date >= (now() AT TIME ZONE 'Asia/Nicosia')::date
);
