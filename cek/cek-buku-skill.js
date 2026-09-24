// 16 Sep 2026: (a) SEMUA buku rujukan Skills di Learning ada di fitur Book →
// kartu bukunya di Target/Skills hanya tampil kalau bukunya ada, dan click →
// langsung ke halaman bacanya; (b) tombol 🎚️ di Book: sheet filter kategori &
// urutan tahun rilis; (c) DualButtons dapat cancelLabel (dipakai footer
// "Bersihkan / Selesai" di Book & Visitation).
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const Module = require('module');

const ROOT = AKAR;
const OUT = path.join(__dirname, 'keluar-buku-skill');
const baca = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');

let gagal = 0;
function ok(nama, syarat, info = '') {
  if (syarat) console.log(`  ✅ ${nama}`);
  else { gagal++; console.log(`  ❌ ${nama}${info ? ` — ${info}` : ''}`); }
}

try {
  execFileSync(
    'npx',
    ['tsc', path.join(ROOT, 'lib/books.ts'), path.join(ROOT, 'lib/learning.ts'),
      '--ignoreConfig', '--outDir', OUT, '--module', 'commonjs', '--target', 'es2020',
      '--skipLibCheck', '--esModuleInterop', '--moduleResolution', 'bundler'],
    { cwd: ROOT, stdio: 'pipe', shell: true },
  );
} catch { /* keluhan tipe tak menghalangi tsc membuat JS-nya */ }

const asli = Module._load;
Module._load = function (req, parent, isMain) {
  if (req === './firebase') return { db: {} };
  if (req === './liveDoc') return { liveDoc: () => () => {}, liveList: () => () => {} };
  if (req.startsWith('firebase/')) return new Proxy({}, { get: () => () => ({}) });
  if (req.startsWith('@/assets/style/color')) return { Color: new Proxy({}, { get: () => '#000' }) };
  if (req.startsWith('@/') || req.startsWith('./')) {
    try { return asli(req, parent, isMain); } catch { return new Proxy({}, { get: () => () => ({}) }); }
  }
  return asli(req, parent, isMain);
};
const B = require(path.join(OUT, 'books.js'));
const L = require(path.join(OUT, 'learning.js'));
Module._load = asli;

console.log('\n=== Katalog Book ===');
ok('25 buku (13 lama + 12 rujukan Skills), kunci unik',
  B.BOOKS.length === 25 && new Set(B.BOOKS.map((b) => b.key)).size === 25, String(B.BOOKS.length));
ok('7 kategori, semuanya dipakai minimal satu buku',
  B.BOOK_CATEGORIES.length === 7 &&
  B.BOOK_CATEGORIES.every((c) => B.BOOKS.some((b) => b.category === c.key)) &&
  B.BOOKS.every((b) => B.BOOK_CATEGORIES.some((c) => c.key === b.category)));
