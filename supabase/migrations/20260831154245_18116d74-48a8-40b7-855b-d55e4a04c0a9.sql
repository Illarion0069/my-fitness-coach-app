-- food_photos
DROP POLICY IF EXISTS "Trainers can view all food photos" ON public.food_photos;
DROP POLICY IF EXISTS "Trainers can delete food photos" ON public.food_photos;
CREATE POLICY "Trainers can view own clients food photos" ON public.food_photos
FOR SELECT TO authenticated USING (public.is_my_client(user_id));
CREATE POLICY "Trainers can delete own clients food photos" ON public.food_photos
FOR DELETE TO authenticated USING (public.is_my_client(user_id));

-- client_progress_photos
DROP POLICY IF EXISTS "Trainers can manage progress photos" ON public.client_progress_photos;
CREATE POLICY "Trainers can manage own clients progress photos" ON public.client_progress_photos
FOR ALL TO authenticated USING (public.is_my_client(user_id)) WITH CHECK (public.is_my_client(user_id));

-- test_results
DROP POLICY IF EXISTS "Trainers can view all results" ON public.test_results;
CREATE POLICY "Trainers can view own clients results" ON public.test_results
FOR SELECT TO authenticated USING (public.is_my_client(user_id));

-- session_ledger
DROP POLICY IF EXISTS "Trainers can view all ledger entries" ON public.session_ledger;
DROP POLICY IF EXISTS "Trainers can insert ledger entries" ON public.session_ledger;
CREATE POLICY "Trainers can view own clients ledger entries" ON public.session_ledger
FOR SELECT TO authenticated USING (public.is_my_client(user_id));
CREATE POLICY "Trainers can insert own clients ledger entries" ON public.session_ledger
FOR INSERT TO authenticated WITH CHECK (public.is_my_client(user_id));

-- client_achievements
DROP POLICY IF EXISTS "Trainers can view all achievements" ON public.client_achievements;
DROP POLICY IF EXISTS "Trainers can insert achievements" ON public.client_achievements;
DROP POLICY IF EXISTS "Trainers can update achievements" ON public.client_achievements;
DROP POLICY IF EXISTS "Trainers can delete achievements" ON public.client_achievements;
CREATE POLICY "Trainers can view own clients achievements" ON public.client_achievements
FOR SELECT TO authenticated USING (public.is_my_client(user_id));
CREATE POLICY "Trainers can insert own clients achievements" ON public.client_achievements
FOR INSERT TO authenticated WITH CHECK (public.is_my_client(user_id));
CREATE POLICY "Trainers can update own clients achievements" ON public.client_achievements
FOR UPDATE TO authenticated USING (public.is_my_client(user_id)) WITH CHECK (public.is_my_client(user_id));
CREATE POLICY "Trainers can delete own clients achievements" ON public.client_achievements
FOR DELETE TO authenticated USING (public.is_my_client(user_id));