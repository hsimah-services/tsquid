import { createElement } from 'react';
import { resource, type RouteEntryPoint } from '@tsquid/routes/entrypoint';

import { HomePage } from './HomePage';

export function HomeEntryPoint() {
  return createElement(HomePage);
}

// A static route: no queries to preload.
export const HOME_ENTRY_POINT: RouteEntryPoint<Empty, Empty, Empty, Empty, Empty> = {
  root: resource('HomePage', HomeEntryPoint),
  getPreloadProps: () => ({}),
};

type Empty = Record<string, never>;
