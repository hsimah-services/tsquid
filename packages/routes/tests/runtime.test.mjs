import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { Environment, Network, RecordSource, Store, Observable } from 'relay-runtime';

const { createURI, normalizePathname } = await import(pathToFileURL(`${process.env.TSQUID_TEST_BUILD}/uri.mjs`));
const { preloadEntryPoint, resource } = await import(pathToFileURL(`${process.env.TSQUID_TEST_BUILD}/entrypoint.mjs`));
const { lazyResource } = await import(pathToFileURL(`${process.env.TSQUID_TEST_BUILD}/entrypoint.mjs`));
test('anchor link props route, preload, forward refs and leave other destinations native', async () => {
  const { JSDOM } = await import('jsdom');
  const { act, createRef } = await import('react');
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://example.test/' });
  const previous = { window: globalThis.window, document: globalThis.document, act: globalThis.IS_REACT_ACT_ENVIRONMENT };
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = await import('react-dom/client');
  const { MemoryRouter, useLocation } = await import('react-router');
  const { RelayEnvironmentProvider } = await import('react-relay');
  const { createLink } = await import(pathToFileURL(`${process.env.TSQUID_TEST_BUILD}/Link.mjs`));
  let location, clicks = 0, preloads = 0, disposals = 0;
  const Link = createLink([{ path: '/profile', preload: (_environment, uri) => { assert.equal(uri, '/profile?q=x'); preloads++; return () => { disposals++; }; } }]);
  const { environment } = setup();
  const ref = createRef();
  function Probe() { location = useLocation().pathname; return null; }
  const root = createRoot(document.getElementById('root'));
  const render = props => act(async () => { root.render(createElement(MemoryRouter, null,
    createElement(RelayEnvironmentProvider, { environment }, createElement(Link, props, 'Profile'), createElement(Probe)))); });
  try {
    await render({ href: '/profile?q=x', className: 'nav', ref, onClick: () => { clicks++; } });
    const anchor = document.querySelector('a');
    assert.equal(ref.current, anchor);
    assert.equal(anchor.className, 'nav');
    assert.equal(anchor.getAttribute('href'), '/profile?q=x');
    await act(async () => { anchor.dispatchEvent(new dom.window.MouseEvent('mouseover', { bubbles: true })); anchor.dispatchEvent(new dom.window.FocusEvent('focusin', { bubbles: true })); });
    assert.equal(preloads, 1);
    await act(async () => { anchor.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })); });
    assert.equal(clicks, 1);
    assert.equal(location, '/profile');
    for (const props of [{ href: '/auth/login' }, { href: 'https://other.test/profile' }, { href: '/profile?q=x', download: true }, { href: '/profile?q=x', download: '' }, { href: '/profile?q=x', target: '_blank' }, { href: '/profile?q=x', reloadDocument: true }, {}]) {
      await render(props);
      const anchor = document.querySelector('a');
      assert.equal(anchor.hasAttribute('data-discover'), false);
      await act(async () => { anchor.dispatchEvent(new dom.window.MouseEvent('mouseover', { bubbles: true })); });
      assert.equal(preloads, 1);
    }
    await render({ href: 'https://example.test/profile?q=x' });
    assert.equal(document.querySelector('a').getAttribute('href'), '/profile?q=x');
    await render({ to: '/profile?q=x', onFocus: event => event.preventDefault() });
    await act(async () => { document.querySelector('a').dispatchEvent(new dom.window.FocusEvent('focusin', { bubbles: true })); });
    assert.equal(preloads, 1);
  } finally {
    await act(async () => { root.unmount(); });
    assert.equal(disposals, 1);
    dom.window.close();
    globalThis.window = previous.window;
    globalThis.document = previous.document;
    globalThis.IS_REACT_ACT_ENVIRONMENT = previous.act;
  }
});
test('lazy resources share hover and navigation loads and retry failures', async () => {
  let calls = 0, resolve;
  const component = () => null;
  const root = lazyResource('lazy', () => { calls++; return new Promise(done => { resolve = done; }); });
  assert.equal(root.getModuleId(), 'lazy');
  assert.equal(root.getModuleIfRequired(), null);
  const { environment } = setup();
  const dispose = preloadEntryPoint(environment, { root, getPreloadProps: () => ({}) }, {});
  const navigation = root.load();
  assert.equal(root.load(), navigation);
  await Promise.resolve();
  assert.equal(calls, 1);
  resolve(component);
  assert.equal(await navigation, component);
  assert.equal(root.getModuleIfRequired(), component);
  assert.equal(await root.load(), component);
  assert.equal(calls, 1);
  dispose();
  let attempts = 0;
  const retry = lazyResource('retry', () => { if (++attempts === 1) throw new Error('load failed'); return Promise.resolve(component); });
  await assert.rejects(retry.load(), /load failed/);
  assert.equal(retry.getModuleIfRequired(), null);
  assert.equal(await retry.load(), component);
  assert.equal(attempts, 2);
});
const route = createURI('/tutorials/:level/:id', {
  level: { kind: 'int', optional: false }, id: { kind: 'string', optional: false },
  filter: { kind: 'string', optional: true }, enabled: { kind: 'bool', optional: true },
  tags: { kind: 'string[]', optional: true }, counts: { kind: 'int[]', optional: true }, flags: { kind: 'bool[]', optional: true },
});

