// Sebelas permintaan 28 Sep 2026 — dibuktikan satu per satu.
//
//  1. Template minta masukan ke CL + harinya + modal follow up dirapikan
//  2. Pengingat puasa tiap Senin terakhir bulan + perjalanan 3 langkah
//  3. Template Happy Birthday untuk siapa saja, nadanya disegarkan
//  4. Kalimat identitas di puncak layar Today
//  5. Buka sub-tab tidak lagi menggeser puncak daftarnya
//  6. Proyek freelance bisa ⏸️ ditahan client (tanpa tenggat, tanpa tagihan)
//  7. Pil 🔥 tidak lagi sewarna pita headernya
//  8. Baris khotbah di Today langsung membuka catatannya
//  9. Badge tab Work = jumlah rincian yang kelihatan di layar Work
// 10. Kartu pembuka Prayer Points dibuang; tombol 💬 WhatsApp ditambahkan
// 11. Sub-tab God's Story di Walk
//
// Yang dijalankan SUNGGUHAN: lib/fasting.ts (Senin terakhir), lib/identity.ts,
// lib/career.ts (badge & ditahan client), lib/chatTemplates.ts, dan
// lib/gospelStory.ts. Sisanya bentuk kode.
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const Module = require('module');

const ROOT = AKAR;
const OUT = path.join(__dirname, 'keluar-sebelas-28sep');
const baca = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
/** Sumber tanpa komentar — penjelasan "dulu begini" tak boleh ikut terbaca. */
const tanpaKomentar = (s) =>
  s.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

let gagal = 0;
function ok(nama, syarat, info = '') {
  if (syarat) console.log(`  ✅ ${nama}`);
  else { gagal++; console.log(`  ❌ ${nama}${info ? ` — ${info}` : ''}`); }
}

// ================== Kompilasi modul yang diuji sungguhan ==================
fs.rmSync(OUT, { recursive: true, force: true });
try {
  execFileSync(
    'npx',
    ['tsc',
      path.join(ROOT, 'lib/fasting.ts'),
      path.join(ROOT, 'lib/identity.ts'),
      path.join(ROOT, 'lib/career.ts'),
      path.join(ROOT, 'lib/chatTemplates.ts'),
      path.join(ROOT, 'lib/gospelStory.ts'),
      path.join(ROOT, 'lib/fastingWhy.ts'),
      '--ignoreConfig',
      '--outDir', OUT, '--module', 'commonjs', '--target', 'es2020',
      '--skipLibCheck', '--esModuleInterop', '--moduleResolution', 'bundler'],
    { cwd: ROOT, stdio: 'pipe', shell: true },
  );
} catch { /* keluhan tipe tak menghalangi tsc membuat JS-nya */ }

const asli = Module._load;
Module._load = function (req, parent, isMain) {
  if (req === '@/assets/style/color') return { Color: new Proxy({}, { get: () => '#000000' }) };
  if (req === './firebase') return { db: {} };
  if (req === './liveDoc') return { liveDoc: () => () => {}, liveList: () => () => {} };
  if (req.startsWith('firebase/')) return new Proxy({}, { get: () => () => ({}) });
  if (/^(expo-|react-native|@expo|react$|@react-native)/.test(req)) return new Proxy({}, { get: () => () => ({}) });
  return asli(req, parent, isMain);
};
const F = require(path.join(OUT, 'fasting.js'));
const ID = require(path.join(OUT, 'identity.js'));
const C = require(path.join(OUT, 'career.js'));
const CT = require(path.join(OUT, 'chatTemplates.js'));
const GS = require(path.join(OUT, 'gospelStory.js'));
const FW = require(path.join(OUT, 'fastingWhy.js'));
Module._load = asli;

const fu = baca('components/core/FollowupTab.tsx');

