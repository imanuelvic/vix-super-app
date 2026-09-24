// Delapan permintaan 29–30 Agu 2026:
//   1. Follow Up Mingguan: badge + reminder mulai jam 09.00, kartu Home 9.00–9.30
//      ↑ aturan jamnya DICABUT 11 Sep 2026 — lihat bagian 1 di bawah. Yang
//        tersisa dari permintaan ini cuma jendela kartu Home 09.00–09.30.
//   2. Catatan Revive jadi arsip (baca saja) + 🔗 Connect ke acara CORE
//   3. Tanggal di layar Baca Alkitab
//   4. Tombol YouVersion langsung ke pasal & terjemahan yang diisi
//   5. Tiap acuan di riwayat bacaan bisa di-click ke YouVersion
//   6. Kartu centang puasa di Home jam 20.00–24.00 → modal hari ini
//   7. Catatan refleksi diisi lewat modal (bukan kolom terjepit di daftar)
//      ↑ komponennya pindah ke components/common/NoteField.tsx (11 Sep 2026),
//        dipakai bareng rangkuman mingguan Learning. Jaminannya tetap sama.
//   8. "No. 241" → "Day 241 / 365" (366 di tahun kabisat)
const AKAR = require('./akar');
const BACA_TODAY = (p) => require('fs').readFileSync(AKAR + '/' + p, 'utf8').replace(/\r\n/g, '\n'); // 22 Sep 2026 Today OS
const fs = require('fs');
const path = require('path');
const Module = require('module');
const { execFileSync } = require('child_process');

const R = AKAR + '/';
const OUT = path.join(__dirname, 'keluar-delapan');
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
      R + 'lib/core.ts', R + 'lib/fasting.ts', R + 'lib/bible.ts',
      R + 'lib/spiritual.ts', R + 'lib/shareImage.ts', R + 'lib/coreNotes.ts',
      '--outDir', OUT,
      '--module', 'commonjs', '--target', 'es2020',
      '--skipLibCheck', '--esModuleInterop', '--moduleResolution', 'bundler',
    ],
    { stdio: 'pipe' },
  );
} catch { /* keluhan tipe diabaikan */ }

const DIR = fs.existsSync(path.join(OUT, 'lib')) ? path.join(OUT, 'lib') : OUT;
for (const f of ['core.js', 'fasting.js', 'bible.js', 'spiritual.js',
  'shareImage.js', 'coreNotes.js']) {
  if (!fs.existsSync(path.join(DIR, f))) {
    console.log(`  ✗ gagal mengompilasi ${f}`);
    process.exit(1);
  }
}

const dibuka = [];
Module._load = ((asli) => function (req, parent, isMain) {
  if (req === 'firebase/firestore') {
    return {
      collection: () => ({}), doc: () => ({ path: 'x' }), setDoc: async () => {},
      getDoc: async () => ({ data: () => ({}) }), onSnapshot: () => () => {},
      deleteField: () => '__d__', query: () => ({}), orderBy: () => ({}),
      limit: () => ({}), writeBatch: () => ({}), arrayUnion: () => ({}),
      deleteDoc: async () => {},
      Timestamp: { fromDate: (d) => d, now: () => new Date() },
    };
  }
  if (req === './firebase' || req.endsWith('/firebase')) return { db: {} };
  if (req === './liveDoc' || req.endsWith('/liveDoc')) {
    return { liveDoc: () => () => {}, unsubscribeAll: () => () => {} };
  }
  if (req === './linking' || req.endsWith('/linking')) {
    return {
      openExternalUrl: async (url, opts) => {
        dibuka.push({ url, fallback: opts?.fallback ?? null });
      },
    };
  }
  if (/^@\/assets\/style\/color$/.test(req)) {
    return { Color: new Proxy({}, { get: (_, k) => `Color.${String(k)}` }) };
  }
  if (/^(@\/|expo-|expo$|react-native|@react-native)/.test(req)) return {};
  return asli.call(this, req, parent, isMain);
})(Module._load);