test('trailing slashes load static and parameterized routes with query state intact', () => {
  const tutorials = createURI('/tutorials', { filter: { kind: 'string', optional: true } });
  assert.deepEqual(tutorials.parseURI('/tutorials/'), {});
  assert.deepEqual(tutorials.parseURI('/tutorials/?filter=turn#notes'), { filter: 'turn' });
  assert.deepEqual(route.parseURI('/tutorials/2/a%2Fb/?enabled=false'), { level: 2, id: 'a/b', enabled: false });
  assert.deepEqual(createURI('/', {}).parseURI('/'), {});
  assert.deepEqual(createURI('/tutorials/', {}).parseURI('/tutorials'), {});
  assert.equal(normalizePathname('/tutorials///'), '/tutorials');
  assert.equal(normalizePathname('/tutorials/a%2F/'), '/tutorials/a%2F');
  assert.throws(() => route.parseURI('/tutorials//2/a/'));
  assert.throws(() => route.parseURI('/tutorials/2/'));
});

test('URI round trip includes encoded path values and primitive collections', () => {
  const input = { level: 0, id: 'a/b + 雪', filter: '', enabled: false, tags: ['a&b', '', 'a&b'], counts: [-2, 0], flags: [false, true] };
  assert.deepEqual(route.parseURI(route.getURI(input)), input);
});
test('invalid URI input is rejected instead of coerced or truncated', () => {
  for (const uri of ['/tutorials/1.2/a', '/tutorials/9007199254740992/a', '/tutorials/1/a?enabled=1', '/tutorials/1/a?filter=x&filter=y', '/wrong/1/a', '/tutorials/1/%ZZ']) assert.throws(() => route.parseURI(uri));
  for (const input of [{ level: NaN, id: 'a' }, { level: 1, id: '..' }, { level: 1, id: '' }, { level: 1, id: 'a', enabled: 'false' }, { level: 1, id: 'a', tags: 'abc' }]) assert.throws(() => route.getURI(input));
});
test('optional empty collections normalize to absence', () => {
  assert.deepEqual(route.parseURI(route.getURI({ level: 1, id: 'a', tags: [] })), { level: 1, id: 'a' });
});