// ===================================================================
console.log('\n=== 1. Minta masukan ke CORE Leader ===');
{
  const kat = CT.CHAT_CATEGORIES.find((c) => c.key === 'feedback');
  ok('kategori 🪞 Minta Masukan ada, dengan beberapa pilihan',
    !!kat && kat.variants.length >= 3);
  // Arahnya MASUK, bukan keluar: semua kategori lain kamu yang menguatkan
  // orang lain; yang ini kamu yang minta dikoreksi.
  ok('kalimatnya benar-benar meminta koreksi, bukan basa-basi',
    !!kat && kat.variants.every((v) => /masukan|perbaiki|kurang|ubah|salah/i.test(v.text)));
  ok('membuka pintu selebar-lebarnya (biar tidak dijawab "aman kok")',
    !!kat && kat.variants.some((v) => /jujur|gak bakal baper|beneran mau denger/i.test(v.text)));
  ok('memakai penanda <nama>, jadi terisi sendiri dari CL yang dituju',
    !!kat && kat.fields.includes('nama') && kat.variants.every((v) => v.text.includes('<nama>')));
  // Harinya SABTU, dan alasannya ditulis di kodenya (bukan dipilih asal).
  ok('harinya Sabtu (6), dan ada fungsinya sendiri',
    CT.FEEDBACK_DAY === 6 &&
    CT.isFeedbackDay(new Date(2026, 8, 26)) === true &&
    CT.isFeedbackDay(new Date(2026, 8, 25)) === false);
  ok('alasan pemilihan harinya tertulis di kode, bukan angka telanjang',
    /Kenapa Sabtu, dan bukan hari lain/.test(baca('lib/chatTemplates.ts')));

  console.log('\n--- Modal follow up dirapikan ---');
  ok('dua tombol pendek menggantikan kalimat panjangnya',
    /🔥 Motivational Word/.test(fu) && /🪞 Minta Masukan/.test(fu) &&
    !/Sudah kirim Motivational Word/.test(fu));
  ok('label "💡 Ide Pendekatan" ikut dibuang (pil DISC/MBTI sudah menjelaskan)',
    !/Ide Pendekatan/.test(tanpaKomentar(fu)) && !/modalTipsLabel/.test(fu));
  ok('keduanya membawa nama CL DAN kategorinya, jadi tak perlu dicari lagi',
    /params: \{ leader: leaderId, cat \}/.test(fu) &&
    /CHAT_CATEGORIES\.find\(\(c\) => c\.key === catParam\)/.test(baca('app/chat-templates.tsx')));
  ok('hari Sabtu tombol Minta Masukan menyala sendiri',
    /const hariMasukan = isFeedbackDay\(new Date\(\)\);/.test(fu) &&
    /hariMasukan && styles\.pintuButtonOn/.test(fu));
}

