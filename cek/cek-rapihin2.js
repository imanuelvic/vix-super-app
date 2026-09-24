// Buktikan hasil rapihin batch ini: pola kembar hilang, tapi tampilan &
// perilakunya persis sama seperti sebelum disunting.
const AKAR = require('./akar');
const fs = require('fs');
const ts = require(AKAR + '/node_modules/typescript');
const R = AKAR + '/';
const baca = (f) => fs.readFileSync(R + f, 'utf8');

let ok = true;
const c = (n, s) => { if (!s) ok = false; console.log((s ? '  ✓ ' : '  ✗ ') + n); };

console.log('=== 1. Buka tautan luar: satu pintu (lib/linking.ts) ===');
const link = baca('lib/linking.ts');
c('openExternalUrl ada & tak pernah melempar',
  /export async function openExternalUrl/.test(link) &&
    (link.match(/try \{/g) || []).length === 2);
c('urutan: coba utama → cadangan → baru onError',
  /await Linking\.openURL\(url\)[\s\S]*?if \(!fallback\) \{[\s\S]*?onError\?\.\(\)[\s\S]*?await Linking\.openURL\(fallback\)/.test(link));
// Perilaku tiap pemanggil harus SAMA dengan sebelum dirapikan.
const SEBELUM = {
  'spiritual · NDC Ministry':  { utama: 'ndc://',            cadangan: 'App Store NDC',    onError: '—' },
  'habits · pintasan app luar':{ utama: 'link.external.scheme', cadangan: 'link.external.web', onError: '—' },
  'whatsapp · share teks':     { utama: 'whatsapp://send',   cadangan: 'wa.me',            onError: 'ada' },
  'whatsapp · chat ke nomor':  { utama: 'wa.me/62…',         cadangan: '—',                onError: 'opsional' },
  'GoldTab · Logam Mulia':     { utama: 'LOGAM_MULIA_URL',   cadangan: '—',                onError: 'ada' },
};
// 23 Sep 2026: lib/payapps.ts DIHAPUS — tidak ada lagi tombol lompat ke app
// pembayaran (Bank JAGO, GoPay, Bibit, dst). Yang dijaga sekarang: hapusnya
// bersih, tidak menyisakan berkas, impor, atau tombol yatim.
c('payapps: benar-benar hilang, tanpa sisa',
  !fs.existsSync(R + 'lib/payapps.ts') &&
  !/payApp|PayApp|payapps/.test(baca('components/finance/TransactionsTab.tsx')) &&
  !/payApp|PayApp|payapps/.test(baca('app/saku/[key].tsx')));
c('NDC Ministry: deeplink → cadangan App Store',
  /openExternalUrl\(NDC_DEEPLINK, \{ fallback: NDC_APP_STORE \}\)/.test(baca('lib/spiritual.ts')));
c('Habits: skema app luar → cadangan alamat web',
  /openExternalUrl\(link\.external\.scheme, \{ fallback: link\.external\.web \}\)/.test(baca('components/habits/HabitsTab.tsx')));
c('WhatsApp share: whatsapp:// → cadangan wa.me, pesan error dipertahankan',
  /openExternalUrl\(`whatsapp:\/\/send\?text=\$\{encoded\}`, \{\s*fallback: `https:\/\/wa\.me\/\?text=\$\{encoded\}`,\s*onError,/.test(baca('lib/whatsapp.ts')));
// Pesannya kini disimpan di state sendiri (setLinkError) sejak pengambilan
// harga pindah ke hook bersama useAsyncData — kalimat & tempat tampilnya sama.
c('GoldTab: tanpa cadangan, pesan errornya tetap "Gagal membuka tautan."',
  /openExternalUrl\(LOGAM_MULIA_URL, \{\s*onError: \(\) => setLinkError\('Gagal membuka tautan\.'\),/.test(baca('components/investment/GoldTab.tsx')));
c('pesan error Follow Up tetap kalimatnya yang lama (bukan disamakan)',
  /openWhatsAppChat\(phone, text, \(\) => setError\('Gagal membuka WhatsApp\.'\)\)/.test(baca('components/core/FollowupTab.tsx')));
c('tak ada lagi Linking.openURL berserakan di layar',
  (() => {
    const files = ['app/book/[key].tsx', 'components/fitness/ExerciseTab.tsx',
      'components/news/NewsTab.tsx', 'components/news/PopulationTab.tsx',
      'components/investment/GoldTab.tsx', 'components/habits/HabitsTab.tsx',
      'components/core/FollowupTab.tsx', 'app/morning-journey.tsx',
      'lib/spiritual.ts', 'lib/whatsapp.ts'];
    return files.every((f) => !/Linking\.openURL/.test(baca(f)));
  })());
c('Linking cuma di-import lib/linking.ts',
  (() => {
    const files = ['app/book/[key].tsx', 'components/fitness/ExerciseTab.tsx',
      'components/news/NewsTab.tsx', 'components/news/PopulationTab.tsx',
      'components/investment/GoldTab.tsx', 'components/habits/HabitsTab.tsx',
      'components/core/FollowupTab.tsx', 'app/morning-journey.tsx',
      'lib/spiritual.ts', 'lib/whatsapp.ts'];
    return files.every((f) => !/\bLinking\b/.test(baca(f)));
  })());
// Rumusnya SENGAJA tidak lagi "62 + apa adanya" (4 Sep 2026): dua fitur
// menyimpan nomor dengan cara berbeda — CORE menyimpan digit sesudah +62,
// Fun Futsal menyimpan bentuk lokal "0812…" — dan penempelan buta membuat nomor
// Fun Futsal jadi "62 0812…", yang tidak pernah membuka chat ke orang yang
// benar. Yang tetap dijaga: tempatnya di lib/whatsapp.ts, bukan lib/core.ts,
// dan cara menempelkan teksnya sama persis.
c('waLink tinggal di lib/whatsapp.ts & nomornya dirapikan dulu',
  baca('lib/whatsapp.ts').includes('const base = `https://wa.me/${waPhone(phone)}`;') &&
  baca('lib/whatsapp.ts').includes('return text ? `${base}?text=${encodeURIComponent(text)}` : base;') &&
  !/export function waLink/.test(baca('lib/core.ts')));

console.log('\n=== 2. InfoRow: satu komponen, dua layar ===');
const ir = baca('components/common/InfoRow.tsx');
// Nilai gaya ASLI, dicatat dari kedua file SEBELUM disatukan (keduanya identik).
c('row: sama persis dengan gaya lama di kedua layar',
  /flexDirection: 'row',\s*\n\s*justifyContent: 'space-between',\s*\n\s*alignItems: 'center',\s*\n\s*gap: 10,\s*\n\s*paddingVertical: 9,/.test(ir));
c("value: color TEXT_TITLE · flexShrink 1 · rata kanan",
  /value: \{ color: Color\.TEXT_TITLE, flexShrink: 1, textAlign: 'right' \}/.test(ir));
// 28 Agu 2026: nilainya boleh diberi warna khusus (`valueColor`) untuk baris
// yang isinya sekaligus PENILAIAN — "25,2 · Obesitas I" di kartu data tubuh
// CL. Tanpa prop itu warnanya tetap TEXT_TITLE seperti semula, jadi kedua
// layar Info (mobil & rumah) tidak berubah sedikit pun.
c('susunan JSX-nya tak berubah (label lalu nilai tebal)',
  /<VixText heading="label">\{label\}<\/VixText>\s*\n\s*<VixText\s*\n\s*heading="bold"\s*\n\s*additionalStyle=\{\[styles\.value, valueColor \? \{ color: valueColor \} : null\]\}>/.test(ir));
c('tanpa valueColor, warnanya persis seperti sebelumnya',
  /valueColor\?: string;/.test(ir) && /valueColor \? \{ color: valueColor \} : null/.test(ir));
for (const f of ['components/car/InfoTab.tsx', 'components/residence/InfoTab.tsx']) {
  const src = baca(f);
  c(`${f.split('/')[1]}: memakai InfoRow bersama`, /InfoRow \} from '@\/components\/common\/InfoRow'/.test(src));
  c(`${f.split('/')[1]}: salinan lokalnya sudah dibuang`, !/function InfoRow/.test(src));
  c(`${f.split('/')[1]}: gaya infoRow/infoValue lokal ikut dibuang`,
    !/infoRow:/.test(src) && !/infoValue:/.test(src));
  c(`${f.split('/')[1]}: pemakaian <InfoRow …/> tetap ada`, /<InfoRow/.test(src));
}

console.log('\n=== 3. Form Pertemuan: satu hook + satu blok isian ===');
const hook = baca('hooks/useVisitationForm.ts');
// Aturan yang DULU ditulis dua kali — harus tetap persis.
c('Thanksgiving diabaikan kalau jenisnya memang Thanksgiving',
  /thanksgiving: kind === 'thanksgiving' \? false : thanksgiving/.test(hook));
c('jadwal masa depan dipaksa belum selesai',
  /done: futureDate \? false : done/.test(hook));
c('agenda & judul dipangkas spasinya',
  /agenda: agenda\.trim\(\)/.test(hook) && /note: note\.trim\(\)/.test(hook));
c('pindah dari jenis gabungan → sisa SATU CORE',
  /if \(!isMultiLeaderKind\(k\)\) setLeaderIds\(\(ids\) => ids\.slice\(0, 1\)\)/.test(hook));
c('futureDate memakai rumus lama (daysBetween > 0)',
  /const futureDate = daysBetween\(new Date\(\), date\) > 0/.test(hook));
c('id & pdfSentDayId sengaja BUKAN urusan form',
  /Omit<Visitation, 'id' \| 'pdfSentDayId'>/.test(hook));

// Jalankan payload()-nya sungguhan.
const js = ts.transpileModule(
  "const useState = (v) => { let s = typeof v === 'function' ? v() : v; return [s, () => {}]; };\n" +
    'const Timestamp = { fromDate: (d) => ({ __ts: d.getTime() }) };\n' +
    "const isMultiLeaderKind = (k) => k === 'coreGabungan' || k === 'fellowshipGabungan';\n" +
    'const daysBetween = (a, b) => Math.round((new Date(b.getFullYear(),b.getMonth(),b.getDate()) - new Date(a.getFullYear(),a.getMonth(),a.getDate())) / 86400000);\n' +
    hook
      .replace(/^import[\s\S]*?from '[^']+';\n/gm, '')
      .replace(/export type VisitationForm[^\n]*\n/, '')
      .replace('export function', 'function') +
    '\nexports.useVisitationForm = useVisitationForm;',
  { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } },
).outputText;
const mod = { exports: {} };
new Function('exports', 'module', js)(mod.exports, mod);
const p = mod.exports.useVisitationForm().payload();
c('payload() bentuknya tepat 7 kolom, tanpa id & pdfSentDayId',
  Object.keys(p).sort().join(',') === 'agenda,date,done,kind,leaderIds,note,thanksgiving');

const fields = baca('components/core/VisitationFormFields.tsx');
c('urutan kolom tak berubah: jenis → Thanksgiving → CORE → tanggal → judul → agenda → selesai',
  (() => {
    // Label centangnya kamu pendekkan sendiri jadi "🎉 Thanksgiving".
    // 16 Sep 2026: label kolomnya kamu tulis ulang sendiri (huruf besar tiap
    // kata: 'CORE', '📆 Tanggal Visitasi', 'Agenda Visitasi').
    const urut = ['🏷️ Jenis Visitasi', '🎉 Thanksgiving', "'👥 CORE Gabungan' : '👥 CORE'",
      '📆 Tanggal Visitasi', '🏷️ Judul Visitasi', '🗒️ Agenda Visitasi', 'Sudah selesai ✅'];
    let pos = -1;
    return urut.every((t) => { const i = fields.indexOf(t); const naik = i > pos; pos = i; return naik; });
  })());
c('gaya isian dipindah apa adanya (fieldLabel 6 · gap 10 · textArea 96)',
  /fieldLabel: \{ marginBottom: 6 \}/.test(fields) &&
    /formGap: \{ marginBottom: 10 \}/.test(fields) &&
    /textArea: \{ minHeight: 96, paddingTop: 12, textAlignVertical: 'top' \}/.test(fields));
c('doneRow & doneText sama persis dengan yang lama',
  /doneRow: \{\s*\n\s*flexDirection: 'row',\s*\n\s*alignItems: 'center',\s*\n\s*gap: 12,\s*\n\s*paddingVertical: 6,\s*\n\s*marginBottom: 4,\s*\n\s*\}/.test(fields) &&
    /doneText: \{ color: Color\.TEXT_TITLE \}/.test(fields));

console.log('\n--- Beda kecil antar-layar yang HARUS tetap beda ---');
const vt = baca('components/core/VisitationTab.tsx');
const vs = baca('app/visitations.tsx');
c('placeholder agenda Pertemuan tetap "Agenda visitasi"',
  /agendaPlaceholder="Agenda visitasi"/.test(vt));
c('placeholder agenda Riwayat tetap "Apa yang akan dibahas ke mereka…"',
  /agendaPlaceholder="Apa yang akan dibahas ke mereka…"/.test(vs));
c('key DateField Pertemuan tetap menangani mode "new"',
  /dateKey=\{editing === 'new' \? 'new' : editing\?\.id\}/.test(vt));
c('key DateField Riwayat tetap id jadwalnya', /dateKey=\{editing\?\.id\}/.test(vs));
c('judul sheet Pertemuan tetap Jadwalkan/Edit',
  /title=\{editing === 'new' \? '📅 Schedule Visitation' : '✏️ Edit Visitation'\}/.test(vt));
c('judul sheet Riwayat tetap "✏️ Edit Visitation"', /title="✏️ Edit Visitation"/.test(vs));

console.log('\n--- Salinan lamanya benar-benar hilang ---');
for (const [nama, src] of [['Pertemuan', vt], ['Riwayat', vs]]) {
  c(`${nama}: state fKind/fLeaderIds/fDone tak ada lagi`,
    !/const \[fKind/.test(src) && !/const \[fLeaderIds/.test(src) && !/const \[fDone/.test(src));
  c(`${nama}: changeKind/toggleLeader lokal tak ada lagi`,
    !/function changeKind/.test(src) && !/function toggleLeader/.test(src));
  c(`${nama}: memakai hook & komponen bersama`,
    /const form = useVisitationForm\(\)/.test(src) && /<VisitationFormFields/.test(src));
  c(`${nama}: pdfSentDayId tetap dipertahankan saat simpan`, /pdfSentDayId/.test(src));
}
c('Riwayat: hapus tetap PERMANEN (array ditulis ulang tanpa item itu)',
  /saveVisitations\(user\.uid, all\.filter\(\(v\) => v\.id !== editing\.id\)\)/.test(vs));
c('Pertemuan: hapus tetap PERMANEN',
  /visitations\.filter\(\(v\) => v\.id !== editing\.id\)/.test(vt));
c('validasi "Pilih CORE Leader-nya dulu." tetap di kedua layar',
  /Pilih CORE Leader-nya dulu\./.test(vt) && /Pilih CORE Leader-nya dulu\./.test(vs));

console.log('\n' + (ok ? 'LULUS' : 'GAGAL'));
console.log('\nperilaku buka tautan — sebelum → sesudah (tetap sama):');
for (const [k, v] of Object.entries(SEBELUM)) {
  console.log(`  ${k.padEnd(28)} utama ${v.utama.padEnd(22)} cadangan ${v.cadangan.padEnd(18)} onError ${v.onError}`);
}
process.exit(ok ? 0 : 1);
