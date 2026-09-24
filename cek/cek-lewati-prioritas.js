// Tiga permintaan 10 Sep 2026:
//   1. Daily Priority 💡 punya tombol "lewati hari ini" — sekeluarga dengan
//      Morning/Midday/Night Reading — dan barisnya di Habits jadi ✗.
//   2. Di layar Reading, tombol lewati HILANG begitu jendelanya habis tanpa
//      sesi itu terisi: saat itu ✗-nya sudah ditandai sendiri.
//   3. Kolom Terjemahan pindah ke DALAM kartu bacaan.
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');
const Module = require('module');
const { execFileSync } = require('child_process');

const R = AKAR + '/';
const OUT = path.join(__dirname, 'keluar-lewati');
const baca = (f) => fs.readFileSync(R + f, 'utf8');

let ok = true;
const c = (n, s, extra) => {
  if (!s) ok = false;
  console.log((s ? '  ✓ ' : '  ✗ ') + n + (extra ? `  → ${extra}` : ''));
};

/** Kode tanpa komentar — supaya cek kasar tidak lolos gara-gara komentar. */
const kode = (t) =>
  t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

// ---------- Kompilasi ----------
fs.rmSync(OUT, { recursive: true, force: true });
try {
  execFileSync(
    process.execPath,
    [
      R + 'node_modules/typescript/bin/tsc', '--ignoreConfig',
      R + 'lib/priority.ts', R + 'lib/spiritual.ts',
      '--outDir', OUT,
      '--module', 'commonjs', '--target', 'es2020',
      '--skipLibCheck', '--esModuleInterop', '--moduleResolution', 'bundler',
    ],
    { stdio: 'pipe' },
  );
} catch { /* keluhan tipe diabaikan */ }

const DIR = fs.existsSync(path.join(OUT, 'lib')) ? path.join(OUT, 'lib') : OUT;
for (const f of ['priority.js', 'spiritual.js']) {
  if (!fs.existsSync(path.join(DIR, f))) {
    console.log(`  ✗ gagal mengompilasi ${f}`);
    process.exit(1);
  }
}

// Tulisan Firestore disadap, bukan cuma dicocokkan teksnya: yang mau
// dibuktikan adalah APA yang benar-benar dikirim (dan bahwa ia merge).
const tulis = [];
let kirimSnapshot = null;

Module._load = ((asli) => function (req, parent, isMain) {
  if (req === 'firebase/firestore') {
    return {
      collection: () => ({}), doc: () => ({ path: 'x' }),
      setDoc: async (_ref, data, opts) => { tulis.push({ data, opts }); },
      getDoc: async () => ({ data: () => ({}) }), onSnapshot: () => () => {},
      deleteDoc: async () => {}, addDoc: async () => ({}), updateDoc: async () => {},
      deleteField: () => '__d__', query: () => ({}), orderBy: () => ({}),
      where: () => ({}), limit: () => ({}), writeBatch: () => ({}),
      arrayUnion: () => ({}), getDocs: async () => ({ docs: [] }),
      increment: () => 1, serverTimestamp: () => new Date(),
      Timestamp: { fromDate: (d) => d, now: () => new Date() },
    };
  }
  if (req === './firebase' || req.endsWith('/firebase')) return { db: {} };
  if (req === './liveDoc' || req.endsWith('/liveDoc')) {
    return {
      liveDoc: (_ref, onNext) => { kirimSnapshot = onNext; return () => {}; },
      unsubscribeAll: () => () => {},
    };
  }
  if (/^@\/assets\/style\/color$/.test(req)) {
    return { Color: new Proxy({}, { get: (_, k) => `Color.${String(k)}` }) };
  }
  if (/^(@\/|expo-|expo$|react-native|@react-native)/.test(req)) return {};
  return asli.call(this, req, parent, isMain);
})(Module._load);

