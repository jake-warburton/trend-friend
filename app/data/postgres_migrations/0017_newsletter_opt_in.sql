-- Add newsletter opt-in flag to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS newsletter_opt_in BOOLEAN NOT NULL DEFAULT false;

-- Update the trigger to pick up newsletter preference from signup metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$ BEGIN
    INSERT INTO public.profiles (id, display_name, newsletter_opt_in)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
        COALESCE((NEW.raw_user_meta_data->>'newsletter_opt_in')::boolean, false)
    );
    RETURN NEW;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;
