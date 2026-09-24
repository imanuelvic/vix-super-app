// 11 Sep 2026 — "rangkuman mingguan Learning: di-click, muncul modal sendiri
// yang cukup besar untuk diisi, seperti daily reflection journal."
//
// Polanya SUDAH ada (HabitNote di HabitsTab). Jadi yang dikerjakan bukan
// menyalinnya untuk kedua kalinya, melainkan memindahkannya ke
// components/common/NoteField.tsx lalu dipakai dua-duanya.
//
// Dua hal yang dijaga suite ini:
//   1. Aturan simpannya benar — DIJALANKAN dari sumbernya, bukan dicocokkan
//      hurufnya.
//   2. Tampilan Habits TIDAK bergeser sedikit pun. Ini yang paling mudah
//      rusak diam-diam saat komponen dipindah: satu angka gaya yang tidak
//      ikut pindah sudah cukup menggeser seluruh daftar kebiasaan.
const AKAR = require('./akar');
const fs = require('fs');

const R = AKAR + '/';
const baca = (f) => fs.readFileSync(R + f, 'utf8');

let ok = true;
const c = (n, s, extra) => {
  if (!s) ok = false;
  console.log((s ? '  ✓ ' : '  ✗ ') + n + (extra ? `  → ${extra}` : ''));
};

const nf = baca('components/common/NoteField.tsx');
const habits = baca('components/habits/HabitsTab.tsx');
const week = baca('components/learning/WeekTab.tsx');

