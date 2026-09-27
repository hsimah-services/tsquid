# Rust + Node toolchain for tsquid; see scripts/toolchain.sh.
# The Rust image supplies the C linker cargo needs; Node is copied in beside it.
FROM docker.io/library/node:22-slim AS node

FROM docker.io/library/rust:1
COPY --from=node /usr/local/bin/node /usr/local/bin/
COPY --from=node /usr/local/lib/node_modules /usr/local/lib/node_modules
# Fixed paths because the runner overrides HOME: Corepack caches pnpm's wrapper,
# and the wrapper downloads pnpm's native binary under XDG_DATA_HOME.
ENV COREPACK_HOME=/usr/local/corepack XDG_DATA_HOME=/usr/local/share
# Resolved at build time so containers never need the network just to run pnpm.
RUN ln -s ../lib/node_modules/corepack/dist/corepack.js /usr/local/bin/corepack \
    && corepack enable && corepack prepare pnpm@12.4.1 --activate \
    && pnpm --version \
    && chmod -R a+rX /usr/local/corepack /usr/local/share/pnpm

WORKDIR /work/tsquid
