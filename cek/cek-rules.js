// Uji parser dokumen Rules & isi seed — memakai kode SUNGGUHAN lib/coreRules.ts.
const AKAR = require('./akar');
const fs = require('fs');
const ts = require(AKAR + '/node_modules/typescript');
const R = AKAR + '/';
const src = fs.readFileSync(R + 'lib/coreRules.ts', 'utf8');

function potong(awal, akhir) {
  const a = src.indexOf(awal);
  const b = akhir ? src.indexOf(akhir, a) : src.length;
  if (a < 0 || b < 0) throw new Error('tak ketemu: ' + awal);
  return src.slice(a, b);
}
const kode =
  'type CoreRule = any;\n' +
  potong('const SEP_CHARS', '// ------------------------------------------------------------ Dokumen bawaan') +
  potong('const VISITASI_BODY');

const js = ts.transpileModule(
  kode + '\nexport { parseRuleBody, CORE_RULE_SEEDS };',
  { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } },
).outputText;
const mod = { exports: {} };
new Function('exports', 'module', js)(mod.exports, mod);
const { parseRuleBody, CORE_RULE_SEEDS } = mod.exports;

let ok = true;
const c = (n, s) => { if (!s) ok = false; console.log((s ? '  ✓ ' : '  ✗ ') + n); };
const cari = (k) => CORE_RULE_SEEDS.find((r) => r.kind === k);

console.log('=== 6 dokumen tersimpan ===');
c('ada 6 dokumen bawaan', CORE_RULE_SEEDS.length === 6);
const HARAP = [
  ['visitasi', '🔥', 'Visitasi CORE', 'V.1.0.3', 'Selasa, 26 Mei 2026'],
  ['charity', '💌', 'Charity CORE', 'V.1.0.0', 'Kamis, 7 Mei 2026'],
  ['thanksgiving', '🎉', 'CORE Thanksgiving', '', 'Kamis, 23 Apr 2026'],
  ['fundraising', '💸', 'CORE Fundraising', '', 'Kamis, 23 April 2026'],
  ['gathering', '🏡', 'Gathering CORE', '', 'Kamis, 23 Apr 2026'],
  ['coreGabungan', '✨', 'CORE x CORE', '', 'Kamis, 23 Apr 2026'],
];
for (const [kind, icon, title, version, updated] of HARAP) {
  const r = cari(kind);
  c(`${icon} ${title.padEnd(18)} (${kind})`,
    r && r.icon === icon && r.title === title && r.version === version && r.updated === updated);
}
c('urutannya sesuai daftar',
  CORE_RULE_SEEDS.map((r) => r.kind).join() === HARAP.map((h) => h[0]).join());
c('semua punya ikon', CORE_RULE_SEEDS.every((r) => r.icon));
c('semua punya isi', CORE_RULE_SEEDS.every((r) => r.body.trim()));

console.log('\n=== Kredit penyusun ===');
c('5 dokumen dari Ps. Ery Pratignjo',
  CORE_RULE_SEEDS.filter((r) => r.credit.includes('Ery Pratignjo')).length === 5);
c('CORE x CORE dari MCL Imanuel Victory saja',
  cari('coreGabungan').credit === '~ Arahan utama oleh MCL Imanuel Victory');

console.log('\n=== "fundraising" bukan jenis pertemuan ===');
const coreSrc = fs.readFileSync(R + 'lib/core.ts', 'utf8');
c('TIDAK ada di MEETING_KINDS (tak muncul saat menjadwalkan pertemuan)',
  !coreSrc.includes("key: 'fundraising'"));
c('5 dokumen lain memang jenis pertemuan yang ada',
  ['visitasi', 'charity', 'thanksgiving', 'gathering', 'coreGabungan']
    .every((k) => coreSrc.includes(`key: '${k}'`)));

console.log('\n=== Isi dokumen baru utuh ===');
const F = cari('fundraising').body;
c('Fundraising: larangan nomor rekening', F.includes('Tidak mencantumkan nomor rekening'));
c('Fundraising: hanya internal CORE', F.includes('hanya boleh dilakukan di lingkungan internal CORE'));
c('Fundraising: larangan publikasi medsos', F.includes('Tidak boleh mempublikasikan'));
c('Fundraising: boleh jual barang internal', F.includes('MASIH diperbolehkan untuk menjual barang'));
c('Fundraising: bagian "Penggalangan Dana dari Luar CORE"', F.includes('Penggalangan Dana dari Luar CORE'));
c('Fundraising: bagian "Thrifting"', F.includes('#Thrifting'));
c('Fundraising: CORE wadah PEMURIDAN', F.includes('wadah PEMURIDAN di NDC'));
const X = cari('coreGabungan').body;
c('CORE x CORE: bahan pertimbangan ikut tersimpan', X.includes('Bahan Pertimbangan'));
c('CORE x CORE: 3 pertanyaan tujuan', X.includes('seru2an / bonding') && X.includes('kesaksian & worship'));
c('CORE x CORE: keuntungan & konsekuensi', X.includes('suasana fresh') && X.includes('kedalaman rohani bisa jadi lebih tipis'));
c('CORE x CORE: pertanyaan penutup siapa yang pegang rohani', X.includes('pegang'));
c('Thanksgiving: alasan jangan pakai nama Anniversary',
  cari('thanksgiving').body.includes('Jangan kasih nama Anniversary'));
