// Cek 7 permintaan: urutan hasil cari visitasi, garis tepi kartu alamat,
// tekan subtab 2× → lompat ke yang jatuh tempo, tanggal turnamen bisa diubah,
// berita Indonesia + kliping doa syafaat mingguan, jarak di bawah nama bulan
// Finance, dan tenggat pindah ke bawah tombol share.
const AKAR = require('./akar');
const BACA_TODAY = (p) => require('fs').readFileSync(AKAR + '/' + p, 'utf8').replace(/\r\n/g, '\n'); // 22 Sep 2026 Today OS
const fs = require('fs');
const path = require('path');

const ROOT = AKAR;
const baca = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

let gagal = 0;
function ok(nama, syarat, info = '') {
  if (syarat) console.log(`  ✅ ${nama}`);
  else {
    gagal++;
    console.log(`  ❌ ${nama}${info ? ` — ${info}` : ''}`);
  }
}

// ============ 1. Urutan hasil pencarian visitasi ============
console.log('\n1. Cari visitasi — yang tanggalnya paling dekat di atas');
const tab = baca('components/core/VisitationTab.tsx');
ok('urutan lama (tanggal terbesar dulu) sudah tidak dipakai',
  !/\.sort\(\(a, b\) => b\.date\.toMillis\(\) - a\.date\.toMillis\(\)\)/.test(tab));
ok('urutannya sekarang jarak ke hari ini',
  /const jarak = Math\.abs\(da\) - Math\.abs\(db\);/.test(tab) &&
  /return jarak !== 0 \? jarak : db - da;/.test(tab));

// Bukti perilakunya: rumus yang SAMA dijalankan atas contoh di layar user.
// (21 Okt 2026 = 61 hari lagi, 11 Sep 2026 = 21 hari lagi → yang 21 di atas.)
function urut(hari) {
  return [...hari].sort((da, db) => {
    const jarak = Math.abs(da) - Math.abs(db);
    return jarak !== 0 ? jarak : db - da;
  });
}
ok('contoh di layar: One-on-One (21 hari) naik di atas 3rd Visitation (61 hari)',
  JSON.stringify(urut([61, 21])) === JSON.stringify([21, 61]));
ok('yang sudah lewat ikut diurut dari yang paling baru lewat',
  JSON.stringify(urut([-200, 5, -3, 90])) === JSON.stringify([-3, 5, 90, -200]));
ok('jarak sama → yang MENDATANG didahulukan',
  JSON.stringify(urut([-7, 7])) === JSON.stringify([7, -7]));
ok('hari ini selalu paling atas',
  JSON.stringify(urut([9, 0, -1])) === JSON.stringify([0, -1, 9]));

console.log('\n   …yang tidak boleh ikut berubah');
ok('daftar Jadwal Mendatang tetap urut tanggal terdekat',
  /\.filter\(\(v\) => !v\.done && visitDaysUntil\(v, today\) >= 0\)\s*\.sort\(\(a, b\) => a\.date\.toMillis\(\) - b\.date\.toMillis\(\)\)/.test(tab));
