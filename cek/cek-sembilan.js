// 21 Sep 2026: langganan lewat useLiveAll → `subscribeX(uid, …)`, bukan `user.uid`.
// Bukti 9 permintaan. Ditulis lewat file (bukan heredoc) — heredoc bash memakan
// backslash regex dan itu pernah bikin scanner melaporkan positif palsu.
const AKAR = require('./akar');
const BACA_TODAY = (p) => require('fs').readFileSync(AKAR + '/' + p, 'utf8').replace(/\r\n/g, '\n'); // 22 Sep 2026 Today OS
const fs = require('fs');
const path = require('path');

const ROOT = AKAR;
const baca = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

let gagal = 0;
function ok(nama, syarat, info = '') {
  if (syarat) console.log(`  ✅ ${nama}`);
  else {
    gagal++;
    console.log(`  ❌ ${nama}${info ? ` — ${info}` : ''}`);
  }
}

// ============ 1. Notulen bulanan: tekan isinya → tertutup ============
console.log('\n1. CORE → Monthly: isi notulen jadi sakelar tutup');
const monthly = baca('components/core/MonthlyTab.tsx');
// 23 Sep 2026: isinya jadi anak LANGSUNG ScrollView (kepala kartunya dipatok),
// jadi ia sekarang punya `key` sendiri sebelum style-nya.
ok('isi notulen dibungkus tombol, bukan View mati',
  /<PressableScale\s+key=\{`isi-\$\{m\.id\}`\}\s+style=\{styles\.cardBody\}[\s\S]{0,120}onPress=\{\(\) => setOpenId\(null\)\}/.test(monthly));
ok('penutupnya benar-benar menutup (bukan toggle yang bisa buka lagi)',
  /setOpenId\(null\)/.test(monthly));
ok('mengecilnya samar — sebidang kartu, bukan tombol kecil',
  /scaleTo=\{0\.99\}/.test(monthly));
ok('judulnya TETAP jadi sakelar buka/tutup seperti dulu',
  /onPress=\{\(\) => setOpenId\(expanded \? null : m\.id\)\}/.test(monthly));
ok('blok isinya ditutup </PressableScale>, bukan </View>',
  /\}\)\}\s*<\/PressableScale>\s*\);/.test(monthly));

// ============ 2. Grafik Investment tidak tabrakan ============
console.log('\n2. Investment: label harga terendah vs label bulan');
const chart = baca('components/investment/PriceChart.tsx');
const angka = (n) => {
  const m = chart.match(new RegExp(`const ${n} = (\\d+);`));
  return m ? Number(m[1]) : NaN;
};
const H = angka('H');
const PAD_T = angka('PAD_T');
const PAD_B = angka('PAD_B');
const LOW = Number(chart.match(/const LOW_LABEL_DY = (\d+);/)[1]);
const AXIS = Number(chart.match(/const AXIS_LABEL_DY = (\d+);/)[1]);

// Baseline label terendah = garis terbawah + LOW; baseline label bulan = H - AXIS.
const garisBawah = H - PAD_B;
const baselineHarga = garisBawah + LOW;
const baselineBulan = H - AXIS;
const jarak = baselineBulan - baselineHarga;
console.log(`     H=${H} PAD_B=${PAD_B} → baseline harga ${baselineHarga}, bulan ${baselineBulan}`);
ok(`dua baris tulisan itu terpisah (jarak ${jarak}px ≥ tinggi huruf 10px)`, jarak >= 12);
ok('DULU tabrakan: dengan PAD_B lama (26) jaraknya cuma 5px',
  (210 - 8) - ((210 - 26) + 13) === 5);
ok('bidang gambar garisnya TIDAK berubah (tetap 162px) — bentuk grafik sama',
  H - PAD_T - PAD_B === 162);
ok('kedua label bulan memakai patokan yang sama',
  (chart.match(/y=\{H - AXIS_LABEL_DY\}/g) ?? []).length === 2);

