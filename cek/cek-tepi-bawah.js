// 16 Sep 2026: tidak ada lagi "margin tertutup" di dasar layar (iPhone 15 &
// iPad 10th). Layar TANPA tab bar tidak memesan ruang aman bawah lewat
// SafeAreaView (edges top+bottom); semuanya edges={['top']} seperti Family,
// isinya menggulung sampai ujung layar dengan paddingBottom 40, dan
// footer/FAB yang dipatok menambahkan insets.bottom sendiri (pola Wheel).
// Layar bertab bar tetap top+bottom: tab bar-nya sendiri yang menutup ruang
// aman itu (BottomTabs paddingBottom insets + marginBottom negatif).
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');

const ROOT = AKAR;
const baca = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
const semua = ['app', 'components'].flatMap(function jelajah(d) {
  return fs.readdirSync(path.join(ROOT, d), { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? jelajah(d + '/' + e.name) : /\.tsx$/.test(e.name) ? [d + '/' + e.name] : []);
});

let gagal = 0;
function ok(nama, syarat, info = '') {
  if (syarat) console.log(`  ✅ ${nama}`);
  else { gagal++; console.log(`  ❌ ${nama}${info ? ` — ${info}` : ''}`); }
}

console.log('\n=== Aturan seluruh app ===');
const atasBawah = semua.filter((f) => /edges=\{\['top', 'bottom'\]\}/.test(baca(f)));
const tanpaTab = atasBawah.filter((f) => !/<BottomTabs/.test(baca(f)));
ok('SEMUA layar tanpa tab bar memakai edges top saja (tidak ada pita krem di dasar)',
  tanpaTab.length === 0, tanpaTab.join(', '));
// 22 Sep 2026: Walk, CORE & Work jadi tab utama (edges top saja; sub-tab pil di
// atas), jadi layar bertab bar sendiri tinggal 14.
ok('layar bertab bar tetap top+bottom (tab bar-nya yang menutup ruang aman) — ada ≥ 14',
  atasBawah.length >= 14 && atasBawah.every((f) => /<BottomTabs/.test(baca(f))), String(atasBawah.length));
ok('BottomTabs tetap menutup ruang aman bawah (paddingBottom insets + marginBottom negatif)',
  /paddingBottom: 8 \+ insets\.bottom, marginBottom: -insets\.bottom/.test(baca('components/common/BottomTabs.tsx')));
// 23 Sep 2026: login ikut aturan yang sama (edges top saja) — ombaknya memang
// harus menyentuh dasar layar, bukan berhenti di atas pita krem.
ok('login ikut aturan: edges top saja, ombaknya sampai ke dasar',
  /<SafeAreaView style=\{styles\.safe\} edges=\{\['top'\]\}>/.test(baca('app/login.tsx')) &&
  /<WelcomeWaves \/>/.test(baca('app/login.tsx')));

console.log('\n=== Layar biasa: seperti Family (edges top, paddingBottom 40) ===');
ok('Family sebagai acuan: edges top, paddingBottom 40',
  /edges=\{\['top'\]\}/.test(baca('app/family.tsx')) && /paddingBottom: 40 \}/.test(baca('app/family.tsx')));
for (const f of [
  'app/bible-reading.tsx', 'app/book.tsx', 'app/book/[key].tsx', 'app/daily-priority.tsx',
  'app/fasting-days.tsx', 'app/fasting.tsx', 'app/steps.tsx', 'app/project/[id].tsx',
  'app/promise.tsx', 'app/mountains.tsx', 'components/spiritual/MorningJourney.tsx',
  'app/multiplication/[id].tsx',
]) {
  const s = baca(f);
  ok(`${f}: edges top + isi paddingBottom 40`,
    /edges=\{\['top'\]\}/.test(s) && !/edges=\{\['top', 'bottom'\]\}/.test(s) &&
    /content: \{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 40 \}/.test(s));
}

console.log('\n=== Footer/FAB yang dipatok: ruang aman bawah jadi miliknya ===');
for (const f of ['app/core/monthly/[id].tsx', 'app/project/edit/[id].tsx', 'components/fun/FunEntryScreen.tsx']) {
  const s = baca(f);
  ok(`${f}: edges top, footer paddingBottom Math.max(insets.bottom, 12) (pola Wheel)`,
    /edges=\{\['top'\]\}/.test(s) && /useSafeAreaInsets/.test(s) &&
    /<View style=\{\[styles\.footer, \{ paddingBottom: Math\.max\(insets\.bottom, 12\) \}\]\}>/.test(s));
}
const riwayat = baca('app/history.tsx');
ok('Riwayat: FAB naik sebesar insets.bottom, isi tetap paddingBottom 90 (ruang FAB)',
  /edges=\{\['top'\]\}/.test(riwayat) && /style=\{\[styles\.fab, \{ bottom: 24 \+ insets\.bottom \}\]\}/.test(riwayat) &&
  /paddingBottom: 90/.test(riwayat));
ok('Wheel (acuan) tidak berubah', /paddingBottom: Math\.max\(insets\.bottom, 12\)/.test(baca('app/wheel.tsx')));

console.log(gagal === 0 ? '\n✅ LULUS — dasar layar rata di semua fitur.' : `\n❌ ${gagal} cek gagal.`);
process.exit(gagal === 0 ? 0 : 1);
