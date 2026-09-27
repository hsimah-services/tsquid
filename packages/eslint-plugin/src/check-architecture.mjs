import fs from 'node:fs';
import path from 'node:path';
import { parse } from '@typescript-eslint/parser';

const SOURCE_EXTENSION = /\.[cm]?[jt]sx?$/;
const pascal = (name) => name.split(/[-_]/).map((part) => part[0].toUpperCase() + part.slice(1)).join('');

// Pure graph check: the CLI reads files once; tests supply an in-memory project.
export function auditArchitecture(files, componentsRoot) {
  const issues = [];
  const documentedBoundaries = new Set();
  const consumers = new Map([...files.keys()].map((filename) => [filename, new Set()]));
  const report = (file, node, message) => issues.push({ file, line: node?.loc?.start.line ?? 1, message });
  const info = (filename) => {
    const relative = path.relative(componentsRoot, filename);
    if (relative.startsWith('..') || path.isAbsolute(relative)) return null;
    const parts = relative.split(path.sep);
    return { entity: parts[0], section: parts.length > 2 ? parts[1] : null, parts };
  };
  const resolve = (filename, request) => {
    const base = path.resolve(path.dirname(filename), request);
    return [base, ...['.ts', '.tsx', '.js', '.jsx'].map((extension) => base + extension),
      ...['/index.ts', '/index.tsx', '/index.js', '/index.jsx'].map((suffix) => base + suffix),
      ...['.ts', '.tsx'].map((extension) => base.replace(/\.jsx?$/, '') + extension)].find((candidate) => files.has(candidate));
  };
  for (const [filename, code] of files) {
    const current = info(filename);
    let ast;
    try {
      ast = parse(code, { loc: true, comment: true, range: true, ecmaFeatures: { jsx: true }, sourceType: 'module' });
    } catch (error) {
      report(filename, null, `Cannot check architecture: ${error.message}`);
      continue;
    }
    if (ast.comments.some((comment) => comment.type === 'Block'
      && /^\*/.test(comment.value) && /@module-boundary\s+[^\r\n*][^\r\n]+/.test(comment.value)
      && comment.range[1] <= (ast.body[0]?.range[0] ?? Infinity))) documentedBoundaries.add(filename);
    if (current) {
      if (current.parts.length < 2) report(filename, null, 'Place components inside an entity directory.');
      if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(current.entity)) report(filename, null, 'Entity directories use lowercase kebab-case.');
      if (current.parts.length === 2 && !/^index\.[jt]s$/.test(path.basename(filename)) && !path.basename(filename).startsWith(pascal(current.entity))) {
        report(filename, null, `Public modules must start with ${pascal(current.entity)} and expose the entity API.`);
      }
      if (current.section && current.section !== '__private__') {
        const owner = path.join(componentsRoot, current.entity, pascal(current.entity) + pascal(current.section));
        if (!['.tsx', '.ts', '.jsx', '.js'].some((extension) => files.has(owner + extension))) {
          report(filename, null, `Folder ${current.section}/ needs its top-level owner ${path.basename(owner)}.`);
        }
      }
    }
    const references = [];
    function visit(node) {
      if (!node || typeof node !== 'object') return;
      if (['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration', 'ImportExpression', 'TSImportType'].includes(node.type)) {
        const source = node.source ?? node.argument;
        if (typeof source?.value === 'string') references.push({ node, request: source.value });
        else if (node.type === 'ImportExpression' && source?.type === 'TemplateLiteral' && source.expressions.length === 0) references.push({ node, request: source.quasis[0].value.cooked });
        else if (node.type === 'ImportExpression') report(filename, node, 'Use a literal import path so entity boundaries can be checked.');
      }
      if (node.type === 'CallExpression' && node.callee?.name === 'require') report(filename, node, 'Use ES module imports so entity boundaries can be checked.');
      for (const [key, value] of Object.entries(node)) {
        if (['loc', 'range', 'tokens', 'comments'].includes(key)) continue;
        if (Array.isArray(value)) value.forEach(visit);
        else if (value && typeof value === 'object') visit(value);
      }
    }
    visit(ast);
    const barrel = path.basename(filename) === 'index.ts' && current;
    if (barrel && ast.body.some((node) => node.type !== 'ExportNamedDeclaration' || !node.source)) {
      report(filename, null, 'Entity barrels may only explicitly re-export public modules.');
    }
    for (const { node, request } of references) {
      if (!request.startsWith('.')) {
        if (request.startsWith('@/') || request.startsWith('~/') || request.startsWith('/') || request.startsWith('src/')) report(filename, node, 'Use relative local imports; the architecture checker does not allow project aliases.');
        continue;
      }
      const target = resolve(filename, request);
      if (!target) {
        if (!request.includes('__generated__') && !/\.(css|svg|png|jpe?g|webp|json)$/.test(request)) report(filename, node, `Cannot resolve local module ${request}.`);
        continue;
      }
      consumers.get(target).add(filename);
      const destination = info(target);
      if (!destination) continue;
      if (destination.section && (current?.entity !== destination.entity || barrel)) {
        report(filename, node, `Import ${destination.entity}'s public module instead of its internal ${destination.section}/ implementation.`);
      } else if (destination.section && destination.section !== '__private__') {
        const ownerName = pascal(destination.entity) + pascal(destination.section);
        const owner = !current?.section && path.basename(filename).replace(SOURCE_EXTENSION, '') === ownerName;
        if (!owner && current?.section !== destination.section) report(filename, node, `Only ${ownerName} and its ${destination.section}/ modules may import this implementation.`);
      }
    }
  }
  for (const filename of files.keys()) {
    const current = info(filename);
    if (!current?.section) continue;
    const count = consumers.get(filename).size;
    const mutation = /^use[A-Z].*Mutation\.ts$/.test(path.basename(filename));
    const documentedBoundary = documentedBoundaries.has(filename);
    if (count < 2 && !mutation && !documentedBoundary) {
      report(filename, null, `Internal module has ${count} consumer(s). Inline it in its owner, or document a substantial boundary with /** @module-boundary Reason. */. Relay mutation hooks are exempt.`);
    }
    if (current.section === '__private__' && count < 2 && !mutation) {
      report(filename, null, '__private__/ is shared: move this single-owner module into its owner or feature folder.');
    }
  }
  return issues;
}

export function readSources(directory, files = new Map()) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === '__generated__' || entry.name === 'node_modules') continue;
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) readSources(filename, files);
    else if (SOURCE_EXTENSION.test(filename) && !/\.(test|spec)\.[jt]sx?$/.test(filename) && !filename.endsWith('.d.ts')) files.set(filename, fs.readFileSync(filename, 'utf8'));
  }
  return files;
}

