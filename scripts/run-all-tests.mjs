#!/usr/bin/env node
/**
 * Lance tous les tests scripts/test-*.mjs et affiche un résumé en français.
 *
 * Usage :
 *   node scripts/run-all-tests.mjs          → résumé lisible (exit 1 si au moins un échec)
 *   node scripts/run-all-tests.mjs --json   → résultats machine (JSON sur stdout)
 *   node scripts/run-all-tests.mjs data-safety profiles   → seulement les fichiers dont le nom contient un filtre
 *
 * Chaque fichier tourne dans un process node séparé (timeout 120 s). Le résumé
 * (fichiers OK/ÉCHEC, assertions ✗, « Règle concernée ») peut être collé tel quel
 * à une IA pour qu'elle corrige le code applicatif — ou le test s'il est périmé.
 */
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const TIMEOUT_MS = 120000;

const RULES = {
  'test-agenda': 'Agenda : planning des sessions, devoirs W- hors Synchrotron',
  'test-anki-priority-files': 'Anki : files de priorité séparées X- (principal) / Y- (rapide), retards prioritaires',
  'test-anki-quick-create': 'Anki Rapide : création de cartes Y-, éditeur LaTeX, bundle quickLatex',
  'test-anki-quick-groups': 'Anki Rapide : dossiers/groupes, fil d’Ariane, démo quickGroups',
  'test-audit-donnees-robustesse': 'Robustesse données : anti faux-Principal, includeNew/réservoir, gardes secondaire, save avant avance de session (anti double-notation)',
  'test-audit-fixes': 'Correctifs d’audit : rollback si setDoc échoue, merge patch secondaire, tri/impression null-safe',
  'test-audit-robustesse': 'Robustesse UI : formatCardFaceHtml anti-XSS, création de carte attend save, MathLive fail-safe',
  'test-audit-site': 'Audit site : gardes secondaire sur les mutations, save attendue avant fermeture, verrou anti double-clic',
  'test-cours-browse-tree': 'Base Doc : navigation Arbre / Fil d’Ariane des cours',
  'test-cours-wizard': 'Assistant de création de cours : étapes, suppression sûre',
  'test-data-safety': 'Sécurité des données : IDs, sauvegarde/chargement, isolation des profils, import, instantanés',
  'test-deep-smoke': 'Smoke approfondi : chargement des modules, boot-loader, cache, parcours principaux',
  'test-device-session-adversarial': 'Principal/Secondaire : fail-closed, pas de faux Principal',
  'test-functional-smoke': 'Smoke fonctionnel : boot, session Anki, includeNew, devoirs, réordonnancement, anti double-notation',
  'test-mat-cl-edit': 'Matières/Classeurs : édition, renommage, cohérence des références',
  'test-profiles-adversarial': 'Profils : anti-écrasement, isolation, générations',
  'test-profiles-io': 'Profils : anti-écrasement, isolation, générations',
  'test-programme': 'Programme : chapitres, rattachement des cours, modèle de données',
  'test-session-timing-x-only': 'Session Anki : chronométrage réservé aux cartes X-',
  'test-sync-merge': 'Fusion cloud : suppressions effectives partout (D.meta.deleted), la modification la plus récente gagne (_mt), progression SRS gardée',
  'test-tab-lock': 'Verrou entre onglets : un seul onglet actif par profil, « Prendre la main », lecture seule sinon',
  'test-import-safety': 'Imports sans perte : retour arrière de l’import Partage, copie auto « Annuler le dernier import »',
  'test-eval-lock': 'Notation Anki : un seul verrou partagé entre Rapide et Synchrotron (pas de double notation)',
};

function ruleFor(name) {
  if (RULES[name]) return RULES[name];
  if (name.startsWith('test-profiles-')) return 'Profils : anti-écrasement, isolation, générations';
  if (name.startsWith('test-device-session-')) return 'Principal/Secondaire : fail-closed, pas de faux Principal';
  if (name.startsWith('test-anki-')) return 'Anki / Synchrotron : algorithme et interface des cartes';
  if (name.startsWith('test-audit-')) return 'Audit : robustesse et sécurité des données';
  return 'Voir l’en-tête du fichier de test';
}

function runOne(file) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const child = spawn(process.execPath, [file], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, TIMEOUT_MS);
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      resolve({ code, signal, stdout, stderr, timedOut, ms: Date.now() - t0 });
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({ code: -1, signal: null, stdout, stderr: stderr + String(err && err.stack || err), timedOut, ms: Date.now() - t0 });
    });
  });
}

function parseCounts(out) {
  let m = out.match(/(\d+)\s+passed,\s*(\d+)\s+failed/);
  if (!m) m = out.match(/passed=(\d+)\s+failed=(\d+)/);
  const lines = out.split(/\r?\n/);
  const ok = lines.filter((l) => /^\s*✓/.test(l)).length;
  const ko = lines.filter((l) => /^\s*✗/.test(l)).length;
  if (m) return { passed: Number(m[1]), failed: Number(m[2]), summaryFound: true };
  return { passed: ok, failed: ko, summaryFound: false };
}

