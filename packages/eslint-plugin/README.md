# @tsquid/eslint-plugin

UI rules and an entity architecture checker for
[tsquid](https://github.com/hsimah-services/tsquid) apps. The standards they enforce
are in [docs/ui-standards.md](docs/ui-standards.md), which ships with the package.

```js
// eslint.config.mjs
import tsquid from '@tsquid/eslint-plugin';

export default [...tsquid.configs.recommended];
```

```json
"lint": "eslint src --max-warnings 0 && tsquid-check-architecture"
```

| Rule | Checks |
| --- | --- |
| `tsquid/module-order` | imports → constants → exports → local helpers → StyleX styles |
| `tsquid/constant-names` | module constants in `SHOUTING_SNAKE_CASE` |
| `tsquid/module-exports` | named exports match the filename |
| `tsquid/local-component-names` | local components are prefixed with their owner (`Owner_Part`) |
| `tsquid/render-only-components` | effects, requests and transformations live in hooks/helpers |

`tsquid-check-architecture` checks the import graph under `src/components`:
entity directories, `__private__` and feature-folder boundaries, and whether
internal modules have real consumers.

`recommended` also enables React's `rules-of-hooks` and `exhaustive-deps`, and
exempts `src/main.tsx`, the imperative bootstrap, from the ordering and naming rules.
