/**
 * Session Synchrotron : chrono / temps réservés aux cartes X (pas Y rapides).
 * Usage: node scripts/test-session-timing-x-only.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'anki-app-v2.js'), 'utf8');

let passed = 0;
let failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; console.log('  ✓', msg); }
  else { failed++; console.error('  ✗', msg); }
}

console.log('=== Session timing X-only ===\n');

assert(/function cardUsesSessionTiming\(c\)/.test(src), 'helper cardUsesSessionTiming');
assert(/!isQuickCard\(c\) && !isDevoirCard\(c\)/.test(src), 'timing exclut Y et W');
assert(/if \(!S\.current \|\| !cardUsesSessionTiming\(S\.current\)\) return/.test(src),
  'startChrono / toggle chrono gardés pour X');
assert(/cardUsesSessionTiming\(c\) \? renderChronoBlock/.test(src),
  'dock : chrono conditionnel');
assert(/useTiming \? `\$\{renderChronoBlock\(false, true\)/.test(src),
  'overlay plein écran : chrono conditionnel');
assert(/useTiming \? renderSessionTimingPanel\(c\)/.test(src),
  'panneau timing conditionnel (X uniquement)');
assert(/const usesTiming = cardUsesSessionTiming\(S\.current\)/.test(src),
  'evalCardV2 branche usesTiming');
assert(/if \(usesTiming && tps != null\) histEntry\.tempsReel/.test(src),
  'historique sans tempsReel pour Y');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
