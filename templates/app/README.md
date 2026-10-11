# tsquid app

React Router 8 + Relay entrypoints + Astryx/StyleX, on [tsquid](https://github.com/hsimah-services/tsquid).

```sh
scripts/toolchain.sh pnpm install
scripts/dev.sh                          # :5173; /graphql → GRAPHQL_PROXY_TARGET (default: host :4000)
```

Run commands as `scripts/toolchain.sh pnpm <cmd>`:

| | |
| --- | --- |
| `check` | lint + architecture + relay + tsc + build + persisted-id check |
| `lint`, `lint:fix` | eslint + `tsquid-check-architecture` |
| `routes`, `routes:check` | generate / verify `src/routes/__generated__` (TS + server manifest) |
| `relay`, `relay:watch`, `relay:check` | tsquid-relay persist / persist --watch / check |
| `schema` | introspect `GRAPHQL_SCHEMA_ENDPOINT` → `schema.graphql` (placeholder until run) |

## Adding a route

1. Add it to `routes.json`, then run `pnpm routes`. For a server-inlined query,
   set `query` and run `pnpm relay` first.
2. Create `src/components/<entity>/<Entity>.entrypoint.ts` with `getPreloadProps`.
3. Call `defineRoute` in `src/routes/<entity>Routes.ts`, then register it in
   `src/app/router.tsx` and in the `createLink` list in `src/app/AppLink.tsx`.
4. Link to it with `<Route>URI.getURI(input)`.

## Initial data

A route's `query` (variables from same-named URL fields only) is listed, with its
text, in `src/routes/__generated__/routes.manifest.json`. Servers inline its
response as `#tsquid-data`. Other queries load on the client. Set `"ssr": false`
to opt a route out. Server spec:
[`tsquid-server-integration`](https://github.com/hsimah-services/tsquid/tree/main/skills/tsquid-server-integration).

Standards: `node_modules/@tsquid/eslint-plugin/docs/ui-standards.md`.
