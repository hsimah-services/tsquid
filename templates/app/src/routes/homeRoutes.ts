import { defineRoute } from '@tsquid/routes/entrypoint';

import { HOME_ENTRY_POINT } from '../components/home/Home.entrypoint';
import { HomeRouteContext, HomeURI } from './__generated__/routes';

export const HOME_ROUTES = {
  home: defineRoute({ uri: HomeURI, context: HomeRouteContext, getRouteType: () => ({}), entryPoint: HOME_ENTRY_POINT }),
};
