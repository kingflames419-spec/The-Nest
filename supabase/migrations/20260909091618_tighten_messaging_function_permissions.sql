/*
# Tighten messaging function permissions

1. Purpose
   Ensures messaging helper functions cannot be called by signed-out visitors and fixes mutable search paths.

2. Security
   - Revokes EXECUTE from anon for every messaging SECURITY DEFINER function.
   - Grants EXECUTE only to authenticated users.
   - Pins the profile timestamp trigger function search path to public.
*/

ALTER FUNCTION public.update_profiles_updated_at() SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_profiles_updated_at() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.find_or_create_direct_conversation(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_group_conversation(text, uuid[]) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_conversation_list(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_conversation_member(uuid, uuid) FROM anon;

GRANT EXECUTE ON FUNCTION public.find_or_create_direct_conversation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_group_conversation(text, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_conversation_list(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_conversation_member(uuid, uuid) TO authenticated;
