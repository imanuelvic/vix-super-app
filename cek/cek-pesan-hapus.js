// Tombol hapus yang GAGAL harus bilang "Gagal menghapus", bukan "Gagal
// menyimpan".
//
// Tiga layar dulu memakai SAVE_ERROR di dalam handleDelete-nya — jadi saat
// penghapusan gagal, yang terbaca "Gagal menyimpan. Coba lagi." Bukan cuma
// salah kata: kalimat itu menunjuk ke perbuatan yang tidak sedang kamu lakukan,
// jadi kamu mengira isian yang tidak tersimpan padahal barangnya yang tidak
// terhapus.
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');

const R = AKAR + '/';
const baca = (f) => fs.readFileSync(R + f, 'utf8');

let ok = true;
const c = (n, s, extra) => {
  if (!s) ok = false;
  console.log((s ? '  ✓ ' : '  ✗ ') + n + (extra !== undefined ? `  → ${extra}` : ''));
};

const cari = (d, ext) =>
  fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(d, e.name);
    if (e.isDirectory()) return cari(p, ext);
    return ext.some((x) => e.name.endsWith(x)) ? [p] : [];
  });
const rel = (p) => p.replace(/\\/g, '/').replace(R, '');

const berkas = [...cari(R + 'app', ['.tsx']), ...cari(R + 'components', ['.tsx'])];

// Semua badan fungsi hapus di seluruh app.
const hapus = [];
for (const p of berkas) {
  const src = fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
  for (const m of src.matchAll(/async function (?:handleDelete|hapus)\(\) \{\n([\s\S]*?)\n  \}\n/g)) {
    hapus.push({ file: rel(p), isi: m[1] });
  }
}

console.log('\n== Pesan gagal di tombol hapus ==');
c('tombol hapusnya memang tersebar di banyak layar (bukan tesnya yang buta)',
  hapus.length >= 25, `${hapus.length} tombol`);

const salahPesan = hapus.filter((h) => /SAVE_ERROR|saveErrorOf/.test(h.isi));
c('tak ada yang bilang "Gagal menyimpan" saat MENGHAPUS',
  salahPesan.length === 0, salahPesan.map((h) => h.file).join(' · '));

const bicara = hapus.filter((h) => /set\w*Error\(/.test(h.isi));
c('yang memberi pesan, semuanya memakai pesan hapus bersama',
  bicara.every((h) => /DELETE_ERROR|deleteErrorOf/.test(h.isi)),
  `${bicara.length} dari ${hapus.length} tombol memberi pesan`);

// Yang lewat hook bersama juga kena jebakan yang sama: `save()` memasang
// SAVE_ERROR, jadi tombol hapus yang memakainya berkata "Gagal menyimpan".
// Karena itu hooknya punya `remove()` — isinya sama persis, pesannya saja beda.
const hook = baca('hooks/useFormSave.ts');
c('useFormSave punya remove() berpesan DELETE_ERROR',
  /const remove = \(task: \(\) => Promise<void>\) => jalankan\(task, DELETE_ERROR\);/.test(hook) &&
  /const save = \(task: \(\) => Promise<void>\) => jalankan\(task, SAVE_ERROR\);/.test(hook));
// Dihitung dari KODENYA saja — contoh pemakaian di komentar atasnya juga
// memuat `finally`, dan itu bukan jalur kedua.
const hookKode = hook.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
c('keduanya berbagi SATU jalur (busy & finally-nya mustahil beda)',
  (hookKode.match(/async function jalankan\(/g) ?? []).length === 1 &&
  (hookKode.match(/finally \{/g) ?? []).length === 1);
c('tombol hapus yang lewat hook memakai remove(), bukan save()',
  hapus
    .filter((h) => /await (save|remove)\(/.test(h.isi))
    .every((h) => /await remove\(/.test(h.isi)),
  hapus.filter((h) => /await save\(/.test(h.isi)).map((h) => h.file).join(' · '));

// Pesannya tetap dari lib/messages.ts, bukan kalimat yang dikarang per layar.
c('kalimatnya satu sumber, tidak dikarang ulang di layarnya',
  /DELETE_ERROR = 'Gagal menghapus\. Coba lagi\.'/.test(baca('lib/messages.ts')) &&
  !hapus.some((h) => /set\w*Error\('/.test(h.isi)));

// Catatan untuk yang membaca berikutnya: TIGA perilaku berbeda masih hidup
// berdampingan di sini (lihat scratchpad/survei-hapus.js) — ada yang menahan
// sheet-nya terbuka saat gagal, ada yang tetap menutup, dan ada yang diam
// sama sekali. Menyatukannya = mengubah perilaku, jadi bukan urusan tes ini.
const diam = hapus.filter(
  (h) => !/\} catch \{/.test(h.isi) && !/await (save|remove)\(/.test(h.isi),
);
console.log(`\n  ℹ️  ${diam.length} tombol hapus masih diam total saat gagal ` +
  '(belum diputuskan pemiliknya):');
diam.forEach((h) => console.log('       · ' + h.file));

console.log(ok ? '\nLULUS' : '\nGAGAL');
process.exit(ok ? 0 : 1);