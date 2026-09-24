// Permintaan: baris chip jangan terpotong. Semuanya ikut satu bentuk —
// digeser ke samping seperti kategori di Reminder — dan chip yang SEDANG
// AKTIF selalu ditarik utuh ke dalam layar.
const AKAR = require('./akar');
const fs = require('fs');
const R = AKAR + '/';
const baca = (f) => fs.readFileSync(R + f, 'utf8');

let ok = true;
const c = (n, s, extra) => {
  if (!s) ok = false;
  console.log((s ? '  ✓ ' : '  ✗ ') + n + (extra !== undefined ? `  → ${extra}` : ''));
};

const chip = baca('components/common/ChipRow.tsx');
// Komentarnya SENDIRI menceritakan mode yang dibuang ("`wrap` … `spread` …"),
// dan cerita itu memang harus tetap ada. Jadi yang diperiksa "sudah hilang
// atau belum" harus kodenya saja.
const kode = chip.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const filter = baca('components/common/FilterChips.tsx');
const news = baca('components/news/NewsTab.tsx');
const fun = baca('components/fun/CreatorsTab.tsx');
const tasks = baca('app/tasks.tsx');

console.log('\n== 1. Satu bentuk untuk semua baris chip ==');

// Dulu ada tiga: `start` (digeser), `spread` (melebar kalau muat), `wrap`
// (turun baris). `wrap` bikin baris keduanya tertimpa isi di bawahnya —
// chip terakhir News ("Kristen") terpotong separuh. `spread` tak dipakai
// satu layar pun. Keduanya dibuang.
c('mode turun baris benar-benar dibuang, bukan cuma tak dipakai',
  !/flexWrap/.test(kode) && !/'wrap'/.test(kode));
c('mode spread yang nganggur ikut dibuang', !/spread/.test(kode));
// `fit` sempat hidup lagi dengan arti berbeda ("muat sebaris, lebarnya dibagi
// rata"), lalu dibuang juga (2 Sep 2026): lebar yang dipatok sama rata
// menuntut hurufnya yang mengalah, dan satu baris berakhir dengan enam ukuran
// huruf berbeda. Chip yang benar itu KOTAKNYA yang mengikuti hurufnya.
c('`fit` ikut dibuang — tinggal satu bentuk saja',
  !/fit\?: number;/.test(kode) &&
  !/anak\.length <= fit/.test(kode) &&
  !/flexWrap/.test(kode));
c('yang tersisa baris yang digeser', /horizontal/.test(kode) && /ScrollView/.test(kode));
// Ceritanya sendiri tetap ditulis — kenapa bentuknya tinggal satu.
c('alasan pembuangannya dicatat di komentarnya',
  /SATU bentuk saja/.test(chip) && /mengikuti hurufnya/.test(chip));
