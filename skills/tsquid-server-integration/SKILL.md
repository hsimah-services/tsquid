---
name: tsquid-server-integration
description: Build or change a server, in any language, that serves a tsquid app's HTML and inlines the initial route's GraphQL response as #tsquid-data. Covers matching URLs against routes.manifest.json, building the route query's variables, executing it, and the payload format. Use for any work on that server-side integration or on debugging #tsquid-data warnings.
---

# tsquid server integration

tsquid apps render on the client. A server that serves the app's HTML can run the
initial route's query itself and inline the response. The route then renders
without waiting on that request.

Everything the server needs is in the generated manifest: URL patterns, and per
route at most one query whose variables come only from the URL. Anything else the
page loads is fetched by the client and suspends where it's read.

It is best-effort. No payload falls back to a client fetch. **A malformed payload
stops the app from booting.**

Sections marked *normative* must match the client exactly. `vectors.json`, next to
this file, holds conformance cases. The tsquid repo tests them against the client:
run them in your server's tests too.

## Inputs from the app repo

| Input | Where | Gives |
| --- | --- | --- |
| Manifest | `<routes output>.manifest.json`; starter: `src/routes/__generated__/routes.manifest.json` | URL → route + input → query + variables |
| HTML shell | the built `index.html` | where the payload goes |

The manifest is generated and committed. Read it at build or deploy time; don't
copy from it by hand. It changes whenever routes or route queries change.

## Per request

1. Match the URL (path + query; the fragment never reaches the server). No match,
   `ssr: false`, or no `query`: serve the HTML unchanged.
2. Build the query's variables from the input.
3. Execute the query as the requesting user.
4. Inline the payload and serve. Send `Cache-Control: private` (or `no-store`)
   whenever a payload is inlined.

## 1. Manifest

```json
{
  "version": 1,
  "routes": [
    { "name": "Article", "path": "/articles/:id", "ssr": true,
      "fields": {
        "id": { "kind": "string", "optional": false, "in": "path" },
        "page": { "kind": "int", "optional": true, "in": "query" } },
      "query": {
        "operation": "ArticleQuery", "id": "0e84be14…", "text": "query ArticleQuery($id: ID!, $page: Int = 1, $first: Int = 20, $after: String) { … }",
        "variables": {
          "after": {}, "first": { "default": 20 },
          "id": { "input": "id" }, "page": { "input": "page", "default": 1 } } } }
  ]
}
```

- Reject any `version` other than `1`.
- Every route is listed. `ssr: false` routes take part in matching (they can
  outrank an SSR route) but get no payload.
- `kind`: `string`, `int`, `bool`, or one of those plus `[]` (array). Path fields
  are required scalars.
- `query` is optional. The generator guarantees it can run from the URL alone: a
  `query` operation, no `@defer`/`@stream`, no provided variables, every required
  variable bound to a required field or defaulted, and kinds compatible
  (`int` → `Int`, `bool` → `Boolean`, `string` → other scalars and enums, `[]` →
  lists).
- `variables` lists every declared variable: `input` names the field that binds
  it, `default` is the GraphQL default as JSON (enums as strings).

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

## 3. Variables (normative)

For each entry in `query.variables`, in any order:

1. `input` is set and the parsed input has that field: use its value.
2. Otherwise, `default` is set: use it.
3. Otherwise: omit the variable.

Example: `/articles/7` → `{ "id": "7", "page": 1, "first": 20 }`.

This is what Relay sends for the same URL. Matching against it ignores top-level
`null`s and object key order. Array order and types matter: `1` ≠ `"1"`.

## 4. Executing

- Send `query.text` verbatim. Relay adds `id` and `__typename` and inlines
  fragments, so a hand-written equivalent won't normalise. If the endpoint uses
  persisted queries, send `query.id` instead, as the client does.
- Execute as the browser would: same viewer, cookies and auth headers. Data for
  another viewer shows the wrong user's data until a refetch.
- Inline the body as returned (`data`, `errors`, `extensions`). On a transport
  failure or timeout, inline nothing. Don't block the HTML on a slow query.
- `int` input is a safe integer (53-bit); GraphQL `Int` is 32-bit. Out-of-range
  values come back as GraphQL `errors`, the same as on the client.

## 5. Other operations

Only the route query is guaranteed to match. Other queries the page makes, from
nested entrypoints, components or client logic, are fetched by the client. A
server may still inline more if it knows the exact operation and variables Relay
will send (Relay's `params.text`, declared variables with defaults filled in). The
manifest doesn't describe them, and drift only shows as [warnings](#debugging).

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
  object }] }`. No duplicate `operation` + variables (by the rules in §3).
- Escape every `<` as `\u003c`. Don't HTML-entity-encode: the client reads the
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