const query = {
  kind: 'Request',
  fragment: { kind: 'Fragment', name: 'TestQuery', type: 'Query', metadata: null, argumentDefinitions: [], selections: [{ kind: 'ScalarField', alias: null, name: 'hello', args: null, storageKey: null }] },
  operation: { kind: 'Operation', name: 'TestQuery', argumentDefinitions: [], selections: [{ kind: 'ScalarField', alias: null, name: 'hello', args: null, storageKey: null }] },
  params: { name: 'TestQuery', operationKind: 'query', id: null, cacheID: 'test', text: 'query TestQuery { hello }', metadata: {} },
};
function setup(network) {
  let requests = 0, retains = 0, cancelled = 0;
  const environment = new Environment({ network: Network.create(network ?? (() => Observable.create(() => { requests++; return () => cancelled++; }))), store: new Store(new RecordSource()) });
  const retain = environment.retain.bind(environment);
  environment.retain = operation => { retains++; const ref = retain(operation); return { dispose: () => { retains--; ref.dispose(); } }; };
  return { environment, stats: () => ({ requests, retains, cancelled }) };
}
const child = { root: resource('child', () => null), getPreloadProps: () => ({ queries: { detail: { parameters: query, variables: {} } } }) };
const parent = { root: resource('parent', () => null), getPreloadProps: ({ id }) => ({ entryPoints: id ? { detail: { entryPoint: child, entryPointParams: { id } } } : {} }) };

test('conditional nested preloads fetch only when selected and clean up exactly once', () => {
  const { environment, stats } = setup();
  preloadEntryPoint(environment, parent, {})();
  assert.deepEqual(stats(), { requests: 0, retains: 0, cancelled: 0 });
  const dispose = preloadEntryPoint(environment, parent, { id: '1' });
  assert.deepEqual(stats(), { requests: 1, retains: 1, cancelled: 0 });
  dispose(); dispose();
  assert.deepEqual(stats(), { requests: 1, retains: 0, cancelled: 1 });
});
test('duplicate hover fetches share an in-flight network request', () => {
  const { environment, stats } = setup();
  const a = preloadEntryPoint(environment, parent, { id: '1' });
  const b = preloadEntryPoint(environment, parent, { id: '1' });
  assert.equal(stats().requests, 1);
  a(); b(); assert.equal(stats().retains, 0);
});
test('cycles fail and release already acquired retains', () => {
  const { environment, stats } = setup();
  const cyclic = { root: resource('cycle', () => null), getPreloadProps: () => ({ ...child.getPreloadProps(), entryPoints: { self: { entryPoint: cyclic, entryPointParams: {} } } }) };
  assert.throws(() => preloadEntryPoint(environment, cyclic, {}), /Cyclic/);
  assert.equal(stats().retains, 0);
});

test('failed speculative query and module loads release all acquired retains', async () => {
  const failedModule = lazyResource('failed-preload', () => Promise.reject(new Error('module failed')));
  const { environment, stats } = setup();
  const dispose = preloadEntryPoint(environment, { ...child, root: failedModule }, {});
  assert.equal(stats().retains, 1);
  await assert.rejects(failedModule.load(), /module failed/);
  assert.deepEqual(stats(), { requests: 1, retains: 0, cancelled: 1 });
  dispose();
  const synchronous = setup(() => Observable.create(sink => { sink.error(new Error('query failed')); }));
  let nested = false;
  const point = { ...child, getPreloadProps: () => ({ ...child.getPreloadProps(), entryPoints: { nested: { entryPoint: { ...child, getPreloadProps: () => { nested = true; return {}; } }, entryPointParams: {} } } }) };
  preloadEntryPoint(synchronous.environment, point, {})();
  assert.equal(synchronous.stats().retains, 0);
  assert.equal(nested, false);
  let fail;
  const asynchronous = setup(() => Observable.create(sink => { fail = () => sink.error(new Error('late error')); }));
  preloadEntryPoint(asynchronous.environment, child, {});
  assert.equal(asynchronous.stats().retains, 1);
  fail();
  assert.equal(asynchronous.stats().retains, 0);
});

test('native Relay loads and renders the configured nested entrypoint graph', async (t) => {
  // SSR never commits effects: advance Relay's temporary render retain timer explicitly.
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { createElement } = await import('react');
  const { renderToString } = await import('react-dom/server');
  const { loadEntryPoint, EntryPointContainer, RelayEnvironmentProvider, usePreloadedQuery } = await import('react-relay');
  const environment = new Environment({ network: Network.create(() => Observable.from({ data: { hello: 'preloaded' } })), store: new Store(new RecordSource()) });
  function Detail({ queries }) {
    const data = usePreloadedQuery(query, queries.detail);
    return createElement('p', null, data.hello);
  }
  const detail = { ...child, root: resource('detail-component', Detail) };
  function Page({ entryPoints }) { return createElement(EntryPointContainer, { entryPointReference: entryPoints.detail, props: {} }); }
  const page = { root: resource('page-component', Page), getPreloadProps: () => ({ entryPoints: { detail: { entryPoint: detail, entryPointParams: {} } } }) };
  const reference = loadEntryPoint({ getEnvironment: () => environment }, page, {});
  try {
    assert.equal(renderToString(createElement(RelayEnvironmentProvider, { environment }, createElement(EntryPointContainer, { entryPointReference: reference, props: {} }))), '<p>preloaded</p>');
  } finally { reference.dispose(); t.mock.timers.tick(300_001); t.mock.timers.reset(); }
});


