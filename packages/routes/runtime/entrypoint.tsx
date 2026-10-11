import { Component, createContext, Suspense, startTransition, use, useCallback, useContext, useLayoutEffect, useMemo, type ReactNode, type ComponentType, type ComponentProps } from 'react';
import { EntryPointContainer, fetchQuery, useEntryPointLoader, useRelayEnvironment, type PreloadedQuery, type ThinQueryParams, type JSResourceReference } from 'react-relay';
import { createOperationDescriptor, getRequest, type IEnvironment, type OperationType } from 'relay-runtime';
import { useLocation } from 'react-router';
import type { URI } from './uri.js';
import type { RouteContext } from './context.js';

// Structural types avoid Relay 21's circular EntryPoint declaration (rejected by TS7).
// They describe the same public Relay contract; casts are confined to hook/container adapters.
export type Empty = Record<string, never>;
export type EntryPointProps<Q, N = Empty, P = Empty, E = Empty> = {
  queries: { [K in keyof Q]: NonNullable<Q[K]> extends OperationType ? PreloadedQuery<NonNullable<Q[K]>> : never };
  entryPoints: { [K in keyof N]: N[K] extends AnyEntryPoint | undefined ? EntryPointReference<NonNullable<N[K]>> : never };
  props: P;
  extraProps: E;
};
type EntryPointReference<T extends AnyEntryPoint> = T extends AnyEntryPoint ? {
  dispose(): void;
  getComponent(): T['root'] extends JSResourceReference<infer C> ? C : never;
} : never;
export type RouteEntryPoint<R extends Record<string, unknown>, Q extends Record<string, OperationType | undefined>, N extends Record<string, AnyEntryPoint | undefined> = Empty, P = Empty, E = Empty> = {
  root: JSResourceReference<ComponentType<EntryPointProps<Q, N, P, E>>>;
  getPreloadProps: (route: R) => {
    queries?: { [K in keyof Q]: ThinQueryParams<NonNullable<Q[K]>> };
    entryPoints?: { [K in keyof N]: { entryPoint: NonNullable<N[K]>; entryPointParams: Parameters<NonNullable<N[K]>['getPreloadProps']>[0] } };
    extraProps?: E;
  };
};
type AnyComponent = ComponentType<any>;
type AnyEntryPoint = {
  root: JSResourceReference<AnyComponent>;
  getPreloadProps: (params: any) => {
    queries?: Record<string, ThinQueryParams<OperationType> | undefined>;
    entryPoints?: Record<string, { entryPoint: AnyEntryPoint; entryPointParams: Record<string, unknown> } | undefined>;
  };
};
export type EntryPointPropsOf<T extends AnyEntryPoint> = T['root'] extends JSResourceReference<infer C extends AnyComponent> ? ComponentProps<C> : never;

const RouteRefreshContext = createContext<(() => void) | null>(null);
export function useRouteRefresh(): () => void {
  const refresh = useContext(RouteRefreshContext);
  if (!refresh) throw new Error('Route refresh used outside its active entrypoint');
  return refresh;
}

function networkOnly(point: AnyEntryPoint): AnyEntryPoint {
  return {
    root: point.root,
    getPreloadProps: params => {
      const preload = point.getPreloadProps(params);
      return {
        ...preload,
        queries: Object.fromEntries(Object.entries(preload.queries ?? {}).map(([key, query]) => [key, query && { ...query, options: { ...query.options, fetchPolicy: 'network-only' } }])),
        entryPoints: Object.fromEntries(Object.entries(preload.entryPoints ?? {}).map(([key, nested]) => [key, nested && { ...nested, entryPoint: networkOnly(nested.entryPoint) }])),
      };
    },
  };
}

export function RouteEntryPointContainer({ entryPointReference, props }: { entryPointReference: EntryPointReference<AnyEntryPoint>; props: Record<string, unknown> }) {
  try { entryPointReference.getComponent(); } catch (error) {
    // React's use surfaces rejected module loads to the nearest error boundary.
    if (error && typeof error === 'object' && 'then' in error && typeof error.then === 'function') use(error as Promise<unknown>);
    else throw error;
  }
  const Container = EntryPointContainer as unknown as ComponentType<{ entryPointReference: unknown; props: unknown }>;
  return <Container entryPointReference={entryPointReference} props={props} />;
}

