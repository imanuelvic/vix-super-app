// Batch /rapihin: pola "isi form sekali saat datanya menyusul" (bendera
// `loaded` + satu efek besar) diganti hooks/useDraft.ts.
//
// Hook-nya BENAR-BENAR DIJALANKAN lewat tiruan kecil runtime React.
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const Module = require('module');

const ROOT = AKAR;
const OUT = path.join(__dirname, 'keluar-draft');
const baca = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

let gagal = 0;
function ok(nama, syarat, info = '') {
  if (syarat) console.log(`  ✅ ${nama}`);
  else { gagal++; console.log(`  ❌ ${nama}${info ? ` — ${info}` : ''}`); }
}

// ============ Tiruan runtime React ============
const H = { states: [], memo: [], iState: 0, iMemo: 0 };
function useState(init) {
  const idx = H.iState++;
  if (!(idx in H.states)) H.states[idx] = typeof init === 'function' ? init() : init;
  return [H.states[idx], (v) => {
    H.states[idx] = typeof v === 'function' ? v(H.states[idx]) : v;
  }];
}
function useCallback(fn, deps) {
  const idx = H.iMemo++;
  const lama = H.memo[idx];
  const berubah = !lama || deps.some((d, k) => !Object.is(d, lama.deps[k]));
  if (berubah) H.memo[idx] = { fn, deps };
  return H.memo[idx].fn;
}
function render(fn, ...args) {
  H.iState = 0; H.iMemo = 0;
  return fn(...args);
}
function pasangBaru() { H.states = []; H.memo = []; }

// ============ Kompilasi & pasang hook aslinya ============
try {
  execFileSync(
    'npx',
    ['tsc', path.join(ROOT, 'hooks/useDraft.ts'), '--ignoreConfig', '--outDir', OUT,
      '--module', 'commonjs', '--target', 'es2020', '--skipLibCheck',
      '--esModuleInterop', '--moduleResolution', 'bundler'],
    { cwd: ROOT, stdio: 'pipe', shell: true },
  );
} catch { /* keluhan tipe tak menghalangi tsc membuat JS-nya */ }
if (!fs.existsSync(path.join(OUT, 'useDraft.js'))) {
  console.log('  ❌ gagal mengompilasi hooks/useDraft.ts');
  process.exit(1);
}
const asli = Module._load;
Module._load = function (req, parent, isMain) {
  if (req === 'react') return { useState, useCallback };
  return asli(req, parent, isMain);
};
const { useDraft } = require(path.join(OUT, 'useDraft.js'));
Module._load = asli;

// ===================================================================
console.log('\n=== Data yang menyusul dari Firestore ===');
pasangBaru();
let [nilai, set] = render(useDraft, ''); // snapshot belum sampai
ok('sebelum datanya sampai, kolomnya kosong', nilai === '', JSON.stringify(nilai));

// Snapshot pertama datang → sumbernya berubah.
[nilai, set] = render(useDraft, 'Puasa Daniel');
ok('begitu datanya sampai, kolom langsung terisi DI RENDER YANG SAMA — ' +
   'tak ada render kosong yang menyelip',
  nilai === 'Puasa Daniel', JSON.stringify(nilai));

console.log('\n=== Sekali diketik, ketikan yang menang ===');
set('Puasa Ester');
[nilai, set] = render(useDraft, 'Puasa Daniel');
ok('yang tampil ketikannya', nilai === 'Puasa Ester', JSON.stringify(nilai));

// Snapshot berikutnya datang selagi mengetik (mis. tersimpan dari HP lain).
[nilai, set] = render(useDraft, 'Puasa Yesaya');
ok('snapshot berikutnya TIDAK menimpa ketikan — inilah yang dulu dijaga ' +
   'bendera `loaded`',
  nilai === 'Puasa Ester', JSON.stringify(nilai));

console.log('\n=== Dikosongkan sendiri oleh user ===');
set('');
[nilai, set] = render(useDraft, 'Puasa Yesaya');
ok('kolom yang SENGAJA dikosongkan tetap kosong (tidak balik ke data lama)',
  nilai === '', JSON.stringify(nilai));

