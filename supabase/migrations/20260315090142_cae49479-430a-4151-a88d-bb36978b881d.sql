INSERT INTO public.user_roles (user_id, role) VALUES
  ('8b693972-e8bc-4d45-8503-ea0761a17713', 'client'),
  ('f01d053b-50ca-4012-aacf-afd22893ffe2', 'client'),
  ('dd511de7-77b2-4fe9-9c02-5dfd2793d1c0', 'client'),
  ('10f39e83-2fb0-4ba5-a6bc-dd313cdf6b75', 'client'),
  ('0068d7ed-819d-4bf8-88b2-4a83570ee85b', 'client'),
  ('ac0371c3-194f-40d3-9a0e-9409754100d5', 'client'),
  ('ed5746a8-5b15-4677-b13d-033c18be92e8', 'client'),
  ('06c9f81d-3e74-4142-affa-6a4cf5e9d570', 'client'),
  ('88dc729c-a956-4eeb-b99f-b9477c966e9d', 'client'),
  ('45b94ab4-ad62-4de2-9025-df151ef65df3', 'client'),
  ('4d01a489-dcaa-430a-be80-62a4f552cb9e', 'client'),
  ('562cc346-a60d-4fb9-aa02-1255af780e71', 'client')
ON CONFLICT (user_id, role) DO NOTHING;