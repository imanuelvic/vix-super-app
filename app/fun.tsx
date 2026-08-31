import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { BottomTabs, type BottomTab } from '@/components/common/BottomTabs';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { useTabScroll } from '@/components/common/useTabScroll';
import { CreatorsTab } from '@/components/fun/CreatorsTab';
import { FunArchive } from '@/components/fun/FunArchive';
import { type FunCategory } from '@/lib/fun';

type FunTab = FunCategory | 'creators';

// Tab bawah. Ikon SF dipetakan di icon-symbol.tsx.
//
// Dua perubahan (30 Agu 2026):
//   • Race pindah ke fitur Health 🍎 — race itu soal tubuh & latihan, bukan
//     rekreasi. Entrinya TIDAK dipindah ke mana-mana; dokumennya tetap sama,
//     cuma tempat membacanya yang berganti.
//   • Reflection dibuang dari daftar tab.
const FUN_TABS: BottomTab<FunTab>[] = [
  { key: 'summit', label: 'Summit', icon: 'mountain.2.fill' },
  { key: 'creators', label: 'Creators', icon: 'play.rectangle.fill' },
  { key: 'recreation', label: 'Recreation', icon: 'beach.umbrella.fill' },
];

// Fitur Fun & Recreation 🎉 — arsip petualangan + kabar terbaru dari kreator
// YouTube yang kamu ikuti.
export default function FunScreen() {
  // Hook bersama: ganti kategori + scroll ke atas tiap tab ditekan.
  //
  // Mendarat di Creators, bukan Summit: Summit & Recreation itu ARSIP — isinya
  // berubah cuma saat kamu sendiri menambah catatan, jadi membukanya
  // menampilkan hal yang sama persis dengan kemarin. Creators justru sebaliknya,
  // isinya video baru tiap kali dibuka — dan itulah alasan fitur ini dibuka.
  const { tab, scrollKey, onTabPress } = useTabScroll<FunTab>('creators', {
    tabs: FUN_TABS,
  });

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader
        backLabel="Home"
        title="Fun & Recreation 🎉"
        subtitle="Arsip petualangan & hiburan terbaru"
      />

      <View style={styles.content} key={scrollKey}>
        {tab === 'creators' ? (
          <CreatorsTab />
        ) : (
          <FunArchive category={tab} />
        )}
      </View>

      <BottomTabs tabs={FUN_TABS} value={tab} onChange={onTabPress} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.BACKGROUND },
  content: { flex: 1 },
});
