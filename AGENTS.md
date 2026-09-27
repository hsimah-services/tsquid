# AGENTS.md

## Orient

- Read `NOTES.yaml` first. Update it in the same change whenever a folder, file,
  command or convention changes. Keep it terse, and keep it valid YAML.
- Keep `README.md`, the package READMEs and `ui-standards.md` in step with
  behaviour. The audience is experienced engineers: terse, no justification prose.

## Toolchain

No host Rust, Node or pnpm. Run everything through the container; add tools to
`.docker/Dockerfile`.

```sh
scripts/toolchain.sh cargo test --locked
scripts/toolchain.sh pnpm install --frozen-lockfile
scripts/toolchain.sh pnpm test      # all packages + starter check
scripts/toolchain.sh pnpm routes    # regenerate fixture + starter routes after generator changes
```

## Invariants

Don't weaken these; raise the trade-off instead.

- The generator reads `routes.json` only; it never parses application TS.
  Behaviour (`getRouteType`, `getPreloadProps`) stays in TS.
- Generator output is deterministic (ordered collections) and all-or-nothing
  (validate everything, then emit).
- URL input kinds are `string` / `int` / `bool` and arrays of them. Parsing throws;
  nothing is coerced.
- `updateURI` exists only on the active route context (enforced by
  `packages/routes/tests/types.ts`).
- One context per route catalogue.
- Use Relay's runtime APIs. The structural types in `entrypoint.tsx` exist only
  because of Relay's circular types under TS7; keep casts inside them.
- Preloads release every retain and subscription, on dispose, on error and on cycles.

## Conventions

- `@tsquid/routes` is TS source in the repo and publishes `dist/` via
  `publishConfig.exports`. Relative imports use `.js` extensions.
- `vite` and `eslint-plugin` ship plain `.mjs` (+ `.d.ts`).
- `@tsquid/codegen` = `crates/tsquid-codegen-wasm` (pure `generate`, no I/O) + a JS
  CLI.
- Two TypeScript installs: `typescript` (TS6) provides the JS API; `@typescript/native`
  (TS7) provides `tsc`.
- Never hand-edit generated output. Never delete an `@ts-expect-error` to make
  typecheck pass.
- UI code follows `packages/eslint-plugin/docs/ui-standards.md`.
- A package's name matches its directory (`@tsquid/create`'s build relies on it). Check
  `files` with `pnpm pack`.

## Starter (`templates/app`)

- The reference app. It must pass `pnpm check`.
- It depends on `workspace:*`. `packages/create/scripts/build-template.mjs` (run
  on prepack) copies it into `@tsquid/create`, pins `^<version>`, adds
  `packageManager` and `pnpm-workspace.yaml` (the repo copy can't have one: it would
  split the workspace), and renames `.gitignore` to `gitignore`, which npm won't pack.
- The Astryx block at the end of its `AGENTS.md` is generated: refresh it with
  `pnpm exec astryx init --features agents --agent-docs-path AGENTS.md`.

## Releasing

Bump versions, merge, then run the Release workflow. `scripts/publish.mjs` packs
each public package and stages (`npm stage publish`) the versions not on npm, via
trusted publishing. A maintainer approves each one with `npm stage approve` (2FA).
The trusted publishers allow staging only, not `npm publish`.

## Git

Short, imperative, sentence-case commit titles. Merge PRs with merge commits.
