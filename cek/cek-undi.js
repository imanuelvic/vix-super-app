// 21 Sep 2026: langganan lewat useLiveAll → `subscribeX(uid, …)`, bukan `user.uid`.
// Tombol 🎲 undi ulang CL fokus minggu ini — muncul HARI SENIN saja.
// Logikanya dijalankan sungguhan dari lib/core.ts.
const AKAR = require('./akar');
const BACA_TODAY = (p) => require('fs').readFileSync(AKAR + '/' + p, 'utf8').replace(/\r\n/g, '\n'); // 22 Sep 2026 Today OS
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const Module = require('module');

const ROOT = AKAR;
const OUT = path.join(__dirname, 'keluar-undi');
const baca = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

let gagal = 0;
function ok(nama, syarat, info = '') {
  if (syarat) console.log(`  ✅ ${nama}`);
  else { gagal++; console.log(`  ❌ ${nama}${info ? ` — ${info}` : ''}`); }
}

// ============ Kompilasi & pasang lib/core.ts ============
try {
  execFileSync(
    'npx',
    ['tsc', path.join(ROOT, 'lib/core.ts'), '--ignoreConfig', '--outDir', OUT,
      '--module', 'commonjs', '--target', 'es2020', '--skipLibCheck',
      '--esModuleInterop', '--moduleResolution', 'bundler'],
    { cwd: ROOT, stdio: 'pipe', shell: true },
  );
} catch { /* keluhan tipe tak menghalangi tsc membuat JS-nya */ }

const tulisan = []; // semua yang "disimpan ke Firestore"
const asli = Module._load;
Module._load = function (req, parent, isMain) {
  if (req === './firebase') return { db: {} };
  if (req === './liveDoc') return { liveDoc: () => () => {} };
  if (req.startsWith('@/assets/style/color')) {
    return { Color: new Proxy({}, { get: () => '#000' }) };
  }
  // Modul native (kamera/foto) tak ada di Node — tidak dipakai fungsi yang diuji.
  if (/^expo-|^@react-native/.test(req)) {
    return new Proxy({}, { get: () => () => ({}) });
  }
  if (req.startsWith('firebase/')) {
    return new Proxy(
      {
        doc: (...p) => ({ path: p.slice(1).join('/') }),
        setDoc: (ref, data) => {
          tulisan.push({ path: ref.path, data });
          return Promise.resolve();
        },
      },
      { get: (t, k) => (k in t ? t[k] : () => ({})) },
    );
  }
  return asli(req, parent, isMain);
};
const C = require(path.join(OUT, 'core.js'));
Module._load = asli;

const CL = (id) => ({ id, name: id.toUpperCase(), lastFollowupDayId: null });
const sepuluh = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'].map(CL);
const nama = (list) => list.map((l) => l.id).join(',');

// Senin 24 Agustus 2026 (tanggal di layarmu), plus enam hari sesudahnya.
const SENIN = new Date(2026, 7, 24);
const hari = (n) => new Date(2026, 7, 24 + n);

// ===================================================================
console.log('\n=== Tombolnya cuma muncul hari SENIN ===');
const namaHari = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
const bolehDi = namaHari.filter((_, i) => C.canDrawWeeklyFocus(hari(i)));
ok('Senin saja — enam hari lainnya tidak', bolehDi.join(',') === 'Senin', bolehDi.join(','));
ok('Minggu (akhir minggu) juga tidak', !C.canDrawWeeklyFocus(hari(6)));
// Senin minggu berikutnya jelas boleh lagi.
ok('Senin minggu berikutnya boleh lagi', C.canDrawWeeklyFocus(hari(7)));

// ===================================================================
console.log('\n=== Tanpa undian: rotasi bawaan, persis seperti dulu ===');
const rotasiSenin = C.weeklyLeaders(sepuluh, C.weekIndex(SENIN), C.WEEKLY_FOCUS_COUNT);
ok('fokus = rotasi bawaan',
  nama(C.focusLeaders(sepuluh, SENIN, C.EMPTY_WEEKLY_FOCUS)) === nama(rotasiSenin),
  nama(C.focusLeaders(sepuluh, SENIN, C.EMPTY_WEEKLY_FOCUS)));
ok('isinya tetap 2 orang', rotasiSenin.length === 2);
ok('sama sepanjang minggu (Senin–Minggu)',
  [0, 1, 2, 3, 4, 5, 6].every(
    (n) => nama(C.focusLeaders(sepuluh, hari(n), C.EMPTY_WEEKLY_FOCUS)) === nama(rotasiSenin),
  ));
ok('minggu berikutnya bergeser sendiri',
  nama(C.focusLeaders(sepuluh, hari(7), C.EMPTY_WEEKLY_FOCUS)) !== nama(rotasiSenin));