export function resource<C>(id: string, component: C): JSResourceReference<C> {
  return { getModuleId: () => id, getModuleIfRequired: () => component, load: () => Promise.resolve(component) };
}

export function lazyResource<C>(id: string, loader: () => Promise<C>): JSResourceReference<C> {
  let component: C | null = null;
  let pending: Promise<C> | null = null;
  return {
    getModuleId: () => id,
    getModuleIfRequired: () => component,
    load: () => pending ??= Promise.resolve().then(loader).then(value => {
      component = value;
      return value;
    }).catch(error => { pending = null; throw error; }),
  };
}

export type RouteErrorFallbackProps = { error: Error; retry: () => void };
type RouteRootProps = { fallback?: ReactNode; errorFallback?: (props: RouteErrorFallbackProps) => ReactNode };
class RouteErrorBoundary extends Component<{ resetKey: string; errorFallback?: RouteRootProps['errorFallback']; children: (attempt: number) => ReactNode }, { error: Error | null; attempt: number; resetKey: string }> {
  state: { error: Error | null; attempt: number; resetKey: string } = { error: null, attempt: 0, resetKey: this.props.resetKey };
  static getDerivedStateFromError(error: unknown) { return { error: error instanceof Error ? error : new Error(String(error)) }; }
  static getDerivedStateFromProps(props: { resetKey: string }, state: { resetKey: string }) {
    return props.resetKey === state.resetKey ? null : { error: null, attempt: 0, resetKey: props.resetKey };
  }
  render() {
    if (this.state.error) {
      if (!this.props.errorFallback) throw this.state.error;
      return this.props.errorFallback({ error: this.state.error, retry: () => { this.setState(state => ({ error: null, attempt: state.attempt + 1 })); } });
    }
    return this.props.children(this.state.attempt);
  }
}

type DefinedRoute<I, R> = URI<I> & {
  Root: ComponentType<RouteRootProps>;
  useRouteType(): R;
  preload(environment: IEnvironment, uri: string, onFailure?: () => void): () => void;
};
export function defineRoute<I, N extends string>(config: {
  uri: URI<I>;
  context: RouteContext<I, N>;
  entryPoint: AnyEntryPoint & { getPreloadProps: (route: { currentRoute: NoInfer<N>; input: NoInfer<I> }) => ReturnType<AnyEntryPoint['getPreloadProps']> };
  getRouteType?: never;
}): DefinedRoute<I, { currentRoute: N; input: I }>;
export function defineRoute<I, R extends Record<string, unknown>, N extends string>(config: {
  uri: URI<I>;
  context: RouteContext<I, N>;
  getRouteType: (input: I, currentRoute: N) => R;
  entryPoint: AnyEntryPoint & { getPreloadProps: (route: NoInfer<R>) => ReturnType<AnyEntryPoint['getPreloadProps']> };
}): DefinedRoute<I, R>;
export function defineRoute<I, N extends string>(config: {
  uri: URI<I>;
  context: RouteContext<I, N>;
  getRouteType?: (input: I, currentRoute: N) => Record<string, unknown>;
  entryPoint: AnyEntryPoint;
}): DefinedRoute<I, Record<string, unknown>> {
  const getRouteType = (input: I) => config.getRouteType ? config.getRouteType(input, config.context.currentRoute) : { currentRoute: config.context.currentRoute, input };
  type R = ReturnType<typeof getRouteType>;
  const refreshingEntryPoint = networkOnly(config.entryPoint);
  const entryPoint = {
    root: config.entryPoint.root,
    getPreloadProps: ({ route, refresh }: { route: R; refresh?: boolean }) => (refresh ? refreshingEntryPoint : config.entryPoint).getPreloadProps(route),
  };
  const RouteContext = createContext<R | null>(null);
  function useRouteType(): R {
    const value = useContext(RouteContext);
    if (!value) throw new Error('Route is not active');
    return value;
  }
  function Root({ fallback = null, errorFallback }: RouteRootProps) {
    const location = useLocation();
    return <RouteErrorBoundary resetKey={location.key} errorFallback={errorFallback}>{attempt => <RootContent fallback={fallback} attempt={attempt} />}</RouteErrorBoundary>;
  }
  function RootContent({ fallback, attempt }: { fallback: ReactNode; attempt: number }) {
    const location = useLocation();
    const environment = useRelayEnvironment();
    const uri = location.pathname + location.search + location.hash;
    const input = useMemo(() => config.uri.parseURI(uri), [uri]);
    const route = useMemo(() => getRouteType(input), [input]);
    const provider = useMemo(() => ({ getEnvironment: () => environment }), [environment]);
    const [reference, load] = useEntryPointLoader(provider, entryPoint) as unknown as [EntryPointReference<AnyEntryPoint> | null, (params: { route: R; refresh?: boolean }) => void, () => void];
    const refresh = useCallback(() => { startTransition(() => { load({ route, refresh: true }); }); }, [load, route]);
    // Before paint: a synchronous (preloaded or inlined) response skips the fallback.
    useLayoutEffect(() => { load({ route, refresh: attempt > 0 }); }, [load, route, attempt]);
    const context = useMemo(() => ({ currentRoute: config.context.currentRoute, input, updateURI: (patch: Partial<I>) => getUpdatedURI(config.uri, uri, input, patch) }), [input, uri]);
    return <config.context.Context value={context}><RouteContext value={route}><RouteRefreshContext value={refresh}>
      <Suspense fallback={fallback}>{reference ? <RouteEntryPointContainer entryPointReference={reference} props={{}} /> : fallback}</Suspense>
    </RouteRefreshContext></RouteContext></config.context.Context>;
  }
  return {
    ...config.uri, Root, useRouteType,
    preload(environment: IEnvironment, uri: string, onFailure?: () => void) {
      return preloadEntryPoint(environment, config.entryPoint, getRouteType(config.uri.parseURI(uri)), onFailure);
    },
  };
}

