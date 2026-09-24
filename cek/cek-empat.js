// 21 Sep 2026: langganan lewat useLiveAll → `subscribeX(uid, …)`, bukan `user.uid`.
// Cek 4 permintaan: kartu Apple Health dibuang, air putih keluar dari Diet,
// bug pencarian visitasi diperbaiki + penamaan Visitation, dan judul subtab
// semua fitur jadi bahasa Inggris.
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

// ================= 1. Apple Health =================
console.log('\n1. Kartu Apple Health dibuang, tombol muat-ulang pindah ke atas');
const steps = baca('components/health/StepsTab.tsx');
ok('kartu "🍎 Apple Health" sudah tidak ada', !/🍎 Apple Health/.test(steps));
ok('tidak ada penjelasan apa pun yang tersisa',
  !/hanya tersedia di iPhone/.test(steps) &&
  !/di-build lewat EAS/.test(steps) &&
  !/Rekor harian ≥/.test(steps));
ok('kartu "👣 Langkah hari ini" tetap ada', /👣 Langkah hari ini/.test(steps));
// Sejak 2 Sep 2026 angkanya = Apple Health DITAMBAH langkah yang dicatat
// sendiri (jalan tanpa HP, jam tangan yang tidak tersambung ke sini).
// Keduanya dijumlah — tidak saling menimpa — dan bagian manualnya tetap
// disebut terpisah di kartunya, supaya angkanya masih bisa diurai asal-usulnya.
ok(
  'angkanya = Apple Health + langkah yang dicatat sendiri',
  /const todaySteps = \(hk\?\.steps \?\? 0\) \+ manualToday;/.test(steps) &&
    /dicatat sendiri/.test(steps),
);
const iHero = steps.indexOf('👣 Langkah hari ini');
const iTutupHero = steps.indexOf('</SummaryCard>', iHero);
const iRefresh = steps.indexOf('arrow.triangle.2.circlepath');
ok('tombol muat-ulang sekarang DI DALAM kartu langkah hari ini',
  iRefresh > iHero && iRefresh < iTutupHero);
