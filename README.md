![tsquid logo](https://github.com/hsimah-services/tsquid/blob/main/tsquid.png)

# tsquid

An opinionated React framework built on strongly typed route context.

- **Declared routes.** `routes.json` defines every route's path and typed URL
  fields. `tsquid-codegen` emits URI builders and parsers, a `RouteName` enum, and a
  context hook for each entrypoint.
- **URL as state.** Route input is `string` / `int` / `bool` (and arrays), parsed
  strictly. Richer types are derived per route.
- **Scoped updates.** Navigate with `<Route>URI.getURI(input)`. Only the active
  route context can `updateURI(patch)`.
- **Relay entrypoints.** Each route preloads its query graph on navigation, and
  links preload it on hover and focus.
- **Astryx + StyleX** for all UI.

Stack: React 19, React Router 8, Relay 21, Astryx 0.6, StyleX 0.19, Vite 8.

## Packages

| Package | |
| --- | --- |
| [`@tsquid/routes`](packages/routes) | Runtime: URIs, route context, entrypoints, preloading links |
| [`@tsquid/codegen`](packages/codegen) | `tsquid-codegen` CLI |
| [`@tsquid/vite`](packages/vite) | Vite preset |
| [`@tsquid/eslint-plugin`](packages/eslint-plugin) | UI rules, architecture checker, [UI standards](packages/eslint-plugin/docs/ui-standards.md) |
| [`@tsquid/create`](packages/create) | `pnpm create @tsquid` |

## New app

```sh
pnpm create @tsquid my-app
# no host Node: podman run --rm -v "$PWD:/w:z" -w /w docker.io/library/node:22-slim npx -y @tsquid/create my-app
cd my-app
scripts/toolchain.sh pnpm install
scripts/dev.sh                     # :5173
```

You get a navigation shell, a static route, a route that preloads a query, lint,
and a containerised toolchain.

## Example

```json
{ "name": "ArticleSearch", "entryPoint": "src/components/article/Article.entrypoint.ts",
  "path": "/articles/:section", "fields": { "section": { "kind": "string" }, "tags": { "kind": "string[]", "optional": true } } }
```

```ts
ArticleSearchURI.getURI({ section: 'news', tags: ['x'] });   // '/articles/news?tags=x'

const route = useArticleRouteContext();
if (route.currentRoute === RouteName.ArticleSearch) {
  navigate(route.updateURI({ tags: undefined }));
}
```

## Development

The host needs podman or docker; everything else runs in `scripts/toolchain.sh`.

```sh
scripts/toolchain.sh pnpm install
scripts/toolchain.sh cargo test --locked    # generator
scripts/toolchain.sh pnpm test              # packages + starter check
scripts/toolchain.sh pnpm routes            # regenerate fixture + starter routes
```

```
crates/tsquid-codegen/       generator (Rust)
crates/tsquid-codegen-wasm/  generator → WebAssembly for @tsquid/codegen
packages/                    published packages
templates/app/               starter; packed into @tsquid/create
NOTES.yaml                   repo map
```

## Releasing

1. Bump the versions in `packages/*/package.json` and merge to `main`.
2. Run the **Release** workflow. It stages each version not yet on npm, with provenance.
3. Approve it:
   `scripts/toolchain.sh bash`, then `npm login`, `npm stage list` and
   `npm stage approve <stage-id>` (2FA).

## License

Apache-2.0
