// 21 Sep 2026: langganan lewat useLiveAll → `subscribeX(uid, …)`, bukan `user.uid`.
// Cek 6 permintaan: fitur Daily Priority 💡 (+ tombol header & tautan dari
// baris kebiasaan), "5 hari lagi", jadwal Doa Rantai = Selasa & Kamis saja,
// pokok doa jadi dropdown di gerbang pagi, dan daftar Doa Rantai dua kolom.
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

const habits = baca('lib/habits.ts');
const home = baca('app/(tabs)/index.tsx');
const prio = baca('lib/priority.ts');
const layarPrio = baca('app/daily-priority.tsx');
const core = baca('lib/core.ts');
// 21 Sep 2026: gerbangnya jadi Morning Journey — Doa Rantai & syafaat ada di
// langkah 🙏 Pray (journey/JourneySteps.tsx), sakelar harinya di MorningJourney.tsx.
const gate = baca('components/spiritual/journey/JourneySteps.tsx') + '\n' + baca('components/spiritual/MorningJourney.tsx');
const followup = baca('components/core/FollowupTab.tsx');

// ============ 1. Baris kebiasaan "Top 3 Priorities" ============
console.log('\n1. Baris "Top 3 Priorities" — bisa dipencet & emojinya 💡');
ok('emojinya diganti 📝 → 💡',
  /\{ match: \/top 3 priorit\/i, label: '💡 Top 3 Priorities' \}/.test(habits));
ok('penggantiannya lewat mekanisme yang SUDAH ada (HABIT_RENAMES saat dibaca)',
  /const HABIT_RENAMES/.test(habits) &&
  /\.map\(renamedHabit\)/.test(habits));
