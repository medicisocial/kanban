/**
 * Guard against runtime ReferenceErrors from symbols used without imports.
 * Run before production builds: npm run check:imports
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'src');

/** Module-level symbols that must be imported (not globals). */
const GUARDED_SYMBOLS = [
  'SUPABASE_ENABLED',
  'ORG_ID',
  'subscribeClientPortalChanges',
  'pushStaffSync',
  'pushStaffSyncRecords',
  'encodeSharePayload',
  'decodeSharePayload',
  'decodeShareQueryParam',
];

function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      walk(path, files);
      continue;
    }
    if (/\.(jsx?|tsx?)$/.test(name)) files.push(path);
  }
  return files;
}

function definesSymbol(line, sym) {
  return (
    line.includes(`export const ${sym}`) ||
    line.includes(`export function ${sym}`) ||
    line.includes(`export async function ${sym}`) ||
    line.includes(`function ${sym}`) ||
    line.includes(`async function ${sym}`) ||
    new RegExp(`export\\s*{[^}]*\\b${sym}\\b`).test(line)
  );
}

function importsSymbol(line, sym) {
  return /^\s*import\b/.test(line) && new RegExp(`\\b${sym}\\b`).test(line);
}

function usesSymbolWithoutImport(text, sym) {
  if (!new RegExp(`\\b${sym}\\b`).test(text)) return false;

  const lines = text.split('\n');
  let defined = false;
  let imported = false;
  let usedInCode = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('*')) continue;

    if (definesSymbol(line, sym)) defined = true;
    if (importsSymbol(line, sym)) imported = true;

    if (new RegExp(`\\b${sym}\\b`).test(line) && !/^\s*(import|export)\b/.test(trimmed)) {
      usedInCode = true;
    }
  }

  return usedInCode && !imported && !defined;
}

const failures = [];

for (const file of walk(root)) {
  const text = readFileSync(file, 'utf8');
  for (const sym of GUARDED_SYMBOLS) {
    if (usesSymbolWithoutImport(text, sym)) {
      failures.push(`${relative(join(root, '..'), file)}: uses ${sym} without importing it`);
    }
  }
}

if (failures.length) {
  console.error('Import guard failed:\n');
  for (const msg of failures) console.error(`  - ${msg}`);
  process.exit(1);
}

console.log('Import guard passed.');
