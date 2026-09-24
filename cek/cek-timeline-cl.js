// Dua permintaan:
//   1. Pendidikan & pekerjaan tidak lagi tampil di kartu daftar CORE › Leaders
//   2. Tombol 📍 Timeline per CORE Leader — layar yang SAMA dengan My Timeline
//      di Profile, datanya terpisah per CL (pola yang sama dengan 🎡 Wheel)
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');
const Module = require('module');
const { execFileSync } = require('child_process');

const R = AKAR + '/';
const OUT = path.join(__dirname, 'keluar-timeline-cl');
const baca = (f) => fs.readFileSync(R + f, 'utf8');

let ok = true;
const c = (n, s, extra) => {
  if (!s) ok = false;
  console.log((s ? '  ✓ ' : '  ✗ ') + n + (extra ? `  → ${extra}` : ''));
};

// ---------- Kompilasi ----------
fs.rmSync(OUT, { recursive: true, force: true });
try {
  execFileSync(
    process.execPath,
    [
      R + 'node_modules/typescript/bin/tsc', '--ignoreConfig',
      R + 'lib/timeline.ts',
      R + 'lib/wheel.ts',
      '--outDir', OUT,
      '--module', 'commonjs', '--target', 'es2020',
      '--skipLibCheck', '--esModuleInterop', '--moduleResolution', 'bundler',
    ],
    { stdio: 'pipe' },
  );
} catch { /* keluhan tipe diabaikan */ }

const M = (nama) => {
  for (const k of [`lib/${nama}.js`, `${nama}.js`]) {
    const p = path.join(OUT, ...k.split('/'));
    if (fs.existsSync(p)) return p;
  }
  console.log(`  ✗ gagal mengompilasi lib/${nama}.ts`);
  process.exit(1);
};

// Jejak: doc() mengembalikan JALURNYA, jadi bisa diperiksa dokumen mana yang
// benar-benar dituju.
const ditulis = [];
Module._load = ((asli) => function (req, parent, isMain) {
  if (req === 'firebase/firestore') {
    return {
      doc: (_db, ...seg) => seg.join('/'),
      setDoc: (ref, data) => { ditulis.push({ ref, data }); return Promise.resolve(); },
      // 14 Sep malam: saveTimelineYear ikut menulis updatedAt: Timestamp.now().
      Timestamp: {
        fromDate: (d) => ({ toDate: () => d, toMillis: () => d.getTime() }),
        now: () => ({ toDate: () => new Date(), toMillis: () => Date.now() }),
      },
      collection: () => {}, deleteDoc: () => {}, getDoc: () => {}, getDocs: () => {},
      onSnapshot: () => {}, orderBy: () => {}, query: () => {}, where: () => {},
      writeBatch: () => {}, updateDoc: () => {}, addDoc: () => {}, limit: () => {},
    };
  }
  if (/\/firebase$/.test(req)) return { db: {} };
  if (/\/liveDoc$/.test(req)) return { liveDoc: (ref) => ref };
  if (/style\/color$/.test(req)) {
    return { Color: new Proxy({}, { get: (_, k) => `Color.${String(k)}` }) };
  }
  if (/^(expo-|expo$|react-native|@react-native|@\/)/.test(req)) return {};
  return asli.call(this, req, parent, isMain);
})(Module._load);

const tl = require(M('timeline'));

const leaders = baca('components/core/LeadersTab.tsx');
const layar = baca('app/timeline.tsx');

console.log('\n== 1. Pendidikan & pekerjaan keluar dari kartu daftar ==');

c('kartu CORE Leader tidak lagi menggambarnya', !/<StudyWorkLines person=\{l\} \/>/.test(leaders));
c('kartu Main Team juga tidak', !/<StudyWorkLines person=\{m\} \/>/.test(leaders));
c('komponennya ikut dibuang (tak ada yang memakainya lagi)',
  !/StudyWorkLines/.test(leaders));

// Datanya TIDAK hilang — cuma pindah satu click ke dalam.
c('masih terlihat di modal baca-saja saat kartunya di-click',
  /<InfoRow label="🎓 Pendidikan"/.test(leaders) &&
  /<InfoRow label="💼 Pekerjaan"/.test(leaders));
