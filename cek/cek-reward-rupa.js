// 23 Sep 2026 (sore) — enam permintaan:
//   1. animasi vix dipakai: pembuka app & loading
//   2. kartu saldo Self-Reward jadi pintunya sendiri + Achievement/Awards → Reward
//   3. fitur Married dihapus (dicek di cek-sembilan.js)
//   4. badge sub-tab tidak lagi terpotong pita header · tombol Work jadi 🔔
//   5. tombol Berhasil & Gagal seukuran
//   6. lambang judul Habits jadi ✔️, seragam di seluruh sumber
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');
const ROOT = AKAR;
const baca = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
const ada = (p) => fs.existsSync(path.join(ROOT, p));

let gagal = 0;
function ok(nama, syarat, info = '') {
  if (syarat) console.log(`  ✅ ${nama}`);
  else { gagal++; console.log(`  ❌ ${nama}${info ? ` — ${info}` : ''}`); }
}

console.log('\n=== 1. Animasi vix dipakai ===');
{
  const splash = baca('components/common/VixSplash.tsx');
  const loading = baca('components/common/LoadingCenter.tsx');
  const layout = baca('app/_layout.tsx');
  ok('kedua berkas animasinya ada di assets/gif',
    ada('assets/gif/vix_splash_animation.gif') && ada('assets/gif/vix_loading_animation.gif'));
  ok('pembuka app memakai animasi splash satu layar penuh',
    /vix_splash_animation\.gif/.test(splash) && /resizeMode="cover"/.test(splash) &&
    /<VixSplash \/>/.test(layout));
  ok('latarnya MAIN_DARK, sewarna sudut animasinya & splash bawaan app.json',
    /backgroundColor: Color\.MAIN_DARK/.test(splash) &&
    /"backgroundColor": "#0B3D36"/.test(baca('app.json')));
  ok('loading di tengah memakai animasi vix, bukan spinner bawaan',
    /vix_loading_animation\.gif/.test(loading) && !/ActivityIndicator/.test(loading));
  ok('animasinya dipotong bulat (latar hijau tuanya tidak jadi kotak nyasar)',
    /borderRadius: sisi \/ 2/.test(loading));
  ok('dua ukuran tetap ada, jadi 40+ pemakainya tidak perlu diubah',
    /size = 'small'/.test(loading) && /size === 'large' \? 96 : 52/.test(loading));
  ok('tanpa pustaka animasi baru (GIF diputar <Image> bawaan)',
    /from 'react-native'/.test(splash) && !/lottie|rive/i.test(splash + loading));
}

console.log('\n=== 2. Reward: nama & kartu saldo ===');
{
  const reward = baca('app/reward.tsx');
  const grid = baca('lib/featureGrid.ts');
  ok('berkasnya sudah bernama reward', ada('app/reward.tsx') && ada('app/reward-category.tsx') &&
    ada('lib/reward.ts') && ada('hooks/useRewardStats.ts') && ada('components/common/RewardButton.tsx'));
  ok('nama lama benar-benar hilang',
    !ada('app/achievements.tsx') && !ada('app/achievement-category.tsx') &&
    !ada('lib/achievements.ts') && !ada('hooks/useAchievementStats.ts') &&
    !ada('components/common/AchievementButton.tsx'));
  ok('judul layarnya Reward 🏆', /title="Reward 🏆"/.test(reward));
  ok('tile di grid Life: label Reward, rute /reward', /label: 'Reward', icon: 'trophy\.fill', route: '\/reward'/.test(grid));
  ok('rutenya terdaftar di typed routes',
    baca('.expo/types/router.d.ts').includes('`/reward`') &&
    baca('.expo/types/router.d.ts').includes('`/reward-category`'));
  ok('tak ada satu pun kata Achievement/Awards tersisa di sumber', (() => {
    const sisa = [];
    for (const d of ['app', 'components', 'lib', 'hooks', 'contexts', 'assets']) {
      (function sisir(rel) {
        for (const e of fs.readdirSync(path.join(ROOT, rel), { withFileTypes: true })) {
          const anak = `${rel}/${e.name}`;
          if (e.isDirectory()) sisir(anak);
          else if (/\.tsx?$/.test(e.name) && /chievement|Awards|AWARDS/.test(baca(anak))) sisa.push(anak);
        }
      })(d);
    }
    return sisa.length === 0;
  })());
  ok('jalur Firestore TIDAK ikut berganti (data lama tetap terbaca)',
    /'users', uid, 'app', 'login'/.test(baca('lib/reward.ts')) &&
    /'users', uid, 'funds', 'self-reward'/.test(baca('lib/reward.ts')));
  // Kartu saldo = pintunya sendiri
  ok('kartu saldo bisa di-click & menuju mutasi Saku Self-Reward',
    /<PressableScale\s*\n\s*style=\{styles\.balanceCard\}[\s\S]{0,200}pathname: '\/saku\/\[key\]', params: \{ key: 'self-reward' \}/.test(reward));
  ok('ada garis tepi & chevron supaya ketahuan bisa di-click',
    /borderWidth: 1\.5,\s*\n\s*borderColor: Color\.REWARD,/.test(reward) &&
    /<IconSymbol name="chevron\.right" size=\{20\} color=\{Color\.REWARD_DARK\} \/>/.test(reward));
  ok('keterangannya menyebut mutasi masuk & keluar', /Mutasi masuk & keluar/.test(reward));
  ok('tombol "Kelola Saku Self-Reward" yang lama sudah dibuang',
    !/Kelola Saku Self-Reward/.test(reward));
  ok('tombol Tambah Self-Reward tetap ada', /label="Tambah Self-Reward"/.test(reward));
}

