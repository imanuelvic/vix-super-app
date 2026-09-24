// Cek tanda ✓ "sudah selesai" di deretan hari Fitness + alamat rumah yang
// bisa dipencet ke Google Maps.
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

// ===== Logika asli, disalin dari lib/fitness.ts & lib/health.ts =====
const dayDocId = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
function weekStartId(d) {
  const s = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  s.setDate(s.getDate() - (s.getDay() === 0 ? 6 : s.getDay() - 1));
  return dayDocId(s);
}
function weekDayIds(d) {
  const [y, m, day] = weekStartId(d).split('-').map(Number);
  const start = new Date(y, m - 1, day);
  const ids = [];
  for (let i = 0; i < 7; i += 1) {
    const x = new Date(start);
    x.setDate(x.getDate() + i);
    ids.push(dayDocId(x));
  }
  return ids;
}
// fitDayComplete(day, weekday, block)
function fitDayComplete(day, latihan) {
  if (!day || day.skipped) return false;
  return latihan.length > 0 && latihan.every((e) => day.done[e]);
}
// Pemetaan pil hari → dayId minggu ini (Senin di indeks 0).
const weekIdOf = (ids, wd) => ids[(wd + 6) % 7];

console.log('\nPemetaan pil hari → tanggal minggu ini');
// Jumat 21 Agustus 2026. Senin minggu itu = 17 Agustus.
const jum = new Date(2026, 7, 21);
const ids = weekDayIds(jum);
ok('Senin di indeks 0 = 2026-08-17', ids[0] === '2026-08-17', ids[0]);
for (const [wd, tgl, nama] of [
  [1, '2026-08-17', 'Sen'],
  [2, '2026-08-18', 'Sel'],
  [3, '2026-08-19', 'Rab'],
  [4, '2026-08-20', 'Kam'],
  [5, '2026-08-21', 'Jum'],
  [6, '2026-08-22', 'Sab'],
  [0, '2026-08-23', 'Min'],
]) ok(`pil ${nama} → ${tgl}`, weekIdOf(ids, wd) === tgl, weekIdOf(ids, wd));
// Minggu (0) TIDAK boleh nyasar ke Minggu minggu lalu.
ok('pil Min menunjuk akhir minggu ini, bukan minggu lalu',
  weekIdOf(ids, 0) > weekIdOf(ids, 1));

console.log('\nKapan tandanya muncul');
const latihan = ['a', 'b', 'c'];
ok('semua gerakan tercentang → selesai ✓',
  fitDayComplete({ done: { a: 1, b: 1, c: 1 }, skipped: false }, latihan) === true);
ok('baru sebagian → belum',
  fitDayComplete({ done: { a: 1, b: 1 }, skipped: false }, latihan) === false);
ok('kosong → belum',
  fitDayComplete({ done: {}, skipped: false }, latihan) === false);
ok('hari yang DILEWATI ✕ tidak dianggap selesai',
  fitDayComplete({ done: { a: 1, b: 1, c: 1 }, skipped: true }, latihan) === false);
ok('hari yang belum ada datanya (belum dibuka) → belum',
  fitDayComplete(undefined, latihan) === false);
ok('sesi tanpa gerakan tidak dianggap "selesai" gratisan',
  fitDayComplete({ done: {}, skipped: false }, []) === false);

console.log('\nTidak kereset tiap malam, tapi ikut ganti tiap Senin');
// Hari Kamis diselesaikan; masih Jumat → tandanya harus tetap ada.
const kam = '2026-08-20';
const dataMinggu = { [kam]: { done: { a: 1, b: 1, c: 1 }, skipped: false } };
ok('Kamis beres, dilihat hari Jumat → tandanya masih ada',
  fitDayComplete(dataMinggu[weekIdOf(ids, 4)], latihan) === true);
// Senin berikutnya (24 Agu): deret tanggalnya berganti → tak ada yang cocok.
const senBaru = new Date(2026, 7, 24);
const idsBaru = weekDayIds(senBaru);
ok('Senin baru → deret tanggal berganti', idsBaru[0] === '2026-08-24');
ok('tanda minggu lalu tidak ikut terbawa',
  idsBaru.every((id) => !(id in dataMinggu)));
ok('semua tanggal minggu lama memang beda dari minggu baru',
  ids.every((id) => !idsBaru.includes(id)));

console.log('\nHemat baca: hari depan tidak ikut diambil');
const hariIni = dayDocId(jum);
const diambil = ids.filter((id) => id <= hariIni);
ok('Jumat → ambil 5 dokumen (Sen–Jum), bukan 7', diambil.length === 5, `${diambil.length}`);
ok('Sabtu & Minggu tidak ikut dibaca',
  !diambil.includes('2026-08-22') && !diambil.includes('2026-08-23'));
ok('Minggu (hari terakhir) → 7 dokumen',
  weekDayIds(new Date(2026, 7, 23)).filter((id) => id <= '2026-08-23').length === 7);

// ===== Kode sungguhan =====
console.log('\nKode — Fitness');
const gym = baca('components/fitness/ExerciseTab.tsx');
const fit = baca('lib/fitness.ts');
ok('fitDayComplete ada di lib (bukan logika tempelan di layar)',
  /export function fitDayComplete/.test(fit));
