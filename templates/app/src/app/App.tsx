import { RouterProvider } from 'react-router/dom';
import { RelayEnvironmentProvider } from 'react-relay';

import { ENVIRONMENT } from '../relay/environment';
import { AppProviders } from './AppProviders';
import { ROUTER } from './router';

export function App() {
  return (
    <RelayEnvironmentProvider environment={ENVIRONMENT}>
      <AppProviders>
        <RouterProvider router={ROUTER} />
      </AppProviders>
    </RelayEnvironmentProvider>
  );
}
