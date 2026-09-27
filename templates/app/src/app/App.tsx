import { RouterProvider } from 'react-router/dom';
import { RelayEnvironmentProvider } from 'react-relay';
import { Theme } from '@astryxdesign/core/theme';
import { LinkProvider } from '@astryxdesign/core/Link';
import { neutralTheme } from '@astryxdesign/theme-neutral/built';

import { ENVIRONMENT } from '../relay/environment';
import { AppLink } from './AppLink';
import { ROUTER } from './router';

export function App() {
  return (
    <RelayEnvironmentProvider environment={ENVIRONMENT}>
      <Theme theme={neutralTheme}>
        <LinkProvider component={AppLink}>
          <RouterProvider router={ROUTER} />
        </LinkProvider>
      </Theme>
    </RelayEnvironmentProvider>
  );
}