const generated = await import(pathToFileURL(`${process.env.TSQUID_TEST_BUILD}/routes.mjs`));
const { createElement } = await import('react');
const { renderToString } = await import('react-dom/server');

function routeState(currentRoute, input = {}) {
  return { currentRoute, input, updateURI: () => '/unchanged' };
}

test('generated hooks accept all routes belonging to their entrypoint', () => {
  const { RouteName, TutorialsRouteContext, TutorialDetailRouteContext, useTutorialRouteContext } = generated;
  for (const [context, input] of [[TutorialsRouteContext, { filter: 'turn' }], [TutorialDetailRouteContext, { id: 'one' }]]) {
    const value = routeState(context.currentRoute, input);
    let observed;
    function Probe() { observed = useTutorialRouteContext(); return null; }
    renderToString(createElement(context.Context, { value }, createElement(Probe)));
    assert.equal(observed, value);
  }
  assert.equal(TutorialsRouteContext.currentRoute, RouteName.Tutorials);
});

test('generated hooks reject missing providers and other active entrypoints', () => {
  const { PlaylistsRouteContext, TutorialsRouteContext, useTutorialRouteContext } = generated;
  function Probe() { useTutorialRouteContext(); return null; }
  assert.throws(() => renderToString(createElement(Probe)), /outside its active entrypoint/);
  const wrongRoute = createElement(PlaylistsRouteContext.Context,
    { value: routeState(PlaylistsRouteContext.currentRoute) }, createElement(Probe));
  assert.throws(() => renderToString(wrongRoute), /requires the Tutorial entrypoint; current route is Playlists/);
  // An ancestor's Tutorial provider must not hide a nearer, different route.
  assert.throws(() => renderToString(createElement(TutorialsRouteContext.Context,
    { value: routeState(TutorialsRouteContext.currentRoute) }, wrongRoute)), /current route is Playlists/);
});

test('route-specific context hooks reject a different route within the same entrypoint', () => {
  const { TutorialsRouteContext, TutorialDetailRouteContext } = generated;
  function Probe() { TutorialsRouteContext.useRoute(); return null; }
  assert.throws(() => renderToString(createElement(TutorialDetailRouteContext.Context,
    { value: routeState(TutorialDetailRouteContext.currentRoute, { id: 'one' }) }, createElement(Probe))),
  /Expected route Tutorials, but current route is TutorialDetail/);
});

