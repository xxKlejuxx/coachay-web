#!/usr/bin/env node
/**
 * _check_encoding.js — wykrywa uszkodzone kodowanie (U+FFFD) w plikach projektu.
 *
 * Użycie:
 *   node _check_encoding.js            -> skanuje wszystkie .html/.js/.json w repo (poza node_modules)
 *   node _check_encoding.js --staged   -> skanuje tylko pliki wchodzące do najbliższego commitu (git diff --cached)
 *
 * Exit code 0 = czysto, 1 = znaleziono uszkodzenia (U+FFFD).
 * Używane przez: git pre-commit hook (.git/hooks/pre-commit) oraz ręcznie przed każdym deployem.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const EXTS = new Set(['.html', '.js', '.json']);
const IGNORE_DIRS = new Set(['node_modules', '.git', '.firebase', '.windsurf', 'functions']);

function listAllFiles(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORE_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) listAllFiles(full, out);
    else if (EXTS.has(path.extname(entry.name))) out.push(full);
  }
  return out;
}

function listStagedFiles() {
  const out = execSync('git diff --cached --name-only --diff-filter=ACM', { encoding: 'utf8' });
  return out.split('\n').map(f => f.trim()).filter(f => f && EXTS.has(path.extname(f)) && fs.existsSync(f));
}

const staged = process.argv.includes('--staged');
const files = staged ? listStagedFiles() : listAllFiles('.', []);

let totalBad = 0;
const report = [];

const REPLACEMENT_CHAR = String.fromCharCode(0xFFFD); // budowane programowo, nie literalem w zrodle
const skipSelf = path.basename(__filename);

for (const f of files) {
  if (path.basename(f) === skipSelf) continue; // nie skanuj samego siebie
  const txt = fs.readFileSync(f, 'utf8');
  const fffd = (txt.split(REPLACEMENT_CHAR).length - 1);
  if (fffd > 0) {
    totalBad += fffd;
    const lines = txt.split('\n');
    const firstLines = [];
    lines.forEach((line, i) => { if (line.includes(REPLACEMENT_CHAR) && firstLines.length < 3) firstLines.push(i + 1); });
    report.push(`  ${f}: ${fffd} wystąpień U+FFFD (np. linia ${firstLines.join(', ')})`);
  }
}

if (report.length) {
  console.error('❌ Wykryto uszkodzone kodowanie (znak zastępczy U+FFFD) w:');
  console.error(report.join('\n'));
  console.error(`\nŁącznie: ${totalBad} uszkodzeń w ${report.length} plikach.`);
  console.error('To jest trwała utrata danych (oryginalne bajty nie istnieją) — wymaga ręcznej naprawy, nie commitować/deployować.');
  process.exit(1);
} else {
  console.log(`✅ Czysto (${files.length} plików sprawdzonych${staged ? ', staged' : ''}).`);
  process.exit(0);
}
