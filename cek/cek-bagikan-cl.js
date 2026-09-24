// 21 Sep 2026: langganan lewat useLiveAll → `subscribeX(uid, …)`, bukan `user.uid`.
// 16 Sep 2026: Bagikan PDF ke CORE Leader 📤 — tombol share di Rekap Visitasi
// 📊 (PDF per CORE, kop sewarna hatinya), Timeline 📍, & Wheel of Life 🎡
// membuka sheet pilih CL: nomor HP + kapan terakhir dibagikan (dicatat di
// users/{uid}/core/shares, ikut dicetak di kop PDF), lalu share sheet → chat
// WA ke nomor CL-nya. Nomor HP CL jadi WAJIB di form CORE Leader.
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const Module = require('module');

const ROOT = AKAR;
const OUT = path.join(__dirname, 'keluar-bagikan-cl');
const baca = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');

let gagal = 0;
function ok(nama, syarat, info = '') {
  if (syarat) console.log(`  ✅ ${nama}`);
  else { gagal++; console.log(`  ❌ ${nama}${info ? ` — ${info}` : ''}`); }
}

// ============ Dijalankan sungguhan: coreCalendar, core, pdfDoc, recapPdf ============
try {
  execFileSync(
    'npx',
    ['tsc',
      path.join(ROOT, 'lib/coreCalendar.ts'), path.join(ROOT, 'lib/core.ts'),
      path.join(ROOT, 'lib/format.ts'), path.join(ROOT, 'lib/pdfDoc.ts'),
      path.join(ROOT, 'lib/recapPdf.ts'),
      '--ignoreConfig', '--outDir', OUT, '--module', 'commonjs', '--target', 'es2020',
      '--skipLibCheck', '--esModuleInterop', '--moduleResolution', 'bundler'],
    { cwd: ROOT, stdio: 'pipe', shell: true },
  );
} catch { /* keluhan tipe tak menghalangi tsc membuat JS-nya */ }

// Yang ditangkap dari expo-print / expo-sharing: HTML & opsi share-nya.
const cetak = { html: null, share: null, nama: null };
class FileStub {
  constructor(a, b) { this.uri = b ? `${a}/${b}` : a; this.parentDirectory = 'dir'; this.exists = false; }
  delete() {}
  rename(n) { cetak.nama = n; this.uri = `dir/${n}`; }
}
const asli = Module._load;
Module._load = function (req, parent, isMain) {
  if (req === './firebase') return { db: {} };
  if (req === './liveDoc') return { liveDoc: () => () => {}, liveList: () => () => {} };
  if (req === './photo') return { pickCompressedImage: async () => null };
  if (req.startsWith('firebase/')) return new Proxy({}, { get: () => () => ({}) });
  if (req === '@/assets/logoCoreGwu') return { LOGO_CORE_GWU_DATA_URI: 'data:image/png;base64,LOGO' };
  if (req === 'expo-print') return { printToFileAsync: async ({ html }) => { cetak.html = html; return { uri: 'cache/Print/acak.pdf' }; } };
  if (req === 'expo-sharing') return { isAvailableAsync: async () => true, shareAsync: async (uri, opsi) => { cetak.share = { uri, ...opsi }; } };
  if (req === 'expo-file-system') return { File: FileStub };
  return asli(req, parent, isMain);
};
const K = require(path.join(OUT, 'coreCalendar.js'));
const C = require(path.join(OUT, 'core.js'));
const P = require(path.join(OUT, 'pdfDoc.js'));
const R = require(path.join(OUT, 'recapPdf.js'));
Module._load = asli;

