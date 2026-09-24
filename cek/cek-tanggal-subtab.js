// Lima permintaan (4 Sep 2026):
//   1. Tanggal di reminder Dashboard lengkap & seragam "ddd, dd mmm yyyy".
//   2. Learning: kotak rangkuman tidak tertutup keyboard; estimasi durasi
//      (15/10/5 mnt) dibuang dari sub-tab Target & dari reminder Dashboard.
//   3. Reminder Dashboard mendarat di SUB-TAB yang jadi sumber barisnya.
//   4. Wheel: "Fokus Kuartal" & "Score per Area" jadi bagian buka-tutup yang
//      dipatok, cuma satu terbuka, bawaannya tertutup.
//   5. Fun Futsal membuka tab CORE, bukan NDC F3.
//
// Ditulis lewat berkas (bukan heredoc): heredoc bash memakan backslash regex.
const AKAR = require('./akar');
const fs = require('fs');
const ts = require(AKAR + '/node_modules/typescript');
const R = AKAR + '/';
const baca = (f) => fs.readFileSync(R + f, 'utf8').replace(/\r\n/g, '\n');

const kode = (f) =>
  baca(f)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

let ok = true;
const c = (n, s, extra) => {
  if (!s) ok = false;
  console.log((s ? '  ✓ ' : '  ✗ ') + n + (!s && extra ? ` → ${extra}` : ''));
};

const tsc = (src) =>
  ts.transpileModule(src, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
  }).outputText;
const pasang = (js, req) => {
  const mod = { exports: {} };
  new Function('exports', 'module', 'require', js)(mod.exports, mod, req);
  return mod.exports;
};

const format = pasang(tsc(baca('lib/format.ts')), () => ({}));
const dash = baca('app/reminders.tsx');

// ============================================================
console.log('=== 1. Tanggal reminder: ddd, dd mmm yyyy ===');
// ============================================================
// Bentuknya kini "dddd, d mmm yyyy" — nama hari UTUH, tanggal apa adanya.
c('bentuknya persis seperti yang diminta',
  format.formatDayDate(new Date(2026, 8, 4)) === 'Jumat, 4 Sep 2026',
  format.formatDayDate(new Date(2026, 8, 4)));
// Nol di depan itu bahasa mesin, bukan bahasa orang — dan sekarang berlaku di
// SELURUH app, bukan cuma di kartu reminder.
c('tanggal 1 digit ditulis 1 digit',
  format.formatDayDate(new Date(2026, 0, 1)) === 'Kamis, 1 Jan 2026',
  format.formatDayDate(new Date(2026, 0, 1)));
c('bentuk pendeknya pun tak pernah dipadkan',
  format.formatShortDayDate(new Date(2026, 8, 4)) === 'Jum, 4 Sep 2026' &&
  format.formatCompactDate(new Date(2026, 8, 4)) === 'Jum, 4 Sep 26');
// Fungsi khusus reminder dihapus: dengan aturan baru ia kembar persis dengan
// formatDayDate, dan dua fungsi berhasil sama itu yang bikin satu layar
// diam-diam memakai yang salah.
c('tak ada lagi fungsi tanggal kembar',
  format.formatReminderDate === undefined &&
  !/formatReminderDate/.test(baca('lib/format.ts')));

c('pertemuan CORE memakainya', /formatDayDate\(v\.date\.toDate\(\)\)/.test(dash));
c('ulang tahun CL & Main Team kini menyebut tanggalnya',
  /hari lagi \(\$\{formatDayDate\(\s*\n?\s*b\.date,?\s*\n?\s*\)\}\), ke-\$\{b\.turningAge\}/.test(dash));
