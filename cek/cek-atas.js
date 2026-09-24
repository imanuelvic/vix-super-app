// Cek "pencet 2x → balik ke paling atas": chip kategori mendatar + tab utama.
const AKAR = require('./akar');
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

// ---------- Hook bersama ----------
console.log('\nhooks/useScrollTop.ts');
const hook = baca('hooks/useScrollTop.ts');
ok('toTop() menggulung ke y:0', /scrollTo\(\{\s*y:\s*0,\s*animated:\s*true\s*\}\)/.test(hook));
// Sejak proyek naik ke Expo SDK 57, react-navigation ikut dibungkus ke dalam
// expo-router — jadi jalur impornya pindah ke 'expo-router/react-navigation'.
// Pustaka & perilakunya sendiri sama persis (dibuktikan tiga cek di bawah).
ok('pakai useScrollToTop bawaan react-navigation (tab utama)',
  /import \{ useScrollToTop \} from ["']expo-router\/react-navigation["']/.test(hook) &&
  /useScrollToTop\(ref/.test(hook));

// useScrollToTop hanya bekerja saat layarnya SEDANG dibuka & hanya kalau ada
// tab navigator di atasnya — dibaca langsung dari sumber pustakanya.
const lib = baca('node_modules/expo-router/build/react-navigation/native/useScrollToTop.js');
// (di sumbernya ada blok komentar panjang antara addListener( dan 'tabPress')
ok('pustakanya memang mendengar "tabPress"', /addListener\([\s\S]{0,500}?'tabPress',/.test(lib));
ok('pustakanya hanya menggulung saat layar sedang fokus (= tekanan kedua)',
  /const isFocused = navigation\.isFocused\(\)/.test(lib) && /if \(isFocused && isFirst/.test(lib));
ok('di layar tanpa tab bar hook-nya diam (tidak error)',
  /if \(tabNavigations\.length === 0\) \{\s*return;/.test(lib));

// Tombol tab meneruskan onPress bawaan → tabPress benar-benar terpancar.
const haptic = baca('components/haptic-tab.tsx');
// 22 Sep 2026: tombol Home timbul (RaisedHomeTab) dibuang — Today tab pertama biasa.
const raised = baca('components/haptic-tab.tsx');
// 15 Sep 2026: style/onPressIn/onPressOut di-destructure (animasi mengecil),
// sisanya (termasuk onPress → tabPress) tetap diteruskan lewat {...rest}.
ok('HapticTab meneruskan props bawaan (onPress → tabPress)',
  /\{ style, onPressIn, onPressOut, \.\.\.rest \}: BottomTabBarButtonProps/.test(haptic) && /\{\.\.\.rest\}/.test(haptic));
ok('HapticTab (semua tab utama) meneruskan props bawaan', /\{\.\.\.rest\}/.test(raised) &&
  !require('fs').existsSync(AKAR + '/components/raised-home-tab.tsx'));

// ---------- FilterChips ----------
console.log('\nFilterChips (chip kategori bersama)');
const chips = baca('components/common/FilterChips.tsx');
ok('onRepress hanya dipanggil kalau chip-nya SEDANG aktif',
  /if \(value === o\.key\) onRepress\?\.\(\);/.test(chips));
ok('chip ALL juga ikut', /if \(value === null\) onRepress\?\.\(\);/.test(chips));
ok('perilaku filter TIDAK berubah (tekanan kedua tetap melepas filter)',
  /onChange\(value === o\.key \? null : o\.key\)/.test(chips));
ok('onRepress opsional (pemakai lama tak wajib mengisinya)',
  /onRepress\?:\s*\(\)\s*=>\s*void;/.test(chips));

// ---------- Pemakai FilterChips ----------
console.log('\nPemakai FilterChips');
for (const [nama, file] of [
  ['Riwayat Pertemuan 🕘', 'app/visitations.tsx'],
  ['My History 📜', 'app/history.tsx'],
  ['Reminder → Prioritas 📌', 'components/tasks/PriorityTab.tsx'],
  ['Learning → Diskusi 💬', 'components/learning/DiscussionTab.tsx'],
]) {
  const src = baca(file);
  const punyaRef = /ref=\{scrollRef\}/.test(src);
  const punyaRepress = /onRepress=\{toTop\}/.test(src);
  const punyaHook = /useScrollTop\(\)/.test(src) && /from '@\/hooks\/useScrollTop'/.test(src);
  ok(`${nama}: ref + onRepress + hook`, punyaRef && punyaRepress && punyaHook,
    `ref:${punyaRef} repress:${punyaRepress} hook:${punyaHook}`);
}

// ---------- Chip kategori Reminder (yang di foto) ----------
console.log('\nReminder 🔔 — chip PERSONAL/WORK/MINISTRY');
const tasks = baca('app/tasks.tsx');
ok('chip aktif ditekan lagi → toTop(); chip lain → ganti kategori',
  /category === c\.key \? toTop\(\) : setCategory\(c\.key\)/.test(tasks));
ok('daftar harinya yang dapat ref', /ref=\{scrollRef\}[\s\S]{0,120}styles\.listScroll/.test(tasks));
ok('drag & drop ke chip tidak terganggu (catRefs tetap ada)',
  /catRefs\.current\[c\.key\] = r;/.test(tasks));

// ---------- Deretan hari Fitness ----------
console.log('\nFitness 💪 — deretan hari mendatar');
const gym = baca('components/fitness/ExerciseTab.tsx');
ok('hari yang sedang dibuka ditekan lagi → toTop()',
  /active \? toTop\(\) : setWeekday\(wd\)/.test(gym));
// Satu ref, dua pemakai: useScrollTop (balik ke atas) & useDueJump (lompat ke
// gerakan yang belum dicentang). Ref-nya dioper ke useDueJump, bukan dipasang
// ref kedua di ScrollView yang sama.
ok('isi sesinya yang dapat ref', /ref=\{scrollRef\}/.test(gym));

// ---------- Tab utama ----------
console.log('\nLima tab utama (tekan tab yang sama lagi)');
for (const [nama, file, jml] of [
  ['Dashboard 📊', 'app/reminders.tsx', 1],
  ['Habits ✅', 'components/habits/HabitsTab.tsx', 1],
  ['Home 🏠', 'app/(tabs)/index.tsx', 1],
  ['Profile 👤', 'app/profile.tsx', 2], // sub-tab Profile & Data Tubuh
  ['System ⚙️', 'app/system.tsx', 1],
]) {
  const src = baca(file);
  const hookCount = (src.match(/useScrollTop\(\)/g) ?? []).length;
  ok(`${nama}: pakai useScrollTop (${jml}×)`, hookCount === jml, `ketemu ${hookCount}`);
  ok(`${nama}: ref terpasang di ScrollView-nya`,
    /ref=\{(scrollRef|mainScroll|bodyScroll)\}/.test(src));
}
// Sub-tab Profile lain punya daftar sendiri.
for (const [nama, file] of [
  ['Profile → Personality 🧠', 'components/profile/PersonalityTab.tsx'],
  ['Profile → Ikigai/SWOT 🎯', 'components/profile/QuadrantTab.tsx'],
]) {
  const src = baca(file);
  ok(`${nama} ikut kebagian`, /useScrollTop\(\)/.test(src) && /ref=\{scrollRef\}/.test(src));
}

// ---------- Yang lama tidak boleh rusak ----------
console.log('\nPerilaku lama yang harus tetap');
const habits = baca('components/habits/HabitsTab.tsx');
ok('Habits: tekan tab sesi lagi tetap loncat ke baris pertama yang belum dicentang',
  /!day\.done\[h\.id\] && !day\.skipped\[h\.id\]/.test(habits) &&
  /Math\.max\(0, blockY\.current \+ y - 8\)/.test(habits));
ok('Habits: ref sesi & ref tab utama memang SATU ref (tidak dobel)',
  (habits.match(/useScrollTop\(\)/g) ?? []).length === 1);
const visit = baca('app/visitations.tsx');
ok('Riwayat Pertemuan: hapus tetap PERMANEN',
  /saveVisitations\(user\.uid, all\.filter\(\(v\) => v\.id !== editing\.id\)\)/.test(visit));

// ---------- Sapu bersih: semua baris mendatar sudah kebagian ----------
console.log('\nSapuan: semua baris pilihan mendatar di app');
const semua = [];
(function jalan(dir) {
  for (const nama of fs.readdirSync(path.join(ROOT, dir))) {
    const rel = `${dir}/${nama}`;
    const stat = fs.statSync(path.join(ROOT, rel));
    if (stat.isDirectory()) jalan(rel);
    else if (nama.endsWith('.tsx')) {
      const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
      // <ScrollView ... horizontal ...> = baris yang bisa digeser samping
      if (/<ScrollView[^>]*\n?\s*horizontal/.test(src)) semua.push(rel);
    }
  }
})('app');
(function jalan(dir) {
  for (const nama of fs.readdirSync(path.join(ROOT, dir))) {
    const rel = `${dir}/${nama}`;
    const stat = fs.statSync(path.join(ROOT, rel));
    if (stat.isDirectory()) jalan(rel);
    else if (nama.endsWith('.tsx')) {
      const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
      if (/<ScrollView[^>]*\n?\s*horizontal/.test(src)) semua.push(rel);
    }
  }
})('components');
// 28 Agu 2026: baris chip mendatar dikumpulkan jadi SATU komponen
// (components/common/ChipRow.tsx). Reminder, FilterChips (6 layar) & pemilih
// sumber News sekarang memakainya, jadi ScrollView mendatarnya tinggal di dua
// tempat. Baris chip itu BUKAN daftar isi — cuma sederet tombol pilihan, tak
// ada yang perlu "balik ke paling atas".
const diharap = [
  'components/common/ChipRow.tsx',
  // Deretan hari Fitness: pil selebar TETAP dengan aturan muat-tidaknya
  // sendiri (dihitung dari lebar layar, bukan diukur), dan saat muat tiap pil
  // MELAR sama besar — bukan dibagi jarak seperti ChipRow. Sengaja dibiarkan.
  'components/fitness/ExerciseTab.tsx',
  // 16 Sep 2026: tabel Rekap Visitasi (jenis × CL) — selebar layar biasanya,
  // baru bisa digeser ke samping kalau CL-nya lebih dari delapan. Tabel, bukan
  // baris chip, dan bukan daftar isi yang perlu "balik ke atas".
  'app/core-recap.tsx',
  // 22 Sep 2026: sub-tab versi PIL di bawah pita (placement="top") untuk tab
  // utama Walk · CORE · Work — deretan tombol pilihan, bukan daftar isi.
  'components/common/BottomTabs.tsx',
].sort();
ok(`ketemu ${semua.length} baris mendatar, semuanya sudah ditangani`,
  JSON.stringify(semua.sort()) === JSON.stringify(diharap),
  `ketemu: ${semua.join(', ')}`);

console.log(gagal === 0 ? '\n✅ LULUS — pencet 2x = balik ke paling atas.'
  : `\n❌ ${gagal} cek gagal.`);
process.exit(gagal === 0 ? 0 : 1);