const ts = (y, m, d, h = 19) => {
  const dt = new Date(y, m - 1, d, h, 0);
  return { toDate: () => dt, toMillis: () => dt.getTime() };
};
const visit = (id, kind, leaderIds, y, m, d, done, extra = {}) => ({
  id, kind, leaderIds, thanksgiving: false, date: ts(y, m, d), agenda: '', note: '', done,
  pdfSentDayId: null, ...extra,
});
const A = { id: 'a', name: 'Andi', heart: '💚', birthYear: 2000, birthMonth: 0, birthDay: 1, phone: '81234567890', lastFollowupDayId: null };
const B = { id: 'b', name: 'Bela', heart: '💜', birthYear: 2000, birthMonth: 0, birthDay: 1, phone: null, lastFollowupDayId: null };
// Sengaja TIDAK urut tanggal: rekapnya harus mengurutkan sendiri.
const V = [
  visit('v2', 'visitasi', ['a'], 2026, 5, 20, true),
  visit('v1', 'visitasi', ['a'], 2026, 2, 12, true),
  visit('v3', 'fellowship', ['a'], 2026, 3, 1, true, { thanksgiving: true }),
  visit('v4', 'coreGabungan', ['a', 'b'], 2026, 6, 6, true),
  visit('v5', 'visitasi', ['a'], 2026, 9, 30, false),
  visit('v6', 'visitasi', ['a'], 2025, 12, 1, true),
  visit('v7', 'thanksgiving', ['b'], 2026, 4, 4, true),
];

console.log('\n=== leaderRecap: rekap satu CORE (lib/coreCalendar) ===');
const ra = K.leaderRecap(V, 'a', 2026);
const baris = (r, kind) => r.rows.find((x) => x.kind === kind);
ok('satu baris per jenis, urutan MEETING_KINDS',
  ra.rows.length === C.MEETING_KINDS.length && ra.rows.every((r, i) => r.kind === C.MEETING_KINDS[i].key));
ok('tanggal per jenis ikut & URUT naik walau masukannya acak (12 Feb lalu 20 Mei)',
  baris(ra, 'visitasi').dates.map((d) => `${d.getDate()}/${d.getMonth() + 1}`).join(',') === '12/2,20/5');
ok('acara gabungan tetap sebuah pertemuan untuk CL yang ikut',
  baris(ra, 'coreGabungan').dates.length === 1 && baris(K.leaderRecap(V, 'b', 2026), 'coreGabungan').dates.length === 1);
ok('total = semua yang selesai tahun itu (4), tahun lain & yang belum selesai tidak dihitung', ra.total === 4);
ok('Thanksgiving: penanda 🎉 di acara lain ikut (1 Mar), hitungannya tetap di jenis aslinya',
  ra.thanksgiving && ra.thanksgiving.getMonth() === 2 && ra.thanksgiving.getDate() === 1 &&
  baris(ra, 'fellowship').dates.length === 1 && baris(ra, 'thanksgiving').dates.length === 0);
ok('jadwal belum selesai tahun itu masuk `upcoming` (v5 30 Sep), bukan ke baris',
  ra.upcoming.length === 1 && ra.upcoming[0].kind === 'visitasi' && ra.upcoming[0].date.getDate() === 30);
const rb = K.leaderRecap(V, 'b', 2026);
ok('CL lain: jenis Thanksgiving dihitung di barisnya sendiri & jadi tanggal Thanksgiving (4 Apr)',
  baris(rb, 'thanksgiving').dates.length === 1 && rb.total === 2 && rb.thanksgiving.getDate() === 4 && rb.upcoming.length === 0);
ok('tahun kosong → semua nol, thanksgiving null, tidak error',
  K.leaderRecap(V, 'a', 2024).total === 0 && K.leaderRecap(V, 'a', 2024).thanksgiving === null);

