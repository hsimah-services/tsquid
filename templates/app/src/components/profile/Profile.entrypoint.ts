import { createElement } from 'react';
import { resource, type EntryPointProps, type RouteEntryPoint } from '@tsquid/routes/entrypoint';
import { ProfileRouteQuery } from '../../routes/__generated__/routes';

import { ProfilePage } from './ProfilePage';
import PROFILE_QUERY_NODE, { type ProfileQuery } from './__generated__/ProfileQuery.graphql';

export function ProfileEntryPoint({ queries }: EntryPointProps<Queries, Empty, Empty, Empty>) {
  return createElement(ProfilePage, { queryRef: queries.profile });
}

// Navigating here, or hovering a link to here, starts ProfileQuery before ProfilePage renders.
export const PROFILE_ENTRY_POINT: RouteEntryPoint<Empty, Queries, Empty, Empty, Empty> = {
  root: resource('ProfilePage', ProfileEntryPoint),
  getPreloadProps: (input) => ({ queries: { profile: { parameters: PROFILE_QUERY_NODE, variables: ProfileRouteQuery.getVariables(input) } } }),
};

type Queries = { profile: ProfileQuery };
type Empty = Record<string, never>;
