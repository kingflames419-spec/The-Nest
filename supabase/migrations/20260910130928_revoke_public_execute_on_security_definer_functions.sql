/*
# Revoke PUBLIC EXECUTE on SECURITY DEFINER functions

The previous migration revoked EXECUTE from `anon` directly, but PostgreSQL
grants EXECUTE to PUBLIC by default when a function is created. The `anon` role
inherits from PUBLIC, so the functions were still callable by unauthenticated
users via the REST API. This migration revokes EXECUTE from PUBLIC on all
SECURITY DEFINER functions, then re-grants only to the roles that need it.

`handle_new_user` and `update_profiles_updated_at` are trigger functions — they
should never be called via the REST API, so EXECUTE is revoked from all roles.
*/

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_profiles_updated_at() FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.is_conversation_member(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_conversation_list(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.find_or_create_direct_conversation(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_group_conversation(text, uuid[]) FROM PUBLIC;

-- Re-grant to authenticated only (trigger functions stay revoked from all)
GRANT EXECUTE ON FUNCTION public.is_conversation_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_conversation_list(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.find_or_create_direct_conversation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_group_conversation(text, uuid[]) TO authenticated;
