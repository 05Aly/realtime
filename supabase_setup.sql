-- ==========================================
-- 1. Create Tables
-- ==========================================

-- Profiles Table (Linked to Supabase Auth)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  avatar_url TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Chat Rooms Table
CREATE TABLE IF NOT EXISTS public.rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- Messages Table
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ==========================================
-- 2. Enable Row Level Security (RLS)
-- ==========================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- 3. Define Security Policies (RLS)
-- ==========================================

-- --- PROFILES POLICIES ---
-- Allow read access to anyone authenticated
CREATE POLICY "Allow public read access to profiles" 
ON public.profiles FOR SELECT 
TO authenticated 
USING (true);

-- Allow users to update their own profile
CREATE POLICY "Allow individual update to own profile" 
ON public.profiles FOR UPDATE 
TO authenticated 
USING (auth.uid() = id) 
WITH CHECK (auth.uid() = id);

-- Allow individual insert of own profile (though handled by the system trigger as well)
CREATE POLICY "Allow individual insert of own profile" 
ON public.profiles FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = id);


-- --- ROOMS POLICIES ---
-- Allow any authenticated user to view rooms
CREATE POLICY "Allow authenticated read access to rooms" 
ON public.rooms FOR SELECT 
TO authenticated 
USING (true);

-- Allow any authenticated user to create a room
CREATE POLICY "Allow authenticated to write rooms" 
ON public.rooms FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = created_by);


-- --- MESSAGES POLICIES ---
-- Allow any authenticated user to read room messages
CREATE POLICY "Allow authenticated to read messages" 
ON public.messages FOR SELECT 
TO authenticated 
USING (true);

-- Allow any authenticated user to insert messages in a room as themselves
CREATE POLICY "Allow authenticated to insert messages" 
ON public.messages FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);


-- ==========================================
-- 4. User Profile Creation Trigger on Sign Up
-- ==========================================

-- Trigger Function to create profile when auth.users is populated
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, avatar_url, updated_at)
  VALUES (
    new.id,
    COALESCE(
      new.raw_user_meta_data->>'username', 
      split_part(new.email, '@', 1) || '_' || substr(md5(random()::text), 1, 4)
    ),
    COALESCE(
      new.raw_user_meta_data->>'avatar_url',
      'https://api.dicebear.com/7.x/bottts/svg?seed=' || urlencode(new.id::text)
    ),
    NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Bind Trigger to Auth.Users
-- Make sure to drop the trigger if it exists to allow re-runs
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==========================================
-- 5. Seed Initial Room (Optional but helpful)
-- ==========================================
-- Safe insert for default room if desired (Note: needs a created_by profile, or create it empty with no restrictions)
-- To avoid foreign key issues on seed, you can run this after signing up your first user, or insert it manually:
-- INSERT INTO public.rooms (name) VALUES ('General') ON CONFLICT (name) DO NOTHING;
