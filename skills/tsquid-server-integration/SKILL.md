---
name: tsquid-server-integration
description: Build or change a server, in any language, that serves a tsquid app's HTML and inlines the initial route's GraphQL responses as #tsquid-data. Covers matching URLs against routes.manifest.json, mapping routes to Relay operations and variables, executing them, and the payload format. Use for any work on that server-side integration or on debugging #tsquid-data warnings.
---

# tsquid server integration

tsquid apps render on the client. A server that serves the app's HTML can run the
initial route's GraphQL operations itself and inline the responses. The first
route then renders with no request and no loading state.

It is best-effort. No payload, or a partial one, falls back to client fetches.
**A malformed payload stops the app from booting.**

Sections marked *normative* must match the client exactly. `vectors.json`, next to
this file, holds conformance cases. The tsquid repo tests them against the client:
run them in your server's tests too.

## Inputs from the app repo

| Input | Where | Gives |
| --- | --- | --- |
| Manifest | `<routes output>.manifest.json`; starter: `src/routes/__generated__/routes.manifest.json` | URL → route + input |
| Route definitions | `defineRoute(...)` calls; starter: `src/routes/*Routes.ts` | `getRouteType`, entrypoint |
| Entrypoints | `*.entrypoint.ts` → `getPreloadProps` | operations + variables per route |
| Relay artifacts | `__generated__/<Operation>.graphql.ts` | `params.name`, `params.text`, `operation.argumentDefinitions` |
| HTML shell | the built `index.html` | where the payload goes |

The manifest and the artifacts are generated and committed. Read them at build or
deploy time. Don't copy them by hand.

## Per request

1. Match the URL (path + query; the fragment never reaches the server). No match,
   or `ssr: false`: serve the HTML unchanged.
2. Map route + input → operations and variables.
3. Execute them as the requesting user.
4. Inline the payload and serve. Send `Cache-Control: private` (or `no-store`)
   whenever a payload is inlined.

## 1. Manifest

```json
{
  "version": 1,
  "routes": [
    { "name": "Article", "path": "/articles/:id", "ssr": true, "fields": {
      "id": { "kind": "string", "optional": false, "in": "path" },
      "page": { "kind": "int", "optional": true, "in": "query" } } }
  ]
}
```

- Reject any `version` other than `1`.
- Every route is listed. `ssr: false` routes take part in matching (they can
  outrank an SSR route) but get no payload.
- `kind`: `string`, `int`, `bool`, or one of those plus `[]` (array). Path fields
  are required scalars.

## 2. Matching (normative)

Pick the route, as React Router does:

1. Strip trailing `/` from the path (`/` stays `/`). Split on `/`.
2. Candidates: routes with the same segment count, whose static segments equal the
   percent-decoded URL segments **case-insensitively**, and whose `:param`
   segments are non-empty.
3. Most static segments wins: `/articles/new` beats `/articles/:id`. On a tie,
   don't inline.

Parse the input, as tsquid does. Any failure means **no route**: don't fall back
to another candidate, because the client renders an error for that URL.

- Static segments must equal the raw (still percent-encoded) URL segments
  exactly: `/Articles` and `/articl%65s` select `/articles`, then fail.
- Path field: `decodeURIComponent` of the raw segment. Invalid percent-encoding
  fails. `+` stays `+`.
- Query: `application/x-www-form-urlencoded` (`+` is a space). Keys the route
  doesn't declare are ignored.
- Scalar field: exactly one value. Absent and required fails. Absent and optional
  is omitted from input. Repeated fails.
- Array field: every value of the repeated key, in order, duplicates kept. Absent
  and required fails. Absent and optional is omitted.
- `string`: as is, including `""`.
- `int`: matches `^-?[0-9]+$` and |n| ≤ 2⁵³−1. Anything else fails (`2.5`, `""`, `1e3`).
- `bool`: exactly `true` or `false`. Anything else fails (`1`, `TRUE`).

## 3. Route → operations

This mapping mirrors the app's TypeScript and is owned by the server. Derive it
per route:

1. `defineRoute({ uri, getRouteType, entryPoint })`: `route = getRouteType(input)`.
2. `entryPoint.getPreloadProps(route)` returns:
   - `queries.<key> = { parameters: <OperationNode>, variables }`: one operation.
     Its name is `params.name` in the imported artifact (`ProfileQuery` from
     `./__generated__/ProfileQuery.graphql`).
   - `entryPoints.<key> = { entryPoint, entryPointParams }`: recurse with
     `entryPointParams` as the route.
3. Mirror any condition that includes or omits a key.

Example (starter): `/me` → Profile → `getPreloadProps: () => ({ queries: { profile:
{ parameters: PROFILE_QUERY_NODE, variables: {} } } })` → `[ProfileQuery, {}]`.

Keep the mapping as one table in the server, keyed by route `name`. Drift from the
app shows up as client console warnings in dev (see [Debugging](#debugging)).
Operations the server leaves out are fetched by the client.

## 4. Variables (normative)

For each variable declared in the artifact's `operation.argumentDefinitions`,
Relay sends:

- the value from `getPreloadProps`, if it isn't `null`/`undefined`;
- otherwise `defaultValue`, which is `null` when there is no default.

Undeclared variables are dropped. Send the same set:

- Include defaults: `{ first: 10 }`, not `{}`.
- Top-level `null`s may be omitted. Nested `null`s may not.
- Object key order doesn't matter. Array order does. Types do: `1` ≠ `"1"`.
- Provided variables (`__relay_internal__pv__*`) are declared like any other.
  Include their value, if the server knows it, or leave the operation out.

## 5. Executing

- Send `params.text` verbatim. Relay adds `id` and `__typename` and inlines
  fragments, so a hand-written equivalent won't normalise. If the app uses
  persisted queries, send `params.id` the same way the client does.
- Execute as the browser would: same viewer, cookies and auth headers. Data for
  another viewer shows the wrong user's data until a refetch.
- Inline the body as returned (`data`, `errors`, `extensions`). On a transport
  failure or timeout, leave the operation out. Don't block the HTML on a slow
  operation.
- Leave out operations that use `@defer` or `@stream`.

## 6. Payload (normative)

```html
<script type="application/json" id="tsquid-data">
{"version":1,"responses":[{"operation":"ProfileQuery","variables":{},"response":{"data":{"viewer":{"id":"1","name":"Ada"}}}}]}
</script>
```

- One element with `id="tsquid-data"` (unless the app passes another id to
  `readInitialData`), anywhere before the app's `<script type="module">` runs.
  The end of `<head>` works.
- `{ version: 1, responses: [{ operation: string, variables: object, response:
  object }] }`. No duplicate `operation` + variables (by the rules in §4).
- Escape every `<` as `<`. Don't HTML-entity-encode: the client reads the
  raw `textContent`.
- No match, nothing to inline: omit the element. `responses: []` is also valid.

## Client behaviour

- Each entry answers one request, synchronously.
- Entries expire after the first GraphQL request's task. Later navigations
  always fetch.
- A malformed payload (bad JSON, wrong shape, duplicates) throws at startup.

## Debugging

With `warn` on (the starter turns it on in dev), the browser console shows:

- `tsquid-data: no response for <Operation> <variables>`: the client needed this
  during boot and the payload didn't have it.
- `tsquid-data: unused response for <Operation> <variables>`: the payload had this
  and nothing asked for it.

`<variables>` is the comparison key: top-level nulls dropped, object keys sorted.
Compare the two lines to see the mismatch.
