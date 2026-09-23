ALTER TABLE public.guest_chats ADD COLUMN closed_at timestamptz;
ALTER TABLE public.direct_messages
  ADD COLUMN attachment_path text,
  ADD COLUMN attachment_name text,
  ADD COLUMN attachment_type text,
  ADD COLUMN is_system boolean NOT NULL DEFAULT false;
CREATE POLICY "Trainer reads own chat files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'chat-files' AND (storage.foldername(name))[1] = auth.uid()::text AND public.has_role(auth.uid(), 'trainer'));