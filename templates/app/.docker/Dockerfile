# Node toolchain for a tsquid app, plus tsquid-codegen built from tsquid's source.
# See scripts/toolchain.sh. Both stages use bookworm so the binary's glibc matches.
FROM docker.io/library/rust:1-bookworm AS codegen
ARG TSQUID_BRANCH=main
RUN cargo install --locked --root /opt/tsquid \
    --git https://github.com/hsimah-services/tsquid --branch "$TSQUID_BRANCH" tsquid-codegen

FROM docker.io/library/node:22-bookworm-slim
COPY --from=codegen /opt/tsquid/bin/tsquid-codegen /usr/local/bin/
# pnpm clones git dependencies that live in a subdirectory (tsquid's packages).
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates git \
    && rm -rf /var/lib/apt/lists/*
# Fixed paths because the runner overrides HOME: Corepack caches pnpm's wrapper,
# and the wrapper downloads pnpm's native binary under XDG_DATA_HOME.
ENV COREPACK_HOME=/usr/local/corepack XDG_DATA_HOME=/usr/local/share
# Resolved at build time so containers never need the network just to run pnpm.
RUN corepack enable && corepack prepare pnpm@12.4.1 --activate \
    && pnpm --version \
    && chmod -R a+rX /usr/local/corepack /usr/local/share/pnpm

WORKDIR /work/app
