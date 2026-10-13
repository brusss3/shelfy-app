// Genera lib/legal/licenses.json: l'elenco delle librerie open source che
// finiscono DAVVERO nell'app (bundle Android + web), con licenza e copyright,
// per la schermata "Licenze open source" nelle Impostazioni.
//
// Si parte dai bundle esportati con le sourcemap (non da package.json: 700+
// pacchetti sono strumenti di build che non vengono distribuiti) e si incrocia
// con le licenze lette da license-checker.
//
// Uso (da shelfy-app/shelfy-app):  node scripts/generate-licenses.mjs
// Da rilanciare quando cambiano le dipendenze.

import { execSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { STANDARD_TEXTS } from './license-texts.mjs';

const root = process.cwd();
const tmp = mkdtempSync(join(tmpdir(), 'shelfy-lic-'));
const run = (cmd) => execSync(cmd, { cwd: root, stdio: ['ignore', 'pipe', 'inherit'], maxBuffer: 1 << 28 }).toString();

try {
  console.log('Esporto i bundle (android + web) con sourcemap…');
  run(`npx expo export -p android --no-bytecode --dump-sourcemap --output-dir "${join(tmp, 'android')}"`);
  run(`npx expo export -p web --dump-sourcemap --output-dir "${join(tmp, 'web')}"`);

  const maps = [];
  const walk = (dir) => {
    for (const f of readdirSync(dir)) {
      const p = join(dir, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (f.endsWith('.map')) maps.push(p);
    }
  };
  walk(tmp);

  // Nome del pacchetto dall'ultimo "node_modules/" del percorso (gestisce gli annidati).
  const shipped = new Set();
  for (const m of maps) {
    const { sources = [] } = JSON.parse(readFileSync(m, 'utf8'));
    for (const s of sources) {
      const norm = s.replace(/\\/g, '/');
      const i = norm.lastIndexOf('node_modules/');
      if (i < 0) continue;
      const rest = norm.slice(i + 'node_modules/'.length).split('/');
      shipped.add(rest[0].startsWith('@') ? `${rest[0]}/${rest[1]}` : rest[0]);
    }
  }
  console.log(`${shipped.size} pacchetti nei bundle`);

  console.log('Leggo le licenze…');
  const raw = JSON.parse(run('npx --yes license-checker-rseidelsohn --production --json --excludePrivatePackages'));

  const byName = new Map();
  for (const [key, v] of Object.entries(raw)) {
    const at = key.lastIndexOf('@');
    const name = key.slice(0, at);
    const version = key.slice(at + 1);
    if (!shipped.has(name)) continue;
    // Più versioni dello stesso pacchetto: una voce per nome (la più recente basta per l'elenco).
    const prev = byName.get(name);
    if (!prev || prev.version < version) byName.set(name, { name, version, v });
  }

  const copyrightOf = (text) => {
    if (!text) return [];
    // Solo vere righe di copyright ("Copyright (c) 2020 Nome"), non frasi del testo
    // della licenza né i segnaposto dell'Apache ("[yyyy] [name of copyright owner]").
    const lines = text.split(/\r?\n/).map((l) => l.trim())
      .filter((l) => /^((copyright|\(c\)|©)\s*(\(c\)|©)?\s*\d{4}|copyright\s*(\(c\)|©)?\s*[A-Z])/i.test(l)
        && l.length < 160 && !/[\[\]]|notice|license to|owner/i.test(l));
    return [...new Set(lines)].slice(0, 2);
  };

  const packages = [];
  const samples = new Map(); // licenza -> testo di riferimento
  for (const { name, version, v } of [...byName.values()].sort((a, b) => a.name.localeCompare(b.name))) {
    let license = String(v.licenses).replace(/[()*]/g, '');
    // Doppia licenza: si sceglie quella permissiva.
    if (/BSD-3-Clause OR GPL/.test(license)) license = 'BSD-3-Clause';
    let text = '';
    // Solo file di licenza veri: a volte license-checker ripiega sul README.
    if (v.licenseFile && /(licen[cs]e|copying|notice)[^/\\]*$/i.test(v.licenseFile)) {
      try { text = readFileSync(v.licenseFile, 'utf8'); } catch { /* file spostato */ }
    }
    const copyright = copyrightOf(text);
    if (copyright.length === 0) copyright.push(v.publisher ? `Copyright ${v.publisher}` : `Copyright the ${name} authors`);
    packages.push({
      name, version, license,
      url: (v.repository || '').replace(/^git\+/, '').replace(/\.git$/, '') || undefined,
      copyright,
    });
    // Testo completo solo per l'Apache (le altre usano i testi standard).
    if (license.includes('Apache-2.0') && /Apache License/i.test(text) && text.length > (samples.get('Apache-2.0')?.length ?? 0)) samples.set('Apache-2.0', text);
  }

  // Il testo di riferimento perde le righe di copyright del singolo autore:
  // quelle stanno accanto a ogni pacchetto.
  const texts = { ...STANDARD_TEXTS };
  if (samples.get('Apache-2.0')) texts['Apache-2.0'] = samples.get('Apache-2.0').trim();

  // "MIT AND ISC" ecc.: servono i testi di ciascuna.
  const used = new Set(packages.flatMap((p) => p.license.split(' AND ')));
  const missing = [...used].filter((l) => !texts[l]);
  if (missing.length) console.warn('Licenze senza testo di riferimento (verificare a mano):', missing.join(', '));

  mkdirSync(join(root, 'lib', 'legal'), { recursive: true });
  writeFileSync(
    join(root, 'lib', 'legal', 'licenses.json'),
    JSON.stringify({ generatedAt: new Date().toISOString().slice(0, 10), packages, texts }),
  );
  const summary = {};
  for (const p of packages) summary[p.license] = (summary[p.license] || 0) + 1;
  console.log(`${packages.length} pacchetti scritti in lib/legal/licenses.json`, summary);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