test('route roots bind context state and updateURI to the current location without navigating', async () => {
  const { defineRoute } = await import(pathToFileURL(`${process.env.TSQUID_TEST_BUILD}/entrypoint.mjs`));
  const { MemoryRouter } = await import('react-router');
  const { RelayEnvironmentProvider } = await import('react-relay');
  const { TutorialsURI, TutorialsRouteContext, TutorialDetailURI, TutorialDetailRouteContext, useTutorialRouteContext, RouteName } = generated;
  for (const uri of ['/tutorials/?filter=old&utm=abc#notes', '/tutorials?filter=next&utm=xyz#other', '/tutorials/a%2Fb?utm=abc#notes']) {
    const detail = uri.startsWith('/tutorials/a');
    const definition = detail ? TutorialDetailURI : TutorialsURI;
    const context = detail ? TutorialDetailRouteContext : TutorialsRouteContext;
    const patch = detail ? { id: 'new/id' } : { filter: 'new' };
    const clearPatch = detail ? { id: 'other' } : { filter: undefined };
    const route = defineRoute({ uri: definition, context, getRouteType: input => input, entryPoint: parent });
    const { environment } = setup();
    let observed;
    function Probe() {
      const state = useTutorialRouteContext();
      observed = { currentRoute: state.currentRoute, input: state.input, updated: state.updateURI(patch), cleared: state.updateURI(clearPatch) };
      return null;
    }
    renderToString(createElement(MemoryRouter, { initialEntries: [uri] },
      createElement(RelayEnvironmentProvider, { environment }, createElement(route.Root, { fallback: createElement(Probe) }))));
    assert.equal(observed.currentRoute, detail ? RouteName.TutorialDetail : RouteName.Tutorials);
    assert.deepEqual(observed.input, definition.parseURI(uri));
    const suffix = uri.includes('utm=xyz') ? '&utm=xyz#other' : '&utm=abc#notes';
    assert.equal(observed.updated, detail ? '/tutorials/new%2Fid?utm=abc#notes' : '/tutorials?filter=new' + suffix);
    assert.equal(observed.cleared, detail ? '/tutorials/other?utm=abc#notes' : '/tutorials?' + suffix.slice(1));
    assert.equal('updateURI' in definition, false);
    assert.equal('updateURI' in route, false);
  }
});

test('default route params agree in the active root and hover preload', async () => {
  const { defineRoute } = await import(pathToFileURL(`${process.env.TSQUID_TEST_BUILD}/entrypoint.mjs`));
  const { MemoryRouter } = await import('react-router');
  const { RelayEnvironmentProvider } = await import('react-relay');
  const { TutorialsURI, TutorialsRouteContext, RouteName } = generated;
  let preloaded, active;
  const point = { root: resource('default', () => null), getPreloadProps: params => { preloaded = params; return {}; } };
  const definition = defineRoute({ uri: TutorialsURI, context: TutorialsRouteContext, entryPoint: point });
  const { environment } = setup();
  const dispose = definition.preload(environment, '/tutorials?filter=x');
  function Probe() { active = definition.useRouteType(); return null; }
  renderToString(createElement(MemoryRouter, { initialEntries: ['/tutorials?filter=x'] },
    createElement(RelayEnvironmentProvider, { environment }, createElement(definition.Root, { fallback: createElement(Probe) }))));
  assert.deepEqual(active, { currentRoute: RouteName.Tutorials, input: { filter: 'x' } });
  assert.deepEqual(preloaded, active);
  dispose();
  const custom = defineRoute({ uri: TutorialsURI, context: TutorialsRouteContext, getRouteType: (input, currentRoute) => ({ ...input, name: currentRoute }), entryPoint: point });
  custom.preload(environment, '/tutorials?filter=y')();
  assert.deepEqual(preloaded, { filter: 'y', name: RouteName.Tutorials });
});

