import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { Environment, Network, RecordSource, Store, Observable } from 'relay-runtime';

const { createURI } = await import(pathToFileURL(`${process.env.TSQUID_TEST_BUILD}/uri.mjs`));
const { preloadEntryPoint, resource } = await import(pathToFileURL(`${process.env.TSQUID_TEST_BUILD}/entrypoint.mjs`));
const route = createURI('/tutorials/:level/:id', {
  level: { kind: 'int', optional: false }, id: { kind: 'string', optional: false },
  filter: { kind: 'string', optional: true }, enabled: { kind: 'bool', optional: true },
  tags: { kind: 'string[]', optional: true }, counts: { kind: 'int[]', optional: true }, flags: { kind: 'bool[]', optional: true },
});

test('URI round trip includes encoded path values and primitive collections', () => {
  const input = { level: 0, id: 'a/b + 雪', filter: '', enabled: false, tags: ['a&b', '', 'a&b'], counts: [-2, 0], flags: [false, true] };
  assert.deepEqual(route.parseURI(route.getURI(input)), input);
});
test('update merges, removes undefined fields, preserves unowned state and hash', () => {
  assert.equal(route.updateURI('/tutorials/1/a?filter=old&tags=x&tags=y&utm=abc#notes', { filter: undefined, enabled: false }), '/tutorials/1/a?enabled=false&tags=x&tags=y&utm=abc#notes');
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
function setup() {
  let requests = 0, retains = 0, cancelled = 0;
  const environment = new Environment({ network: Network.create(() => Observable.create(() => { requests++; return () => cancelled++; })), store: new Store(new RecordSource()) });
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