console.log('\n=== Bentuk lain: angka, tanggal, daftar ===');
pasangBaru();
const t1 = new Date(2026, 7, 24);
const t2 = new Date(2026, 8, 1);
let [tgl, setTgl] = render(useDraft, t1);
ok('tanggal ikut data', tgl === t1);
setTgl(t2);
[tgl, setTgl] = render(useDraft, t1);
ok('tanggal yang dipilih user menang', tgl === t2);

pasangBaru();
let [daftar, setDaftar] = render(useDraft, ['Galatia 4']);
ok('daftar acuan ikut data', daftar.join() === 'Galatia 4');
// bible-reading memakai bentuk fungsi: setRefs((list) => …)
setDaftar((list) => [...list, 'Roma 8']);
[daftar, setDaftar] = render(useDraft, ['Galatia 4']);
ok('bentuk fungsi (setRefs((list) => …)) ikut didukung',
  daftar.join(' | ') === 'Galatia 4 | Roma 8', daftar.join(' | '));
setDaftar((list) => list.filter((r) => r !== 'Galatia 4'));
[daftar] = render(useDraft, ['Galatia 4']);
ok('menghapus satu baris juga jalan', daftar.join() === 'Roma 8', daftar.join());

console.log('\n=== null & undefined tetap bisa jadi isi yang sah ===');
pasangBaru();
let [pilihan, setPilihan] = render(useDraft, 'ada');
setPilihan(null);
[pilihan] = render(useDraft, 'ada');
ok('memilih null dihormati, bukan dianggap "belum pernah diketik"',
  pilihan === null, JSON.stringify(pilihan));

console.log('\n=== Hook-nya sendiri ===');
const hook = baca('hooks/useDraft.ts');
const kodeSaja = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
// Dari KODENYA saja — penjelas di atasnya memang mengutip pola lama yang
// memakai useEffect, supaya jelas apa yang digantikan.
ok('tidak memakai useEffect sama sekali — tak ada setState di badan efek',
  !/useEffect/.test(kodeSaja(hook)));
ok('bentuk pemakaiannya sama seperti useState ([nilai, set])',
  /\[T, \(next: T \| \(\(current: T\) => T\)\) => void\]/.test(hook));

// ===================================================================
console.log('\n=== Layar yang dulu memakai bendera `loaded` ===');
const puasa = baca('app/fasting.tsx');
const revive = baca('app/revive.tsx');
const baca_ = baca('app/bible-reading.tsx');

ok('Puasa: bendera `loaded` & efek prefill-nya hilang',
  !/loaded/.test(kodeSaja(puasa)) && !/setTitle\(plan\.title\)/.test(puasa));