ok('tombolnya cuma muncul kalau Apple Health memang aktif',
  /hkStatus === 'ok' && \(\s*<PressableScale onPress=\{loadHk\}/.test(steps));
ok('mati sementara saat sedang memuat', /disabled=\{hkBusy\}/.test(steps));
ok('kotak statistik yang tak terpakai ikut dibuang (tak ada kode mati)',
  !/StatTile/.test(steps) && !/statTile/.test(steps) && !/STEP_TIERS/.test(steps));
// 30 Agu 2026: tab Steps dirombak — "🎯 Target Sehat Mingguan" (anjuran umum)
// dipisahkan jadi "🩺 Anjuran Kesehatan", dan di atasnya ada kartu 🎯 Target
// Mingguan yang diisi sendiri. Kartu lain tetap.
ok('sisa kartu Steps tidak diutak-atik',
  /🏃 Patokan Jarak Harian/.test(steps) &&
  /🩺 Anjuran Kesehatan/.test(steps) &&
  /<WeekTargetCard km=\{weekKm\} \/>/.test(steps) &&
  /📅 This Week/.test(steps));

// ================= 2. Air putih =================
console.log('\n2. Air putih cuma di Home');
const health = baca('app/health.tsx');
const home = baca('app/(tabs)/index.tsx');
// Fitur Diet sendiri sudah DIHAPUS seluruhnya (2 Sep 2026) — layarnya,
// lib/diet.ts, sub-tabnya, dan seluruh hitungan kalori/protein/gulanya.
// Ketiga cek "air putih tidak lagi di Diet" ikut hilang bersamanya; yang
// tersisa & tetap dijaga: air putih memang cuma diurus dari Home.
ok(
  'fitur Diet benar-benar tidak ada lagi',
  !fs.existsSync(path.join(ROOT, 'components/health/DietTab.tsx')) &&
    !fs.existsSync(path.join(ROOT, 'lib/diet.ts')) &&
    !/Diet/.test(health.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')),
);
ok('layar Health tidak lagi mengurus air',
  !/changeWater/.test(health) && !/subscribeWaterStreak/.test(health) &&
  !/bumpWaterStreak/.test(health) && !/setWater/.test(health));
ok('satu listener Firestore berkurang di layar Health',
  !/subscribeHabitDay/.test(health));
// 15 Sep 2026: airnya jadi tombol mengambang di SEMUA layar (termasuk Home),
// components/habits/WaterFloat.tsx, dipasang di root layout.
{
  const apung = baca('components/habits/WaterFloat.tsx');
  ok('airnya tetap utuh (angka, tombol, streak) — kini di tombol mengambang global',
    /WATER_GOAL/.test(apung) && /setWater\(/.test(apung) && /bumpWaterStreak/.test(apung) &&
      /<WaterFloat \/>/.test(baca('app/_layout.tsx')) &&
      !/setWater\(|bumpWaterStreak|changeWater/.test(home));
}
// (Cek "sisa fitur Diet tidak terganggu" ikut hilang — fiturnya sudah tidak
// ada sama sekali; penghapusannya sendiri sudah diperiksa di atas.)

// ================= 3. Bug pencarian + penamaan =================
console.log('\n3a. Bug pencarian visitasi');
const tab = baca('components/core/VisitationTab.tsx');
const core = baca('app/(tabs)/core.tsx');
const riwayat = baca('app/visitations.tsx');
ok('CORE ikut mendengarkan Ex CORE Leader', /subscribeExLeaders\(uid, setExLeaders, fail\)/.test(core));
ok('dioper ke tab sebagai pastLeaders (terpisah dari leaders)',
  /pastLeaders=\{exLeaders\}/.test(core));
ok('nama dicari dari CL aktif + ex-CL',
  /const namaLeaders = \[\.\.\.leaders, \.\.\.pastLeaders\];/.test(tab));
ok('tanggal ikut jadi bahan pencarian',
  /\}\s*\$\{meetingKindLabels\(v\)\} \$\{formatFullDate\(/.test(tab));
ok('kartunya juga menampilkan nama ex-CL', /leaders=\{namaLeaders\}/.test(tab));
ok('PDF-nya ikut menyebut nama ex-CL', /\/\/ Ikut ex-CL[\s\S]{0,80}namaLeaders,/.test(tab));
ok('Riwayat Visitasi ikut diperbaiki',
  /subscribeExLeaders/.test(riwayat) &&
  /leaders=\{\[\.\.\.leaders, \.\.\.exLeaders\]\}/.test(riwayat));
// Ex-CL TIDAK boleh bisa dijadwalkan lagi / masuk filter.
ok('ex-CL TIDAK masuk pemilih saat menjadwalkan baru',
  /form\.reset\(leaders\[0\]\?\.id\)/.test(tab) &&
  /<VisitationFormFields[\s\S]{0,200}leaders=\{leaders\}/.test(tab));
ok('ex-CL TIDAK masuk filter jadwal mendatang',
  /options=\{leaders\.map/.test(tab));
ok('penuntun kolom cari menyebut yang bisa dicari',
  /placeholder="Cari nama, judul, agenda, atau tanggal…"/.test(tab));

console.log('\n3b. Pertemuan → Visitation / Visitasi');
ok('subtab-nya jadi "Visitation"', /label: 'Visitation'/.test(core));
for (const [nama, re, file] of [
  ['tombol Jadwalkan Visitasi', /label="Jadwalkan Visitasi"/, tab],
  ['judul sheet 📅 Schedule / ✏️ Edit Visitation', /'📅 Schedule Visitation' : '✏️ Edit Visitation'/, tab],
  ['💡 Visitation Tips', /title="💡 Visitation Tips"/, tab],
  ['🏸 Per Jenis Visitasi', /🏸 Per Jenis Visitasi/, tab],
  ['hitungan hasil cari', /\{results\.length\} visitasi ditemukan/, tab],
  ['🏷️ Jenis Visitasi (form)', /🏷️ Jenis Visitasi/, baca('components/core/VisitationFormFields.tsx')],
  ['Judul Visitasi (form)', /🏷️ Judul Visitasi/, baca('components/core/VisitationFormFields.tsx')],
  ['Visitation History 🕘', /title="Visitation History 🕘"/, riwayat],
  ['✏️ Edit Visitation (riwayat)', /title="✏️ Edit Visitation"/, riwayat],
  ['nama berkas PDF', /'Visitasi CORE'/, baca('lib/visitationPdf.ts')],
]) ok(nama, re.test(file));
const teksTampil = (s) =>
  s.split('\n').filter((b) => !b.trim().startsWith('//') && !b.trim().startsWith('*')).join('\n');
ok('tidak ada lagi kata "Pertemuan" di teks yang tampil',
  !/Pertemuan/.test(teksTampil(tab)) &&
  !/Pertemuan/.test(teksTampil(riwayat)) &&
  // 16 Sep 2026: label kolom jam kamu tulis sendiri '🕒 Jam Pertemuan' —
  // itu satu-satunya 'Pertemuan' yang boleh tampil di form.
  !/Pertemuan/.test(teksTampil(baca('components/core/VisitationFormFields.tsx')).replace('🕒 Jam Pertemuan', '')));

// ================= 4. Judul subtab =================
console.log('\n4. Judul subtab semua fitur = bahasa Inggris');
// Huruf latin saja, tanpa emoji. Angka diizinkan sejak ada sub-tab bernama
// perangkat — "iPhone 15" & "iPad 10" itu nama produknya, bukan campuran
// bahasa; melarang angkanya cuma memaksa nama yang salah.
const INGGRIS = /^[A-Za-z][A-Za-z0-9\- ]*$/;
const layar = fs.readdirSync(path.join(ROOT, 'app')).filter((f) => f.endsWith('.tsx'));
const semuaLabel = [];
for (const f of layar) {
  const src = baca(`app/${f}`);
  // Hanya array definisi tab bar (BottomTab<...>) — bukan label lain di layar.
  const blok = src.match(/BottomTab<[^>]*>\[\] = \[[\s\S]*?\n\];/g) ?? [];
  for (const b of blok) {
    for (const m of b.matchAll(/label: '([^']+)'/g)) {
      semuaLabel.push([f, m[1]]);
    }
  }
}
// Finance memakai bentuk sendiri (SEGMENTS) — ikut diperiksa.
for (const m of baca('app/finance.tsx').matchAll(/label: '([^']+)', icon:/g)) {
  semuaLabel.push(['finance.tsx', m[1]]);
}
ok(`ketemu ${semuaLabel.length} judul subtab di ${layar.length} layar`, semuaLabel.length >= 40);
const bukanInggris = semuaLabel.filter(([, l]) => !INGGRIS.test(l));
ok('semuanya bahasa Inggris, tidak ada yang tersisa',
  bukanInggris.length === 0,
  bukanInggris.map(([f, l]) => `${f}:"${l}"`).join(', '));
for (const [f, harus] of [
  ['app/car.tsx', 'Parts'],
  ['app/debts.tsx', 'Lent Out'],
  ['app/debts.tsx', 'My Debt'],
  ['app/finance.tsx', 'Transactions'],
  // Sub-tab Reflection dibuang & Race pindah ke Health (30 Agu 2026).
  ['app/fun.tsx', 'Creators'],
  ['app/fun.tsx', 'Recreation'],
  ['app/health.tsx', 'Race'],
  ['app/investment.tsx', 'Gold'],
  ['app/investment.tsx', 'Stocks'],
  ['app/learning.tsx', 'Discussion'],
  ['app/residence.tsx', 'Utility'],
  ['app/residence.tsx', 'Maintenance'],
  ['app/tasks.tsx', 'Daily'],
  ['app/tasks.tsx', 'Priority'],
  ['app/(tabs)/core.tsx', 'Visitation'],
]) ok(`${f} → "${harus}"`, baca(f).includes(`label: '${harus}'`));

// Isi fiturnya HARUS tetap bahasa Indonesia.
console.log('\n   …tapi isi fiturnya tetap bahasa Indonesia');
for (const [nama, re, file] of [
  ['Reminder: judul hari & tombol', /Jadwalkan|Tambah|Simpan|Batal/, baca('app/tasks.tsx')],
  ['Finance: kolom & pesan', /Simpan|Batal|Hapus/, baca('app/finance.tsx')],
  ['Residence: kartu Air-Listrik', /Pemakaian bulan/, baca('components/residence/UtilityTab.tsx')],
  ['Debts: isi layar', /Pinjaman/, baca('app/debts.tsx')],
]) ok(nama, re.test(file));

console.log(gagal === 0 ? '\n✅ LULUS — empat-empatnya beres.' : `\n❌ ${gagal} cek gagal.`);
process.exit(gagal === 0 ? 0 : 1);
