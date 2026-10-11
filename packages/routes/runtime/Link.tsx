import { useEffect, useRef, type ComponentPropsWithRef, type MouseEvent, type FocusEvent } from 'react';
import { Link as RouterLink, useHref, useResolvedPath, type LinkProps } from 'react-router';
import { useRelayEnvironment } from 'react-relay';
import type { IEnvironment } from 'relay-runtime';
import { normalizePathname } from './uri.js';

export type PreloadRoute = { path: string; preload(environment: IEnvironment, uri: string, onFailure?: () => void): () => void };
export type PreloadingLinkProps = Omit<LinkProps, 'to'> & { to?: LinkProps['to']; href?: string; ref?: ComponentPropsWithRef<'a'>['ref'] };

/** Adapt once at the application boundary; all normal router Link props pass through. */
export function createLink(routes: readonly PreloadRoute[]) {
  return function Link({ onMouseEnter, onFocus, href: anchorHref, to, reloadDocument, ...props }: PreloadingLinkProps) {
    const environment = useRelayEnvironment();
    const destination = to ?? anchorHref;
    const base = typeof window === 'undefined' ? 'http://tsquid.local/' : window.location.href;
    const absolute = typeof destination === 'string' ? new URL(destination, base) : null;
    const external = absolute !== null && absolute.origin !== new URL(base).origin;
    const routerDestination = absolute && !external && typeof destination === 'string' && /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(destination) ? absolute.pathname + absolute.search + absolute.hash : destination ?? '';
    const resolved = useResolvedPath(routerDestination);
    const routerHref = useHref(routerDestination);
    const href = external ? String(destination) : routerHref;
    const uri = resolved.pathname + resolved.search + resolved.hash;
    const route = routes.find(candidate => {
      const expected = normalizePathname(candidate.path).split('/');
      const actual = normalizePathname(resolved.pathname).split('/');
      return expected.length === actual.length && expected.every((part, index) => part.startsWith(':') || part === actual[index]);
    });
    const download = props.download !== undefined && props.download !== false;
    const internal = destination !== undefined && !external && (to !== undefined || !!route) && !reloadDocument && !download && (!props.target || props.target === '_self');
    const pending = useRef<{ dispose: () => void; timer: ReturnType<typeof setTimeout> } | null>(null);
    useEffect(() => () => {
      if (pending.current) { clearTimeout(pending.current.timer); pending.current.dispose(); pending.current = null; }
    }, [href, environment]);
    function preload() {
      if (pending.current || !internal || !route) return;
      try {
        let failed = false;
        const dispose = route.preload(environment, uri, () => {
          failed = true;
          if (pending.current) { clearTimeout(pending.current.timer); pending.current = null; }
        });
        if (failed) return;
        const timer = setTimeout(() => { dispose(); pending.current = null; }, 30_000);
        pending.current = { dispose, timer };
      } catch { /* Invalid speculative destinations remain normal links. */ }
    }
    const handlers = {
      onMouseEnter: (event: MouseEvent<HTMLAnchorElement>) => { onMouseEnter?.(event); if (!event.defaultPrevented) preload(); },
      onFocus: (event: FocusEvent<HTMLAnchorElement>) => { onFocus?.(event); if (!event.defaultPrevented) preload(); },
    };
    return internal ? <RouterLink {...props} {...handlers} to={routerDestination} /> : <a {...props} {...handlers} href={destination === undefined ? undefined : href} />;
  };
}
