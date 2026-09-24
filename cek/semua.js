// Jalankan SEMUA suite cek-*.js / bukti-*.js, lapor yang gagal saja.
//
//   npm run cek
//
// Suite-nya ada di folder yang SAMA dengan berkas ini, jadi tidak ada
// jalur absolut ke mana pun.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const DIR = __dirname;
const files = fs
  .readdirSync(DIR)
  .filter((f) => /^(cek|bukti)-.*\.js$/.test(f))
  .sort();

let lulus = 0;
const gagal = [];
for (const f of files) {
  try {
    execFileSync(process.execPath, [f], { cwd: DIR, stdio: 'pipe' });
    lulus++;
  } catch (e) {
    gagal.push([f, (e.stdout ? e.stdout.toString() : '') + (e.stderr ? e.stderr.toString() : '')]);
  }
}
// Baris yang menjelaskan KENAPA sebuah suite gagal. Penandanya tidak seragam:
// sebagian besar suite memakai ❌, tapi yang lebih tua memakai ✗ atau menulis
// "GAGAL" saja. Dulu filternya cuma mengenal ❌, jadi suite bergaya lama
// tampil sebagai blok KOSONG di laporan — terlihat seperti crash tanpa sebab,
// padahal alasannya tercetak rapi dan cuma tidak ikut tersaring.
const PENANDA = /❌|✗|✘|^GAGAL|\bgagal\b/;

for (const [f, out] of gagal) {
  console.log(`\n########## ${f}`);
  const baris = out.split('\n').filter((l) => PENANDA.test(l));
  // Betul-betul tidak mencetak apa pun (mis. meledak sebelum sempat) → jangan
  // diam: tampilkan ekor keluarannya supaya tetap ada yang bisa dibaca.
  console.log(baris.length ? baris.join('\n') : out.trim().split('\n').slice(-6).join('\n'));
}
console.log(`\nLULUS: ${lulus} / ${files.length}`);
process.exit(gagal.length === 0 ? 0 : 1);
