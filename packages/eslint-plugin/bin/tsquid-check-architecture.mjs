#!/usr/bin/env node
// Checks the entity architecture of <cwd>/src, with components under src/components.
import path from 'node:path';
import { auditArchitecture, readSources } from '../src/check-architecture.mjs';

const root = path.resolve('src');
const issues = auditArchitecture(readSources(root), path.join(root, 'components'));
for (const issue of issues) console.error(`${path.relative(process.cwd(), issue.file)}:${issue.line}  ${issue.message}`);
if (issues.length) process.exitCode = 1;
else console.log('UI architecture checks passed.');