// ===================================================================
console.log('\n=== Undi ulang: orangnya benar-benar berganti ===');
// random tiruan supaya hasilnya bisa diperiksa, bukan ditebak.
let urut = 0;
const acakPalsu = () => [0.9, 0.1, 0.5, 0.3, 0.7, 0.2, 0.8, 0.4, 0.6, 0.05][urut++ % 10];

const undian = C.drawWeeklyFocus(sepuluh, rotasiSenin, SENIN, acakPalsu);
ok('yang disimpan tepat 2 id', undian.ids.length === 2, JSON.stringify(undian.ids));
ok('tidak ada nama kembar di dalamnya', new Set(undian.ids).size === 2);
ok('BUKAN pasangan yang tadi (jadi terasa berganti)',
  undian.ids.every((id) => !rotasiSenin.some((l) => l.id === id)),
  `${undian.ids} vs ${nama(rotasiSenin)}`);
ok('ditandai untuk minggu ini', undian.weekIdx === C.weekIndex(SENIN));

// Diundi berkali-kali: selalu 2 orang, selalu di luar pasangan sekarang.
let selaluBeda = true;
let selaluDua = true;
const munculan = new Set();
for (let i = 0; i < 200; i++) {
  const u = C.drawWeeklyFocus(sepuluh, rotasiSenin, SENIN);
  if (u.ids.length !== 2 || new Set(u.ids).size !== 2) selaluDua = false;
  if (u.ids.some((id) => rotasiSenin.some((l) => l.id === id))) selaluBeda = false;
  u.ids.forEach((id) => munculan.add(id));
}
ok('200× undian: selalu 2 orang berbeda', selaluDua);
ok('200× undian: tak pernah menarik yang sedang dipakai', selaluBeda);
ok('acak beneran — hampir semua CL lain pernah kebagian',
  munculan.size >= 7, `${munculan.size} dari 8 CL lain`);

console.log('\n=== Hasil undian dipakai sebagai fokus minggu ini ===');
ok('fokus mengikuti undian, bukan rotasi lagi',
  nama(C.focusLeaders(sepuluh, SENIN, undian)) === undian.ids.join(','),
  nama(C.focusLeaders(sepuluh, SENIN, undian)));
ok('bertahan sampai akhir minggu (Selasa … Minggu)',
  [1, 2, 3, 4, 5, 6].every(
    (n) => nama(C.focusLeaders(sepuluh, hari(n), undian)) === undian.ids.join(','),
  ));
ok('LEWAT minggu itu, undiannya kedaluwarsa sendiri → balik ke rotasi',
  nama(C.focusLeaders(sepuluh, hari(7), undian)) ===
    nama(C.weeklyLeaders(sepuluh, C.weekIndex(hari(7)), C.WEEKLY_FOCUS_COUNT)));

console.log('\n=== Kalau CL-nya berubah ===');
const tanpaSatu = sepuluh.filter((l) => l.id !== undian.ids[0]);
ok('satu CL terpilih dihapus → sisanya tetap dipakai',
  nama(C.focusLeaders(tanpaSatu, SENIN, undian)) === undian.ids[1],
  nama(C.focusLeaders(tanpaSatu, SENIN, undian)));
const tanpaDua = sepuluh.filter((l) => !undian.ids.includes(l.id));
ok('dua-duanya dihapus → balik ke rotasi bawaan (tidak kosong)',
  C.focusLeaders(tanpaDua, SENIN, undian).length === 2);
ok('daftar CL kosong → tidak error, hasilnya kosong',
  C.focusLeaders([], SENIN, undian).length === 0);

const dua = [CL('x'), CL('y')];
const undiDua = C.drawWeeklyFocus(dua, dua, SENIN);
ok('CL-nya cuma dua → undiannya tetap sah (mereka berdua lagi)',
  undiDua.ids.length === 2 && new Set(undiDua.ids).size === 2, JSON.stringify(undiDua.ids));

// ===================================================================
console.log('\n=== Yang disimpan ke Firestore ===');
tulisan.length = 0;
C.saveWeeklyFocus('uid1', undian);
ok('satu dokumen kecil sendiri, di bawah akun pemiliknya',
  tulisan.length === 1 && tulisan[0].path === 'users/uid1/core/weeklyFocus',
  JSON.stringify(tulisan[0]));
ok('isinya cuma nomor minggu + id-nya (bukan salinan data CL)',
  Object.keys(tulisan[0].data).sort().join(',') === 'ids,weekIdx');
ok('tidak menimpa dokumen CORE Leader',
  !tulisan.some((t) => t.path.endsWith('core/leaders')));

// ===================================================================
console.log('\n=== Terpasang di layarnya ===');
const tab = baca('components/core/FollowupTab.tsx');
const core = baca('app/(tabs)/core.tsx');
const home = baca('app/(tabs)/index.tsx');

