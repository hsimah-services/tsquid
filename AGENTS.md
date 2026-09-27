# AGENTS.md

Guidance for AI coding agents working in this repository.

## Orient first

- Read [NOTES.yaml](NOTES.yaml) before changing anything. It maps each folder and
  lists commands, conventions, known quirks and open todos.
- **Keep NOTES.yaml current.** When a change adds, moves or repurposes a folder,
  file, command or convention, update NOTES.yaml in the same change. Keep it terse
  and semi-structured; it is proto-documentation, not prose. It must parse as YAML.
- [README.md](README.md) states tsquid's opinions;
  [packages/routes/README.md](packages/routes/README.md) documents the route
  config and runtime API. Update them when behaviour changes.

## Toolchain

There is no host Rust, Node or pnpm. Run everything through the container:

```sh
scripts/toolchain.sh cargo test --locked
scripts/toolchain.sh pnpm install --frozen-lockfile
scripts/toolchain.sh pnpm test
```

Add new tools to `.docker/Dockerfile`, not to the host. Before finishing a change,
run both test commands. `pnpm test` includes the starter app's full `check`. If
generator output changed, also run the `--check` steps in `.github/workflows/check.yml`.

## Framework invariants

These are tsquid's opinions. Don't weaken them to make something easier; raise
the trade-off instead.

- **The generator reads JSON only.** It never parses, imports or regex-scans
  application TypeScript. Anything the generator needs must be serializable in
  `routes.json`; behaviour (`getRouteType`, `getPreloadProps`) stays in TS.
- **Generator output is deterministic and all-or-nothing.** Validate the whole
  config before emitting. Use ordered collections (`BTreeMap`/`BTreeSet`).
  Generated output is committed by consumers, so any output change is a visible diff.
- **URL input is URL-shaped.** Field kinds are `string`, `int`, `bool` and their
  arrays. Parsing and building throw on invalid input; never silently coerce,
  truncate or drop values. Richer types belong in `getRouteType`.
- **Only the active route context has `updateURI`.** URI helpers and route
  definitions must not expose it; `tests/types.ts` enforces this with
  `@ts-expect-error`.
- **One shared context per route catalogue**, so the nearest route provider always
  wins and a nested route can't expose a stale ancestor's state.
- **Relay does the loading.** Use Relay's native runtime APIs (`useEntryPointLoader`,
  `EntryPointContainer`, `fetchQuery`, `retain`). The structural entrypoint types in
  `runtime/entrypoint.tsx` exist only because Relay 21's circular declarations fail
  under TS7. Keep casts confined to those adapters.
- **Preloads clean up.** Every retain and subscription acquired while preloading
  must be released on dispose, on error and on cycles; tests count them.

## Code conventions

- The runtime ships as TypeScript source through `package.json` `exports`; there
  is no build step. React, React Router and Relay are peer dependencies.
- Two TypeScript installs: `typescript` is TS6, used for its JS API (`transpileModule`
  in `tests/run.mjs`); `@typescript/native` is TS7 and provides `tsc`.
- Never hand-edit generated output. After changing the generator, regenerate the
  fixture
  (`cargo run -p tsquid-codegen -- packages/routes/tests/routes.json packages/routes/tests/routes.generated.ts`)
  and the starter's routes (`pnpm routes:template`).
- Non-routes packages (`vite`, `eslint-plugin`) ship plain `.mjs`. Vite and ESLint
  load them from `node_modules` without a TypeScript step. Add a `.d.ts` when
  consumers need types.
- Type-level behaviour is tested in `packages/routes/tests/types.ts`. Don't delete
  an `@ts-expect-error` to make typecheck pass; it is asserting that something
  must stay a type error.
- Match the surrounding style: terse modules, few comments, and comments that
  explain *why* a constraint exists.

## UI conventions

tsquid apps use Astryx components and tokens, styled with StyleX. The standards
are in [packages/eslint-plugin/docs/ui-standards.md](packages/eslint-plugin/docs/ui-standards.md),
and `@tsquid/eslint-plugin` enforces the mechanical parts. In brief:

- Astryx components do layout; use tokens (`var(--color-*)`, `var(--spacing-*)`)
  rather than raw values.
- StyleX via `stylex.create()` at the bottom of the module, applied with
  `stylex.props()` on DOM elements or Astryx's `xstyle` prop. No inline style
  objects and no parallel CSS frameworks.
- Components render prepared state. Effects, transformations and complex
  handlers belong in hooks or helpers.
- Entrypoint modules are named `<Name>.entrypoint.ts`; the generator derives
  `use<Name>RouteContext` from that filename.

## Starter app

- `templates/app` is what `scripts/create-app.sh` copies. It must pass its own
  `pnpm check` and follow the UI standards; treat it as the reference app.
- It depends on tsquid packages as `workspace:*`. `create-app.sh` rewrites each
  `@tsquid/<name>` to `^<version>` from `packages/<name>/package.json`, so a
  package's name must match its directory.
- It can't hold a `pnpm-workspace.yaml`: pnpm would treat it as a separate
  workspace root. `create-app.sh` writes one into the new app.
- Its `AGENTS.md` ends with a block generated by `astryx init --features agents`.
  Refresh it with that command rather than editing it by hand.

## Publishing

- Every package under `packages/` without `"private": true` is published to npm.
  `scripts/publish.mjs` packs each with `pnpm pack` (running `prepack`, applying
  `publishConfig`), and publishes versions that aren't on npm yet. The Release
  workflow runs it with trusted publishing; there is no npm token.
- `@tsquid/routes` is developed as TS source, but published as compiled `dist/`
  through `publishConfig.exports`. Keep relative imports with `.js` extensions so
  the emitted ESM runs in Node.
- `@tsquid/codegen` wraps `crates/tsquid-codegen-wasm`, a pure `generate` export
  with no I/O. JS does the file work. Its tests check that the WASM output matches
  the native fixture.
- Check a package's `files` list with `pnpm pack` before adding files to it.

## Git

- Commit titles are short, imperative and sentence case ("Accept trailing slashes
  in entrypoint routes").
- This repo's early history was imported from toroid. Merge PRs with merge commits
  rather than squashing when history should be preserved.
