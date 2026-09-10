/*
# Revoke direct RPC access to is_conversation_member

`is_conversation_member` is a helper used inside RLS policy predicates.
It should not be called directly via the REST API. Revoke EXECUTE from
authenticated so it can only be used internally by the database engine
when evaluating policies.
*/

REVOKE EXECUTE ON FUNCTION public.is_conversation_member(uuid, uuid) FROM authenticated;
