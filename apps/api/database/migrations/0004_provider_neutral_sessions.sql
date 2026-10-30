-- Provider-neutral opaque server-side sessions.
-- The authentication provider must verify the human identity before calling
-- auth_create_session. Raw bearer tokens never enter PostgreSQL.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_roles WHERE rolname = 'marketfa_auth_owner'
  ) THEN
    CREATE ROLE marketfa_auth_owner NOLOGIN NOSUPERUSER NOBYPASSRLS NOINHERIT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_roles WHERE rolname = 'marketfa_auth_runtime'
  ) THEN
    CREATE ROLE marketfa_auth_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS NOINHERIT;
  END IF;
END
$$;

ALTER ROLE marketfa_auth_owner NOLOGIN NOSUPERUSER NOBYPASSRLS NOINHERIT;
ALTER ROLE marketfa_auth_runtime NOINHERIT NOSUPERUSER NOBYPASSRLS;

GRANT USAGE ON SCHEMA public TO marketfa_auth_owner;
GRANT USAGE ON SCHEMA public TO marketfa_auth_runtime;
GRANT SELECT ON users, auth_identities TO marketfa_auth_owner;
GRANT SELECT, INSERT, UPDATE ON user_sessions TO marketfa_auth_owner;
GRANT USAGE ON SCHEMA public TO marketfa_runtime;

CREATE POLICY auth_owner_users_read ON users
  FOR SELECT TO marketfa_auth_owner
  USING (true);

CREATE POLICY auth_owner_auth_identities_read ON auth_identities
  FOR SELECT TO marketfa_auth_owner
  USING (true);

CREATE POLICY auth_owner_sessions_read ON user_sessions
  FOR SELECT TO marketfa_auth_owner
  USING (true);

CREATE POLICY auth_owner_sessions_insert ON user_sessions
  FOR INSERT TO marketfa_auth_owner
  WITH CHECK (true);

CREATE POLICY auth_owner_sessions_update ON user_sessions
  FOR UPDATE TO marketfa_auth_owner
  USING (true)
  WITH CHECK (true);

ALTER TABLE user_sessions
  ADD CONSTRAINT user_sessions_sha256_token_hash_ck
    CHECK (octet_length(token_hash) = 32),
  ADD CONSTRAINT user_sessions_absolute_ttl_ck
    CHECK (expires_at <= created_at + interval '720 hours');

CREATE OR REPLACE FUNCTION auth_resolve_identity(
  p_provider_key TEXT,
  p_provider_subject TEXT
)
RETURNS TABLE(identity_id UUID, user_id UUID)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
  SELECT identity.id, identity.user_id
  FROM public.auth_identities AS identity
  JOIN public.users AS account ON account.id = identity.user_id
  WHERE p_provider_key IS NOT NULL
    AND p_provider_subject IS NOT NULL
    AND length(p_provider_key) BETWEEN 1 AND 128
    AND length(p_provider_subject) BETWEEN 1 AND 512
    AND identity.provider_key = p_provider_key
    AND identity.provider_subject = p_provider_subject
    AND identity.verified_at IS NOT NULL
    AND account.status = 'ACTIVE'
$function$;

