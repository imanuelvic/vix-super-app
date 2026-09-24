// Uji: tombol 🔥 reward di pojok kanan tiap layar fitur — nama kategori
// yang dipakai harus BENAR-BENAR ada (salah tulis = modal tak pernah terbuka,
// diam-diam), tombolnya tak boleh hilang dari layar yang punya pencapaian,
// dan dua tombol di pojok kanan harus berdampingan (bukan bertumpuk).
const AKAR = require('./akar');
const BACA_TODAY = (p) => require('fs').readFileSync(AKAR + '/' + p, 'utf8').replace(/\r\n/g, '\n'); // 22 Sep 2026 Today OS
const fs = require('fs');
const R = AKAR + '/';
const baca = (f) => fs.readFileSync(R + f, 'utf8');

let ok = true;
const c = (n, s, extra) => {
  if (!s) ok = false;
  console.log((s ? '  ✓ ' : '  ✗ ') + n + (extra ? `  → ${extra}` : ''));
};

const ach = baca('lib/reward.ts');
const tombol = baca('components/common/RewardButton.tsx');
const header = baca('components/common/ScreenHeader.tsx');
const layarAch = baca('app/reward.tsx');

// Daftar kategori yang benar-benar ada, dibaca dari kodenya.
// (15 Sep 2026: kolom `feature` dicabut — urutan papan kini ditulis tangan
// di PAPAN, lihat cek-papan-achv.js.)
const KATEGORI = [...ach.matchAll(/\{ key: '(\w+)', icon: [^,]+, label: '([^']+)'/g)]
  .map(([, key, label]) => ({ key, label }));
const KUNCI = KATEGORI.map((k) => k.key);

console.log('=== Ganti nama: Gym Konsisten → Fitness ===');
// 31 Agu 2026: "Fitness Konsisten" & "Strength Training" digabung jadi satu
// kolom bernama "Fitness" (lihat cek-enam-permintaan.js).
c('kategorinya sekarang bernama "Fitness"',
  KATEGORI.some((k) => k.key === 'fitness' && k.label === 'Fitness'));
c('tulisan "Gym Konsisten" sudah tidak ada di mana pun', (() => {
  const semua = ['lib/reward.ts', 'app/reward.tsx', 'app/fitness.tsx']
    .map(baca).join('\n');
  return !/Gym Konsisten/.test(semua);
})());
c('kunci & id pencapaiannya TIDAK ikut berubah (progres lama tetap kepakai)',
  /category: 'fitness'/.test(ach) && /id: 'fitWeek1'/.test(ach) &&
    /id: 'fitMonth'/.test(ach));
c('istilah "gym" di tempat lain tidak ikut disapu (mis. weekGymHits)',
  /weekGymHits/.test(ach) && /Strength 2×/.test(ach));

console.log('\n=== Tombolnya sendiri ===');
c('lambangnya api 🔥', /emoji="🔥"/.test(tombol));
c('bentuknya EmojiButton — sama persis dengan tombol pojok kanan lain',
  /import \{ EmojiButton \}/.test(tombol) && /<EmojiButton/.test(tombol));
c('menuju HALAMAN kategorinya, dengan kategori sebagai parameter',
  /router\.push\(\{ pathname: '\/reward-category', params: \{ cat: category \} \}\)/
    .test(tombol.replace(/\s+/g, ' ')));
c('kategorinya bertipe RewardCategoryKey (salah tulis ditangkap tsc)',
  /category: RewardCategoryKey/.test(tombol));

console.log('\n=== Kategorinya langsung terbuka, bukan daftar dulu ===');
const layarKat = baca('app/reward-category.tsx');
c('parameter cat dibaca saat render (bukan lewat useEffect)',
  /const key = rewardCategoryOf\(cat\);/.test(layarKat) && !/useEffect/.test(layarKat));
c('kategori tak dikenal jatuh ke null → halamannya jujur, tidak error',
  /CATEGORIES\.some\(\(c\) => c\.key === key\)\s*\?\s*\(key as RewardCategoryKey\)\s*:\s*null/
    .test(ach) && /if \(!meta\) \{/.test(layarKat));
c('isinya memang tangga lencana kategori itu',
  /REWARDS\.filter\(\(a\) => a\.category === key\)/.test(layarKat));

console.log('\n=== Pojok kanan sanggup memuat DUA tombol ===');
c('rightBox disusun sebaris (row), jadi 📖 & 🔥 berdampingan',
  /rightBox: \{[^}]*flexDirection: 'row'[^}]*\}/.test(header));
