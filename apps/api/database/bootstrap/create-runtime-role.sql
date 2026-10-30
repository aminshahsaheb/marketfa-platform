SELECT format(
  'CREATE ROLE marketfa_runtime LOGIN PASSWORD %L INHERIT NOSUPERUSER NOBYPASSRLS',
  :'app_password'
)
WHERE NOT EXISTS (
  SELECT 1 FROM pg_roles WHERE rolname = 'marketfa_runtime'
)
\gexec

GRANT marketfa_app TO marketfa_runtime;
