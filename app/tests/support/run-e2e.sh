#!/bin/bash
# Postgres test cycle. Usage: [WR_CONFIG=...] /tmp/pcycle.sh [build] tests...
# For each test: fresh database (all supabase/migrations), mock AI providers, the Node server on :8787, then the test.
CFG=${WR_CONFIG:-/tmp/wr/wrangler.jsonc}
APP=/home/user/website-17609620527ef5f4f428f302/app
export PATH=$HOME/.bun/bin:$PATH
export DATABASE_URL=postgres://postgres:local-test-only@127.0.0.1:54329/postgres
/home/user/pgport/pgstart.sh >/dev/null
if [ "$1" = "build" ]; then shift; cd $APP && rm -rf .output && NITRO_PRESET=node-server bunx vite build > /tmp/build.log 2>&1 || { echo BUILD FAILED; grep -A5 "error during build" /tmp/build.log; exit 1; }; echo built; fi
for t in "$@"; do
  pkill -f "[.]output/server/index.mjs" 2>/dev/null; pkill -f "[m]ock-ai.mjs" 2>/dev/null; pkill -f "[m]ock-providers.mjs" 2>/dev/null; sleep 1
  node /home/user/pgport/migrate.mjs $APP/supabase/migrations --fresh > /tmp/migrate.log 2>&1 || { echo MIGRATE FAILED; tail -5 /tmp/migrate.log; }
  nohup node $APP/tests/mock-ai.mjs >> /tmp/mock-ai.log 2>&1 &
  nohup node $APP/tests/mock-providers.mjs >> /tmp/mock-providers.log 2>&1 &
  ( eval "$(node /home/user/pgport/envfrom.mjs $CFG)"; export PORT=8787 HOST=127.0.0.1 NITRO_PORT=8787 NITRO_HOST=127.0.0.1 DB_POOL_MAX=4; cd $APP && nohup node .output/server/index.mjs > /tmp/server.log 2>&1 & )
  up=0; for i in $(seq 1 40); do sleep 1; curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8787/ 2>/dev/null | grep -q 200 && up=1 && break; done
  [ $up = 1 ] && echo up || { echo down; tail -15 /tmp/server.log; }
  cd $APP && WR_CONFIG=$CFG node tests/$t > /tmp/test-$t.log 2>&1; echo "$t exit $?"; tail -1 /tmp/test-$t.log
done
echo ALLDONE