c('tetap sejajar tengah & berjarak',
  /rightBox: \{[^}]*alignItems: 'center'[^}]*gap: 8[^}]*\}/.test(header));
// 28 Agu 2026: `paddingTop: 4` DIBUANG, diganti jaminan yang lebih kuat.
// Dulu tinggi baris judul ikut isinya — judul saja 45, judul + tombol 42+4 —
// jadi subjudul di bawahnya pindah tempat tiap kali tombol pojok kanan muncul
// atau hilang (di Spiritual itu terjadi tiap ganti sub-tab). Sekarang tinggi
// barisnya dipatok dan keduanya ditengahkan, jadi posisinya tetap TANPA
// bergantung pada jarak atas tombolnya.
c('tinggi baris judulnya dipatok, tidak ikut isinya',
  /const TITLE_ROW_HEIGHT = 46;/.test(header) &&
    /minHeight: TITLE_ROW_HEIGHT/.test(header));
c('judul & tombol ditengahkan, jadi tak perlu lagi jarak atas manual',
  /titleRow: \{[\s\S]*?alignItems: 'center',[\s\S]*?minHeight/.test(header) &&
    !/rightBox: \{[^}]*paddingTop[^}]*\}/.test(header));

console.log('\n=== Tiap layar fitur punya pintunya ===');
// [file, keterangan, pola yang harus ada, kategori yang dituju]
const PINTU = [
  ['app/fitness.tsx', 'Fitness 💪', /right=\{<RewardButton category="fitness" \/>\}/, ['fitness']],
  ['app/learning.tsx', 'Learning 🎓', /right=\{<RewardButton category="learning" \/>\}/, ['learning']],
  ['app/steps.tsx', 'Langkah Kaki 👣', /right=\{<RewardButton category="steps" \/>\}/, ['steps']],
  ['app/bible-reading.tsx', 'Bacaan Alkitab 📖', /right=\{<RewardButton category=\{BIBLE_CATEGORY\[session\]\} \/>\}/, []],
  ['app/(tabs)/walk.tsx', 'Spiritual ✝️ (Revive)', /<RewardButton category="login" \/>/, ['login']],
  ['app/health.tsx', 'Health 🍎 (Steps)', /<RewardButton category="week" \/>/, ['week']],
];
for (const [file, nama, pola, kunci] of PINTU) {
  const src = baca(file);
  c(`${nama} — tombol 🔥 terpasang`, pola.test(src));
  c(`${nama} — komponennya benar-benar diimpor`,
    /import \{ RewardButton \} from '@\/components\/common\/RewardButton'/.test(src));
  for (const k of kunci) {
    c(`${nama} — kategori "${k}" memang ada di daftar`, KUNCI.includes(k));
  }
}

console.log('\n=== Alkitab: sesi yang dilihat = modal yang dibuka ===');
const petaSrc = ach.match(/export const BIBLE_CATEGORY[\s\S]*?= (\{[\s\S]*?\});/);
c('peta BIBLE_CATEGORY ada di lib/rewards', !!petaSrc);
const peta = petaSrc ? new Function(`return ${petaSrc[1]}`)() : {};
c('ketiga sesi terpetakan, tak ada yang tertinggal',
  JSON.stringify(Object.keys(peta)) === JSON.stringify(['morning', 'daytime', 'night']),
  Object.keys(peta).join(', '));
for (const [sesi, kat] of Object.entries(peta)) {
  c(`sesi "${sesi}" → kategori "${kat}" (ada di daftar)`, KUNCI.includes(kat));
}
c('tidak tertukar: pagi→pagi, siang→siang, malam→malam',
  peta.morning === 'bibleMorning' && peta.daytime === 'bibleDaytime' &&
    peta.night === 'bibleNight');