const CORE = require(path.join(DIR, 'core.js'));
const F = require(path.join(DIR, 'fasting.js'));
const B = require(path.join(DIR, 'bible.js'));
const S = require(path.join(DIR, 'spiritual.js'));
const SH = require(path.join(DIR, 'shareImage.js'));
const CN = require(path.join(DIR, 'coreNotes.js'));

const jam = (h, m = 0) => new Date(2026, 7, 29, h, m);

// =====================================================================
console.log('=== 1. Follow Up Mingguan: menagih sepanjang hari ===');
// =====================================================================
{
  const leaders = [
    { id: 'a', name: 'David', heart: '💙', lastFollowupDayId: null },
    { id: 'b', name: 'Reyki', heart: '🖤', lastFollowupDayId: null },
    { id: 'c', name: 'Riky', heart: '🤎', lastFollowupDayId: null },
  ];
  const fokus = { weekIdx: -1, ids: [] }; // pakai undian bawaan
  const hariIni = '2026-08-29';

  // 11 Sep 2026 — aturan "mulai jam 09.00" dicabut pemilik app.
  //
  // Sebabnya: kartu CL di sub-tab Follow Up TIDAK pernah ikut menunggu jam
  // itu. Ia bergaris & bertitik merah sejak lewat tengah malam (syaratnya
  // cuma !done). Jadi jam 07.55 layarnya berteriak merah sementara badge
  // sub-tab & badge tile CORE di Home sama-sama kosong — keadaan yang bikin
  // badge berhenti dipercaya, karena "merah di dalam, kosong di luar" tidak
  // bisa dijelaskan oleh yang melihatnya.
  const jam9 = CORE.followupDue(leaders, jam(9), fokus, hariIni);
  c('jam 09.00 → tagihannya menyala', jam9.length > 0, `${jam9.length} CL`);
  c('jam 00.05 → SUDAH menagih (tidak lagi menunggu jam 9)',
    CORE.followupDue(leaders, jam(0, 5), fokus, hariIni).length === jam9.length);
  c('jam 07.55 → menagih juga (jam saat keluhannya dilaporkan)',
    CORE.followupDue(leaders, jam(7, 55), fokus, hariIni).length === jam9.length);
  c('jam 23.00 → masih menagih (badge bertahan sepanjang hari)',
    CORE.followupDue(leaders, jam(23), fokus, hariIni).length === jam9.length);
  // Disapu 1.440 menit: tidak boleh ada SATU menit pun yang diam-diam kosong.
  // Gerbang jam berikutnya yang menyelinap masuk akan ketahuan di sini, bukan
  // di layar HP tiga minggu kemudian.
  {
    const kosong = [];
    for (let m = 0; m < 24 * 60; m++) {
      const t = new Date(2026, 7, 29, Math.floor(m / 60), m % 60);
      if (CORE.followupDue(leaders, t, fokus, hariIni).length !== jam9.length) {
        kosong.push(m);
      }
    }
    c('tak ada satu menit pun yang tidak menagih', kosong.length === 0,
      kosong.length === 0 ? '1440 menit penuh' : `${kosong.length} menit meleset`);
  }

  // Yang sudah di-follow up hari ini keluar dari daftar.
  const sudah = leaders.map((l) =>
    jam9.some((x) => x.id === l.id) ? { ...l, lastFollowupDayId: hariIni } : l,
  );
  c('yang sudah di-follow up hari ini tidak ditagih lagi',
    CORE.followupDue(sudah, jam(10), fokus, hariIni).length === 0);
  c('besok mereka tertagih lagi',
    CORE.followupDue(sudah, new Date(2026, 7, 30, 10), fokus, '2026-08-30').length > 0);

  // 22 Sep 2026 (Today OS): jendela kartu Home 09.00–09.30 DIBUANG bersama
  // fungsinya; baris Follow Up di Today menagih sepanjang hari dari followupDue.
  c('followupCardWindow sudah tidak ada', typeof CORE.followupCardWindow === 'undefined');
  c('tagihan tetap menyala jam 09.31 dst (sepanjang hari)',
    CORE.followupDue(leaders, jam(9, 31), fokus, hariIni).length > 0 &&
      CORE.followupDue(leaders, jam(21, 0), fokus, hariIni).length > 0);

  // Ketiga tempat berangkat dari SATU fungsi.
  for (const [f, apa] of [
    ['app/(tabs)/core.tsx', 'badge sub-tab'],
    ['lib/today.ts', 'baris Today (engine)'],
    ['app/(tabs)/_layout.tsx', 'badge tab CORE'],
    ['app/reminders.tsx', 'reminder Semua Pengingat'],
  ]) {
    // app/(tabs)/core.tsx tidak lagi memanggil followupDue langsung: angkanya kini
    // datang dari coreAttention(), yang di dalamnya memakai followupDue —
    // satu perhitungan yang sama dengan badge tile di Home.
    c(`${apa.padEnd(24)} memakai followupDue`,
      /followupDue\(|coreAttention\(/.test(baca(f)));
  }
  c('tak ada lagi yang menghitung sendiri dengan focusLeaders + filter',
    !/focusLeaders\([^)]*\)\.filter/.test(baca('lib/today.ts')) &&
      !/focusLeaders\([^)]*\)\.filter/.test(baca('app/(tabs)/core.tsx')));
  c('Today TIDAK dibatasi jendela jam (bertahan sampai dikerjakan)',
    !/followupCardWindow/.test(baca('lib/today.ts')) &&
      /id: 'followup',[\s\S]{0,80}tier: 'today',/.test(baca('lib/today.ts')));
  c('Semua Pengingat juga tidak dibatasi jendela itu',
    !/followupCardWindow/.test(baca('app/reminders.tsx')));
  c('badge sub-tab Follow Up ikut jam berjalan (berganti sendiri tiap hari)',
    /const \{ now, todayId: dayId \} = useNow\(\);/.test(baca('app/(tabs)/core.tsx')));
}

