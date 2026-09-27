# @tsquid/codegen

Generates typed routes for [`@tsquid/routes`](https://www.npmjs.com/package/@tsquid/routes)
from `routes.json`. Ships as WebAssembly. Node ≥ 22.

```sh
tsquid-codegen routes.json src/routes/__generated__/routes.ts
tsquid-codegen routes.json src/routes/__generated__/routes.ts --check   # exit 1 if stale
```

```js
import { generate } from '@tsquid/codegen';

generate(configJson); // → TypeScript source; throws on an invalid config
```

Output is deterministic; commit it. The config format is in the
[`@tsquid/routes` README](https://www.npmjs.com/package/@tsquid/routes).