test('active route refresh reloads parent and nested queries and preserves committed content', async (t) => {
  const { JSDOM } = await import('jsdom');
  const { act, useEffect } = await import('react');
  const { defineRoute, useRouteRefresh } = await import(pathToFileURL(`${process.env.TSQUID_TEST_BUILD}/entrypoint.mjs`));
  function Outside() { useRouteRefresh(); return null; }
  assert.throws(() => renderToString(createElement(Outside)), /outside its active entrypoint/);
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://example.test/' });
  const previous = { window: globalThis.window, document: globalThis.document, act: globalThis.IS_REACT_ACT_ENVIRONMENT };
  globalThis.window = dom.window; globalThis.document = dom.window.document; globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = await import('react-dom/client');
  const { MemoryRouter } = await import('react-router');
  const { RelayEnvironmentProvider, EntryPointContainer, usePreloadedQuery } = await import('react-relay');
  const nestedQuery = { ...query, fragment: { ...query.fragment, name: 'NestedQuery', selections: [{ ...query.fragment.selections[0], name: 'nested' }] }, operation: { ...query.operation, name: 'NestedQuery', selections: [{ ...query.operation.selections[0], name: 'nested' }] }, params: { ...query.params, name: 'NestedQuery', cacheID: 'nested', text: 'query NestedQuery { nested }' } };
  const requests = [], waiting = [];
  let asynchronous = false, revision = 0, refresh, mounts = 0, fallbacks = 0;
  const references = new Set();
  const environment = new Environment({ network: Network.create(request => Observable.create(sink => {
    requests.push(request.name);
    const finish = () => { sink.next({ data: { hello: `v${revision}`, nested: `v${revision}` } }); sink.complete(); };
    if (asynchronous) waiting.push(finish); else finish();
  })), store: new Store(new RecordSource()) });
  function Nested({ queries }) { references.add(queries.nested); return createElement('span', null, usePreloadedQuery(nestedQuery, queries.nested).nested); }
  const nested = { root: resource('nested-refresh', Nested), getPreloadProps: () => ({ queries: { nested: { parameters: nestedQuery, variables: {} } } }) };
  function Page({ queries, entryPoints }) {
    refresh = useRouteRefresh(); references.add(queries.page);
    useEffect(() => { mounts++; }, []);
    return createElement('article', null, usePreloadedQuery(query, queries.page).hello, createElement(EntryPointContainer, { entryPointReference: entryPoints.child, props: {} }));
  }
  function Fallback() { useEffect(() => { fallbacks++; }, []); return createElement('i', null, 'loading'); }
  const entryPoint = { root: resource('refresh-page', Page), getPreloadProps: () => ({ queries: { page: { parameters: query, variables: {} } }, entryPoints: { child: { entryPoint: nested, entryPointParams: {} } } }) };
  const definition = defineRoute({ uri: generated.TutorialsURI, context: generated.TutorialsRouteContext, entryPoint });
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const root = createRoot(document.getElementById('root'));
  try {
    await act(async () => { root.render(createElement(MemoryRouter, { initialEntries: ['/tutorials'] }, createElement(RelayEnvironmentProvider, { environment }, createElement(definition.Root, { fallback: createElement(Fallback) })))); });
    assert.deepEqual(requests, ['TestQuery', 'NestedQuery']);
    const initialRefs = [...references], initialFallbacks = fallbacks;
    revision++;
    await act(async () => { refresh(); });
    assert.deepEqual(requests, ['TestQuery', 'NestedQuery', 'TestQuery', 'NestedQuery']);
    assert.equal(mounts, 1);
    assert.equal(fallbacks, initialFallbacks);
    assert.ok(initialRefs.every(ref => ref.isDisposed));
    assert.ok([...references].filter(ref => !ref.isDisposed).every(ref => ref.fetchPolicy === 'network-only'));
    assert.equal(new Set([...references].map(ref => ref.fetchKey)).size, references.size);
    const committed = document.querySelector('article').textContent;
    asynchronous = true; revision++;
    await act(async () => { refresh(); });
    assert.equal(document.querySelector('article').textContent, committed);
    assert.equal(fallbacks, initialFallbacks);
    await act(async () => { waiting.forEach(finish => finish()); });
    assert.equal(document.querySelector('article').textContent, 'v2v2');
    assert.equal(mounts, 1);
  } finally {
    await act(async () => { root.unmount(); });
    assert.ok([...references].every(ref => ref.isDisposed));
    t.mock.timers.tick(300_001); t.mock.timers.reset();
    dom.window.close(); globalThis.window = previous.window; globalThis.document = previous.document; globalThis.IS_REACT_ACT_ENVIRONMENT = previous.act;
  }
});


test('context updates preserve unowned repeated keys and remove owned collections', async () => {
  const { defineRoute } = await import(pathToFileURL(`${process.env.TSQUID_TEST_BUILD}/entrypoint.mjs`));
  const { createRouteContextRegistry } = await import(pathToFileURL(`${process.env.TSQUID_TEST_BUILD}/context.mjs`));
  const { MemoryRouter } = await import('react-router');
  const { RelayEnvironmentProvider } = await import('react-relay');
  const registry = createRouteContextRegistry();
  const context = registry.forRoute('Test');
  const definition = defineRoute({ uri: route, context, getRouteType: input => input, entryPoint: parent });
  const { environment } = setup();
  let observed;
  function Probe() {
    observed = context.useRoute().updateURI({ tags: undefined, filter: undefined, enabled: false });
    return null;
  }
  renderToString(createElement(MemoryRouter, { initialEntries: ['/tutorials/1/a?filter=old&tags=x&tags=y&utm=abc&utm=xyz#notes'] },
    createElement(RelayEnvironmentProvider, { environment }, createElement(definition.Root, { fallback: createElement(Probe) }))));
  assert.equal(observed, '/tutorials/1/a?enabled=false&utm=abc&utm=xyz#notes');
});

