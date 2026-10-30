DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_roles WHERE rolname = 'marketfa_auth_runtime'
  ) THEN
    CREATE ROLE marketfa_auth_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS NOINHERIT;
  END IF;
END
$$;

ALTER ROLE marketfa_auth_runtime
  WITH LOGIN PASSWORD :'auth_password'
  NOINHERIT NOSUPERUSER NOBYPASSRLS;

GRANT USAGE ON SCHEMA public TO marketfa_auth_runtime;