CREATE OR REPLACE FUNCTION auth_create_session(
  p_auth_identity_id UUID,
  p_token_hash BYTEA,
  p_ttl_seconds INTEGER,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS TABLE(session_id UUID, user_id UUID, expires_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  verified_user_id UUID;
BEGIN
  IF p_auth_identity_id IS NULL
     OR p_token_hash IS NULL
     OR octet_length(p_token_hash) <> 32
     OR p_ttl_seconds < 60
     OR p_ttl_seconds > 2592000 THEN
    RETURN;
  END IF;

  SELECT identity.user_id
  INTO verified_user_id
  FROM public.auth_identities AS identity
  JOIN public.users AS account ON account.id = identity.user_id
  WHERE identity.id = p_auth_identity_id
    AND identity.verified_at IS NOT NULL
    AND account.status = 'ACTIVE';

  IF NOT FOUND THEN
    RETURN;
  END IF;

  RETURN QUERY
  INSERT INTO public.user_sessions AS session (
    user_id,
    token_hash,
    created_at,
    last_seen_at,
    expires_at,
    user_agent
  )
  VALUES (
    verified_user_id,
    p_token_hash,
    statement_timestamp(),
    statement_timestamp(),
    statement_timestamp() + make_interval(secs => p_ttl_seconds),
    left(p_user_agent, 256)
  )
  RETURNING session.id, session.user_id, session.expires_at;
END;
$function$;

CREATE OR REPLACE FUNCTION auth_resolve_session(
  p_token_hash BYTEA,
  p_idle_timeout_seconds INTEGER DEFAULT 604800
)
RETURNS TABLE(session_id UUID, user_id UUID, expires_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF p_token_hash IS NULL
     OR octet_length(p_token_hash) <> 32
     OR p_idle_timeout_seconds < 60
     OR p_idle_timeout_seconds > 2592000 THEN
    RETURN;
  END IF;

  RETURN QUERY
  UPDATE public.user_sessions AS session
  SET last_seen_at = statement_timestamp()
  FROM public.users AS account
  WHERE session.user_id = account.id
    AND session.token_hash = p_token_hash
    AND session.revoked_at IS NULL
    AND session.expires_at > statement_timestamp()
    AND session.last_seen_at >
      statement_timestamp() - make_interval(secs => p_idle_timeout_seconds)
    AND account.status = 'ACTIVE'
  RETURNING session.id, session.user_id, session.expires_at;
END;
$function$;

CREATE INDEX user_sessions_rotation_parent_idx
  ON user_sessions (rotation_parent_id)
  WHERE rotation_parent_id IS NOT NULL;

CREATE OR REPLACE FUNCTION auth_rotate_session(
  p_old_token_hash BYTEA,
  p_new_token_hash BYTEA,
  p_ttl_seconds INTEGER,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS TABLE(session_id UUID, user_id UUID, expires_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  old_session public.user_sessions%ROWTYPE;
  root_created_at TIMESTAMPTZ;
  absolute_expires_at TIMESTAMPTZ;
BEGIN
  IF p_old_token_hash IS NULL
     OR octet_length(p_old_token_hash) <> 32
     OR p_new_token_hash IS NULL
     OR octet_length(p_new_token_hash) <> 32
     OR p_ttl_seconds < 60
     OR p_ttl_seconds > 2592000 THEN
    RETURN;
  END IF;

  SELECT session.*
  INTO old_session
  FROM public.user_sessions AS session
  WHERE session.token_hash = p_old_token_hash
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF old_session.revoked_at IS NOT NULL THEN
    WITH RECURSIVE session_family(id) AS (
      SELECT old_session.id
      UNION ALL
      SELECT child.id
      FROM public.user_sessions AS child
      JOIN session_family AS parent ON child.rotation_parent_id = parent.id
    )
    UPDATE public.user_sessions AS session
    SET revoked_at = statement_timestamp()
    WHERE session.id IN (SELECT id FROM session_family)
      AND session.revoked_at IS NULL;
    RETURN;
  END IF;

  IF old_session.expires_at <= statement_timestamp()
     OR old_session.last_seen_at IS NULL
     OR old_session.last_seen_at <=
       statement_timestamp() - interval '168 hours'
     OR NOT EXISTS (
       SELECT 1 FROM public.users AS account
       WHERE account.id = old_session.user_id
         AND account.status = 'ACTIVE'
     ) THEN
    RETURN;
  END IF;

  WITH RECURSIVE ancestry AS (
    SELECT session.id, session.rotation_parent_id, session.created_at
    FROM public.user_sessions AS session
    WHERE session.id = old_session.id
    UNION ALL
    SELECT parent.id, parent.rotation_parent_id, parent.created_at
    FROM public.user_sessions AS parent
    JOIN ancestry AS child ON child.rotation_parent_id = parent.id
  )
  SELECT ancestry.created_at
  INTO root_created_at
  FROM ancestry
  WHERE ancestry.rotation_parent_id IS NULL;

  IF root_created_at IS NULL THEN
    RETURN;
  END IF;

  absolute_expires_at := root_created_at + interval '720 hours';

  IF absolute_expires_at <= statement_timestamp() THEN
    RETURN;
  END IF;

  UPDATE public.user_sessions
  SET revoked_at = statement_timestamp()
  WHERE id = old_session.id
    AND revoked_at IS NULL;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  RETURN QUERY
  INSERT INTO public.user_sessions AS session (
    user_id,
    token_hash,
    created_at,
    last_seen_at,
    expires_at,
    rotation_parent_id,
    user_agent
  )
  VALUES (
    old_session.user_id,
    p_new_token_hash,
    statement_timestamp(),
    statement_timestamp(),
    LEAST(
      statement_timestamp() + make_interval(secs => p_ttl_seconds),
      absolute_expires_at
    ),
    old_session.id,
    left(p_user_agent, 256)
  )
  RETURNING session.id, session.user_id, session.expires_at;
END;
$function$;

CREATE OR REPLACE FUNCTION auth_revoke_session(p_token_hash BYTEA)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
  WITH revoked AS (
    UPDATE public.user_sessions
    SET revoked_at = statement_timestamp()
    WHERE token_hash = p_token_hash
      AND revoked_at IS NULL
    RETURNING 1
  )
  SELECT EXISTS (SELECT 1 FROM revoked)
$function$;

CREATE OR REPLACE FUNCTION auth_revoke_sessions_on_user_deactivation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF OLD.status = 'ACTIVE' AND NEW.status <> 'ACTIVE' THEN
    UPDATE public.user_sessions
    SET revoked_at = statement_timestamp()
    WHERE user_id = NEW.id
      AND revoked_at IS NULL;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER users_revoke_sessions_after_deactivation
AFTER UPDATE OF status ON users
FOR EACH ROW
EXECUTE FUNCTION auth_revoke_sessions_on_user_deactivation();

GRANT CREATE ON SCHEMA public TO marketfa_auth_owner;

ALTER FUNCTION auth_resolve_identity(TEXT, TEXT)
  OWNER TO marketfa_auth_owner;
ALTER FUNCTION auth_create_session(UUID, BYTEA, INTEGER, TEXT)
  OWNER TO marketfa_auth_owner;
ALTER FUNCTION auth_resolve_session(BYTEA, INTEGER)
  OWNER TO marketfa_auth_owner;
ALTER FUNCTION auth_rotate_session(BYTEA, BYTEA, INTEGER, TEXT)
  OWNER TO marketfa_auth_owner;
ALTER FUNCTION auth_revoke_session(BYTEA)
  OWNER TO marketfa_auth_owner;
ALTER FUNCTION auth_revoke_sessions_on_user_deactivation()
  OWNER TO marketfa_auth_owner;

REVOKE CREATE ON SCHEMA public FROM marketfa_auth_owner;

REVOKE ALL ON FUNCTION auth_resolve_identity(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION auth_create_session(UUID, BYTEA, INTEGER, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION auth_resolve_session(BYTEA, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION auth_rotate_session(BYTEA, BYTEA, INTEGER, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION auth_revoke_session(BYTEA) FROM PUBLIC;
REVOKE ALL ON FUNCTION auth_revoke_sessions_on_user_deactivation() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION auth_resolve_identity(TEXT, TEXT) TO marketfa_auth_runtime;
GRANT EXECUTE ON FUNCTION auth_create_session(UUID, BYTEA, INTEGER, TEXT) TO marketfa_auth_runtime;
GRANT EXECUTE ON FUNCTION auth_resolve_session(BYTEA, INTEGER) TO marketfa_runtime;
GRANT EXECUTE ON FUNCTION auth_rotate_session(BYTEA, BYTEA, INTEGER, TEXT) TO marketfa_runtime;
GRANT EXECUTE ON FUNCTION auth_revoke_session(BYTEA) TO marketfa_runtime;
