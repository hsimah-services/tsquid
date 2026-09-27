#!/usr/bin/env bash
#
# Create a new tsquid app from templates/app.
#
#   scripts/create-app.sh ../my-app                    # tsquid packages from main
#   scripts/create-app.sh ../my-app --branch my-branch # from another tsquid branch
#
# Until tsquid's packages are published, the app depends on them straight from
# GitHub, and its toolchain image builds tsquid-codegen from the same branch.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEMPLATE="$ROOT/templates/app"
REPO="hsimah-services/tsquid"

usage() {
    echo "usage: scripts/create-app.sh <directory> [--branch <tsquid branch>]" >&2
    exit 2
}

TARGET=""
BRANCH="main"
while [ $# -gt 0 ]; do
    case "$1" in
        --branch) [ $# -ge 2 ] || usage; BRANCH="$2"; shift 2 ;;
        -h|--help) usage ;;
        -*) usage ;;
        *) [ -z "$TARGET" ] || usage; TARGET="$1"; shift ;;
    esac
done
[ -n "$TARGET" ] || usage

if [ -e "$TARGET" ] && [ -n "$(ls -A "$TARGET")" ]; then
    echo "scripts/create-app.sh: $TARGET exists and is not empty." >&2
    exit 1
fi

mkdir -p "$TARGET"
TARGET="$(cd "$TARGET" && pwd)"
NAME="$(basename "$TARGET" | tr '[:upper:]' '[:lower:]' | tr -c 'a-z0-9\n' '-')"

# Installed dependencies and build output are the template's, not the app's.
tar -C "$TEMPLATE" --exclude=node_modules --exclude=dist --exclude=.vite -cf - . | tar -C "$TARGET" -xf -

# workspace:* only resolves inside this repo; point at the packages on GitHub instead.
sed -i -E \
    -e "s|\"name\": \"tsquid-app\"|\"name\": \"$NAME\"|" \
    -e "s|\"type\": \"module\",|\"type\": \"module\",\n  \"packageManager\": \"pnpm@12.4.1\",|" \
    -e "s|\"@tsquid/([a-z-]+)\": \"workspace:\*\"|\"@tsquid/\1\": \"github:$REPO#$BRANCH\\&path:/packages/\1\"|" \
    "$TARGET/package.json"
sed -i -e "s|^ARG TSQUID_BRANCH=.*|ARG TSQUID_BRANCH=$BRANCH|" "$TARGET/.docker/Dockerfile"
sed -i -e "s|^# tsquid app$|# $NAME|" "$TARGET/README.md"
sed -i -e "s|<title>tsquid app</title>|<title>$NAME</title>|" "$TARGET/index.html"

# The template is a member of this repo's workspace, so it can't carry its own.
cat > "$TARGET/pnpm-workspace.yaml" <<'EOF'
allowBuilds:
  '@astryxdesign/cli': true
  '@astryxdesign/core': true
onlyBuiltDependencies:
  - "@astryxdesign/cli"
  - "@astryxdesign/core"
EOF

cat <<EOF
Created $NAME in $TARGET (tsquid branch: $BRANCH).

Next:
  cd $TARGET
  git init
  scripts/toolchain.sh pnpm install
  scripts/dev.sh
EOF
