/**
 * Helper partagé par les tests : vérifie window.__BOOT_CACHE_V sans jamais
 * coder une version en dur (elle est bumpée à chaque publication).
 *
 * Contrat vérifié :
 *  - index.html définit window.__BOOT_CACHE_V = '<8 chiffres><lettres>'
 *  - boot-loader.js lit window.__BOOT_CACHE_V pour construire les ?v=
 */
import fs from 'fs';
import path from 'path';

export function readBootCacheVersion(root) {
  const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const m = index.match(/window\.__BOOT_CACHE_V\s*=\s*['"]([^'"]*)['"]/);
  return m ? m[1] : null;
}

export function checkBootCacheVersion(root) {
  const version = readBootCacheVersion(root);
  const wellFormed = typeof version === 'string' && /^\d{8}[a-z]+$/i.test(version);
  const boot = fs.readFileSync(path.join(root, 'boot-loader.js'), 'utf8');
  const bootUses = /window\.__BOOT_CACHE_V/.test(boot);
  return { ok: wellFormed && bootUses, version, wellFormed, bootUses };
}

export function bootCacheLabel(root) {
  const r = checkBootCacheVersion(root);
  return `cache __BOOT_CACHE_V='${r.version}' (8 chiffres + lettres, utilisé par boot-loader)`;
}
