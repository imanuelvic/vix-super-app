// Cari teks yang SAMA persis dipakai di >= 3 berkas berbeda — calon util bersama.
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');
const ROOT = AKAR;

const files = [];
function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) {
      if (!/node_modules|[.]git|[.]expo/.test(p)) walk(p);
    } else if (/[.](ts|tsx)$/.test(e.name)) files.push(p);
  }
}
walk(path.join(ROOT, 'app'));
walk(path.join(ROOT, 'components'));
walk(path.join(ROOT, 'hooks'));

const SATU_BARIS = /'([^'\n\\]{16,90})'/g;
const count = new Map();
for (const f of files) {
  const s = fs.readFileSync(f, 'utf8');
  const tanpaImpor = s.replace(/^import[\s\S]*?;$/gm, '');
  for (const m of tanpaImpor.matchAll(SATU_BARIS)) {
    const t = m[1];
    if (!/[a-z]/.test(t)) continue;
    if (/^[@./]/.test(t)) continue; // jalur berkas
    if (!/\s/.test(t)) continue; // satu kata = kemungkinan besar kunci
    if (!count.has(t)) count.set(t, new Set());
    count.get(t).add(path.relative(ROOT, f).replace(/\\/g, '/'));
  }
}
const dup = [...count.entries()]
  .filter(([, v]) => v.size >= 3)
  .sort((a, b) => b[1].size - a[1].size);
for (const [t, v] of dup.slice(0, 30)) {
  console.log(`${v.size}  ${JSON.stringify(t)}`);
  console.log(`      ${[...v].slice(0, 5).join(', ')}`);
}
console.log(`\n${dup.length} teks kembar di >= 3 berkas`);
