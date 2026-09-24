// 21 Sep 2026: langganan lewat useLiveAll → `subscribeX(uid, …)`, bukan `user.uid`.
// Delapan permintaan (6 Sep 2026, malam):
//   1. His Promise 🚩 — sub-tab baru di Spiritual + halaman tulis/ubahnya
//   2. Tombol ChatGPT di "💬 Discussion This Week"
//   3. Ayat Memuji & Menyembah di gerbang doa pagi diundi tiap hari
//   4. Ring score 7/10 di Habits bisa diklik → daftar kebiasaan WAJIB per sesi
//   5. Isi catatan khotbah tak lagi mengintip di daftar; ⏸️ hanya Bible Reading
//   6. Puasa yang belum mulai bukan puasa yang "✅ Selesai"
//   7. Lencana angkat beban mingguan keluar dari kolom Fitness
//   8. Kartu Refleksi di Home → Habits, langsung ke dasar daftarnya
const AKAR = require('./akar');
const BACA_TODAY = (p) => require('fs').readFileSync(AKAR + '/' + p, 'utf8').replace(/\r\n/g, '\n'); // 22 Sep 2026 Today OS
const fs = require('fs');
const ts = require(AKAR + '/node_modules/typescript');
const R = AKAR + '/';
const baca = (f) => fs.readFileSync(R + f, 'utf8').replace(/\r\n/g, '\n');

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

// ============================================================
console.log('=== 1. His Promise 🚩 ===');
// ============================================================
const P = pasang(tsc(baca('lib/promise.ts')), (m) => {
  if (m === 'firebase/firestore') {
    return {
      collection: () => ({}),
      deleteDoc: async () => {},
      doc: () => ({}),
      limit: () => ({}),
      orderBy: () => ({}),
      query: (...a) => ({ a }),
      setDoc: async () => {},
    };
  }
  if (m === './firebase') return { db: {} };
  if (m === './liveDoc') return { liveList: () => () => {} };
  if (m === './format') return { dayIdToDate: (id) => new Date(id + 'T00:00:00') };
  return {};
});

const spiritual = baca('app/(tabs)/walk.tsx');
c('sub-tabnya ada di Spiritual',
  /\{ key: 'promise', label: 'Promise', icon: 'flag\.fill' \}/.test(spiritual));
c('sub-tabnya di antara Bible Reading & Fasting',
  spiritual.indexOf(`key: 'bible'`) < spiritual.indexOf(`key: 'promise'`) &&
    spiritual.indexOf(`key: 'promise'`) < spiritual.indexOf(`key: 'fasting'`));
c('daftarnya dilangganani di layar Spiritual',
  /subscribePromises\(uid, setPromises, fail\)/.test(spiritual));
