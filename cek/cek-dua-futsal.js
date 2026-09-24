// Dua permintaan (6 Sep 2026, malam — futsal):
//   1. Squad & Setoran bawaannya TERBUKA; Game & Score dan Catatan memakai
//      komponen buka-tutup yang SAMA, dan judul ketiganya dipatok di atas.
//   2. Baris judul "📅 Jadwal Main" dihapus; pintunya jadi tombol 📅 di pojok
//      header, PERSIS di tengah antara 💰 Kas & 🏅 Papan.
const AKAR = require('./akar');
const fs = require('fs');
const R = AKAR + '/';
const baca = (f) => fs.readFileSync(R + f, 'utf8').replace(/\r\n/g, '\n');
// Assertion yang melarang sebuah kata harus menguji KODE, bukan komentar yang
// justru menerangkan kenapa kata itu sudah tak ada lagi di kodenya.
const kode = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

let ok = true;
const c = (n, s, extra) => {
  if (!s) ok = false;
  console.log((s ? '  ✓ ' : '  ✗ ') + n + (!s && extra ? ` → ${extra}` : ''));
};

const rinci = baca('app/futsal/[id].tsx');
const tab = baca('components/friends/FutsalTab.tsx');
const layar = baca('app/friends.tsx');

// ============================================================
console.log('=== 1a. Tiga bagian, SATU komponen buka-tutup ===');
// ============================================================
// Yang diminta: "buat juga fungsi dan component yang sama yaitu dropdown".
// Jadi yang dijaga bukan cuma "bisa ditutup", tapi bahwa ketiganya memakai
// komponen yang SAMA — bukan tiga bentuk mirip yang ditulis sendiri-sendiri.
c('ketiga judulnya <SectionToggle> yang sama',
  (kode(rinci).match(/<SectionToggle/g) || []).length === 3 &&
    /title="👥 Squad & Payment"/.test(rinci) &&
    /title="⚽ Game & Score"/.test(rinci) &&
    /title="📝 Note"/.test(rinci));
