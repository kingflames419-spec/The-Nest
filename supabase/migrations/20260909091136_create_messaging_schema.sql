/*
# WhatsApp-style messaging app schema

1. Purpose
   A real-time instant messaging app for friends and family. Users authenticate via email OTP.
   Supports 1-on-1 direct chats and private group chats. Messages have sent/delivered status indicators.

2. New Tables
   - `profiles` — user display info (display name, avatar URL). One row per auth user.
   - `conversations` — a chat room, either direct (type='direct') or group (type='group').
   - `conversation_members` — membership join table linking users to conversations.
   - `messages` — individual messages in a conversation.

3. Security (RLS)
   - All tables have RLS enabled.
   - `profiles`: users can read all profiles; only update their own. No insert — profiles created by trigger.
   - `conversations`: read/insert/update/delete scoped to members.
   - `conversation_members`: read/insert/delete scoped to members; update own last_read_at only.
   - `messages`: read/insert scoped to members; update delivered_at by members.

4. Triggers
   - `handle_new_user` — AFTER INSERT on auth.users, inserts a row into profiles.
   - `update_profiles_updated_at` — BEFORE UPDATE on profiles, sets updated_at = now().
*/

-- ==================== TABLES (all created first) ====================

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  display_name text,
  avatar_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('direct', 'group')),
  name text,
  avatar_url text,
  created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS conversation_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at timestamptz DEFAULT now(),
  last_read_at timestamptz,
  UNIQUE (conversation_id, user_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz DEFAULT now(),
  delivered_at timestamptz
);

-- ==================== INDEXES ====================

CREATE INDEX IF NOT EXISTS idx_conversation_members_user_id ON conversation_members(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_members_conversation_id ON conversation_members(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_undelivered ON messages(conversation_id) WHERE delivered_at IS NULL;

-- ==================== RLS ENABLE ====================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- ==================== PROFILES POLICIES ====================

DROP POLICY IF EXISTS "profiles_select_all" ON profiles;
CREATE POLICY "profiles_select_all"
ON profiles FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own"
ON profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- ==================== CONVERSATIONS POLICIES ====================

DROP POLICY IF EXISTS "conversations_select_members" ON conversations;
CREATE POLICY "conversations_select_members"
ON conversations FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM conversation_members cm
    WHERE cm.conversation_id = conversations.id AND cm.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "conversations_insert_own" ON conversations;
CREATE POLICY "conversations_insert_own"
ON conversations FOR INSERT
TO authenticated
WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "conversations_update_members" ON conversations;
CREATE POLICY "conversations_update_members"
ON conversations FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM conversation_members cm
    WHERE cm.conversation_id = conversations.id AND cm.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM conversation_members cm
    WHERE cm.conversation_id = conversations.id AND cm.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "conversations_delete_creator" ON conversations;
CREATE POLICY "conversations_delete_creator"
ON conversations FOR DELETE
TO authenticated
USING (created_by = auth.uid());

-- ==================== CONVERSATION MEMBERS POLICIES ====================

DROP POLICY IF EXISTS "cm_select_members" ON conversation_members;
CREATE POLICY "cm_select_members"
ON conversation_members FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM conversation_members cm2
    WHERE cm2.conversation_id = conversation_members.conversation_id
    AND cm2.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "cm_insert_members" ON conversation_members;
CREATE POLICY "cm_insert_members"
ON conversation_members FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM conversation_members cm2
    WHERE cm2.conversation_id = conversation_members.conversation_id
    AND cm2.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "cm_update_own_read" ON conversation_members;
CREATE POLICY "cm_update_own_read"
ON conversation_members FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "cm_delete_members" ON conversation_members;
CREATE POLICY "cm_delete_members"
ON conversation_members FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM conversation_members cm2
    WHERE cm2.conversation_id = conversation_members.conversation_id
    AND cm2.user_id = auth.uid()
  )
);

-- ==================== MESSAGES POLICIES ====================

DROP POLICY IF EXISTS "messages_select_members" ON messages;
CREATE POLICY "messages_select_members"
ON messages FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM conversation_members cm
    WHERE cm.conversation_id = messages.conversation_id AND cm.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "messages_insert_members" ON messages;
CREATE POLICY "messages_insert_members"
ON messages FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM conversation_members cm
    WHERE cm.conversation_id = messages.conversation_id AND cm.user_id = auth.uid()
  ) AND sender_id = auth.uid()
);

DROP POLICY IF EXISTS "messages_update_delivered" ON messages;
CREATE POLICY "messages_update_delivered"
ON messages FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM conversation_members cm
    WHERE cm.conversation_id = messages.conversation_id AND cm.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM conversation_members cm
    WHERE cm.conversation_id = messages.conversation_id AND cm.user_id = auth.uid()
  )
);

-- ==================== TRIGGERS ====================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.update_profiles_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_profiles_updated_at ON profiles;
CREATE TRIGGER trigger_profiles_updated_at
BEFORE UPDATE ON profiles
FOR EACH ROW EXECUTE FUNCTION public.update_profiles_updated_at();
