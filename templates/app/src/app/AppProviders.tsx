import type { ReactNode } from 'react';
import { Theme } from '@astryxdesign/core/theme';
import { LinkProvider } from '@astryxdesign/core/Link';
import { neutralTheme } from '@astryxdesign/theme-neutral/built';

import { AppLink } from './AppLink';

// Everything a page needs besides Relay and the router; route tests render pages inside it.
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <Theme theme={neutralTheme}>
      <LinkProvider component={AppLink}>{children}</LinkProvider>
    </Theme>
  );
}
