#!/usr/bin/env bash
#
# Run a Node command against the app in a throwaway container.
#
#   scripts/toolchain.sh pnpm install
#   scripts/toolchain.sh pnpm check
#   scripts/toolchain.sh pnpm routes          # tsquid-codegen is in the image
#   scripts/toolchain.sh bash                 # interactive shell
#
# There is no host Node. The container is removed on exit (--rm). Set
# TOOLCHAIN_PUBLISH (e.g. 5173:5173) to publish a port; scripts/dev.sh does.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NAME="$(basename "$ROOT" | tr '[:upper:]' '[:lower:]' | tr -c 'a-z0-9\n' '-')"

IMAGE="$NAME-toolchain:1"
CACHE_DIR="${XDG_CACHE_HOME:-$HOME/.cache}/$NAME"

if command -v podman >/dev/null 2>&1; then
    ENGINE=podman
elif command -v docker >/dev/null 2>&1; then
    ENGINE=docker
else
    echo "scripts/toolchain.sh: needs podman or docker." >&2
    exit 1
fi

if ! "$ENGINE" image inspect "$IMAGE" >/dev/null 2>&1; then
    echo "Building $IMAGE (first run only)..." >&2
    "$ENGINE" build -t "$IMAGE" -f "$ROOT/.docker/Dockerfile" "$ROOT/.docker"
fi

# Run as the host user so nothing in the working tree ends up owned by root.
# Rootless podman already maps the host user, so this is docker-only.
USER_ARGS=()
if [ "$ENGINE" = "docker" ]; then
    USER_ARGS=(--user "$(id -u):$(id -g)")
fi

PORT_ARGS=()
if [ -n "${TOOLCHAIN_PUBLISH:-}" ]; then
    PORT_ARGS=(-p "$TOOLCHAIN_PUBLISH")
fi

# Inside the container localhost is the container, so default to an API on the host.
ENV_ARGS=(
    -e "GRAPHQL_PROXY_TARGET=${GRAPHQL_PROXY_TARGET:-http://host.docker.internal:4000}"
    -e "GRAPHQL_SCHEMA_ENDPOINT=${GRAPHQL_SCHEMA_ENDPOINT:-http://host.docker.internal:4000/graphql}"
)

mkdir -p "$CACHE_DIR/pnpm-store"

TTY_ARGS=()
if [ -t 0 ] && [ -t 1 ]; then
    TTY_ARGS=(-it)
fi

exec "$ENGINE" run --rm \
    "${TTY_ARGS[@]}" \
    "${USER_ARGS[@]}" \
    "${PORT_ARGS[@]}" \
    "${ENV_ARGS[@]}" \
    `# So the app can reach an API running on the host.` \
    --add-host host.docker.internal:host-gateway \
    `# :z relabels the mount for SELinux, which Fedora enforces by default.` \
    -v "$ROOT:/work/app:z" \
    -v "$CACHE_DIR/pnpm-store:/pnpm-store:z" \
    -e pnpm_config_store_dir=/pnpm-store \
    -e HOME=/tmp \
    -w /work/app \
    "$IMAGE" "$@"
