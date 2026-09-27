# AGENTS.md

Guidance for AI coding agents working in this app.

## tsquid

This app is built with [tsquid](https://github.com/hsimah-services/tsquid): typed
routes, Relay entrypoints, and Astryx components styled with StyleX.

**Read the UI standards first:**
`node_modules/@tsquid/eslint-plugin/docs/ui-standards.md`. They are mandatory for
handwritten code in `src/`, and take precedence over conflicting generated advice
below. In particular, this app DOES compile StyleX: use `stylex.create`,
`stylex.props`, and Astryx's `xstyle`. The Astryx block's claim that there is no
StyleX compiler does not apply here.

### Routes

- Routes are declared in `routes.json`. After changing it, run `pnpm routes`.
  Never edit `src/routes/__generated__/`.
- Each route belongs to an entrypoint module,
  `src/components/<entity>/<Entity>.entrypoint.ts`. Its `getPreloadProps` names the
  queries to load, and the generator derives `use<Entity>RouteContext()` from the
  filename.
- A new route also needs:
  - a `defineRoute` call in `src/routes/<entity>Routes.ts`;
  - an entry in `src/app/router.tsx`;
  - an entry in the `createLink` list in `src/app/AppLink.tsx`, so links to it preload.
- Link to a route with `<Route>URI.getURI(input)`; never hand-write URL strings.
  Change the current URL with `updateURI(patch)` from the active route context.
- Route input holds only URL values (`string`, `int`, `bool`, arrays). Derive
  richer types in the route's `getRouteType`.

### Data

- Pages read preloaded queries with `usePreloadedQuery`, inside the page's local
  hook. Don't fetch in effects.
- Relay mutations live in their own `use<Operation>Mutation.ts` files.
- After changing any `graphql` tag, run `pnpm relay`. After the API changes, run
  `pnpm schema` and then `pnpm relay`.

### Commands

There is no host Node. Run everything through `scripts/toolchain.sh`:

```sh
scripts/toolchain.sh pnpm check      # lint + architecture + Relay + typecheck + build
scripts/toolchain.sh pnpm lint:fix   # safe automatic fixes
scripts/toolchain.sh pnpm routes     # regenerate typed routes
```

Run `pnpm check` before finishing. Don't disable lint rules or add broad ignores
to make checks pass.

<!-- ASTRYX:START -->
Astryx v0.6.0 · 163 components
CLI: run every command as `pnpm exec astryx <cmd>` (shown below as `astryx ...`).

SETUP (once, in your app entry e.g. main.tsx) — without these, components render unstyled:
  import "@astryxdesign/core/reset.css";
  import "@astryxdesign/core/astryx.css";

WORKFLOW — discover, don't guess. Before writing UI:
1. `astryx build "<idea>"` — START HERE: returns a kit (closest [page] + [block]s + [component]s). No args = full playbook.
2. `astryx template <name> [--skeleton]` — scaffold the [page]/[block]s it named, or study their layout. Templates are reference code.
3. `astryx component <Name>` — props + examples for every component you use.

RULES:
- No <div> — components do all layout/spacing, page frame included.
- Frame first: read `astryx docs layout` before writing any page or screen — page frame, region widths, breakpoint behavior.
- Dense data = rows (Table, List/Item), never Card-wrapped list items; Card is for standalone widgets. Status = StatusDot/Token; Badge = counts only.
- Custom styling: component props first; else style/className with tokens — var(--color-*|--spacing-*|--radius-*). No raw hex/px. (No StyleX/Tailwind compiler here — don't use xstyle/utility classes.)
- Tokens for every value (`astryx docs tokens`). Brand/accent belongs in the theme (`astryx theme list` / `theme add <slug>`, or `astryx theme template` for a custom one) — never override --color-* in :root.
- SELF-CHECK before you finish: re-read the file and replace any raw <div>/<span> layout, imported .css/@apply, or hardcoded value (#hex, 16px) with the component or a token (var(--color-*|--spacing-*|…)). If unsure a component/prop exists, run `astryx component <Name>` / `astryx search "<thing>"`; don't hand-roll CSS.

MORE CLI:
  search "<query>"   find any component / hook / doc / template / block
  component --list   163 components by category
  template --list    page + block recipes
  docs <topic>       browser-support, cli-integrations, color, elevation, getting-started, icons, illustrations, internationalization, layout, migration, motion, principles, shadcn-compatibility, shape, spacing, styling-libraries, styling, theme, tokens, typography, working-with-ai
  swizzle <Name>     eject component source for deep customization
  upgrade --apply    run after any Astryx or integration dependency bump
<!-- ASTRYX:END -->