const { readInitialData, withInitialData } = await import(pathToFileURL(`${process.env.TSQUID_TEST_BUILD}/initialData.mjs`));
const { fetchQuery, createOperationDescriptor } = await import('relay-runtime');
// Relay sends declared variables only: defaults filled in, null when unset.
const argumentDefinitions = [{ kind: 'LocalArgument', name: 'id', defaultValue: null }, { kind: 'LocalArgument', name: 'b', defaultValue: null },
  { kind: 'LocalArgument', name: 'a', defaultValue: null }, { kind: 'LocalArgument', name: 'first', defaultValue: 10 }];
const variableQuery = { ...query, operation: { ...query.operation, name: 'VariableQuery', argumentDefinitions },
  params: { ...query.params, name: 'VariableQuery', cacheID: 'variable' } };
function initialEnvironment(responses, options) {
  const requests = [];
  const network = Network.create(withInitialData((request, variables) => { requests.push([request.name, variables]); return { data: { hello: 'network' } }; },
    { version: 1, responses }, options));
  return { environment: new Environment({ network, store: new Store(new RecordSource()) }), requests };
}
function fetchSync(environment, request, variables) {
  let result;
  fetchQuery(environment, request, variables, { fetchPolicy: 'network-only' }).subscribe({ next: data => { result = data; } });
  return result;
}

test('initial data answers matching requests once, synchronously, ignoring key order', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { environment, requests } = initialEnvironment([
    { operation: 'TestQuery', variables: {}, response: { data: { hello: 'server' } } },
    { operation: 'VariableQuery', variables: { first: 10, b: { y: 2, x: 1 }, a: [1] }, response: { data: { hello: 'variables' } } },
  ]);
  assert.deepEqual(fetchSync(environment, query, {}), { hello: 'server' });
  assert.deepEqual(fetchSync(environment, variableQuery, { a: [1], b: { x: 1, y: 2 } }), { hello: 'variables' });
  assert.deepEqual(requests, []);
  assert.deepEqual(fetchSync(environment, query, {}), { hello: 'network' });
  assert.deepEqual(requests, [['TestQuery', {}]]);
  t.mock.timers.reset();
});

test('initial data falls through on misses and expires after boot, warning when asked', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const warn = t.mock.method(console, 'warn', () => {});
  const { environment, requests } = initialEnvironment([
    { operation: 'VariableQuery', variables: { id: '1', first: 10, a: null }, response: { data: { hello: 'server' } } },
    { operation: 'TestQuery', variables: {}, response: { data: { hello: 'late' } } },
  ], { warn: true });
  assert.deepEqual(fetchSync(environment, variableQuery, { id: '2' }), { hello: 'network' });
  assert.equal(warn.mock.calls[0].arguments[0], 'tsquid-data: no response for VariableQuery {"first":10,"id":"2"}');
  t.mock.timers.tick(0);
  assert.deepEqual(warn.mock.calls.slice(1).map(call => call.arguments[0]).sort(), ['tsquid-data: unused response for TestQuery {}', 'tsquid-data: unused response for VariableQuery {"first":10,"id":"1"}']);
  assert.deepEqual(fetchSync(environment, query, {}), { hello: 'network' });
  assert.equal(requests.length, 2);
  assert.equal(warn.mock.callCount(), 3);
  t.mock.timers.reset();
});

