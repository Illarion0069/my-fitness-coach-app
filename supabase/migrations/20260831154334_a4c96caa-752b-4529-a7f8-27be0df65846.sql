-- food-photos: owner, or the client's own trainer
DROP POLICY IF EXISTS "Owners and trainers can list food photos" ON storage.objects;
CREATE POLICY "Owners and own trainer can read food photos"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'food-photos'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR public.is_my_client(((storage.foldername(name))[1])::uuid)
  )
);

-- progress-photos: owner, or the client's own trainer
DROP POLICY IF EXISTS "Owners and trainers can list progress photos" ON storage.objects;
DROP POLICY IF EXISTS "Trainers can view progress photos" ON storage.objects;
DROP POLICY IF EXISTS "Trainers can manage progress photos" ON storage.objects;
CREATE POLICY "Owners and own trainer can read progress photos"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'progress-photos'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR public.is_my_client(((storage.foldername(name))[1])::uuid)
  )
);