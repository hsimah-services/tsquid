# @tsquid/vite

Vite preset for tsquid apps.

```ts
import { defineConfig } from 'vite';
import { tsquid } from '@tsquid/vite';

export default defineConfig({ plugins: tsquid() });
```

Returns, in order:
1. StyleX (`unplugin-stylex`), which must see source before React's transform;
2. React (`@vitejs/plugin-react`);
3. Relay (`vite-plugin-relay`);
4. shared setup: dedupes `react`, `react-dom`, `react-router`, `react-relay`,
   `relay-runtime` and `@astryxdesign/core`, and adds a `globalThis` alias for
   relay-runtime's `global`.

Peers: `vite` 8, `babel-plugin-relay` 21.
