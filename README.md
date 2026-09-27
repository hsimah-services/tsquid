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

Early. The first piece is routing, extracted from
[toroid](https://github.com/hsimah-services/toroid), which is still its only user.

| Piece | Where | State |
| --- | --- | --- |
| Route generator (`tsquid-codegen`) | `crates/tsquid-codegen` | Works; build from source |
| Route runtime (`@tsquid/routes`) | `packages/routes` | Works; not yet published |
| Astryx + StyleX UI conventions | toroid's client | Not yet part of tsquid |

Peer dependencies of the runtime: React 19, React Router 8, Relay 21.

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
crates/tsquid-codegen/   Rust generator: routes.json → one TypeScript file
packages/routes/         @tsquid/routes runtime (TS source) + its tests and fixtures
scripts/toolchain.sh     runs any command in the Rust + Node toolchain container
.docker/                 toolchain image
NOTES.yaml               terse per-folder notes; the most detailed map of the repo
```

## Development

The host needs only podman or docker. Rust, Node and pnpm run in a container:

```sh
scripts/toolchain.sh pnpm install
scripts/toolchain.sh cargo test --locked   # generator
scripts/toolchain.sh pnpm test             # runtime typecheck + tests
scripts/toolchain.sh bash                  # shell in the toolchain
```

CI (`.github/workflows/check.yml`) runs the same commands, and also checks that the
committed generator fixture is up to date.

## License

Apache 2.0; see [LICENSE](LICENSE).
