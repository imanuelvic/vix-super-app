// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolWeight, type SFSymbol } from 'expo-symbols';
import { ComponentProps } from 'react';
import { OpaqueColorValue, type StyleProp, type TextStyle } from 'react-native';

type IconMapping = Record<SFSymbol, ComponentProps<typeof MaterialIcons>['name']>;
type IconSymbolName = keyof typeof MAPPING;

/**
 * Add your SF Symbols to Material Icons mappings here.
 * - see Material Icons in the [Icons Directory](https://icons.expo.fyi).
 * - see SF Symbols in the [SF Symbols](https://developer.apple.com/sf-symbols/) app.
 */
const MAPPING = {
  'house.fill': 'home',
  'square.grid.2x2.fill': 'dashboard',
  'checklist': 'checklist',
  'chevron.right': 'chevron-right',
  'chevron.left': 'chevron-left',
  'chevron.up': 'expand-less',
  'chevron.down': 'expand-more',
  'eye': 'visibility',
  'eye.slash': 'visibility-off',
  'chart.pie.fill': 'pie-chart',
  'list.bullet': 'format-list-bulleted',
  'chart.bar.fill': 'bar-chart',
  'rectangle.portrait.and.arrow.right': 'logout',
  'arrow.triangle.2.circlepath': 'sync',
  'arrow.triangle.branch': 'call-split',
  'gearshape.fill': 'settings',
  'bell.fill': 'notifications',
  'heart.fill': 'favorite',
  'stethoscope': 'medical-services',
  'pencil': 'edit',
  'person.2.fill': 'groups',
  'trophy.fill': 'emoji-events',
  'person.crop.circle.fill': 'account-circle',
  'bubble.left.fill': 'chat',
  'chart.line.uptrend.xyaxis': 'trending-up',
  'arrow.left.arrow.right': 'swap-horiz',
  'bitcoinsign.circle.fill': 'currency-bitcoin',
  'dollarsign.circle.fill': 'paid',
  'car.fill': 'directions-car',
  'target': 'track-changes',
  'book.closed.fill': 'menu-book',
  'books.vertical.fill': 'auto-stories',
  'calendar': 'event',
  'briefcase.fill': 'work',
  'person.3.fill': 'family-restroom',
  'ellipsis': 'more-horiz',
  'magnifyingglass': 'search',
  'repeat': 'repeat',
  'laptopcomputer': 'laptop',
  'globe': 'public',
  'newspaper.fill': 'newspaper',
  'shield.fill': 'shield',
  'cart.fill': 'shopping-cart',
  'wrench.and.screwdriver.fill': 'build',
  'bolt.fill': 'bolt',
  'info.circle.fill': 'info',
  'banknote': 'account-balance-wallet',
  'plus': 'add',
  'checkmark': 'check',
  'xmark': 'close',
  'arrow.up.circle.fill': 'arrow-circle-up',
  'arrow.down.circle.fill': 'arrow-circle-down',
  'creditcard.fill': 'credit-card',
  'mic.fill': 'mic',
  'line.3.horizontal': 'drag-handle',
  'flag.fill': 'flag',
  'mountain.2.fill': 'terrain',
  // Tile Fun 🎉 di Home — petasan/party popper, sama seperti judul fiturnya.
  // ('mountain.2.fill' tetap dipakai sub-tab Summit di dalam fitur Fun.)
  'party.popper.fill': 'celebration',
  'figure.run': 'directions-run',
  'figure.mind.and.body': 'self-improvement',
  'beach.umbrella.fill': 'beach-access',
  'dumbbell.fill': 'fitness-center',
  'graduationcap.fill': 'school',
  'figure.walk': 'directions-walk',
  // Burung — satu-satunya ikon burung di Material Icons ("flutter-dash").
  // Dipakai tile Spiritual 🕊️ supaya gayanya sama dengan tile lain.
  'bird.fill': 'flutter-dash',
  // Sub-tab fitur Health: Diet 🥗.
  'fork.knife': 'restaurant',
  // Sub-menu fitur Games 🎮 (Snake & Tetris).
  'gamecontroller.fill': 'sports-esports',
  'square.grid.3x3.fill': 'grid-on',
  // Tombol kendali Tetris: putar balok & jatuhkan langsung ke dasar.
  'arrow.clockwise': 'rotate-right',
  'arrow.down.to.line': 'vertical-align-bottom',
  // Tile Married 💍 di Home — berlian cincin (Material Icons tidak punya ikon
  // cincin; "diamond" yang paling mendekati).
  'diamond.fill': 'diamond',
  // Sub-tab Affiliate 🤝 di Career — toa/pengeras suara (content creator).
  'megaphone.fill': 'campaign',
  // Sub-tab Notes 📝 di Fitness — kumpulan tautan & catatan latihan.
  'note.text': 'sticky-note-2',
  // Sub-tab Token ⚡ di Residence — listrik prabayar.
  'bolt.circle.fill': 'offline-bolt',
  // Fitur Social 🥂 — tile Home + kedua sub-tabnya (Split Bill & Places).
  'wineglass.fill': 'local-bar',
  'receipt.fill': 'receipt-long',
  'cup.and.saucer.fill': 'local-cafe',
  // Fitur Device 📱 — tile Home + kedua sub-tab perangkatnya.
  'iphone': 'smartphone',
  'ipad': 'tablet-mac',
  // Tombol "bahan tersambung" di kartu acara CORE — sebaris dengan tombol
  // kirim, jadi rupanya harus ikon rata juga, bukan emoji 🔗.
  'link': 'link',
  // Sub-tab Creators 🎬 di Fun — video terbaru kanal YouTube yang diikuti.
  'play.rectangle.fill': 'smart-display',
} as IconMapping;

/**
 * An icon component that uses native SF Symbols on iOS, and Material Icons on Android and web.
 * This ensures a consistent look across platforms, and optimal resource usage.
 * Icon `name`s are based on SF Symbols and require manual mapping to Material Icons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name]} style={style} />;
}
