#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { buildClientSchema, buildSchema, getIntrospectionQuery, lexicographicSortSchema, printSchema } from 'graphql';

try {
  const [command, ...args] = process.argv.slice(2);
  let endpoint = process.env.GRAPHQL_SCHEMA_ENDPOINT ?? (process.env.BASE_URL ? new URL('/graphql', process.env.BASE_URL).href : 'http://localhost:4000/graphql');
  let output = 'schema.graphql';
  let positional = false;
  if (!['fetch', 'check'].includes(command)) throw usage();
  for (let index = 0; index < args.length; index++) {
    if (args[index] === '--endpoint' && args[index + 1]) endpoint = args[++index];
    else if (args[index] === '--out' && command === 'fetch' && args[index + 1]) output = args[++index];
    else if (!args[index].startsWith('-') && command === 'check' && !positional) { output = args[index]; positional = true; }
    else throw usage();
  }
  const response = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query: getIntrospectionQuery() }) });
  if (!response.ok) throw new Error(`Introspection failed (${response.status} ${response.statusText})`);
  const { data, errors } = await response.json();
  if (errors?.length) throw new Error(`Introspection failed: ${errors.map(error => error.message).join(' ')}`);
  const remote = normalize(buildClientSchema(data));
  if (command === 'fetch') {
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, remote);
    console.log(`Wrote ${output}`);
  } else {
    const local = normalize(buildSchema(readFileSync(output, 'utf8')));
    if (local !== remote) {
      const oldLines = new Set(local.split('\n')), newLines = new Set(remote.split('\n'));
      const removed = [...oldLines].filter(line => !newLines.has(line)), added = [...newLines].filter(line => !oldLines.has(line));
      throw new Error(`Schema differs: ${output} (${removed.length} removed, ${added.length} added lines)\n${[...removed.slice(0, 8).map(line => `- ${line}`), ...added.slice(0, 8).map(line => `+ ${line}`)].join('\n')}`);
    }
    console.log(`Schema matches: ${output}`);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}

function normalize(schema) { return printSchema(lexicographicSortSchema(schema)) + '\n'; }
function usage() { return new Error('Usage: tsquid-schema fetch [--endpoint URL] [--out schema.graphql] | check [--endpoint URL] [schema.graphql]'); }
