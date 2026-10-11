import { createElement } from 'react';
import { resource, type EntryPointProps, type RouteEntryPoint } from '@tsquid/routes/entrypoint';
import { ProfileRouteQuery, type ProfileEntryPointParams } from '../../routes/__generated__/routes';

import { ProfilePage } from './ProfilePage';
import PROFILE_QUERY_NODE, { type ProfileQuery } from './__generated__/ProfileQuery.graphql';

export function ProfileEntryPoint({ queries }: EntryPointProps<Queries>) {
  return createElement(ProfilePage, { queryRef: queries.profile });
}

// Navigating here, or hovering a link to here, starts ProfileQuery before ProfilePage renders.
export const PROFILE_ENTRY_POINT: RouteEntryPoint<ProfileEntryPointParams, Queries> = {
  root: resource('ProfilePage', ProfileEntryPoint),
  getPreloadProps: (route) => ({ queries: { profile: { parameters: PROFILE_QUERY_NODE, variables: ProfileRouteQuery.getVariables(route.input) } } }),
};

type Queries = { profile: ProfileQuery };
