// Gratitude History 🙏 — dua janji yang harus benar-benar dipegang:
//
//   1. TIDAK ADA satu hari pun yang hilang. Yang kamu tulis tiap malam
//      tersimpan selamanya, dan semuanya bisa dijangkau dari layar itu.
//   2. "Gagal memuat data. Coba lagi." tidak muncul kalau tidak ada yang
//      benar-benar gagal.
//
// `subscribeHabitNotes` DIJALANKAN sungguhan di atas liveList tiruan (snapshot
// palsu dioper apa adanya), jadi yang diuji apa yang benar-benar terjadi pada
// datamu — bukan tulisan kodenya.
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');
const Module = require('module');
const { execFileSync } = require('child_process');

const R = AKAR + '/';
const OUT = path.join(__dirname, 'keluar-syukur');
const baca = (f) => fs.readFileSync(R + f, 'utf8');
const kode = (f) =>
  baca(f)
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

let ok = true;
const c = (n, s, extra) => {
  if (!s) ok = false;
  console.log((s ? '  ✓ ' : '  ✗ ') + n + (extra !== undefined ? `  → ${extra}` : ''));
};

// ---------- Kompilasi kode aslinya ----------
fs.rmSync(OUT, { recursive: true, force: true });
try {
  execFileSync(
    process.execPath,
    [
      R + 'node_modules/typescript/bin/tsc', '--ignoreConfig',
      R + 'lib/health.ts', R + 'lib/habits.ts',
      '--outDir', OUT,
      '--module', 'commonjs', '--target', 'es2020',
      '--skipLibCheck', '--esModuleInterop', '--moduleResolution', 'bundler',
    ],
    { stdio: 'pipe' },
  );
} catch { /* keluhan tipe diabaikan — hasil emit-nya yang dipakai */ }

const DIR = fs.existsSync(path.join(OUT, 'lib')) ? path.join(OUT, 'lib') : OUT;
for (const f of ['health.js', 'habits.js']) {
  if (!fs.existsSync(path.join(DIR, f))) {
    console.log(`  ✗ gagal mengompilasi ${f}`);
    process.exit(1);
  }
}

// ---------- Tiruan Firestore & liveList ----------
// liveList dicatat: kueri apa, pemetaan barisnya apa, dan callback-nya disimpan
// supaya bisa "dikirimi" snapshot palsu kapan saja.
const daftar = [];
let limitTerakhir = null;

Module._load = ((asli) => function (req, parent, isMain) {
  if (req === 'firebase/firestore') {
    return {
      collection: () => ({}), doc: () => ({ path: 'x' }), setDoc: async () => {},
      getDoc: async () => ({ data: () => ({}) }), onSnapshot: () => () => {},
      deleteDoc: async () => {}, addDoc: async () => ({}), updateDoc: async () => {},
      deleteField: () => '__d__', query: () => ({}), orderBy: () => ({}),
      documentId: () => '__name__',
      // Angka `limit` yang diminta ikut dicatat — inilah "sejauh apa riwayatmu
      // ditarik", dan tesnya harus bisa membuktikan ia memang naik.
      limit: (n) => { limitTerakhir = n; return {}; },
      writeBatch: () => ({}), arrayUnion: () => ({}),
      Timestamp: { fromDate: (d) => d, now: () => new Date() },
    };
  }
  if (req === './firebase' || req.endsWith('/firebase')) return { db: {} };
  if (req === './liveDoc' || req.endsWith('/liveDoc')) {
    return {
      liveDoc: () => () => {},
      unsubscribeAll: () => () => {},
      liveList: (q, onChange, onError, row) => {
        daftar.push({ q, onChange, onError, row });
        return () => {};
      },
    };
  }
  if (/^@\/assets\/style\/color$/.test(req)) {
    return { Color: new Proxy({}, { get: (_, k) => `Color.${String(k)}` }) };
  }
  if (/^(@\/|expo-|expo$|react-native|@react-native)/.test(req)) return {};
  return asli.call(this, req, parent, isMain);
})(Module._load);

const H = require(path.join(DIR, 'health.js'));
const HAB = require(path.join(DIR, 'habits.js'));

