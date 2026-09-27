import { describe, it } from 'node:test';
import { RuleTester } from 'eslint';
import parser from '@typescript-eslint/parser';
import { rules } from '../src/rules.mjs';

RuleTester.describe = describe;
RuleTester.it = it;
const tester = new RuleTester({ languageOptions: { parser, ecmaVersion: 'latest', sourceType: 'module', parserOptions: { ecmaFeatures: { jsx: true } } } });
const filename = '/project/src/components/tutorial/TutorialDetail.tsx';
const wrap = (cases) => cases.map((test) => typeof test === 'string' ? { code: test, filename } : { filename, ...test });
const run = (name, valid, invalid) => tester.run(name, rules[name], { valid: wrap(valid), invalid: wrap(invalid) });

run('module-order', [
  'import x from "x"; const LIMIT = 1; export function TutorialDetail() {} function local() {}',
  'import * as stylex from "@stylexjs/stylex"; export type TutorialDetailProps = {}; export function TutorialDetail() {} const styles = stylex.create({});',
  'export function TutorialDetail() {} interface LocalProps {} function local() {}',
], [
  { code: 'function local() {} export function TutorialDetail() {}', output: 'export function TutorialDetail() {}\n\nfunction local() {}', errors: [{ messageId: 'order' }] },
  { code: 'import * as sx from "@stylexjs/stylex"; const styles = sx.create({}); export function TutorialDetail() {}', output: 'import * as sx from "@stylexjs/stylex";\n\nexport function TutorialDetail() {}\n\nconst styles = sx.create({});', errors: [{ messageId: 'order' }] },
  { code: 'import { create as makeStyles } from "@stylexjs/stylex"; const styles = makeStyles({}); export function TutorialDetail() {}', output: 'import { create as makeStyles } from "@stylexjs/stylex";\n\nexport function TutorialDetail() {}\n\nconst styles = makeStyles({});', errors: [{ messageId: 'order' }] },
  { code: 'export const TUTORIAL_DETAIL = init(); const LIMIT = read(TUTORIAL_DETAIL);', output: null, errors: [{ messageId: 'order' }] },
  { code: 'import * as stylex from "@stylexjs/stylex"; const styles = stylex.create({}); export const TUTORIAL_DETAIL = styles;', output: null, errors: [{ messageId: 'order' }] },
  { code: '// Keep this comment attached to its helper.\nfunction local() {}\nexport function TutorialDetail() {}', output: null, errors: [{ messageId: 'order' }] },
  { code: '"use client"; import React from "react"; export function TutorialDetail() {}', output: null, errors: [{ messageId: 'order' }] },
]);

run('constant-names', [
  'const PAGE_SIZE = 24; function useState() { const pageSize = 1; return pageSize; }',
  'const helper = () => 1; export const TutorialDetail = () => null;',
  'import * as sx from "@stylexjs/stylex"; const styles = sx.create({});',
  'import { create as styles } from "@stylexjs/stylex"; const localStyles = styles({});',
], [
  { code: 'const pageSize: number = 24; const OPTIONS = { pageSize }; function read() { return pageSize; }', output: 'const PAGE_SIZE: number = 24; const OPTIONS = { pageSize: PAGE_SIZE }; function read() { return PAGE_SIZE; }', errors: [{ messageId: 'name' }] },
  { code: 'const pageSize = 24; function f(pageSize: number) { return pageSize; } function g() { return pageSize; }', output: 'const PAGE_SIZE = 24; function f(pageSize: number) { return pageSize; } function g() { return PAGE_SIZE; }', errors: [{ messageId: 'name' }] },
  { code: 'const pageSize = 24; const PAGE_SIZE = 12;', output: null, errors: [{ messageId: 'name' }] },
  { code: 'export const pageSize = 24;', output: null, errors: [{ messageId: 'name' }] },
  { code: 'const pageSize = 24; export { pageSize };', output: null, errors: [{ messageId: 'name' }] },
  { code: 'const pageSize = 24; function f() { return eval("pageSize"); }', output: null, errors: [{ messageId: 'name' }] },
  { code: 'let PAGE_SIZE = 24;', output: null, errors: [{ messageId: 'declaration' }] },
  { code: 'const { pageSize } = settings;', output: null, errors: [{ messageId: 'declaration' }] },
  { code: 'const imageURL = "/cover";', output: 'const IMAGE_URL = "/cover";', errors: [{ messageId: 'name' }] },
]);

