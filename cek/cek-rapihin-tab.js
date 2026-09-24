// /rapihin 16 Sep 2026: rasa sentuh tab utama (pegas + getar) jadi satu hook
// bersama (hooks/useTabPress); expo-haptics hanya disentuh lib/haptics.
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');

const ROOT = AKAR;
const baca = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
const semua = ['app', 'components', 'hooks', 'lib'].flatMap(function jelajah(d) {
  return fs.readdirSync(path.join(ROOT, d), { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? jelajah(d + '/' + e.name) : /\.tsx?$/.test(e.name) ? [d + '/' + e.name] : []);
});

let gagal = 0;
function ok(nama, syarat, info = '') {
  if (syarat) console.log(`  ✅ ${nama}`);
  else { gagal++; console.log(`  ❌ ${nama}${info ? ` — ${info}` : ''}`); }
}

const hook = baca('hooks/useTabPress.ts');
const haptic = baca('components/haptic-tab.tsx');
// 22 Sep 2026: RaisedHomeTab dibuang (Today = tab pertama biasa); yang
// tersisa HapticTab untuk kelima tab.
const home = baca('components/haptic-tab.tsx');
const lib = baca('lib/haptics.ts');

console.log('\n=== Satu pintu getaran ===');
const langsung = semua.filter((f) => f !== 'lib/haptics.ts' && /expo-haptics/.test(baca(f)));
ok('expo-haptics cuma diimpor lib/haptics.ts', langsung.length === 0, langsung.join(', '));
ok('lib/haptics tetap iOS-saja & menelan galat (tembak & lupakan)',
  /if \(process\.env\.EXPO_OS !== 'ios'\) return;/.test(lib) && /trigger\(kind\)\.catch\(\(\) => \{\}\);/.test(lib));

console.log('\n=== useTabPress: rasa yang sama persis dengan sebelumnya ===');
ok('pegas PressableScale + useNativeDriver, Animated.Value dibuat sekali (useState lazy)',
  /const SPRING = \{ damping: 15, stiffness: 320, mass: 0\.5, useNativeDriver: true \};/.test(hook) &&
  /const \[scale\] = useState\(\(\) => new Animated\.Value\(1\)\);/.test(hook));
ok('sentuh: mengecil 0,94 → getar light → onPressIn bawaan; lepas: 1 → onPressOut bawaan',
  /onPressIn: \(ev\) => \{\s*pegas\(0\.94\);\s*haptic\('light'\);\s*onPressIn\?\.\(ev\);\s*\}/.test(hook) &&
  /onPressOut: \(ev\) => \{\s*pegas\(1\);\s*onPressOut\?\.\(ev\);\s*\}/.test(hook));
ok('tipe onPressIn diambil dari BottomTabBarButtonProps (tidak menebak sendiri)',
  /type Sentuhan = BottomTabBarButtonProps\['onPressIn'\];/.test(hook));

console.log('\n=== Kedua tombol memakainya, tanpa salinan ===');
ok('HapticTab: style bawaan + scaleStyle, props lain tetap {...rest}',
  /const sentuh = useTabPress\(onPressIn, onPressOut\);/.test(haptic) &&
  /style=\{\[style, sentuh\.scaleStyle\]\}/.test(haptic) && /\{\.\.\.rest\}/.test(haptic));
ok('RaisedHomeTab sudah tidak ada (22 Sep 2026); kelima tab memakai HapticTab',
  !require('fs').existsSync(AKAR + '/components/raised-home-tab.tsx') &&
  !/RaisedHomeTab/.test(baca('app/(tabs)/_layout.tsx')));
ok('tidak ada lagi SPRING / Animated.Value / pegas di kedua tombol',
  ![haptic, home].some((s) => /SPRING|Animated\.Value|const pegas/.test(s)));
ok('tab bawah memasang HapticTab untuk semua tab (RaisedHomeTab dibuang 22 Sep 2026)',
  /tabBarButton: HapticTab,/.test(baca('app/(tabs)/_layout.tsx')) &&
  !/RaisedHomeTab/.test(baca('app/(tabs)/_layout.tsx')));

console.log(gagal === 0 ? '\n✅ LULUS — rasa sentuh tab utama satu sumber.' : `\n❌ ${gagal} cek gagal.`);
process.exit(gagal === 0 ? 0 : 1);
