import path from 'node:path';

const SHOUTING_SNAKE_CASE = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/;
const FUNCTIONS = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression']);
const unwrap = (node) => node.declaration ?? node;
const stem = (filename) => path.basename(filename).replace(/\.entrypoint\.ts$/, 'EntryPoint').replace(/\.[^.]+$/, '');
const shouting = (name) => name.replace(/([a-z0-9])([A-Z])/g, '$1_$2').replace(/([A-Z])([A-Z][a-z])/g, '$1_$2').toUpperCase();
const meta = (description, messages, fixable) => ({ type: 'suggestion', docs: { description }, schema: [], messages, ...(fixable ? { fixable: 'code' } : {}) });

function walk(node, source, visit) {
  if (!node) return;
  visit(node);
  for (const key of source.visitorKeys[node.type] ?? []) {
    const child = node[key];
    for (const item of Array.isArray(child) ? child : [child]) if (item?.type) walk(item, source, visit);
  }
}

function importedName(source, node, from) {
  if (node?.type === 'Identifier') {
    let scope = source.getScope(node);
    while (scope) {
      const variable = scope.set.get(node.name);
      if (variable) {
        const definition = variable.defs[0];
        if (definition?.type !== 'ImportBinding' || definition.parent.source.value !== from) return null;
        return definition.node.imported?.name ?? (definition.node.type === 'ImportNamespaceSpecifier' ? '*' : 'default');
      }
      scope = scope.upper;
    }
  }
  if (node?.type === 'MemberExpression' && !node.computed && ['*', 'default'].includes(importedName(source, node.object, from))) {
    return node.property.name;
  }
  return null;
}

function isStyles(node, source) {
  const declaration = unwrap(node);
  return declaration.type === 'VariableDeclaration' && declaration.declarations.some((item) =>
    item.init?.type === 'CallExpression' && importedName(source, item.init.callee, '@stylexjs/stylex') === 'create');
}

function functionOf(node) {
  const declaration = unwrap(node);
  if (FUNCTIONS.has(declaration.type)) return declaration;
  if (declaration.type === 'VariableDeclaration' && declaration.declarations.length === 1) {
    const init = declaration.declarations[0].init;
    if (FUNCTIONS.has(init?.type)) return init;
    if (init?.type === 'CallExpression') return init.arguments.find((argument) => FUNCTIONS.has(argument.type));
  }
  return null;
}

function declarationName(node) {
  const declaration = unwrap(node);
  return declaration.id?.name ?? declaration.declarations?.[0]?.id?.name;
}

function isComponent(node) {
  return /^[A-Z][a-zA-Z0-9]*_?[a-zA-Z0-9]*$/.test(declarationName(node) ?? '') && !!functionOf(node);
}

function isExported(program, name) {
  return program.body.some((node) => node.type.startsWith('Export') &&
    (declarationName(node) === name || node.specifiers?.some((item) => item.local?.name === name)));
}

// Rename bindings, never text: preserve shadowed variables, object keys, and API exports.
function renameFix(source, declaration, id, replacement) {
  if (source.ast.body.some((node) => node.type === 'ExportDefaultDeclaration') || isExported(source.ast, id.name)) return null;
  const variable = source.getDeclaredVariables(declaration).find((item) => item.name === id.name);
  if (!variable || source.scopeManager.scopes.some((scope) => scope.set.has(replacement))) return null;
  if (source.ast.tokens.some((token) => token.value === 'eval')) return null;
  const identifiers = new Map([[id.range[0], id]]);
  for (const reference of variable.references) identifiers.set(reference.identifier.range[0], reference.identifier);
  walk(source.ast, source, (node) => {
    if (node.type !== 'JSXIdentifier' || node.name !== id.name) return;
    if (node.parent.type === 'JSXAttribute' || (node.parent.type === 'JSXMemberExpression' && node.parent.property === node)) return;
    let scope = source.getScope(node);
    while (scope && !scope.set.has(id.name)) scope = scope.upper;
    if (scope?.set.get(id.name) === variable) identifiers.set(node.range[0], node);
  });
  return (fixer) => [...identifiers.values()].map((node) => fixer.replaceTextRange(source.getFirstToken(node).range,
    node.parent.type === 'Property' && node.parent.shorthand ? `${id.name}: ${replacement}` : replacement));
}

