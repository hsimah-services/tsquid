import react from '@vitejs/plugin-react';
import relay from 'vite-plugin-relay';
import stylex from 'unplugin-stylex/vite';

// Packages that hold React context or a Relay store must resolve to one copy, even
// when a tsquid package is linked from a checkout with its own node_modules.
const SINGLETONS = ['react', 'react-dom', 'react-router', 'react-relay', 'relay-runtime', '@astryxdesign/core'];

/** Vite plugins for a tsquid app: StyleX, React, Relay, and their shared runtime setup. */
export function tsquid() {
  return [
    // StyleX must see the original stylex.create calls before plugin-react transforms
    // the module. plugin-react 6 compiles with oxc, not Babel, so StyleX's Babel
    // transform runs through unplugin-stylex, which also emits the extracted CSS.
    stylex(),
    react(),
    relay,
    {
      name: 'tsquid',
      config: () => ({ resolve: { dedupe: SINGLETONS } }),
      // relay-runtime still reads Node's `global` in a couple of code paths.
      transformIndexHtml: () => [{ tag: 'script', children: 'var global = globalThis;', injectTo: 'head-prepend' }],
    },
  ];
}
