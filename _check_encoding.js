#!/usr/bin/env node
/**
 * _check_encoding.js — wykrywa uszkodzone kodowanie w plikach projektu.
 *
 * Wykrywa DWA rodzaje uszkodzeń:
 *   1) U+FFFD (znak zastępczy Unicode) — nieprawidłowy UTF-8, nieodwracalna utrata bajtów.
 *   2) Literalne "?" / "??" / "???" jako placeholder ikony/emoji — np. <span>?? Mecze</span>
 *      albo console.log('? Zapisano'). To jest WAŻNY (valid ASCII), więc #1 go nie wykrywa.
 *      Powstaje gdy narzędzie (np. PowerShell z konsolą w codepage != UTF-8) zapisuje/
 *      przepisuje plik i nie-mapowalne znaki (emoji) zamienia na "?" zamiast failować.
 *
 * Użycie:
 *   node _check_encoding.js            -> skanuje wszystkie .html/.js/.json w repo (poza node_modules)
 *   node _check_encoding.js --staged   -> skanuje tylko pliki wchodzące do najbliższego commitu (git diff --cached)
 *
 * Exit code 0 = czysto, 1 = znaleziono uszkodzenia.
 * Używane przez: git pre-commit hook (.git/hooks/pre-commit) oraz ręcznie przed każdym deployem.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const EXTS = new Set(['.html', '.js', '.json']);
const IGNORE_DIRS = new Set(['node_modules', '.git', '.firebase', '.windsurf', 'functions']);

// Linie, które wyglądają jak uszkodzenie wg wzorca #2, ale są legalne (prawdziwy polski
// znak zapytania na końcu pytania osadzonego w cytowanym imieniu/nazwie, albo legalny
// placeholder typu '??' na nieznane inicjały). Dopasowanie po fragmencie tekstu, nie po
// numerze linii (numery się przesuwają).
const KNOWN_SAFE_SUBSTRINGS = [
  "Zwolni to slot licencji",           // profil.html: Zablokować kibica "X"? Zwolni...
  "dostaną powiadomienie o usunięciu", // start.html: Usunąć zadanie "X"? Wszyscy...
  "zostaną zablokowani",               // support.html: Cofnąć dostęp dla klubu "X"? Użytkownicy...
  "if (!name) return '??'",            // druzyna.html/klub.html: fallback inicjałów awatara
  "lic.used ?? '?'",                   // blocked.html: fallback nieznanej wartości slotu
  "lic.total ?? '?'",
];

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

// Wzorzec #2: cytat/">" bezpośrednio przed 1-3 znakami "?" bezpośrednio przed białym znakiem
// — kształt charakterystyczny dla "<ikona> <tekst>" gdzie ikona padła ofiarą zlej konwersji.
const ICON_PLACEHOLDER_RE = /(["'`>])\?{1,3}(\s)/g;

for (const f of files) {
  if (path.basename(f) === skipSelf) continue; // nie skanuj samego siebie
  const txt = fs.readFileSync(f, 'utf8');

  // --- #1: U+FFFD ---
  const fffd = (txt.split(REPLACEMENT_CHAR).length - 1);
  if (fffd > 0) {
    totalBad += fffd;
    const lines = txt.split('\n');
    const firstLines = [];
    lines.forEach((line, i) => { if (line.includes(REPLACEMENT_CHAR) && firstLines.length < 3) firstLines.push(i + 1); });
    report.push(`  [U+FFFD] ${f}: ${fffd} wystąpień (np. linia ${firstLines.join(', ')})`);
  }

  // --- #2: literalne "?" jako placeholder ikony ---
  const lines2 = txt.split('\n');
  const iconHits = [];
  lines2.forEach((line, i) => {
    if (KNOWN_SAFE_SUBSTRINGS.some(s => line.includes(s))) return;
    if (ICON_PLACEHOLDER_RE.test(line)) {
      iconHits.push(i + 1);
    }
    ICON_PLACEHOLDER_RE.lastIndex = 0;
  });
  if (iconHits.length > 0) {
    totalBad += iconHits.length;
    report.push(`  [?-placeholder] ${f}: ${iconHits.length} linii (${iconHits.slice(0, 5).join(', ')}${iconHits.length > 5 ? ', ...' : ''})`);
  }
}

if (report.length) {
  console.error('❌ Wykryto uszkodzone kodowanie w:');
  console.error(report.join('\n'));
  console.error(`\nŁącznie: ${totalBad} uszkodzeń w ${report.length} plikach.`);
  console.error('[U+FFFD] = trwała utrata danych, wymaga naprawy z historii git.');
  console.error('[?-placeholder] = literalny "?" zamiast ikony/emoji — sprawdź git history pliku (git show <stary commit>:<plik>), żeby odzyskać oryginalny znak. Jeśli to legalny tekst (prawdziwy znak zapytania), dodaj fragment do KNOWN_SAFE_SUBSTRINGS w tym skrypcie.');
  process.exit(1);
} else {
  console.log(`✅ Czysto (${files.length} plików sprawdzonych${staged ? ', staged' : ''}).`);
  process.exit(0);
}
