import { createBrowserRouter } from 'react-router';

import { NavigationShell } from '../components/navigation/NavigationShell';
import { HOME_ROUTES } from '../routes/homeRoutes';
import { PROFILE_ROUTES } from '../routes/profileRoutes';
import { NavigationRouteError } from '../components/navigation/NavigationRouteError';

export const ROUTER = createBrowserRouter([{
  Component: NavigationShell,
  children: [
    { path: HOME_ROUTES.home.path, element: <HOME_ROUTES.home.Root errorFallback={NavigationRouteError} /> },
    { path: PROFILE_ROUTES.profile.path, element: <PROFILE_ROUTES.profile.Root errorFallback={NavigationRouteError} /> },
  ],
}]);
