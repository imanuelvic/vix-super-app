// Permintaan: kolom "Bacaan 1" langsung merekomendasikan sambungan dari
// bacaan terakhir — terakhir Amsal 2 → saran Amsal 3 — untuk pagi, siang &
// malam masing-masing, terjemahannya ikut terisi.
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');
const Module = require('module');
const { execFileSync } = require('child_process');

const R = AKAR + '/';
const OUT = path.join(__dirname, 'keluar-saran-bacaan');
const baca = (f) => fs.readFileSync(R + f, 'utf8');

let ok = true;
const c = (n, s, extra) => {
  if (!s) ok = false;
  console.log((s ? '  ✓ ' : '  ✗ ') + n + (extra !== undefined ? `  → ${extra}` : ''));
};

// ---------- Kompilasi ----------
fs.rmSync(OUT, { recursive: true, force: true });
try {
  execFileSync(
    process.execPath,
    [
      R + 'node_modules/typescript/bin/tsc', '--ignoreConfig',
      R + 'lib/spiritual.ts',
      R + 'lib/bible.ts',
      '--outDir', OUT,
      '--module', 'commonjs', '--target', 'es2020',
      '--skipLibCheck', '--esModuleInterop', '--moduleResolution', 'bundler',
    ],
    { stdio: 'pipe' },
  );
} catch { /* keluhan tipe diabaikan — yang dipakai hasil emitnya */ }

const M = (nama) => {
  for (const k of [`lib/${nama}.js`, `${nama}.js`]) {
    const p = path.join(OUT, ...k.split('/'));
    if (fs.existsSync(p)) return p;
  }
  console.log(`  ✗ gagal mengompilasi lib/${nama}.ts`);
  process.exit(1);
};

// Jejak kueri: tiap potongannya dikembalikan sebagai teks, jadi bisa diperiksa
// koleksi/urutan/batas mana yang benar-benar diminta.
let hari = [];
let jumlahGetDocs = 0;
Module._load = ((asli) => function (req, parent, isMain) {
  if (req === 'firebase/firestore') {
    return {
      collection: (_db, ...seg) => seg.join('/'),
      query: (...bagian) => bagian.join(' | '),
      orderBy: (f, arah) => `orderBy:${f}:${arah}`,
      limit: (n) => `limit:${n}`,
      getDocs: async (q) => {
        jumlahGetDocs++;
        lastQuery = q;
        return { docs: hari.map((h) => ({ id: h.id, data: () => h })) };
      },
      doc: (_db, ...seg) => seg.join('/'),
      setDoc: () => Promise.resolve(),
      deleteDoc: () => Promise.resolve(),
      Timestamp: { fromDate: (d) => ({ toDate: () => d }) },
      onSnapshot: () => () => {}, where: () => {}, writeBatch: () => {},
      updateDoc: () => {}, addDoc: () => {}, getDoc: () => {},
    };
  }
  if (/\/firebase$/.test(req)) return { db: {} };
  if (/style\/color$/.test(req)) {
    return { Color: new Proxy({}, { get: (_, k) => `Color.${String(k)}` }) };
  }
  if (/^(expo-|expo$|react-native|@react-native|@\/)/.test(req)) return {};
  return asli.call(this, req, parent, isMain);
})(Module._load);
let lastQuery = '';

const alkitab = require(M('bible'));
const sp = require(M('spiritual'));

const layar = baca('app/bible-reading.tsx');

console.log('\n== 1. Pasal berikutnya ==');

c('kemarin Amsal 2 → saran Amsal 3',
  alkitab.nextChapterRef('Amsal 2') === 'Amsal 3', alkitab.nextChapterRef('Amsal 2'));
c('siang: Yesaya 3 → Yesaya 4', alkitab.nextChapterRef('Yesaya 3') === 'Yesaya 4');
c('malam: 1 Petrus 4 → 1 Petrus 5 (kitab berangka tidak jadi "Petrus")',
  alkitab.nextChapterRef('1 Petrus 4') === '1 Petrus 5',
  alkitab.nextChapterRef('1 Petrus 4'));
// Ayat yang kemarin disorot tidak ada hubungannya dengan bacaan berikutnya.
c('ayatnya dibuang: Amsal 3:5-6 → Amsal 4',
  alkitab.nextChapterRef('Amsal 3:5-6') === 'Amsal 4',
  alkitab.nextChapterRef('Amsal 3:5-6'));
c('tercatat tanpa pasal ("Yakobus") → mulai dari pasal 1, bukan pasal 2',
  alkitab.nextChapterRef('Yakobus') === 'Yakobus 1');