// =====================================================================
console.log('\n=== 2. Catatan Revive jadi arsip + 🔗 Connect to CORE ===');
// =====================================================================
{
  const rev = baca('app/revive.tsx');
  c('Revive hari LAIN yang sudah ditulis = arsip',
    // 21 Sep 2026: dokumen yang baru berisi isian Morning Journey (belum utuh)
    // tidak dikunci — masih form supaya bisa dilengkapi.
    /const arsip = exists && reviveWritten\(entry\) && targetDay !== todayId;/.test(rev));
  c('judulnya ikut berganti jadi "Catatan Revive"',
    /title=\{arsip \? 'Catatan Revive 📖' : 'Tulis Revive ✍️'\}/.test(rev));
  c('mode arsip tidak menggambar satu pun kolom isian', (() => {
    const i = rev.indexOf('/* ===================== ARSIP');
    const j = rev.indexOf('</ScrollView>', i);
    const blok = rev.slice(i, j);
    return !/FormInput|BibleRefField|PrimaryButton|InlineDelete/.test(blok);
  })());
  // 31 Agu 2026: kalimat penjelas "Catatan ini sudah jadi arsip…" dibuang
  // sendiri oleh pemiliknya (di Revive & Catatan Khotbah sekaligus). Yang
  // dijaga di sini penanda 🔒-nya + sifat baca-sajanya, bukan kalimatnya.
  c('ada penanda 🔒 Arsip, seperti Catatan Khotbah',
    /🔒 Arsip/.test(rev) && /🔒 Arsip/.test(baca('app/sermon.tsx')));
  // Tombol WA-nya kini komponen bersama <ShareWhatsAppButton/> (bunyinya
  // dijaga di cek-jarak-tombol.js), jadi yang dicari di layar ini pemakaiannya.
  // 31 Agu 2026: <BacaBlok> jadi banyak baris karena dapat tombol 📌
  // "jadikan reminder harian" di ujung labelnya.
  c('isinya tetap bisa dibaca utuh & dibagikan',
    /<BacaBlok\s+label="✨ Rhema"/.test(rev) && /<ShareWhatsAppButton/.test(rev));

  // Tombol Connect ada di KEDUA layar catatan.
  for (const [f, kind] of [['app/revive.tsx', 'revive'], ['app/sermon.tsx', 'sermon']]) {
    c(`${f.replace('app/', '').padEnd(12)} punya tombol Connect`,
      new RegExp(`<ConnectCoreButton\\s+kind="${kind}"`).test(baca(f)));
  }

  const pick = baca('components/spiritual/ConnectCoreButton.tsx');
  c('yang bisa dipilih cuma acara yang BELUM lewat',
    /!v\.done && v\.date\.toDate\(\)\.getTime\(\) >= awalHariIni/.test(pick) &&
      /m\.date\.toDate\(\)\.getTime\(\) >= awalHariIni/.test(pick));
  c('pilihannya Visitation & Monthly, terdekat dulu',
    /Visitation/.test(pick) && /Monthly/.test(pick) &&
      /sort\(\(a, b\) => a\.waktu\.getTime\(\) - b\.waktu\.getTime\(\)\)/.test(pick));
  // 21 Sep 2026: syaratnya jadi `when: open` di useLiveAll.
  c('CORE cuma dilanggan selagi modalnya terbuka (tak ada baca sia-sia)',
    /\{ when: open \}/.test(pick));

  const view = baca('components/core/LinkedNotesButton.tsx');
  c('tombol 🔗 TIDAK digambar kalau tak ada sambungan',
    /if \(tersambung\.length === 0\) return null;/.test(view));
  c('isinya dibaca dari catatan aslinya, bukan salinan',
    /subscribeReviveEntries/.test(view) && /subscribeSermons/.test(view));
  c('catatan yang sudah dihapus dikatakan apa adanya',
    /sudah dihapus/.test(view));
  for (const f of ['components/core/VisitationTab.tsx', 'components/core/MonthlyTab.tsx']) {
    c(`${f.replace('components/core/', '').padEnd(20)} memasang tombol 🔗`,
      /<LinkedNotesButton links=\{noteLinks\} coreId=\{[a-z]\.id\} \/>/.test(baca(f)));
  }

  // Logika sambungannya dijalankan.
  let links = {};
  const rev1 = { kind: 'revive', noteId: '2026-08-28', title: 'THE DANGER OF DENIAL' };
  const ser1 = { kind: 'sermon', noteId: '2026-08-23', title: 'MERDEKA' };
  c('awalnya kosong', CN.noteLinksOf(links, 'v1').length === 0);
  links = CN.toggleNoteLink(links, 'v1', rev1);
  c('disambungkan → muncul di acaranya', CN.noteLinksOf(links, 'v1').length === 1);
  c('dan hanya di acara itu', CN.noteLinksOf(links, 'v2').length === 0);
  links = CN.toggleNoteLink(links, 'v1', ser1);
  c('satu acara boleh punya beberapa catatan', CN.noteLinksOf(links, 'v1').length === 2);
  links = CN.toggleNoteLink(links, 'v2', rev1);
  c('satu catatan boleh disambungkan ke beberapa acara',
    CN.isNoteLinked(links, 'v1', 'revive', '2026-08-28') &&
      CN.isNoteLinked(links, 'v2', 'revive', '2026-08-28'));
  links = CN.toggleNoteLink(links, 'v1', rev1);
  c('ditekan lagi → lepas', !CN.isNoteLinked(links, 'v1', 'revive', '2026-08-28') &&
    CN.noteLinksOf(links, 'v1').length === 1);
  links = CN.toggleNoteLink(links, 'v1', ser1);
  c('acara yang sambungannya habis dibuang dari peta (tak menumpuk sisa)',
    !('v1' in links), JSON.stringify(links));

  const sesudahHapus = CN.dropNoteLinks(links, 'revive', '2026-08-28');
  c('catatan dihapus → semua sambungannya ikut lepas',
    sesudahHapus !== null && Object.keys(sesudahHapus).length === 0);
  c('tak ada yang berubah → null (tidak menulis Firestore sia-sia)',
    CN.dropNoteLinks({}, 'revive', 'x') === null);
  c('layar Revive & Khotbah membersihkannya saat menghapus',
    /purgeNoteLinks\(user\.uid, 'revive', targetDay\)/.test(rev) &&
      /purgeNoteLinks\(user\.uid, 'sermon', sundayId\)/.test(baca('app/sermon.tsx')));
}