ok('bahan pencariannya tetap sama (judul, agenda, nama, jenis, tanggal)',
  /const hay = `\$\{v\.note\} \$\{v\.agenda\}/.test(tab) &&
  /formatFullDate\(\s*v\.date\.toDate\(\),?\s*\)/.test(tab));
ok('Riwayat Visitasi tetap terbaru di atas (tidak ikut diubah)',
  /\(a, b\) => b\.date\.toMillis\(\) - a\.date\.toMillis\(\)/.test(
    baca('app/visitations.tsx'),
  ));

// ============ 2. Kartu alamat Residence ============
console.log('\n2. Kartu alamat — penandanya garis tepi, bukan tulisan');
const info = baca('components/residence/InfoTab.tsx');
ok('tulisan "Buka di Google Maps" dibuang', !/Buka di Google Maps/.test(info));
ok('gaya addressLink ikut dibuang (tak ada gaya nganggur)',
  !/addressLink/.test(info));
ok('garis tepinya warna tile Residence di Home',
  /borderColor: Color\.HOUSE_DARK/.test(info) &&
  /HOUSE: '#[0-9A-F]{6}'/.test(baca('assets/style/color.ts')));
ok('kartunya tetap bisa ditekan & tetap ke tautan yang sama',
  /<PressableScale style=\{styles\.addressCard\} onPress=\{openMaps\}>/.test(info) &&
  /openExternalUrl\(RESIDENCE_INFO\.mapsUrl\)/.test(info));
ok('isi kartunya tidak berkurang (judul + alamat)',
  /📍 Alamat/.test(info) && /\{RESIDENCE_INFO\.address\}/.test(info));

// ============ 3. Tekan subtab 2× → lompat ke yang jatuh tempo ============
console.log('\n3. Subtab dibuka → lompat ke baris jatuh tempo');
const tabScroll = baca('components/common/useTabScroll.ts');
const jump = baca('hooks/useDueJump.ts');
const upkeep = baca('components/common/UpkeepList.tsx');
// Ceritanya sendiri TETAP ditulis di komentarnya — kenapa syarat itu dibuang —
// jadi yang diperiksa "sudah hilang atau belum" harus kodenya saja.
ok('repress benar-benar dibuang dari useTabScroll',
  !/repress/.test(
    tabScroll.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, ''),
  ) &&
  /return \{ tab, setTab, scrollKey, onTabPress \};/.test(tabScroll));
ok('perilaku lamanya utuh: tiap tekan tetap re-mount ke atas',
  /setScrollKey\(\(n\) => n \+ 1\)/.test(tabScroll));
ok('lompatannya satu hook bersama (bukan disalin per layar)',
  /export function useDueJump/.test(jump));
ok('lompat SESUDAH isinya terukur (onContentSizeChange), bukan saat mount',
  /const onContentSizeChange = useCallback\(/.test(jump) &&
  /jumped\.current = true;/.test(jump));
// Penjagaannya sekarang bertambah satu: `sized.current` — isi ScrollView harus
// sudah terukur sebelum melompat. Perilakunya sendiri (sekali per mount, diam
// kalau tak ada yang jatuh tempo) dibuktikan dengan MENJALANKAN hook-nya di
// cek-lompat.js, bukan dengan mencocokkan tulisan kodenya.
ok('cuma sekali per mount (tidak "kabur sendiri" saat isinya berubah)',
  /if \(jumped\.current \|\| !dueKey \|\| !sized\.current\) return;/.test(jump));
ok('barisnya diberi jarak 8px dari tepi atas', /y: Math\.max\(0, y - 8\)/.test(jump));

console.log('\n   Car → Parts & Residence → Maintenance (lewat UpkeepList)');
ok('tujuannya baris jatuh tempo PERTAMA — aturan yang sama dengan badge',
  /\.find\(\(r\) => deadlineDue\(r\.tone\)\)/.test(upkeep));
ok('tiap baris mencatat posisinya', /onLayout=\{\(e\) => setRowY\(row\.key/.test(upkeep));
ok('Car tak perlu mengoper isyarat apa pun lagi',
  /<PartsTab status=\{parts\} \/>/.test(baca('app/car.tsx')) &&
  !/focusDue/.test(baca('components/car/PartsTab.tsx')));
ok('Residence juga',
  /<ChoreTab status=\{chores\} \/>/.test(baca('app/residence.tsx')) &&
  !/focusDue/.test(baca('components/residence/ChoreTab.tsx')));
ok('Pinjaman ikut (badge + daftar bertenggat juga)',
  /useDueJump\(/.test(baca('app/debts.tsx')) &&
  /list\.find\(\(d\) => !d\.done && deadlineDue\(debtTone\(d, today\)\)\)/.test(
    baca('app/debts.tsx'),
  ));
ok('tanpa badge (tak ada yang jatuh tempo) → tetap di paling atas seperti dulu',
  /!dueKey \|\| !sized\.current\) return;/.test(jump));
ok('pola aslinya di Habits tidak diutak-atik',
  /function handleSlotPress\(next: HabitSlot\)/.test(
    baca('components/habits/HabitsTab.tsx'),
  ));
ok('tata letak UpkeepList tidak bergeser (View pembungkus tanpa gaya → Fragment)',
  /<Fragment key=\{group\.key\}>/.test(upkeep) &&
  /content: \{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 24 \}/.test(upkeep) &&
  /groupTitle: \{ marginTop: 14, marginBottom: 8 \}/.test(upkeep));

// ============ 4. Tanggal turnamen bisa dibetulkan ============
console.log('\n4. Games → Tournament: tanggal bisa diubah');
const trn = baca('components/games/TournamentTab.tsx');
const trnLib = baca('lib/tournament.ts');
ok('ada fungsi ubah keterangan di lib', /export function withDetails\(/.test(trnLib));
ok('yang berubah HANYA nama & tanggal',
  /return \{ \.\.\.t, name, date: date\.getTime\(\), updatedAt: Date\.now\(\) \};/.test(trnLib));
ok('bracket, peserta, & juaranya tidak disentuh',
  !/withDetails[\s\S]{0,300}matches:/.test(trnLib) &&
  !/withDetails[\s\S]{0,300}participants:/.test(trnLib));
ok('tanggal di kartu detail bisa diketuk',
  /<PressableScale style=\{styles\.heroDateBtn\} onPress=\{openEdit\}>/.test(trn));
ok('area ketuknya tidak menambah tinggi kartu',
  /heroDateBtn: \{ alignSelf: 'flex-start' \}/.test(trn));
ok('modalnya memakai DateField yang sama dengan form buat turnamen',
  /title="✏️ Edit Tournament"/.test(trn) && /key=\{editOpen \? 'edit-open'/.test(trn));
ok('nama kosong ditolak', /setEditError\('Nama turnamen wajib diisi\.'\)/.test(trn));
ok('gagal simpan pakai pesan bersama', /setEditError\(SAVE_ERROR\)/.test(trn));
ok('menyimpannya lewat saveTournament yang sudah ada (tak ada jalur baru)',
  /saveTournament\(user\.uid, withDetails\(selected, eName\.trim\(\), eDate\)\)/.test(trn));
ok('hapus turnamen tetap PERMANEN',
  /export function deleteTournament[\s\S]{0,120}deleteDoc\(/.test(trnLib));

// ============ 5. Berita Indonesia + kliping doa syafaat ============
console.log('\n5a. News — sumber Indonesia');
const world = baca('lib/news.ts');
const newsTab = baca('components/news/NewsTab.tsx');
// Labelnya dipendekkan jadi "Indo" (30 Agu 2026) supaya kelima chip MUAT di
// iPhone 15 — nama panjangnya pindah ke keterangannya. Yang dijaga di sini
// tetap sama: sumbernya ada, dan namanya masih menyebut Indonesia.
ok('sumber "indonesia" ditambahkan',
  /key: 'indonesia', label: 'Indo'/.test(world) &&
  /sub: 'Indonesia · dalam negeri'/.test(world));
ok('feed-nya berbahasa & bergeografi Indonesia',
  /topic\/NATION\?hl=id&gl=ID&ceid=ID:id/.test(world));
ok('Bloomberg & Dunia tidak diubah',
  /site:bloomberg\.com\+when:7d/.test(world) &&
  /topic\/WORLD\?hl=en-US/.test(world));
// 28 Agu 2026: sumbernya jadi LIMA (Teknologi & Dev menyusul), jadi
// pemilihnya pindah dari SegmentTabs ke chip yang bisa digeser — lima kotak
// sama-lebar tak lagi muat. Keterangannya tetap satu tempat (lib/news.ts),
// cuma tampil sebagai satu baris di bawah chip-nya. Lihat cek-berita.js.
ok('keterangan tiap sumber tetap satu tempat (tak ada ternary di layar)',
  /\{aktif\.sub\}/.test(newsTab) && /sub: 'Indonesia · dalam negeri'/.test(world));
// ScrollView mendatarnya sendiri pindah ke components/common/ChipRow.tsx
// (28 Agu 2026). Emojinya pindah ke baris keterangan (30 Agu 2026) supaya
// kelima chip muat di iPhone 15 — lebarnya diukur di cek-enam-permintaan.js.
// Yang dijaga di sini tetap sama: labelnya utuh & chip-nya menyesuaikan isinya.
// 1 Sep 2026: sempat TURUN BARIS (`wrap`), sekarang kembali digeser seperti
// baris chip lainnya — baris keduanya tertimpa isi di bawahnya. Yang menjaga
// "tak ada yang terpotong" kini `activeIndex` (lihat cek-chip-geser.js).
ok('label sumbernya utuh, tidak terpotong (chip menyesuaikan isinya)',
  /label=\{s\.label\}/.test(newsTab) &&
  /<ChipRow\s*\n\s*activeIndex=/.test(newsTab));
ok('pembaca RSS-nya dipakai bersama (bukan disalin)',
  /export async function fetchRss\(/.test(world) &&
  /fetchRss\(f\.url, `\$\{source\}-\$\{i\}`, f\.source\)/.test(world));

console.log('\n5b. Kliping doa syafaat mingguan (Cron/Scheduler)');
const doa = baca('lib/prayerNews.ts');
const home = baca('app/(tabs)/index.tsx');
ok('satu berkas sendiri: lib/prayerNews.ts', doa.length > 0);
ok('dua topik yang memang ada di jadwal syafaat: Gereja & Negara',
  /PrayerNewsTopic = 'church' \| 'nation'/.test(doa));
ok('kata kuncinya Indonesia + gereja / pemerintahan',
  /gereja OR "umat kristen"/.test(doa) && /presiden OR pemerintah/.test(doa));
ok('rentangnya sepekan terakhir (when:7d)', /\$\{query\} when:7d/.test(doa));
ok('SEKALI SEMINGGU: berhenti kalau minggu ini sudah tercatat',
  /if \(prayerNewsFresh\(news, now\)\) return false;/.test(doa) &&
  /return news\?\.weekId === weekDocId\(now\);/.test(doa));
ok('batas mingguannya ikut Senin (weekDocId bersama, bukan hitungan baru)',
  /from '\.\/learning'/.test(doa));
ok('gagal ambil → TIDAK menulis catatan kosong (biar dicoba lagi)',
  /if \(church\.length === 0 && nation\.length === 0\) return false;/.test(doa));
ok('satu topik gagal tidak menjatuhkan yang lain', /\} catch \{\s*\/\/[\s\S]{0,90}return \[\];/.test(doa));
ok('disimpan SATU dokumen kecil', /'users', uid, 'world', 'prayerNews'/.test(doa));
ok('cuma 4 judul per topik', /const PER_TOPIC = 4;/.test(doa));

console.log('\n   …dan masuk ke doa syafaatnya');
ok('penggabungnya fungsi murni (pemakainya tetap cuma menggambar points)',
  /export function withWeeklyNews\(/.test(doa) &&
  /points: \[\.\.\.topic\.points, \.\.\.extra\.map\(\(t\) => `📰 \$\{t\}`\)\]/.test(doa));
ok('hari SELAIN Gereja & Negara tidak berubah sama sekali',
  /if \(topic\.key !== 'church' && topic\.key !== 'nation'\) return \[\];/.test(doa) &&
  /if \(extra\.length === 0\) return topic;/.test(doa));
ok('pokok doa tetapnya tidak dihapus, cuma ditambahi',
  !/points: \[\.\.\.extra/.test(doa) &&
  /'Pendeta & para pemimpin gereja/.test(baca('lib/intercession.ts')));
// 22 Sep 2026: kliping & penjadwalnya pindah ke hooks/useTodayData (Today).
ok('baris Doa Syafaat di Today memakainya',
  /withWeeklyNews\(intercessionToday\(now\), prayerNews \?\? null\)/.test(BACA_TODAY('hooks/useTodayData.ts')));
ok('Morning Gateway juga (syafaat pagi ikut terkini)',
  /topic=\{withWeeklyNews\(intercessionToday\(now\), prayerNews\)\}/.test(
    baca('app/morning-journey.tsx'),
  ));
ok('penjadwalnya Today (useTodayData) — sekali per sesi app, dan dijaga ref',
  /const newsTried = useRef\(false\);/.test(BACA_TODAY('hooks/useTodayData.ts')) &&
  /refreshPrayerNews\(user\.uid, prayerNews, new Date\(\)\)/.test(BACA_TODAY('hooks/useTodayData.ts')));
ok('tidak mengambil apa pun sebelum dokumennya terbaca',
  /if \(!user \|\| prayerNews === undefined \|\| newsTried\.current\) return;/.test(BACA_TODAY('hooks/useTodayData.ts')));
ok('gagal → boleh dicoba lagi (ref dilepas)', /newsTried\.current = false;/.test(BACA_TODAY('hooks/useTodayData.ts')));
// Kliping ini SENGAJA tidak lagi ikut nongol di tab News: tempatnya di kartu
// Doa Syafaat (dua cek di atas), bukan di tengah daftar berita.
ok('tab News bersih dari kliping doa syafaat',
  !/Doa Syafaat/.test(newsTab) && !/prayerPoints/.test(newsTab));
// Dibuang sampai akarnya, bukan cuma kartunya disembunyikan — gaya, state, &
// langganan Firestore-nya ikut, jadi layar ini berhenti membacanya sama sekali.
ok('gaya & langganan yang jadi nganggur ikut dibuang',
  !/prayerCard|prayerTitle|prayerPoint|prayerFoot/.test(newsTab) &&
  !/prayerNews|subscribePrayerNews|useAuth|useEffect/.test(newsTab));
ok('…tapi klipingnya TIDAK ikut hilang dari doa syafaatnya',
  /withWeeklyNews\(/.test(BACA_TODAY('hooks/useTodayData.ts')) &&
  /withWeeklyNews\(/.test(baca('app/morning-journey.tsx')));
// 22 Sep 2026: expo-notifications ada di package.json untuk pengingat Finance;
// kliping doa syafaat sendiri tetap cuma fetch + Firestore.
ok('tidak ada modul native baru (cukup fetch + Firestore yang sudah ada)',
  !/expo-notifications|expo-background|expo-task-manager/.test(doa) &&
  !/expo-notifications/.test(baca('lib/prayerNews.ts')));

// ============ 6. Jarak di bawah nama bulan Finance ============
console.log('\n6. Finance — jarak di bawah "Agustus 2026"');
const fin = baca('app/finance.tsx');
ok('topBar punya nafas atas & bawah (dulu atasnya 0)',
  /paddingTop: 10,\s*\n\s*paddingBottom: 14,/.test(fin));
ok('sisa navigasi bulannya tidak diubah',
  /monthRow: \{ flexDirection: 'row', alignItems: 'center', gap: 10 \}/.test(fin) &&
  /monthText: \{ minWidth: 140, textAlign: 'left', color: Color\.TEXT_TITLE \}/.test(fin));

// ============ 7. Tenggat di bawah tombol share ============
console.log('\n7. Kartu visitasi — tenggat pindah ke bawah tombol share');
const body = baca('components/core/VisitationCardBody.tsx');
const riwayat = baca('app/visitations.tsx');
ok('isi kartu tidak lagi mencetak status di baris nama',
  !/cardTop/.test(body) && !/DeadlineTag tone=\{tone\}[\s\S]{0,40}<\/View>/.test(body));
ok('statusnya jadi komponen sendiri', /export function VisitationStatus/.test(body));
ok('isi statusnya tetap sama persis (✅ Selesai / hitung mundur)',
  /✅ Selesai/.test(body) && /<DeadlineTag tone=\{tone\} label=\{deadlineLabel\(days\)\}/.test(body));
// Urutan di kolom kanan: tombol share DULU, baru tenggatnya.
const iShare = tab.indexOf('icon="square.and.arrow.up"');
const iStatus = tab.indexOf('<VisitationStatus');
ok('di tab Visitation: share di atas, tenggat di bawahnya',
  iShare > -1 && iStatus > iShare);
ok('keduanya di satu kolom kanan', /<View style=\{styles\.cardSide\}>/.test(tab));
// Kolomnya kini setinggi kartu & isinya dipisah dua ujung: share menempel
// di kanan ATAS, hitung mundurnya memojok ke kanan BAWAH.
ok('kolomnya rata kanan, setinggi kartu, isinya dipisah dua ujung',
  /cardSide: \{ alignItems: 'flex-end', justifyContent: 'space-between', gap: 6 \}/.test(tab) &&
  /cardRow: \{ flexDirection: 'row', alignItems: 'stretch', gap: 8 \}/.test(tab));
ok('tombol share tetap SAUDARA area ketuk (bukan Pressable bersarang)',
  /<\/PressableScale>[\s\S]{0,600}<View style=\{styles\.cardSide\}>/.test(tab));
ok('Riwayat Visitasi ikut bentuk yang sama',
  /<VisitationStatus visitation=\{v\} tone=\{tone\} days=\{days\} \/>/.test(riwayat));
ok('jarak antar-baris di Riwayat tetap 3 (pindah ke cardMain, bukan hilang)',
  /cardMain: \{ flex: 1, gap: 3 \}/.test(riwayat));
ok('hasil pencarian memakai kartu yang sama (renderCard dipakai dua-duanya)',
  /\{results\.map\(renderCard\)\}/.test(tab) && /\{pageItems\.map\(renderCard\)\}/.test(tab));

console.log('\nAturan wajib');
ok('hapus tetap PERMANEN (tulis ulang array / deleteDoc)',
  /saveVisitations\(\s*user\.uid,\s*visitations\.filter/.test(tab) &&
  /deleteDoc\(/.test(trnLib));
ok('tidak ada soft-delete yang diselundupkan',
  !/isDeleted|archived: true/.test(tab + body + doa + jump + upkeep));
ok('warna semua dari Color, tak ada hex mentah di layar',
  !/#[0-9A-Fa-f]{6}/.test(info) && !/#[0-9A-Fa-f]{6}/.test(newsTab) &&
  !/#[0-9A-Fa-f]{6}/.test(upkeep));

console.log(gagal === 0 ? '\n✅ LULUS — tujuh-tujuhnya beres.' : `\n❌ ${gagal} cek gagal.`);
process.exit(gagal === 0 ? 0 : 1);
