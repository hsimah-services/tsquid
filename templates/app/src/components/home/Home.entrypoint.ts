import { createElement } from 'react';
import { resource, type Empty, type RouteEntryPoint } from '@tsquid/routes/entrypoint';

import { type HomeEntryPointParams } from '../../routes/__generated__/routes';

import { HomePage } from './HomePage';

export function HomeEntryPoint() {
  return createElement(HomePage);
}

// A static route: no queries to preload.
export const HOME_ENTRY_POINT: RouteEntryPoint<HomeEntryPointParams, Empty> = {
  root: resource('HomePage', HomeEntryPoint),
  getPreloadProps: () => ({}),
};