// =====================================================================
console.log('\n=== 3. Tanggal di layar Baca Alkitab ===');
// =====================================================================
{
  const br = baca('app/bible-reading.tsx');
  c('tanggalnya ditampilkan di headernya',
    /📅 \{formatFullDate\(now\)\}/.test(br));
  c('memakai pemformat yang sama dengan layar rohani lain',
    /formatFullDate/.test(baca('app/revive.tsx')) &&
      /formatFullDate/.test(baca('app/sermon.tsx')));
}

// =====================================================================
console.log('\n=== 4 & 5. YouVersion: langsung ke pasal & terjemahannya ===');
// =====================================================================
{
  // Semua 66 kitab punya kode USFM-nya.
  const tanpaKode = B.BIBLE_BOOKS.filter((b) => !B.usfmOf(b.name));
  c('keenam puluh enam kitab punya kode USFM',
    B.BIBLE_BOOKS.length === 66 && tanpaKode.length === 0,
    tanpaKode.map((b) => b.name).join(', ') || '66/66');
  c('kodenya tidak ada yang kembar',
    new Set(Object.values(B.USFM_BY_BOOK)).size === 66);
  c('contoh kodenya benar',
    B.usfmOf('Amsal') === 'PRO' && B.usfmOf('Yohanes') === 'JHN' &&
      B.usfmOf('Kisah Para Rasul') === 'ACT' && B.usfmOf('1 Yohanes') === '1JN' &&
      B.usfmOf('Wahyu') === 'REV' && B.usfmOf('Kejadian') === 'GEN');

  c('"Amsal 29" → PRO.29', B.usfmRef('Amsal 29') === 'PRO.29');
  c('"Amsal 3:5-6" → PRO.3.5 (pasalnya dibuka, ayatnya disorot)',
    B.usfmRef('Amsal 3:5-6') === 'PRO.3.5');
  c('"Yakobus" (tanpa pasal) → JAS.1', B.usfmRef('Yakobus') === 'JAS.1');
  c('kitab yang tak dikenali → null', B.usfmRef('Kitab Ngawur 3') === null);

  c('"Yakobus 3, Amsal 14" dipecah jadi dua acuan',
    JSON.stringify(B.splitBibleRefs('Yakobus 3, Amsal 14')) ===
      JSON.stringify(['Yakobus 3', 'Amsal 14']));
  c('"Amsal 3:5-6" TIDAK ikut terpecah',
    JSON.stringify(B.splitBibleRefs('Amsal 3:5-6')) ===
      JSON.stringify(['Amsal 3:5-6']));

  // Alamatnya.
  const tb = S.youVersionLink('Amsal 29', 'TB');
  c('terjemahan yang nomornya SUDAH dipastikan ikut ditempel',
    tb.scheme === 'youversion://bible?reference=PRO.29&version=306', tb.scheme);
  c('alamat webnya ikut memakai nomor itu',
    tb.web === 'https://www.bible.com/bible/306/PRO.29', tb.web);

  const tsi = S.youVersionLink('Amsal 29', 'TSI');
  c('TSI ikut terdaftar (320) — terjemahan yang dibaca sehari-hari',
    tsi.scheme === 'youversion://bible?reference=PRO.29&version=320', tsi.scheme);
  // Yang belum dipastikan nomornya TETAP tidak dipaksa: pasalnya benar, versi
  // ikut yang sedang aktif di YouVersion. Salah nomor = salah terjemahan
  // diam-diam, dan itu tidak kelihatan sampai ayatnya dibaca.
  const bis = S.youVersionLink('Amsal 29', 'BIS');
  c('terjemahan yang belum terdaftar → pasalnya tetap benar, versi tidak dipaksa',
    bis.scheme === 'youversion://bible?reference=PRO.29', bis.scheme);
  c('nomor versi tidak pernah ditebak-tebak',
    S.youVersionVersionId('BIS') === null &&
      S.youVersionVersionId('TB') === 306 &&
      S.youVersionVersionId('TSI') === 320);
  c('singkatannya tidak peka huruf besar-kecil',
    S.youVersionVersionId('tb') === 306);

  // Dijalankan: tombolnya benar-benar membuka alamat itu.
  dibuka.length = 0;
  S.openYouVersion('Amsal 29', 'TB');
  c('openYouVersion(acuan) membuka pasalnya',
    dibuka.length === 1 && /reference=PRO\.29/.test(dibuka[0].url), dibuka[0]?.url);
  dibuka.length = 0;
  S.openYouVersion();
  c('tanpa acuan → tetap membuka YouVersion apa adanya (seperti dulu)',
    dibuka.length === 1 && dibuka[0].url === 'youversion://' &&
      /apps\.apple\.com/.test(dibuka[0].fallback));

  // Layarnya.
  c('tombol di layar Baca Alkitab mengoper bacaan & terjemahannya',
    /passage=\{filled\[0\]\}/.test(baca('app/bible-reading.tsx')) &&
      /version=\{versiTerpakai\}/.test(baca('app/bible-reading.tsx')));
  const tab = baca('components/spiritual/BibleReadingTab.tsx');
  c('tiap acuan di riwayat jadi tombolnya sendiri',
    /splitBibleRefs\(d\[session\]\)\.map/.test(tab) &&
      /openYouVersion\(acuan, versi\)/.test(tab));
  c('acuan yang kitabnya tak dikenali tidak dibuat bisa di-click',
    /const bisa = usfmRef\(acuan\) !== null;/.test(tab) && /disabled=\{!bisa\}/.test(tab));
}