console.log('\n=== heartColor & catatan bagikan (lib/core) ===');
ok('💚 = hijau tua kop CORE biasa', C.heartColor('💚') === '#0C5C50');
ok('❤️ dikenali dengan maupun tanpa VS16', C.heartColor('❤️') === '#B71C1C' && C.heartColor('❤') === '#B71C1C');
ok('hati tak dikenal → hijau tua', C.heartColor('🌟') === '#0C5C50' && C.heartColor('') === '#0C5C50');
const lum = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return (0.2126 * (n >> 16) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
};
ok('semua 12 hati punya warna hex & cukup GELAP untuk tulisan putih (💛/🤍 bukan kuning/putih)',
  C.HEARTS.every((h) => /^#[0-9A-F]{6}$/i.test(C.heartColor(h)) && lum(C.heartColor(h)) < 0.45) &&
  C.heartColor('💛') !== '#FFFF00' && C.heartColor('🤍') !== '#FFFFFF');
ok('lastSharedTo: tanpa catatan → null; ada → Date',
  C.lastSharedTo(null, 'a', 'recap') === null && C.lastSharedTo({}, 'a', 'recap') === null &&
  C.lastSharedTo({ a: { recap: ts(2026, 9, 7) } }, 'a', 'recap').getDate() === 7 &&
  C.lastSharedTo({ a: { recap: ts(2026, 9, 7) } }, 'a', 'wheel') === null);
const core = baca('lib/core.ts');
ok('catatan di users/{uid}/core/shares, ditulis MERGE satu field (bukan menulis ulang daftar CL)',
  /doc\(db, 'users', uid, 'core', 'shares'\)/.test(core) &&
  /\{ \[leaderId\]: \{ \[kind\]: Timestamp\.fromDate\(when\) \} \},\s*\n\s*\{ merge: true \}/.test(core) &&
  /export type ShareDocKind = 'recap' \| 'timeline' \| 'wheel';/.test(core));

console.log('\n=== pdfDoc: chip penerima & kop berwarna ===');
ok('recipientChips(null) kosong; ada penerima → Untuk + Terakhir dibagikan ("Baru pertama kali")',
  P.recipientChips(null).length === 0 &&
  JSON.stringify(P.recipientChips({ name: 'Andi', heart: '💚', lastShared: null }).map((c) => [c.label, c.value])) ===
    JSON.stringify([['Untuk', '💚 Andi'], ['Terakhir dibagikan', 'Baru pertama kali']]));
ok('lastSharedLabel memakai tanggal ringkas + jam (bentuk kartu sempit, tahun 2 angka)',
  P.lastSharedLabel(new Date(2026, 8, 7, 19, 0)) === 'Sen, 7 Sep 26 · 🕒 19.00');
const dasar = { eyebrow: 'X', title: 'Y', chips: [], bodyHtml: '<p>isi</p>', footerNote: 'kaki' };
ok('accent hex → kop & tebal kaki ikut warnanya, teks kecil kop jadi putih redup',
  /\.kop \{ background: #6A2C91; \}/.test(P.pdfShellHtml({ ...dasar, accent: '#6A2C91' })) &&
  /\.kaki-teks b \{ color: #6A2C91; \}/.test(P.pdfShellHtml({ ...dasar, accent: '#6A2C91' })) &&
  /rgba\(255,255,255,0\.8\)/.test(P.pdfShellHtml({ ...dasar, accent: '#6A2C91' })));
ok('accent bukan hex (mis. "red") DIABAIKAN, tanpa accent kop tetap hijau bersama',
  !/background: red/.test(P.pdfShellHtml({ ...dasar, accent: 'red' })) &&
  !/\.kop \{ background: #/.test(P.pdfShellHtml(dasar)) && /background: #0C5C50;/.test(P.pdfShellHtml(dasar)));

console.log('\n=== shareRecapPdf: PDF rekap untuk satu CORE ===');
(async () => {
  await R.shareRecapPdf(A, V, 2026, null, new Date(2026, 8, 16, 10, 30));
  const h = cetak.html;
  ok('kop: REKAP VISITASI 2026 · judul dengan hati & nama · sewarna hati (💚 hijau tua)',
    /REKAP VISITASI 2026/.test(h) && /Rekap Visitasi 💚 Andi/.test(h) && /\.kop \{ background: #0C5C50; \}/.test(h));
  ok('chip: Tahun, Pertemuan selesai 4×, Thanksgiving 1 Mar, Terakhir dibagikan = Baru pertama kali, Dicetak',
    /<span>Tahun<\/span><br\/>2026/.test(h) && /<span>Pertemuan selesai<\/span><br\/>4×/.test(h) &&
    /<span>Thanksgiving<\/span><br\/>1 Mar/.test(h) && /<span>Terakhir dibagikan<\/span><br\/>Baru pertama kali/.test(h) &&
    /<span>Dicetak<\/span>/.test(h));
  ok('tabel: tiap jenis dengan jumlah & TANGGAL-nya ("2×" · "12 Feb · 20 Mei"), jenis kosong pudar "·"',
    /🔥 Visitasi CORE<\/span>\s*<span class="jumlah">2×<\/span>\s*<span class="tanggal">12 Feb · 20 Mei<\/span>/.test(h) &&
    /class="baris kosong">\s*<span class="label">1️⃣ One-on-One<\/span>\s*<span class="jumlah">·<\/span>\s*<span class="tanggal">belum ada/.test(h));
  ok('baris Thanksgiving bertanggal utuh & baris Total 4×',
    /📅 Tanggal Thanksgiving<\/span>\s*<span class="jumlah">1×<\/span>\s*<span class="tanggal">Minggu, 1 Maret 2026/.test(h) && // 22 Sep 2026: 📅

    /class="baris total">\s*<span class="label">Total<\/span>\s*<span class="jumlah">4×<\/span>/.test(h));
  ok('jadwal yang masih menunggu ikut (30 Sep) & penutup hangat menyebut nama',
    /📅 Jadwal yang masih menunggu/.test(h) && /Rabu, 30 September 2026/.test(h) && /Terima kasih Andi & CORE 💚/.test(h));
  ok('share sheet: judul "Kirim ke WhatsApp 💚 Andi", nama berkas jelas, PDF',
    cetak.share.dialogTitle === 'Kirim ke WhatsApp 💚 Andi' && cetak.nama === 'Rekap Visitasi 2026 - Andi.pdf' &&
    cetak.share.mimeType === 'application/pdf');
  ok('isi PDF tanpa tanda pisah panjang', !h.includes('\u2014'));

  await R.shareRecapPdf(B, V, 2026, new Date(2026, 8, 7, 19, 0), new Date(2026, 8, 16));
  const h2 = cetak.html;
  ok('CORE 💜 → kop ungu; sudah pernah dibagikan → tanggalnya dicetak; tanpa jadwal menunggu → seksinya tidak ada',
    /\.kop \{ background: #6A2C91; \}/.test(h2) && /<span>Terakhir dibagikan<\/span><br\/>Sen, 7 Sep 26 · 🕒 19\.00/.test(h2) &&
    !/Jadwal yang masih menunggu/.test(h2));
  ok('nama dengan karakter HTML di-escape',
    (await R.shareRecapPdf({ ...A, name: 'A<b>' }, V, 2026, null), /A&lt;b&gt;/.test(cetak.html) && !/A<b>/.test(cetak.html)));

  statis();
})().catch((e) => { console.log('  ❌ error tak terduga: ' + e.stack); gagal++; statis(); });

// ============ Statis: sheet, layar, form ============
function statis() {
  console.log('\n=== Sheet bersama: components/core/ShareToLeaderSheet ===');
  const sheet = baca('components/core/ShareToLeaderSheet.tsx');
  ok('SheetModal "📤 Share to CORE Leader" dengan nama dokumen sebagai anak judul',
    /title="📤 Share to CORE Leader"/.test(sheet) && /subtitle=\{doc\}/.test(sheet));
  ok('mendengarkan CL + catatan bagikan, BARU setelah sheet pernah dibuka (bukan sejak layar dibuka)',
    /subscribeCoreLeaders\(uid, setLeaders, fail\),\s*\n\s*subscribeShareLog\(uid, setLog, fail\),/.test(sheet) &&
    /\{ onError: setError, when: pernahDibuka \}/.test(sheet) && /if \(visible && !pernahDibuka\) setPernahDibuka\(true\);/.test(sheet));
  ok('baris CL: hati, nama, nomor (+62 / belum ada nomor), 📤 terakhir dibagikan / belum pernah',
    /\{l\.heart\}/.test(sheet) && /📱 \{l\.phone \? `\+62\$\{l\.phone\}` : 'belum ada nomor'\}/.test(sheet) &&
    /`📤 Terakhir dibagikan \$\{formatCompactDateTime\(terakhir\)\}`/.test(sheet) && /'📤 Belum pernah dibagikan'/.test(sheet));
  // 22 Sep 2026: urutannya pindah ke lib/shareLeader.ts (dipakai sheet & tombol
  // share Wheel/Timeline yang langsung ke CL-nya).
  const helper = baca('lib/shareLeader.ts');
  ok('urutan click CL: PDF (share sheet) → catat tanggal (abaikan gagal) → chat WA ke nomornya',
    /await share\(leader, lastSharedTo\(log, leader\.id, kind\)\);\s*\n\s*markSharedToLeader\(uid, leader\.id, kind, new Date\(\)\)\.catch\(\(\) => undefined\);\s*\n\s*if \(leader\.phone\) \{\s*\n\s*await openWhatsAppChat\(leader\.phone, sharePesanPengantar\(leader, doc\), onWaError\);/.test(helper) &&
    /task: \(\) =>\s*\n\s*shareDocToLeader\(\{\s*\n\s*uid,\s*\n\s*leader: l,\s*\n\s*kind,\s*\n\s*doc,\s*\n\s*log,\s*\n\s*share,/.test(sheet));
  ok('spinner cuma di baris yang sedang dibuat (useBusyTask key = id CL); baris lain terkunci',
    /const tugas = useBusyTask<string>\(\);/.test(sheet) && /const sibuk = tugas\.busy === l\.id;/.test(sheet) &&
    /disabled=\{tugas\.busy !== null\}/.test(sheet));
  ok('💬 = saudara area click (bukan anak Pressable), mati kalau tanpa nomor',
    /<EmojiButton\s*\n\s*emoji="💬"\s*\n\s*onPress=\{\(\) => bukaChat\(l\)\}\s*\n\s*disabled=\{!l\.phone \|\| tugas\.busy !== null\}/.test(sheet) &&
    /<\/PressableScale>\s*\n\s*<EmojiButton/.test(sheet));
  ok('pesan pengantar WA menyebut nama, hati, & nama dokumennya; error WA memakai WHATSAPP_ERROR bersama',
    /Halo \$\{l\.name\} \$\{l\.heart\} aku barusan kirim PDF \$\{doc\} ya/.test(helper) && /setError\(WHATSAPP_ERROR\)/.test(sheet));
  // 22 Sep 2026: baris "bagikan biasa" dibuang bersama pemakainya (Wheel &
  // Timeline tak lewat sheet lagi); sheet cuma untuk Rekap Visitasi.
  ok('tak ada lagi baris "bagikan biasa"; sheet tidak bisa ditutup saat sibuk',
    !/onSharePlain/.test(sheet) && !/Bagikan biasa/.test(sheet) &&
    /function tutup\(\) \{\s*\n\s*if \(tugas\.busy !== null\) return;/.test(sheet));
  ok('kartu baris memakai CARD bersama, jarak daftar 8', /row: \{\s*\n\s*\.\.\.CARD,[\s\S]{0,120}marginBottom: 8,/.test(sheet));

  console.log('\n=== Tiga layar memakai sheet yang sama ===');
  const rekap = baca('app/core-recap.tsx');
  ok('Rekap: tombol share di header (hanya kalau ada CL) → sheet kind="recap", PDF per CORE tahun yang dibuka',
    /leaders && leaders\.length > 0 \? \(\s*\n\s*<EmojiButton\s*\n\s*icon="square\.and\.arrow\.up"\s*\n\s*onPress=\{\(\) => setShareOpen\(true\)\}/.test(rekap) &&
    /kind="recap"/.test(rekap) && /doc=\{`Rekap Visitasi \$\{year\}`\}/.test(rekap) &&
    /shareRecapPdf\(l, visitations \?\? \[\], year, lastShared\)/.test(rekap) && !/onSharePlain/.test(rekap));
  const tl = baca('app/timeline.tsx');
  // 22 Sep 2026: Timeline milik satu CL LANGSUNG ke orangnya (useOwnerLeader +
  // shareDocToLeader), tanpa sheet; timeline sendiri (tanpa pemilik) bagikan biasa.
  ok('Timeline: share di header langsung ke CL pemiliknya; kind timeline; PDF memuat SEMUA tahun + penerima; tanpa pemilik = bagikan biasa',
    /icon="square\.and\.arrow\.up"\s*\n\s*onPress=\{handleShare\}/.test(tl) && !/ShareToLeaderSheet/.test(tl) &&
    /useOwnerLeader\(owner, unlocked\)/.test(tl) && /kind: 'timeline'/.test(tl) &&
    /shareTimelinePdf\(await muatSemua\(\), pemilik, \{\s*\n\s*name: l\.name,\s*\n\s*heart: l\.heart,\s*\n\s*lastShared,/.test(tl) &&
    /: shareTimelinePdf\(await muatSemua\(\), pemilik\),/.test(tl));
  const wh = baca('app/wheel.tsx');
  ok('Wheel: share di header langsung ke CL pemiliknya; kind wheel; nama dokumen ikut kuartal; PDF + penerima; tanpa pemilik = bagikan biasa',
    /icon="square\.and\.arrow\.up"\s*\n\s*onPress=\{handleShare\}/.test(wh) && !/ShareToLeaderSheet/.test(wh) &&
    /useOwnerLeader\(owner, unlocked\)/.test(wh) && /kind: 'wheel'/.test(wh) &&
    /doc: `\$\{judulDok\} \$\{quarterLabel\(year, q\)\}`,/.test(wh) &&
    /shareWheelPdf\(data, year, q, pemilik, \{\s*\n\s*name: l\.name,\s*\n\s*heart: l\.heart,\s*\n\s*lastShared,/.test(wh) &&
    /: shareWheelPdf\(data, year, q, pemilik\),/.test(wh));
  const tpdf = baca('lib/timelinePdf.ts');
  const wpdf = baca('lib/wheelPdf.ts');
  ok('PDF Timeline & Wheel: chip penerima di kop, judul share sheet "Kirim ke WhatsApp <hati> <nama>" kalau ada penerima',
    /\.\.\.recipientChips\(penerima\),/.test(tpdf) && /\.\.\.recipientChips\(penerima\),/.test(wpdf) &&
    /penerima \? `Kirim ke WhatsApp \$\{penerima\.heart\} \$\{penerima\.name\}` : 'Bagikan Timeline'/.test(tpdf) &&
    /\? `Kirim ke WhatsApp \$\{penerima\.heart\} \$\{penerima\.name\}`\s*\n\s*: 'Bagikan Wheel of Life'/.test(wpdf));
  ok('rekapPdf memakai leaderRecap (hitungan teruji) & heartColor untuk kopnya',
    /leaderRecap\(visitations, leader\.id, year, leader\.thanksgivingDayId \?\? null\)/.test(baca('lib/recapPdf.ts')) && /accent: heartColor\(leader\.heart\)/.test(baca('lib/recapPdf.ts')));

  console.log('\n=== Form CORE Leader: nomor HP wajib ===');
  const lt = baca('components/core/LeadersTab.tsx');
  ok('CL: nama lalu nomor HP wajib (normalizePhone null → pesan), nomornya yang sudah rapi yang disimpan',
    /setFormError\('Nama wajib diisi\.'\);[\s\S]{0,600}const phone = normalizePhone\(fPhone\);\s*\n\s*if \(!phone\) \{\s*\n\s*setFormError\('No\. HP wajib diisi \(nomor WhatsApp CL\)\.'\);/.test(lt) &&
    /birthDay: fBirthday\.getDate\(\),\s*\n\s*phone,\s*\n/.test(lt));
  ok('Main Team TIDAK ikut diwajibkan (masih normalizePhone(mtPhone) langsung)', /phone: normalizePhone\(mtPhone\),/.test(lt));

  console.log(gagal === 0 ? '\n✅ LULUS — bagikan PDF ke CORE Leader lengkap.' : `\n❌ ${gagal} cek gagal.`);
  process.exit(gagal === 0 ? 0 : 1);
}
