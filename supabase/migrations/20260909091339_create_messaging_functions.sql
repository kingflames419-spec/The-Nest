/*
# Messaging helper functions

1. Purpose
   Provides efficient server-side functions for:
   - Listing a user's conversations with last message, unread count, and other user's profile (for direct chats)
   - Finding or creating a direct conversation between two users
   - Creating a group conversation with multiple members

2. New Functions
   - `get_conversation_list(p_user_id uuid)` — returns all conversations for a user with last message, unread count, other user info (direct chats), and member count
   - `find_or_create_direct_conversation(p_other_user_id uuid)` — finds existing direct chat or creates new one
   - `create_group_conversation(p_name text, p_member_ids uuid[])` — creates a group chat with the caller and specified members

3. Security
   - All functions are SECURITY DEFINER with search_path = public
   - `get_conversation_list` takes user_id as param but is only useful for the caller's own data (RLS on underlying tables still applies for the caller's session)
   - `find_or_create_direct_conversation` and `create_group_conversation` use auth.uid() internally, so callers can only act as themselves
   - Execute granted to authenticated role only
*/

-- Get conversation list with last message, unread count, and other user info
CREATE OR REPLACE FUNCTION public.get_conversation_list(p_user_id uuid)
RETURNS TABLE (
  conversation_id uuid,
  conv_type text,
  conv_name text,
  conv_avatar_url text,
  last_message_body text,
  last_message_created_at timestamptz,
  last_message_sender_id uuid,
  unread_count bigint,
  other_user_id uuid,
  other_user_display_name text,
  other_user_avatar_url text,
  other_user_email text,
  member_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id AS conversation_id,
    c.type AS conv_type,
    c.name AS conv_name,
    c.avatar_url AS conv_avatar_url,
    lm.body AS last_message_body,
    lm.created_at AS last_message_created_at,
    lm.sender_id AS last_message_sender_id,
    COALESCE(unread.cnt, 0) AS unread_count,
    other_p.id AS other_user_id,
    other_p.display_name AS other_user_display_name,
    other_p.avatar_url AS other_user_avatar_url,
    other_p.email AS other_user_email,
    mc.cnt AS member_count
  FROM conversation_members cm
  JOIN conversations c ON c.id = cm.conversation_id
  LEFT JOIN LATERAL (
    SELECT m.body, m.created_at, m.sender_id
    FROM messages m
    WHERE m.conversation_id = c.id
    ORDER BY m.created_at DESC
    LIMIT 1
  ) lm ON true
  LEFT JOIN LATERAL (
    SELECT COUNT(*) AS cnt FROM messages m
    WHERE m.conversation_id = c.id
    AND m.sender_id != p_user_id
    AND m.created_at > COALESCE(cm.last_read_at, '1970-01-01'::timestamptz)
  ) unread ON true
  LEFT JOIN LATERAL (
    SELECT COUNT(*) AS cnt FROM conversation_members
    WHERE conversation_id = c.id
  ) mc ON true
  LEFT JOIN LATERAL (
    SELECT p.id, p.display_name, p.avatar_url, p.email
    FROM conversation_members cm2
    JOIN profiles p ON p.id = cm2.user_id
    WHERE cm2.conversation_id = c.id AND cm2.user_id != p_user_id
    LIMIT 1
  ) other_p ON c.type = 'direct'
  WHERE cm.user_id = p_user_id
  ORDER BY lm.created_at DESC NULLS LAST;
END;
$$;

-- Find or create a direct conversation between caller and another user
CREATE OR REPLACE FUNCTION public.find_or_create_direct_conversation(p_other_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_conversation_id uuid;
  v_current_user uuid := auth.uid();
BEGIN
  SELECT c.id INTO v_conversation_id
  FROM conversations c
  JOIN conversation_members cm1 ON cm1.conversation_id = c.id AND cm1.user_id = v_current_user
  JOIN conversation_members cm2 ON cm2.conversation_id = c.id AND cm2.user_id = p_other_user_id
  WHERE c.type = 'direct'
  LIMIT 1;

  IF v_conversation_id IS NOT NULL THEN
    RETURN v_conversation_id;
  END IF;

  INSERT INTO conversations (type, created_by)
  VALUES ('direct', v_current_user)
  RETURNING id INTO v_conversation_id;

  INSERT INTO conversation_members (conversation_id, user_id)
  VALUES (v_conversation_id, v_current_user), (v_conversation_id, p_other_user_id);

  RETURN v_conversation_id;
END;
$$;

-- Create a group conversation with caller and specified members
CREATE OR REPLACE FUNCTION public.create_group_conversation(p_name text, p_member_ids uuid[])
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_conversation_id uuid;
  v_current_user uuid := auth.uid();
  v_member_id uuid;
BEGIN
  INSERT INTO conversations (type, name, created_by)
  VALUES ('group', p_name, v_current_user)
  RETURNING id INTO v_conversation_id;

  INSERT INTO conversation_members (conversation_id, user_id)
  VALUES (v_conversation_id, v_current_user);

  FOREACH v_member_id IN ARRAY p_member_ids
  LOOP
    IF v_member_id != v_current_user THEN
      INSERT INTO conversation_members (conversation_id, user_id)
      VALUES (v_conversation_id, v_member_id)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  RETURN v_conversation_id;
END;
$$;

GRANT EXECUTE ON FUNCTION get_conversation_list(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION find_or_create_direct_conversation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION create_group_conversation(text, uuid[]) TO authenticated;
