# @tsquid/codegen

Generates typed routes for [`@tsquid/routes`](https://www.npmjs.com/package/@tsquid/routes)
from `routes.json`. Ships as WebAssembly. Node ≥ 22.

```sh
tsquid-codegen routes.json src/routes/__generated__/routes.ts
tsquid-codegen routes.json src/routes/__generated__/routes.ts --check   # exit 1 if stale
```

Writes `routes.ts` and `routes.manifest.json` (every route's path, fields and
`ssr` flag, for servers), both or neither.

```js
import { generate, manifest } from '@tsquid/codegen';

generate(configJson); // → TypeScript source; throws on an invalid config
manifest(configJson); // → server manifest JSON; throws on an invalid config
```

Output is deterministic; commit it. The config and manifest formats are in the
[`@tsquid/routes` README](https://www.npmjs.com/package/@tsquid/routes).
