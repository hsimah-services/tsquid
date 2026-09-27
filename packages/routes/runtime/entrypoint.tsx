import { createContext, Suspense, useContext, useEffect, useMemo, type ReactNode, type ComponentType } from 'react';
import { EntryPointContainer, fetchQuery, useEntryPointLoader, useRelayEnvironment, type PreloadedQuery, type ThinQueryParams, type JSResourceReference } from 'react-relay';
import { createOperationDescriptor, getRequest, type IEnvironment, type OperationType } from 'relay-runtime';
import { useLocation } from 'react-router';
import type { URI } from './uri';
import type { RouteContext } from './context';

// Structural types avoid Relay 21's circular EntryPoint declaration (rejected by TS7).
// They describe the same public Relay contract; casts are confined to hook/container adapters.
export type EntryPointProps<Q, N, P, E> = {
  queries: { [K in keyof Q]: NonNullable<Q[K]> extends OperationType ? PreloadedQuery<NonNullable<Q[K]>> : never };
  entryPoints: { [K in keyof N]: N[K] extends AnyEntryPoint | undefined ? EntryPointReference<NonNullable<N[K]>> : never };
  props: P;
  extraProps: E;
};
type EntryPointReference<T extends AnyEntryPoint> = {
  dispose(): void;
  getComponent(): T['root'] extends JSResourceReference<infer C> ? C : never;
};
export type RouteEntryPoint<R extends Record<string, unknown>, Q extends Record<string, OperationType | undefined>, N extends Record<string, AnyEntryPoint | undefined>, P, E> = {
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

export function RouteEntryPointContainer({ entryPointReference, props }: { entryPointReference: EntryPointReference<AnyEntryPoint>; props: Record<string, unknown> }) {
  const Container = EntryPointContainer as unknown as ComponentType<{ entryPointReference: unknown; props: unknown }>;
  return <Container entryPointReference={entryPointReference} props={props} />;
}

export function resource<C>(id: string, component: C): JSResourceReference<C> {
  return { getModuleId: () => id, getModuleIfRequired: () => component, load: () => Promise.resolve(component) };
}

export function defineRoute<I, R extends Record<string, unknown>, N extends string>(config: {
  uri: URI<I>;
  context: RouteContext<I, N>;
  getRouteType: (input: I) => R;
  entryPoint: AnyEntryPoint & { getPreloadProps: (route: R) => ReturnType<AnyEntryPoint['getPreloadProps']> };
}) {
  const RouteContext = createContext<R | null>(null);
  function useRouteType(): R {
    const value = useContext(RouteContext);
    if (!value) throw new Error('Route is not active');
    return value;
  }
  function Root({ fallback = null }: { fallback?: ReactNode }) {
    const location = useLocation();
    const environment = useRelayEnvironment();
    const uri = location.pathname + location.search + location.hash;
    const input = useMemo(() => config.uri.parseURI(uri), [uri]);
    const route = useMemo(() => config.getRouteType(input), [input]);
    const provider = useMemo(() => ({ getEnvironment: () => environment }), [environment]);
    const [reference, load] = useEntryPointLoader(provider, config.entryPoint) as unknown as [EntryPointReference<AnyEntryPoint> | null, (route: R) => void, () => void];
    useEffect(() => { load(route); }, [load, route]);
    const context = useMemo(() => ({ currentRoute: config.context.currentRoute, input, updateURI: (patch: Partial<I>) => getUpdatedURI(config.uri, uri, input, patch) }), [input, uri]);
    return <config.context.Context value={context}><RouteContext value={route}>
      <Suspense fallback={fallback}>{reference ? <RouteEntryPointContainer entryPointReference={reference} props={{}} /> : fallback}</Suspense>
    </RouteContext></config.context.Context>;
  }
  return {
    ...config.uri, Root, useRouteType,
    preload(environment: IEnvironment, uri: string) {
      return preloadEntryPoint(environment, config.entryPoint, config.getRouteType(config.uri.parseURI(uri)));
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
export function preloadEntryPoint(environment: IEnvironment, entryPoint: AnyEntryPoint, params: Record<string, unknown>): () => void {
  const disposers: (() => void)[] = [];
  let disposed = false;
  function dispose() {
    if (disposed) return;
    disposed = true;
    disposers.reverse().forEach(fn => fn());
  }
  function visit(point: AnyEntryPoint, input: Record<string, unknown>, ancestors: Set<AnyEntryPoint>) {
    if (ancestors.has(point)) throw new Error('Cyclic entrypoint graph');
    const next = new Set(ancestors).add(point);
    void point.root.load().catch(() => { /* Navigation surfaces module errors. */ });
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
      }).subscribe({ error: () => { /* Speculative failures retry on navigation. */ } });
      disposers.push(() => subscription.unsubscribe());
    }
    for (const nested of Object.values(preload.entryPoints ?? {})) {
      if (nested) visit(nested.entryPoint, nested.entryPointParams, next);
    }
  }
  try { visit(entryPoint, params, new Set()); } catch (error) { dispose(); throw error; }
  return dispose;
}
