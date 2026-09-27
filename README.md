![tsquid logo](https://github.com/hsimah-services/tsquid/blob/main/tsquid.png)

# tsquid

tsquid is a UI framework built around **strongly typed route context**. It is
deliberately opinionated about how a web application is navigated:

- **Routes are declared, not typed out by hand.** A `routes.json` catalogue names
  every route, its path, and its typed URL fields. `tsquid-codegen` turns it into
  TypeScript: a URI builder/parser per route, a `RouteName` enum, and a context
  hook per entrypoint.
- **The URL is the state.** Route input is limited to values a URL can carry
  (`string`, `int`, `bool`, and arrays of each). Parsing is strict: malformed URLs
  throw rather than being coerced. Richer types (sets, enums, dates) are derived
  from that input in one place per route.
- **Only the active route can update the URL.** You navigate to another route with
  that route's `getURI(input)`. You change the current location with `updateURI(patch)`
  from the active route's context. URI helpers themselves have no update method.
- **Every route is a Relay entrypoint.** Data for a route and its nested
  entrypoints starts loading on navigation, not after rendering. Links start
  preloading on hover or focus. Relay's normalized store keeps everything consistent.
- **One UI vocabulary.** [Astryx](https://github.com/facebook/astryx) components
  and tokens, styled with [StyleX](https://stylexjs.com), give every application
  the same user experience.

## Status

Early. Extracted from [toroid](https://github.com/hsimah-services/toroid), which
is still its only production user. Packages are published to npm under `@tsquid`.

| Piece | Where | What it is |
| --- | --- | --- |
| `@tsquid/codegen` | `packages/codegen` | Route generator (`tsquid-codegen` CLI), Rust compiled to WebAssembly |
| `@tsquid/routes` | `packages/routes` | Route runtime: URIs, route context, Relay entrypoints, preloading links |
| `@tsquid/vite` | `packages/vite` | Vite preset: StyleX, React, Relay, with dedupe for singletons |
| `@tsquid/eslint-plugin` | `packages/eslint-plugin` | UI rules, architecture checker, and the [UI standards](packages/eslint-plugin/docs/ui-standards.md) |
| Starter app | `templates/app` | Astryx + StyleX + Relay + typed routes, ready to run |

Built on React 19, React Router 8, Relay 21, Astryx 0.6 and StyleX 0.19.

## Start an app

```sh
scripts/create-app.sh ../my-app
cd ../my-app
scripts/toolchain.sh pnpm install
scripts/dev.sh                     # http://localhost:5173
```

The new app comes with:
- a navigation shell and two routes: a static Home page, and a Profile page that
  preloads a Relay query;
- lint rules and an architecture check;
- its own container toolchain (Node and pnpm only).

It depends on the `@tsquid` packages at this checkout's versions. Its README covers
adding routes.

## At a glance

A catalogue entry:

```json
{
  "runtime": "@tsquid/routes",
  "routes": [{
    "name": "TutorialSearch",
    "entryPoint": "src/components/tutorial/Tutorial.entrypoint.ts",
    "path": "/tutorials/:level/:id",
    "fields": {
      "level": { "kind": "int" },
      "id": { "kind": "string" },
      "tags": { "kind": "string[]", "optional": true }
    }
  }]
}
```

The generated code in use:

```ts
// Anywhere: link to a route with explicit, typed input.
TutorialSearchURI.getURI({ level: 2, id: 'a/b', tags: ['core'] });
// → '/tutorials/2/a%2Fb?tags=core'

// Inside the Tutorial entrypoint: narrow by route, then update the current URL.
const route = useTutorialRouteContext();
if (route.currentRoute === RouteName.TutorialSearch) {
  navigate(route.updateURI({ tags: undefined }));
}
```

The full config format and runtime API (`defineRoute`, `RouteEntryPoint`,
`createLink`, preloading) are documented in
[packages/routes/README.md](packages/routes/README.md).

## Repository layout

```
crates/tsquid-codegen/   Rust generator: routes.json → one TypeScript file (library + CLI)
crates/tsquid-codegen-wasm/  the generator as a WebAssembly module for @tsquid/codegen
packages/codegen/        @tsquid/codegen: the WASM module, generate(), tsquid-codegen CLI
packages/routes/         @tsquid/routes runtime (TS source) + its tests and fixtures
packages/vite/           @tsquid/vite preset
packages/eslint-plugin/  @tsquid/eslint-plugin rules, architecture checker, UI standards
templates/app/           starter app; a workspace member, so CI builds it
scripts/create-app.sh    copies the starter into a new app
scripts/publish.mjs      publishes package versions not yet on npm (release workflow)
scripts/toolchain.sh     runs any command in the Rust + Node toolchain container
.docker/                 toolchain image
NOTES.yaml               terse per-folder notes; the most detailed map of the repo
```

## Development

The host needs only podman or docker. Rust, Node and pnpm run in a container:

```sh
scripts/toolchain.sh pnpm install
scripts/toolchain.sh cargo test --locked   # generator
scripts/toolchain.sh pnpm test             # every package's tests + the starter's full check
scripts/toolchain.sh pnpm routes:template  # regenerate the starter's typed routes
scripts/toolchain.sh bash                  # shell in the toolchain
```

CI (`.github/workflows/check.yml`) runs the same commands. It also checks that the
committed generator output for the test fixture and the starter is up to date.

## Releasing

1. Bump `version` in each changed `packages/*/package.json` and merge to `main`.
2. Run the **Release** workflow from the Actions tab. It tests, then publishes every
   package version that isn't on npm yet, using npm trusted publishing with
   provenance.

## License

Apache 2.0; see [LICENSE](LICENSE).