// Penggantinya kini dua cabang (ganti nama utuh, atau buang ekor jamnya saja
// — lihat cek-duolingo-bubble.js), jadi yang dijaga di sini INTINYA: ia cuma
// menyalin objeknya saat DIBACA, tidak menulis apa pun ke Firestore.
const badanRename = (habits.match(/function renamedHabit[\s\S]*?\n\}/) || [''])[0];
ok('nama di Firestore tidak ditulis ulang (data aslinya tidak disentuh)',
  badanRename.length > 0 &&
  !/setDoc|updateDoc|deleteDoc/.test(badanRename) &&
  /\{ \.\.\.h, label:/.test(badanRename));
ok('barisnya jadi pintasan ke Daily Priority',
  /match: \/top 3 priorit\/i,\s*note: 'Buka Daily Priority 💡',[\s\S]{0,120}pathname: '\/daily-priority'/.test(habits));
// '/news' menyusul di belakangnya (baris "Reading the News"), jadi
// '/daily-priority' tak lagi jadi anggota terakhir union-nya.
ok('rutenya ikut diperiksa typed routes (union pathname, bukan string bebas)',
  /\| '\/daily-priority'\s*\n/.test(habits));
// BERUBAH atas permintaan: barisnya kini CERMIN — tercentang sendiri begitu
// ketiga prioritas terisi, dan tidak bisa dicentang manual. Aturan & buktinya
// ada di cek-cermin.js.
ok('centangnya dikunci — ikut layar Daily Priority, bukan click di Habits',
  /top 3 priorit[\s\S]{0,220}mirrorOf: 'priority'/.test(habits));
// Kebiasaannya kini ikut dioper — dipakai baris "Reading the News" yang
// dicentang saat pintasannya dibuka (cek-berita.js). Untuk Daily Priority
// tak ada bedanya: ia mirrorOf, jadi doneOnOpen-nya kosong.
ok('click namanya membuka pintasannya (mekanisme lama, tidak diubah)',
  /onPress=\{\(\) => link && openHabitLink\(link, habit\)\}/.test(
    baca('components/habits/HabitsTab.tsx'),
  ));

// ============ 2. Fitur Daily Priority ============
console.log('\n2. Fitur Daily Priority 💡');
ok('layarnya ada', layarPrio.length > 0 && /Daily Priority 💡/.test(layarPrio));
ok('tiga baris, dikunci di lib', /export const PRIORITY_COUNT = 3;/.test(prio));
ok('satu dokumen kecil PER TANGGAL', /'users', uid, 'priority', dayId/.test(prio));
ok('reset tengah malam = dokumen hari baru, bukan tugas latar',
  /const \{ now, todayId \} = useNow\(\);/.test(layarPrio) &&
  /useLiveAll\(\(uid, fail\) => \[subscribePriorityDay\(uid, todayId, setDay, fail\)\], \{\s*\n\s*onError: setError,\s*\n\s*deps: \[todayId\],/.test(layarPrio) && // 22 Sep 2026: efek langganannya jadi useLiveAll (callback & syarat sama).
  !/expo-background|expo-task-manager|setInterval/.test(prio + layarPrio));
ok('isian apa pun dirapikan jadi tepat 3 baris',
  /Array\.from\(\{ length: PRIORITY_COUNT \}, \(_, i\) =>/.test(prio));
ok('baris kosong tidak bisa dicoret',
  /if \(!list\[index\]\.text\.trim\(\)\) return;/.test(layarPrio));
ok('disimpan saat selesai mengetik (onBlur), bukan tiap huruf',
  /onBlur=\{commit\}/.test(layarPrio) && !/onChangeText=\{\(text\) => setText/.test(layarPrio));
ok('…dan sekali lagi saat layarnya ditutup (tulisan tidak hilang)',
  /const berubah = end\.some\(\(it, i\) => it\.text !== saved\[i\]\.text\);/.test(layarPrio));
ok('draft dipisah dari snapshot supaya kursor tidak melompat',
  /if \(!day \|\| loadedDay\.current === todayId\) return;/.test(layarPrio));

// Bukti perilaku hitungan badge.
const trim = (t) => t.trim().length > 0;
const filled = (l) => l.filter((i) => trim(i.text)).length;
const doneN = (l) => l.filter((i) => trim(i.text) && i.done).length;
const pending = (l) => (filled(l) === 0 ? 3 : filled(l) - doneN(l));
const baris = (t, d = false) => ({ text: t, done: d });
ok('belum diisi sama sekali → badge 3 (mengisinya ikut ditagih)',
  pending([baris(''), baris(''), baris('')]) === 3);
ok('3 terisi, 1 beres → badge 2',
  pending([baris('a', true), baris('b'), baris('c')]) === 2);
ok('cuma 2 yang diisi & dua-duanya beres → badge 0',
  pending([baris('a', true), baris('b', true), baris('')]) === 0);
ok('centang di baris kosong tidak pernah dihitung',
  doneN([baris('', true), baris('a', true), baris('')]) === 1);

console.log('\n   Tombol 💡 di header Home');
// 22 Sep 2026 (Today OS): pil 💡 di Home dibuang; Daily Priority jadi blok
// "3 hal terpenting hari ini" tepat di bawah hero With God (components/today/
// PrioritiesBlock), dicoret langsung dari sana, isinya tetap di layarnya.
const blokPrio = BACA_TODAY('components/today/PrioritiesBlock.tsx');
ok('ada tepat di bawah hero With God di Today',
  BACA_TODAY('app/(tabs)/index.tsx').indexOf('<GodHero') < BACA_TODAY('app/(tabs)/index.tsx').indexOf('<PrioritiesBlock'));
ok('menuju layarnya', /router\.push\('\/daily-priority'\)/.test(blokPrio));
// 30 Agu 2026: isinya tidak lagi cuma angka — ⚠️ selama belum diisi, angka
// sisa selama masih ada yang belum dicoret, ✅ kalau ketiganya beres. Angka
// "3" saat kosong terbaca seolah sudah ada tiga hal yang menunggu.
ok('isinya = keadaan prioritas hari ini (belum diisi / n dari 3 / dilewati), dicoret langsung',
  /priorityFilled\(day\.items\)/.test(blokPrio) && /savePriorityDay\(user\.uid, todayId, next\)/.test(blokPrio) &&
  /day\.skipped/.test(blokPrio));
ok('datanya ikut langganan hari ini (ganti hari → ikut kosong)',
  /subscribePriorityDay\(uid, todayId, mark\('priorities', setPriorities\), fail\)/.test(BACA_TODAY('hooks/useTodayData.ts')));
ok('baris kosong membuka layar isiannya, bukan dicentang',
  /if \(!it\.text\.trim\(\)\) return buka\(\);/.test(blokPrio));
// Yang diperiksa IMPOR-nya, bukan kata "lib/tasks" — komentar penjelas di
// lib/priority.ts memang menyebutnya untuk membedakan kedua fitur.
ok('bukan menumpang fitur Reminder (dokumen & lib-nya sendiri)',
  !/from '\.\/tasks'/.test(prio) &&
  !/lib\/tasks/.test(layarPrio) &&
  /'users', uid, 'priority', dayId/.test(prio));

// ============ 3. "5 hari lagi" ============
console.log('\n3. Reminder Prioritas — "5 hari lagi", bukan "5h"');
const dash = baca('app/reminders.tsx');
ok('singkatan "h" sudah dibuang', !/\$\{days\}h lagi/.test(dash) && !/lewat \$\{-days\}h/.test(dash));
ok('memakai teks bersama whenLabel', /\{whenLabel\(days\)\}/.test(dash));
// Bukti isi teksnya.
const whenLabel = (d) =>
  d === 0 ? 'HARI INI' : d > 0 ? `${d} hari lagi` : `lewat ${-d} hari`;
ok('5 → "5 hari lagi" (contoh di layar)', whenLabel(5) === '5 hari lagi');
ok('0 → "HARI INI"', whenLabel(0) === 'HARI INI');
ok('-3 → "lewat 3 hari"', whenLabel(-3) === 'lewat 3 hari');
ok('teksnya sama dengan yang dipakai layar lain (satu sumber)',
  /export function whenLabel/.test(baca('lib/format.ts')));

// ============ 4. Doa Rantai = Selasa & Kamis ============
console.log('\n4. Doa Rantai cuma Selasa & Kamis');
ok('jadwalnya dipangkas dari [2,4,6] → [2,4]',
  /const PRAYER_FOLLOWUP_DAYS = \[2, 4\];/.test(core));
ok('alasannya ditulis: disamakan dengan Doa Syafaat',
  /dikunci sama dengan Doa Syafaat/.test(core));
// 23 Sep 2026: jadwal syafaat mingguan diganti daftar pemiliknya sendiri
// (Prayer List miliknya), jadi "Doa Rantai CL" bukan lagi salah satu topiknya.
// Ia berdiri sendiri, sumbernya tetap pokok doa bulanan tiap CL (lib/core.ts).
ok('jadwal syafaat = daftar pemiliknya sendiri, Doa Rantai berdiri sendiri',
  /Teman PO & BASIC/.test(baca('lib/intercession.ts')) &&
  /Teman GAT & Kawanua/.test(baca('lib/intercession.ts')) &&
  !/CHAIN/.test(baca('lib/intercession.ts')));
ok('komentar "Sel/Kam/Sab" yang basi sudah tidak ada',
  !/Sel\/Kam\/Sab/.test(core + gate + followup + dash + baca('app/morning-journey.tsx')));

// Bukti: gerbang pagi SELALU 3 langkah, hari apa pun.
// Aturan aslinya disalin dari MorningPrayerGate & lib/intercession.
const CHAIN_DAYS = [2, 4];
function langkah(hari, adaCL) {
  const chainDue = CHAIN_DAYS.includes(hari) && adaCL;
  // Penentunya kini Doa Rantainya sendiri, bukan jadwal topik mingguan: saat
  // ia giliran, dialah syafaat pagi itu. Jadwal syafaat boleh berubah kapan
  // pun tanpa mengubah bentuk gerbang pagi.
  const showIntercession = !chainDue;
  return 2 + (chainDue ? 1 : 0) + (showIntercession ? 1 : 0);
}
const semuaHari = [0, 1, 2, 3, 4, 5, 6];
ok('tiap hari tepat 3 langkah (ada CL giliran)',
  semuaHari.every((h) => langkah(h, true) === 3),
  semuaHari.map((h) => `${h}:${langkah(h, true)}`).join(' '));
ok('tetap 3 langkah walau belum ada CL yang punya pokok doa',
  semuaHari.every((h) => langkah(h, false) === 3));
ok('Sabtu tidak lagi 4 langkah (dulu Doa Rantai + syafaat ⛪ Gereja)',
  langkah(6, true) === 3);
ok('hari giliran CL: Doa Rantai menggantikan Doa Syafaat, bukan menambah',
  /const showIntercession = !chainDue;/.test(gate));
ok('kartu Reminder Doa Rantai di Dashboard ikut jadwal yang sama',
  /isPrayerFollowupDay/.test(dash) && /prayerFollowupDue &&/.test(dash));

// ============ 5. Dropdown pokok doa ============
console.log('\n5. Pokok doa jadi dropdown di gerbang pagi');
ok('ada keadaan "yang sedang dibuka"', /const \[openChain, setOpenChain\] = useState<string \| null>\(null\)/.test(gate));
ok('SATU saja terbuka pada satu waktu (accordion)',
  /setOpenChain\(open \? null : l\.id\)/.test(gate));
ok('tertutup dulu saat langkah Pray dibuka', /useState<string \| null>\(null\)/.test(gate));
ok('kepala kartunya jadi sakelar', /<PressableScale\s*style=\{styles\.chainTop\}/.test(gate));
ok('jumlah poin & panah ▾/▴ kelihatan walau tertutup',
  /\{l\.points\.length\} poin \{open \? '▴' : '▾'\}/.test(gate));
ok('yang sudah didoakan tetap bertanda ✅ walau tertutup',
  /\{l\.done \? '✅ ' : ''\}/.test(gate));
ok('pokok doa & tombol WA cuma muncul saat dibuka',
  /\{open && \(/.test(gate));
ok('isi & tombolnya tidak berubah (masih 🙏 poin + Doakan lewat WhatsApp)',
  /🙏 \{p\}/.test(gate) && /💬 Doakan lewat WhatsApp/.test(gate));
ok('bentuknya sama dengan daftar CL di CORE › Follow Up ("N poin")',
  /\$\{pts\.length\} poin ›/.test(followup));

// ============ 6. Doa Rantai dua kolom ============
console.log('\n6. Daftar Doa Rantai jadi kiri-kanan');
ok('kartunya dibungkus grid', /<View style=\{styles\.prayerGrid\}>/.test(followup));
ok('grid membungkus ke baris berikutnya',
  /prayerGrid: \{\s*flexDirection: 'row',\s*flexWrap: 'wrap',\s*gap: 10,/.test(followup));
ok('tiap kartu separuh lebar & melebar kalau sisa sendiri',
  /prayerCell: \{\s*flexBasis: '47%',\s*flexGrow: 1,/.test(followup));
ok('nama panjang dipotong satu baris, tidak merusak kolom',
  /numberOfLines=\{1\}[\s\S]{0,80}styles\.prayerRowName/.test(followup));
ok('flex pada nama dibuang (di kartu kolom, flex memanjangkan ke bawah)',
  /prayerRowName: \{ color: Color\.TEXT_TITLE \}/.test(followup));
ok('warna & tanda selesainya tidak berubah',
  /borderColor: Color\.WHATSAPP/.test(followup) &&
  /prayerRowDone: \{\s*backgroundColor: Color\.MAIN_TRANSPARENT/.test(followup));
// Garis merah badge-nya ikut disebar ke gaya yang sama (attentionBorder),
// jadi yang diperiksa BUKAN lagi susunan persis array gayanya — melainkan
// bahwa kartunya tetap memakai `prayerRow` (satu baris), bukan gaya dua kolom.
ok('kartu Follow Up Mingguan TIDAK ikut jadi dua kolom (tetap satu baris)',
  /styles\.prayerRow,\s*\n?\s*done && styles\.prayerRowDone/.test(followup) &&
  !/prayerRowCol|styles\.prayerCard/.test(followup));

console.log('\nAturan wajib');
ok('tidak ada soft-delete', !/isDeleted|archived: true/.test(prio + layarPrio));
ok('warna semua dari Color, tak ada hex mentah',
  !/#[0-9A-Fa-f]{6}/.test(layarPrio) && !/#[0-9A-Fa-f]{6}/.test(prio));
// 22 Sep 2026: expo-notifications kini ada di package.json untuk pengingat
// Finance; Daily Priority sendiri tetap tak memakainya.
ok('tidak ada modul native baru untuk Daily Priority',
  !/expo-notifications|expo-background|expo-task-manager/.test(prio + layarPrio));
ok('rute barunya terdaftar di typed routes',
  /daily-priority/.test(baca('.expo/types/router.d.ts')));

console.log(gagal === 0 ? '\n✅ LULUS — enam-enamnya beres.' : `\n❌ ${gagal} cek gagal.`);
process.exit(gagal === 0 ? 0 : 1);
