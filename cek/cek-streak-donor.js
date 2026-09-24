// 21 Sep 2026: langganan lewat useLiveAll → `subscribeX(uid, …)`, bukan `user.uid`.
// Empat permintaan: (1) kolom Revive di Dashboard bilang "hari beruntun",
// (2) pil 🏆🔥 di Home tanpa angka, (3) syarat & tips donor pindah ke sebelah
// judul Jadwal Donor sebagai tombol lambang, (4) "Rentetan" → "Streak".
const AKAR = require('./akar');
const BACA_TODAY = (p) => require('fs').readFileSync(AKAR + '/' + p, 'utf8').replace(/\r\n/g, '\n'); // 22 Sep 2026 Today OS
const fs = require('fs');
const path = require('path');
const ROOT = AKAR;
const baca = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

let gagal = 0;
function ok(nama, syarat, info = '') {
  if (syarat) console.log(`  ✅ ${nama}`);
  else { gagal++; console.log(`  ❌ ${nama}${info ? ` — ${info}` : ''}`); }
}

// ===================================================================
console.log('\n=== 1. Revive: hari beruntun, bukan rekor ===');
const dash = baca('app/reminders.tsx');

// Blok kolom Revive saja — dipotong sampai pemisah kolomnya.
const kolomRevive = dash.slice(
  dash.indexOf("<VixText additionalStyle={styles.streakIcon}>📖</VixText>"),
  dash.indexOf('<View style={styles.streakDivider} />'),
);
// Komentar dibuang dulu — yang diuji TULISAN YANG TAMPIL di layar, bukan
// penjelasan di kodenya (penjelasannya justru menyebut kata "rekor" untuk
// menerangkan kenapa kata itu dibuang).
const tampilRevive = kolomRevive.replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
ok('kolom Revive ketemu', kolomRevive.length > 0);
// 4 Sep 2026: baris keterangannya DIHAPUS sama sekali — angkanya sudah
// berlabel "Revive", dan "hari streak" di bawahnya cuma mengulang.
ok('tak ada lagi baris keterangan di bawah angkanya',
  !/hari (beruntun|streak)/.test(tampilRevive));
ok('kata "rekor" tidak lagi tampil di kolom itu', !/rekor/.test(tampilRevive));
ok('angka besarnya tetap streak yang SEDANG berjalan (bukan rekor)',
  /\{revive\?\.count \?\? 0\}/.test(kolomRevive) && !/revive\?\.best/.test(kolomRevive));

// Kolom Habits di sebelahnya tak boleh ikut berubah — sekarang keduanya
// memang harus berbunyi sama.
const kolomHabits = dash.slice(
  dash.indexOf('<View style={styles.streakDivider} />'),
  dash.indexOf('</PressableScale>', dash.indexOf('<View style={styles.streakDivider} />')),
);
ok('kolom Habits ikut kehilangan baris keterangannya — keduanya seragam',
  !/hari (beruntun|streak)/.test(kolomHabits) &&
  /activeStreak\(habitStreak, todayId\)/.test(kolomHabits));

// ===================================================================
console.log('\n=== 2. Pil 🏆🔥 di Home tanpa angka ===');
const home = baca('app/(tabs)/index.tsx');
const pil = home.slice(
  home.indexOf('style={styles.streakPill}'),
  home.indexOf('onPress={logout}'),
);
// 22 Sep 2026: pil 🏆🔥 Home dibuang bersama launcher-nya; pintu umum ke
// Reward = tile "Reward" di tab Life (tanpa angka apa pun).
ok('pil 🏆🔥 sudah tidak ada di Today', !/🏆🔥/.test(home));
// 23 Sep 2026: lambangnya jadi piala (dulu bendera) & warnanya dipisah dari
// Games yang kembar; yang dijaga di sini tetap sama, tile-nya tanpa angka.
ok('tile Reward di Life tanpa angka apa pun',
  /label: 'Reward', icon: 'trophy\.fill', route: '\/reward'/.test(BACA_TODAY('lib/featureGrid.ts')) &&
  !/<Badge/.test(BACA_TODAY('app/(tabs)/life.tsx')));
ok('masih jadi pintasan ke halaman Reward',
  /route: '\/reward'/.test(BACA_TODAY('lib/featureGrid.ts')));
// Angkanya hilang dari pil, TAPI datanya masih dipakai gerbang doa pagi —
// jadi langganannya tidak boleh ikut dibuang.
ok('langganan streak doa pagi TIDAK ikut dibuang (hero With God & hangus 09.00 memakainya)',
  /subscribeLoginStreak\(uid, mark\('login', setLogin\), fail\)/.test(BACA_TODAY('hooks/useTodayData.ts')) &&
  /prayerDoneToday\(login, now\)/.test(BACA_TODAY('lib/today.ts')) &&
  /resetPrayerStreak\(user\.uid, login\)/.test(BACA_TODAY('hooks/useTodayData.ts')));

