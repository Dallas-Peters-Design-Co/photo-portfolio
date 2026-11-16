-- Row-level security on every table in public.
--
-- Named 999 so it runs last: every table a patch before it creates is covered
-- on the same run, including tables added later.
--
-- The app connects as neondb_owner, which owns every table and has BYPASSRLS,
-- so this does not change what the site can read or write. It closes the
-- other door: Neon's Data API roles (authenticator, anonymous, authenticated)
-- see nothing, because there are no policies. A table that is ever meant to
-- be read through the Data API needs a policy written for it.
--
-- Not FORCE: forcing it would apply it to the owner too and take the site down.
--
-- Schema only. Idempotent like every patch.

DO $$
DECLARE
  t record;
BEGIN
  FOR t IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')
      AND NOT c.relrowsecurity
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.relname);
  END LOOP;
END
$$;
