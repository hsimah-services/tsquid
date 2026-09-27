import assert from 'node:assert/strict';
import { test } from 'node:test';
import { auditArchitecture } from '../src/check-architecture.mjs';

const root = '/project/src/components';
const audit = (entries) => auditArchitecture(new Map(Object.entries(entries).map(([name, code]) => [`/project/src/${name}`, code])), root);
const messages = (entries) => audit(entries).map((issue) => issue.message).join('\n');
const shared = {
  'components/tutorial/TutorialPage.tsx': 'import { Cover } from "./__private__/Cover";',
  'components/tutorial/TutorialDetail.tsx': 'import { Cover } from "./__private__/Cover";',
  'components/tutorial/__private__/Cover.tsx': 'export function Cover() { return null; }',
};

test('public entities can share internal modules and external callers use public files', () => {
  assert.deepEqual(audit({ ...shared, 'app/router.tsx': 'import { TutorialPage } from "../components/tutorial/TutorialPage";' }), []);
});
test('components cannot live outside entity directories', () => {
  assert.match(messages({ 'components/TutorialTile.tsx': 'export function TutorialTile() {}' }), /inside an entity/);
});
test('public names identify their entity', () => {
  assert.match(messages({ 'components/tutorial/Tile.tsx': 'export function Tile() {}' }), /must start with Tutorial/);
});
test('external imports cannot reach private modules through direct or dynamic paths', () => {
  for (const source of ['import "../components/tutorial/__private__/Cover";', 'const c = import("../components/tutorial/__private__/Cover");', 'type T = import("../components/tutorial/__private__/Cover").Props;']) {
    assert.match(messages({ ...shared, 'app/App.tsx': source }), /public module instead/);
  }
});
test('another entity cannot reach a private module', () => {
  assert.match(messages({ ...shared, 'components/home/HomePage.tsx': 'import "../tutorial/__private__/Cover";' }), /public module instead/);
});
test('barrels cannot leak private modules, even through re-exports', () => {
  assert.match(messages({ ...shared, 'components/tutorial/index.ts': 'export { Cover } from "./__private__/Cover";' }), /public module instead/);
});
test('public explicit barrels are supported', () => {
  assert.deepEqual(audit({ ...shared, 'components/tutorial/index.ts': 'export { TutorialPage } from "./TutorialPage";' }), []);
});
test('feature internals belong to an existing owner', () => {
  assert.match(messages({ 'components/tutorial/detail/LargePanel.tsx': '/** @module-boundary Large editor. */ export function LargePanel() {}' }), /needs its top-level owner/);
});
test('a documented larger single-owner feature module is valid', () => {
  assert.deepEqual(audit({
    'components/tutorial/TutorialDetail.tsx': 'import "./detail/LargePanel";',
    'components/tutorial/detail/LargePanel.tsx': '/** @module-boundary Self-contained editor with substantial keyboard navigation. */ export function LargePanel() {}',
  }), []);
});
test('small single-use modules should stay local even when imported twice by one file', () => {
  assert.match(messages({
    'components/tutorial/TutorialDetail.tsx': 'import { A } from "./detail/Small"; import type { B } from "./detail/Small";',
    'components/tutorial/detail/Small.tsx': 'export function Small() {}',
  }), /1 consumer/);
});
test('shared folder requires actual reuse even when a boundary is documented', () => {
  assert.match(messages({
    'components/tutorial/TutorialDetail.tsx': 'import "./__private__/Large";',
    'components/tutorial/__private__/Large.tsx': '/** @module-boundary Large editor. */ export function Large() {}',
  }), /__private__\/ is shared/);
});
test('mutation hooks are exempt from single-use checks', () => {
  assert.deepEqual(audit({
    'components/tutorial/TutorialDetail.tsx': 'import "./detail/useUnlockTutorialMutation";',
    'components/tutorial/detail/useUnlockTutorialMutation.ts': 'export function useUnlockTutorialMutation() {}',
  }), []);
});
test('feature internals cannot be imported by a sibling public component', () => {
  assert.match(messages({
    'components/tutorial/TutorialDetail.tsx': 'import "./detail/LargePanel";',
    'components/tutorial/TutorialPage.tsx': 'import "./detail/LargePanel";',
    'components/tutorial/detail/LargePanel.tsx': 'export function LargePanel() {}',
  }), /Only TutorialDetail/);
});
test('feature internals cannot be imported from shared modules', () => {
  assert.match(messages({
    'components/tutorial/TutorialDetail.tsx': 'import "./detail/LargePanel";',
    'components/tutorial/__private__/Shared.ts': 'import "../detail/LargePanel";',
    'components/tutorial/detail/LargePanel.tsx': 'export function LargePanel() {}',
  }), /Only TutorialDetail/);
});
test('generated imports and CSS are excluded without hiding missing source modules', () => {
  assert.deepEqual(audit({ 'components/tutorial/TutorialPage.tsx': 'import Q from "./__generated__/TutorialPageQuery.graphql"; import "../../styles/global.css";' }), []);
  assert.match(messages({ 'components/tutorial/TutorialPage.tsx': 'import "./Missing";' }), /Cannot resolve/);
});
test('aliases and variable dynamic imports cannot bypass boundaries', () => {
  assert.match(messages({ 'app/App.tsx': 'import "@/components/tutorial/__private__/Cover";' }), /relative local imports/);
  assert.match(messages({ 'app/App.tsx': 'const module = import(name);' }), /literal import path/);
});
test('relative JavaScript extensions resolve TypeScript sources', () => {
  assert.deepEqual(audit({ ...shared, 'app/App.tsx': 'import "../components/tutorial/TutorialPage.js";' }), []);
});
