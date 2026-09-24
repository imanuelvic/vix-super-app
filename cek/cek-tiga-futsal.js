// Tiga permintaan (6 Sep 2026, malam — batch ketiga):
//   1. Rincian sesi jadi AKORDEON: Squad & Setoran terbuka, Game & Score dan
//      Catatan tertutup — dan membuka salah satunya menutup yang lain.
//   2. Daftar Anggota di sub-tab Fun Futsal bawaannya TERBUKA.
//   3. Kartu "main berikutnya" di halaman Jadwal Main dihapus.
const AKAR = require('./akar');
const fs = require('fs');
const R = AKAR + '/';
const baca = (f) => fs.readFileSync(R + f, 'utf8').replace(/\r\n/g, '\n');
// Assertion yang melarang sebuah kata harus menguji KODE, bukan komentar yang
// justru menerangkan kenapa kata itu sudah tak ada lagi di kodenya.
const kode = (f) => baca(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

let ok = true;
const c = (n, s, extra) => {
  if (!s) ok = false;
  console.log((s ? '  ✓ ' : '  ✗ ') + n + (!s && extra ? ` → ${extra}` : ''));
};

const rinci = baca('app/futsal/[id].tsx');
const tab = baca('components/friends/FutsalTab.tsx');
const jadwal = baca('app/futsal-schedule.tsx');

// ============================================================
console.log('=== 1a. Satu nilai, bukan tiga saklar ===');
// ============================================================
// Tiga boolean membuat "ketiganya terbuka" jadi keadaan yang MUNGKIN, lalu
// harus dijaga tangan di tiap tombol. Satu nilai membuatnya mustahil.
c('dipegang SATU state, bukan tiga boolean terpisah',
  /const \{ isOpen, toggle: toggleSeksi \} = useAccordion<Bagian>\('squad'\);/.test(
    rinci,
  ) &&
    !/const \[squadOpen, setSquadOpen\]/.test(rinci) &&
    !/const \[gamesOpen, setGamesOpen\]/.test(rinci) &&
    !/const \[notesOpen, setNotesOpen\]/.test(rinci));
c('ketiga keadaannya diturunkan dari state itu',
  /const squadOpen = isOpen\('squad'\);/.test(rinci) &&
    /const gamesOpen = isOpen\('games'\);/.test(rinci) &&
    /const notesOpen = isOpen\('notes'\);/.test(rinci));
c('ketiga judulnya lewat pintu yang sama',
  /onToggle=\{\(\) => toggleSeksi\('squad'\)\}/.test(rinci) &&
    /onToggle=\{\(\) => toggleSeksi\('games'\)\}/.test(rinci) &&
    /onToggle=\{\(\) => toggleSeksi\('notes'\)\}/.test(rinci));
// "Nanti"-nya tiba 10 Sep 2026: polanya diangkat jadi hooks/useAccordion.ts
// dan LIMA layar memakainya. Yang dijaga sekarang bukan lagi kemiripan huruf
// antar-salinan — melainkan bahwa salinannya memang HABIS.
c('bentuknya sama persis dengan akordeon CORE Leaders',
  /useAccordion<Bagian>\('squad'\)/.test(rinci) &&
    /useAccordion<'cl' \| 'mt'>\(\)/.test(
      baca('components/core/LeadersTab.tsx'),
    ));

// ============================================================
console.log('\n=== 1b. Aturannya diuji, bukan cuma bentuknya ===');
// ============================================================
{
  // Aturan buka-tutupnya diambil dari SUMBERNYA — kini satu tempat untuk
  // kelima layar — lalu DIJALANKAN. Yang dibuktikan perilakunya, bukan
  // kemiripan huruf.
  const m = baca('hooks/useAccordion.ts').match(
    /setTerbuka\(\(cur\) => \(([^)]+)\)\)/,
  );
  const aturan = m ? new Function('cur', 'k', 'return ' + m[1]) : null;
  c('membuka bagian lain menutup yang sedang terbuka',
    !!aturan &&
      aturan('squad', 'games') === 'games' &&
      aturan('squad', 'notes') === 'notes' &&
      aturan('games', 'notes') === 'notes');
  c('mengklik yang sedang terbuka menutupnya, bukan membuka ulang',
    !!aturan && aturan('games', 'games') === null);
  c('dari keadaan tertutup semua, satu klik membuka yang diklik',
    !!aturan && aturan(null, 'notes') === 'notes');
}

