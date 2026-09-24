// Berkas di components/ lib/ hooks/ contexts/ yang TIDAK pernah diimpor
// siapa pun (rute di app/ tidak dihitung: mereka dimuat expo-router).
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');
const ROOT = AKAR;

function walk(d, out = []) {
  for (const f of fs.readdirSync(path.join(ROOT, d), { withFileTypes: true })) {
    const rel = `${d}/${f.name}`;
    if (f.isDirectory()) walk(rel, out);
    else if (/\.(ts|tsx)$/.test(f.name)) out.push(rel);
  }
  return out;
}

const semua = [...walk('app'), ...walk('components'), ...walk('lib'), ...walk('hooks'), ...walk('contexts'), ...walk('assets')];
const isi = new Map(semua.map((f) => [f, fs.readFileSync(path.join(ROOT, f), 'utf8')]));

const mati = [];
for (const f of semua) {
  if (f.startsWith('app/')) continue; // rute
  const mod = f.replace(/\.(ts|tsx)$/, '');
  const alias = '@/' + mod;
  const nama = path.basename(mod);
  let dipakai = false;
  for (const [g, src] of isi) {
    if (g === f) continue;
    if (src.includes(alias) || new RegExp(`from '\\.{1,2}/${nama}'`).test(src)) {
      dipakai = true;
      break;
    }
  }
  if (!dipakai) mati.push(f);
}
console.log(mati.length ? mati.join('\n') : 'tidak ada berkas nganggur');
