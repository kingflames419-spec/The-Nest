/*
# Secure messaging membership checks

1. Purpose
   Fixes recursive row-security checks on conversation membership and prevents a caller from requesting another user's conversation list.

2. Changes
   - Adds `is_conversation_member` as a server-side membership helper.
   - Replaces self-referencing membership policies with the helper.
   - Replaces conversation and message membership predicates with the helper.
   - Requires `get_conversation_list` to receive the current authenticated user's ID.

3. Security
   - The helper is SECURITY DEFINER with a fixed search path and is callable only by authenticated users.
   - No policy uses an unrestricted membership shortcut.
*/

CREATE OR REPLACE FUNCTION public.is_conversation_member(p_conversation_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_members
    WHERE conversation_id = p_conversation_id AND user_id = p_user_id
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_conversation_member(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_conversation_member(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "conversations_select_members" ON conversations;
CREATE POLICY "conversations_select_members" ON conversations FOR SELECT TO authenticated
USING (public.is_conversation_member(id, auth.uid()));

DROP POLICY IF EXISTS "conversations_update_members" ON conversations;
CREATE POLICY "conversations_update_members" ON conversations FOR UPDATE TO authenticated
USING (public.is_conversation_member(id, auth.uid()))
WITH CHECK (public.is_conversation_member(id, auth.uid()));

DROP POLICY IF EXISTS "cm_select_members" ON conversation_members;
CREATE POLICY "cm_select_members" ON conversation_members FOR SELECT TO authenticated
USING (public.is_conversation_member(conversation_id, auth.uid()));

DROP POLICY IF EXISTS "cm_insert_members" ON conversation_members;
CREATE POLICY "cm_insert_members" ON conversation_members FOR INSERT TO authenticated
WITH CHECK (public.is_conversation_member(conversation_id, auth.uid()));

DROP POLICY IF EXISTS "cm_delete_members" ON conversation_members;
CREATE POLICY "cm_delete_members" ON conversation_members FOR DELETE TO authenticated
USING (public.is_conversation_member(conversation_id, auth.uid()));

DROP POLICY IF EXISTS "messages_select_members" ON messages;
CREATE POLICY "messages_select_members" ON messages FOR SELECT TO authenticated
USING (public.is_conversation_member(conversation_id, auth.uid()));

DROP POLICY IF EXISTS "messages_insert_members" ON messages;
CREATE POLICY "messages_insert_members" ON messages FOR INSERT TO authenticated
WITH CHECK (public.is_conversation_member(conversation_id, auth.uid()) AND sender_id = auth.uid());

DROP POLICY IF EXISTS "messages_update_delivered" ON messages;
CREATE POLICY "messages_update_delivered" ON messages FOR UPDATE TO authenticated
USING (public.is_conversation_member(conversation_id, auth.uid()))
WITH CHECK (public.is_conversation_member(conversation_id, auth.uid()));

CREATE OR REPLACE FUNCTION public.get_conversation_list(p_user_id uuid)
RETURNS TABLE (
  conversation_id uuid, conv_type text, conv_name text, conv_avatar_url text,
  last_message_body text, last_message_created_at timestamptz, last_message_sender_id uuid,
  unread_count bigint, other_user_id uuid, other_user_display_name text,
  other_user_avatar_url text, other_user_email text, member_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY
  SELECT c.id, c.type, c.name, c.avatar_url, lm.body, lm.created_at, lm.sender_id,
    COALESCE(unread.cnt, 0), other_p.id, other_p.display_name, other_p.avatar_url, other_p.email, mc.cnt
  FROM conversation_members cm
  JOIN conversations c ON c.id = cm.conversation_id
  LEFT JOIN LATERAL (SELECT m.body, m.created_at, m.sender_id FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) lm ON true
  LEFT JOIN LATERAL (SELECT COUNT(*) AS cnt FROM messages m WHERE m.conversation_id = c.id AND m.sender_id != p_user_id AND m.created_at > COALESCE(cm.last_read_at, '1970-01-01'::timestamptz)) unread ON true
  LEFT JOIN LATERAL (SELECT COUNT(*) AS cnt FROM conversation_members WHERE conversation_id = c.id) mc ON true
  LEFT JOIN LATERAL (SELECT p.id, p.display_name, p.avatar_url, p.email FROM conversation_members cm2 JOIN profiles p ON p.id = cm2.user_id WHERE cm2.conversation_id = c.id AND cm2.user_id != p_user_id LIMIT 1) other_p ON c.type = 'direct'
  WHERE cm.user_id = p_user_id
  ORDER BY lm.created_at DESC NULLS LAST;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_conversation_list(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_conversation_list(uuid) TO authenticated;
