import { useEffect, useRef } from 'react';
import { Link as RouterLink, useHref, type LinkProps } from 'react-router';
import { useRelayEnvironment } from 'react-relay';
import type { IEnvironment } from 'relay-runtime';

export type PreloadRoute = { path: string; preload(environment: IEnvironment, uri: string): () => void };

/** Adapt once at the application boundary; all normal router Link props pass through. */
export function createLink(routes: readonly PreloadRoute[]) {
  return function Link({ onMouseEnter, onFocus, ...props }: LinkProps) {
    const environment = useRelayEnvironment();
    const href = useHref(props.to);
    const pending = useRef<{ dispose: () => void; timer: ReturnType<typeof setTimeout> } | null>(null);
    useEffect(() => () => {
      if (pending.current) { clearTimeout(pending.current.timer); pending.current.dispose(); pending.current = null; }
    }, [href, environment]);
    function preload() {
      if (pending.current || props.reloadDocument || props.download || (props.target && props.target !== '_self')) return;
      const url = new URL(href, window.location.href);
      if (url.origin !== window.location.origin) return;
      const route = routes.find(candidate => {
        const expected = candidate.path.split('/');
        const actual = url.pathname.split('/');
        return expected.length === actual.length && expected.every((part, index) => part.startsWith(':') || part === actual[index]);
      });
      if (!route) return;
      try {
        const dispose = route.preload(environment, url.pathname + url.search);
        const timer = setTimeout(() => { dispose(); pending.current = null; }, 30_000);
        pending.current = { dispose, timer };
      } catch { /* Invalid speculative destinations remain normal links. */ }
    }
    return <RouterLink {...props} onMouseEnter={event => { onMouseEnter?.(event); if (!event.defaultPrevented) preload(); }} onFocus={event => { onFocus?.(event); if (!event.defaultPrevented) preload(); }} />;
  };
}