/** Dokumen habitDays palsu. */
const dok = (id, notes) => ({ id, data: () => ({ notes }) });

/** Pasang langganan lalu kirimi sekumpulan dokumen; kembalikan hasilnya. */
function jalankan(dokumen, max) {
  daftar.length = 0;
  let hasil = null;
  H.subscribeHabitNotes('u', 'syukur-1', (n) => { hasil = n; }, undefined, max);
  const e = daftar[0];
  e.onChange(dokumen.map(e.row));
  return hasil;
}

// =====================================================================
console.log('\n== 1. Tak ada hari yang hilang ==');
// =====================================================================

// Yang ditulis tiap malam masuk ke habitDays/{hari}.notes[id] — satu dokumen
// per hari. Semua penulisan ke dokumen itu HARUS merge; satu saja yang tidak,
// catatan syukur hari itu tertimpa habis oleh centang atau gelas air.
{
  const src = baca('lib/health.ts');
  const blokTulis = src
    .split(/\n\n/)
    .filter((b) => /habitDays/.test(b) && /setDoc/.test(b));
  c('semua penulisan ke habitDays memakai merge (catatan tak pernah tertimpa)',
    blokTulis.length >= 4 && blokTulis.every((b) => /merge: true/.test(b)),
    `${blokTulis.filter((b) => /merge: true/.test(b)).length}/${blokTulis.length} blok`);
}

// Barisnya dicari dari NAMANYA, dan catatannya berkunci id barisnya. Kalau
// barisnya bisa dihapus lalu dibuat lagi, id-nya berganti dan seluruh catatan
// lamamu jadi tak terjangkau — masih ada di Firestore, tapi hilang dari layar.
c('baris 🙏 Bersyukur 3 Hal tidak bisa dihapus (id-nya kekal)',
  HAB.isFixedHabit({ id: 'g', label: '🙏 Bersyukur 3 Hal' }) === true);
c('…karena centangnya datang dari tulisannya',
  HAB.isNoteDrivenHabit({ id: 'g', label: '🙏 Bersyukur 3 Hal' }) === true);
c('layar Habits memang menyembunyikan tombol hapusnya',
  /isFixedHabit\(editing\) \?/.test(baca('components/habits/HabitsTab.tsx')));

// Hari yang catatannya kosong dibuang dari DAFTAR, tapi tetap memakan jatah
// jendelanya — itu yang bikin `more` tidak boleh dihitung dari daftar jadinya.
{
  const hasil = jalankan(
    [
      dok('2026-09-01', { 'syukur-1': 'Fitur CORE lancar\nFutsal\nDianterin Felix' }),
      dok('2026-08-31', { lain: 'bukan syukur' }),
      dok('2026-08-30', { 'syukur-1': '   ' }),
      dok('2026-08-29', { 'syukur-1': 'Tuhan baik' }),
    ],
    120,
  );
  c('hari tanpa catatan syukur tidak ikut ditampilkan',
    hasil.days.length === 2, JSON.stringify(hasil.days.map((d) => d.dayId)));
  c('catatan yang isinya spasi saja dianggap kosong',
    !hasil.days.some((d) => d.dayId === '2026-08-30'));
  c('urutannya apa adanya dari Firestore (terbaru dulu)',
    hasil.days[0].dayId === '2026-09-01' && hasil.days[1].dayId === '2026-08-29');
  c('isi tulisannya utuh, tidak dipotong',
    hasil.days[0].text === 'Fitur CORE lancar\nFutsal\nDianterin Felix');
  c('catatan kebiasaan LAIN di hari yang sama tidak ikut terbaca',
    !hasil.days.some((d) => d.text === 'bukan syukur'));
}

