// Cari export yang tidak dipakai file lain (ts-prune sederhana).
// Hasil: "file  nama  (dipakai lokal? ya/tidak)".
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');
const ROOT = AKAR + '/';
const ts = require(ROOT + 'node_modules/typescript');

function jalan(dir, out = []) {
  for (const n of fs.readdirSync(dir)) {
    const p = path.join(dir, n);
    const st = fs.statSync(p);
    if (st.isDirectory()) {
      if (n === 'node_modules' || n.startsWith('.')) continue;
      jalan(p, out);
    } else if (/\.(ts|tsx)$/.test(n) && !/\.d\.ts$/.test(n)) out.push(p);
  }
  return out;
}
const files = [];
for (const d of ['app', 'components', 'lib', 'hooks', 'contexts', 'assets']) {
  if (fs.existsSync(ROOT + d)) jalan(ROOT + d, files);
}
const src = new Map(files.map((f) => [f, fs.readFileSync(f, 'utf8')]));

// app/ = route files: default export dipakai router; export lain (mis.
// ErrorBoundary/unstable_settings) juga. Jadi app/ hanya jadi PEMAKAI.
const kandidat = files.filter((f) => !f.includes('/app/') && !f.includes('\\app\\'));

const laporan = [];
for (const f of kandidat) {
  const sf = ts.createSourceFile(f, src.get(f), ts.ScriptTarget.Latest, true, f.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const nama = [];
  const ada = (mods) => mods && mods.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
  for (const st of sf.statements) {
    const mods = ts.canHaveModifiers(st) ? ts.getModifiers(st) : undefined;
    if (!ada(mods)) {
      if (ts.isExportDeclaration(st) && st.exportClause && ts.isNamedExports(st.exportClause)) {
        for (const e of st.exportClause.elements) nama.push(e.name.text);
      }
      continue;
    }
    if (mods.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword)) continue;
    if (ts.isVariableStatement(st)) {
      for (const d of st.declarationList.declarations) {
        if (ts.isIdentifier(d.name)) nama.push(d.name.text);
      }
    } else if (
      (ts.isFunctionDeclaration(st) || ts.isClassDeclaration(st) || ts.isInterfaceDeclaration(st) ||
        ts.isTypeAliasDeclaration(st) || ts.isEnumDeclaration(st)) && st.name
    ) {
      nama.push(st.name.text);
    }
  }
  const sendiri = src.get(f);
  for (const n of nama) {
    const re = new RegExp('\\b' + n + '\\b');
    let dipakaiLuar = false;
    for (const [g, s] of src) {
      if (g === f) continue;
      if (re.test(s)) { dipakaiLuar = true; break; }
    }
    if (dipakaiLuar) continue;
    const jumlahLokal = (sendiri.match(new RegExp('\\b' + n + '\\b', 'g')) || []).length;
    laporan.push({ f: f.slice(ROOT.length), n, lokal: jumlahLokal > 1 });
  }
}
laporan.sort((a, b) => a.f.localeCompare(b.f) || a.n.localeCompare(b.n));
for (const r of laporan) console.log(r.f.padEnd(44) + r.n.padEnd(32) + (r.lokal ? 'dipakai lokal' : 'MATI TOTAL'));
console.log('\n' + laporan.length + ' export tanpa pemakai luar');
