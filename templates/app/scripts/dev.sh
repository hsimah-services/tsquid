#!/usr/bin/env bash
# Serve the app with hot reload at http://localhost:5173.
# GraphQL is proxied to GRAPHQL_PROXY_TARGET (default: port 4000 on the host).
set -euo pipefail
export TOOLCHAIN_PUBLISH="${TOOLCHAIN_PUBLISH:-5173:5173}"
exec "$(dirname "${BASH_SOURCE[0]}")/toolchain.sh" pnpm dev --host 0.0.0.0 --port 5173 "$@"
