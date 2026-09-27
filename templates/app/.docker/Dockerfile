# Node toolchain for a tsquid app; see scripts/toolchain.sh.
FROM docker.io/library/node:22-slim

# Fixed paths because the runner overrides HOME: Corepack caches pnpm's wrapper,
# and the wrapper downloads pnpm's native binary under XDG_DATA_HOME.
ENV COREPACK_HOME=/usr/local/corepack XDG_DATA_HOME=/usr/local/share
# Resolved at build time so containers never need the network just to run pnpm.
RUN corepack enable && corepack prepare pnpm@12.4.1 --activate \
    && pnpm --version \
    && chmod -R a+rX /usr/local/corepack /usr/local/share/pnpm

WORKDIR /work/app
