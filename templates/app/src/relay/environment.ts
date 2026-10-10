import { Environment, Network, RecordSource, Store, type FetchFunction } from 'relay-runtime';
import { readInitialData, withInitialData } from '@tsquid/routes/initialData';

// A server may inline the initial route's responses as #tsquid-data; see
// src/routes/__generated__/routes.manifest.json.
export const ENVIRONMENT = new Environment({
  network: Network.create(withInitialData(fetchGraphQL, readInitialData(), { warn: import.meta.env.DEV })),
  store: new Store(new RecordSource()),
});

// Vite proxies /graphql to the API in development; see vite.config.ts.
async function fetchGraphQL(...[request, variables]: Parameters<FetchFunction>) {
  const response = await fetch('/graphql', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ query: request.text, variables }),
  });
  if (!response.ok) throw new Error('GraphQL request failed.');
  return response.json();
}
