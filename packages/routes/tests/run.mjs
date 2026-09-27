import ts from 'typescript';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const build = mkdtempSync(join(root, '.test-'));
try {
  for (const file of ['uri.ts', 'context.tsx', 'entrypoint.tsx']) {
    const code = ts.transpileModule(readFileSync(join(root, 'runtime', file), 'utf8'), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX },
    }).outputText;
    writeFileSync(join(build, file.replace(/\.tsx?$/, '.mjs')), code);
  }
  const generated = ts.transpileModule(readFileSync(join(root, 'tests/routes.generated.ts'), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText.replaceAll('../runtime/uri', './uri.mjs').replaceAll('../runtime/context', './context.mjs');
  writeFileSync(join(build, 'routes.mjs'), generated);
  const result = spawnSync(process.execPath, ['--test', join(root, 'tests/runtime.test.mjs')], {
    stdio: 'inherit', env: { ...process.env, TSQUID_TEST_BUILD: build },
  });
  process.exitCode = result.status ?? 1;
} finally { rmSync(build, { recursive: true, force: true }); }
