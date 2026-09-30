import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SCREEN_SAFE } from '@/assets/style/layout';
import { BottomTabs, type BottomTab } from '@/components/common/BottomTabs';
import { EmojiButton } from '@/components/common/EmojiButton';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { useTabScroll } from '@/components/common/useTabScroll';
import { CreatorsTab } from '@/components/fun/CreatorsTab';
import { FunArchive } from '@/components/fun/FunArchive';

type FunTab = 'summit' | 'creators';

// Tab bawah. Ikon SF dipetakan di icon-symbol.tsx.
//
// Tiga perubahan sejauh ini:
//   • 30 Agu 2026 — Race pindah ke fitur Health 🍎 (race itu soal tubuh &
//     latihan). Entrinya TIDAK dipindah ke mana-mana; dokumennya tetap sama,
//     cuma tempat membacanya yang berganti.
//   • 30 Agu 2026 — Reflection dibuang dari daftar tab.
//   • 30 Sep 2026 — Recreation dibuang TOTAL atas permintaan pemilik app:
//     tabnya, kategorinya, isiannya, dan pintu pencariannya. Yang tersisa di
//     fitur ini cuma Summit (arsip) & Creators (yang isinya baru tiap hari).
const FUN_TABS: BottomTab<FunTab>[] = [
  { key: 'summit', label: 'Summit', icon: 'mountain.2.fill' },
  { key: 'creators', label: 'Creators', icon: 'play.rectangle.fill' },
];

// Fitur Fun 🎉 — arsip pendakian + kabar terbaru dari kreator YouTube yang
// kamu ikuti.
export default function FunScreen() {
  // Hook bersama: ganti kategori + scroll ke atas tiap tab di-click.
  //
  // Mendarat di Creators, bukan Summit: Summit itu ARSIP — isinya berubah cuma
  // saat kamu sendiri menambah catatan, jadi membukanya menampilkan hal yang
  // sama persis dengan kemarin. Creators justru sebaliknya, isinya video baru
  // tiap kali dibuka — dan itulah alasan fitur ini dibuka.
  const { tab, scrollKey, onTabPress } = useTabScroll<FunTab>('creators', {
    tabs: FUN_TABS,
  });
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader
        backLabel="Home"
        title="Fun 🎉"
        subtitle="Arsip petualangan & hiburan terbaru"
        // 🏔️ hanya di Summit: daftar gunung di Jawa + tanda ✓ yang sudah
        // ditaklukkan (app/mountains.tsx).
        right={
          tab === 'summit' ? (
            <EmojiButton emoji="🏔️" onPress={() => router.push('/mountains')} />
          ) : undefined
        }
      />

      <View style={styles.content} key={scrollKey}>
        {tab === 'creators' ? <CreatorsTab /> : <FunArchive category="summit" />}
      </View>

      <BottomTabs tabs={FUN_TABS} value={tab} onChange={onTabPress} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { ...SCREEN_SAFE },
  content: { flex: 1 },
});
