# @tsquid/codegen

Generates typed routes for [`@tsquid/routes`](https://www.npmjs.com/package/@tsquid/routes)
from `routes.json`. Ships as WebAssembly. Node ≥ 22.

```sh
tsquid-codegen routes.json src/routes/__generated__/routes.ts
tsquid-codegen routes.json src/routes/__generated__/routes.ts --check   # exit 1 if stale
```

Writes `routes.ts` and `routes.manifest.json` (every route's path, fields, `ssr`
flag and resolved `query`, for servers), both or neither. Reads the Relay
persisted-queries file named by `persistedQueries`, relative to the config.
For each route query, emits `<Route>RouteQuery` with `operation` and
`getVariables(input)` (declared variables, GraphQL defaults, otherwise null).
Each entrypoint also gets an `<Entry>EntryPointParams` union of `{ currentRoute, input }`.
String fields bound to enum variables need client narrowing before Relay use;
the helper preserves narrowed input types.

```js
import { generate, manifest } from '@tsquid/codegen';

generate(configJson, persistedQueriesJson); // → TypeScript source; throws on an invalid config
manifest(configJson, persistedQueriesJson); // → server manifest JSON; throws on an invalid config
```

`persistedQueriesJson` is the file's content, or `null` when the config names none.

```sh
tsquid-relay persist [relay.config.json] [--watch] # reset persistConfig.file, relay-compiler --repersist
tsquid-relay check [relay.config.json]           # missing/stale operation ids
```

`check` reads only JSON config and `.graphql.ts` / `.graphql.js` artifacts under
`artifactDirectory` or `src`, honoring source exclusions while including generated
directories. It never reads application TS. `persist` requires `relay-compiler`
on PATH and restores the previous persisted file if a one-shot compilation fails.
Route `--check` remains independent; run both checks in CI.

```sh
tsquid-schema fetch [--endpoint URL] [--out schema.graphql]
tsquid-schema check [--endpoint URL] [schema.graphql]
```

Introspects the endpoint and writes sorted SDL, or compares normalized remote and
local schemas with a short drift summary. Endpoint defaults to
`GRAPHQL_SCHEMA_ENDPOINT`, then `BASE_URL` + `/graphql`, then
`http://localhost:4000/graphql`. Introspection failures exit non-zero.

Output is deterministic; commit it. The config and manifest formats are in the
[`@tsquid/routes` README](https://www.npmjs.com/package/@tsquid/routes).
