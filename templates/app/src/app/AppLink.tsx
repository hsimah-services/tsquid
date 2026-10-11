import { createLink, type PreloadingLinkProps } from '@tsquid/routes/Link';

import { HOME_ROUTES } from '../routes/homeRoutes';
import { PROFILE_ROUTES } from '../routes/profileRoutes';

// Every Astryx link renders through this, so hovering or focusing a link to a
// route starts loading that route's queries.
const PRELOADING_LINK = createLink([HOME_ROUTES.home, PROFILE_ROUTES.profile]);

export function AppLink(props: PreloadingLinkProps) {
  return <PRELOADING_LINK {...props} />;
}
