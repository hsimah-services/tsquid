# UI standards

Applies to handwritten code in `src/`. Generated artifacts are exempt.
`@tsquid/eslint-plugin` enforces the mechanical parts; review covers the rest.

## Entities

```text
components/
  article/                 # entity: kebab-case
    ArticlePage.tsx        # public: starts with the entity's PascalCase name
    ArticleDetail.tsx
    Article.entrypoint.ts
    detail/                # feature internals, owned by ArticleDetail
      usePublishArticleMutation.ts
    __private__/           # shared within the entity
      ArticleByline.tsx
```

- Other entities and `app/` import public modules only.
- A feature folder (`detail/`) is importable only by its owner (`ArticleDetail`)
  and by modules in that folder.
- `__private__/` is importable anywhere in its entity. It can't import feature
  internals.
- `index.ts` barrels may only re-export public modules explicitly.
- Relative imports only; no path aliases. Dynamic imports must use literal paths.

## Modules

Order:
1. imports;
2. local `SHOUTING_SNAKE_CASE` constants;
3. named exports;
4. local components, hooks, helpers and types;
5. `stylex.create`.

- Export the filename's name (or its `SHOUTING_SNAKE_CASE` form for data), plus
  related names: `ArticleDetail`, `ArticleDetailProps`, `ARTICLE_DETAIL_QUERY`.
- No default exports, star exports or unrelated exports.
- `<Name>.entrypoint.ts` exports `<Name>EntryPoint` and `<NAME>_ENTRY_POINT`. Use
  `createElement` there; page UI lives in `.tsx`.
- Local components are named `Owner_Part` (`ArticleDetail_Byline`) and declared
  at module scope.
- Module data is `const`, not destructured, and never mutable.

```tsx
import { Text } from '@astryxdesign/core';
import * as stylex from '@stylexjs/stylex';

const EMPTY_LABEL = 'No summary';

export interface ArticleDetailProps {
  summary: string | null;
}

export function ArticleDetail({ summary }: ArticleDetailProps) {
  return <ArticleDetail_Summary text={getSummaryLabel(summary)} />;
}

function ArticleDetail_Summary({ text }: { text: string }) {
  return <Text xstyle={styles.summary}>{text}</Text>;
}

function getSummaryLabel(summary: string | null) {
  return summary?.trim() || EMPTY_LABEL;
}

const styles = stylex.create({
  summary: { color: 'var(--color-text-secondary)' },
});
```

## Extraction

- Keep single-use components, hooks, helpers and types in their owner.
- Extract a module when it has two or more importing modules, or when it is a
  substantial boundary. A single-consumer boundary needs a comment before its
  imports: `/** @module-boundary <reason> */`.
- A `__private__/` module needs two or more consumers, even with a boundary comment.
- Relay mutations always go in their own `use<Operation>Mutation.ts`, even with
  one consumer.

## Components

- Components render prepared state. Effects, subscriptions, timers, requests,
  measurements, `filter`/`flatMap`/`reduce`/`sort`/`toSorted`, and complex
  handlers go in hooks or helpers.
- Components may read fragments and queries, call hooks, branch on display
  conditions, and `map` to JSX.
- Components are synchronous.

## Styling

- Use Astryx components for layout, and tokens (`var(--color-*)`,
  `var(--spacing-*)`) rather than raw values.
- Use StyleX: `stylex.props()` on DOM elements, `xstyle` on Astryx components.
  Dynamic StyleX entries handle measured geometry.
- No inline `style`, other CSS frameworks, or single-use stylesheets.

## Enforcement

```sh
pnpm lint       # eslint + tsquid-check-architecture
pnpm lint:fix   # safe fixes
```

| Check | Autofix |
| --- | --- |
| `tsquid/module-order` | Reorders when initialization order is preserved and no comments move |
| `tsquid/constant-names` | Scope-aware rename |
| `tsquid/local-component-names` | Scope-aware rename, including JSX |
| `tsquid/module-exports` | None |
| `tsquid/render-only-components` | None |
| `tsquid-check-architecture` | None |

- Renames refuse on collisions, exported bindings, default exports and `eval`.
- `src/main.tsx` is exempt from ordering, constant and local-component naming.
- No baselines. Don't weaken rules or add broad ignores: fix the structure, or
  document a narrow exception and add a test for it.
