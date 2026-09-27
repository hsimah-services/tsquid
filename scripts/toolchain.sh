#!/usr/bin/env bash
#
# Run a Rust or Node command against the repo in a throwaway container.
#
#   scripts/toolchain.sh cargo test
#   scripts/toolchain.sh pnpm install
#   scripts/toolchain.sh pnpm test
#   scripts/toolchain.sh bash                 # interactive shell
#
# There is no host Rust or Node. The container is removed on exit (--rm);
# cargo and pnpm caches persist under $XDG_CACHE_HOME/tsquid.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

IMAGE="tsquid-toolchain:1"
CACHE_DIR="${XDG_CACHE_HOME:-$HOME/.cache}/tsquid"

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

mkdir -p "$CACHE_DIR/pnpm-store" "$CACHE_DIR/cargo"

TTY_ARGS=()
if [ -t 0 ] && [ -t 1 ]; then
    TTY_ARGS=(-it)
fi

exec "$ENGINE" run --rm \
    "${TTY_ARGS[@]}" \
    "${USER_ARGS[@]}" \
    `# :z relabels the mount for SELinux, which Fedora enforces by default.` \
    -v "$ROOT:/work/tsquid:z" \
    -v "$CACHE_DIR/pnpm-store:/pnpm-store:z" \
    -v "$CACHE_DIR/cargo:/cargo:z" \
    -e pnpm_config_store_dir=/pnpm-store \
    `# The image's CARGO_HOME is root-owned; keep the registry cache writable.` \
    -e CARGO_HOME=/cargo \
    -e HOME=/tmp \
    -w /work/tsquid \
    "$IMAGE" "$@"