// ===================================================================
console.log('\n=== 2. Puasa: Senin terakhir tiap bulan + perjalanan ===');
{
  // Tanggal yang disebut pemilik app sendiri: 28 Sep, 26 Okt, 30 Nov 2026.
  ok('Senin terakhir dihitung benar (28 Sep · 26 Okt · 30 Nov 2026)',
    F.lastMondayId(new Date(2026, 8, 15)) === '2026-09-28' &&
    F.lastMondayId(new Date(2026, 9, 1)) === '2026-10-26' &&
    F.lastMondayId(new Date(2026, 10, 30)) === '2026-11-30',
    [F.lastMondayId(new Date(2026, 8, 15)), F.lastMondayId(new Date(2026, 9, 1)), F.lastMondayId(new Date(2026, 10, 30))].join(' '));
  ok('bulan yang berakhir TEPAT hari Senin tetap benar (30 Nov 2026 itu Senin)',
    new Date(2026, 10, 30).getDay() === 1);
  // Jendelanya dua hari, dan itu bukan kemewahan: isi pengingat dibekukan saat
  // app terakhir dibuka, jadi jendela satu hari bisa lewat tanpa bunyi.
  ok('ditagih pada Senin terakhirnya DAN Minggu sebelumnya',
    F.fastingMonthlyDue([], new Date(2026, 8, 28)) === true &&
    F.fastingMonthlyDue([], new Date(2026, 8, 27)) === true);
  ok('hari lain diam',
    F.fastingMonthlyDue([], new Date(2026, 8, 26)) === false &&
    F.fastingMonthlyDue([], new Date(2026, 8, 29)) === false);
  ok('sudah ada puasa yang mulai bulan ini → diam, tidak menagih lagi',
    F.fastingMonthlyDue(
      [{ id: 'a', startId: '2026-09-10', endId: '2026-09-16' }],
      new Date(2026, 8, 28),
    ) === false);
  ok('puasa bulan LAIN tidak ikut mendiamkan bulan ini',
    F.fastingMonthlyDue(
      [{ id: 'a', startId: '2026-08-10', endId: '2026-08-16' }],
      new Date(2026, 8, 28),
    ) === true);
  ok('keterangannya membedakan "hari ini" & "besok"',
    F.fastingMonthlyLabel(new Date(2026, 8, 28)) === 'Hari ini Senin terakhir bulan ini' &&
    F.fastingMonthlyLabel(new Date(2026, 8, 27)) === 'Besok Senin terakhir bulan ini');
  // ⚠️ Yang TIDAK boleh terjadi: puasanya dibuatkan sendiri oleh app.
  ok('app TIDAK membuatkan puasanya otomatis (cuma mengingatkan)',
    !/saveFastingPlan/.test(baca('lib/notify.ts')) &&
    !/saveFastingPlan/.test(baca('lib/today.ts')));
  ok('masuk daftar Today sebagai baris 🙏 With God, bukan daftar Life',
    /id: 'fasting-monthly',\s*\n\s*section: 'god',/.test(baca('lib/today.ts')));
  ok('punya kelompok pengingatnya sendiri, jam 09.00',
    /\{ key: 'fasting', emoji: '🗓️', label: 'Puasa bulanan'/.test(baca('lib/notify.ts')) &&
    /id: 'fasting-monthly',\s*\n\s*group: 'fasting',\s*\n\s*hour: 9,/.test(baca('lib/notify.ts')));

  console.log('\n--- Perjalanan 3 langkah sebelum formulirnya ---');
  const intro = baca('components/spiritual/FastingIntro.tsx');
  ok('puasa BARU lewat perjalanan dulu; puasa lama langsung ke formulirnya',
    /const introTampil = !planId && !introSelesai;/.test(baca('app/fasting.tsx')) &&
    /\{introTampil \? \(/.test(baca('app/fasting.tsx')));
  ok('tiga langkah, dan nomornya terlihat',
    /Langkah \{langkah \+ 1\} dari 3/.test(intro));
  // Inti pencegah rutinitasnya: tidak ada tombol lewati, dan tombol lanjut
  // baru hidup sesudah ada yang benar-benar dipilih.
  ok('tidak ada tombol lewati sama sekali',
    !/lewati|Lewati|skip|Skip/.test(tanpaKomentar(intro)));
  ok('tombol lanjut mati sampai fokus & pantangannya dipilih',
    /langkah === 1 \? focus !== null : rule !== null/.test(intro) &&
    /disabled=\{!bisaLanjut\}/.test(intro) &&
    /disabled\?: boolean;/.test(baca('components/common/PrimaryButton.tsx')));
  ok('langkah 1 memang menjelaskan puasa itu BUKAN apa',
    /Tuhan tidak bisa dibayar/.test(baca('lib/fastingWhy.ts')));
  ok('fokusnya satu saja, dari enam pilihan yang tajam',
    FW.FASTING_FOCUSES.length === 6 &&
    FW.FASTING_FOCUSES.every((f) => f.prayer.length > 40 && f.ask.endsWith('?')));
  ok('pantangannya sesuatu yang TERASA (makan, sosmed, hiburan)',
    FW.FASTING_RULES.length >= 3 &&
    FW.FASTING_RULES.every((r) => r.text.length > 20));
  ok('jawabannya mengisi formulirnya, jadi tak ada pekerjaan terbuang',
    /setPrayer\(focus\.prayer\);/.test(baca('app/fasting.tsx')) &&
    /setRules\(rule\.text\);/.test(baca('app/fasting.tsx')) &&
    FW.fastingTitleOf(FW.FASTING_FOCUSES[0], 'Sep 2026') === 'Hidup kudus - Sep 2026');
}

// ===================================================================
console.log('\n=== 3. Happy Birthday untuk siapa saja ===');
{
  const kat = CT.CHAT_CATEGORIES.find((c) => c.key === 'ulangtahun');
  ok('kategori 🎂 ada, beberapa pilihan', !!kat && kat.variants.length >= 3);
  ok('untuk SIAPA SAJA, bukan cuma CL/Main Team',
    !!kat && /bukan cuma CL atau Main Team/.test(kat.hint));
  // Nadanya harus jelas berbeda dari ucapan di kartu Follow Up: tidak ada doa
  // panjang, tidak ada bahasa pelayanan.
  ok('nadanya santai, bukan sambutan (tanpa doa panjang 4 baris)',
    !!kat && kat.variants.every((v) => !/Kiranya|dewasa rohani/.test(v.text)));
  ok('terdengar anak muda (hbd/wkwk/thankyou/gbu dan sejenisnya)',
    !!kat && kat.variants.some((v) => /hbd|wkwk|thankyou|gbu|yaa/i.test(v.text)));
  ok('tetap memakai penanda <nama>',
    !!kat && kat.variants.every((v) => v.text.includes('<nama>')));
  // Kartu ulang tahun CL di Follow Up TIDAK diganti kategori ini — keduanya
  // punya pembaca yang berbeda.
  ok('kartu ulang tahun CL/MT tetap punya ucapannya sendiri',
    /birthdayGroupText/.test(fu) && /birthdayPersonalText/.test(fu));
  ok('ucapan CL/MT ikut disegarkan, doanya tetap utuh',
    /HAPPY BIRTHDAY \$\{name\}!!/.test(baca('lib/core.ts')) &&
    /Kiranya semua yang kamu kerjakan berkenan/.test(baca('lib/core.ts')));
}

// ===================================================================
console.log('\n=== 4. Kalimat identitas di puncak Today ===');
{
  const hariIni = '2026-09-28';
  const baris = ID.identityLine({ leaders: 10, streak: 5 }, hariIni);
  ok('kalimatnya berbentuk "Kamu …", tanpa kata harus/coba/semoga',
    baris.startsWith('Kamu ') && !/harus|coba|semoga/i.test(baris), baris);
  // Berganti tiap hari TAPI tidak acak: membuka app sepuluh kali dalam sehari
  // harus memberi kalimat yang sama.
  ok('tetap sama sepanjang hari (bukan acak tiap render)',
    ID.identityLine({ leaders: 10, streak: 5 }, hariIni) === baris);
  ok('berganti saat harinya berganti',
    ID.identityLine({ leaders: 10, streak: 5 }, '2026-09-29') !== baris);
  // Yang angkanya 0 tidak boleh ikut: "Kamu Gembala 0 CORE" itu ejekan.
  const semua = (n) => {
    const out = new Set();
    for (let i = 0; i < 40; i++) {
      const d = new Date(2026, 0, 1 + i);
      const id = `2026-01-${String(d.getDate()).padStart(2, '0')}`;
      out.add(ID.identityLine({ leaders: n, streak: 0 }, id));
    }
    return [...out];
  };
  ok('jumlah CL ikut disebut kalau memang ada',
    semua(10).some((t) => t === 'Kamu Gembala 10 CORE'));
  ok('tanpa CL → tidak pernah menulis "Gembala 0 CORE"',
    semua(0).every((t) => !/Gembala 0 CORE/.test(t)));
  ok('identitas rohani tetap jadi intinya (bukan cuma peran)',
    semua(0).includes('Kamu Anak Tuhan Yesus') &&
    semua(0).includes('Kamu True Follower, bukan penonton'));
  ok('dipakai layar Today sesudah Morning Journey dijalani',
    /god\.state === 'done'\s*\n\s*\? god\.identity/.test(baca('components/today/GodHero.tsx')) &&
    /identity: identityLine\(/.test(baca('lib/today.ts')));
  ok('sebelum journey dijalani tetap sapaan (di situ yang perlu undangan)',
    /Selamat pagi, \$\{name\}/.test(baca('components/today/GodHero.tsx')));
}

// ===================================================================
console.log('\n=== 5. Buka sub-tab tidak menggeser puncak daftarnya ===');
{
  const hook = baca('hooks/useDueJump.ts');
  // Lompatannya cuma jalan kalau barisnya memang DI LUAR layar. Bukti
  // jalannya (React tiruan) ada di cek-lompat.js; di sini bentuknya.
  ok('tinggi jendela ScrollView ikut diukur',
    /const onLayout = useCallback\(/.test(hook) &&
    /viewH\.current = e\.nativeEvent\.layout\.height;/.test(hook));
  ok('baris yang sudah kelihatan tidak dilompati',
    /if \(y \+ CUKUP_TERLIHAT <= viewH\.current\) return;/.test(hook));
  ok('jendela yang belum terukur → diam, bukan menebak',
    /if \(viewH\.current === 0\) return;/.test(hook));
  // Semua pemakainya harus memasang onLayout, kalau tidak hook-nya diam total
  // di layar itu — dan diamnya tidak menimbulkan galat apa pun.
  const pemakai = ['components/career/FreelanceTab.tsx', 'components/career/FulltimeTab.tsx',
    'components/common/UpkeepList.tsx', 'components/core/FollowupTab.tsx',
    'components/device/PlanTab.tsx', 'components/fitness/ExerciseTab.tsx',
    'components/friends/SplitBillTab.tsx', 'components/learning/WeekTab.tsx',
    'components/tasks/PriorityTab.tsx', 'app/debts.tsx'];
  const lupa = pemakai.filter((f) => !/onLayout=\{onLayout\}/.test(baca(f)));
  ok(`${pemakai.length} pemakainya memasang onLayout`, lupa.length === 0, lupa.join(', '));
}

// ===================================================================
console.log('\n=== 6. Freelance ⏸️ ditahan client ===');
{
  const ts = (y, m, d) => ({ toDate: () => new Date(y, m - 1, d), toMillis: () => new Date(y, m - 1, d).getTime() });
  const jalan = { id: 'a', name: 'A', client: 'X', requirement: '', fee: 0, done: false, deadline: ts(2026, 9, 29) };
  const ditahan = { ...jalan, id: 'b', onHold: true };
  const now = new Date(2026, 8, 28);
  ok('yang jalan & sudah H-7 tetap menagih', C.freelanceReminderWindow(jalan, now) === true);
  ok('yang DITAHAN tidak pernah menagih, walau tenggatnya besok',
    C.freelanceReminderWindow(ditahan, now) === false);
  ok('proyek lama tanpa kolomnya dianggap jalan (bukan ditahan)',
    C.freelanceOnHold(jalan) === false && C.freelanceOnHold(ditahan) === true);
  // Tanggalnya sengaja TETAP disimpan: begitu penahanannya dilepas, tenggat
  // yang dulu disepakati kembali tanpa perlu diketik ulang.
  ok('tanggalnya tetap tersimpan, cuma berhenti berlaku',
    /disabled=\{busy \|\| fHold\}/.test(baca('app/project/edit/[id].tsx')) &&
    /onHold: fHold,/.test(baca('app/project/edit/[id].tsx')));
  ok('kartunya bilang terus terang, dan warnanya netral (bukan merah/kuning)',
    /⏸️ Ditahan client/.test(baca('components/career/FreelanceTab.tsx')) &&
    /p\.done \|\| ditahan \? 'unknown' : deadlineTone\(days\)/.test(baca('components/career/FreelanceTab.tsx')));
  ok('tidak ikut jadi "yang harus dikirim hari ini" di sub-tab Focus',
    /!p\.done && !freelanceOnHold\(p\)/.test(baca('components/career/WorkFocusTab.tsx')));
}

// ===================================================================
console.log('\n=== 7. Pil 🔥 tidak sewarna pita headernya ===');
{
  const pil = baca('components/common/StreakPill.tsx');
  // Habits itu kasus terburuknya: warna fiturnya PERSIS Color.ACCENT, yaitu
  // warna bawaan pil ini — jadi tombolnya benar-benar menghilang.
  ok('di atas pita, pil memakai warna PALING GELAP fiturnya',
    /onBand && \{ backgroundColor: theme\.deep \}/.test(pil) &&
    /textOnBand: \{ color: Color\.TEXT_REVERSE \}/.test(pil));
  ok('warnanya tetap ikut fitur, bukan satu warna untuk semua layar',
    /const theme = useFeatureTheme\(\);/.test(pil));
  ok('dipakai kedua pil yang memang berdiri di pita (Habits & Night Prayer)',
    /onBand\s*\/>/.test(baca('app/habits.tsx')) && /onBand \/>/.test(baca('app/night-prayer.tsx')));
  ok('pil di latar krem (baris sapaan) TIDAK ikut berubah',
    !/onBand/.test(baca('components/common/Greeting.tsx')));
}

// ===================================================================
console.log('\n=== 8. Baris khotbah langsung membuka catatannya ===');
{
  const t = baca('lib/today.ts');
  ok('"Renungkan khotbah" menuju catatannya, bukan daftar khotbah',
    /id: 'sermon-reflect',[\s\S]{0,600}?href: \{ pathname: '\/sermon', params: \{ id: sermonRenung\.id \} \}/.test(t));
  ok('bentuknya sama dengan baris "Kirim catatan khotbah" di bawahnya',
    /id: 'sermon-share',[\s\S]{0,600}?href: \{ pathname: '\/sermon', params: \{ id: sermonKirim\.id \} \}/.test(t));
  ok('layar /sermon memang menerima ?id=',
    /useLocalSearchParams<\{ id\?: string \}>/.test(baca('app/sermon.tsx')));
}

// ===================================================================
console.log('\n=== 9. Badge Work: atas & bawah dari satu hitungan ===');
{
  const ts = (y, m, d) => ({ toDate: () => new Date(y, m - 1, d), toMillis: () => new Date(y, m - 1, d).getTime() });
  const now = new Date(2026, 8, 28);
  const hariIni = '2026-09-28';
  const a = C.workAttention({
    roadmap: [{ id: 'r', title: 'R', note: '', priority: 1, status: 'progress', deadline: ts(2026, 9, 29) }],
    freelance: [{ id: 'f', name: 'F', client: 'C', requirement: '', fee: 0, done: false, deadline: ts(2026, 9, 29) }],
    ideas: [{ stage: 'idea' }, { stage: 'posted' }],
    tasks: [
      { done: false, dayId: hariIni, category: 'work' },
      { done: true, dayId: hariIni, category: 'work' },
      { done: false, dayId: hariIni, category: 'life' },
    ],
    now,
    todayId: hariIni,
  });
  // Inilah aturannya, dan inilah yang dulu tidak berlaku: angka di kaki app =
  // jumlah angka yang kelihatan rinciannya di layar Work.
  ok('total = jumlah keempat pecahannya, tanpa kecuali',
    a.total === a.fulltime + a.freelance + a.affiliate + a.tasks && a.total === 4,
    JSON.stringify(a));
  ok('tiap pecahannya benar sendiri-sendiri',
    a.fulltime === 1 && a.freelance === 1 && a.affiliate === 1 && a.tasks === 1);
  ok('task kategori lain & yang sudah selesai tidak ikut terhitung', a.tasks === 1);
  ok('kaki app memakai fungsi yang SAMA, bukan hitungan sendiri',
    /workAttention\(\{ roadmap, freelance, ideas, tasks, now, todayId \}\)\.total/.test(
      baca('app/(tabs)/_layout.tsx')) &&
    !/roadmap\.filter\(\(r\) => r\.status !== 'done'/.test(baca('app/(tabs)/_layout.tsx')));
  ok('layar Work memakai fungsi yang sama untuk badge sub-tabnya',
    /const perhatian = workAttention\(\{/.test(baca('app/(tabs)/work.tsx')) &&
    /fulltime: perhatian\.fulltime,/.test(baca('app/(tabs)/work.tsx')) &&
    /affiliate: perhatian\.affiliate,/.test(baca('app/(tabs)/work.tsx')));
  // Task WORK hari ini tidak punya sub-tab, jadi tanpa badge di tombol 🔔
  // angka kaki app tetap tidak bisa dijumlah dari yang kelihatan.
  ok('task hari ini kelihatan rinciannya di badge tombol 🔔',
    /badge=\{perhatian\.tasks\}/.test(baca('app/(tabs)/work.tsx')));
  // CORE sudah konsisten sejak awal — dijaga supaya tetap begitu.
  ok('CORE tetap konsisten: total = visitation + followup',
    /return \{ visitation, followup, total: visitation \+ followup \};/.test(baca('lib/core.ts')) &&
    /visitation: perhatian\.visitation,/.test(baca('app/(tabs)/core.tsx')));
}

// ===================================================================
console.log('\n=== 10. Prayer Points: kartu pembuka dibuang, 💬 ditambah ===');
{
  const pp = baca('components/core/PrayerPointsTab.tsx');
  const kode = tanpaKomentar(pp);
  ok('kartu pembuka (pertanyaan + "n dari m sudah terisi") benar-benar dibuang',
    !/introCard/.test(kode) && !/SummaryCard/.test(kode) &&
    !/dari \{leaders\.length\} CORE Leader sudah terisi/.test(kode));
  ok('tombol 💬 ada di sebelah tombol tambah pokok doa',
    /styles\.waButton/.test(pp) && /openWhatsAppChat\(l\.phone, MONTHLY_PRAYER_ASK/.test(pp));
  // Kalimatnya persis yang diminta pemilik app.
  ok('kalimatnya sudah terisi, tinggal kirim',
    /^Shalom, ada yang bisa aku doakan buat kamu di bulan baru ini\? Boleh juga pokok doa spesifik yes 🙏$/.test(
      (baca('lib/core.ts').match(/export const MONTHLY_PRAYER_ASK =\s*\n?\s*'([^']+)'/) ?? [])[1] ?? ''));
  ok('CL tanpa nomor: tombolnya tetap di tempatnya, cuma diredupkan & mati',
    /!l\.phone && styles\.waButtonOff/.test(pp) && /disabled=\{!l\.phone\}/.test(pp));
  ok('gagal membuka WhatsApp dikatakan, tidak ditelan diam-diam',
    /setError\(WHATSAPP_ERROR\)/.test(pp));
}

// ===================================================================
console.log("\n=== 11. Sub-tab God's Story ===");
{
  ok('lima babak, urut Creation → Fall → Redemption → Renewal → Restoration',
    GS.GOSPEL_ACTS.map((a) => a.key).join(',') ===
      'creation,fall,redemption,renewal,restoration');
  // Inilah inti permintaannya: penanda "kamu di sini" di babak PENGUDUSAN.
  // 29 Sep 2026: `gospelHereAct()` dihapus bersama kartu pembukanya — timeline
  // menandainya langsung saat menggambar. Yang diuji tetap hal yang sama, cuma
  // dicari dari daftarnya sendiri; ditambah satu cek bahwa helper-nya memang
  // sudah tidak ada lagi, supaya ia tidak kembali sebagai ekspor tak terpakai.
  const babakIni = GS.GOSPEL_ACTS.find((a) => a.key === GS.GOSPEL_HERE);
  ok('babak berjalan = Renewal, tahapnya Sanctification / Pengudusan',
    GS.GOSPEL_HERE === 'renewal' &&
    babakIni.stage === 'Sanctification' &&
    babakIni.stageId === 'Pengudusan');
  ok('helper pencari babak berjalan sudah dibuang bersama kartu pembukanya',
    GS.gospelHereAct === undefined &&
    !/gospelHereAct/.test(tanpaKomentar(baca('lib/gospelStory.ts'))));
  ok('tiga tahap keselamatan terpasang di babak yang benar',
    GS.GOSPEL_ACTS.filter((a) => a.stage).map((a) => `${a.key}:${a.stage}`).join(' ') ===
      'redemption:Justification renewal:Sanctification restoration:Glorification');
  ok('pembenaran disebut SUDAH SELESAI, pemuliaan BELUM tiba',
    /Sudah SELESAI/.test(GS.GOSPEL_ACTS[2].now) && /Belum tiba/.test(GS.GOSPEL_ACTS[4].now));
  ok('babak berjalan mengatakan terus terang bahwa belum selesai itu wajar',
    /belum selesai/i.test(babakIni.now) &&
    /hidup kudus/i.test(babakIni.now));
  ok('tiap babak punya ayatnya, dan ayatnya bisa di-click ke YouVersion',
    GS.GOSPEL_ACTS.every((a) => a.verseRef && a.verseText) &&
    /openYouVersion\(buka\.verseRef\)/.test(baca('components/spiritual/GospelStoryTab.tsx')));
  ok('jadi sub-tab Walk, paling kanan',
    /\{ key: 'story', label: "God's Story"/.test(baca('app/(tabs)/walk.tsx')) &&
    /tab === 'story' \? \(\s*\n\s*<GospelStoryTab \/>/.test(baca('app/(tabs)/walk.tsx')));
  ok('isinya statis di kode — nol pembacaan Firestore',
    !/firebase|subscribe|doc\(/.test(baca('lib/gospelStory.ts')));
}

// ===================================================================
console.log('\n=== Aturan wajib ===');
{
  const baru = [
    'lib/identity.ts', 'lib/gospelStory.ts', 'lib/fastingWhy.ts',
    'components/spiritual/GospelStoryTab.tsx', 'components/spiritual/FastingIntro.tsx',
    'components/core/PrayerPointsTab.tsx', 'components/core/FollowupTab.tsx',
    'lib/chatTemplates.ts',
  ].map(baca).join('\n');
  const kode = tanpaKomentar(baru);
  ok('tidak ada hex mentah di layar (warnanya dari Color)',
    !/#[0-9A-Fa-f]{6}/.test(kode));
  ok('tanpa soft-delete diselundupkan', !/isDeleted|archived: true/.test(kode));
  ok('istilahnya "Click", tanpa tekan/ketuk/tap/klik',
    !/\b(tekan|ditekan|menekan|ketuk|diketuk|tap|klik)\b/i.test(kode));
  ok('tanpa em dash di teks yang terbaca', !kode.includes(String.fromCharCode(0x2014)));
  ok('tanpa modul native baru (cukup eas update)',
    !/expo-media-library/.test(kode) &&
    !/react-native-[a-z-]+/.test(
      kode.replace(/react-native-safe-area-context|react-native-reanimated|react-native-gesture-handler/g, ''),
    ));
  ok('tidak ada koleksi Firestore baru (fitur-fitur ini menumpang yang ada)',
    !/collection\(db, 'users', uid, '/.test(baca('lib/identity.ts') + baca('lib/gospelStory.ts') + baca('lib/fastingWhy.ts')));
}

console.log(gagal === 0
  ? '\n✅ LULUS — kesebelas permintaan 28 Sep terbukti.'
  : `\n❌ ${gagal} cek gagal.`);
process.exit(gagal === 0 ? 0 : 1);