run('module-exports', [
  { filename: '/project/src/components/tutorial/Tutorial.entrypoint.ts', code: 'export const TUTORIAL_ENTRY_POINT = {}; export type TutorialEntryPointProps = {};' },
  'export interface TutorialDetailProps {} export function TutorialDetail() {}',
  'export const TUTORIAL_DETAIL_QUERY = query; export function TutorialDetail() {}',
  'function TutorialDetail() {} export { TutorialDetail };',
  { filename: '/project/src/components/tutorial/__private__/useTutorialMutation.ts', code: 'export function useTutorialMutation() {} export type useTutorialMutationResult = {};' },
  { filename: '/project/src/app/router.tsx', code: 'export const ROUTER = createRouter();' },
], [
  { filename: '/project/src/components/tutorial/Tutorial.entrypoint.ts', code: 'export const UNRELATED = {};', errors: [{ messageId: 'primary' }, { messageId: 'name' }] },
  { code: 'export function Other() {}', errors: [{ messageId: 'primary' }, { messageId: 'name' }] },
  { code: 'export function TutorialDetailish() {}', errors: [{ messageId: 'primary' }, { messageId: 'name' }] },
  { code: 'export default function TutorialDetail() {}', errors: [{ messageId: 'default' }] },
  { code: 'export * from "./other";', errors: [{ messageId: 'default' }] },
  { code: 'export function TutorialDetail() {} export function Unrelated() {}', errors: [{ messageId: 'name' }] },
]);

run('local-component-names', [
  { filename: '/project/src/components/tutorial/Tutorial.entrypoint.ts', code: 'export function TutorialEntryPoint() {} function TutorialEntryPoint_Detail() {}' },
  'export function TutorialDetail() {} function TutorialDetail_Image() {}',
  'export function TutorialDetail() {} const TutorialDetail_Image = () => null;',
  'export function TutorialDetail() {} function useTutorialDetail() {}',
], [
  { code: 'export function TutorialDetail() { return <Image />; } function Image() { return null; }', output: 'export function TutorialDetail() { return <TutorialDetail_Image />; } function TutorialDetail_Image() { return null; }', errors: [{ messageId: 'name' }] },
  { code: 'export function TutorialDetail() { return <Image><Image /></Image>; } const Image = () => null;', output: 'export function TutorialDetail() { return <TutorialDetail_Image><TutorialDetail_Image /></TutorialDetail_Image>; } const TutorialDetail_Image = () => null;', errors: [{ messageId: 'name' }] },
  { code: 'export function TutorialDetail() { return <TutorialDetailImage />; } function TutorialDetailImage() {}', output: 'export function TutorialDetail() { return <TutorialDetail_Image />; } function TutorialDetail_Image() {}', errors: [{ messageId: 'name' }] },
  { code: 'const Image = memo(() => null); export function TutorialDetail() { return <Image />; }', output: 'const TutorialDetail_Image = memo(() => null); export function TutorialDetail() { return <TutorialDetail_Image />; }', errors: [{ messageId: 'name' }] },
  { code: 'function Image() {} const OBJECT = { Image };', output: 'function TutorialDetail_Image() {} const OBJECT = { Image: TutorialDetail_Image };', errors: [{ messageId: 'name' }] },
  { code: 'function Image() {} function TutorialDetail_Image() {}', output: null, errors: [{ messageId: 'name' }] },
  { code: 'function Image() {} function helper(Image: unknown) { return Image; }', output: 'function TutorialDetail_Image() {} function helper(Image: unknown) { return Image; }', errors: [{ messageId: 'name' }] },
  { code: 'export function TutorialDetail() { function TutorialDetail_Image() { return null; } return <TutorialDetail_Image />; }', output: null, errors: [{ messageId: 'nested' }] },
]);

run('render-only-components', [
  'import { useEffect } from "react"; export function TutorialDetail() { const state = useTutorialDetail(); return <Text>{state}</Text>; } function useTutorialDetail() { useEffect(() => {}, []); return 1; }',
  'export function TutorialDetail({ items }) { return <List>{items.map(item => <Text key={item.id}>{item.title}</Text>)}</List>; }',
  'function helper(items) { return items.filter(Boolean).sort(); }',
  { filename: '/project/src/components/tutorial/detail/useUnlockTutorialMutation.ts', code: 'import { useMutation } from "react-relay"; export function useUnlockTutorialMutation() { return useMutation(MUTATION); }' },
  'function useEffect() {} export function TutorialDetail() { useEffect(); return null; }',
], [
  { code: 'import { useEffect as effect } from "react"; export function TutorialDetail() { effect(() => {}, []); return null; }', errors: [{ messageId: 'effect' }] },
  { code: 'import * as React from "react"; export const TutorialDetail = () => { React.useLayoutEffect(() => {}, []); return null; };', errors: [{ messageId: 'effect' }] },
  { code: 'export function TutorialDetail() { return <Button onClick={() => fetch("/api")} />; }', errors: [{ messageId: 'effect' }] },
  { code: 'export function TutorialDetail({ items }) { const visible = items.filter(Boolean); return null; }', errors: [{ messageId: 'effect' }] },
  { code: 'export async function TutorialDetail() { return null; }', errors: [{ messageId: 'async' }] },
  { code: 'import { useMutation as mutation } from "react-relay"; function useLocal() { return mutation(MUTATION); }', errors: [{ messageId: 'mutation' }] },
  { code: 'import * as Relay from "react-relay"; function useLocal() { return Relay.useMutation(MUTATION); }', errors: [{ messageId: 'mutation' }] },
  { filename: '/project/src/components/tutorial/detail/useUnlockTutorialMutation.tsx', code: 'import { useMutation } from "react-relay"; export function useUnlockTutorialMutation() { return useMutation(MUTATION); }', errors: [{ messageId: 'mutation' }] },
]);