const P = require(path.join(DIR, 'priority.js'));
const S = require(path.join(DIR, 'spiritual.js'));

const item = (text, done = false) => ({ text, done });
const hari = (items, skipped = false) => ({ items, skipped });

// =====================================================================
console.log('=== 1. Daily Priority 💡 bisa dilewati ===');
// =====================================================================
{
  const lib = baca('lib/priority.ts');
  const layar = baca('app/daily-priority.tsx');

  // ---- Bentuk datanya ----
  c('tandanya menumpang di dokumen hari yang SAMA (ikut hilang tengah malam)',
    /'users', uid, 'priority', dayId/.test(lib) &&
      /export type PriorityDay = \{ items: PriorityItem\[\]; skipped: boolean \};/.test(
        lib,
      ));

  // Dijalankan, bukan dicocokkan: dokumen apa pun harus terbaca jadi bentuk
  // yang sama, dan `skipped` hanya true kalau memang persis true.
  const terbaca = [];
  P.subscribePriorityDay('u', '2026-09-10', (d) => terbaca.push(d));
  const kirim = (data) => kirimSnapshot({ data: () => data });
  kirim(undefined);
  kirim({ items: [item('A')] });
  kirim({ items: [item('A')], skipped: true });
  kirim({ items: [item('A')], skipped: 'ya' });
  c('dokumen kosong → belum dilewati & tetap 3 baris',
    terbaca[0].skipped === false && terbaca[0].items.length === 3);
  c('ada isinya tapi tanpa tanda → belum dilewati',
    terbaca[1].skipped === false && terbaca[1].items[0].text === 'A');
  c('tandanya terbaca', terbaca[2].skipped === true);
  c('nilai selain true TIDAK dianggap dilewati (bukan sekadar truthy)',
    terbaca[3].skipped === false);

  // ---- Yang benar-benar ditulis ke Firestore ----
  tulis.length = 0;
  P.setPrioritySkipped('u', '2026-09-10', true);
  c('melewati hari TIDAK menghapus baris yang sudah ditulis',
    tulis.length === 1 &&
      Object.keys(tulis[0].data).join() === 'skipped' &&
      tulis[0].data.skipped === true,
    JSON.stringify(tulis[0]?.data));
  c('…dan ditulis dengan merge', tulis[0]?.opts?.merge === true);

  tulis.length = 0;
  P.savePriorityDay('u', '2026-09-10', [item('A'), item('B'), item('C')]);
  // INI yang paling mudah salah: tanpa merge, tiap kali kolomnya kehilangan
  // fokus dokumennya ditulis ulang utuh dan tanda dilewati ikut lenyap
  // diam-diam — hari yang kamu lewati diam-diam kembali menagih.
  c('menyimpan isian tidak menghapus tanda dilewati (merge)',
    tulis.length === 1 &&
      Object.keys(tulis[0].data).join() === 'items' &&
      tulis[0].opts?.merge === true);

  // ---- Baris cermin di Habits ----
  c('3 baris terisi → tercentang',
    P.priorityMirrorState(hari([item('A'), item('B'), item('C')])).done === true);
  c('baru 2 terisi → belum tercentang',
    P.priorityMirrorState(hari([item('A'), item('B'), item('')])).done === false);
  c('dilewati → baris Habits jadi ✗',
    P.priorityMirrorState(hari([item(''), item(''), item('')], true)).skipped ===
      true);
  // Tanda ✗ menang: di HabitsTab baris ber-✗ memang tidak bisa tercentang,
  // jadi keduanya tak mungkin tampil bersamaan di layar.
  c('sudah terisi lalu tetap dilewati → tandanya ✗ juga ikut',
    P.priorityMirrorState(hari([item('A'), item('B'), item('C')], true))
      .skipped === true);

  const habits = kode(baca('app/habits.tsx'));
  c('Habits memakai aturan itu, tidak lagi memaku "tidak pernah dilewati"',
    /if \(kind === 'priority'\) return priorityMirrorState\(priorities\);/.test(
      habits,
    ) && !/skipped: false/.test(habits));

  // ---- Tombolnya di layar ----
  c('tombolnya komponen BERSAMA, sama seperti Reading/Revive/Fitness',
    /from '@\/components\/common\/SkipToday'/.test(layar) &&
      /<SkipButton/.test(layar) &&
      /<SkipNotice/.test(layar));
  c('bunyinya satu keluarga dengan tombol lewati yang lain',
    /label="⏭️ Lewati prioritas hari ini"/.test(layar));
  c('klik = balik-balikkan tandanya',
    /await setPrioritySkipped\(user\.uid, todayId, !skipped\);/.test(layar));
  c('baru MENANDAI → kembali ke Home; membatalkan → tetap di layarnya',
    /if \(!skipped\) router\.back\(\);/.test(layar));
  c('sedang dilewati → dikabari, dan bunyinya menyebut akibatnya di Habits',
    /title="⏭️ Skipped Today"/.test(layar) &&
      /detail="❌ Tercatat tak tuntas di Habits"/.test(layar));
  c('tombolnya mati selagi tandanya sedang ditulis',
    /busy=\{busy\}/.test(layar) && /if \(!user \|\| busy\) return;/.test(layar));

  // ---- Pil 💡 di Home ----
  c('pil Home berhenti menagih hari yang sudah kamu lewati',
    P.priorityBadgeText(hari([item(''), item(''), item('')], true)) === '💡 ⏭️');
  c('Today mengoper HARI-nya, bukan cuma daftar barisnya (22 Sep 2026: useTodayData → PrioritiesBlock)',
    /useState<PriorityDay>\(EMPTY_PRIORITY_DAY\)/.test(baca('hooks/useTodayData.ts')) &&
      /day: PriorityDay/.test(baca('components/today/PrioritiesBlock.tsx')));
}