ok('tombol 🎲 ada di kartu Follow Up Mingguan',
  /<EmojiButton\s*\n\s*emoji="🎲"/.test(tab));
ok('muncul HANYA Senin & hanya kalau ada CL lain yang bisa terpilih',
  /const bisaUndi =\s*\n\s*canDrawWeeklyFocus\(new Date\(\)\) && leaders\.length > WEEKLY_FOCUS_COUNT;/.test(tab) &&
  /\{bisaUndi && \(/.test(tab));
ok('judul & tombolnya sebaris, judul yang mengalah kalau sempit',
  /weekTop: \{[\s\S]{0,140}justifyContent: 'space-between',/.test(tab) &&
  /weekTitle: \{ color: Color\.TEXT_REVERSE, flexShrink: 1 \}/.test(tab));
ok('menekan tombol = simpan undian baru (bukan simpan diam-diam ke tempat lain)',
  /saveWeeklyFocus\(\s*\n\s*user\.uid,\s*\n\s*drawWeeklyFocus\(leaders, weekLeaders, new Date\(\)\),/.test(tab));
ok('gagal simpan tetap memberi tahu, tombol tidak nyangkut',
  /setError\(SAVE_ERROR\)/.test(tab) && /finally \{\s*\n\s*setDrawing\(false\);/.test(tab));

console.log('\n=== Satu daftar yang sama di semua tempat ===');
ok('kartu Follow Up memakai focusLeaders',
  /focusLeaders\(leaders, new Date\(\), weeklyFocus\)/.test(tab));
// 30 Agu 2026: kedua badge tidak lagi memanggil focusLeaders sendiri —
// keduanya lewat followupDue, yang memakai focusLeaders DI DALAMNYA lalu
// menambahkan aturan jam 09.00. Undiannya tetap sumber yang sama, cuma
// pintunya satu sekarang.
// 30 Agu 2026 (lanjutan): badge sub-tab & badge tile Home dihitung SEKALI di
// coreAttention(), yang di dalamnya memanggil followupDue — jadi undiannya
// tetap sumber yang sama, cuma pintunya sekarang satu untuk keduanya.
ok('badge tab Follow Up ikut undiannya (lewat followupDue)',
  /coreAttention\(\{[\s\S]{0,200}focus: weeklyFocus/.test(core));
// 22 Sep 2026: badge tile Home → badge tab CORE (coreAttention, di (tabs)/_layout)
// & baris Follow Up di Today Engine — keduanya dari undian yang sama.
ok('badge tab CORE & baris Today ikut undiannya juga',
  /coreAttention\(\{ leaders, mainTeam, visitations, greets, focus, now, todayId \}\)/.test(BACA_TODAY('app/(tabs)/_layout.tsx')) &&
  /followupDue\(leaders, now, input\.weeklyFocus, todayId\)/.test(BACA_TODAY('lib/today.ts')));
ok('followupDue memang berangkat dari undian yang sama',
  /return focusLeaders\(leaders, now, focus\)/.test(baca('lib/core.ts')));
ok('tak ada lagi yang menghitung sendiri lewat weeklyLeaders',
  !/weeklyLeaders/.test(tab) && !/weeklyLeaders/.test(core) && !/weeklyLeaders/.test(home));
// Angkanya sengaja TIDAK dipatok di sini — yang penting gerbangnya menunggu
// SEMUA sumber yang ditandai mark(), berapa pun jumlahnya (cocoknya diperiksa
// di cek-enam-permintaan.js).
ok('Today menunggu dokumennya sampai sebelum menggambar barisnya',
  /subscribeWeeklyFocus\(uid, mark\('weeklyFocus', setWeeklyFocus\), fail\)/.test(BACA_TODAY('hooks/useTodayData.ts')) &&
  /const SOURCES = \d+;/.test(BACA_TODAY('hooks/useTodayData.ts')));
ok('CORE ikut berlangganan dokumen yang sama',
  /subscribeWeeklyFocus\(uid, setWeeklyFocus, fail\)/.test(core));

console.log('\n=== Yang tidak boleh berubah ===');
ok('jatah fokus tetap 2 orang', C.WEEKLY_FOCUS_COUNT === 2);
ok('kartu per CL & tombol Selesai tetap',
  /renderFollowCard\(\{/.test(tab) && /handleDoneLeader\(l\)/.test(tab));
ok('rotasi bawaannya sendiri tidak diutak-atik',
  /const start = \(\(\(weekIdx \* count\) % n\) \+ n\) % n;/.test(baca('lib/core.ts')));

console.log(gagal === 0
  ? '\n✅ LULUS — undi ulang Senin, sehari kemudian terkunci lagi.'
  : `\n❌ ${gagal} cek gagal.`);
process.exit(gagal === 0 ? 0 : 1);
