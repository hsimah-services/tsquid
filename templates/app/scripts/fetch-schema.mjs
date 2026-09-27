#!/usr/bin/env node
// Introspects a GraphQL endpoint and writes schema.graphql, which relay-compiler
// needs to type its generated artifacts. Re-run it whenever the API changes.
import { writeFileSync } from 'node:fs';
import { getIntrospectionQuery, buildClientSchema, printSchema } from 'graphql';

const endpoint = process.env.GRAPHQL_SCHEMA_ENDPOINT ?? 'http://localhost:4000/graphql';

const response = await fetch(endpoint, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ query: getIntrospectionQuery() }),
});

if (!response.ok) {
  console.error(`Introspection request to ${endpoint} failed: ${response.status} ${response.statusText}`);
  process.exit(1);
}

const { data, errors } = await response.json();

if (errors) {
  console.error(errors);
  process.exit(1);
}

const outFile = new URL('../schema.graphql', import.meta.url);
writeFileSync(outFile, printSchema(buildClientSchema(data)));
console.log(`Wrote ${outFile.pathname} from ${endpoint}`);