// =====================================================================
console.log('\n=== 2. Reading: yang sudah terlewat tak ditawari lewati ===');
// =====================================================================
{
  const layar = baca('app/bible-reading.tsx');

  // Aturannya DIJALANKAN, bukan dibaca: potong dari sumbernya lalu uji
  // tabel kebenarannya. Kalau suatu saat rumusnya diubah, di sinilah
  // ketahuan — bukan di regex yang kebetulan masih cocok.
  const potong = layar.match(/const terlewat = ([^;]+);/);
  c('aturan "terlewat" ada di layarnya', !!potong, potong?.[1]);
  if (potong) {
    const terlewat = new Function('existing', 'minutesLeft', `return ${potong[1]};`);
    c('jendela habis & sesi kosong → terlewat', terlewat('', -5) === true);
    c('jendela habis TEPAT di menit 0 → terlewat', terlewat('', 0) === true);
    c('masih di dalam jendela → belum terlewat', terlewat('', 40) === false);
    c('sudah dicatat → bukan terlewat, walau jamnya habis',
      terlewat('Amsal 3', -5) === false);
    c('sudah ditandai lewat sendiri → bukan "terlewat" otomatis',
      terlewat('__skip__', -5) === false);
  }

  c('tombol lewati disembunyikan kalau sudah terlewat',
    /\{!terlewat && \(\s*<SkipButton/.test(layar));
  // Yang TERLANJUR ditandai lewat sendiri tetap punya tombolnya, karena di
  // keadaan itu bunyinya "↩️ Batalkan lewati" — dan membatalkan masih berguna.
  c('tombolnya tetap ada di dalam jendela & untuk membatalkan',
    /label="⏭️ Lewati baca hari ini"/.test(layar) &&
      /skipped=\{skipped\}/.test(layar));

  // Alasan menyembunyikannya: Habits SUDAH menandainya ✗ sendiri. Kalau
  // aturan itu berubah, tombol yang hilang jadi salah — jadi diuji di sini.
  const kosong = { morning: '', daytime: '', night: '' };
  const pagiLewat = new Date(2026, 8, 10, 11, 0);
  const masihPagi = new Date(2026, 8, 10, 7, 0);
  c('jendela habis tanpa dibaca → Habits menandainya ✗ sendiri',
    S.bibleMirrorState(kosong, 'morning', pagiLewat).skipped === true &&
      S.bibleMirrorState(kosong, 'morning', pagiLewat).done === false);
  c('masih di dalam jendela → belum ditandai apa-apa',
    S.bibleMirrorState(kosong, 'morning', masihPagi).skipped === false);
  c('sudah dibaca → tercentang, bukan ✗ walau jamnya lewat',
    S.bibleMirrorState({ ...kosong, morning: 'Amsal 3' }, 'morning', pagiLewat)
      .done === true &&
      S.bibleMirrorState({ ...kosong, morning: 'Amsal 3' }, 'morning', pagiLewat)
        .skipped === false);

  c('keterangan jendelanya jujur menyebut akibatnya',
    /Otomatis ✗ di Habits, streak hilang/.test(layar));
}

// =====================================================================
console.log('\n=== 3. Terjemahan pindah ke DALAM kartu bacaan ===');
// =====================================================================
{
  const komp = baca('components/spiritual/BibleRefList.tsx');
  const layar = baca('app/bible-reading.tsx');
  const tab = baca('components/spiritual/BibleReadingTab.tsx');

  // Isi SATU kartu, dipotong dari pembuka kartunya sampai penutup .map().
  // Penutupnya dicari dengan indentasinya ikut ("\n      ))}"): `))}` polos
  // juga muncul di tengah kartu (ekor `onChange(refs.map(…))}`), dan potongan
  // yang berhenti di situ akan diam-diam melewatkan separuh isi kartunya.
  const awal = komp.indexOf('style={styles.refCard}');
  const akhir = komp.indexOf('\n      ))}', awal);
  const kartu = komp.slice(awal, akhir);
  c('kolomnya benar-benar DI DALAM kartu bacaan',
    awal > 0 && akhir > awal && /styles\.versionRow/.test(kartu));
  c('cuma di kartu PERTAMA — satu terjemahan untuk seluruh bacaan hari itu',
    /\{i === 0 && onVersionChange \? \(/.test(kartu));
  c('lebih dari satu kitab → labelnya mengaku berlaku untuk semuanya',
    /refs\.length > 1 \? ' \(semua bacaan\)' : ''/.test(kartu));
  c('dipisah garis tipis dari acuannya, masih satu kartu',
    /versionRow: \{[\s\S]*?borderTopWidth: 1,/.test(komp));

  // Bloknya berhenti disalin: SATU tempat, dua pemakai.
  for (const [nama, isi] of [
    ['layar catat', layar],
    ['sheet ubah riwayat', tab],
  ]) {
    c(`${nama} mengoper terjemahannya ke komponen bersama`,
      /version=\{version\}/.test(isi) && /onVersionChange=\{setVersion\}/.test(isi));
    c(`${nama} tidak lagi menyalin blok kolomnya sendiri`,
      !/styles\.versionRow/.test(isi) && !/versionInput/.test(isi));
  }

  // Terjemahannya tetap ikut tersimpan — pindah tempat, bukan hilang.
  c('layar catat tetap menyimpan terjemahan yang dipakai',
    /versiTerpakai,\s*\);/.test(layar) &&
      /const versiTerpakai = version\.trim\(\) \|\| BIBLE_VERSION_DEFAULT;/.test(
        layar,
      ));
  c('sheet ubah tetap menyimpannya saat Perbarui',
    /version\.trim\(\) \|\| BIBLE_VERSION_DEFAULT,/.test(tab));
}

console.log(ok ? '\nLULUS' : '\nGAGAL');
process.exit(ok ? 0 : 1);