// =====================================================================
console.log('=== 1. Satu komponen, dipakai dua-duanya ===');
// =====================================================================
{
  c('NoteField ada di components/common', /export function NoteField\(/.test(nf));

  // Yang berdiri di daftar TOMBOL, bukan kolom isian — inti permintaannya.
  c('yang di daftar tombol (PressableScale), bukan kolom',
    /<PressableScale\s*\n\s*style=\{\[styles\.noteBox, boxStyle\]\}/.test(nf));
  c('di-click → sheet terbuka', /onPress=\{\(\) => \{[\s\S]{0,200}setOpen\(true\);/.test(nf));
  c('kolom isiannya lega (180) & menulis dari atas',
    /noteSheetInput: \{ minHeight: 180, textAlignVertical: 'top' \}/.test(nf));
  c('punya Batal/Simpan yang menempel di bawah sheet',
    /footer=\{\s*\n\s*<DualButtons/.test(nf));

  // Tak ada salinan kedua yang tertinggal.
  c('HabitsTab tidak lagi memegang komponennya sendiri',
    !/function HabitNote\(/.test(habits) &&
      /<NoteField/.test(habits) &&
      /from '@\/components\/common\/NoteField'/.test(habits));
  c('WeekTab tidak lagi memegang komponennya sendiri',
    !/function NoteBox\(/.test(week) &&
      /<NoteField/.test(week) &&
      /from '@\/components\/common\/NoteField'/.test(week));

  // Sisa-sisa yang gampang tertinggal saat memindahkan komponen.
  c('WeekTab tak lagi mengimpor FormInput (cuma NoteBox yang memakainya)',
    !/FormInput/.test(week));
  c('gaya kolom lama di WeekTab ikut hilang', !/noteInput/.test(week));
  c('helper baris catatan ikut pindah, tak nyangkut di HabitsTab',
    !/splitNoteLines|joinNoteLines|filledNoteLines/.test(habits) &&
      /splitNoteLines|joinNoteLines|filledNoteLines/.test(nf));
}

// =====================================================================
console.log('\n=== 2. Aturan simpannya, dijalankan dari sumbernya ===');
// =====================================================================
{
  // 14 Sep 2026: isinya dihitung sekali sebagai \`draf\` (dipakai juga oleh
  // tombol 📋/✨), dan simpan() memakainya. Percabangan yang diuji tetap sama.
  const m = nf.match(/const draf = (.+);[\s\S]{0,200}?if \(draf !== value\) onSave\(draf\);/);
  c('aturan simpan terbaca dari sumbernya', !!m, m?.[1]);
  if (m) {
    // Dijalankan dengan join palsu, jadi yang diuji PERCABANGANNYA — bukan
    // isi joinNoteLines (itu urusan lib/habits.ts).
    const simpan = new Function(
      'berpoin', 'poin', 'text', 'value', 'joinNoteLines',
      `const tersimpan = []; const onSave = (v) => tersimpan.push(v);
       const isi = ${m[1]};
       if (isi !== value) onSave(isi);
       return tersimpan;`,
    );
    const join = (p) => p.filter(Boolean).join('|');

    c('paragraf bebas: spasi di ujung dibuang sebelum disimpan',
      simpan(false, [], '  halo  ', '', join)[0] === 'halo');
    c('tidak berubah → TIDAK menulis ke Firestore sama sekali',
      simpan(false, [], 'halo', 'halo', join).length === 0);
    c('dikosongkan → tetap tersimpan (centangnya memang harus lepas)',
      simpan(false, [], '   ', 'halo', join)[0] === '');
    c('mode poin: yang dirangkai poinnya, bukan kolom paragraf',
      simpan(true, ['a', 'b'], 'JANGAN DIPAKAI', '', join)[0] === 'a|b');
    c('mode poin yang tak berubah juga tidak menulis',
      simpan(true, ['a', 'b'], '', 'a|b', join).length === 0);
  }

  // Kolomnya selalu dimulai dari yang TERSIMPAN, bukan dari ketikan yang
  // ditinggalkan sesi sebelumnya — kalau tidak, membatalkan lalu membuka lagi
  // akan menampilkan teks yang sebenarnya tidak pernah disimpan.
  c('sheet selalu dimulai dari nilai tersimpan',
    /setText\(value\);\s*\n\s*setPoin\(splitNoteLines\(value, Math\.max\(lines, 1\)\)\);\s*\n\s*setOpen\(true\);/.test(nf));
  c('Batal menutup tanpa menyimpan apa pun',
    /onCancel=\{\(\) => setOpen\(false\)\}/.test(nf));
}

// =====================================================================
console.log('\n=== 3. Habits tidak bergeser sedikit pun ===');
// =====================================================================
{
  // Keenam angka gaya kotak pratinjau harus pindah UTUH. Kalau salah satu
  // tertinggal, seluruh daftar kebiasaan bergeser — dan tidak ada yang
  // menyadarinya sampai dibuka di HP.
  c('kotak pratinjau memakai bentuk kartu daftar (CARD)', /\.\.\.CARD,/.test(nf));
  for (const [apa, pola] of [
    ['tinggi minimum 64', /minHeight: 64,/],
    ['jarak atas -2', /marginTop: -2,/],
    ['jarak bawah 8', /marginBottom: 8,/],
    ['isinya berbaris', /flexDirection: 'row',/],
    ['rata atas', /alignItems: 'flex-start',/],
    ['jarak isi 8', /gap: 8,/],
  ]) {
    c(`gaya kotak pratinjau ikut pindah: ${apa}`, pola.test(nf));
  }

  // Habits TIDAK mengoper boxStyle → ia memakai bawaan di atas, persis
  // seperti sebelum dipindah.
  // Batasnya longgar (1200) karena blok JSX-nya berkomentar & indentasinya
  // dalam. Tidak membuat cek-nya kabur: `?` tetap berhenti di `/>` PERTAMA.
  const pakaiHabits = habits.match(/<NoteField[\s\S]{0,1200}?\/>/);
  c('Habits memakai bawaannya (tidak menimpa tinggi kotaknya)',
    !!pakaiHabits && !/boxStyle/.test(pakaiHabits[0]));
  c('Habits tetap judul "📓 Today Note"',
    !!pakaiHabits && /title="📓 Today Note"/.test(pakaiHabits[0]));
  // "🙏 Bersyukur 3 Hal" minta TIGA poin — bentuk itu tidak boleh hilang
  // gara-gara komponennya dipindah.
  c('Habits tetap bisa minta poin bernomor',
    !!pakaiHabits && /lines=\{habitNoteLines\(habit\)\}/.test(pakaiHabits[0]));
  c('bentuk poin bernomor memang masih ada di NoteField',
    /placeholder=\{`Hal ke-\$\{i \+ 1\}`\}/.test(nf));
}

// =====================================================================
console.log('\n=== 4. Learning: kolomnya jadi modal, langkahnya tetap ===');
// =====================================================================
{
  const pakai = week.match(/<NoteField[\s\S]{0,1200}?\/>/);
  c('rangkuman mingguan memakai NoteField', !!pakai);
  if (pakai) {
    c('judul sheet-nya menyebut rangkuman minggu ini',
      /title="✍️ This Week Recap"/.test(pakai[0]));
    // Sheet menutupi kartu langkah di belakangnya, jadi topiknya harus ikut
    // masuk — dan aba-abanya diambil dari LEARNING_STEPS, bukan ditulis ulang.
    c('topik & aba-abanya ikut dibawa masuk ke sheet',
      /subtitle=\{`\$\{skill\.title\} - \$\{s\.how\}`\}/.test(pakai[0]));
    // Paragraf bebas, BUKAN tiga kolom terkunci: rangkuman boleh lebih/kurang
    // dari tiga poin, dan contohnya tetap tampil di kolom kosong.
    c('isinya paragraf bebas, bukan tiga kolom terkunci',
      !/lines=/.test(pakai[0]));
    c('contoh 3 poin tetap jadi ajakan di kotak kosong',
      /placeholder=\{'1\. …/.test(pakai[0]));
    c('tinggi kotaknya disamakan dengan kolom lama (88)',
      /boxStyle=\{styles\.noteBox\}/.test(pakai[0]) &&
        /noteBox: \{ minHeight: 88 \}/.test(week));
  }

  // Centang langkah "Rangkum" tetap ditentukan isi rangkumannya — pintunya
  // berubah, aturannya tidak.
  c('menyimpan tetap ikut mencentang/melepas langkah "Rangkum"',
    /await setLearningNote\(user\.uid, weekId, text\);\s*\n\s*await applyStep\(NOTE_DRIVEN_STEP, learningNoteDone\(text\)\);/.test(week));
  // Dulu disimpan saat kolomnya ditinggalkan (onBlur). Sekarang ada tombol
  // Simpan, jadi simpan-diam-diam itu HARUS hilang — kalau tidak, satu
  // ketikan bisa tersimpan dua kali lewat dua jalan berbeda.
  c('tak ada lagi simpan diam-diam saat kolom ditinggalkan (onBlur)',
    !/onBlur/.test(week));
}

console.log(ok ? '\nLULUS' : '\nGAGAL');
process.exit(ok ? 0 : 1);
