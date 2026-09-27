# @tsquid/eslint-plugin

UI rules and an architecture checker for tsquid apps. Standards:
[docs/ui-standards.md](docs/ui-standards.md).

```js
// eslint.config.mjs
import tsquid from '@tsquid/eslint-plugin';

export default [...tsquid.configs.recommended];
```

```json
"lint": "eslint src --max-warnings 0 && tsquid-check-architecture"
```

| Rule | Enforces |
| --- | --- |
| `tsquid/module-order` | imports → constants → exports → locals → StyleX |
| `tsquid/constant-names` | module constants in `SHOUTING_SNAKE_CASE` |
| `tsquid/module-exports` | named exports match the filename |
| `tsquid/local-component-names` | local components named `Owner_Part` |
| `tsquid/render-only-components` | no effects, requests or transforms in components |

- `tsquid-check-architecture` checks the import graph under `src/components`:
  entity directories, `__private__` and feature-folder boundaries, and that
  internal modules have real consumers.
- `recommended` also enables `react-hooks/rules-of-hooks` and
  `react-hooks/exhaustive-deps`, and exempts `src/main.tsx` from the ordering and
  naming rules.