c('ulang tahun keluarga ikut',
  (dash.match(/formatDayDate\(\s*\n?\s*b\.date,?/g) || []).length === 2);
c('formatDate lama tidak tertinggal jadi impor mati',
  !/\bformatDate\b/.test(dash));

// ============================================================
console.log('\n=== 2. Learning: keyboard & estimasi durasi ===');
// ============================================================
const week = kode('components/learning/WeekTab.tsx');
c('daftarnya sadar-keyboard, seperti layar berisian lain',
  /<KeyboardAwareScrollView/.test(week) && !/<ScrollView/.test(week));
c('penutupnya ikut berganti (bukan tag yang tak berpasangan)',
  /<\/KeyboardAwareScrollView>/.test(week) && !/<\/ScrollView>/.test(week));

const learn = baca('lib/learning.ts');
c('kolom `minutes` dibuang dari sumbernya', !/minutes/.test(learn));
c('keempat langkahnya tetap utuh',
  ['discover', 'dig', 'summarize', 'share'].every((k) =>
    new RegExp(`key: '${k}'`).test(learn)));
c('tidak ada lagi "mnt" di kartu langkah maupun reminder',
  !/mnt/.test(week) && !/mnt/.test(dash));

// ============================================================
console.log('\n=== 3. Reminder mendarat di sub-tab yang benar ===');
// ============================================================
// Barisnya datang dari daftar PERAWATAN; bawaan layar Residence adalah Token.
// Tanpa param, remindernya menjatuhkanmu di layar yang tak menyebut satu pun
// baris itu — persis keluhan yang dilaporkan.
c('Residence → Maintenance (chores), bukan Token',
  /pathname: '\/residence', params: \{ tab: 'chores' \}/.test(dash));
c('Car → Parts, ditulis tegas walau kebetulan sama dengan bawaannya',
  /pathname: '\/car', params: \{ tab: 'parts' \}/.test(dash));
// TIGA kartu latihan sekarang (belum memilih, sudah memilih, cuma jalan) —
// ketiganya harus menyebut sub-tabnya. Dihitung, bukan sekadar "ada": satu
// saja yang benar sudah cukup untuk membuat cek yang longgar tetap hijau.
c('Fitness → Exercise (ketiga kartunya)',
  (dash.match(/pathname: '\/fitness', params: \{ tab: 'exercise' \}/g) || []).length === 3);
c('Learning: Rangkum → Target, Diskusi → Discussion',
  /pathname: '\/learning', params: \{ tab: 'week' \}/.test(dash) &&
  /params: \{ tab: 'topics' \}/.test(dash));
// Satu kartu memuat DUA arah pinjaman, jadi satu tujuan untuk semuanya pasti
// salah separuh.
c('Pinjaman: tiap baris ke tab arahnya sendiri',
  /onItemPress=\{\(id\) =>[\s\S]{0,240}debts\.find\(\(d\) => d\.id === id\)\?\.direction \?\? 'theirs'/.test(dash));

// Layar tujuannya harus MENERIMA ?tab= — tanpa `tabs`, useTabScroll
// mengabaikan paramnya tanpa satu pun tanda kalau salah.
for (const [f, bawaan] of [
  ['app/residence.tsx', 'token'],
  ['app/car.tsx', 'parts'],
  ['app/fitness.tsx', 'exercise'],
  ['app/debts.tsx', 'theirs'],
]) {
  const src = baca(f);
  c(`${f.replace('app/', '').padEnd(15)} menerima ?tab=`,
    src.includes(`>('${bawaan}', {`) && src.includes('tabs: TABS,'));
}
c('bawaan tiap layar TIDAK ikut bergeser',
  baca('app/residence.tsx').includes("useTabScroll<ResidenceTab>('token'") &&
  baca('app/car.tsx').includes("useTabScroll<CarTab>('parts'"));

// ============================================================
console.log('\n=== 4. Wheel: dua bagian dipatok & saling menutup ===');
// ============================================================
const wheel = baca('app/wheel.tsx');
const wheelKode = kode('app/wheel.tsx');
c('nomor patokannya konstan di luar komponen',
  /^const STICKY_HEADERS = \[1, 3\];$/m.test(wheel));
c('ScrollView Overview memang memakainya',
  /<ScrollView\s*\n\s*contentContainerStyle=\{styles\.content\}\s*\n\s*stickyHeaderIndices=\{STICKY_HEADERS\}>/.test(wheel));
// Nomor patokan menghitung ANAK LANGSUNG ScrollView — diperiksa sungguhan.
{
  const a = wheel.indexOf('stickyHeaderIndices={STICKY_HEADERS}');
  const b = wheel.indexOf('        </ScrollView>', a);
  const anak = wheel
    .slice(a, b)
    .split('\n')
    .filter((l) => /^ {10}<[A-Za-z]/.test(l) || /^ {10}\{hasScores \? \(/.test(l));
  c('anak ke-1 & ke-3 memang kedua judulnya',
    anak.length === 6 &&
      anak[1].includes('{hasScores ? (') &&
      anak[3].includes('{hasScores ? (') &&
      anak[0].trim() === '<View>',
    anak.map((l, i) => `${i}:${l.trim().slice(0, 12)}`).join(' '));
}
c('keduanya memakai komponen bersama yang sama dengan Anggota & CORE',
  /<SectionToggle\s*\n\s*title="🎯 Quarter Focus"/.test(wheel) &&
  /<SectionToggle\s*\n\s*title="📋 Score per Area"/.test(wheel));
// Dua boolean membuat "keduanya terbuka" jadi keadaan yang MUNGKIN; satu nilai
// membuatnya mustahil.
c('dipegang SATU state — mustahil dua-duanya terbuka',
  /const \{ isOpen, toggle: toggleSeksi \} = useAccordion<'focus' \| 'score'>\(\);/.test(
    wheel,
  ));
c('bawaannya dua-duanya TERTUTUP',
  /useAccordion<'focus' \| 'score'>\(\)/.test(wheel));
c('isinya baru digambar saat bagiannya dibuka',
  /\{hasScores && isOpen\('focus'\) && \(/.test(wheel) &&
  /\{hasScores && isOpen\('score'\) && \(/.test(wheel));
c('keterangan "4 area · kurang N poin" ikut kepalanya, bukan tertinggal',
  /sub=\{[\s\S]{0,320}kurang \$\{focusGap\} poin lagi/.test(wheel));
c('gaya kepala lamanya tidak tertinggal jadi gaya mati',
  !/sectionHeadMain|sectionHeader:|sectionTitle:/.test(wheelKode));

const toggle = baca('components/common/SectionToggle.tsx');
c('SectionToggle bisa membawa baris keterangan', /sub\?: string;/.test(toggle));
// flex: 1 akan melempar panahnya ke ujung kanan sampai menempel tombol aksi,
// dan judul pendek jadi terpisah jauh dari panah miliknya sendiri.
c('kotak judulnya MENGALAH, bukan flex: 1', /titleBox: \{ flexShrink: 1 \}/.test(toggle));

// ============================================================
console.log('\n=== 5. Fun Futsal membuka CORE ===');
// ============================================================
const friends = baca('app/friends.tsx');
c('tab geng bawaannya CORE',
  /useState<FutsalGangKey>\('core'\)/.test(baca('contexts/futsalGang.tsx')));
// Gengnya kini nilai bersama, jadi tab pembukanya cukup ditulis SEKALI.
c('layarnya membaca geng itu, bukan menyimpan salinannya sendiri',
  /const \{ gang, setGang \} = useFutsalGang\(\);/.test(friends) &&
  !/useState<FutsalGangKey>/.test(friends));

console.log(ok ? '\n✅ LULUS — tanggal, sub-tab, Wheel & CORE terbukti.' : '\n❌ ADA YANG GAGAL');
process.exit(ok ? 0 : 1);
