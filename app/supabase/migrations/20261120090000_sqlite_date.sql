-- SQLite's date(time [, modifier]) for the learner's local day: date(created_at, '+6 hours') -> 'YYYY-MM-DD'.
-- Supports a single "+N hours|minutes|days" modifier (what the app uses); anything else raises an error.
CREATE OR REPLACE FUNCTION date(ts text, modifier text) RETURNS text LANGUAGE plpgsql STABLE AS $$
DECLARE m text[]; t timestamp;
BEGIN
  IF ts IS NULL THEN RETURN NULL; END IF;
  t := (ts::timestamptz) AT TIME ZONE 'UTC';
  IF modifier IS NOT NULL THEN
    m := regexp_match(modifier, '^\s*([+-]?\d+)\s+(hours?|minutes?|days?)\s*$');
    IF m IS NULL THEN RAISE EXCEPTION 'date: unsupported modifier %', modifier; END IF;
    t := t + (m[1] || ' ' || m[2])::interval;
  END IF;
  RETURN to_char(t, 'YYYY-MM-DD');
END $$;
CREATE OR REPLACE FUNCTION date(ts text) RETURNS text LANGUAGE sql STABLE AS $$ SELECT date(ts, NULL::text) $$;
DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ih_app') THEN
  GRANT EXECUTE ON FUNCTION date(text, text), date(text) TO ih_app;
END IF; END $$;
