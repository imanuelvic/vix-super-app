// 15 Sep 2026 sore: (1) Home — udara di bawah kartu sapaan = udara di
// atasnya; (2) Baca Alkitab — hitung mundur → Reminder → tombol YouVersion →
// kartu Bacaan berjarak sama & lebih lega, satu angka bersama (INTRO_GAP).
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');

const ROOT = AKAR;
const baca = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');

let gagal = 0;
function ok(nama, syarat, info = '') {
  if (syarat) console.log(`  ✅ ${nama}`);
  else { gagal++; console.log(`  ❌ ${nama}${info ? ` — ${info}` : ''}`); }
}

const home = baca('app/(tabs)/index.tsx');
const alkitab = baca('app/bible-reading.tsx');
const intro = baca('components/spiritual/SpiritualIntro.tsx');
const teks = baca('components/common/VixText.tsx');

console.log('\n=== Today: tumpukan blok bernapas sama (22 Sep 2026) ===');
// Kartu sapaan + grid Home sudah diganti Today: hero With God, blok prioritas,
// bagian CORE/Work/Life, refleksi — semuanya berjarak SATU angka lewat gap
// kolom (CARD_GAP + 2), bukan margin per kartu yang bisa beda-beda lagi.
ok('kolom Today memakai gap CARD_GAP + 2 (bukan margin lepas per kartu)',
  /contentInner: \{[^}]*gap: CARD_GAP \+ 2/.test(home) && /sections: \{ gap: CARD_GAP \+ 2 \}/.test(home) &&
  !/marginBottom: 10 \}/.test(home));
ok('grid fitur pindah ke Life dengan jarak barisnya sendiri', /rowGap: 14,/.test(baca('app/(tabs)/life.tsx')));

console.log('\n=== Baca Alkitab: tumpukan pembuka berjarak sama & lega ===');
const nilaiGap = Number((intro.match(/export const INTRO_GAP = (\d+);/) || [])[1]);
ok('INTRO_GAP satu angka bersama, diekspor dari SpiritualIntro', Number.isFinite(nilaiGap));
ok('lebih lega dari 14 yang dulu terasa menempel', nilaiGap > 14, String(nilaiGap));
ok('Reminder → tombol app memakai INTRO_GAP',
  /reminderCard: \{[\s\S]*?marginBottom: INTRO_GAP,/.test(intro));
ok('tombol app → isi layar memakai INTRO_GAP',
  /appButton: \{[\s\S]*?marginBottom: INTRO_GAP,/.test(intro));
ok('hitung mundur → Reminder memakai angka yang SAMA (diimpor, bukan disalin)',
  /import \{ INTRO_GAP, SpiritualIntro \} from '@\/components\/spiritual\/SpiritualIntro';/.test(alkitab) &&
  /countdown: \{[\s\S]*?marginBottom: INTRO_GAP,/.test(alkitab));
ok('urutan tumpukannya tetap: hitung mundur → SpiritualIntro → BibleRefList',
  alkitab.indexOf('styles.countdown') < alkitab.indexOf('<SpiritualIntro') &&
  alkitab.indexOf('<SpiritualIntro') < alkitab.indexOf('<BibleRefList'));
ok('tidak ada angka jarak lepas yang tertinggal di kedua kartu pembuka',
  !/marginBottom: 14,/.test(intro));
ok('Revive memakai komponen yang sama (ikut lega, tidak ada salinan)',
  /<SpiritualIntro reminder=\{reminder\} \/>/.test(baca('app/revive.tsx')));

console.log('\n=== Istilah ===');
ok('tidak ada "tekan" di berkas yang disentuh',
  ![home, alkitab, intro].some((s) => /\btekan\b|ditekan|menekan/.test(s)));

console.log(gagal === 0 ? '\n✅ LULUS — jaraknya rapi.' : `\n❌ ${gagal} cek gagal.`);
process.exit(gagal === 0 ? 0 : 1);
