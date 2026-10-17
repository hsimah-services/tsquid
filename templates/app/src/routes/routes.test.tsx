import { expect, test } from 'vitest';
import { renderRoute, testRoutes } from '@tsquid/routes/testing';

import { AppProviders } from '../app/AppProviders';
import manifest from './__generated__/routes.manifest.json';
import type { RouteContextType } from './__generated__/routes';
import { HOME_ROUTES } from './homeRoutes';
import { PROFILE_ROUTES } from './profileRoutes';

// One case per route in routes.json; tsc fails when a route has none. Each case
// renders its route against mock Relay data and checks it settles without errors or leaks.
testRoutes<RouteContextType>(test, manifest, {
  Home: { route: HOME_ROUTES.home },
  Profile: { route: PROFILE_ROUTES.profile },
}, { wrapper: AppProviders });

test('Profile shows the viewer', async () => {
  const view = await renderRoute(PROFILE_ROUTES.profile, { wrapper: AppProviders, resolvers: { Viewer: () => ({ name: 'Ada' }) } });
  expect(view.container.textContent).toContain('Signed in as Ada.');
  await view.unmount();
});