c('tak ada layar yang masih meminta bentuk lain',
  ![news, fun, tasks, filter].some((s) => /fit="/.test(s)));

// Alasan lama tetap dijaga: ScrollView RN memasang flexGrow:1 pada dirinya.
c('flexGrow bawaan ScrollView tetap dimatikan',
  /scroll: \{ flexGrow: 0 \}/.test(chip));
c('animasi chip masuk berurutan dari kanan tidak hilang',
  /FadeInRight/.test(chip) && /Math\.min\(i, 8\) \* 45/.test(chip));

console.log('\n== 2. Chip aktif tidak boleh terpotong ==');

c('barisnya menerima "yang aktif chip ke berapa"', /activeIndex\?: number;/.test(chip));
c('letak tiap chip diukur saat digambar',
  /tempat\.current\[i\] = \{ x, w: width \};/.test(chip));
// Efeknya jalan SEBELUM chip-nya sempat diukur saat layar pertama dibuka —
// jadi geseran awalnya harus dihitung ulang dari onLayout.
c('geseran awal dihitung dari onLayout, bukan cuma dari efek',
  /if \(i === activeIndex\) tampakkan\(i\);/.test(chip) &&
  /useEffect\(\(\) => \{\s*\n\s*if \(activeIndex !== undefined\) tampakkan\(activeIndex\);/.test(chip));
c('yang sudah kelihatan utuh TIDAK diusik (barisnya tidak melompat sendiri)',
  /if \(t\.x >= kiri \+ EDGE && t\.x \+ t\.w <= kanan - EDGE\) return;/.test(chip));
c('tersembunyi di kiri → ditarik dari kiri; di kanan → dari kanan',
  /t\.x < kiri \+ EDGE\s*\n\s*\? t\.x - EDGE[\s\S]{0,120}: t\.x \+ t\.w - lebar \+ EDGE/.test(chip));
c('disisakan nafas tepi, bukan pas-pasan menempel pinggir',
  /const EDGE = 14;/.test(chip));
c('tidak pernah menggeser ke angka minus', /Math\.max\(0, x\)/.test(chip));
c('geserannya halus, bukan meloncat', /animated: true/.test(chip));

// Ini yang membuat animasinya murah: tak ada satu pun state di sini, jadi
// menggeser jari tidak memicu render ulang seluruh baris.
c('posisi & lebar disimpan di ref, bukan state',
  /useRef\(0\)/.test(chip) && !/useState/.test(chip));
c('geseran jari dicatat lewat onScroll',
  /geseran\.current = e\.nativeEvent\.contentOffset\.x;/.test(chip) &&
  /scrollEventThrottle=\{16\}/.test(chip));
c('lebar layarnya ikut dicatat (tanpa itu tak bisa tahu mana yang terlihat)',
  /lebarLayar\.current = e\.nativeEvent\.layout\.width;/.test(chip));

console.log('\n== 3. Keempat baris chip mengoper chip aktifnya ==');

c('Reminder — kategori',
  /activeIndex=\{TASK_CATEGORIES\.findIndex\(\(c\) => c\.key === category\)\}/.test(tasks));
c('News — sumber berita',
  /activeIndex=\{NEWS_SOURCES\.findIndex\(\(s\) => s\.key === source\)\}/.test(news));
c('Fun — pemilih kreator',
  /activeIndex=\{CREATOR_KINDS\.findIndex\(\(k\) => k\.key === kind\)\}/.test(fun));
// FilterChips menaruh "ALL" sebagai chip ke-0, jadi indeks pilihannya
// bergeser satu — salah hitung di sini berarti yang ditarik chip tetangganya.
c('Saringan (7 layar) — "ALL" chip ke-0, sisanya bergeser satu',
  /value === null \? 0 : options\.findIndex\(\(o\) => o\.key === value\) \+ 1/.test(filter));

console.log('\n== 4. Barisnya sampai ke tepi layar ==');

// Baris saringan tinggal di dalam layar ber-padding 20pt, jadi chip-nya
// terpotong 20pt SEBELUM tepi layar — potongan menggantung di tengah begitu
// terbaca seperti kesalahan, bukan seperti "masih ada lagi di sebelah".
// Reminder tidak begitu: barisnya memang bebas sampai tepi.
c('saringan menembus padding layarnya…', /scroll: \{ marginHorizontal: -20 \}/.test(filter));
c('…lalu memasang 20pt-nya sendiri di dalam (chip sejajar kartu di bawahnya)',
  /row: \{ paddingHorizontal: 20, paddingBottom: 12 \}/.test(filter));

// Angka -20 itu cuma benar kalau SEMUA pemakainya memang memberi 20pt.
const PEMAKAI = [
  'app/history.tsx', 'app/visitations.tsx', 'components/career/AffiliateTab.tsx',
  'components/learning/DiscussionTab.tsx',
  'components/friends/PlacesTab.tsx', 'components/tasks/PriorityTab.tsx',
];
const beda = PEMAKAI.filter((f) => !/content: \{ paddingHorizontal: 20,/.test(baca(f)));
c('ketujuh pemakainya memang sama-sama ber-padding 20pt',
  beda.length === 0 && PEMAKAI.every((f) => /<FilterChips/.test(baca(f))),
  beda.join(', '));

// Reminder & News/Fun tidak butuh margin minus: induknya memang tanpa padding.
c('Reminder tetap seperti semula (induknya sudah tanpa padding)',
  /chipRow: \{ paddingHorizontal: 20 \}/.test(tasks) &&
  /chipScroll: \{ flexGrow: 0, height: 60, marginBottom: 8 \}/.test(tasks));
c('News & Fun juga memasang 20pt di dalam barisnya',
  /sourceRow: \{ paddingHorizontal: 20/.test(news) &&
  /kindRow: \{ paddingHorizontal: 20/.test(fun));

console.log('\n== 5. Yang tidak boleh ikut berubah ==');

c('menekan chip yang sedang aktif tetap = muat ulang & balik ke atas',
  /reload\(\);\s*\n\s*listRef\.current\?\.scrollTo\(\{ y: 0/.test(news) &&
  /reload\(\);\s*\n\s*listRef\.current\?\.scrollTo\(\{ y: 0/.test(fun));
c('saringan: tekanan kedua tetap melepas filternya',
  /onChange\(value === o\.key \? null : o\.key\)/.test(filter));
c('badge angka di chip Reminder tetap ada', /styles\.chipBadge/.test(tasks));
c('tak ada layar yang menulis ScrollView horizontal sendiri lagi',
  ![news, fun, tasks, filter].some((s) =>
    /horizontal\s*\n\s*showsHorizontalScrollIndicator/.test(s)));

console.log(ok ? '\nLULUS' : '\nGAGAL');
process.exit(ok ? 0 : 1);