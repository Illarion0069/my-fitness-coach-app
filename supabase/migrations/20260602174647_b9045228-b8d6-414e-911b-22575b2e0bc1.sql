-- Table for storing applications to the Ground Movement & Flow System course waitlist
CREATE TABLE public.flow_course_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  name text NOT NULL,
  email text NOT NULL,
  whatsapp text,
  preferred_language text,
  fitness_level text,
  main_goal text,
  injuries_limitations text,
  selected_package text NOT NULL,
  referral_source text,
  status text NOT NULL DEFAULT 'new'
);

-- Grants: anyone can submit a lead (anon + authenticated), only trainers can read/manage them
GRANT INSERT ON public.flow_course_leads TO anon;
GRANT INSERT, SELECT, UPDATE, DELETE ON public.flow_course_leads TO authenticated;
GRANT ALL ON public.flow_course_leads TO service_role;

ALTER TABLE public.flow_course_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit a flow course lead"
ON public.flow_course_leads
FOR INSERT
TO anon, authenticated
WITH CHECK (
  length(coalesce(name, '')) BETWEEN 1 AND 120
  AND length(coalesce(email, '')) BETWEEN 3 AND 255
  AND length(coalesce(selected_package, '')) BETWEEN 1 AND 50
);

CREATE POLICY "Trainers can view flow course leads"
ON public.flow_course_leads
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'trainer'::app_role));

CREATE POLICY "Trainers can update flow course leads"
ON public.flow_course_leads
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'trainer'::app_role))
WITH CHECK (has_role(auth.uid(), 'trainer'::app_role));

CREATE POLICY "Trainers can delete flow course leads"
ON public.flow_course_leads
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'trainer'::app_role));

CREATE INDEX idx_flow_course_leads_created_at ON public.flow_course_leads (created_at DESC);
CREATE INDEX idx_flow_course_leads_status ON public.flow_course_leads (status);