// Kitab tamat SENGAJA tidak disambung sendiri ke kitab berikutnya: menebak
// salah lalu tersimpan sebagai catatan bacaan lebih merugikan daripada sehari
// tanpa rekomendasi.
c('Amsal 31 (pasal terakhir) tidak melompat ke kitab lain',
  alkitab.nextChapterRef('Amsal 31') === null, alkitab.nextChapterRef('Amsal 31'));
c('Filipi 4 juga', alkitab.nextChapterRef('Filipi 4') === null);
c('kitab 1 pasal: Obaja 1 selesai', alkitab.nextChapterRef('Obaja 1') === null);
c('Yesaya 65 → Yesaya 66 (batasnya pas, bukan kurang satu)',
  alkitab.nextChapterRef('Yesaya 65') === 'Yesaya 66' &&
  alkitab.nextChapterRef('Yesaya 66') === null);
c('pasal ngawur tidak diteruskan', alkitab.nextChapterRef('Amsal 99') === null);
c('kitab tak dikenali & teks kosong → diam',
  alkitab.nextChapterRef('Entah 3') === null && alkitab.nextChapterRef('') === null);

c('tamat vs tak dikenali dibedakan',
  alkitab.isLastChapter('Amsal 31') === true &&
  alkitab.isLastChapter('Amsal 30') === false &&
  alkitab.isLastChapter('Entah 3') === false &&
  // Tanpa pasal bukan berarti tamat — sarannya justru pasal 1.
  alkitab.isLastChapter('Yakobus') === false);

console.log('\n== 2. Tiap sesi punya rantai sendiri ==');

// Riwayat mengikuti tangkapan layar: pagi Amsal, siang Yesaya, malam 1 Petrus.
const RIWAYAT = [
  { id: '2026-09-01', morning: '', daytime: '', night: '' },
  { id: '2026-08-31', morning: 'Amsal 30, Amsal 31', morningVersion: 'TSI',
    daytime: 'Yesaya 3', daytimeVersion: 'TSI',
    night: '1 Petrus 4', nightVersion: 'TSI' },
  { id: '2026-08-29', morning: 'Amsal 29', morningVersion: 'TSI' },
  { id: '2026-08-28', morning: '__skip__', daytime: 'Yesaya 1', daytimeVersion: 'TSI',
    night: '1 Petrus 3', nightVersion: 'TSI' },
  { id: '2026-08-24', morning: 'Amsal 24', morningVersion: 'TB',
    daytime: 'Filipi 3, Filipi 4', daytimeVersion: 'TB',
    night: 'Yakobus 5', nightVersion: 'TB' },
];
const days = RIWAYAT.map((h) => ({
  id: h.id,
  morning: h.morning ?? '', daytime: h.daytime ?? '', night: h.night ?? '',
  versions: {
    morning: h.morningVersion || 'TB',
    daytime: h.daytimeVersion || 'TB',
    night: h.nightVersion || 'TB',
  },
}));

const pagi = sp.bibleSuggestion(days, 'morning');
const siang = sp.bibleSuggestion(days, 'daytime');
const malam = sp.bibleSuggestion(days, 'night');

c('siang menyambung bacaan SIANG, bukan bacaan pagi',
  siang.last === 'Yesaya 3' && siang.next === 'Yesaya 4', `${siang.last} → ${siang.next}`);
c('malam menyambung bacaan MALAM',
  malam.last === '1 Petrus 4' && malam.next === '1 Petrus 5', `${malam.last} → ${malam.next}`);
c('satu hari beberapa kitab → yang jadi acuan yang TERAKHIR',
  pagi.last === 'Amsal 31', pagi.last);
c('kitab tamat: tidak menebak kitab baru, tapi ditandai selesai',
  pagi.next === null && pagi.finished === true);
c('hari kosong (hari ini) & hari yang dilewati dilompati',
  pagi.dayId === '2026-08-31' && siang.dayId === '2026-08-31');
c('terjemahan ikut dari catatan terakhir sesi itu',
  pagi.version === 'TSI' && siang.version === 'TSI' && malam.version === 'TSI');

// Hari yang seluruhnya dilewati tidak boleh menghentikan pencarian.
const cumaLewat = [
  { id: '2026-09-01', morning: '__skip__', daytime: '', night: '',
    versions: { morning: 'TB', daytime: 'TB', night: 'TB' } },
  { id: '2026-08-30', morning: 'Amsal 2', daytime: '', night: '',
    versions: { morning: 'BIS', daytime: 'TB', night: 'TB' } },
];
const lewat = sp.bibleSuggestion(cumaLewat, 'morning');
c('hari yang dilewati bukan bacaan — lanjut menengok ke belakang',
  lewat.last === 'Amsal 2' && lewat.next === 'Amsal 3' && lewat.version === 'BIS');