ok('Puasa: keenam kolomnya kini ikut data lewat useDraft',
  (puasa.match(/useDraft\(/g) ?? []).length === 6 &&
  /useDraft\(plan\?\.title \?\? ''\)/.test(puasa));
ok('Puasa: tanggal mulai/selesai ikut yang tersimpan',
  /useDraft\(\s*\n\s*plan\?\.startId \? dayIdToDate\(plan\.startId\) : today,/.test(puasa) &&
  /useDraft\(\s*\n\s*plan\?\.endId \? dayIdToDate\(plan\.endId\) : today,/.test(puasa));
ok('Puasa: simpan & hapus tidak berubah',
  /await saveFastingPlan\(user\.uid, id, \{/.test(puasa) &&
  /await deleteFastingPlan\(user\.uid, planId\)/.test(puasa));
ok('Puasa: validasinya tetap',
  /Isi nama puasanya dulu\./.test(puasa) &&
  /Tanggal selesai tidak boleh sebelum tanggal mulai\./.test(puasa));

ok('Revive: bendera `loaded` hilang, `exists` diturunkan dari datanya',
  !/loaded/.test(kodeSaja(revive)) && /const exists = entry !== null;/.test(revive));
ok('Revive: empat kolom yang bisa diketik pakai useDraft',
  (revive.match(/useDraft\(/g) ?? []).length === 4);
ok('Revive: tanggal & kolom lama `verse` cukup diturunkan (memang tak bisa diubah)',
  /const editingDate = entry \? entry\.date\.toDate\(\) : openedAt;/.test(revive) &&
  /const fVerse = entry\?\.verse \?\? '';/.test(revive));
ok('Revive: `verse` lama TETAP ikut tersimpan (catatan lama tidak rusak)',
  /verse: fVerse\.trim\(\)/.test(revive));
ok('Revive: layar loading-nya tetap ada, kini menunggu daftarnya sampai',
  /\{entries === null \? \(\s*\n\s*<LoadingCenter \/>/.test(revive));
ok('Revive: streak & validasi isian tidak berubah',
  /bumpReviveStreak\(user\.uid, streak, todayId\)/.test(revive) &&
  /Tulis rhema-nya/.test(revive));

ok('Bacaan Alkitab: efek pengisi acuan hilang',
  !/setRefs\(existing\.split/.test(baca_));
// Sumbernya kini dua: catatan hari ini kalau ada, kalau tidak rekomendasi
// sambungan bacaan terakhir (lihat cek-saran-bacaan.js). Yang tersimpan tetap
// MENANG — membuka layar untuk menambah kitab kedua tidak boleh ditimpa saran.
ok('Bacaan Alkitab: acuan tersimpan menang; belum dicatat → sarannya',
  /useDraft<string\[\]>\(\s*\n\s*tercatat\s*\n\s*\? existing\.split\(','\)\.map\(\(s\) => s\.trim\(\)\)\s*\n\s*: \[saran\?\.next \?\? ''\],/.test(baca_) &&
  /const tercatat = !!existing && !skipped;/.test(baca_));
// Tambah/hapus barisnya pindah ke komponen bersama; yang tinggal di layar
// cuma penampung draftnya — dan itu memang yang diuji di sini.
ok('Bacaan Alkitab: tambah/hapus baris acuan tetap jalan',
  /<BibleRefList\s*\n\s*refs=\{refs\}\s*\n\s*onChange=\{setRefs\}/.test(baca_) &&
  /onChange\(\[\.\.\.refs, ''\]\)/.test(
    baca('components/spiritual/BibleRefList.tsx'),
  ) &&
  /onChange\(refs\.filter\(\(_, x\) => x !== i\)\)/.test(
    baca('components/spiritual/BibleRefList.tsx'),
  ));

console.log('\n=== Kolom acuan Alkitab: satu sumber kebenaran ===');
const field = baca('components/common/BibleRefField.tsx');
ok('empat state salinan & efek penyamanya sudah tidak ada',
  !/useState\(parsed\./.test(field) && !/useEffect/.test(field) &&
  !/setBook|setChapter|setVerseFrom|setVerseTo/.test(field));
ok('bagiannya diturunkan dari `value` yang dioper induknya',
  /const \{ book, chapter, verseFrom, verseTo \} = useMemo\(\s*\n\s*\(\) => parseBibleRef\(value\),/.test(field));
ok('tiap perubahan tetap dikirim ke atas lewat onChange',
  /onChange\(bibleRefText\(b, c, f, t\)\)/.test(field) &&
  (field.match(/emit\(\{/g) ?? []).length === 4);
ok('penyaring "angka saja" di kolom pasal & ayat tetap ada',
  (field.match(/v\.replace\(\/\\D\/g, ''\)/g) ?? []).length === 3);
ok('aturan kolom mati tetap sama (pasal perlu kitab, ayat perlu pasal)',
  /editable=\{editable && !!book\}/.test(field) &&
  /editable=\{editable && !!chapter\}/.test(field) &&
  /editable=\{editable && !!verseFrom\}/.test(field));
ok('pemilih 66 kitab & pencariannya tidak disentuh',
  /📖 Pilih Kitab/.test(field) && /BIBLE_BOOKS\.filter/.test(field));

console.log(gagal === 0
  ? '\n✅ LULUS — isian menyusul datanya, tanpa bendera & tanpa efek.'
  : `\n❌ ${gagal} cek gagal.`);
process.exit(gagal === 0 ? 0 : 1);