ok('hari yang dilewati ✕ dikecualikan di lib', /if \(!day \|\| day\.skipped\) return false;/.test(fit));
ok('fetchFitDays sekali baca untuk seminggu', /export async function fetchFitDays/.test(fit));
ok('layar cuma mengambil hari yang sudah lewat/berjalan',
  /weekDayIds\(new Date\(\)\)\.filter\(\(id\) => id <= dayId\)/.test(gym));
ok('HARI INI dibaca dari data live, bukan hasil ambilan (langsung muncul ✓)',
  /const id = weekIdOf\(wd\);/.test(gym) &&
    /const catatan = wd === todayWeekday \? day : weekDays\[id\];/.test(gym) &&
    // Kelar/belum kini ditanyakan pada TANGGALNYA — pilihanmu tersimpan di
    // dokumen hari itu, jadi (weekday, block) tak lagi jadi jawabannya.
    /const selesai = fitDayComplete\(catatan, tanggal\);/.test(gym));
ok('hari lain dari hasil ambilan seminggu',
  /weekDays\[id\]/.test(gym) && /const id = weekIdOf\(wd\);/.test(gym));
// Warna keadaan hari (6 Sep): abu-abu = tidak tuntas, merah = tidak ada
// olahraganya sama sekali. HARI INI sengaja tidak ikut dinilai selama
// sesinya masih berjalan — kecuali kalau memang sengaja dilewati ❌.
ok('hari lampau yang bolong → abu-abu',
  /const bolong = !kosong && lampau && !selesai;/.test(gym) &&
    /bolong && !active && styles\.dayPillMissed/.test(gym));
ok('dilewati / tanpa satu centang pun → merah',
  /const kosong = \(catatan\?\.skipped \?\? false\) \|\| \(lampau && tercentang === 0\);/.test(gym) &&
    /kosong && !active && styles\.dayPillSkipped/.test(gym));
ok('HARI INI belum dinilai selama sesinya masih berjalan',
  /const lampau = weekLoaded && id < dayId;/.test(gym));
ok('tidak berkedip merah sebelum ambilan semingguannya sampai',
  /const weekLoaded = Object\.keys\(weekDays\)\.length > 0;/.test(gym));
ok('abu-abunya memakai warna DISABLED, merahnya warna DANGER',
  /dayPillMissed: \{[\s\S]{0,120}Color\.DISABLED/.test(gym) &&
    /dayPillSkipped: \{[\s\S]{0,120}Color\.DANGER/.test(gym));
ok('pemetaan pil → tanggal: Senin indeks 0', /weekIds\[\(wd \+ 6\) % 7\]/.test(gym));
ok('tanda ✓ dirender', /styles\.dayDoneBadge/.test(gym) && /dayDoneMark/.test(gym));
ok('warna tandanya hijau SUCCESS', /backgroundColor:\s*Color\.SUCCESS/.test(gym));
ok('tanda ditaruh di DALAM batas pil (tak terpotong ScrollView)',
  /dayDoneBadge:\s*\{[^}]*top:\s*4[^}]*right:\s*4/.test(gym));
ok('titik penanda "hari ini" tetap ada', /wd === todayWeekday && <View style=\{styles\.todayDot\}/.test(gym));
ok('pil hari yang sedang dibuka tetap paling menonjol',
  /selesai && !active && styles\.dayPillDone/.test(gym));
ok('permintaan lama dibatalkan kalau layar ditutup (tak setState di komponen mati)',
  /let alive = true;/.test(gym) && /alive = false;/.test(gym));

console.log('\nKode — Alamat rumah');
const info = baca('components/residence/InfoTab.tsx');
const res = baca('lib/residence.ts');
ok('tautan Maps disimpan di lib/residence.ts',
  /mapsUrl: 'https:\/\/maps\.app\.goo\.gl\/MgQ9DhWZw4bU2SrH7'/.test(res));
ok('kartu alamat jadi bisa ditekan',
  /<PressableScale style=\{styles\.addressCard\} onPress=\{openMaps\}>/.test(info));
ok('membukanya lewat pintu bersama openExternalUrl (tidak duplikat)',
  /openExternalUrl\(RESIDENCE_INFO\.mapsUrl\)/.test(info) &&
  /from '@\/lib\/linking'/.test(info));
// Penandanya kini GARIS TEPI berwarna tile Residence, bukan baris ajakan.
ok('baris "Buka di Google Maps" sudah dibuang',
  !/Buka di Google Maps/.test(info) && !/addressLink/.test(info));
ok('penandanya garis tepi warna tile Residence di Home (HOUSE_DARK)',
  /addressCard: \{[\s\S]{0,400}?borderColor: Color\.HOUSE_DARK/.test(info));
ok('kartu lain di layar ini tetap bergaris tepi BORDER polos',
  /detailCard: \{[\s\S]{0,200}?borderColor: Color\.BORDER/.test(info) &&
  /tipsCard: \{[\s\S]{0,200}?borderColor: Color\.BORDER/.test(info));
ok('alamat tulisannya tidak diubah',
  /Jl\. Casa Cluster Gladiola Blok G5 No\.6/.test(res));

console.log(gagal === 0 ? '\n✅ LULUS — tanda ✓ per hari benar, alamat bisa dipencet.'
  : `\n❌ ${gagal} cek gagal.`);
process.exit(gagal === 0 ? 0 : 1);
