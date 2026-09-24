// 21 Sep 2026: langganan lewat useLiveAll → `subscribeX(uid, …)`, bukan `user.uid`.
// 5 permintaan 15 Sep 2026 pagi:
//  1 badge Token (Residence) ikut dijumlahkan ke tile Residence di Home
//  2 tombol 🔖 di header News tanpa badge
//  3 ganti sumber berita → daftar langsung dari atas
//  4 password di Login: 👁️ lihat/sembunyikan + ✕ hapus semua
//  5 air putih jadi tombol MENGAMBANG global (seret, 1× +1, 2× −1, cincin +
//    animasi air), kecuali gerbang pagi & fitur CORE
const AKAR = require('./akar');
const BACA_TODAY = (p) => require('fs').readFileSync(AKAR + '/' + p, 'utf8').replace(/\r\n/g, '\n'); // 22 Sep 2026 Today OS
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const ROOT = AKAR + '/';
const KELUAR = path.join(__dirname, 'keluar-lima');

let gagal = 0;
function c(nama, ok) {
  console.log((ok ? '  ok  ' : '  GAGAL') + ' ' + nama);
  if (!ok) gagal++;
}
const baca = (f) => fs.readFileSync(ROOT + f, 'utf8');

// ================= 1. Badge Residence =================
console.log('1. Badge Token ikut ke tile Residence');
{
  const home = baca('app/(tabs)/index.tsx');
  const res = baca('app/residence.tsx');
  // 22 Sep 2026: badge tile → baris Today; langganannya di useTodayData.
  const dataToday = BACA_TODAY('hooks/useTodayData.ts');
  c('Today melanggan catatan meteran & menandainya sebagai sumber',
    /subscribeMeterReadings\(uid, mark\('readings', setMeterReadings\), fail\)/.test(dataToday) &&
      /const SOURCES = \d+;/.test(dataToday));
  c('Today: baris perawatan rumah (residenceAttentionList) + baris meteran (readingDue) dari rumus yang sama',
    /residenceAttentionList\(input\.residenceChores, now\)/.test(BACA_TODAY('lib/today.ts')) &&
      /if \(readingDue\(input\.meterReadings, now\)\)/.test(BACA_TODAY('lib/today.ts')));
  c('rumusnya sama persis dengan badge sub-tab Token di Residence',
    /token: readingDue\(readings \?\? \[\], new Date\(\)\) \? 1 : 0,/.test(res) &&
      /chores: countResidenceAttention\(chores \?\? \{\}, new Date\(\)\),/.test(res));
  c('langganannya satu dokumen (liveDoc), bukan koleksi', /export function subscribeMeterReadings[\s\S]{0,200}liveDoc\(/.test(baca('lib/token.ts')));
}

// ================= 2. News: 🔖 tanpa badge =================
console.log('2. Tombol bookmark News tanpa badge');
{
  const s = baca('app/news.tsx');
  c('EmojiButton bookmark.fill tidak lagi membawa prop badge',
    /<EmojiButton\s*\n\s*icon="bookmark\.fill"\s*\n\s*onPress=\{\(\) => router\.push\('\/news-saved'\)\}\s*\n\s*\/>/.test(s) &&
      !/badge=\{bookmarks\.length\}/.test(s));
  c('daftar tersimpannya tetap dipakai (NewsTab)', /bookmarks=\{bookmarks\}/.test(s));
}

// ================= 3. Ganti sumber → ke atas =================
console.log('3. Ganti sumber berita → gulung ke atas');
{
  const s = baca('components/news/NewsTab.tsx');
  c('sumber beda: setSource lalu scrollTo y 0 tanpa animasi, tanpa reload paksa',
    /if \(key !== source\) \{[\s\S]{0,300}setSource\(key\);\s*\n\s*listRef\.current\?\.scrollTo\(\{ y: 0, animated: false \}\);\s*\n\s*return;/.test(s));
  c('sumber sama: tetap muat ulang + gulung ke atas', /reload\(\);\s*\n\s*listRef\.current\?\.scrollTo\(\{ y: 0, animated: true \}\);/.test(s));
}

// ================= 4. Password =================
console.log('4. Login: lihat password & hapus semua');
{
  const s = baca('app/login.tsx');
  c('ada penanda showPassword, bawaannya tersembunyi', /const \[showPassword, setShowPassword\] = useState\(false\);/.test(s));
  c('secureTextEntry mengikuti penandanya', /secureTextEntry=\{!showPassword\}/.test(s));
  c('ikon mata: eye saat tersembunyi, eye.slash saat terlihat', /name=\{showPassword \? 'eye\.slash' : 'eye'\}/.test(s));
  c('✕ hanya muncul kalau sudah ada isinya, dan mengosongkan semuanya',
    /\{password\.length > 0 && \([\s\S]{0,200}onPress=\{\(\) => setPassword\(''\)\}[\s\S]{0,200}name="xmark"/.test(s));
  c('ikonnya di dalam kolom (absolute, kanan) & teksnya diberi ruang',
    /passwordInput: \{ paddingRight: 84 \}/.test(s) && /passwordTools: \{\s*position: 'absolute',\s*right: 14/.test(s));
  c('ikon eye/eye.slash/xmark memang ada di peta ikon',
    /'eye': /.test(baca('components/ui/icon-symbol.tsx')) && /'eye\.slash': /.test(baca('components/ui/icon-symbol.tsx')) && /'xmark': /.test(baca('components/ui/icon-symbol.tsx')));
}

// ================= 5. Tombol air mengambang =================
console.log('5. WaterFloat: global, seret, 1× +1, 2× −1, cincin + animasi air');
{
  const s = baca('components/habits/WaterFloat.tsx');
  const layout = baca('app/_layout.tsx');
  const home = baca('app/(tabs)/index.tsx');
  c('dipasang SEKALI di root layout, hanya saat sudah login', /\{!!user && <WaterFloat \/>\}/.test(layout));
  // 15 Sep siang: ikut sembunyi di Wheel/Timeline milik CL (?leaderId=), dan
  // muncul/hilangnya memudar (tetap terpasang, cuma pudar + tak bisa disentuh).
  c('menyembunyikan diri di gerbang pagi, login, seluruh fitur CORE, & Wheel/Timeline CL',
    /pathname\.startsWith\('\/morning-journey'\)/.test(s) && /pathname\.startsWith\('\/login'\)/.test(s) &&
      /featureKeyForRoute\(pathname\) === 'core'/.test(s) &&
      /\(\(pathname\.startsWith\('\/wheel'\) \|\| pathname\.startsWith\('\/timeline'\)\) && !!leaderId\)/.test(s) &&
      /useGlobalSearchParams<\{ leaderId\?: string \}>\(\)/.test(s));
  c('rodaku & timeline-ku sendiri (tanpa leaderId) tetap dapat tombolnya',
    !/pathname\.startsWith\('\/wheel'\) \|\|\s*$/m.test(s) && /&& !!leaderId\)/.test(s));
  // 15 Sep 2026 malam: muncul MEMANTUL (pegas), bukan cuma memudar.
  c('muncul memantul: opacity timing + skala pegas 0,6 → 1 (damping rendah), hilang memudar & mengecil; bukan return null',
    /const tampak = useSharedValue\(0\);/.test(s) && /const pantul = useSharedValue\(SKALA_SEMBUNYI\);/.test(s) &&
      /const SKALA_SEMBUNYI = 0\.6;/.test(s) &&
      /if \(sembunyi\) \{\s*tampak\.value = withTiming\(0, \{ duration: 240/.test(s) &&
      /pantul\.value = withTiming\(SKALA_SEMBUNYI, \{ duration: 240/.test(s) &&
      /tampak\.value = withTiming\(1, \{ duration: 200/.test(s) &&
      /pantul\.value = withSpring\(1, \{ damping: 8, stiffness: 220, mass: 0\.8 \}\);/.test(s) &&
      /opacity: tampak\.value/.test(s) && /scale: pantul\.value \* \(1 - menekan\.value \* 0\.08\)/.test(s) &&
      !/if \(sembunyi\) return null;/.test(s));
  c('air hidup: gelombang bergeser TERUS selama tampil (withRepeat -1, linear, 1 gelas per putaran), dihentikan saat tersembunyi',
    /const PUTARAN_MS = 1800;/.test(s) &&
    /geser\.value = 0;\s*geser\.value = withRepeat\(\s*withTiming\(-INNER, \{ duration: PUTARAN_MS, easing: Easing\.linear \}\),\s*-1,\s*false,\s*\);/.test(s) &&
      /if \(sembunyi\) \{[\s\S]{0,400}cancelAnimation\(geser\);\s*return;/.test(s));
  // 15 Sep 2026 malam: lewat target (9/8) → tombolnya pamit sampai besok.
  c('hilang sendiri begitu lewat target (water > WATER_GOAL) — 8/8 masih tampil; kembali besok lewat HabitDay baru',
    /&& !!leaderId\) \|\|\s*water > WATER_GOAL;/.test(s) && !/water >= WATER_GOAL \|\|/.test(s) &&
      /subscribeHabitDay\(uid, todayId, setDay\)/.test(s));
  c('bergoyang saat diseret: permukaan miring ikut velocityX (pegas), riak naik sesuai laju; dilepas → berayun balik (damping rendah) & riak meluruh',
    /const miring = useSharedValue\(0\);/.test(s) && /const MIRING_MAKS = 16;/.test(s) && /const MIRING_PER_PXS = 70;/.test(s) &&
      /const sasaran = Math\.min\(Math\.max\(e\.velocityX \/ MIRING_PER_PXS, -MIRING_MAKS\), MIRING_MAKS\);\s*miring\.value = withSpring\(sasaran, \{ damping: 12, stiffness: 160, mass: 0\.6 \}\);/.test(s) &&
      /const laju = Math\.abs\(e\.velocityX\) \+ Math\.abs\(e\.velocityY\);\s*riak\.value = Math\.min\(RIAK_TENANG \+ laju \/ 350, 6\);/.test(s) &&
      /\.onEnd\(\(\) => \{[\s\S]{0,400}miring\.value = withSpring\(0, \{ damping: 6, stiffness: 140, mass: 0\.9 \}\);\s*riak\.value = withTiming\(RIAK_TENANG, \{ duration: 1500/.test(s) &&
      /transform: \[\{ rotate: `\$\{miring\.value\}deg` \}\]/.test(s));
  c('badan air melebar ½ gelas ke kiri/kanan/bawah (tepinya tak pernah masuk gelas saat miring); gelombang 3 gelas',
    /air: \{\s*position: 'absolute',\s*left: -INNER \/ 2,\s*right: -INNER \/ 2,\s*bottom: -INNER \/ 2,/.test(s) &&
      /height: INNER \/ 2 \+ INNER \* Math\.min\(1\.15, Math\.max\(0, isi\.value\)\)/.test(s) &&
      /<Svg width=\{INNER \* 3\} height=\{14\}>/.test(s) && /width: INNER \* 3,/.test(s) &&
      /T \$\{w \* 2\.5\} \$\{y\} T \$\{w \* 3\} \$\{y\} V 14 H 0 Z/.test(s));
  c('percikan: riak melonjak (RIAK_PERCIK) lalu meluruh ke RIAK_TENANG (bukan 0) saat muncul & saat angka berubah',
    /const RIAK_TENANG = 1\.6;/.test(s) && /const RIAK_PERCIK = 4;/.test(s) &&
      (s.match(/riak\.value = RIAK_PERCIK;\s*riak\.value = withTiming\(RIAK_TENANG, \{ duration: 1[69]00, easing: Easing\.out\(Easing\.quad\) \}\);/g) || []).length === 2 &&
      !/riak\.value = withTiming\(0,/.test(s));
  c('saat tersembunyi tidak bisa disentuh (pointerEvents none), sebelum login tidak digambar',
    /pointerEvents=\{sembunyi \? 'none' : 'auto'\}/.test(s) && /if \(!user\) return null;/.test(s) &&
      s.indexOf('if (!user) return null;') > s.lastIndexOf('useAnimatedProps('));
  c('data dari langganan yang sama dengan Home (HabitDay hari ini + streak air)',
    /subscribeHabitDay\(uid, todayId, setDay\)/.test(s) && /subscribeWaterStreak\(uid, setStreak\)/.test(s));
  // 15 Sep siang: click tunggal lewat Exclusive(dobel, tunggal) di worklet tidak
  // pernah sampai ke ubah() di HP → satu Tap di JS thread + penghitung sendiri.
  c('1× click = +1, 2× click = −1: satu Tap di JS thread (runOnJS(true)) + penghitung jeda 280 ms',
    /const click = Gesture\.Tap\(\)\s*\n\s*\.maxDuration\(300\)\s*\n\s*\.runOnJS\(true\)/.test(s) &&
      /\.onEnd\(\(\) => \{\s*\n\s*catatClick\(\);/.test(s) &&
      /hitungClick\(\s*\n\s*\(\) => void ubah\(1\),\s*\n\s*\(\) => void ubah\(-1\),\s*\n\s*\)/.test(s) &&
      /const JEDA_DOBEL = 280;/.test(s) && !/Gesture\.Exclusive\(dua/.test(s));
  c('penghitung click-nya closure modul (timer dibersihkan saat click kedua), seret tetap Pan di UI thread (Race)',
    /function buatPenghitungClick\(jeda: number\) \{\s*\n\s*let timer/.test(s) &&
      /clearTimeout\(timer\);\s*\n\s*timer = null;\s*\n\s*dobel\(\);/.test(s) &&
      /Gesture\.Race\(seret, click\)/.test(s) && /const seret = Gesture\.Pan\(\)/.test(s) && !/seret[\s\S]{0,400}runOnJS\(true\)/.test(s.slice(s.indexOf('const seret'), s.indexOf('const click'))));
  c('menyimpan lewat setWater + bumpWaterStreak saat mencapai WATER_GOAL (aturan lama Home)',
    /await setWater\(user\.uid, todayId, next\);/.test(s) && /if \(next >= WATER_GOAL\) await bumpWaterStreak\(user\.uid, streak, todayId\);/.test(s));
  c('dilepas → menempel ke tepi kiri/kanan (withSpring) & letaknya disimpan (sisi + tinggi relatif)',
    /const kiri = x\.value \+ SIZE \/ 2 < width \/ 2;/.test(s) && /withSpring\(kiri \? MARGIN : width - SIZE - MARGIN/.test(s) &&
      /runOnJS\(simpanLetak\)\(kiri \? 'left' : 'right'/.test(s) && /AsyncStorage\.setItem\(KUNCI_LETAK/.test(s));
  c('dibatasi ruang aman layar (insets) & dihitung ulang saat layar berubah (iPad diputar)',
    /const atas = insets\.top \+ 8;/.test(s) && /const bawah = height - insets\.bottom - SIZE - 8;/.test(s) &&
      /\}, \[width, height, insets\.top, insets\.bottom\]\);/.test(s));
  c('cincin kemajuan 0..8 (AnimatedCircle strokeDashoffset) seperti donat Habits',
    /AnimatedCircle/.test(s) && /strokeDashoffset: KELILING \* \(1 - /.test(s) && /\{water\}\/\{WATER_GOAL\}/.test(s));
  // 15 Sep 2026 malam: geseran gelombang tak lagi 3 putaran per perubahan —
  // ia berjalan terus selama tampil (lihat cek di atas); perubahan angka cuma
  // memercikkan riaknya.
  c('air naik/turun dengan pegas; perubahan angka tidak menyentuh geseran (tidak ada withRepeat 3 putaran lagi)',
    /isi\.value = withSpring\(pct/.test(s) && !/withRepeat\(withTiming\(-INNER, \{ duration: 650/.test(s) &&
      (s.match(/withRepeat\(/g) || []).length === 1);
  c('buka app: langsung di posisinya, tidak "mengisi" dari nol', /if \(!day\) return;[\s\S]{0,200}pertama\.current = false;\s*\n\s*isi\.value = pct;/.test(s));
  c('getaran: ringan saat tambah, peringatan saat kurang', /haptic\(delta > 0 \? 'light' : 'warning'\)/.test(s));
  c('warna air dari palet (WATER, WATER_DARK, WATER_LIGHT), bukan hex di komponen',
    /WATER: '#/.test(baca('assets/style/color.ts')) && /Color\.WATER_LIGHT/.test(s) && !/#[0-9A-Fa-f]{6}/.test(s));
  c('Today tidak lagi mengurus air (kartu, changeWater, streak) tapi tetap memakai HabitDay untuk rhema',
    !/changeWater|waterCard|subscribeWaterStreak|bumpWaterStreak/.test(home) &&
      /subscribeHabitDay\(uid, todayId, mark\('day', setDay\), fail\)/.test(BACA_TODAY('hooks/useTodayData.ts')));
  c('istilah: "click", bukan tap/ketuk/tekan, di komentar & teksnya',
    !/ketuk|tekan|\btap\b/i.test(s.replace(/Gesture\.Tap\(\)/g, '')));
}

// featureKeyForRoute dijalankan sungguhan: pathname dari usePathname() (dengan
// garis miring di depan, id dokumen di belakang) harus dikenali.
try {
  execFileSync('node', [
    ROOT + 'node_modules/typescript/bin/tsc', '--ignoreConfig', '--outDir', KELUAR,
    '--module', 'commonjs', '--target', 'es2020', '--skipLibCheck', '--esModuleInterop',
    ROOT + 'lib/featureTheme.ts',
  ], { stdio: 'ignore' });
} catch {
  // galat tipe saja
}
{
  // featureTheme.ts mengimpor palet & grid Home lewat alias '@/…' — distub;
  // featureKeyForRoute sendiri cuma memakai tabel ROUTE_FEATURE.
  const Module = require('module');
  const asliLoad = Module._load;
  Module._load = function (request) {
    if (request === '@/assets/style/color') return { Color: new Proxy({}, { get: () => '#000000' }) };
    if (request === '@/lib/featureGrid') return { HOME_FEATURES: [] };
    return asliLoad.apply(this, arguments);
  };
  const ft = require(path.join(KELUAR, 'featureTheme.js'));
  Module._load = asliLoad;
  const k = (p) => ft.featureKeyForRoute(p);
  c('pathname fitur CORE → "core": /core, /core/monthly/abc, /visitations, /monthly-prayers, /core-rules',
    ['/core', '/core/monthly/abc', '/visitations', '/monthly-prayers', '/core-rules', '/chat-templates', '/ex-leaders', '/leader-criteria', '/multiplication/x']
      .every((p) => k(p) === 'core'));
  c('layar lain tetap tampil: /, /habits, /wheel, /timeline, /health, /news',
    ['/', '/habits', '/wheel', '/timeline', '/health', '/news'].every((p) => k(p) !== 'core'));
}

console.log(gagal === 0 ? 'CEK-LIMA-15SEP OK' : gagal + ' gagal');
process.exit(gagal === 0 ? 0 : 1);
