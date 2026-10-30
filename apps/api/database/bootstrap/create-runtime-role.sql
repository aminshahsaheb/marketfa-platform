DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'marketfa_app') THEN
    CREATE ROLE marketfa_app NOLOGIN NOSUPERUSER NOBYPASSRLS NOINHERIT;
  END IF;
END
$$;

ALTER ROLE marketfa_app NOLOGIN NOSUPERUSER NOBYPASSRLS NOINHERIT;

SELECT format(
  'CREATE ROLE marketfa_runtime LOGIN PASSWORD %L NOINHERIT NOSUPERUSER NOBYPASSRLS',
  :'app_password'
)
WHERE NOT EXISTS (
  SELECT 1 FROM pg_roles WHERE rolname = 'marketfa_runtime'
)
\gexec

ALTER ROLE marketfa_runtime
  WITH LOGIN PASSWORD :'app_password'
  NOINHERIT NOSUPERUSER NOBYPASSRLS;

GRANT marketfa_app TO marketfa_runtime;
