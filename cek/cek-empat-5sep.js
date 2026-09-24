// Empat permintaan (5 Sep 2026):
//   1. Reminder Friends menyebut JADWALNYA — sesi & tagihan yang sesungguhnya,
//      dengan emoji & tanggal, bukan kalimat umum.
//   2. Reward: papan kategori jadi grid 3 kolom; diklik → HALAMAN, bukan
//      modal.
//   3. "Squad & Setoran" jadi bagian buka-tutup yang dipatok, seperti Anggota /
//      CORE Leader / Main Team.
//   4. Jarak judul bagian: atas = bawah, dan seragam di seluruh app.
const AKAR = require('./akar');
const fs = require('fs');
const ts = require(AKAR + '/node_modules/typescript');
const R = AKAR + '/';
const baca = (f) => fs.readFileSync(R + f, 'utf8').replace(/\r\n/g, '\n');
const kode = (f) =>
  baca(f)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

let ok = true;
const c = (n, s, extra) => {
  if (!s) ok = false;
  console.log((s ? '  ✓ ' : '  ✗ ') + n + (!s && extra ? ` → ${extra}` : ''));
};

const tsc = (src) =>
  ts.transpileModule(src, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
  }).outputText;
const pasang = (js, req) => {
  const mod = { exports: {} };
  new Function('exports', 'module', 'require', js)(mod.exports, mod, req);
  return mod.exports;
};
const shim = (nama) => {
  if (nama === './firebase') return { db: {} };
  if (nama === './liveDoc') return { liveDoc: () => () => {} };
  if (nama === 'firebase/firestore') return new Proxy({}, { get: () => () => ({}) });
  if (nama === './format') return format;
  return {};
};
const format = pasang(tsc(baca('lib/format.ts')), () => ({}));
const sport = pasang(tsc(baca('lib/futsal.ts')), shim);

// ============================================================
console.log('=== 1. Reminder Friends menyebut jadwalnya ===');
// ============================================================
const sesi = (isi) => ({
  id: 's', gang: 'core', dayId: '2026-09-05', time: '18.00', venue: 'ASABA',
  fee: 53000, squad: [], paid: [], games: [], note: '', ...isi,
});
const NOW = new Date(2026, 8, 4, 14, 0);

{
  const data = { members: [], cash: [], sessions: [sesi({ id: 'a', squad: ['x', 'y'] })] };
  const baris = sport.futsalReminders(data, NOW);
  c('satu sesi = satu baris', baris.length === 1 && baris[0].id === 'a');
  // Persis kosakata kartu di dalam fiturnya: emoji geng, 🗓️ tanggal, jam.
  c('barisnya memuat emoji geng, tanggal lengkap & jamnya',
    baris[0].text === '⛪ CORE · 🗓️ Sabtu, 5 Sep 2026 · 18.00 - BESOK · 💸 2 belum setor',
    baris[0].text);
}
{
  const data = { members: [], cash: [], sessions: [sesi({ dayId: '2026-09-04' })] };
  c('hari-H ditulis "HARI INI", bukan "0 hari lagi"',
    /- HARI INI/.test(sport.futsalReminders(data, NOW)[0].text));
}
{
  const data = { members: [], cash: [], sessions: [sesi({ dayId: '2026-09-06' })] };
  c('lusa ditulis "2 hari lagi"',
    /- 2 hari lagi/.test(sport.futsalReminders(data, NOW)[0].text));
}
{
  // Sesi lewat masuk HANYA kalau setorannya belum lunas — aturan yang sama
  // dengan angka badge-nya, jadi kartu & badge tak pernah berselisih.
  const lunas = { members: [], cash: [], sessions: [sesi({ dayId: '2026-08-20', squad: ['x'], paid: ['x'] })] };
  const belum = { members: [], cash: [], sessions: [sesi({ dayId: '2026-08-20', squad: ['x'] })] };
  c('sesi lewat yang lunas tidak diungkit lagi', sport.futsalReminders(lunas, NOW).length === 0);
  c('sesi lewat yang belum lunas tetap ditagih',
    /lewat 15 hari · 💸 1 belum setor/.test(sport.futsalReminders(belum, NOW)[0].text),
    sport.futsalReminders(belum, NOW)[0]?.text);
}
{
  // Yang AKAN DATANG di atas: itu yang masih bisa diurus. Sesi lewat cuma bisa
  // ditagih, tak ada lagi yang bisa dibatalkan.
  const data = {
    members: [], cash: [],
    sessions: [
      sesi({ id: 'lewat', dayId: '2026-08-20', squad: ['x'] }),
      sesi({ id: 'jauh', dayId: '2026-09-06' }),
      sesi({ id: 'dekat', dayId: '2026-09-04' }),
    ],
  };
  c('urutannya: akan datang (terdekat dulu) baru yang lewat',
    sport.futsalReminders(data, NOW).map((r) => r.id).join(' ') === 'dekat jauh lewat',
    sport.futsalReminders(data, NOW).map((r) => r.id).join(' '));
}
{
  const jauh = { members: [], cash: [], sessions: [sesi({ dayId: '2026-10-01' })] };
  c('sesi yang masih jauh tidak ikut menyesaki kartunya',
    sport.futsalReminders(jauh, NOW).length === 0);
}