// ============================================================
console.log('\n=== 1c. Yang terbuka duluan: Squad & Setoran ===');
// ============================================================
// Itu yang dicari begitu masuk — siapa ikut, siapa belum setor. Game & Score
// dan Catatan diisi belakangan, sesudah mainnya selesai.
c('bawaannya squad, jadi dua lainnya tertutup dengan sendirinya',
  /useAccordion<Bagian>\('squad'\)/.test(rinci));
// Menutupnya tidak berarti kehilangan kabar: dua dari tiga bagian selalu
// tertutup sekarang, jadi ringkasan di judulnya justru makin penting.
c('ketiga judulnya tetap membawa ringkasan isinya',
  /sub=\{ringkasSquad\}/.test(rinci) &&
    /sub=\{ringkasGame\}/.test(rinci) &&
    /sub=\{sesi\.note \? 'Sudah ditulis' : 'Belum ditulis'\}/.test(rinci));

// ============================================================
console.log('\n=== 2. Daftar Anggota bawaannya TERBUKA ===');
// ============================================================
// Ia dulu tertutup supaya belasan baris nama tak mendorong kas & riwayat main
// jauh ke bawah. Keduanya kini pintu di pojok header (💰 & 📅), jadi tak ada
// lagi yang bisa terdorong: daftar ini memang isi terakhir halamannya.
c('bawaannya terbuka', /const \[anggotaOpen, setAnggotaOpen\] = useState\(true\);/.test(tab));
c('tetap bisa ditutup, bukan macet terbuka',
  /setAnggotaOpen\(\(v\) => !v\)/.test(tab));
c('alasan lamanya ikut diperbarui, bukan ditinggal berbohong',
  !/TERTUTUP saat sub-tab ini dibuka/.test(tab));

// ============================================================
console.log('\n=== 3. Kartu "main berikutnya" dibuang ===');
// ============================================================
// Jadwal terdekat SELALU kartu pertama daftar tepat di bawahnya — kartu besar
// di atas cuma mengulang hal yang sama dua kali dalam satu layar.
c('kartunya benar-benar hilang',
  !/main berikutnya/.test(kode('app/futsal-schedule.tsx')) &&
    !/<SummaryCard/.test(kode('app/futsal-schedule.tsx')) &&
    !/summaryText/.test(kode('app/futsal-schedule.tsx')));
c('impor & gaya yang cuma miliknya ikut dibuang',
  !/formatDayDate/.test(jadwal) &&
    !/dayIdToDate/.test(jadwal) &&
    !/hero: \{/.test(jadwal));
c('helper jaraknya ikut dibuang, bukan ditinggal menganggur',
  !/function jarak/.test(jadwal) && !/hari lalu/.test(jadwal));
// Yang tinggal cuma kabar yang TIDAK ada di daftarnya.
c('kalau semua yang tersimpan sudah lewat, itu tetap dikatakan',
  /\{akanDatang\.length === 0 \? \(/.test(jadwal) &&
    /Belum ada jadwal \{meta\.label\} yang akan datang\./.test(jadwal));
// Daftarnya sendiri utuh: jadwal terdekat tetap jadi kartu paling atas.
c('daftar & paginasinya tidak ikut terusik',
  /const semua = \[\.\.\.akanDatang, \.\.\.riwayat\];/.test(jadwal) &&
    /pageItems\.map\(\(s, i\) => \{/.test(jadwal) &&
    (jadwal.match(/<Pagination/g) || []).length === 1);
c('judul "Riwayat Main" tetap muncul tepat di batasnya',
  /\{mulaiRiwayat && \(/.test(jadwal) && /🧾 Riwayat Main/.test(jadwal));

console.log(
  ok
    ? '\n✅ LULUS — akordeon, anggota terbuka & kartu dibuang terbukti.'
    : '\n❌ ADA YANG GAGAL',
);
process.exit(ok ? 0 : 1);
