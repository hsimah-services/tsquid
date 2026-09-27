import { defineRoute } from '@tsquid/routes/entrypoint';

import { PROFILE_ENTRY_POINT } from '../components/profile/Profile.entrypoint';
import { ProfileRouteContext, ProfileURI } from './__generated__/routes';

export const PROFILE_ROUTES = {
  profile: defineRoute({ uri: ProfileURI, context: ProfileRouteContext, getRouteType: () => ({}), entryPoint: PROFILE_ENTRY_POINT }),
};
