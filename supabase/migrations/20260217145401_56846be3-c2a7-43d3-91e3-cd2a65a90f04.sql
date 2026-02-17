
-- Update handle_new_user to handle account linking for Google OAuth
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _phone text;
  _existing_profile_id uuid;
BEGIN
  _phone := COALESCE(NEW.raw_user_meta_data->>'phone', '');

  -- For Google OAuth users, check if a profile with matching phone exists
  -- Google users won't have a phone in metadata, so just create a new profile
  -- For phone-based signups, check if phone is already taken
  IF _phone != '' THEN
    SELECT user_id INTO _existing_profile_id
    FROM public.profiles
    WHERE phone = _phone
    LIMIT 1;

    IF _existing_profile_id IS NOT NULL AND _existing_profile_id != NEW.id THEN
      -- Phone already registered under a different user — skip profile creation
      -- The login itself will fail due to duplicate email anyway
      RETURN NEW;
    END IF;
  END IF;

  INSERT INTO public.profiles (user_id, full_name, email, phone, telegram_link_code)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.email, ''),
    _phone,
    substr(md5(random()::text || NEW.id::text), 1, 12)
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$function$;