// =====================================================================
console.log('\n=== 6. Kartu centang puasa malam (20.00–24.00) ===');
// =====================================================================
{
  const rencana = {
    id: 'p1', title: 'Puasa Daniel', prayer: '', rules: '', answer: '',
    startId: '2026-08-24', endId: '2026-08-30', days: {},
  };
  const hariIni = '2026-08-29';
  c('siang (jam 13) → belum menagih',
    F.fastingCheckDue([rencana], jam(13), hariIni) === null);
  c('jam 19.59 → belum', F.fastingCheckDue([rencana], jam(19, 59), hariIni) === null);
  c('jam 20.00 → menagih', F.fastingCheckDue([rencana], jam(20), hariIni)?.id === 'p1');
  c('jam 23.59 → masih menagih',
    F.fastingCheckDue([rencana], jam(23, 59), hariIni)?.id === 'p1');

  const beres = { ...rencana, days: { [hariIni]: { prayer: '', answer: '', done: true } } };
  c('sudah dicentang berhasil → berhenti menagih',
    F.fastingCheckDue([beres], jam(21), hariIni) === null);
  const gagal = {
    ...rencana,
    days: { [hariIni]: { prayer: '', answer: 'batal, sakit', done: false } },
  };
  c('ditandai ❌ gagal pun berhenti menagih (jangan memaksa berbohong)',
    F.fastingCheckDue([gagal], jam(21), hariIni) === null);
  c('tidak ada puasa berjalan → tidak ada kartu',
    F.fastingCheckDue([], jam(21), hariIni) === null);
  c('puasa yang sudah lewat periodenya tidak ikut ditagih',
    F.fastingCheckDue([rencana], new Date(2026, 8, 5, 21), '2026-09-05') === null);

  c('hari ke-berapa dihitung benar',
    F.fastingDayNumber(rencana, hariIni) === 6, String(F.fastingDayNumber(rencana, hariIni)));

  const home = baca('app/(tabs)/index.tsx');
  // 22 Sep 2026: barisnya di hero With God (Today Engine), menuju hari INI.
  c('barisnya ada di Today (With God) & menuju modal HARI INI',
    /const due = fastingCheckDue\(plans, now, todayId\);/.test(BACA_TODAY('lib/today.ts')) &&
      /pathname: '\/fasting-days', params: \{ id: fastingNow\.id, day: todayId \}/.test(BACA_TODAY('lib/today.ts')));
  // Checklist hariannya sekarang punya layar sendiri (/fasting-days) — yang
  // ditulis sekali di awal & yang dibuka tiap malam memang dua urusan berbeda.
  // Kartu malam di Home ikut mendarat ke sana, jadi ?day=… diurus di situ.
  const layar = baca('app/fasting-days.tsx');
  c('layar Hari per Hari membuka modal dari ?day=…',
    /dayParam && dayIds\.includes\(dayParam\) \? dayParam : null/.test(layar));
  c('tanpa efek penyalin — dipakai useDraft, bukan useEffect+setState',
    /useDraft<string \| null>\(/.test(layar) &&
      !/useEffect\(\(\) => \{[\s\S]{0,200}setEditDay/.test(layar));
  c('ketikan modalnya dikunci per hari (pindah hari ≠ sisa ketikan hari lain)',
    /const \[edits, setEdits\] = useState<Record<string, FastingDay>>\(\{\}\);/.test(layar));
}

// =====================================================================
console.log('\n=== 7. Catatan refleksi diisi lewat modal ===');
// =====================================================================
{
  const tab = baca('components/habits/HabitsTab.tsx');
  // Sejak 11 Sep 2026 komponennya di components/common/NoteField.tsx —
  // Habits & rangkuman mingguan Learning memakai yang SATU ini.
  const nf = baca('components/common/NoteField.tsx');
  c('barisnya jadi tombol pratinjau, bukan kolom isian',
    /<PressableScale\s*\n\s*style=\{\[styles\.noteBox, boxStyle\]\}/.test(nf) &&
      /<NoteField/.test(tab));
  c('mengisinya di dalam SheetModal',
    /<SheetModal/.test(nf) && /<FormInput/.test(nf));
  c('kolomnya dibuat lega di dalam modal',
    /noteSheetInput: \{ minHeight: 180/.test(nf));
  c('SheetModal memang punya penghindar keyboard',
    /KeyboardAvoidingView/.test(baca('components/common/SheetModal.tsx')));
  // Catatan berbutir ("Bersyukur 3 Hal") membuat isinya dirangkai dulu
  // sebelum disimpan — tapi aturannya sama: SEKALI di akhir, dan hanya kalau
  // memang berubah.
  c('menyimpannya tetap sekali di akhir, bukan tiap huruf',
    /if \(draf !== value\) onSave\(draf\);/.test(nf)); // 14 Sep 2026: isi → draf
  c('modal selalu mulai dari yang tersimpan',
    /\/\/ selalu mulai dari yang tersimpan\s*\n\s*setText\(value\);/.test(nf));
  // Cek yang dulu tidak mungkin ada: Habits memang sudah tidak memegang
  // salinannya sendiri. Tanpa ini, "dipindah" bisa diam-diam berarti
  // "disalin", dan dua salinan cuma sama sampai salah satunya diubah.
  c('Habits memakai komponen bersama itu, bukan salinannya',
    !/function HabitNote\(/.test(tab) &&
      /from '@\/components\/common\/NoteField'/.test(tab));
}

// =====================================================================
console.log('\n=== 8. "Day 241 / 365" (366 di tahun kabisat) ===');
// =====================================================================
{
  c('29 Agu 2026 → Day 241 / 365', SH.archiveNo('2026-08-29') === 'Day 241 / 365',
    SH.archiveNo('2026-08-29'));
  c('1 Januari → Day 1', SH.archiveNo('2026-01-01') === 'Day 1 / 365');
  c('31 Desember 2026 → Day 365', SH.archiveNo('2026-12-31') === 'Day 365 / 365');
  c('2024 kabisat → 31 Desember = Day 366',
    SH.archiveNo('2024-12-31') === 'Day 366 / 366', SH.archiveNo('2024-12-31'));
  c('29 Februari memang ada di 2024', SH.archiveNo('2024-02-29') === 'Day 60 / 366');
  c('aturan kabisat lengkap: 1900 bukan, 2000 iya',
    SH.isLeapYear(1900) === false && SH.isLeapYear(2000) === true &&
      SH.isLeapYear(2024) === true && SH.isLeapYear(2026) === false);

  // Nomornya naik satu tiap hari, tanpa lompat, sepanjang tahun kabisat.
  let urut = true;
  for (let i = 0; i < 366; i++) {
    const d = new Date(2024, 0, 1 + i);
    const id = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (SH.archiveNo(id) !== `Day ${i + 1} / 366`) { urut = false; break; }
  }
  c('366 hari 2024 bernomor urut tanpa lompat', urut);
}

console.log('\n' + (ok ? 'LULUS' : 'GAGAL'));
process.exit(ok ? 0 : 1);