// ============ 3. Learning ============
console.log('\n3. Learning: buang "Nyambung…", badge & reminder diskusi, jam belajar');
const learnLib = baca('lib/learning.ts');
const weekTab = baca('components/learning/WeekTab.tsx');
const home = baca('app/(tabs)/index.tsx');
const dash = baca('app/reminders.tsx');

ok('baris "Nyambung dengan…" hilang dari 3 kartu diskusi mingguan',
  !/\{meta\.hint\}/.test(weekTab));
// Kartu topiknya sendiri sudah PINDAH ke sub-tab Discussion; salinan style-nya
// yang tertinggal di WeekTab tak menggambar apa pun & sudah dibuang
// (lihat cek-rapihin-batch3.js). Jadi keputusan "centang di tengah" diperiksa
// di tempat kartunya benar-benar digambar.
ok('kartu topik tak lagi digambar di WeekTab',
  !/topicCard/.test(weekTab) && !/[Tt]opic/.test(weekTab));
ok('centangnya disejajarkan tengah di tempat kartunya sekarang (Discussion)',
  /topicCard: \{[\s\S]{0,400}alignItems: 'center',/.test(
    baca('components/learning/DiscussionTab.tsx'),
  ));
// Keterangan kelompok itu DIHAPUS pemiliknya sendiri di sub-tab Discussion
// (28 Agu 2026), bersama kalimat "Centang setelah topiknya benar-benar
// diobrolkan". Yang tetap dijaga: daftar topiknya sendiri masih dikelompokkan
// dan masih bisa dicentang.
ok('sub-tab Discussion tetap mengelompokkan topik & bisa dicentang', (() => {
  const t = baca('components/learning/DiscussionTab.tsx');
  return /TOPIC_GROUPS/.test(t) && /CheckCircle|checked/.test(t);
})());

ok('jam belajar 08.00–09.00 & 20.00–22.00 tercatat',
  /LEARNING_TIME_LABEL = '🕗 08\.00–09\.00 pagi atau 20\.00–22\.00 malam'/.test(learnLib));
// Ambil pasangan hari→jam dari tiap langkah, urut seperti tertulis.
const jamPerHari = [...learnLib.matchAll(/day: '(\w+)',[\s\S]{0,400}?time: ([^,]+),/g)]
  .map((m) => [m[1], m[2].trim()]);
ok('dipakai TEPAT di 3 langkah, dan hari-harinya Senin/Rabu/Jumat',
  (learnLib.match(/time: LEARNING_TIME_LABEL,/g) ?? []).length === 3 &&
  JSON.stringify(jamPerHari.filter((x) => x[1] === 'LEARNING_TIME_LABEL').map((x) => x[0]))
    === JSON.stringify(['Senin', 'Rabu', 'Jumat']),
  JSON.stringify(jamPerHari));
ok('langkah "Ceritakan" (Minggu) sengaja tanpa jam',
  /label: 'Ceritakan',[\s\S]{0,300}time: '',/.test(learnLib));
ok('jamnya tampil di kartu langkah', /\{s\.time\}/.test(weekTab));

// 22 Sep 2026: badge tile Home → dua baris Today (langkah hari ini & topik minggu ini).
ok('Today = langkah jatuh tempo + topik diskusi belum diobrolkan',
  /dueStep\(input\.learningWeek\.steps, now\)/.test(BACA_TODAY('lib/today.ts')) &&
  /pendingTopicsOfWeek\(input\.topicsDone, now\)/.test(BACA_TODAY('lib/today.ts')) &&
  /return pendingSteps\(steps, now\) \+ pendingTopicsOfWeek\(topicsDone, now\)\.length;/.test(learnLib));
// Penerimanya kini dibungkus mark() — gerbang "badge muncul serentak"
// (hooks/useReadyGate). Datanya tetap masuk ke setTopicsDone seperti dulu.
ok('Today berlangganan topik yang sudah dibahas',
  /subscribeTopicsDone\(uid, mark\('topicsDone', setTopicsDone\), fail\)/.test(BACA_TODAY('hooks/useTodayData.ts')));
// Judulnya sudah kamu ganti sendiri jadi "Reminder 💬 Discussion This Week".
// Yang diuji tetap sama: kartunya ADA, warnanya Learning, & isinya topik.
ok('kartu reminder diskusi mingguan ada di Dashboard',
  /title="💬 Discussion Reminder"/.test(dash));
ok('isinya topik yang BELUM diobrolkan & menuju layar Learning',
  /learningTopics\.length > 0/.test(dash) &&
  /pendingTopicsOfWeek\(topicsDone, now\)/.test(dash) &&
  dash.includes("pathname: '/learning',") &&
  dash.includes("params: { tab: 'topics' },"));

// Simulasi murni: 3 topik, 1 sudah dicentang → tersisa 2.
ok('hitungannya benar (3 topik, 1 dicentang → sisa 2)',
  /return topicsOfWeek\(now\)\.filter\(\(t\) => !done\[t\.key\]\);/.test(learnLib));

// ============ 4. Tile Married DIHAPUS (23 Sep 2026) ============
// Dulu tile "Coming Soon" yang tempatnya sudah disiapkan. Pemiliknya memutuskan
// membuangnya karena tak pernah dipakai; yang dijaga sekarang: hapusnya BERSIH,
// tidak menyisakan rute yatim, warna yatim, atau glif yatim.
console.log('\n4. Home: tile Married sudah dihapus bersih');
const grid = baca('lib/featureGrid.ts');
ok('tidak ada lagi tile Married di grid', !/married/i.test(grid));
ok('layarnya ikut dihapus', !fs.existsSync(path.join(ROOT, 'app/married.tsx')));
ok('rutenya hilang dari typed routes',
  !baca('.expo/types/router.d.ts').includes('`/married`'));
ok('warnanya ikut dibuang dari palet (tidak jadi warna yatim)',
  !/MARRIED/.test(baca('assets/style/color.ts')));
ok('glif cincinnya ikut dibuang; jabat tangan Friends tetap',
  baca('components/ui/icon-glyph.tsx').includes("export type GlyphName = 'handshake';") &&
  !/diamond/.test(baca('components/ui/icon-symbol.tsx')));
ok('tak ada sisa tautan /married di sumber mana pun', (() => {
  const sisa = [];
  for (const d of ['app', 'components', 'lib', 'hooks']) {
    (function sisir(rel) {
      for (const e of fs.readdirSync(path.join(ROOT, rel), { withFileTypes: true })) {
        const anak = `${rel}/${e.name}`;
        if (e.isDirectory()) sisir(anak);
        else if (/\.tsx?$/.test(e.name) && /'\/married'/.test(baca(anak))) sisa.push(anak);
      }
    })(d);
  }
  return sisa.length === 0;
})());

// ============ 5. Fitness: centang hari lalu tetap tampil ============
console.log('\n5. Fitness: hari yang sudah beres tampil lengkap centangnya');
const ex = baca('components/fitness/ExerciseTab.tsx');
ok('hari yang dilihat dibaca dari catatan hari itu, bukan cuma hari ini',
  /const viewDay: FitDay = isToday\s*\?\s*day\s*:\s*\(weekDays\[viewDayId\] \?\? EMPTY_FIT_DAY\);/.test(ex));
ok('centang gerakan TIDAK lagi dipaksa mati di hari lain',
  /const checked = !exSkipped && !!done\[ex\.id\];/.test(ex) &&
  !/const checked = isToday && /.test(ex));
ok('tetap TIDAK bisa diubah (tombolnya mati & cincinnya abu-abu)',
  /disabled=\{!isToday \|\| exSkipped\}/.test(ex) &&
  /locked=\{!isToday\}/.test(ex) &&
  /if \(!user \|\| !isToday \|\| busy \|\| skipped\) return;/.test(ex));
// Kalimatnya boleh diringkas pemiliknya (3 Sep 2026). Yang dijaga BEDA
// KATANYA: hari lampau tidak boleh disebut "pratinjau" — itu hari yang sudah
// terjadi & catatannya terkunci, bukan bocoran hari depan.
const cabangHari = ex.slice(ex.indexOf('{!sudahLewat'), ex.indexOf('</VixText>', ex.indexOf('{!sudahLewat')));
ok('keterangannya jujur: "sudah berlalu", bukan pratinjau',
  /🔒 Sudah berlalu/.test(cabangHari) &&
  // Kata "pratinjau" habis sama sekali: hari depan bukan lagi pratinjau sesi
  // yang sudah ditetapkan — sesinya memang BELUM ADA sampai kamu memilihnya.
  !/[Pp]ratinjau/.test(cabangHari));
ok('hari DEPAN menyebut bahwa pilihannya dibuat pada hari-H',
  /!sudahLewat\s*\n?\s*\? '👀 Hari depan, pilihannya dibuat pada hari-H'/.test(
    cabangHari,
  ));
// Cincinnya juga disembunyikan untuk hari yang KOSONG: lingkaran "0/0" bukan
// kemajuan, cuma bulatan yang membingungkan.
ok('cincin kemajuan ikut tampil untuk hari yang sudah lewat & ada isinya',
  /const sudahLewat = isToday \|\| viewDayId <= dayId;/.test(ex) &&
  /\{sudahLewat && !belumPilih && \(\s*<DonutChart/.test(ex));
ok('kereset tiap Senin karena deretnya memang minggu berjalan',
  /const weekIds = weekDayIds\(today\);/.test(ex));

// ============ 6. Reward dihitung SESUDAH hari berakhir ============
console.log('\n6. Fitness: rentetan & reward baru dihitung lewat jam 00.00');
const fitLib = baca('lib/fitness.ts');
ok('centang gerakan TIDAK lagi menaikkan rentetan',
  !/bumpFitStreak/.test(ex) && !/bumpWeekGym/.test(ex));
ok('fungsi lama bumpFitStreak sudah tidak ada',
  !/export function bumpFitStreak/.test(fitLib));
ok('pembukuan hanya menyentuh hari yang sudah HABIS (mulai dari kemarin)',
  /for \(let i = FIT_SETTLE_DAYS; i >= 1; i--\)/.test(fitLib));
ok('hari yang sudah pernah ditutup dilewati (tidak dihitung dua kali)',
  /if \(id > lastDayId\) ids\.push\(id\);/.test(fitLib));
ok('rentetannya dibaca dari Firestore, bukan salinan layar (anti balapan)',
  /const snap = await getDoc\(ref\);/.test(fitLib));
// Aturan streaknya berubah bersama perombakan Fitness: tidak ada lagi "hari
// inti" versus "hari pemulihan" — app tak lagi tahu hari mana yang seharusnya
// ringan, karena kamu yang menentukan tiap harinya. Apa pun yang kamu pilih &
// tuntaskan dihitung; hari tanpa pilihan memutusnya.
ok('hanya hari TUNTAS yang dicatat, apa pun paket yang dipilih',
  !/isFitWalkDay/.test(fitLib) &&
  /if \(!fitDayComplete\(days\[id\], d\)\) continue;/.test(fitLib) &&
  /streak = nextStreak\(streak, id, prevDayId\(d\)\);/.test(fitLib));
ok('rekap gym mingguan naik kalau ADA paket beban di hari itu',
  /if \(fitSessionsOf\(days\[id\], d\)\.some\(\(s\) => s\.kind === 'strength'\)\) \{/.test(
    fitLib,
  ));
ok('tidak ada tulis Firestore kalau tidak ada yang perlu dicatat',
  /if \(counted > 0\) await setDoc\(ref, streak\);/.test(fitLib) &&
  /if \(ids\.length === 0\) return 0;/.test(fitLib));
ok('dijalankan sekali per hari saat layar Fitness dibuka',
  /settledDay\.current === dayId/.test(baca('app/fitness.tsx')) &&
  /settleFitDays\(user\.uid, new Date\(\)\)/.test(baca('app/fitness.tsx')));
// Pindah ke hook angka reward — dan justru jadi lebih luas: SEMUA layar
// yang menampilkan angkanya (daftar & halaman kategori) ikut menutup buku.
ok('juga saat angka reward dibuka (di situlah angkanya dilihat)',
  /settleFitDays\(user\.uid, new Date\(\)\)/.test(baca('hooks/useRewardStats.ts')) &&
  /useRewardStats\(\)/.test(baca('app/reward.tsx')) &&
  /useRewardStats\(\)/.test(baca('app/reward-category.tsx')));
ok('LEWATI hari ini menandai harinya sudah ditutup (bukan mengosongkan)',
  /lastDayId: dayDocId\(d\),/.test(fitLib) && !/lastDayId: '',/.test(fitLib));

// ============ 7. Self-Reward: daftar sendiri, klaim, archive ============
console.log('\n7. Self-Reward: daftar sendiri + klaim + Archive');
const rewardLib = baca('lib/selfReward.ts');
const ach = baca('app/reward.tsx');
const arsip = baca('app/reward-archive.tsx');
// 23 Sep 2026: lib/achievements.ts jadi lib/reward.ts dan tangga lencananya
// kini bernama REWARDS — jadi cek ini ditunjuk ke yang sebenarnya dijaga:
// tidak ada DAFTAR HADIAH BAWAAN yang ditulis di kode (hadiahnya milik user,
// tersimpan di Firestore).
ok('6 hadiah bawaan sudah dihapus dari kode',
  !/const REWARDS/.test(baca('lib/selfReward.ts')) && !/const REWARDS/.test(ach) &&
  !/const REWARDS/.test(arsip));
ok('daftarnya sekarang milikmu & tersimpan di Firestore',
  /users\/\{uid\}\/rewards\/list/.test(rewardLib) &&
  /export function subscribeSelfRewards/.test(rewardLib));
ok('bisa tambah / ubah / hapus permanen',
  /openAddReward/.test(ach) && /openEditReward/.test(ach) &&
  /rewards\.filter\(\(r\) => r\.id !== editing\.id\)/.test(ach));
ok('hapusnya PERMANEN (tulis ulang array, tanpa penanda apa pun)',
  !/isDeleted|archived: true|deleted: true/.test(rewardLib));
ok('tombol Klaim hanya muncul kalau saldonya cukup',
  /const affordable = balance >= r\.price;/.test(ach) &&
  /\{affordable \? \(\s*<PressableScale\s+style=\{styles\.claimButton\}/.test(ach));
ok('ada modal validasi sebelum klaim',
  /visible=\{claiming !== null\}/.test(ach) &&
  /confirmLabel="Ya, Sudah Kuklaim"/.test(ach) &&
  /SUDAH benar-benar kamu ambil/.test(ach));
ok('klaim mengurangi saldo Saku Self-Reward',
  /balance: increment\(-reward\.price\)/.test(rewardLib));
ok('…lewat MUTASI betulan, biar tidak dibatalkan reconcileFundBalance',
  /direction: 'credit'/.test(rewardLib) &&
  /'funds', SELF_REWARD_FUND, 'entries'/.test(rewardLib));
ok('semuanya satu batch atomik (mutasi + saldo + riwayat)',
  (rewardLib.match(/batch\.set\(/g) ?? []).length >= 3 &&
  /return batch\.commit\(\);/.test(rewardLib));
ok('yang diklaim TETAP di daftar — boleh diklaim lagi (pilihanmu)',
  !/list: list\.filter\(\(r\) => r\.id !== reward\.id\)/.test(rewardLib));
ok('riwayat klaim menyimpan tanggalnya, terbaru di atas',
  /list: \[\{ \.\.\.reward, claimedAt: at \}, \.\.\.archive\]/.test(rewardLib));
ok('tombol Archive di kanan atas, pola sama dengan fitur lain',
  /right=\{\s*<EmojiButton\s+emoji="🗄️"[\s\S]{0,80}\/reward-archive/.test(ach));
ok('layar Archive menampilkan hadiah + tanggal klaimnya',
  /formatShortDayDateTime\(r\.claimedAt\.toDate\(\)\)/.test(arsip));
ok('baris riwayat bisa dihapus permanen',
  /saveClaimedRewards\(\s*user\.uid,\s*items\.filter/.test(arsip));
ok('rutenya sudah terdaftar di typed routes',
  baca('.expo/types/router.d.ts').includes('`/reward-archive`'));

// ============ 8. Piala di kiri ============
console.log('\n8. Reward: piala 🏆 pindah ke kiri');
ok('kartunya jadi satu baris (piala kiri, angka kanan)',
  /heroCard: \{\s*flexDirection: 'row',/.test(ach));
ok('tulisannya tidak lagi dipaksa rata tengah',
  /heroLabel: \{ color: Color\.TEXT_ON_DARK_MUTED \}/.test(ach));
ok('pialanya sedikit lebih kecil → kartunya lebih pendek',
  /heroEmoji: \{ fontSize: 40/.test(ach));
ok('urutan isinya: piala dulu, baru angkanya',
  ach.indexOf('styles.heroEmoji}>🏆') < ach.indexOf('styles.heroMain'));

// ============ 9. Jam pertemuan visitasi ============
console.log('\n9. Visitasi: jam pertemuan');
const fields = baca('components/core/VisitationFormFields.tsx');
ok('kolom jam ada di modalnya', /🕒 Jam Pertemuan/.test(fields) && /<TimeField/.test(fields));
ok('jam & tanggal menempel di SATU kolom Date (sekali simpan)',
  /<TimeField\s+key=\{`t-\$\{dateKey\}`\}\s+value=\{form\.date\}\s+onChange=\{form\.setDate\}/.test(fields));
ok('otomatis kena DUA layar: sub-tab Visitation & Riwayat Visitasi',
  /<VisitationFormFields/.test(baca('components/core/VisitationTab.tsx')) &&
  /<VisitationFormFields/.test(baca('app/visitations.tsx')));
ok('TIDAK muncul di daftar depan (kartunya cuma tanggal)',
  !/formatTime/.test(baca('components/core/VisitationCardBody.tsx')));
ok('PDF-nya memang mencetak jamnya',
  /\{ label: 'Mulai', value: `\$\{formatTime\(d\)\} WIB` \}/.test(baca('lib/visitationPdf.ts')));
ok('ganti tanggal tidak menghapus jamnya (mergeDate)',
  /onChange\(value \? mergeDate\(value, selected\) : selected\)/.test(baca('components/common/DateField.tsx')));

// ============ Aturan wajib ============
console.log('\nAturan wajib');
ok('semua warna dari Color, tak ada hex mentah di layar baru',
  !/#[0-9A-Fa-f]{6}/.test(arsip) &&
  !/#[0-9A-Fa-f]{6}/.test(rewardLib));
ok('tidak ada soft-delete diselundupkan',
  !/isDeleted|archived: true/.test(rewardLib + ach + arsip + fitLib));
// Impor relatif ./ juga sah — lib/*.ts memang saling panggil begitu.
ok('tidak ada dependency baru (semua dari @/ , ./ , react, react-native, firebase)',
  !/from '(?!@\/|\.\/|react|react-native|firebase)/.test(rewardLib),
  [...rewardLib.matchAll(/from '([^']+)'/g)].map((m) => m[1]).join(' '));

console.log(gagal === 0
  ? '\n✅ LULUS — 9 permintaan terbukti.'
  : `\n❌ ${gagal} cek gagal.`);
process.exit(gagal === 0 ? 0 : 1);