console.log('\n=== 4. Badge sub-tab & tombol pojok Work ===');
{
  const tabs = baca('components/common/BottomTabs.tsx');
  const work = baca('app/(tabs)/work.tsx');
  ok('baris pil punya ruang di atas untuk badge (paddingTop 10 > gantungan 6)',
    /paddingTop: 10/.test(tabs) && /pillBadge: \{ position: 'absolute', top: -6/.test(tabs));
  ok('badge-nya tetap di pojok kanan atas pil', /pillBadge: \{[^}]*right: -6/.test(tabs));
  ok('tombol pojok Work jadi 🔔, menuju Reminder 🔔',
    /emoji="🔔" onPress=\{\(\) => router\.push\('\/tasks'\)\}/.test(work) &&
    /Reminder 🔔/.test(baca('app/tasks.tsx')));
  ok('bukan lagi centang (yang di app ini berarti "selesai")', !/emoji="✅"/.test(work));
}

console.log('\n=== 5. Berhasil & Gagal seukuran ===');
{
  const puasa = baca('app/fasting-days.tsx');
  const silang = baca('components/common/CrossButton.tsx');
  ok('centangnya 42, sama dengan lingkaran silang di sebelahnya',
    /<CheckCircle checked=\{draft\.done\} size=\{42\} \/>/.test(puasa) &&
    /width: 42,\s*\n\s*height: 42,/.test(silang));
  ok('keduanya tetap pilihan terpisah (bukan satu sakelar)',
    /setDraft\(\{ done: !draft\.done, failed: false \}\)/.test(puasa) &&
    /setDraft\(\{ done: false, failed: !draft\.failed \}\)/.test(puasa));
}

console.log('\n=== 6. Lambang Habits ✔️ seragam ===');
{
  const CEK = '\u2714\ufe0f';
  ok(`judul layar Habits memakai ${CEK}`, baca('app/habits.tsx').includes(`Habits ${CEK}`));
  ok('indeks pencarian ikut memakainya', baca('lib/featureIndex.ts').includes(`e('${CEK}', 'Habits'`));
  ok('tidak ada lagi "Habits 📋" di sumber mana pun', (() => {
    const sisa = [];
    for (const d of ['app', 'components', 'lib', 'hooks']) {
      (function sisir(rel) {
        for (const e of fs.readdirSync(path.join(ROOT, rel), { withFileTypes: true })) {
          const anak = `${rel}/${e.name}`;
          if (e.isDirectory()) sisir(anak);
          else if (/\.tsx?$/.test(e.name) && /Habits 📋|'📋', 'Habits'/.test(baca(anak))) sisa.push(anak);
        }
      })(d);
    }
    return sisa.length === 0;
  })());
  ok('📋 tetap dipakai di tempat lain yang memang artinya salin/daftar',
    /📋/.test(baca('components/common/CopyAction.tsx')));
}

console.log(gagal === 0 ? '\n✅ LULUS — enam permintaan terbukti.' : `\n❌ ${gagal} cek gagal.`);
process.exit(gagal === 0 ? 0 : 1);