// `more` = jendelanya penuh, jadi MUNGKIN masih ada yang lebih lama.
{
  const penuh = Array.from({ length: 5 }, (_, i) =>
    dok(`2026-08-0${i + 1}`, { 'syukur-1': 'x' }));
  c('jendela penuh → masih ada yang lebih lama untuk ditawarkan',
    jalankan(penuh, 5).more === true);
  c('jendela belum penuh → tidak ada lagi yang bisa ditarik',
    jalankan(penuh.slice(0, 4), 5).more === false);
  // Ini bagian yang paling mudah salah: daftarnya tinggal 1 baris, tapi
  // jendelanya PENUH — jadi tombolnya tetap harus ditawarkan.
  const banyakKosong = [
    dok('2026-08-05', { 'syukur-1': 'satu-satunya' }),
    ...Array.from({ length: 4 }, (_, i) => dok(`2026-08-0${i + 1}`, {})),
  ];
  const h = jalankan(banyakKosong, 5);
  c('daftar tinggal 1 baris tapi jendelanya penuh → tetap ditawarkan',
    h.days.length === 1 && h.more === true);
}

// Jendelanya memang bisa DINAIKKAN — kalau tidak, "muat yang lebih lama"
// cuma tombol yang menarik hal yang sama berulang kali.
{
  daftar.length = 0;
  limitTerakhir = null;
  H.subscribeHabitNotes('u', 'g', () => {});
  const bawaan = limitTerakhir;
  H.subscribeHabitNotes('u', 'g', () => {}, undefined, 240);
  c('bawaannya sejendela, dan pemanggilnya boleh minta lebih',
    bawaan === H.HABIT_NOTES_PAGE && limitTerakhir === 240,
    `${bawaan} → ${limitTerakhir}`);
}

console.log('\n   layar Riwayat Syukur');
const layar = baca('app/gratitude.tsx');
c('jendelanya naik sejendela tiap tombolnya di-click',
  /setJendela\(\(n\) => n \+ GRATITUDE_PAGE\)/.test(layar));
// 22 Sep 2026: efek langganannya jadi useLiveAll (callback & syarat sama).
c('jendelanya dioper ke langganannya & jadi dependency efeknya',
  /deps: \[gratitudeId, jendela\]/.test(layar) && /deps: \[jendela\]/.test(layar));
c('tombolnya muncul hanya kalau memang masih ada yang lebih lama',
  /\{adaYangLebihLama && \(/.test(layar) &&
  /const adaYangLebihLama = \(notes\?\.more \?\? false\) \|\| baru\.length >= jendela;/.test(layar));
// Tombolnya harus tetap ada walau daftarnya kosong: bisa saja seratus hari
// terakhir memang tak ada yang tercatat sedangkan yang lama ada.
const iKosong = layar.indexOf('Belum ada yang tercatat');
const iTombol = layar.indexOf('{adaYangLebihLama && (');
c('tombolnya di luar cabang "kosong", jadi tetap muncul saat daftarnya kosong',
  iKosong !== -1 && iTombol !== -1 && iKosong < iTombol);
c('langganannya tetap bergantung pada ID, bukan objek yang lahir tiap snapshot',
  /const gratitudeId = habits\?\.find\(isGratitudeHabit\)\?\.id \?\? null;/.test(layar) &&
    !/\}, \[user, gratitude\]\);/.test(layar));

// =====================================================================
console.log('\n== 2. "Gagal memuat data" yang tidak mau pergi ==');
// =====================================================================
// `onSnapshot` memanggil callback galatnya paling banyak SEKALI — sesudah itu
// listenernya selesai & tak pernah menyala lagi sendiri. Dulu itu berarti satu
// kedipan sinyal meninggalkan pesan merah yang menempel selamanya di atas data
// yang sebenarnya sudah tampil lengkap di bawahnya.
const live = baca('lib/liveDoc.ts');
c('listener yang mati dipasang ulang, bukan langsung dilaporkan',
  /const RETRY_MS = \[1_000, 4_000, 10_000\];/.test(live) &&
    /function pulihkan\(e: Pulih, error: FirestoreError, pasang: \(\) => void\)/.test(live));
