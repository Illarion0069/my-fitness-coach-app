UPDATE auth.users
SET email = '35794205089@phone.fitness.local',
    email_confirmed_at = COALESCE(email_confirmed_at, now())
WHERE id = '88dc729c-a956-4eeb-b99f-b9477c966e9d';