import { act, useLayoutEffect, type ComponentType, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { RelayEnvironmentProvider } from 'react-relay';
import { MemoryRouter } from 'react-router';
import { createOperationDescriptor, Environment, Network, Observable, RecordSource, Store, type ConcreteRequest, type Disposable, type GraphQLSingularResponse, type IEnvironment, type OperationDescriptor, type RequestParameters } from 'relay-runtime';
// @ts-expect-error relay-test-utils ships Flow types only; RelayTestUtils describes what this module uses.
import relayTestUtils from 'relay-test-utils';
import type { RouteRootProps } from './entrypoint.js';

// Relay's MockResolvers; the resolver context carries more fields than these.
export type MockResolverContext = { parentType?: string | null; name?: string | null; alias?: string | null; path?: readonly string[] | null; args?: Record<string, unknown> | null };
export type MockResolvers = Record<string, (context: MockResolverContext, generateId: () => number) => unknown>;
type RelayTestUtils = { MockPayloadGenerator: { generate(operation: OperationDescriptor, resolvers?: MockResolvers | null): GraphQLSingularResponse } };
const { MockPayloadGenerator } = relayTestUtils as RelayTestUtils;

/** The parts of a defineRoute result the harness renders. */
export type TestableRoute<I, N extends string = string> = {
  name: N;
  getURI(input: I): string;
  Root: ComponentType<RouteRootProps>;
};
type InputOption<I> = {} extends I ? { input?: I } : { input: I };
export type RenderRouteOptions<I> = InputOption<I> & {
  resolvers?: MockResolvers;
  /** Renders inside the router and Relay environment, around the route root. */
  wrapper?: ComponentType<{ children: ReactNode }>;
  /** Milliseconds to wait for lazy roots and queries. Default 5000. */
  timeout?: number;
};
export type RenderedRoute = {
  container: HTMLElement;
  environment: IEnvironment;
  /** Unmounts, then throws if a retain or network subscription is still open. */
  unmount(): Promise<void>;
};

type RouteState = { currentRoute: string; input: unknown };
export type RouteTestCase<S extends RouteState> = { route: TestableRoute<S['input'], S['currentRoute']> } & RenderRouteOptions<S['input']>;
/** One case per route in the catalogue: pass the generated RouteContextType. */
export type RouteTestCases<S extends RouteState> = { [K in S as K['currentRoute']]: RouteTestCase<K> };
export type RouteManifest = { routes: readonly { name: string }[] };
export type TestFunction = (name: string, fn: () => Promise<void>) => unknown;
/** Shared by every case; a case's own wrapper and timeout win, and its resolvers merge over these. */
export type RouteTestDefaults = Pick<RenderRouteOptions<unknown>, 'resolvers' | 'wrapper' | 'timeout'>;

/** Registers one test per manifest route, plus a failing test per case the manifest lacks. */
export function testRoutes<S extends RouteState>(test: TestFunction, manifest: RouteManifest, cases: RouteTestCases<S>, defaults: RouteTestDefaults = {}): void {
  const byName = cases as Record<string, RouteTestCase<RouteState> | undefined>;
  const names = new Set(manifest.routes.map(route => route.name));
  for (const name of names) {
    test(name, async () => {
      const testCase = Object.hasOwn(byName, name) ? byName[name] : undefined;
      if (!testCase) throw new Error(`No test case for route ${name}`);
      if (testCase.route.name !== name) throw new Error(`Test case ${name} renders route ${testCase.route.name}`);
      const view = await renderRoute(testCase.route, { ...defaults, ...testCase, resolvers: { ...defaults.resolvers, ...testCase.resolvers } });
      await view.unmount();
    });
  }
  for (const name of Object.keys(byName)) {
    if (!names.has(name)) test(name, async () => { throw new Error(`Route ${name} is not in the manifest`); });
  }
}

/** Renders a route root at its URI against generated mock data and waits for it to settle. */
export async function renderRoute<I>(route: TestableRoute<I>, ...[options]: {} extends I ? [options?: RenderRouteOptions<I>] : [options: RenderRouteOptions<I>]): Promise<RenderedRoute> {
  if (typeof document === 'undefined') throw new Error('renderRoute requires a DOM (for example a jsdom test environment)');
  const { input, resolvers, wrapper: Wrapper, timeout = 5000 } = (options ?? {}) as RenderRouteOptions<I> & { input?: I };
  const environment = createTestEnvironment(resolvers);
  const errors: unknown[] = [];
  let loading = 0;
  function Loading() {
    useLayoutEffect(() => { loading++; return () => { loading--; }; }, []);
    return null;
  }
  function errorFallback({ error }: { error: Error }) { errors.push(error); return null; }
  const globals = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
  const previousAct = globals.IS_REACT_ACT_ENVIRONMENT;
  globals.IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.body.appendChild(document.createElement('div'));
  // Errors that reach the route's fallback are rethrown, so React needn't log them too.
  const root = createRoot(container, {
    onUncaughtError: error => { errors.push(error); },
    onCaughtError: (error, info) => { if (!errors.includes(error)) console.error(error, info.componentStack); },
  });
  const page = <route.Root fallback={<Loading />} errorFallback={errorFallback} />;
  let mounted = true;
  async function unmount() {
    if (!mounted) return;
    mounted = false;
    try { await act(async () => { root.unmount(); }); } finally {
      container.remove();
      globals.IS_REACT_ACT_ENVIRONMENT = previousAct;
    }
    const leaks = environment.open();
    if (leaks.length) throw new Error(`Route ${route.name} left open after unmount: ${leaks.join(', ')}`);
  }
  try {
    await act(async () => {
      root.render(<MemoryRouter initialEntries={[route.getURI((input ?? {}) as I)]}>
        <RelayEnvironmentProvider environment={environment}>{Wrapper ? <Wrapper>{page}</Wrapper> : page}</RelayEnvironmentProvider>
      </MemoryRouter>);
    });
    const deadline = Date.now() + timeout;
    while (!errors.length && (loading > 0 || environment.pending().length)) {
      if (Date.now() > deadline) {
        const pending = environment.pending();
        throw new Error(`Route ${route.name} did not settle within ${timeout} ms${pending.length ? `; pending: ${pending.join(', ')}` : ''}`);
      }
      await act(() => new Promise(resolve => setTimeout(resolve, 10)));
    }
    if (errors.length) throw errors[0];
  } catch (error) {
    await unmount().catch(() => {});
    throw error;
  }
  return { container, environment, unmount };
}

// Answers every request from the compiled operation, which Relay passes to
// retain or execute; a request seen before its operation waits for it.
function createTestEnvironment(resolvers: MockResolvers | undefined) {
  const requests = new Map<RequestParameters, ConcreteRequest>();
  const waiting = new Map<() => void, string>();
  const subscriptions = new Map<object, string>();
  const retains = new Map<object, string>();
  const network = Network.create((params, variables) => Observable.create<GraphQLSingularResponse>(sink => {
    const key = {};
    subscriptions.set(key, params.name);
    function respond() {
      const request = requests.get(params);
      if (!request) return;
      waiting.delete(respond);
      try {
        sink.next(MockPayloadGenerator.generate(createOperationDescriptor(request, variables), resolvers));
        sink.complete();
      } catch (error) { sink.error(error instanceof Error ? error : new Error(String(error))); }
    }
    waiting.set(respond, params.name);
    respond();
    return () => { waiting.delete(respond); subscriptions.delete(key); };
  }));
  function register(operation: OperationDescriptor) {
    const request = operation.request.node;
    if (requests.has(request.params)) return;
    requests.set(request.params, request);
    [...waiting.keys()].forEach(respond => respond());
  }
  class TestEnvironment extends Environment {
    pending() { return [...waiting.values()]; }
    open() { return [...[...retains.values()].map(name => `retain ${name}`), ...[...subscriptions.values()].map(name => `request ${name}`)]; }
    retain(operation: OperationDescriptor): Disposable {
      register(operation);
      const key = {};
      retains.set(key, operation.request.node.params.name);
      const disposable = super.retain(operation);
      return { dispose: () => { if (retains.delete(key)) disposable.dispose(); } };
    }
    execute(data: Parameters<Environment['execute']>[0]) { register(data.operation); return super.execute(data); }
    executeWithSource(data: Parameters<Environment['executeWithSource']>[0]) { register(data.operation); return super.executeWithSource(data); }
    executeMutation(data: Parameters<Environment['executeMutation']>[0]) { register(data.operation); return super.executeMutation(data); }
  }
  return new TestEnvironment({ network, store: new Store(new RecordSource()) });
}
