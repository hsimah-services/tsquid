import { Environment, Network, RecordSource, Store } from 'relay-runtime';
import { readInitialData, withInitialData } from '@tsquid/routes/initialData';
import { createFetchGraphQL } from '@tsquid/routes/network';

// A server may inline the initial route's responses as #tsquid-data; see
// src/routes/__generated__/routes.manifest.json.
export const ENVIRONMENT = new Environment({
  network: Network.create(withInitialData(createFetchGraphQL({ url: '/graphql' }), readInitialData(), { warn: import.meta.env.DEV })),
  store: new Store(new RecordSource()),
});