const dash = baca('app/reminders.tsx');
c('Dashboard memakai barisnya, bukan kalimat umum lagi',
  /texts=\{friendsRows\}/.test(dash) && /futsalReminders\(futsal, now\)/.test(dash));
c('patungan yang belum lunas ikut satu kartu',
  /billUnsettled\)\s*\n\s*\.map\(\(b\) => \(\{/.test(dash) &&
  /orang belum bayar/.test(dash));
// Idnya diberi awalan: dua sumber, dua tujuan berbeda.
c('tiap baris menuju rinciannya sendiri (sesi vs nota)',
  /pathname: '\/bill\/\[id\]'/.test(dash) && /pathname: '\/futsal\/\[id\]'/.test(dash) &&
  /\`sesi:\$\{r\.id\}\`/.test(dash) && /\`nota:\$\{b\.id\}\`/.test(dash));
c('judulnya menyebut fiturnya', /🤝 Reminder Friends/.test(dash));
c('kartunya ikut menyalakan "ada yang harus dikerjakan"',
  /friendsRows\.length > 0 \|\|\s*\n\s*anyBadgeReminder/.test(dash));
// Dua kartu untuk hal yang sama adalah yang justru dihindari berkas itu.
const badge = baca('components/reminders/BadgeReminders.tsx');
c('Friends TIDAK lagi punya kartu kalimat umum di BadgeReminders',
  !/friends: \{/.test(badge) && /device: \{/.test(badge));
c('futsalAttention tak lagi dipanggil dua kali arti di Dashboard',
  !/futsalAttention/.test(dash));

// ============================================================
console.log('\n=== 2. Reward: grid kategori & halaman rinciannya ===');
// ============================================================
const achv = baca('app/reward.tsx');
const achvKode = kode('app/reward.tsx');
const laman = baca('app/reward-category.tsx');

c('halaman rincian kategori ada', fs.existsSync(R + 'app/reward-category.tsx'));
c('kategori digambar sebagai grid, bukan kartu memanjang',
  /<View style=\{badgeGrid\.grid\}>/.test(achv) && !/styles\.catCard/.test(achvKode));
c('diklik → HALAMAN, bukan modal',
  /pathname: '\/reward-category',\s*\n\s*params: \{ cat: cat\.key \}/.test(achv) &&
  !/setOpenCat/.test(achvKode));
c('modal kategorinya benar-benar dibongkar',
  !/openCat/.test(achvKode) && !/activeList/.test(achvKode));
c('petak lencananya SATU komponen bersama, bukan dua salinan',
  fs.existsSync(R + 'components/common/BadgeTile.tsx') &&
  /<BadgeTile/.test(achv) && /<BadgeTile/.test(laman));
c('lebar petak & pembungkus gridnya tinggal di satu berkas',
  /width: '33\.33%'/.test(baca('components/common/BadgeTile.tsx')) &&
  !/width: '33\.33%'/.test(achv) && !/width: '33\.33%'/.test(laman));
// Angka mentahnya dirakit sekali: dua layar yang menghitung sendiri-sendiri
// bisa menyebut streak yang berbeda, dan tak ada cara menebak mana yang benar.
c('angka mentahnya dirakit di hook bersama',
  fs.existsSync(R + 'hooks/useRewardStats.ts') &&
  /useRewardStats\(\)/.test(achv) && /useRewardStats\(\)/.test(laman));
c('layar utama tidak lagi merakit sendiri', !/RewardStats = \{/.test(achv));
c('halamannya memampang angka sekarang di pojok kanan atas',
  /right=\{\s*\n\s*sekarang \? \(/.test(laman) &&
  /const sekarang = key \? categoryNow\(key, stats\) : null;/.test(laman));
// Nama kategori datang dari URL — disaring, bukan dipercaya.
c('kategori asing di URL → halaman kosong yang jujur, bukan layar rusak',
  /const key = rewardCategoryOf\(cat\);/.test(laman) &&
  /if \(!meta\) \{/.test(laman));
c('rinciannya tetap ada (keterangan + tanggal + batang)',
  /picked\.detail\?\.\(stats\)/.test(laman) && /pickedCard/.test(laman));
c('pil 🔥 & tombol reward menuju halaman itu langsung',
  /pathname: '\/reward-category'/.test(baca('components/common/StreakPill.tsx')) &&
  /pathname: '\/reward-category'/.test(baca('components/common/RewardButton.tsx')));
c('rutenya sudah terdaftar di typed routes',
  baca('.expo/types/router.d.ts').includes('/reward-category'));
// Kategori yang sudah dijalani tidak boleh sepudar yang belum disentuh.
c('petak kategori berwarna begitu ADA satu yang terbuka',
  /const mulai = done > 0;/.test(achv) && /unlocked=\{mulai\}/.test(achv));
c('kemajuannya masih terbaca di tiap petak', /styles\.catBar/.test(achv));

// ============================================================
console.log('\n=== 3. Squad & Setoran: dipatok & bisa ditutup ===');
// ============================================================
const layar = baca('app/futsal/[id].tsx');
c('judulnya memakai komponen yang sama dengan Anggota & CORE',
  /<SectionToggle\s*\n\s*title="👥 Squad & Payment"/.test(layar));
c('nomor patokannya konstan di luar komponen',
  /^const STICKY_HEADERS = \[1, 3, 5\];$/m.test(layar) &&
  /stickyHeaderIndices=\{STICKY_HEADERS\}/.test(layar));
{
  // Nomor patokan menghitung ANAK LANGSUNG ScrollView — diperiksa sungguhan,
  // bukan dipercaya dari komentarnya.
  const a = layar.indexOf('stickyHeaderIndices={STICKY_HEADERS}');
  const b = layar.indexOf('      </ScrollView>', a);
  const anak = layar
    .slice(a, b)
    .split('\n')
    .filter((l) => /^ {8}<[A-Za-z]/.test(l));
  // 6 Sep 2026: Game & Score dan Catatan ikut jadi bagian buka-tutup yang
  // SAMA, dan ketiga judulnya dipatok. Polanya jadi berselang-seling: judul di
  // anak ganjil, isinya di anak genap tepat sesudahnya.
  c('judulnya di anak ganjil (1·3·5), isinya di anak genap',
    anak.length === 7 &&
      [1, 3, 5].every((i) => anak[i].includes('<SectionToggle')) &&
      [0, 2, 4, 6].every((i) => /^<View[ >]/.test(anak[i].trim())),
    anak.map((l, i) => `${i}:${l.trim().slice(0, 14)}`).join(' '));
  // Jaraknya menempel di blok uang, BUKAN di judul yang dipatok: jarak atas
  // pada yang dipatok ikut menempel di layar sebagai pita menganga.
  c('jarak sebelum judul yang dipatok ditaruh di blok uang',
    /moneyBlock: \{ marginBottom: \d+ \}/.test(layar) &&
      /<View style=\{styles\.moneyBlock\}>/.test(layar) &&
      /paddingTop: 0,/.test(baca('components/common/SectionToggle.tsx')));
}
c('isinya baru digambar saat bagiannya terbuka', /\{squadOpen &&/.test(layar));
// 6 Sep 2026 (malam): ketiganya jadi AKORDEON. Squad & Setoran yang terbuka
// begitu masuk — itu yang dicari duluan; Game & Score dan Catatan diisi sesudah
// mainnya selesai. Ringkasan di judulnya justru makin penting sekarang: dua
// dari tiga bagian SELALU tertutup.
c('bawaannya Squad & Setoran, ringkasannya tetap terbaca di judul',
  /useAccordion<Bagian>\('squad'\)/.test(layar) &&
  /sub=\{ringkasSquad\}/.test(layar));
// Aturannya di hooks/useAccordion.ts, dijalankan di cek-akordion.js.
c('diklik lagi menutup, bukan macet terbuka',
  /useAccordion<Bagian>\('squad'\)/.test(layar));
// Menutup daftarnya tidak boleh berarti kehilangan kabar terpentingnya.
c('kepala bagiannya meringkas isi yang disembunyikan',
  /sub=\{ringkasSquad\}/.test(layar) && /belum setor/.test(layar));
c('urutan barisnya tetap yang kemarin (setoran di atas, absen di bawah)',
  /barisSquad\.map\(\(m\) => \{/.test(layar));

// ============================================================
console.log('\n=== 4. Jarak judul bagian: atas = bawah, seragam ===');
// ============================================================
const spasi = pasang(tsc(baca('assets/style/section.ts')), () => ({}));
c('atas & bawahnya SAMA BESAR',
  spasi.SECTION_SPACE.marginTop === spasi.SECTION_SPACE.marginBottom,
  JSON.stringify(spasi.SECTION_SPACE));
c('lebih rapat dari yang dulu (14 di atas terasa terlalu jauh)',
  spasi.SECTION_SPACE.marginTop < 14 && spasi.SECTION_SPACE.marginTop >= 8);
// ViewStyle akan ditolak TypeScript saat disebar ke gaya TEKS — dan judul
// bagian memang <VixText>.
c('tipenya tidak dikunci ke ViewStyle',
  /export const SECTION_SPACE: { marginTop: number; marginBottom: number }/.test(
    baca('assets/style/section.ts'),
  ));
{
  const semua = require('child_process')
    .execSync('grep -rn "sectionTitle: {" --include=*.tsx app components', { cwd: R, encoding: 'utf8' })
    .trim().split('\n');
  const sendiri = semua.filter((l) => /marginTop/.test(l));
  c('tak ada lagi layar yang menulis angkanya sendiri',
    sendiri.length === 0, sendiri.slice(0, 3).join(' | '));
  const pemakai = require('child_process')
    .execSync('grep -rn "\\.\\.\\.SECTION_SPACE" --include=*.tsx app components', { cwd: R, encoding: 'utf8' })
    .trim().split('\n');
  // Ambangnya turun 19 → 18 pada 10 Sep 2026 karena satu PEMAKAINYA dibuang
  // (bagian '🎯 Target yang dikejar' di tab Progress), BUKAN karena ada layar
  // yang balik menulis angkanya sendiri — itu dijaga cek tepat di atas ini.
  c('yang memakai patokan bersama BANYAK (bukan cuma satu-dua)',
    pemakai.length >= 18, String(pemakai.length));
}
// Judul yang dipatok memakai PADDING (margin tak ikut mewarnai latar), tapi
// angkanya harus tetap angka yang sama.
const toggle = baca('components/common/SectionToggle.tsx');
// Jarak ATASNYA kemudian dinolkan (permintaan 4 Sep 2026): judul ini hampir
// selalu dipatok, dan yang dipatok berhenti tepat di bawah deretan tab — ruang
// kosong di atasnya jadi pita menganga yang ikut ke mana-mana. Jarak BAWAHnya
// tetap seangka dengan judul bagian biasa.
c('judul yang dipatok: rapat di atas, jarak baku di bawah',
  /paddingTop: 0,/.test(toggle) &&
  /paddingBottom: SECTION_SPACE\.marginBottom/.test(toggle));
c('latarnya tetap pekat (kalau bolong, daftarnya tembus saat digulung)',
  /backgroundColor: Color\.BACKGROUND/.test(toggle));

console.log(ok ? '\n✅ LULUS — reminder, grid, patokan & jarak terbukti.' : '\n❌ ADA YANG GAGAL');
process.exit(ok ? 0 : 1);