function rank(node, source) {
  if (node.type === 'ImportDeclaration') return 0;
  if (isStyles(node, source)) return 4;
  if (node.type.startsWith('Export')) return 2;
  if (node.type === 'VariableDeclaration' && !functionOf(node)) return 1;
  return 3;
}

function isHoisted(node) {
  const declaration = unwrap(node);
  return ['FunctionDeclaration', 'TSInterfaceDeclaration', 'TSTypeAliasDeclaration', 'ImportDeclaration', 'ExportAllDeclaration'].includes(declaration.type)
    || (node.type === 'ExportNamedDeclaration' && !node.declaration);
}

export const rules = {
  'module-order': {
    meta: meta('Order imports, constants, exports, local helpers, then StyleX styles.', {
      order: 'Use module order: imports → constants → exports → local helpers/types → StyleX styles.',
    }, true),
    create(context) {
      const source = context.sourceCode;
      return { 'Program:exit'(program) {
        const sorted = [...program.body].sort((a, b) => rank(a, source) - rank(b, source));
        const first = program.body.findIndex((node, index) => node !== sorted[index]);
        if (first < 0) return;
        // Reordering eager initialization can introduce TDZ failures. Only move hoisted
        // declarations around it. Comments/directives require manual placement.
        const runtime = program.body.filter((node) => !isHoisted(node));
        const safe = source.getAllComments().length === 0
          && !program.body.some((node) => node.type === 'ExpressionStatement')
          && sorted.filter((node) => !isHoisted(node)).every((node, index) => node === runtime[index]);
        context.report({ node: program.body[first], messageId: 'order',
          fix: safe ? (fixer) => fixer.replaceTextRange([program.body[0].range[0], program.body.at(-1).range[1]], sorted.map((node) => source.getText(node)).join('\n\n')) : null });
      } };
    },
  },
  'constant-names': {
    meta: meta('Name module constants in SHOUTING_SNAKE_CASE.', {
      name: 'Module constant {{name}} must be {{expected}}.',
      declaration: 'Module data must use named const declarations; keep mutable state inside hooks.',
    }, true),
    create(context) {
      const source = context.sourceCode;
      return { 'Program:exit'(program) {
        for (const statement of program.body) {
          const declaration = unwrap(statement);
          if (declaration.type !== 'VariableDeclaration' || isStyles(statement, source) || functionOf(statement)) continue;
          for (const item of declaration.declarations) {
            if (declaration.kind !== 'const' || item.id.type !== 'Identifier') {
              context.report({ node: item, messageId: 'declaration' });
            } else if (!SHOUTING_SNAKE_CASE.test(item.id.name)) {
              const expected = shouting(item.id.name);
              context.report({ node: item.id, messageId: 'name', data: { name: item.id.name, expected }, fix: renameFix(source, declaration, item.id, expected) });
            }
          }
        }
      } };
    },
  },
  'module-exports': {
    meta: meta('Align named exports with the filename.', {
      name: 'Export {{name}} must match {{module}} or a related name such as {{module}}Props.',
      default: 'Use a named export matching the module; default and star exports obscure the public API.',
      primary: 'This module must export {{module}} (or its SHOUTING_SNAKE_CASE equivalent for data).',
    }),
    create(context) {
      const module = stem(context.filename);
      if (module === 'index') return {}; // Entity barrels are restricted to re-exports by architecture checks.
      const names = [];
      function check(node, name) {
        names.push(name);
        const suffix = name.startsWith(module) ? name.slice(module.length) : '';
        const matches = name === module || /^[A-Z][A-Za-z0-9]*$/.test(suffix)
          || name === shouting(module) || name.startsWith(`${shouting(module)}_`);
        if (!matches) context.report({ node, messageId: 'name', data: { name, module } });
      }
      return {
        ExportDefaultDeclaration(node) { context.report({ node, messageId: 'default' }); },
        ExportAllDeclaration(node) { context.report({ node, messageId: 'default' }); },
        ExportNamedDeclaration(node) {
          if (node.declaration?.type === 'VariableDeclaration') {
            for (const item of node.declaration.declarations) if (item.id.name) check(item.id, item.id.name);
          } else if (node.declaration?.id) check(node.declaration.id, node.declaration.id.name);
          for (const item of node.specifiers) check(item.exported, item.exported.name ?? item.exported.value);
        },
        'Program:exit'(node) {
          if (names.length && !names.includes(module) && !names.includes(shouting(module))) context.report({ node, messageId: 'primary', data: { module } });
        },
      };
    },
  },
  'local-component-names': {
    meta: meta('Prefix local components with their owning module.', {
      name: 'Local component {{name}} must be named {{expected}}.',
      nested: 'Declare local components at module scope so their identity survives renders.',
    }, true),
    create(context) {
      const source = context.sourceCode;
      const module = stem(context.filename);
      return { 'Program:exit'(program) {
        const declarations = [];
        walk(program, source, (node) => {
          if (['FunctionDeclaration', 'VariableDeclaration'].includes(node.type) && isComponent(node)) declarations.push(node);
        });
        for (const statement of declarations) {
          const name = declarationName(statement);
          if (!['Program', 'ExportNamedDeclaration', 'ExportDefaultDeclaration'].includes(statement.parent.type)) {
            context.report({ node: statement, messageId: 'nested' });
          }
          if (isExported(program, name) || name.startsWith(`${module}_`)) continue;
          const suffix = name.startsWith(module) ? name.slice(module.length) : name;
          const expected = `${module}_${suffix || 'Content'}`;
          const declaration = unwrap(statement);
          const id = declaration.id ?? declaration.declarations[0].id;
          context.report({ node: id, messageId: 'name', data: { name, expected }, fix: renameFix(source, declaration, id, expected) });
        }
      } };
    },
  },
  'render-only-components': {
    meta: meta('Put side effects, requests, and non-render transformations in hooks/helpers.', {
      effect: 'Move {{name}} into a local hook/helper; components should render from prepared state.',
      async: 'UI components must be synchronous; put async work in a hook/helper.',
      mutation: 'Relay mutations belong in a dedicated use…Mutation.ts module.',
    }),
    create(context) {
      const source = context.sourceCode;
      const componentFunctions = [];
      return {
        Program(node) {
          for (const statement of node.body) if (isComponent(statement)) componentFunctions.push(functionOf(statement));
        },
        'Program:exit'() {
          for (const fn of componentFunctions) {
            if (fn.async) context.report({ node: fn, messageId: 'async' });
            walk(fn.body, source, (node) => {
              if (node.type !== 'CallExpression') return;
              const react = importedName(source, node.callee, 'react');
              const relay = importedName(source, node.callee, 'react-relay');
              const runtime = importedName(source, node.callee, 'relay-runtime');
              const member = node.callee.type === 'MemberExpression' && !node.callee.computed ? node.callee.property.name : null;
              const globalCall = node.callee.type === 'Identifier' ? node.callee.name : null;
              const name = react ?? relay ?? runtime ?? member ?? globalCall;
              if (['useEffect', 'useLayoutEffect', 'useInsertionEffect'].includes(react)
                || ['commitMutation', 'requestSubscription', 'fetchQuery'].includes(relay ?? runtime)
                || ['fetch', 'setTimeout', 'setInterval', 'requestAnimationFrame'].includes(globalCall ?? member)
                || ['filter', 'reduce', 'flatMap', 'sort', 'toSorted'].includes(member)) {
                context.report({ node, messageId: 'effect', data: { name } });
              }
            });
          }
        },
        CallExpression(node) {
          const name = importedName(source, node.callee, 'react-relay') ?? importedName(source, node.callee, 'relay-runtime');
          if (['useMutation', 'commitMutation'].includes(name) && !/^use[A-Z].*Mutation\.ts$/.test(path.basename(context.filename))) {
            context.report({ node, messageId: 'mutation' });
          }
        },
      };
    },
  },
};

export default { rules };
