// 3 permintaan 15 Sep 2026 sore:
//  1 sub-tab Token: riwayat pemakaian + catatan meteran DIGABUNG jadi riwayat
//    per hari (tanggal di atas, tiap catatan + selang kWh & rupiahnya + catatan)
//  2 tab utama (Dashboard · Habits · Home · Profile · System) memantul saat
//    di-click, sama dengan sub-tab fitur
//  3 kartu Doa Syafaat di Home: ✕ kanan atas → konfirmasi → sembunyi sampai besok
const AKAR = require('./akar');
const BACA_TODAY = (p) => require('fs').readFileSync(AKAR + '/' + p, 'utf8').replace(/\r\n/g, '\n'); // 22 Sep 2026 Today OS
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const ROOT = AKAR + '/';
const KELUAR = path.join(__dirname, 'keluar-tiga-sore');

let gagal = 0;
function c(nama, ok) {
  console.log((ok ? '  ok  ' : '  GAGAL') + ' ' + nama);
  if (!ok) gagal++;
}
const baca = (f) => fs.readFileSync(ROOT + f, 'utf8');

// ================= 1. Riwayat harian =================
console.log('1. Riwayat pemakaian + catatan meteran = satu riwayat per hari');
{
  const tab = baca('components/residence/TokenTab.tsx');
  const lib = baca('lib/token.ts');

  c('lib/token.ts: dailyLog + tipe DayLog/DayLogEntry (reading, span, refill, kwh per hari)',
    /export function dailyLog\(readings: MeterReading\[\]\): DayLog\[\]/.test(lib) &&
      /export type DayLogEntry = \{[\s\S]*?reading: MeterReading;[\s\S]*?span: UsageSpan \| null;[\s\S]*?refill: boolean;/.test(lib) &&
      /export type DayLog = \{[\s\S]*?dayId: string;[\s\S]*?entries: DayLogEntry\[\];[\s\S]*?kwh: number;/.test(lib));
  c('sub-tab memakai dailyLog(readings) untuk daftarnya & paginasi per hari',
    /const riwayat = dailyLog\(readings\);/.test(tab) && /usePagination\(riwayat\)/.test(tab));
  c('bagian "📋 Catatan meteran" yang terpisah sudah tidak ada; judul Riwayat menyebut jumlah hari',
    !/📋 Catatan meteran/.test(tab) && /⚡ Riwayat Pemakaian \(\$\{riwayat\.length\} hari\)/.test(tab));
  c('kartu per hari: kepala tanggal (formatDayDate) + total kWh ≈ rupiah hari itu',
    /<View key=\{h\.dayId\} style=\{styles\.dayCard\}>/.test(tab) &&
      /📆 \{formatDayDate\(h\.date\)\}/.test(tab) &&
      /\{formatDecimal\(h\.kwh\)\} kWh ≈ \{rupiah\(h\.kwh\)\}/.test(tab));
  c('tiap catatan: jam + angka meteran + jenis, catatan 📝 kalau ada, click → openReadingEdit',
    /onPress=\{\(\) => openReadingEdit\(e\.reading\)\}/.test(tab) &&
      /\{meta\.icon\} \{formatTime\(e\.reading\.at\.toDate\(\)\)\}/.test(tab) &&
      /\{formatDecimal\(e\.reading\.kwh\)\} kWh · \{meta\.label\}/.test(tab) &&
      /\{e\.reading\.note \? \([\s\S]*?📝 \{e\.reading\.note\}/.test(tab));
  c('garis selang di bawah catatan: jenis + lama + kWh ≈ rupiah; token diisi ditandai 🔋',
    /\{e\.span\.atHome \? '🏠 Di rumah' : '🚪 Ditinggal'\}/.test(tab) &&
      /\{jamLabel\(e\.span\.hours\)\} · \{formatDecimal\(e\.span\.kwh\)\} kWh/.test(tab) &&
      /≈ \{rupiah\(e\.span\.kwh\)\}/.test(tab) && /🔋 Token diisi sebelum catatan berikutnya/.test(tab) &&
      /spanLineHome: \{ borderLeftColor: Color\.HOUSE_DARK \}/.test(tab));
  c('gaya daftar lama (spanRow/readingRow/spanRight) dibuang, tidak ada sisa',
    !/spanRow|readingRow|spanRight|spanKwh|spanRate/.test(tab));
  c('sticky index tetap [5] & catatannya menyebut daftar per hari',
    /^const STICKY_HEADERS = \[5\];/m.test(tab) && /6 daftar Riwayat\s*\n\s*\* \(per hari/.test(tab));

  // dailyLog dijalankan sungguhan.
  try {
    execFileSync('node', [
      ROOT + 'node_modules/typescript/bin/tsc', '--ignoreConfig', '--outDir', KELUAR,
      '--module', 'commonjs', '--target', 'es2020', '--skipLibCheck', '--esModuleInterop',
      ROOT + 'lib/token.ts', ROOT + 'lib/format.ts',
    ], { stdio: 'ignore' });
  } catch {
    // galat tipe saja
  }
  const Module = require('module');
  const asliLoad = Module._load;
  Module._load = function (request) {
    if (request === 'firebase/firestore') return { doc: () => ({}), setDoc: async () => {}, Timestamp: {} };
    if (request === './firebase') return { db: {} };
    if (request === './liveDoc') return { liveDoc: () => () => {} };
    return asliLoad.apply(this, arguments);
  };
  const token = require(path.join(KELUAR, 'token.js'));
  Module._load = asliLoad;

  const ts = (y, m, d, h, mi) => {
    const dt = new Date(y, m - 1, d, h, mi);
    return { toMillis: () => dt.getTime(), toDate: () => dt };
  };
  const r = (id, at, kwh, kind, note = '') => ({ id, at, kwh, kind, note });
  const readings = [
    r('a', ts(2026, 9, 14, 7, 30), 120, 'out', 'berangkat'),
    r('b', ts(2026, 9, 14, 18, 0), 118.8, 'home', 'AC nyala'),
    r('c', ts(2026, 9, 15, 7, 30), 116.4, 'out'),
    r('d', ts(2026, 9, 15, 18, 0), 200, 'home', 'habis isi token'), // meteran NAIK = token diisi
    r('e', ts(2026, 9, 16, 7, 0), 197.5, 'out'),
  ];
  const hari = token.dailyLog([...readings].reverse()); // urutan masukan sengaja diacak
  c('dailyLog: 3 hari, terbaru di atas, id hari lokal',
    hari.length === 3 && hari.map((h) => h.dayId).join(',') === '2026-09-16,2026-09-15,2026-09-14');
  const h14 = hari[2];
  c('14 Sep: 2 catatan urut jam naik; selang a→b (ditinggal 10,5 jam, 1,2 kWh) & b→c (di rumah 13,5 jam, 2,4 kWh); total 3,6',
    h14.entries.map((e) => e.reading.id).join('') === 'ab' &&
      !h14.entries[0].span.atHome && Math.abs(h14.entries[0].span.hours - 10.5) < 1e-9 && Math.abs(h14.entries[0].span.kwh - 1.2) < 1e-9 &&
      h14.entries[1].span.atHome && Math.abs(h14.entries[1].span.hours - 13.5) < 1e-9 && Math.abs(h14.entries[1].span.kwh - 2.4) < 1e-9 &&
      Math.abs(h14.kwh - 3.6) < 1e-9);
  const h15 = hari[1];
  c('15 Sep: c→d ditandai refill (span null), d→e selang biasa; total hanya dari selang yang sah',
    h15.entries[0].reading.id === 'c' && h15.entries[0].span === null && h15.entries[0].refill === true &&
      h15.entries[1].reading.id === 'd' && h15.entries[1].span !== null && !h15.entries[1].refill &&
      Math.abs(h15.kwh - 2.5) < 1e-9);
  c('16 Sep: catatan terakhir tanpa selang & tanpa refill; hari kosong → []',
    hari[0].entries.length === 1 && hari[0].entries[0].span === null && hari[0].entries[0].refill === false && hari[0].kwh === 0 &&
      token.dailyLog([]).length === 0);
}

// ================= 2. Tab utama memantul =================
console.log('2. Tab utama memantul seperti sub-tab fitur');
{
  const bt = baca('components/common/BottomTabs.tsx');
  const ikon = baca('components/bounce-tab-icon.tsx');
  const haptic = baca('components/haptic-tab.tsx');
  // 22 Sep 2026: RaisedHomeTab dibuang; tab utama = Today · Walk · CORE · Work · Life.
  const home = baca('components/haptic-tab.tsx');
  const layout = baca('app/(tabs)/_layout.tsx');

  c('useTabJump diekstrak & diekspor dari BottomTabs (lompat hanya saat berpindah, bukan saat pertama dibuka)',
    /export function useTabJump\(active: boolean\)/.test(bt) &&
      /if \(active && mounted\.current\) \{\s*jump\.value = withSequence\(\s*withTiming\(1, \{ duration: 130 \}\),\s*withSpring\(0, \{ damping: 8, stiffness: 260 \}\),/.test(bt) &&
      /scale: 1 \+ jump\.value \* 0\.25/.test(bt) && /translateY: jump\.value \* -4/.test(bt));
  c('Tab sub-fitur memakai hook yang sama (tidak ada dua salinan animasinya)',
    /const iconStyle = useTabJump\(active\);/.test(bt) && (bt.match(/withSequence\(/g) || []).length === 1);
  c('BounceTabIcon: ikon 28pt di dalam Animated.View ber-useTabJump(focused)',
    // 24 Sep 2026: warna ikonnya kini bercabang — yang aktif memakai mint
    // sendiri (TABBAR_ACTIVE) di atas pil emerald, yang lain memakai warna
    // dari navigator. Ukuran 28pt & bungkus Animated.View-nya tidak berubah.
    /const lompat = useTabJump\(focused\);/.test(ikon) &&
    /<Animated\.View style=\{lompat\}>\s*<IconSymbol\s+size=\{28\}\s+name=\{name\}\s+color=\{focused \? Color\.TABBAR_ACTIVE : color\}\s*\/>/.test(ikon));
  c('_layout: kelima tab (Today, Walk, CORE, Work, Life) memakai BounceTabIcon dengan focused; IconSymbol tak diimpor langsung lagi',
    ['house.fill', 'bird.fill', 'person.2.fill', 'briefcase.fill', 'line.3.horizontal'].every((n) =>
      new RegExp('tabBarIcon: \\(\\{ color, focused \\}\\) => \\(\\s*<BounceTabIcon name="' + n.replace(/\./g, '\\.') + '" color=\\{color\\} focused=\\{focused\\} \\/>').test(layout)) &&
      !/import \{ IconSymbol \}/.test(layout));
  // 16 Sep 2026 (/rapihin): pegas + getarannya pindah ke hooks/useTabPress —
  // satu tempat untuk kedua tombol; yang dijaga tetap rasa yang sama.
  const tabPress = baca('hooks/useTabPress.ts');
  c('useTabPress: mengecil saat disentuh (Animated.spring 0,94 → 1) + getar halus lewat lib/haptics',
    /Animated\.spring\(scale, \{ toValue, \.\.\.SPRING \}\)\.start\(\)/.test(tabPress) &&
      /scaleStyle: \{ transform: \[\{ scale \}\] \}/.test(tabPress) &&
      /onPressIn: \(ev\) => \{\s*pegas\(0\.94\);\s*haptic\('light'\);\s*onPressIn\?\.\(ev\);/.test(tabPress) &&
      /onPressOut: \(ev\) => \{\s*pegas\(1\);\s*onPressOut\?\.\(ev\);/.test(tabPress) &&
      /useNativeDriver: true/.test(tabPress));
  c('HapticTab memakai hook itu lewat style PlatformPressable',
    /const sentuh = useTabPress\(onPressIn, onPressOut\);/.test(haptic) &&
      /style=\{\[style, sentuh\.scaleStyle\]\}/.test(haptic) &&
      /onPressIn=\{sentuh\.onPressIn\}\s*\n\s*onPressOut=\{sentuh\.onPressOut\}/.test(haptic));
  c('RaisedHomeTab sudah tidak ada; tombol Home timbul diganti tab Today biasa (22 Sep 2026)',
    !require('fs').existsSync(AKAR + '/components/raised-home-tab.tsx') &&
      /name="index"/.test(layout) && /title: 'Today'/.test(layout));
  c('pegasnya sama dengan PressableScale (damping 15, stiffness 320, mass 0,5), ditulis SEKALI',
    /damping: 15, stiffness: 320, mass: 0\.5/.test(tabPress) &&
      ![haptic, home].some((s) => /damping: 15|Animated\.Value|expo-haptics/.test(s)) &&
      /damping: 15, stiffness: 320, mass: 0\.5/.test(baca('components/common/PressableScale.tsx')));
}

// ================= 3. ✕ Doa Syafaat =================
console.log('3. Kartu Doa Syafaat: ✕ → konfirmasi → sembunyi sampai besok');
{
  const hook = baca('hooks/useDailyDismiss.ts');
  const card = baca('components/common/ReminderCard.tsx');
  const home = baca('app/(tabs)/index.tsx');

  c('useDailyDismiss: simpan dayId ke AsyncStorage (per hari), dismissed = tersimpan === todayId',
    /AsyncStorage\.getItem\(key\)/.test(hook) && /AsyncStorage\.setItem\(key, todayId\)/.test(hook) &&
      /return \{ dismissed: closedDay === todayId, dismiss \};/.test(hook) && !/firestore|setDoc/.test(hook));
  c('ReminderCard: prop onClose → ✕ (IconSymbol xmark) di pojok kanan atas sebagai SAUDARA badan teks, bukan anak Pressable',
    /onClose\?: \(\) => void;/.test(card) &&
      /const tutup = onClose \? \(\s*<PressableScale\s+style=\{styles\.closeButton\}\s+onPress=\{onClose\}/.test(card) &&
      /<IconSymbol name="xmark" size=\{13\} color=\{fg\} \/>/.test(card) &&
      /if \(action \|\| onClose\) \{[\s\S]*?<PressableScale onPress=\{onPress\}>[\s\S]*?<\/PressableScale>\s*\{action \? <View style=\{styles\.actionRow\}>\{action\}<\/View> : null\}\s*\{tutup\}/.test(card) &&
      /closeButton: \{\s*position: 'absolute',\s*top: 10,\s*right: 12,/.test(card));
  c('judul diberi ruang kanan saat ada ✕; mode per-baris juga menampilkan ✕',
    /onClose \? styles\.titleRoom : undefined/.test(card) && /titleRoom: \{ paddingRight: 28 \}/.test(card) &&
      // 21 Sep 2026: judul+isi dibungkus {badan} (bisa membawa lambang pojok), ✕ tetap saudaranya.
      /if \(onItemPress\) \{\s*return \(\s*<View style=\{cardStyle\}>\s*\{badan\}\s*\{tutup\}/.test(card));
  // 22 Sep 2026 (Today OS): Doa Syafaat jadi BARIS di hero With God. Kunci
  // "tutup untuk hari ini" tetap useDailyDismiss('home:intercession') (di
  // hooks/useTodayData), tapi tanpa ✕ & dialog: pokok doanya dibuka di tempat,
  // lalu "✓ Sudah didoakan hari ini" menandainya (baris jadi ✓ redup).
  const dataToday = BACA_TODAY('hooks/useTodayData.ts');
  const hero = BACA_TODAY('components/today/GodHero.tsx');
  c('Today: useDailyDismiss("home:intercession", todayId) tetap kuncinya; baris syafaat ✓ saat sudah ditutup',
    /const intercessionDismiss = useDailyDismiss\('home:intercession', todayId\);/.test(dataToday) &&
      /intercessionDismissed: dismissed,/.test(dataToday) &&
      /done: input\.intercessionDismissed,/.test(BACA_TODAY('lib/today.ts')));
  c('hero: "✓ Sudah didoakan hari ini" memanggil dismiss (tanpa dialog), pokok doanya terbuka di tempat',
    /onDismissIntercession=\{intercessionDismiss\.dismiss\}/.test(home) &&
      /✓ Sudah didoakan hari ini/.test(hero) && /onDismissIntercession\(\);/.test(hero) &&
      /intercession\.points\.map\(/.test(hero));
  // 23 Sep 2026: syafaat jadi bagian keempat 🌙 Night Prayer, jadi barisnya
  // menuju ke sana. Buka/tutup pokok doanya di tempat tetap seperti dulu.
  c('perilaku lain tetap: barisnya menuju Night Prayer, pokok doanya tetap bisa dibuka di tempat',
    /href: \{ pathname: '\/night-prayer' \},/.test(BACA_TODAY('lib/today.ts')) &&
      /setOpenPrayer\(\(v\) => !v\)/.test(hero));

  const semua = [hook, card, home.slice(0, 2000)].join('\n');
  c('istilah: tanpa tekan/ketuk/tap/klik di hook & kartu',
    !/ketuk|tekan|\btap\b|\bklik/i.test(hook + '\n' + card) && semua.length > 0);
}

console.log(gagal === 0 ? 'CEK-TIGA-15SEP-SORE OK' : gagal + ' gagal');
process.exit(gagal === 0 ? 0 : 1);
