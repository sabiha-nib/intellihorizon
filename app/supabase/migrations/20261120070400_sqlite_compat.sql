-- Small compatibility functions so the app's SQL (written for SQLite/D1) runs unchanged where the meaning is clear.
-- Each matches SQLite's behaviour for the arguments the app uses; anything else raises an error rather than guessing.

-- datetime('now') -> 'YYYY-MM-DD HH:MM:SS' in UTC, as SQLite returns it.
CREATE OR REPLACE FUNCTION datetime(arg text) RETURNS text LANGUAGE plpgsql STABLE AS $$
BEGIN
  IF arg = 'now' THEN RETURN to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'); END IF;
  RETURN to_char((arg::timestamptz) AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS');
END $$;

-- strftime(format, isoTime [, '+N hours']): supports %Y, %m, %d, %H, %M, %S, %W (SQLite's Monday-based week 00-53)
-- and %j. The app uses '%Y-%W' with an optional hour shift for the learner's day boundary.
CREATE OR REPLACE FUNCTION strftime(fmt text, ts text, modifier text DEFAULT NULL) RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  t timestamp;
  h int;
  res text := fmt;
  yday int;
  wd int;
BEGIN
  IF ts IS NULL THEN RETURN NULL; END IF;
  t := (ts::timestamptz) AT TIME ZONE 'UTC';
  IF modifier IS NOT NULL THEN
    IF modifier ~ '^[+-]?\d+ hours?$' THEN
      h := (regexp_replace(modifier, '\s*hours?$', ''))::int;
      t := t + make_interval(hours => h);
    ELSE
      RAISE EXCEPTION 'strftime: unsupported modifier %', modifier;
    END IF;
  END IF;
  yday := extract(doy FROM t)::int - 1;
  wd := (extract(dow FROM t)::int + 6) % 7;
  res := replace(res, '%Y', to_char(t, 'YYYY'));
  res := replace(res, '%m', to_char(t, 'MM'));
  res := replace(res, '%d', to_char(t, 'DD'));
  res := replace(res, '%H', to_char(t, 'HH24'));
  res := replace(res, '%M', to_char(t, 'MI'));
  res := replace(res, '%S', to_char(t, 'SS'));
  res := replace(res, '%j', lpad((yday + 1)::text, 3, '0'));
  res := replace(res, '%W', lpad(((yday + 7 - wd) / 7)::text, 2, '0'));
  RETURN res;
END $$;

-- round(double precision, n): SQLite rounds REALs to n decimals; Postgres only has round(numeric, int).
CREATE OR REPLACE FUNCTION round(x double precision, n integer) RETURNS double precision LANGUAGE sql IMMUTABLE AS
$$ SELECT round(x::numeric, n)::double precision $$;

-- instr(haystack, needle) -> 1-based position or 0.
CREATE OR REPLACE FUNCTION instr(h text, n text) RETURNS integer LANGUAGE sql IMMUTABLE AS $$ SELECT strpos(h, n) $$;

-- ifnull(a, b) == coalesce(a, b).
CREATE OR REPLACE FUNCTION ifnull(a anycompatible, b anycompatible) RETURNS anycompatible LANGUAGE sql IMMUTABLE AS $$ SELECT coalesce(a, b) $$;

GRANT EXECUTE ON FUNCTION datetime(text), strftime(text, text, text), round(double precision, integer), instr(text, text) TO ih_app;
