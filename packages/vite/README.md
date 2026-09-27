# @tsquid/vite

The Vite preset for [tsquid](https://github.com/hsimah-services/tsquid) apps.

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import { tsquid } from '@tsquid/vite';

export default defineConfig({ plugins: tsquid() });
```

`tsquid()` returns, in order:

1. **StyleX** (`unplugin-stylex`). It must see the original `stylex.create` calls
   before React's plugin transforms the module. `@vitejs/plugin-react` 6 compiles
   with oxc rather than Babel, so StyleX's Babel transform runs as its own plugin,
   which also emits the extracted CSS.
2. **React** (`@vitejs/plugin-react`).
3. **Relay** (`vite-plugin-relay`), which compiles `graphql` tags to generated
   artifacts. Requires `babel-plugin-relay`.
4. **Shared setup:**
   - React, React Router, Relay and Astryx are deduplicated, so a linked package
     can't load a second copy of a context or store;
   - a `global` shim is added to `index.html`, because relay-runtime reads Node's
     `global`.

Peer dependencies: `vite` 8, `babel-plugin-relay` 21.
