// Uji jadwal reminder kirim PDF + nama berkasnya — memakai kode SUNGGUHAN.
const AKAR = require('./akar');
const fs = require('fs');
const ts = require(AKAR + '/node_modules/typescript');
const R = AKAR + '/';

function potong(src, awal, akhir) {
  const a = src.indexOf(awal);
  const b = akhir ? src.indexOf(akhir, a) : src.length;
  if (a < 0 || b < 0) throw new Error('tak ketemu: ' + awal);
  return src.slice(a, b);
}
function muat(kode, luar = {}) {
  const mod = { exports: {} };
  const nama = Object.keys(luar);
  const js = ts.transpileModule(kode, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
  }).outputText;
  new Function('exports', 'module', ...nama, js)(mod.exports, mod, ...nama.map((n) => luar[n]));
  return mod.exports;
}

const coreSrc = fs.readFileSync(R + 'lib/core.ts', 'utf8');
const core = muat(
  'type MeetingKind = string; type Visitation = any; type CoreLeader = any;\n' +
    potong(coreSrc, 'export const MEETING_KINDS', 'export type Visitation') +
    potong(coreSrc, '// ---- Reminder kirim PDF', 'export function markVisitationPdfSent') +
    potong(coreSrc, 'export function visitDaysUntil', 'export const VISIT_TIPS') +
    '\nexport { MEETING_KINDS, meetingKindMeta, pdfReminderDays, needsPdfShare, visitDaysUntil, PDF_REMINDER_DAYS_BIG, PDF_REMINDER_DAYS_NORMAL };',
);

let ok = true;
const c = (n, s) => { if (!s) ok = false; console.log((s ? '  ✓ ' : '  ✗ ') + n); };

const HARI_INI = new Date(2026, 7, 19); // Rabu, 19 Agustus 2026
const idHariIni = '2026-08-19';
// Pertemuan yang jatuh n hari lagi.
const buat = (kind, n, extra = {}) => ({
  id: 'v1', kind, leaderIds: ['a'], thanksgiving: false, done: false,
  agenda: '', note: '', pdfSentDayId: null,
  date: { toDate: () => new Date(2026, 7, 19 + n), toMillis: () => 0 },
  ...extra,
});

console.log('=== Mana yang acara besar ===');
const BESAR = ['gathering', 'charity', 'thanksgiving', 'christmas'];
for (const k of core.MEETING_KINDS) {
  const besar = !!k.bigEvent;
  const harus = BESAR.includes(k.key);
  c(`${k.icon} ${k.label.padEnd(26)} → ${besar ? 'ACARA BESAR' : 'biasa'}`, besar === harus);
}
c('tepat 4 acara besar', core.MEETING_KINDS.filter((k) => k.bigEvent).length === 4);

console.log('\n=== Jadwal pengingat ===');
c('pertemuan biasa: H-3 saja',
  JSON.stringify(core.pdfReminderDays('visitasi')) === '[3]');
c('acara besar: H-14, H-7, H-3, H-2, H-1',
  JSON.stringify(core.pdfReminderDays('charity')) === '[14,7,3,2,1]');
c('jenis tak dikenal jatuh ke jadwal biasa (tidak crash)',
  JSON.stringify(core.pdfReminderDays('entah')) === '[3]');

console.log('\n=== Hari mana saja badge menyala (pertemuan biasa) ===');
const barisBiasa = [];
for (let n = 0; n <= 16; n++) {
  if (core.needsPdfShare(buat('visitasi', n), HARI_INI, idHariIni)) barisBiasa.push(n);
}
console.log('  Visitasi CORE  → H-' + barisBiasa.join(', H-'));
c('hanya H-3', JSON.stringify(barisBiasa) === '[3]');

console.log('\n=== Hari mana saja badge menyala (acara besar) ===');
for (const k of BESAR) {
  const hari = [];
  for (let n = 0; n <= 16; n++) {
    if (core.needsPdfShare(buat(k, n), HARI_INI, idHariIni)) hari.push(n);
  }
  const meta = core.meetingKindMeta(k);
  // Loop mengumpulkan menaik; dibalik supaya terbaca seperti urutan waktunya.
  const turun = [...hari].reverse();
  console.log(`  ${meta.icon} ${meta.label.padEnd(18)} → H-` + turun.join(', H-'));
  c(`  ${meta.label}: tepat H-14, 7, 3, 2, 1`, JSON.stringify(turun) === '[14,7,3,2,1]');
}

