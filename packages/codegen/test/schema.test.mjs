import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { buildSchema, graphqlSync, lexicographicSortSchema, printSchema } from 'graphql';

const CLI = fileURLToPath(new URL('../bin/tsquid-schema.mjs', import.meta.url));
test('schema fetch and check normalize SDL and report drift and introspection failures', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'tsquid-schema-'));
  let requestedPath;
  let schema = buildSchema('type Query { zebra: String apple: String }'), fail = false;
  const server = createServer(async (request, response) => {
    requestedPath = request.url;
    let body = '';
    for await (const chunk of request) body += chunk;
    const { query } = JSON.parse(body);
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify(fail ? { errors: [{ message: 'introspection disabled' }] } : graphqlSync({ schema, source: query })));
  });
  await new Promise(resolve => { server.listen(0, '127.0.0.1', resolve); });
  const endpoint = `http://127.0.0.1:${server.address().port}/graphql`;
  const run = (args, env = {}) => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [CLI, ...args], { cwd: dir, env: { ...process.env, GRAPHQL_SCHEMA_ENDPOINT: endpoint, ...env } });
    let stdout = '', stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk; }); child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', reject); child.on('close', status => { resolve({ status, stdout, stderr }); });
  });
  try {
    assert.equal((await run(['fetch', '--endpoint', endpoint, '--out', 'nested/schema.graphql'])).status, 0);
    assert.equal(readFileSync(join(dir, 'nested/schema.graphql'), 'utf8'), printSchema(lexicographicSortSchema(schema)) + '\n');
    writeFileSync(join(dir, 'local.graphql'), 'type Query { zebra: String apple: String }');
    assert.equal((await run(['check', 'local.graphql'])).status, 0);
    writeFileSync(join(dir, 'server.graphql'), 'type Query { apple: String zebra: String }');
    assert.equal((await run(['check', '--from', 'server.graphql', 'local.graphql'])).status, 0);
    assert.match((await run(['check', '--from', 'server.graphql', '--endpoint', endpoint])).stderr, /mutually exclusive/);
    assert.match((await run(['fetch', '--from', 'server.graphql'])).stderr, /Usage/);
    assert.equal((await run(['check', 'local.graphql'], { GRAPHQL_SCHEMA_ENDPOINT: undefined, BASE_URL: endpoint.replace('/graphql', '/api') })).status, 0);
    assert.equal(requestedPath, '/api/graphql');
    assert.equal((await run(['check', 'local.graphql'], { GRAPHQL_SCHEMA_ENDPOINT: undefined, BASE_URL: endpoint.replace('/graphql', '/api/') })).status, 0);
    assert.equal(requestedPath, '/api/graphql');
    writeFileSync(join(dir, 'server.graphql'), 'type Query { apple: String zebra: String added: Int }');
    const fileDrift = await run(['check', '--from', 'server.graphql', 'local.graphql']);
    assert.equal(fileDrift.status, 1); assert.match(fileDrift.stderr, /Schema differs/);
    schema = buildSchema('type Query { zebra: String apple: String added: Int }');
    const drift = await run(['check', 'local.graphql']);
    assert.equal(drift.status, 1); assert.match(drift.stderr, /Schema differs.*\n\+.*added: Int/);
    fail = true;
    const error = await run(['fetch']);
    assert.equal(error.status, 1); assert.match(error.stderr, /introspection disabled/);
    assert.match((await run(['check', '--out', 'bad'])).stderr, /Usage/);
  } finally {
    await new Promise(resolve => { server.close(resolve); });
    rmSync(dir, { recursive: true, force: true });
  }
});