c('jatahnya dibatasi (galat menetap tidak jadi coba-lagi tanpa henti)',
  /const jeda = RETRY_MS\[e\.gagal\];/.test(live) &&
    /if \(jeda === undefined\) \{/.test(live));
// Dua tempat, dua sebab berbeda — keduanya harus ada:
//   • data yang akhirnya sampai      → jatahnya pulih (kedipan besok dapat 3×)
//   • pemakai baru datang            → membuka layarnya lagi memang wajar
//     diartikan "coba lagi"
c('data yang akhirnya sampai mengembalikan jatahnya',
  (live.replace(/\r\n/g, '\n').match(/gagal = 0;\n\s*e\.last = snapshot;/g) ?? [])
    .length === 2);
// Ini bagian yang paling halus: listener matinya ikut TERSIMPAN, jadi layar
// yang dibuka sesudahnya mengira masih hidup & tidak memasang yang baru.
c('mayat listenernya tidak diwariskan ke layar berikutnya',
  /e\.stop = null;/.test(live) &&
    /if \(!e\.stop && !e\.retry\) \{/.test(live) &&
    /if \(!entry\.stop && !entry\.retry\) \{/.test(live));
c('pemakai baru mengembalikan jatah coba-laginya',
  (live.replace(/\r\n/g, '\n').match(/gagal = 0;\n\s*pasang(Doc|List)\(/g) ?? [])
    .length === 2);
// EMPAT tempat, dan keempatnya wajib: dua saat keluar akun (dokumen &
// koleksi), dua lagi saat pemakai terakhir pergi. Yang terlewat meninggalkan
// listener yang memasang dirinya sendiri untuk layar yang sudah ditutup.
c('coba-lagi yang menggantung ikut dibersihkan saat listenernya dilepas',
  (live.match(/if \(e\.retry\) clearTimeout\(e\.retry\);/g) ?? []).length === 3 &&
    (live.match(/if \(entry\.retry\) clearTimeout\(entry\.retry\);/g) ?? []).length === 1);

console.log('\n   layar Riwayat Syukur');
// Layar ini cuma MEMBACA. Kalau riwayatnya sudah terpampang, kegagalan
// menyegarkan bukan kabar yang layak ditulis merah-merah di atasnya — yang
// terbaca malah "catatanmu gagal dimuat", padahal ada di bawahnya.
c('galatnya cuma tampil kalau memang tidak ada yang bisa dibaca',
  /<ScreenError message=\{isi\.length === 0 \? error : null\} \/>/.test(layar));
c('galatnya tetap DIBERSIHKAN tiap data baru sampai — di KETIGA langganannya',
  (layar.match(/setError\(null\);/g) ?? []).length === 3);
// Dua lewat `fail` useLiveAll (= setError(LOAD_ERROR)), satu ditulis sendiri
// karena juga harus mematikan spinner "muat lebih lama".
c('kegagalan sungguhan tetap dilaporkan',
  (layar.match(/setError\(LOAD_ERROR\)/g) ?? []).length === 1 &&
  (layar.match(/\{ onError: setError/g) ?? []).length === 2 &&
  (layar.match(/,\s*\n\s*fail,/g) ?? []).length === 2);
c('tombol "muat lebih lama" tidak tertinggal berputar kalau gagal',
  /setMenarik\(false\);\s*\n\s*setError\(LOAD_ERROR\);/.test(
    layar.replace(/\r\n/g, '\n'),
  ));

console.log('\n   yang TIDAK boleh berubah');
c('arsipnya kini punya penyimpanan sendiri (users/{uid}/gratitude/{hari})',
  /doc\(db, 'users', uid, 'gratitude', dayId\)/.test(baca('lib/gratitude.ts')));
c('catatan lama tetap terbaca dari tempatnya semula, jadi tak ada yang hilang',
  /notes\[habitId\] \?\? ''/.test(baca('lib/health.ts')) &&
    /subscribeHabitNotes\(/.test(layar));
c('barisnya masih dicari dari namanya, bukan id yang ditulis di kode',
  /isGratitudeHabit/.test(kode('app/gratitude.tsx')) &&
  /\/bersyukur\/i\.test\(h\.label\)/.test(baca('lib/habits.ts')));
c('rutenya tetap terdaftar', /gratitude/.test(baca('.expo/types/router.d.ts')));

console.log(ok ? '\nLULUS' : '\nGAGAL');
process.exit(ok ? 0 : 1);