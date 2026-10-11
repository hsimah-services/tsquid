import ts from 'typescript';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { generate } from '../../codegen/index.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const build = mkdtempSync(join(root, '.test-'));
try {
  for (const file of ['uri.ts', 'context.tsx', 'entrypoint.tsx', 'initialData.ts', 'Link.tsx', 'network.ts', 'mutation.ts']) {
    const code = ts.transpileModule(readFileSync(join(root, 'runtime', file), 'utf8'), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX },
    }).outputText.replaceAll("'./uri.js'", "'./uri.mjs'");
    writeFileSync(join(build, file.replace(/\.tsx?$/, '.mjs')), code);
  }
  const generated = ts.transpileModule(readFileSync(join(root, 'tests/routes.generated.ts'), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText.replaceAll('../runtime/uri', './uri.mjs').replaceAll('../runtime/context', './context.mjs');
  writeFileSync(join(build, 'routes.mjs'), generated);
  const vectors = JSON.parse(readFileSync(new URL('../../../skills/tsquid-server-integration/vectors.json', import.meta.url), 'utf8'));
  const config = { runtime: '../runtime', persistedQueries: 'p.json', routes: vectors.manifest.routes.map(({ name, path, ssr, fields, query }) => ({
    name, path, ssr, entryPoint: `${name}.entrypoint.ts`, fields: Object.fromEntries(Object.entries(fields).map(([name, { kind, optional }]) => [name, { kind, optional }])), ...(query && { query: query.operation }),
  })) };
  const persisted = Object.fromEntries(vectors.manifest.routes.filter(route => route.query).map(({ query }) => [query.id, query.text]));
  const vectorModule = ts.transpileModule(generate(JSON.stringify(config), JSON.stringify(persisted)), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText.replaceAll('../runtime/uri', './uri.mjs').replaceAll('../runtime/context', './context.mjs');
  writeFileSync(join(build, 'vectors.mjs'), vectorModule);
  const result = spawnSync(process.execPath, ['--test', join(root, 'tests/runtime.test.mjs')], {
    stdio: 'inherit', env: { ...process.env, TSQUID_TEST_BUILD: build },
  });
  process.exitCode = result.status ?? 1;
} finally { rmSync(build, { recursive: true, force: true }); }