// ===================================================================
console.log('\n=== 3. Donor: syarat & tips di sebelah Jadwal Donor ===');
const donor = baca('app/donor.tsx');
const judulJadwal = donor.slice(
  donor.indexOf('📅 Jadwal Donor'),
  donor.indexOf('label="Tambah Jadwal"'),
);
ok('dua tombol lambang duduk di baris judul "Jadwal Donor"',
  /<EmojiButton emoji="✅" onPress=\{\(\) => setInfo\('syarat'\)\} \/>/.test(judulJadwal) &&
  /<EmojiButton emoji="💡" onPress=\{\(\) => setInfo\('tips'\)\} \/>/.test(judulJadwal));
ok('hanya lambang — tak ada tulisan "Syarat Donor"/"Tips Donor" di tombolnya',
  !/Syarat Donor/.test(judulJadwal) && !/Tips Donor/.test(judulJadwal));
ok('dropdown lama di KAKI layar sudah dibuang',
  !/setReqOpen/.test(donor) && !/setTipsOpen/.test(donor) &&
  !/infoHeader/.test(donor) && !/infoCard/.test(donor));
ok('isinya kini modal — satu modal untuk keduanya',
  /visible=\{info !== null\}/.test(donor) &&
  /title=\{info === 'tips' \? '💡 Tips Donor' : '✅ Syarat Donor'\}/.test(donor));
ok('isi syarat & tips tetap yang sama (tak ada yang hilang)',
  /\(info === 'tips' \? DONOR_TIPS : DONOR_REQUIREMENTS\)\.map/.test(donor));
ok('butir syarat tetap berbulir "•", tips tidak (tips sudah punya emoji)',
  /\{info === 'tips' \? t : `• \$\{t\}`\}/.test(donor));
ok('membuka yang satu otomatis menutup yang lain (satu state, bukan dua)',
  /useState<'syarat' \| 'tips' \| null>\(null\)/.test(donor));

// ===================================================================
console.log('\n=== 4. "Rentetan" → "Streak" di seluruh sumber ===');
const SEMUA = [];
for (const dir of ['app', 'components', 'lib', 'hooks', 'contexts', 'assets']) {
  (function sisir(rel) {
    for (const e of fs.readdirSync(path.join(ROOT, rel), { withFileTypes: true })) {
      const anak = `${rel}/${e.name}`;
      if (e.isDirectory()) sisir(anak);
      else if (/\.(ts|tsx)$/.test(e.name)) SEMUA.push(anak);
    }
  })(dir);
}
for (const f of ['AGENTS.md', 'CLAUDE.md', 'README.md', 'RELEASE.md', 'PEDOMAN-VERSI.md',
  '.claude/commands/rapihin.md']) {
  if (fs.existsSync(path.join(ROOT, f))) SEMUA.push(f);
}

const sisa = SEMUA.filter((f) => /rentetan/i.test(baca(f)));
ok('tak ada satu pun kata "Rentetan"/"rentetan" tersisa', sisa.length === 0, sisa.join(', '));
// Bunyi kalimatnya boleh diringkas pemiliknya (3 Sep 2026: "🔥 Streak sudah
// kembali ke 0." → "Streak kembali ke 0."). Yang dijaga: kata itu benar-benar
// dipakai DI TEKS TAMPILAN, bukan cuma di komentar kode.
// Bunyi kalimatnya memang boleh diringkas pemiliknya (6 Sep 2026:
// "Streak 🔥 kamu akan hangus jadi 0. Yakin…?" → "Streak 🔥 kamu akan dimulai
// dari awal"). Yang dijaga KATANYA, bukan kalimat contohnya.
ok('teks tampilan ikut berganti, bukan cuma komentar',
  /'[^']*Streak[^']*'/.test(baca('components/fitness/ExerciseTab.tsx')) &&
  // 21 Sep 2026: dialog lewati Morning Journey (lambangnya 🙏, streak doa pagi).
  /detail="[^"]*Streak 🙏 [^"]*"/.test(baca('components/spiritual/MorningJourney.tsx')));
// Aturannya dijaga di SELURUH sumber, bukan lewat satu kalimat contoh yang
// sewaktu-waktu boleh diganti: huruf besar hanya di awal kalimat/baris.
ok('huruf besar/kecilnya ikut konteks (awal kalimat "Streak", di tengah "streak")', (() => {
  const isi = SEMUA.map(baca).join('\n');
  // Dua-duanya harus benar-benar hidup di sumber: berhuruf besar saat membuka
  // kalimat/baris, dan berhuruf kecil saat menyambung kalimat. Bukan dipatok
  // ke satu kalimat contoh — kalimatnya boleh diganti kapan saja.
  const awal = /(^|[\n>'"`(]\s*|[.!?—]\s)🔥?\s?Streak\b/m.test(isi);
  const tengah = /\w[ ,—-] ?streak\b/.test(isi);
  return awal && tengah;
})());
ok('nama fungsi & tipe yang memang sudah "Streak" tidak rusak',
  /export function bumpStreak/.test(baca('lib/health.ts')) &&
  /export type Streak/.test(baca('lib/health.ts')));

console.log(gagal === 0
  ? '\n✅ LULUS — hari beruntun, pil tanpa angka, tombol donor, & Streak terbukti.'
  : `\n❌ ${gagal} cek gagal.`);
process.exit(gagal === 0 ? 0 : 1);
