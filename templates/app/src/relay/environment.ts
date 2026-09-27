import { Environment, Network, RecordSource, Store, type FetchFunction } from 'relay-runtime';

export const ENVIRONMENT = new Environment({
  network: Network.create(fetchGraphQL),
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
