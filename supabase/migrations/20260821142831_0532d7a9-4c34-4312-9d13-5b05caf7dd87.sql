CREATE TABLE public.client_errors (
  id uuid primary key default gen_random_uuid(),
  fingerprint text not null,
  message text not null,
  stack text,
  source text not null default 'unknown',
  level text not null default 'warning',
  route text,
  url text,
  release text,
  viewport text,
  breadcrumbs text,
  user_id uuid,
  user_name text,
  user_agent text,
  online boolean not null default true,
  user_visible boolean not null default false,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

CREATE INDEX client_errors_created_at_idx ON public.client_errors (created_at DESC);
CREATE INDEX client_errors_fingerprint_idx ON public.client_errors (fingerprint);

GRANT SELECT ON public.client_errors TO authenticated;
GRANT ALL ON public.client_errors TO service_role;

ALTER TABLE public.client_errors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view client errors"
ON public.client_errors FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'trainer'));