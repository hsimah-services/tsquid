import { defineConfig } from 'vite';
import { tsquid } from '@tsquid/vite';

// In development Vite proxies GraphQL to the API, so the browser makes no
// cross-origin requests. Production must serve or proxy /graphql on the app's origin.
const GRAPHQL_PROXY_TARGET = process.env.GRAPHQL_PROXY_TARGET ?? 'http://localhost:4000';

export default defineConfig({
  plugins: tsquid(),
  server: {
    proxy: {
      '/graphql': { target: GRAPHQL_PROXY_TARGET, changeOrigin: true },
    },
  },
});
