import { lazyResource, type RouteEntryPoint } from '@tsquid/routes/entrypoint';
import { ProfileRouteQuery, type ProfileEntryPointParams } from '../../routes/__generated__/routes';

import PROFILE_QUERY_NODE, { type ProfileQuery } from './__generated__/ProfileQuery.graphql';

// Navigating here, or hovering a link to here, starts ProfileQuery before ProfilePage renders.
export const PROFILE_ENTRY_POINT: RouteEntryPoint<ProfileEntryPointParams, Queries> = {
  root: lazyResource('ProfilePage', () => import('./ProfilePage').then(module => module.ProfilePage)),
  getPreloadProps: (route) => ({ queries: { profile: { parameters: PROFILE_QUERY_NODE, variables: ProfileRouteQuery.getVariables(route.input) } } }),
};

type Queries = { profile: ProfileQuery };
