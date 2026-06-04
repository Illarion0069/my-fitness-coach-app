-- Fix client_achievements: only trainers may create/modify/delete achievements
DROP POLICY IF EXISTS "Users can update own achievements" ON public.client_achievements;

CREATE POLICY "Trainers can insert achievements"
ON public.client_achievements
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'trainer'::app_role));

CREATE POLICY "Trainers can update achievements"
ON public.client_achievements
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'trainer'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'trainer'::app_role));

CREATE POLICY "Trainers can delete achievements"
ON public.client_achievements
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'trainer'::app_role));

-- Add UPDATE policy for owners on food-photos bucket (consistency with other buckets)
CREATE POLICY "Users can update own food photos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'food-photos' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'food-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Tighten realtime.messages: require topic to be scoped to the subscriber's auth.uid()
DROP POLICY IF EXISTS "Authenticated can read realtime messages" ON realtime.messages;
DROP POLICY IF EXISTS "Authenticated users can receive realtime messages" ON realtime.messages;
DROP POLICY IF EXISTS "Authenticated can select realtime messages" ON realtime.messages;

CREATE POLICY "Users can subscribe only to own topics"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() LIKE '%' || auth.uid()::text || '%'
);
