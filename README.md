# tsquid routes (temporary home)

This folder is a portable Rust generator plus a React/React Router/Relay runtime.
It has no Toroid imports. Move the entire folder into the future `tsquid` repo,
publish `@tsquid/routes`, and replace the client's `link:./tsquid` dependency.
The app's `routes.json`, generated artifacts, and component/entrypoint definitions
belong to Toroid and should stay here.

## Generate

From `client/`, with Rust installed:

```sh
pnpm routes
pnpm routes:check
cargo test --manifest-path tsquid/Cargo.toml
pnpm test:routes
```

Or invoke the generator directly; paths are relative to the working directory:

```sh
cargo run --manifest-path tsquid/Cargo.toml -- routes.json src/routes/__generated__/routes.ts
```

`--check` fails when committed output differs. The generator validates the whole
schema before writing one deterministic output file. No Node, React, GraphQL, or
Toroid dependency is required to run the Rust binary. Generated output is committed
so normal frontend builds don't need a Rust toolchain.

## Configuration boundary

The serializable URI portion is JSON, because Rust should not execute application
TypeScript. The corresponding TypeScript entrypoint owns `getRouteType` and Relay's
`getPreloadProps`. Together these form the route configuration. No TS parser or
regex-based extraction of application source is involved.

```json
{
  "runtime": "@tsquid/routes",
  "routes": [{
    "name": "TutorialSearch",
    "path": "/tutorials/:level/:id",
    "fields": {
      "level": { "kind": "int" },
      "id": { "kind": "string" },
      "filter": { "kind": "string", "optional": true },
      "tags": { "kind": "string[]", "optional": true },
      "unlocked": { "kind": "bool", "optional": true }
    }
  }]
}
```

Supported kinds: `string`, `int` (safe integer), `bool`, and arrays of each.
Path fields must be required scalars. Every other field becomes a query parameter.
Arrays use repeated keys, preserving order and duplicates. Empty optional arrays
normalize to absence; required arrays must be nonempty. Booleans encode as
`true`/`false`. Invalid integers, booleans, duplicate scalar query keys, missing
required values, and invalid path encoding throw rather than silently coercing.
Optional path segments are modeled as separate routes.

Generated exports include `TutorialSearchInputType`, `TutorialSearchURI` and
`TutorialSearchRouteContext`. URI methods:

```ts
TutorialSearchURI.getURI({ level: 2, id: 'a/b', tags: ['core', 'balance'] });
TutorialSearchURI.parseURI('/tutorials/2/a%2Fb?unlocked=false');
TutorialSearchURI.updateURI(currentURI, { filter: 'turn', tags: undefined });
```

`getURI` starts fresh. `updateURI(currentURIOrInput, patch)` merges a partial input;
explicit `undefined` removes optional values. When given a URI it preserves
unowned query parameters and the hash. Neither method navigates. The generated
context's `useRoute()` exposes `input` and `updateURI(patch)` bound to the current
URI. Pass the returned string to your router's `navigate` or a Link.

## Relay configuration

`RouteEntryPoint<RouteType, Queries, NestedEntryPoints, RuntimeProps, ExtraProps>`
is a typed wrapper for Relay's native `root` and `getPreloadProps` contract.
`root` is a Relay JS resource; `resource(id, Component)` adapts an eager component.
Lazy resources can implement `getModuleId`, `getModuleIfRequired`, and `load`.

`getPreloadProps(route)` returns `queries`, `entryPoints`, and optional `extraProps`.
Query entries contain compiled `parameters`, typed `variables`, and optional Relay
options. Nested entries contain `entryPoint` and its typed `entryPointParams`.
Mark query/nested keys optional in their type and omit them when not needed.
`EntryPointProps` types the component's preloaded query refs, nested refs, runtime
props, and extra props. Render nested references with `RouteEntryPointContainer`.

```ts
const SearchRoute = defineRoute({
  uri: TutorialSearchURI,
  context: TutorialSearchRouteContext,
  getRouteType: input => ({
    ...input,
    filter: input.filter?.trim() ?? '',
    tags: new Set(input.tags ?? []),
  }),
  entryPoint: SEARCH_ENTRY_POINT,
});
```

`RouteType` can contain enums, sets, dates, or arbitrary application types; only
`InputType` is restricted to URI values. Mount `SearchRoute.Root` as the router
component beneath `RelayEnvironmentProvider`; pass a `fallback` for loading UI.
It provides the generated input context and a typed `SearchRoute.useRouteType()`
context at the route root. It uses Relay's `useEntryPointLoader` for disposal on
replacement/unmount; query errors reach the router's error boundary. Loading
starts in the route effect on direct navigation; hover can begin it earlier.
Top-level route components receive empty runtime props. Nested entrypoints may
receive application runtime props.

The structural Relay types are isolated here because Relay 21's circular
`EntryPoint` declarations fail with the client's TypeScript 7 compiler. Runtime
loading and rendering still use Relay's native APIs.

## Links and preloading

`createLink([SearchRoute, ...])` returns a React Router Link wrapper. It forwards
Link props, composes hover/focus handlers, respects `preventDefault`, and skips
external links, downloads, `reloadDocument`, and non-self targets. Route matching
uses the supplied list in order: put static paths before conflicting dynamic ones.

Hover walks the selected entrypoint graph and calls Relay `fetchQuery` on each
compiled query. It subscribes (including incremental payloads), retains data,
reuses store data, and lets Relay deduplicate in-flight requests. Retains and
subscriptions are released on link destination/environment change, unmount, or
a 30-second timeout. Speculative errors don't break navigation, which can retry.
Cycles throw and release acquired resources. Hover currently requires concrete
query artifacts and a single Relay environment; preloadable IDs and custom
environment-provider options are rejected. This follows Relay's documented
[fetchQuery retention contract](https://relay.dev/docs/api-reference/fetch-query/).

## Toroid example and limits

`src/components/tutorial/TutorialEntryPoint.tsx` selects the tutorial list query
and a nested detail entrypoint when an ID exists. Both `/tutorials?id=…` and the
existing `/tutorials/:id` route work. Tiles use the nested query reference for the
existing lightbox/modal. Selections outside the currently loaded/filtered grid
render a fallback modal. The Astryx LinkProvider uses the hover-aware AppLink.

The schema currently exposes only pagination on `toroidTutorials`, so the example
`filter` is explicitly a **loaded tutorials** filter. It is not server search or
sorting. Add server arguments and corresponding query variables before offering
full-dataset search/sort controls. The generator/runtime already support that
mapping in `getPreloadProps`.

Runtime tests cover URI round trips, malformed input, merging/removal, conditional
nested fetches, duplicate request deduplication, disposal, and cycle cleanup.
