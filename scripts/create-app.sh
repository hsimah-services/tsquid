#!/usr/bin/env bash
#
# Create a new tsquid app from templates/app.
#
#   scripts/create-app.sh ../my-app
#
# The app depends on the published @tsquid packages, at the versions in this checkout.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEMPLATE="$ROOT/templates/app"

usage() {
    echo "usage: scripts/create-app.sh <directory>" >&2
    exit 2
}

TARGET=""
while [ $# -gt 0 ]; do
    case "$1" in
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

sed -i -E \
    -e "s|\"name\": \"tsquid-app\"|\"name\": \"$NAME\"|" \
    -e "s|\"type\": \"module\",|\"type\": \"module\",\n  \"packageManager\": \"pnpm@12.4.1\",|" \
    "$TARGET/package.json"
# workspace:* only resolves inside this repo; pin each package's published version instead.
for manifest in "$ROOT"/packages/*/package.json; do
    package="$(basename "$(dirname "$manifest")")"
    version="$(sed -nE 's/^  "version": "([^"]+)",?$/\1/p' "$manifest")"
    sed -i -e "s|\"@tsquid/$package\": \"workspace:\*\"|\"@tsquid/$package\": \"^$version\"|" "$TARGET/package.json"
done
if grep -q 'workspace:' "$TARGET/package.json"; then
    echo "scripts/create-app.sh: unresolved workspace dependency in $TARGET/package.json" >&2
    exit 1
fi
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
Created $NAME in $TARGET.

Next:
  cd $TARGET
  git init
  scripts/toolchain.sh pnpm install
  scripts/dev.sh
EOF