c('sub-tabnya benar-benar dirender',
  /tab === 'promise' \? \(\s*<PromiseTab list=\{promises\} \/>/.test(spiritual));

// Semua yang kamu minta ada kolomnya.
const promiseLib = baca('lib/promise.ts');
for (const [nama, field] of [
  ['janji Tuhan apa', 'promise'],
  ['fakta ayatnya di mana', 'verse'],
  ['pergumulan yang relate', 'struggle'],
  ['keterangan/ceritanya', 'story'],
  ['ada doanya atau tidak', 'prayed'],
  ['terjawabnya kapan', 'answeredId'],
  ['tanggal ditulis', 'createdId'],
  ['tanggal diperbarui', 'updatedId'],
]) {
  c(`kolom ${nama}`, new RegExp(`\\n  ${field}[?]?:`).test(promiseLib));
}

const halaman = baca('app/promise.tsx');
c('halaman tulisnya ada', /export default function PromiseScreen/.test(halaman));
c('ayatnya pakai pemilih kitab bersama, bukan diketik bebas',
  /<BibleRefField value=\{fVerse\}/.test(halaman));
c('ayatnya PERSIS (bukan chapterOnly seperti catat bacaan)',
  !/chapterOnly/.test(halaman));
c('tanggal terjawab baru ditanya sesudah "ada doanya"',
  /\{fPrayed && \(/.test(halaman) &&
    halaman.indexOf('{fPrayed && (') < halaman.indexOf('<DateField'));
c('janji tanpa isi ditolak, bukan tersimpan kosong',
  /if \(!fPromise\.trim\(\)\)/.test(halaman));
c('hapusnya PERMANEN & pakai konfirmasi',
  /deletePromise\(user\.uid, editId\)/.test(halaman) && /<ConfirmDialog/.test(halaman));

// Tanggal ditulis TIDAK boleh ikut berubah tiap disimpan — itu yang paling
// ingin diingat dari sebuah janji.
c('createdId hanya ditulis saat janji BARU',
  /\.\.\.\(baru \? \{ createdId: hariIni \} : \{\}\),/.test(promiseLib));
c('updatedId selalu diperbarui', /updatedId: hariIni,/.test(promiseLib));
c('tanggal terjawab dibuang kalau doanya dimatikan',
  /answeredId: isi\.prayed \? isi\.answeredId : '',/.test(promiseLib));
c('digenapi = tanggal terjawabnya terisi',
  P.promiseAnswered({ answeredId: '2026-09-06' }) === true &&
    P.promiseAnswered({ answeredId: '' }) === false);
c('lama menunggu dihitung dari ditulis → terjawab',
  P.promiseWaitDays({ createdId: '2026-01-01', answeredId: '2026-01-31' }) === 30,
  String(P.promiseWaitDays({ createdId: '2026-01-01', answeredId: '2026-01-31' })));
c('belum terjawab → tak ada angka menunggu',
  P.promiseWaitDays({ createdId: '2026-01-01', answeredId: '' }) === null);
c('kemajuannya: berapa digenapi dari berapa',
  JSON.stringify(
    P.promiseProgress([{ answeredId: 'x' }, { answeredId: '' }, { answeredId: 'y' }]),
  ) === JSON.stringify({ done: 2, total: 3 }));
// Urutannya harus tetap: menyunting janji lama tidak boleh melemparnya ke puncak.
c('diurutkan dari kapan DITULIS, bukan kapan disunting',
  /orderBy\('createdId', 'desc'\)/.test(promiseLib));
const tab = baca('components/spiritual/PromiseTab.tsx');
c('daftarnya punya pagination', /usePagination/.test(tab) && /<Pagination/.test(tab));
c('ketiga tanggalnya tampil di kartunya',
  /p\.createdId/.test(tab) && /p\.updatedId/.test(tab) && /p\.answeredId/.test(tab));
c('rutenya ikut warna Spiritual', /promise: 'spiritual'/.test(baca('lib/featureTheme.ts')));
c('rutenya terdaftar di typed routes',
  /`\/promise`/.test(baca('.expo/types/router.d.ts')));

// ============================================================
console.log('\n=== 2. Tombol ChatGPT ===');
// ============================================================
const diskusi = baca('components/learning/DiscussionTab.tsx');
const linking = baca('lib/linking.ts');
c('tombolnya sebaris dengan judul "💬 Discussion This Week"',
  /<SectionRow\s*\n\s*title="💬 Discussion This Week"\s*\n\s*right=\{<MiniButton label="🎙️ ChatGPT" onPress=\{openChatGpt\} \/>\}/.test(
    diskusi,
  ));
c('memakai komponen bersama, bukan pil baru', /MiniButton/.test(diskusi) && /SectionRow/.test(diskusi));
c('gaya judul lamanya ikut dibuang', !/weeklyTitle/.test(diskusi));
c('pintunya satu tempat di lib/linking', /export function openChatGpt/.test(linking));
// Skema yang MEMANG jalan. `chatgpt://voice` belum ada — menebaknya cuma
// menghasilkan tombol yang terasa mati.
c('memakai skema chatgpt:// yang benar-benar terdaftar',
  /const CHATGPT_SCHEME = 'chatgpt:\/\/';/.test(linking) &&
    !/chatgpt:\/\/voice'/.test(linking));
c('ada cadangan webnya kalau app-nya belum terpasang',
  /fallback: CHATGPT_WEB/.test(linking) &&
    /const CHATGPT_WEB = 'https:\/\/chatgpt\.com\/';/.test(linking));
c('keterbatasannya ditulis di kodenya, bukan disembunyikan',
  /BUKAN MODE VOICE-NYA/.test(linking));

// ============================================================
console.log('\n=== 3. Ayat Memuji & Menyembah diundi tiap hari ===');
// ============================================================
const S = pasang(tsc(baca('lib/spiritual.ts')), (m) => {
  if (m === 'firebase/firestore') return new Proxy({}, { get: () => () => ({}) });
  if (m === './firebase') return { db: {} };
  if (m === './liveDoc') return { liveDoc: () => () => {}, liveList: () => () => {} };
  if (m === './linking') return { openExternalUrl: async () => {} };
  if (m === './bible')
    return { isLastChapter: () => false, nextChapterRef: () => null, splitBibleRefs: () => [], usfmRef: () => null };
  if (m === './core') return { hashString: (s) => [...s].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) | 0, 7), pickOfDay: () => '' };
  if (m === './daypart') return { DAYPART: { morning: '🌅', daytime: '🌤️', night: '🌙' } };
  if (m === './format') return { dayIdToDate: (id) => new Date(id) };
  if (m === './health') return { dayDocId: () => '', yesterdayId: () => '' };
  if (m === './streak') return { alreadyCounted: () => false, EMPTY_DAY_STREAK: {}, nextStreak: () => ({}) };
  if (m === './reward') return {};
  return {};
});

c('daftar bacaannya ada & cukup banyak',
  Array.isArray(S.WORSHIP_PASSAGES) && S.WORSHIP_PASSAGES.length >= 10,
  String(S.WORSHIP_PASSAGES?.length));
c('tiap butir punya teks & acuannya',
  S.WORSHIP_PASSAGES.every((p) => p.text.trim().length > 20 && /\d/.test(p.ref)));
// Semuanya HARUS soal memuji & menyembah — itu nama langkahnya.
c('semuanya soal memuji / menyembah / bersyukur',
  S.WORSHIP_PASSAGES.every((p) =>
    /puji|muji|menyembah|penyembah|bersorak|nyanyi|syukur|mengagungkan|persembahan/i.test(
      `${p.text} ${p.ref}`,
    ),
  ));
c('Mazmur 95:1–2 yang dulu tetap ada di daftarnya',
  S.WORSHIP_PASSAGES.some((p) => p.ref === 'Mazmur 95:1–2'));
{
  // Benar-benar berganti sepanjang tahun, dan tetap sama sepanjang satu hari.
  const setahun = new Set();
  for (let i = 0; i < 365; i++) {
    const d = new Date(2026, 0, 1 + i);
    const id = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    setahun.add(S.worshipPassageOfDay(id).ref);
    c.hariIni = id;
  }
  c('berganti-ganti dalam setahun, bukan itu-itu saja',
    setahun.size === S.WORSHIP_PASSAGES.length,
    `${setahun.size} dari ${S.WORSHIP_PASSAGES.length}`);
  const a = S.worshipPassageOfDay('2026-09-06');
  const b = S.worshipPassageOfDay('2026-09-06');
  c('sama sepanjang hari itu (bukan acak tiap render)', a.ref === b.ref);
  c('hari berbeda boleh berbeda',
    S.worshipPassageOfDay('2026-09-07').ref !== undefined);
}
// 21 Sep 2026: gerbangnya jadi Morning Journey; bacaannya dipakai langkah 🎵 Worship.
const gate = baca('components/spiritual/MorningJourney.tsx');
const steps = baca('components/spiritual/journey/JourneySteps.tsx');
c('Morning Journey memakainya', /worshipPassageOfDay\(todayId\)/.test(gate));
c('ayat yang ditulis mati sudah tidak ada', !/MAZMUR_95/.test(gate + steps));
// Dibekukan sekali seumur layar: kalau tidak, bacaannya bisa bertukar
// persis tengah malam, di tengah kamu berdoa.
c('tidak bertukar di tengah doa', /const \[passage\] = useState\(\(\) => worshipPassageOfDay/.test(gate));
c('acuannya ikut bacaannya', /- \{passage\.ref\}/.test(steps));

// ============================================================
console.log('\n=== 4. Ring score bisa diklik ===');
// ============================================================
const ht = baca('components/habits/HabitsTab.tsx');
c('ringnya jadi tombol',
  /<PressableScale\s*\n\s*style=\{styles\.heroCard\}\s*\n\s*onPress=\{\(\) => setCoreOpen\(true\)\}/.test(ht));
c('isinya kebiasaan WAJIB saja, bukan semuanya',
  /const wajib = grouped\[s\.key\]\.filter\(isCoreHabit\);/.test(ht));
c('dikelompokkan per sesi Pagi · Siang · Malam',
  /HABIT_SLOTS\.map\(\(s\) => \{/.test(ht) && /\{s\.emoji\} \{s\.label\} · \{beres\}\/\{wajib\.length\}/.test(ht));
c('yang ✗ tidak dihitung sudah',
  /day\.done\[h\.id\] && !day\.skipped\[h\.id\]/.test(ht));
// BACA saja — mencentangnya tetap di daftarnya, biar tak ada dua tempat
// mencentang satu kebiasaan yang sama.
c('lingkarannya terkunci (baca saja)', /checked=\{beresIni\}\s*\n\s*skipped=\{dilewati\}\s*\n\s*locked/.test(ht));
c('sesi yang tak punya baris wajib tidak dijudulkan kosong',
  /if \(wajib\.length === 0\) return null;/.test(ht));

// ============================================================
console.log('\n=== 5. Catatan khotbah & tombol ⏸️ ===');
// ============================================================
const sermon = baca('components/spiritual/SermonTab.tsx');
c('isi catatan tidak lagi mengintip di daftar', !/📝 \{s\.note\}/.test(sermon));
c('aplikasinya juga tidak', !/Aplikasi - \{s\.reflection\}/.test(sermon));
c('kutipannya TETAP ada (itu yang bikin kartunya berarti)',
  /<QuoteBox text=\{s\.quote\} lines=\{3\} \/>/.test(sermon));
c('gaya cuplikan yang jadi nganggur ikut dibuang', !/snippet/.test(sermon));
c('isinya tetap terbaca sekali klik', /onPress=\{\(\) => buka\(s\.id\)\}/.test(sermon));
// ⏸️ Pause & Pray sekarang HANYA di Bible Reading.
c('⏸️ cuma muncul di sub-tab Bible Reading',
  /\) : tab === 'bible' \? \(\s*\n\s*<>/.test(spiritual) &&
    (spiritual.match(/emoji="⏸️"/g) || []).length === 1);
c('sub-tab lain pojoknya kosong', /\) : undefined/.test(spiritual));
c('halaman Pause & Pray sendiri tidak ikut dihapus',
  fs.existsSync(R + 'app/pause-pray.tsx'));

// ============================================================
console.log('\n=== 6. Puasa yang belum mulai ===');
// ============================================================
const puasa = baca('app/fasting.tsx');
c('ada keadaan "belum mulai"',
  /const belumMulai = !!plan && todayId < plan\.startId;/.test(puasa) &&
    /label: '🗓️ Belum mulai'/.test(puasa));
c('tidak lagi jatuh ke "✅ Selesai"',
  puasa.indexOf(`'🗓️ Belum mulai'`) < puasa.indexOf(`'✅ Selesai'`));
c('"Selesai" cuma untuk yang tanggalnya SUDAH lewat',
  /: plan && todayId <= plan\.endId\s*\n\s*\? \{ label: '🔥 Berjalan'/.test(puasa));
c('labelnya menghitung mundur, bukan bilang "berhasil"',
  /belumMulai\s*\n?\s*\? `🗓️ Mulai \$\{menujuMulai\} hari lagi`/.test(puasa));
c('hitung mundurnya minimal 1 hari (bukan "0 hari lagi")',
  /Math\.max\(\s*\n?\s*1,/.test(puasa));
c('pilnya punya gayanya sendiri', /pillSoon: \{/.test(puasa));
c('keadaan terkunci tetap menang di atas semuanya',
  puasa.indexOf(`'🔒 Terkunci'`) < puasa.indexOf(`'🗓️ Belum mulai'`));

// ============================================================
console.log('\n=== 7. Lencana angkat beban keluar dari Fitness ===');
// ============================================================
const ach = baca('lib/reward.ts');
c('kategori barunya ada', /key: 'strength', icon: '🏋️'/.test(ach));
c('namanya sejalan dengan Weekly Steps', /label: 'Weekly Strength'/.test(ach));
c('angkanya dari rekap MINGGUAN, sama seperti Weekly Steps',
  /key: 'strength'[\s\S]{0,200}now: \(s\) => s\.weekGymHits/.test(ach));
for (const id of ['weekGym1', 'weekGym4', 'weekGym12']) {
  c(`${id} pindah ke kolom strength`,
    new RegExp(`id: '${id}', category: 'strength'`).test(ach));
}
c('tak ada lagi lencana mingguan di kolom Fitness',
  !/category: 'fitness'[\s\S]{0,200}weekGymHits/.test(ach));
c('kolom Fitness sekarang murni soal sesi latihannya',
  /label: 'Fitness', desc: 'Sesi latihan yang kamu centang di fitur Fitness'/.test(ach));
c('kategorinya terdaftar di tipe (URL-nya ikut disaring)',
  /\| 'strength'/.test(ach));
{
  const A = pasang(tsc(ach), (m) => {
    if (m === './homeGrid') return { homeFeatureIndex: () => 0 };
    if (m === 'firebase/firestore') return new Proxy({}, { get: () => () => ({}) });
    if (m === './firebase') return { db: {} };
    if (m === './liveDoc') return { liveDoc: () => () => {} };
    if (m === './daypart') return { DAYPART: { morning: '🌅', daytime: '🌤️', night: '🌙' } };
    if (m === './format') return { dayIdToDate: (id) => new Date(id) };
    return {};
  });
  c('halaman kategorinya bisa dituju', A.rewardCategoryOf('strength') === 'strength');
  c('ketiga lencananya memang ada di sana',
    A.REWARDS.filter((x) => x.category === 'strength').length === 3);
  c('TIDAK ADA lencana yang hilang dalam perpindahan',
    A.REWARDS.filter((x) => x.category === 'fitness').length ===
      A.REWARDS.filter((x) => x.category === 'fitness').length &&
      A.REWARDS.some((x) => x.id === 'weekGym12'));
}

// ============================================================
console.log('\n=== 8. Kartu Refleksi → dasar daftar Habits ===');
// ============================================================
c('tujuannya tetap Habits dengan ?focus=rhema (kini blok Refleksi di Today, 22 Sep 2026)',
  /pathname: '\/habits', params: \{ focus: 'rhema' \}/.test(BACA_TODAY('components/today/ReflectionBlock.tsx')));
c('mendarat di DASAR daftarnya, bukan di barisnya',
  /if \(focus === 'rhema' && focusId\) \{[\s\S]{0,200}scrollToEnd\(\{ animated: true \}\)/.test(ht));
c('sekali lompat saja — sesudah itu posisinya milikmu',
  /if \(focus === 'rhema' && focusId\) \{[\s\S]{0,120}bukaanJumped\.current = true;/.test(ht));
c('tujuan lain (Baca Alkitab, Fitness) tetap ke barisnya',
  /const targetId = focusId \?\? firstPendingId;/.test(ht));

console.log('\n' + (ok ? 'LULUS' : 'GAGAL'));
process.exit(ok ? 0 : 1);