c('Gathering: GCORE / Staycation / Retret',
  cari('gathering').body.includes('GCORE / Staycation / Retret'));

console.log('\n=== Draf dibiarkan apa adanya (TIDAK dikarang) ===');
c('placeholder "aaa" tetap ada di Thanksgiving', cari('thanksgiving').body.includes('- aaa'));
c('placeholder "aaa" tetap ada di Gathering', cari('gathering').body.includes('- aaa'));
c('placeholder "aaa" tetap ada di CORE x CORE', X.includes('- aaa'));
c('kalimat terputus Thanksgiving tetap apa adanya',
  cari('thanksgiving').body.trimEnd().endsWith('menjadi sebuah brand khusus dengan'));
c('kalimat terputus Gathering tetap apa adanya',
  cari('gathering').body.trimEnd().endsWith('- Hati-hati jangan'));

console.log('\n=== Parser: aturan baru ===');
const uji = (teks) => parseRuleBody(teks)[0];
c('"#Thrifting" → judul bagian', uji('#Thrifting').type === 'head');
c('  …tagar dilepas dari teks', uji('#Thrifting').text === 'Thrifting');
c('"#Penggalangan Dana dari Luar CORE:" → judul', uji('#Penggalangan Dana dari Luar CORE:').type === 'head');
c('"Fundraising" (judul biasa sesudah baris kosong) → judul', uji('Fundraising').type === 'head');
c('"CORE Bersama" → judul', uji('CORE Bersama').type === 'head');
c('"Ide-ide cari dana" → judul', parseRuleBody('\nIde-ide cari dana')[1].type === 'head');
c('kalimat pendek TANPA baris kosong sebelumnya → tetap paragraf',
  parseRuleBody('Halo dunia\nFokus pada 3 pilar CORE')[1].type === 'text');

console.log('\n=== Parser: tidak ada regresi di 2 dokumen lama ===');
const V = cari('visitasi').body;
const blokPenting = parseRuleBody(V).filter((l) => l.type === 'warn');
c('8 blok ⚠️ Penting masih terdeteksi', blokPenting.length === 8);
c('blok ⚠️ terakhir tetap menelan 3 pilar CORE (tidak terpotong judul)',
  blokPenting.some((b) => (b.children ?? []).some((k) => k.text === 'Praise & Worship')));
c('"Fokus pada 3 pilar CORE" tetap DI DALAM blok ⚠️',
  blokPenting.some((b) => (b.children ?? []).some((k) => k.text === 'Fokus pada 3 pilar CORE')));
const C2 = cari('charity').body;
c('Charity: 4 prioritas tetap bernomor',
  parseRuleBody(C2).filter((l) => l.type === 'num').length === 4);
c('Charity: kotak ⚠️ "Penting banget dipahami" masih menelan 2 butir',
  parseRuleBody(C2).some((l) => l.type === 'warn' && (l.children ?? []).length === 2));

console.log('\n=== Tidak ada isi yang hilang saat diurai ===');
const ratakan = (list) => list.flatMap((l) => [l, ...(l.children ?? [])]);
for (const r of CORE_RULE_SEEDS) {
  const baris = ratakan(parseRuleBody(r.body));
  const asli = r.body.split('\n').filter((l) => l.trim()).length;
  const terurai = baris.filter((l) => l.type !== 'blank').length;
  c(`${r.title.padEnd(18)} ${String(asli).padStart(3)} baris → ${String(terurai).padStart(3)} terurai`,
    asli === terurai);
  const raib = baris.filter((l) => l.type !== 'blank' && l.type !== 'sep' && !l.text);
  if (raib.length) { ok = false; console.log('      ✗ ada teks raib:', raib); }
}

console.log('\n' + (ok ? 'LULUS' : 'GAGAL'));
process.exit(ok ? 0 : 1);
