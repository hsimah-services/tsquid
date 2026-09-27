import { createBrowserRouter } from 'react-router';

import { NavigationShell } from '../components/navigation/NavigationShell';
import { HOME_ROUTES } from '../routes/homeRoutes';
import { PROFILE_ROUTES } from '../routes/profileRoutes';

export const ROUTER = createBrowserRouter([{
  Component: NavigationShell,
  children: [
    { path: HOME_ROUTES.home.path, Component: HOME_ROUTES.home.Root },
    { path: PROFILE_ROUTES.profile.path, Component: PROFILE_ROUTES.profile.Root },
  ],
}]);