console.log('\n=== Kapan badge TIDAK menyala ===');
c('acara sudah selesai → diam',
  !core.needsPdfShare(buat('charity', 7, { done: true }), HARI_INI, idHariIni));
c('PDF sudah dikirim HARI INI → diam',
  !core.needsPdfShare(buat('charity', 7, { pdfSentDayId: idHariIni }), HARI_INI, idHariIni));
c('PDF dikirim KEMARIN → menyala lagi (milestone baru)',
  core.needsPdfShare(buat('charity', 7, { pdfSentDayId: '2026-08-18' }), HARI_INI, idHariIni));
c('hari-H (H-0) → tidak lagi menagih kirim panduan',
  !core.needsPdfShare(buat('charity', 0), HARI_INI, idHariIni));
c('sudah lewat (H+2) → diam',
  !core.needsPdfShare(buat('charity', -2), HARI_INI, idHariIni));
c('H-10 (bukan milestone) → diam',
  !core.needsPdfShare(buat('charity', 10), HARI_INI, idHariIni));
c('H-20 (masih jauh) → diam',
  !core.needsPdfShare(buat('charity', 20), HARI_INI, idHariIni));
c('pertemuan biasa H-14 → diam (bukan acara besar)',
  !core.needsPdfShare(buat('visitasi', 14), HARI_INI, idHariIni));

console.log('\n=== Nama berkas PDF ===');
const pdfDocSrc = fs.readFileSync(R + 'lib/pdfDoc.ts', 'utf8')
  .replace(/^import[\s\S]*?from '[^']+';\n/gm, '')
  .replace(/export async function sharePdf[\s\S]*$/, '');
const pdfDoc = muat(pdfDocSrc + '\nexport { pdfFileName };', { LOGO_CORE_GWU_DATA_URI: '' });

const vpSrc = fs.readFileSync(R + 'lib/visitationPdf.ts', 'utf8')
  .replace(/^import[\s\S]*?from '[^']+';\n/gm, '')
  .replace(/^import \{[\s\S]*?\} from '[^']+';\n/gm, '')
  .replace(/function buildHtml[\s\S]*$/, '');
const vp = muat(
  'type Visitation = any; type CoreLeader = any;\n' + vpSrc + '\nexport { visitationPdfName };',
  { meetingKindMeta: core.meetingKindMeta, pdfFileName: pdfDoc.pdfFileName, escapeHtml: (s) => s },
);

const leaders = [
  { id: 'a', heart: '💚', name: 'Riky' },
  { id: 'b', heart: '🧡', name: 'Sarah' },
  { id: 'c', heart: '💛', name: 'Febryna' },
];
const kasus = [
  [buat('visitasi', 3), ['a'], 'Visitasi CORE - Riky.pdf', 'satu CORE'],
  [buat('charity', 7), ['a'], 'Charity CORE - Riky.pdf', 'acara besar'],
  [buat('coreGabungan', 3), ['a', 'b'], 'CORE Gabungan - Riky, Sarah.pdf', 'gabungan 2 CORE'],
  [buat('oneOnOne', 3), ['a'], 'One-on-One - Riky.pdf', 'nama berjenis tanda hubung'],
  [buat('visitasi', 3), [], 'Visitasi CORE.pdf', 'CL belum dipilih → jenis saja'],
  [buat('visitasi', 3), ['x'], 'Visitasi CORE.pdf', 'CL sudah dihapus → jenis saja'],
];
for (const [v, ids, harap, kenapa] of kasus) {
  const nama = vp.visitationPdfName({ ...v, leaderIds: ids }, leaders);
  const cocok = nama === harap;
  if (!cocok) ok = false;
  console.log(`  ${cocok ? '✓' : '✗'} ${JSON.stringify(nama)}${cocok ? '' : '   HARAP: ' + JSON.stringify(harap)}`);
  console.log(`      ${kenapa}`);
}
c('emoji hati CL TIDAK ikut ke nama berkas',
  !vp.visitationPdfName({ ...buat('visitasi', 3), leaderIds: ['a'] }, leaders).includes('💚'));

console.log('\n' + (ok ? 'LULUS' : 'GAGAL'));
process.exit(ok ? 0 : 1);
