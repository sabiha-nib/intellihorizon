#!/bin/bash
# Test-only: see d1-cli.ts. Ignores "d1 execute DB --local --config X".
exec /home/user/.bun/bin/bun /home/user/website-17609620527ef5f4f428f302/app/tests/support/d1-cli.ts "$@"
