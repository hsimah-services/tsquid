# tsquid app

A [tsquid](https://github.com/hsimah-services/tsquid) app: typed routes with
React Router 8, data loading with Relay entrypoints, and Astryx components styled
with StyleX.

## Running it

The host needs only podman or docker. Node and pnpm run in a
container, which is built on first use:

```sh
scripts/toolchain.sh pnpm install
scripts/dev.sh                      # http://localhost:5173, hot reload
```

GraphQL requests to `/graphql` are proxied to `GRAPHQL_PROXY_TARGET`, which
defaults to port 4000 on the host. The Home page works without an API. The
Profile page queries `viewer` and needs one.

## Commands

Run each one as `scripts/toolchain.sh pnpm <command>`:

| Command | What it does |
| --- | --- |
| `check` | lint, architecture check, Relay compile, typecheck, production build |
| `lint` / `lint:fix` | ESLint with tsquid's UI rules, plus the architecture check |
| `routes` / `routes:check` | regenerate typed routes from `routes.json` / verify they are current |
| `relay` | compile `graphql` tags against `schema.graphql` |
| `schema` | introspect `GRAPHQL_SCHEMA_ENDPOINT` into `schema.graphql` |

`schema.graphql` starts as a placeholder. Replace it with your API's schema
(`pnpm schema`), then run `pnpm relay`.

## Adding a route

1. Add the route to `routes.json`: its name, path, typed fields, and entrypoint
   module. Then run `pnpm routes`.
2. Create `src/components/<entity>/<Entity>.entrypoint.ts`. Its `getPreloadProps`
   returns the queries the route needs, as in `Profile.entrypoint.ts`.
3. Wire the route up with `defineRoute` in `src/routes/<entity>Routes.ts`. Add it
   to `src/app/router.tsx`, and to the `createLink` list in `src/app/AppLink.tsx`
   so links to it preload on hover.
4. Link to it with `<Route>URI.getURI(input)`.

The UI standards that `pnpm lint` enforces are in
`node_modules/@tsquid/eslint-plugin/docs/ui-standards.md`.

## Layout

```
routes.json            route catalogue; input to tsquid-codegen
schema.graphql         GraphQL schema for relay-compiler
src/
  main.tsx             entry: Astryx CSS, renders <App>
  app/                 providers (Relay, Astryx theme, preloading links), router
  relay/environment.ts Relay environment and network
  routes/              defineRoute per entity; __generated__/routes.ts from codegen
  components/<entity>/ public components, <Entity>.entrypoint.ts, __generated__ Relay artifacts
scripts/toolchain.sh   run any command in the toolchain container
scripts/dev.sh         dev server with the port published
```
