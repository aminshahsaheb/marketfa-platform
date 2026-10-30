SELECT format(
  'CREATE ROLE marketfa_runtime LOGIN PASSWORD %L INHERIT NOSUPERUSER NOBYPASSRLS',
  :'app_password'
)
WHERE NOT EXISTS (
  SELECT 1 FROM pg_roles WHERE rolname = 'marketfa_runtime'
)
\gexec

ALTER ROLE marketfa_runtime
  WITH LOGIN PASSWORD :'app_password'
  INHERIT NOSUPERUSER NOBYPASSRLS;

GRANT marketfa_app TO marketfa_runtime;
