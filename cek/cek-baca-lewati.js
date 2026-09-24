// Uji: hari yang DILEWATI tidak lagi muncul di riwayat Bible Reading,
// tapi penandanya tetap tersimpan (Home & Habits berhenti menagih).
const AKAR = require('./akar');
const BACA_TODAY = (p) => require('fs').readFileSync(AKAR + '/' + p, 'utf8').replace(/\r\n/g, '\n'); // 22 Sep 2026 Today OS
const fs = require('fs');
const ts = require(AKAR + '/node_modules/typescript');
const R = AKAR + '/';
const baca = (f) => fs.readFileSync(R + f, 'utf8');

let ok = true;
const c = (n, s) => { if (!s) ok = false; console.log((s ? '  ✓ ' : '  ✗ ') + n); };

// isBibleSkipped ASLI dari lib/spiritual.ts.
const sp = baca('lib/spiritual.ts');
const js = ts.transpileModule(
  `const BIBLE_SKIPPED = ${/export const BIBLE_SKIPPED = '([^']+)'/.exec(sp)[1] ? "'" + /export const BIBLE_SKIPPED = '([^']+)'/.exec(sp)[1] + "'" : "''"};\n` +
    sp.slice(sp.indexOf('export function isBibleSkipped'), sp.indexOf('\n}', sp.indexOf('export function isBibleSkipped')) + 2)
      .replace('export function', 'function') +
    '\nexports.isBibleSkipped = isBibleSkipped; exports.BIBLE_SKIPPED = BIBLE_SKIPPED;',
  { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } },
).outputText;
const mod = { exports: {} };
new Function('exports', 'module', js)(mod.exports, mod);
const { isBibleSkipped, BIBLE_SKIPPED } = mod.exports;

// Rumus daftar yang dipakai BibleReadingTab, disalin dari sumbernya.
const tab = baca('components/spiritual/BibleReadingTab.tsx');
c('rumus penyaringnya memang ada di sumber',
  /const list = days\.filter\(\(d\) => !!d\[session\] && !isBibleSkipped\(d\[session\]\)\)/.test(tab));
const daftar = (days, session) =>
  days.filter((d) => !!d[session] && !isBibleSkipped(d[session]));

// Data contoh persis seperti di layarmu.
const days = [
  { id: '2026-08-19', morning: 'Mazmur 23', night: BIBLE_SKIPPED },
  { id: '2026-08-13', morning: '', night: 'Yesaya 43' },
  { id: '2026-08-12', morning: BIBLE_SKIPPED, night: 'Yakobus 1' },
  { id: '2026-08-11', morning: BIBLE_SKIPPED, night: BIBLE_SKIPPED },
];

console.log('=== Malam (yang kamu lingkari) ===');
const malam = daftar(days, 'night');
console.log('  ' + malam.map((d) => `${d.id} → ${d.night}`).join('\n  '));
c('19 Agustus (dilewati) TIDAK muncul lagi', !malam.some((d) => d.id === '2026-08-19'));
c('yang benar-benar dibaca tetap muncul',
  malam.length === 2 && malam[0].night === 'Yesaya 43' && malam[1].night === 'Yakobus 1');
c('urutan terbaru→terlama tak berubah', malam[0].id > malam[1].id);

console.log('\n=== Pagi ===');
const pagi = daftar(days, 'morning');
c('hari yang pagi-nya dilewati juga hilang dari daftar Pagi',
  !pagi.some((d) => d.id === '2026-08-12') && !pagi.some((d) => d.id === '2026-08-11'));
c('satu hari bisa: pagi tampil, malam hilang — dihitung per sesi',
  pagi.some((d) => d.id === '2026-08-19') && !malam.some((d) => d.id === '2026-08-19'));
c('hari yang belum diisi sama sekali tetap tidak muncul (seperti dulu)',
  !pagi.some((d) => d.id === '2026-08-13'));
c('semua dilewati → daftar kosong, bukan penuh baris hampa',
  daftar([{ id: 'x', morning: BIBLE_SKIPPED, night: BIBLE_SKIPPED }], 'morning').length === 0);

console.log('\n=== Yang TIDAK boleh ikut berubah ===');
c('penanda "dilewati" tetap disimpan (bukan dihapus dari Firestore)',
  /BIBLE_SKIPPED/.test(baca('app/bible-reading.tsx')) &&
    /saveBibleReading\(\s*user\.uid,\s*dayId,\s*session,\s*skipped \? '' : BIBLE_SKIPPED,/.test(baca('app/bible-reading.tsx')));
c('baris Today tetap padam (✓) saat hari itu dilewati (tak menagih lagi)',
  /done: !!input\.bibleReading\[bibleSession\]/.test(BACA_TODAY('lib/today.ts')));
c('layar catat bacaan tetap bisa MEMBATALKAN "dilewati"',
  /skipped \? '' : BIBLE_SKIPPED/.test(baca('app/bible-reading.tsx')) &&
    /<SkipNotice/.test(baca('app/bible-reading.tsx')));
c('jalan masuknya masih ada walau kartu Home padam: baris Habits bisa dipencet',
  /route: \{ pathname: '\/bible-reading', params: \{ session: 'morning' \} \}/.test(baca('lib/habits.ts')));

console.log('\n=== Sisa kode mati sudah dibuang ===');
c('gaya "cardSkipped" tidak tersisa', !/cardSkipped/.test(tab));
c('teks "Dilewati hari itu" tidak tersisa', !/Dilewati hari itu/.test(tab));
c('isBibleSkipped masih dipakai (di penyaring daftar)',
  (tab.match(/isBibleSkipped/g) || []).length === 2); // impor + pemakaian

console.log('\n' + (ok ? 'LULUS' : 'GAGAL'));
process.exit(ok ? 0 : 1);