c('studyLine & workLine tetap ada di lib (dipakai modal itu)',
  /export function studyLine/.test(baca('lib/core.ts')) &&
  /export function workLine/.test(baca('lib/core.ts')) &&
  /studyLine\(/.test(leaders) && /workLine\(/.test(leaders));
c('nomor HP & ulang tahun TIDAK ikut dibuang', /📱 \{l\.phone/.test(leaders));

console.log('\n== 2. Timeline per CORE Leader ==');

c('dokumen punyaku sendiri TIDAK berpindah (data lama aman)',
  tl.subscribeTimelineYear('u1', 2026, () => {}) === 'users/u1/timeline/2026');
c('tanpa pemilik = tetap punyaku',
  tl.subscribeTimelineYear('u1', 2026, () => {}, undefined, null) === 'users/u1/timeline/2026');
c('dengan pemilik → cabang CL sendiri',
  tl.subscribeTimelineYear('u1', 2026, () => {}, undefined, 'cl-novia') ===
    'users/u1/coreTimeline/cl-novia/years/2026',
  tl.subscribeTimelineYear('u1', 2026, () => {}, undefined, 'cl-novia'));
c('dua CL berbeda = dua cabang berbeda',
  tl.subscribeTimelineYear('u1', 2026, () => {}, undefined, 'cl-a') !==
    tl.subscribeTimelineYear('u1', 2026, () => {}, undefined, 'cl-b'));
c('tahun berbeda = dokumen berbeda (satu dokumen per tahun)',
  tl.subscribeTimelineYear('u1', 2027, () => {}, undefined, 'cl-a') ===
    'users/u1/coreTimeline/cl-a/years/2027');

ditulis.length = 0;
tl.saveTimelineYear('u1', 2026, [{ id: 'x' }]);
tl.saveTimelineYear('u1', 2026, [{ id: 'y' }], 'cl-novia');
c('menyimpan pun ikut pemiliknya',
  ditulis[0].ref === 'users/u1/timeline/2026' &&
  ditulis[1].ref === 'users/u1/coreTimeline/cl-novia/years/2026',
  ditulis.map((d) => d.ref).join(' · '));
c('yang disimpan seluruh daftar tahun itu, ditulis utuh',
  ditulis[1].data.items.length === 1 && ditulis[1].data.items[0].id === 'y');

// Bentuknya sengaja MENIRU coreWheel — dua fitur "punyaku vs punya CL" yang
// tersimpan dengan pola berbeda cuma bikin bingung nanti.
c('polanya sama persis dengan Wheel of Life',
  /coreWheel/.test(baca('lib/wheel.ts')) &&
  /coreTimeline/.test(baca('lib/timeline.ts')) &&
  /export type TimelineOwner = string \| null \| undefined;/.test(baca('lib/timeline.ts')));

console.log('\n== 3. Satu layar, dua pemilik ==');

c('tidak ada layar timeline kedua yang harus dirawat',
  !fs.existsSync(R + 'app/core-timeline.tsx') &&
  !fs.existsSync(R + 'app/leader-timeline.tsx'));
c('layarnya membaca ?leaderId=', /const owner = params\.leaderId \|\| null;/.test(layar));
c('kunci datanya ikut memuat pemiliknya (CL A tak sempat terlihat di layar CL B)',
  /useKeyedData<string, TimelineItem\[\]>\(\s*`\$\{owner \?\? 'me'\}\/\$\{year\}`,\s*\)/.test(layar));
// Ketiga penyimpanan (centang, simpan form, hapus) DAN langganannya harus
// sama-sama mengoper pemiliknya — satu saja yang lupa, wishlist CL nyasar ke
// dokumenku sendiri.
// `[^;]*` mentok di titik-koma terdekat → satu potongan = satu panggilan
// utuh, walau panggilannya beberapa baris.
const simpanTanpaPemilik = (layar.match(/saveTimelineYear\([^;]*;/g) || []).filter(
  (blok) => !/owner/.test(blok),
);
c('ketiga penyimpanan mengoper pemiliknya',
  (layar.match(/saveTimelineYear\(/g) || []).length === 3 &&
  simpanTanpaPemilik.length === 0,
  simpanTanpaPemilik.join(' | '));
// Dipatok ke EKOR panggilannya, bukan sekadar "ada kata owner di dekat sini":
// berkas ini memuat `owner,` di beberapa panggilan lain, jadi pola longgar
// akan lolos walau argumen langganannya sendiri dihapus.
c('langganannya juga, & ikut dipasang ulang saat pemiliknya ganti',
  // 22 Sep 2026: lewat useLiveAll — galatnya `fail`, pemiliknya tetap argumen
  // terakhir langganannya; `when: unlocked` = baru dipasang sesudah PIN benar.
  /fail,\s*\n\s*owner,\s*\n\s*\),/.test(layar) &&
  /\{ onError: setError, deps: \[year, owner, setItems\], when: unlocked \}/.test(layar));
c('umurnya dihitung dari tahun lahir PEMILIK timeline-nya, bukan selalu punyaku',
  /const birthYear = Number\(params\.birthYear\) \|\| BIRTH_YEAR;/.test(layar) &&
  /const age = year - birthYear;/.test(layar));
c('judul & tombol kembali menyesuaikan',
  /backLabel=\{owner \? 'CORE' : 'Home'\}/.test(layar) &&
  /owner \? `Timeline \$\{params\.heart \?\? '📍'\} \$\{orang\}` : 'My Timeline 📍'/.test(layar));

console.log('\n== 4. Tombolnya di kartu CORE Leader ==');

c('tombol 📍 ada', /<EmojiButton\s*\n\s*emoji="📍"/.test(leaders));
c('menuju layar timeline yang sama', /pathname: '\/timeline',/.test(leaders));
c('mengoper id, nama, lambang hati, & tahun lahirnya',
  /leaderId: l\.id,\s*\n\s*name: l\.name,\s*\n\s*heart: l\.heart,\s*\n\s*birthYear: String\(l\.birthYear\),/.test(leaders));
c('duduk sebaris dengan 🧍 (baris kedua tombol kartu)',
  /<View style=\{styles\.cardActions\}>\s*\n[\s\S]{0,60}emoji="📍"[\s\S]*?<EmojiButton emoji="🧍" onPress=\{\(\) => setBodyOf\(l\)\} \/>\s*\n\s*<\/View>/.test(leaders));
c('tombol 🎡 Wheel & ✏️ di baris atas tidak digeser',
  // Boleh ada komentar di antara View & tombolnya, dan 🎡 kini membawa
  // \`locked\` (berpintu PIN) — urutannya tetap: 🎡 lalu ✏️.
  /<View style=\{styles\.cardActions\}>[\s\S]{0,500}?<EmojiButton\s*\n\s*emoji="🎡"\s*\n\s*locked[\s\S]*?<EditButton onPress=\{\(\) => openEdit\(l\)\} \/>/.test(leaders));

console.log(ok ? '\nLULUS' : '\nGAGAL');
process.exit(ok ? 0 : 1);