ok('tiap buku punya judul, penulis, tahun, info, tautan, & ≥ 7 bab (Deep Work memang 7)',
  B.BOOKS.every((b) => b.title && b.author && b.year > 1900 && b.info.length > 40 && /^https?:\/\//.test(b.url) && b.chapters.length >= 7));
ok('12 buku baru ada dengan kategori yang cocok area skill-nya',
  [['critical-thinking', 'productivity'], ['how-to-win-friends', 'productivity'], ['creative-habit', 'productivity'],
   ['first-aid-manual', 'life'], ['sas-survival-handbook', 'life'], ['emotional-intelligence', 'life'],
   ['this-changes-everything', 'science'], ['the-gene', 'science'], ['urban-farmer', 'science'],
   ['digital-marketing-dummies', 'tech'], ['rule-of-law', 'insight'], ['ethics-of-ambiguity', 'insight'],
  ].every(([k, c]) => B.BOOKS.find((b) => b.key === k)?.category === c));
ok('The Ethics of Ambiguity: teks lengkap gratis (linkKind free, marxists.org)',
  B.BOOKS.find((b) => b.key === 'ethics-of-ambiguity').linkKind === 'free' &&
  /marxists\.org/.test(B.BOOKS.find((b) => b.key === 'ethics-of-ambiguity').url));
ok('How to Win Friends 30 bab, Emotional Intelligence 16, Rule of Law 12 + epilog',
  B.BOOKS.find((b) => b.key === 'how-to-win-friends').chapters.length === 30 &&
  B.BOOKS.find((b) => b.key === 'emotional-intelligence').chapters.length === 16 &&
  B.BOOKS.find((b) => b.key === 'rule-of-law').chapters.length === 13);
ok('tidak ada tanda pisah panjang di judul bab / info',
  B.BOOKS.every((b) => !b.info.includes('\u2014') && b.chapters.every((c) => !c.includes('\u2014'))));

console.log('\n=== Skills ↔ Book ===');
const berbuku = L.SKILLS.filter((s) => s.book);
ok('setiap skill yang menyebut buku punya bookKey yang ADA di katalog (15/15)',
  berbuku.length === 15 && berbuku.every((s) => s.bookKey && B.BOOKS.some((b) => b.key === s.bookKey)),
  berbuku.filter((s) => !s.bookKey || !B.BOOKS.some((b) => b.key === s.bookKey)).map((s) => s.key).join(','));
ok('skill tanpa buku (7) tidak diberi bookKey', L.SKILLS.filter((s) => !s.book).every((s) => !s.bookKey) && L.SKILLS.filter((s) => !s.book).length === 7);
ok('Ethics & Philosophy → The Ethics of Ambiguity; P3K & Survival → judul buku sungguhan',
  L.skillOf('ethics').bookKey === 'ethics-of-ambiguity' &&
  /First Aid Manual/.test(L.skillOf('first-aid').book) && /SAS Survival Handbook/.test(L.skillOf('survival').book));

const week = baca('components/learning/WeekTab.tsx');
const skills = baca('components/learning/SkillsTab.tsx');
ok('Target: kartu buku HANYA kalau ada di Book (tanpa kartu "pakai sumber lain dulu"), click → /book/[key]',
  !/Belum ada di fitur Book/.test(week) && /\{book \? \(\s*\n\s*<PressableScale/.test(week) &&
  /router\.push\(\{ pathname: '\/book\/\[key\]', params: \{ key: book\.key \} \}\)/.test(week) &&
  /baca di fitur Book/.test(week));
ok('Skills: rincian skill juga tanpa kartu "Belum ada di fitur Book"',
  !/Belum ada di fitur Book/.test(skills) && /\{openBook \? \(\s*\n\s*<PressableScale/.test(skills));

console.log('\n=== Book: 🎚️ Filter & Sort ===');
const book = baca('app/book.tsx');
ok('tombol 🎚️ di kanan atas header, menyala saat ada filter/urutan',
  /right=\{\s*\n\s*<EmojiButton\s*\n\s*emoji="🎚️"\s*\n\s*active=\{hasFilter\}\s*\n\s*onPress=\{\(\) => setFilterOpen\(true\)\}/.test(book));
ok('sheet "🎚️ Filter & Sort": chip kategori (Semua + tiap kategori berjumlah) & 3 urutan',
  /title="🎚️ Filter & Sort"/.test(book) && /label="Semua"/.test(book) &&
  /label=\{`\$\{cat\.label\} \(\$\{BOOKS\.filter\(\(b\) => b\.category === cat\.key\)\.length\}\)`\}/.test(book) &&
  /\{ key: 'category', label: '📚 Per kategori' \},\s*\n\s*\{ key: 'newest', label: '📅 Tahun terbaru' \},\s*\n\s*\{ key: 'oldest', label: '📜 Tahun terlama' \},/.test(book));
ok('urut tahun: rata (tanpa judul kategori), kategori disebut di baris penulis; per kategori = tampilan lama',
  /sortMode === 'newest' \? b\.year - a\.year : a\.year - b\.year/.test(book) &&
  /sortMode !== 'category' \? ` · \$\{catLabel\(book\.category\)\}` : ''/.test(book) &&
  /BOOK_CATEGORIES\.filter\(\(cat\) => !catFilter \|\| cat\.key === catFilter\)\.map\(/.test(book));
ok('footer Bersihkan / Selesai memakai DualButtons bersama (cancelLabel)',
  /<DualButtons\s*\n\s*cancelLabel="Bersihkan"\s*\n\s*confirmLabel="Selesai"/.test(book));
ok('satu penggambar kartu buku (renderBook) untuk dua mode', (book.match(/renderBook/g) || []).length >= 3);

console.log('\n=== DualButtons.cancelLabel (rapihin) ===');
const dual = baca('components/common/DualButtons.tsx');
const visit = baca('components/core/VisitationTab.tsx');
ok('DualButtons: cancelLabel opsional, bawaan "Batal"',
  /cancelLabel = 'Batal',/.test(dual) && /<VixText heading="bold">\{cancelLabel\}<\/VixText>/.test(dual));
ok('Visitation: footer filter memakai DualButtons; gaya clearBtn/doneBtn sendiri dibuang',
  /<DualButtons\s*\n\s*cancelLabel="Bersihkan"\s*\n\s*confirmLabel="Selesai"/.test(visit) &&
  !/clearBtn|doneBtn|filterFooter/.test(visit));

console.log(gagal === 0 ? '\n✅ LULUS — buku Skills lengkap di Book, filter Book jalan.' : `\n❌ ${gagal} cek gagal.`);
process.exit(gagal === 0 ? 0 : 1);