c('tak ada lagi judul bagian yang digambar sendiri di layar ini',
  !/styles\.sectionTitle/.test(rinci) && !/sectionTitle: \{/.test(rinci));
// 6 Sep 2026 (batch ketiga): ketiganya jadi AKORDEON — satu state, bukan tiga
// saklar. Yang sedang terbuka tetap boleh diklik lagi untuk menutup.
// Aturan buka-tutupnya kini di hooks/useAccordion.ts — DIJALANKAN &
// dibuktikan di cek-akordion.js. Yang dijaga di sini: layar ini memang
// memakainya, dan ketiga judulnya lewat pintu yang sama.
c('ketiganya bisa ditutup lagi, bukan macet terbuka',
  /useAccordion<Bagian>\('squad'\)/.test(rinci) &&
    /toggleSeksi\('squad'\)/.test(rinci) &&
    /toggleSeksi\('games'\)/.test(rinci) &&
    /toggleSeksi\('notes'\)/.test(rinci));
c('isinya baru digambar saat bagiannya terbuka',
  /\{squadOpen &&/.test(rinci) &&
    /\{gamesOpen && \(/.test(rinci) &&
    /\{notesOpen && \(/.test(rinci));

// ============================================================
console.log('\n=== 1b. Squad terbuka duluan, dua lainnya menunggu ===');
// ============================================================
// Squad & Setoran yang dicari begitu masuk: siapa ikut, siapa belum setor.
// Game & Score dan Catatan diisi belakangan, sesudah mainnya selesai.
c('bawaannya Squad & Setoran',
  /useAccordion<Bagian>\('squad'\)/.test(rinci));

// ============================================================
console.log('\n=== 1c. Judulnya DIPATOK — tetap kelihatan saat digulung ===');
// ============================================================
c('nomornya konstan di luar komponen, bukan array baru tiap render',
  /^const STICKY_HEADERS = \[1, 3, 5\];$/m.test(rinci) &&
    /stickyHeaderIndices=\{STICKY_HEADERS\}/.test(rinci));
{
  // Nomor patokan MENGHITUNG anak langsung ScrollView — diperiksa sungguhan.
  const a = rinci.indexOf('stickyHeaderIndices={STICKY_HEADERS}');
  const b = rinci.indexOf('      </ScrollView>', a);
  const anak = rinci
    .slice(a, b)
    .split('\n')
    .filter((l) => /^ {8}<[A-Za-z]/.test(l));
  c('judul di anak ganjil, isinya di anak genap tepat sesudahnya',
    anak.length === 7 &&
      [1, 3, 5].every((i) => anak[i].includes('<SectionToggle')) &&
      [0, 2, 4, 6].every((i) => /^<View[ >]/.test(anak[i].trim())),
    anak.map((l, i) => `${i}:${l.trim().slice(0, 14)}`).join(' '));
  c('tidak ada anak bersyarat telanjang yang bisa menggeser nomornya',
    !/^ {8}\{[a-zA-Z]/m.test(rinci.slice(a, b)));
}
// Judul yang dipatok tak boleh membawa jarak ATAS: jarak itu ikut menempel di
// layar sebagai pita menganga selama daftarnya digulung. Jadi jaraknya turun
// ke blok yang mendahuluinya — dan angkanya tetap SECTION_SPACE, bukan angka
// baru yang diketik ulang.
c('jarak antar-bagian dipindah ke bawah blok sebelumnya',
  /sectionGap: \{ marginBottom: SECTION_SPACE\.marginTop \}/.test(rinci) &&
    (rinci.match(/<View style=\{styles\.sectionGap\}>/g) || []).length === 2 &&
    /paddingTop: 0,/.test(baca('components/common/SectionToggle.tsx')));

// ============================================================
console.log('\n=== 1d. Menutup tidak menghilangkan kabarnya ===');
// ============================================================
c('tiap judul membawa ringkasan isi yang disembunyikannya',
  /sub=\{ringkasSquad\}/.test(rinci) &&
    /sub=\{ringkasGame\}/.test(rinci) &&
    /sub=\{sesi\.note \? 'Sudah ditulis' : 'Belum ditulis'\}/.test(rinci));
// Ringkasannya dihitung dari datanya sendiri, bukan angka yang ditulis tangan.
c('ringkasan game dihitung dari score sungguhan',
  /const golSemua = sesi\.games\.reduce\(\(n, g\) => n \+ g\.scoreA \+ g\.scoreB, 0\);/.test(
    rinci,
  ) && /\$\{sesi\.games\.length\} game · \$\{golSemua\} gol/.test(rinci));
c('sesi tanpa game tidak berbohong "0 game · 0 gol"',
  /sesi\.games\.length === 0\s*\n?\s*\? 'Belum ada game'/.test(rinci));
{
  // "Catat Game" ikut MASUK ke dalam bagiannya: ia tindakan utama bagian itu,
  // bukan tombol yang berdiri di judul yang dipatok (yang berarti ia menempel
  // di layar terus, bahkan saat bagiannya ditutup).
  const buka = rinci.indexOf('{gamesOpen && (');
  const tutupBagian = rinci.indexOf('title="📝 Note"');
  const tombol = rinci.indexOf("label=\"Catat Game\"");
  c('tombol Catat Game ikut tersembunyi saat bagiannya ditutup',
    buka > 0 && tombol > buka && tombol < tutupBagian);
}

// ============================================================
console.log('\n=== 2. Pintu Jadwal Main jadi tombol 📅 di header ===');
// ============================================================
c('baris judulnya benar-benar hilang dari sub-tab',
  !/title="📅 Jadwal Main"/.test(kode(tab)) &&
    !/<SectionRow/.test(kode(tab)) &&
    !/SectionRow/.test(kode(tab)));
c('hitungan "akan datang" ikut dibuang, tak ada sisa yang menggantung',
  !/akanDatang/.test(kode(tab)) && !/upcomingSessions/.test(kode(tab)));
// …tapi fungsinya sendiri TIDAK ikut dihapus: halaman Jadwal Main yang memakainya.
c('upcomingSessions tetap hidup untuk halaman Jadwal Main',
  /export function upcomingSessions/.test(baca('lib/futsal.ts')) &&
    /upcomingSessions\(/.test(baca('app/futsal-schedule.tsx')));

c('tombolnya ada di pojok header, menuju halaman jadwal',
  /<EmojiButton emoji="📅" onPress=\{\(\) => router\.push\('\/futsal-schedule'\)\} \/>/.test(
    layar,
  ));
c('duduknya PERSIS di tengah, antara 💰 kas & 🏅 papan',
  /emoji="💰"[\s\S]{0,220}emoji="📅"[\s\S]{0,220}emoji="🏅"/.test(layar));
// Ketiganya milik Fun Futsal — di sub-tab Split Bill & Places mereka tak
// punya arti apa-apa.
c('ketiganya cuma muncul di sub-tab Fun Futsal',
  /tab === 'futsal' \? \(\s*\n\s*<>\s*\n\s*<EmojiButton emoji="💰"/.test(layar));
c('pintunya tak lagi ikut menggulung hilang: ia di luar ScrollView',
  layar.indexOf('emoji="📅"') < layar.indexOf('<FutsalTab'));

console.log(
  ok
    ? '\n✅ LULUS — tiga bagian buka-tutup & tombol 📅 terbukti.'
    : '\n❌ ADA YANG GAGAL',
);
process.exit(ok ? 0 : 1);