function crashExcerpt(stderr) {
  const lines = stderr.split(/\r?\n/).filter((l) => l.trim() && !/^\s*[✓✗]/.test(l));
  let idx = -1;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (/^\s*(\w*Error|Uncaught)\b.*/.test(lines[i]) && !/^\s*at\s/.test(lines[i])) { idx = i; break; }
  }
  if (idx >= 0) {
    const stack = lines.slice(idx + 1).filter((l) => /^\s*at\s/.test(l)).slice(0, 3);
    return [lines[idx].trim()].concat(stack.map((l) => '  ' + l.trim())).join('\n');
  }
  return lines.slice(-6).join('\n');
}

async function main() {
  const args = process.argv.slice(2);
  const asJson = args.includes('--json');
  const filters = args.filter((a) => !a.startsWith('--'));

  const files = fs.readdirSync(__dirname)
    .filter((f) => /^test-.*\.mjs$/.test(f))
    .filter((f) => !filters.length || filters.some((flt) => f.includes(flt)))
    .sort();

  const results = [];
  for (const f of files) {
    const name = f.replace(/\.mjs$/, '');
    const r = await runOne(path.join(__dirname, f));
    const out = r.stdout + '\n' + r.stderr;
    const counts = parseCounts(r.stdout);
    const failedAssertions = out.split(/\r?\n/)
      .filter((l) => /^\s*✗/.test(l))
      .map((l) => l.trim().replace(/^✗\s*/, ''));
    const crashed = !r.timedOut && r.code !== 0 && !counts.summaryFound;
    const ok = r.code === 0 && !r.timedOut && failedAssertions.length === 0;
    results.push({
      file: `scripts/${f}`,
      name,
      ok,
      exitCode: r.code,
      timedOut: r.timedOut,
      crashed,
      passed: counts.passed,
      failed: Math.max(counts.failed, failedAssertions.length),
      durationMs: r.ms,
      rule: ruleFor(name),
      failedAssertions,
      crash: crashed || r.timedOut ? (r.timedOut ? `Timeout après ${TIMEOUT_MS / 1000} s` : crashExcerpt(r.stderr)) : null,
    });
  }

  const failedFiles = results.filter((r) => !r.ok);
  const totals = results.reduce((acc, r) => {
    acc.passed += r.passed;
    acc.failed += r.failed;
    return acc;
  }, { passed: 0, failed: 0 });

  if (asJson) {
    process.stdout.write(JSON.stringify({
      ok: failedFiles.length === 0,
      files: results.length,
      filesFailed: failedFiles.length,
      assertionsPassed: totals.passed,
      assertionsFailed: totals.failed,
      results,
    }, null, 2) + '\n');
    process.exit(failedFiles.length ? 1 : 0);
  }

  const pad = Math.max(...results.map((r) => r.file.length), 10);
  console.log('=== Tests « Mes Cours » — résumé ===\n');
  for (const r of results) {
    const status = r.ok ? 'OK    ' : 'ÉCHEC ';
    let detail = `${r.passed} réussi(s), ${r.failed} échoué(s)`;
    if (r.timedOut) detail += ' — TIMEOUT';
    else if (r.crashed) detail += ' — PLANTAGE (exception non gérée)';
    console.log(`${status} ${r.file.padEnd(pad)}  ${detail}  (${r.durationMs} ms)`);
  }

  console.log(`\nTotal : ${results.length} fichier(s), ${results.length - failedFiles.length} OK, ${failedFiles.length} en échec — `
    + `${totals.passed} assertion(s) réussie(s), ${totals.failed} échouée(s).`);

  if (failedFiles.length) {
    console.log('\n=== Détail des échecs ===');
    for (const r of failedFiles) {
      console.log(`\nFichier : ${r.file}`);
      console.log(`Règle concernée : ${r.rule}`);
      for (const a of r.failedAssertions) console.log(`  ✗ ${a}`);
      if (r.crash) {
        console.log(r.timedOut ? `  ⚠ ${r.crash}` : '  ⚠ Le test a planté avant la fin (les assertions suivantes n’ont pas tourné) :');
        if (!r.timedOut) console.log(r.crash.split('\n').map((l) => '    ' + l).join('\n'));
      } else if (!r.failedAssertions.length) {
        console.log(`  ⚠ Code de sortie ${r.exitCode} sans assertion ✗ identifiée.`);
      }
    }
    console.log('\nPour le détail complet : node <fichier> (ex. node ' + failedFiles[0].file + ').');
  } else {
    console.log('\nTous les tests passent.');
  }
  process.exit(failedFiles.length ? 1 : 0);
}

main().catch((err) => {
  console.error('run-all-tests : erreur interne', err);
  process.exit(2);
});
