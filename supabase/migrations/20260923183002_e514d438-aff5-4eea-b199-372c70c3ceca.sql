GRANT SELECT ON public.guest_chats TO authenticated;
CREATE POLICY "Trainer reads own guest chats" ON public.guest_chats
FOR SELECT TO authenticated
USING (trainer_user_id = auth.uid() AND public.has_role(auth.uid(), 'trainer'));