CREATE ROLE marketfa_app NOLOGIN NOSUPERUSER NOBYPASSRLS;
CREATE ROLE marketfa_runtime LOGIN PASSWORD 'marketfa_local_only' INHERIT NOSUPERUSER NOBYPASSRLS;
GRANT marketfa_app TO marketfa_runtime;