// Only route roots bind this operation to their active location and expose it
// through context. URI definitions can construct and parse, but cannot update.
function getUpdatedURI<I>(definition: URI<I>, uri: string, input: I, patch: Partial<I>): string {
  const current = new URL(uri, 'http://tsquid.local');
  const next = new URL(definition.getURI({ ...input, ...patch }), 'http://tsquid.local');
  // Every owned query key present in the URL was parsed into input, including
  // optional fields. Keep only unowned query keys from the original location.
  current.searchParams.forEach((value, key) => {
    if (!Object.prototype.hasOwnProperty.call(input, key)) next.searchParams.append(key, value);
  });
  return next.pathname + next.search + current.hash;
}

/** Returns a disposer for both subscriptions and GC retains, including nested queries. */
export function preloadEntryPoint(environment: IEnvironment, entryPoint: AnyEntryPoint, params: Record<string, unknown>, onFailure?: () => void): () => void {
  const disposers: (() => void)[] = [];
  let disposed = false;
  function dispose() {
    if (disposed) return;
    disposed = true;
    disposers.reverse().forEach(fn => fn());
  }
  function fail() { if (!disposed) { dispose(); onFailure?.(); } }
  function visit(point: AnyEntryPoint, input: Record<string, unknown>, ancestors: Set<AnyEntryPoint>) {
    if (disposed) return;
    if (ancestors.has(point)) throw new Error('Cyclic entrypoint graph');
    const next = new Set(ancestors).add(point);
    void point.root.load().catch(fail);
    const preload = point.getPreloadProps(input);
    for (const query of Object.values(preload.queries ?? {})) {
      if (!query) continue;
      // The hover API needs a compiled ConcreteRequest, rather than only its ID.
      if (query.parameters.kind !== 'Request') throw new Error('Hover preload requires a ConcreteRequest');
      if (query.environmentProviderOptions) throw new Error('Hover preload currently supports one Relay environment');
      const operation = createOperationDescriptor(getRequest(query.parameters), query.variables);
      const retain = environment.retain(operation);
      disposers.push(() => retain.dispose());
      const subscription = fetchQuery(environment, query.parameters, query.variables, {
        fetchPolicy: query.options?.fetchPolicy === 'network-only' || query.options?.fetchPolicy === 'store-and-network' ? 'network-only' : 'store-or-network',
        networkCacheConfig: query.options?.networkCacheConfig ?? undefined,
      }).subscribe({ error: fail });
      if (disposed) { subscription.unsubscribe(); return; }
      disposers.push(() => subscription.unsubscribe());
    }
    for (const nested of Object.values(preload.entryPoints ?? {})) {
      if (nested) visit(nested.entryPoint, nested.entryPointParams, next);
    }
  }
  try { visit(entryPoint, params, new Set()); } catch (error) { dispose(); throw error; }
  return dispose;
}