c('layar Bacaan Alkitab memakai sesi yang SEDANG dibuka (bukan tebakan tetap)',
  /const session = bibleSessionOf\(sessionParam\)/.test(baca('app/bible-reading.tsx')));
const spir = baca('app/(tabs)/walk.tsx');
c('tab Bible Reading memakai sesi yang jendelanya sedang berjalan',
  /category=\{BIBLE_CATEGORY\[bibleSessionNow\(now\) \?\? 'morning'\]\}/
    .test(spir.replace(/\s+/g, ' ')));
c('di luar jam baca mana pun tetap ada jawabannya (jatuh ke pagi)',
  /bibleSessionNow\(now\) \?\? 'morning'/.test(spir.replace(/\s+/g, ' ')));
c('bibleSessionNow memang boleh mengembalikan null',
  /export function bibleSessionNow\(now: Date\): BibleSession \| null/
    .test(baca('lib/spiritual.ts')));

console.log('\n=== Tombol lama tidak ada yang hilang ===');
c('Spiritual tetap punya 📖 riwayat Revive di tab Revive',
  /emoji="📖"\s*onPress=\{\(\) => router\.push\('\/revive-history'\)\}/
    .test(spir.replace(/\s+/g, ' ').replace(/> </g, '>\n<')) ||
    /router\.push\('\/revive-history'\)/.test(spir));
const health = baca('app/health.tsx');
c('Health tetap punya 👣 rekor langkah di tab Steps',
  /emoji="👣"/.test(health) && /router\.push\('\/steps'\)/.test(health));
c('Health tetap punya 💪🏻 info kesehatan di tab lain',
  /emoji="💪🏻"/.test(health) && /router\.push\('\/health-info'\)/.test(health));
c('Reward tetap punya 🗄️ arsip klaim',
  /emoji="🗄️"/.test(layarAch));
c('Habits tetap memakai pil 🔥 berangka (streak-nya nyata), bukan tombol polos',
  /<StreakPill\s+streak=\{activeStreak\(streak \?\? null, dayId\)\}\s+category="health"\s*\/>/
    .test(baca('app/habits.tsx')));
c('pintu umum Reward tanpa kategori = tile di tab Life (22 Sep 2026)',
  /route: '\/reward'/.test(BACA_TODAY('lib/featureGrid.ts')));

console.log('\n=== Aturan wajib ===');
const semuaBaru = tombol + header;
c('warnanya dari Color, tak ada hex mentah', !/#[0-9A-Fa-f]{6}/.test(semuaBaru));
c('tidak ada soft-delete diselundupkan', !/isDeleted|archived: true/.test(semuaBaru));
c('tidak ada modul native baru (cukup eas update)',
  !/expo-media-library|react-native-[a-z-]+/.test(tombol));
c('tidak ada tulisan "ketuk"/"tap" (istilah yang dipakai: click)',
  !/\b(ketuk|tap)\b/i.test(tombol + header));

// Sekadar laporan: kategori yang belum punya tombol 🔥 di layarnya.
const dipakai = new Set(['health']); // Habits lewat StreakPill
for (const [file] of PINTU) {
  const src = baca(file);
  for (const m of src.matchAll(/RewardButton category="(\w+)"/g)) dipakai.add(m[1]);
}
for (const k of Object.values(peta)) dipakai.add(k);
const belum = KUNCI.filter((k) => !dipakai.has(k));
console.log(`\n  ℹ️ Belum punya tombol 🔥 sendiri: ${belum.length ? belum.join(', ') : '—'}`);
c('yang belum berpintu tetap terjangkau dari daftar Reward',
  /REWARD_CATEGORIES\.map\(\(cat\) => \{/.test(layarAch) &&
    /pathname: '\/reward-category',/.test(layarAch));

console.log('\n' + (ok ? 'LULUS' : 'GAGAL'));
process.exit(ok ? 0 : 1);