c('belum ada riwayat sama sekali → tak ada saran (bukan tebakan)',
  sp.bibleSuggestion([], 'morning') === null &&
  sp.bibleSuggestion(days, 'night') !== null);
c('catatan lama tanpa kolom terjemahan tetap terbaca TB',
  sp.bibleSuggestion(
    [{ id: '2026-08-01', morning: 'Amsal 5', daytime: '', night: '',
       versions: { morning: '', daytime: '', night: '' } }],
    'morning',
  ).version === 'TB');

console.log('\n== 3. Sekali ambil, satu kueri untuk tiga sesi ==');

(async () => {
  hari = RIWAYAT;
  jumlahGetDocs = 0;
  const semua = await sp.fetchBibleSuggestions('u1');

  c('SATU kueri saja walau ketiga sesinya dihitung', jumlahGetDocs === 1, jumlahGetDocs);
  c('yang dibaca koleksi bacaan Alkitab, terbaru dulu',
    /users\/u1\/bibleRead/.test(lastQuery) && /orderBy:date:desc/.test(lastQuery),
    lastQuery);
  // Batasnya menentukan biaya: sekali buka layar = sebanyak ini baca Firestore.
  c('dibatasi sebulan ke belakang (biayanya jelas & tetap)',
    lastQuery.includes(`limit:${sp.BIBLE_SUGGEST_DAYS}`) &&
    sp.BIBLE_SUGGEST_DAYS === 30,
    sp.BIBLE_SUGGEST_DAYS);
  c('ketiga sesi terisi dari kueri yang sama',
    semua.morning.last === 'Amsal 31' &&
    semua.daytime.next === 'Yesaya 4' &&
    semua.night.next === '1 Petrus 5');

  console.log('\n== 4. Layar catat bacaan ==');

  c('Bacaan 1 dimulai dari sarannya saat hari ini belum dicatat',
    /const \[refs, setRefs\] = useDraft<string\[\]>\(\s*\n\s*tercatat\s*\n\s*\? existing\.split\(','\)\.map\(\(s\) => s\.trim\(\)\)\s*\n\s*: \[saran\?\.next \?\? ''\],\s*\n\s*\);/.test(layar));
  c('terjemahannya juga ikut terisi sendiri',
    /tercatat \? versiTersimpan : \(saran\?\.version \?\? versiTersimpan\)/.test(layar));
  // Catatan hari ini SELALU menang: membuka layar untuk menambah kitab kedua
  // tidak boleh menimpa yang sudah tersimpan dengan tebakan.
  c('catatan hari ini menang atas saran',
    /const tercatat = !!existing && !skipped;/.test(layar));
  // Sarannya cuma nilai awal — begitu kamu pilih sendiri, pilihanmu menang
  // (itu sifat useDraft, bukan efek yang menimpa ketikan).
  c('dipasang lewat useDraft, bukan efek yang menimpa pilihanmu',
    !/useEffect\([^)]*setRefs/.test(layar) && !/setRefs\(\[/.test(layar));

  c('sesinya dipilih SESUDAH mengambil, jadi kuerinya tidak berlipat',
    /const saran = semuaSaran\?\.\[session\] \?\? null;/.test(layar) &&
    /fetchBibleSuggestions\(user\.uid\)/.test(layar) &&
    /\[user\],/.test(layar));
  c('galatnya tidak ditampilkan — ini bantuan mengetik, bukan isi',
    /const \{ data: semuaSaran \} = useAsyncData\(muatSaran, LOAD_ERROR\);/.test(layar));

  // Angka yang tiba-tiba terisi harus punya keterangan asal-usulnya.
  c('ada keterangan "Lanjutan dari …" beserta tanggal terakhirnya',
    /💡 Lanjutan dari \$\{saran\.last\} · \$\{formatShortDayDate\(dayIdToDate\(saran\.dayId\)\)\}/.test(layar));
  c('kitab tamat → ucapan selamat & diminta pilih kitab baru',
    /🎉 \$\{saran\.last\}, kitabnya tamat\. Pilih kitab baru ya\./.test(layar));
  c('keterangannya cuma di kartu Bacaan 1, & tidak muncul kalau sudah dicatat',
    /\{i === 0 && hint \? \(/.test(baca('components/spiritual/BibleRefList.tsx')) &&
    /hint=\{saranHint\}/.test(layar) &&
    /tercatat \|\| !saran\s*\n\s*\? null/.test(layar));
  // Kolom bisa terisi sendiri sekarang → label lama akan berbohong.
  c('kotak ringkasan tidak lagi mengaku "Tersimpan" sebelum disimpan',
    /\{tercatat \? 'Tersimpan sebagai' : 'Akan tersimpan sebagai'\}/.test(layar));

  console.log(ok ? '\nLULUS' : '\nGAGAL');
  process.exit(ok ? 0 : 1);
})();