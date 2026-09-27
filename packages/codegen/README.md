# @tsquid/codegen

[tsquid](https://github.com/hsimah-services/tsquid)'s route generator, compiled to
WebAssembly. It turns `routes.json` into typed TypeScript routes for
`@tsquid/routes`. It runs on any platform with Node 22 or later; no Rust is needed.

```sh
tsquid-codegen routes.json src/routes/__generated__/routes.ts
tsquid-codegen routes.json src/routes/__generated__/routes.ts --check  # fails if stale
```

```js
import { generate } from '@tsquid/codegen';

const source = generate(readFileSync('routes.json', 'utf8')); // throws on an invalid config
```

The config format is documented in
[@tsquid/routes](https://github.com/hsimah-services/tsquid/tree/main/packages/routes#readme).