test('initial data is optional, read from #tsquid-data, and rejected when malformed', (t) => {
  const fetchFn = () => ({ data: {} });
  assert.equal(withInitialData(fetchFn, null), fetchFn);
  assert.throws(() => withInitialData(fetchFn, { version: 1, responses: [
    { operation: 'A', variables: { x: 1, y: 2 }, response: {} }, { operation: 'A', variables: { y: 2, x: 1 }, response: {} },
  ] }), /Duplicate/);
  assert.equal(readInitialData(), null);
  const elements = {};
  globalThis.document = { getElementById: id => elements[id] ?? null };
  t.after(() => { delete globalThis.document; });
  assert.equal(readInitialData(), null);
  const data = { version: 1, responses: [{ operation: 'A', variables: {}, response: { data: null } }] };
  elements['tsquid-data'] = { textContent: JSON.stringify(data) };
  assert.deepEqual(readInitialData(), data);
  for (const invalid of [{}, { version: 2, responses: [] }, { version: 1, responses: [{ operation: 'A', variables: [], response: {} }] }, { version: 1, responses: [{ operation: 'A', variables: {} }] }]) {
    elements['tsquid-data'] = { textContent: JSON.stringify(invalid) };
    assert.throws(() => readInitialData(), /Invalid #tsquid-data/);
  }
});

// The server integration skill's vectors must describe what the client actually does:
// React Router picks the route, then tsquid parses it; a parse error means no route.
// A route query's server variables must match what Relay sends for the parsed input.
const vectors = JSON.parse((await import('node:fs')).readFileSync(new URL('../../../skills/tsquid-server-integration/vectors.json', import.meta.url), 'utf8'));
const vectorRoutes = await import(pathToFileURL(`${process.env.TSQUID_TEST_BUILD}/vectors.mjs`));
test('server integration vectors match client routing, parsing and variable matching', async (t) => {
  t.mock.method(console, 'warn', () => {});
  const { matchRoutes } = await import('react-router');
  const routes = vectors.manifest.routes.map(route => ({ id: route.name, path: route.path, uri: createURI(route.path, Object.fromEntries(
    Object.entries(route.fields).map(([key, { kind, optional }]) => [key, { kind, optional }]))) }));
  for (const { url, route: expected, input } of vectors.urls) {
    const [pathname, search = ''] = url.split('?');
    const match = matchRoutes(routes, { pathname, search: search && `?${search}` })?.at(-1)?.route;
    let actual = null;
    try { actual = match ? { route: match.id, input: match.uri.parseURI(url) } : null; } catch { actual = null; }
    assert.deepEqual(actual, expected === null ? null : { route: expected, input }, url);
    const query = vectors.manifest.routes.find(route => route.name === expected)?.query;
    if (!query) continue;
    const server = {};
    for (const [name, { input: field, default: value }] of Object.entries(query.variables)) {
      if (field !== undefined && input[field] !== undefined) server[name] = input[field];
      else if (value !== undefined) server[name] = value;
    }
    assert.deepEqual(server, vectors.urls.find(vector => vector.url === url).variables, url);
    const generated = vectorRoutes[`${expected}RouteQuery`].getVariables(actual.input);
    assert.deepEqual(Object.fromEntries(Object.entries(generated).filter(([, value]) => value !== null)), server, url);
    const argumentDefinitions = Object.entries(query.variables).map(([name, { default: value }]) => ({ kind: 'LocalArgument', name, defaultValue: value ?? null }));
    const request = { ...variableQuery, operation: { ...variableQuery.operation, name: query.operation, argumentDefinitions }, params: { ...variableQuery.params, name: query.operation, cacheID: query.id } };
    const sent = createOperationDescriptor(request, input).request.variables;
    assert.deepEqual(generated, sent, `${url}: generated variables match Relay`);
    const response = { data: {} };
    const fetchFn = withInitialData(() => null, { version: 1, responses: [{ operation: query.operation, variables: server, response }] });
    assert.equal(fetchFn({ name: query.operation }, sent), response, `${url}: Relay sends ${JSON.stringify(sent)}`);
  }
  for (const { client, server, match } of vectors.variables) {
    const response = { data: {} };
    const fetchFn = withInitialData(() => null, { version: 1, responses: [{ operation: 'Q', variables: server, response }] });
    assert.equal(fetchFn({ name: 'Q' }, client) === response, match, JSON.stringify({ client, server }));
  }
});
