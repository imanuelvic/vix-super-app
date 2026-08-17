import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { BottomTabs, type BottomTab } from '@/components/common/BottomTabs';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { useTabScroll } from '@/components/common/useTabScroll';
import { SnakeTab } from '@/components/games/SnakeTab';
import { TetrisTab } from '@/components/games/TetrisTab';
import { TournamentTab } from '@/components/games/TournamentTab';

type GamesTab = 'tournament' | 'snake' | 'tetris';

// Fitur Games 🎮 — dibuka dari grid Home. Isinya tiga sub-menu:
//   🏆 Tournament — bracket sistem gugur (badminton, dll)
//   🐍 Snake      — game ular ala HP Nokia, main lokal di HP
//   🧱 Tetris     — susun balok, baris penuh hilang; juga lokal di HP
const TABS: BottomTab<GamesTab>[] = [
  { key: 'tournament', label: 'Tournament', icon: 'trophy.fill' },
  { key: 'snake', label: 'Snake', icon: 'gamecontroller.fill' },
  { key: 'tetris', label: 'Tetris', icon: 'square.grid.3x3.fill' },
];

export default function GamesScreen() {
  const { tab, scrollKey, onTabPress } = useTabScroll<GamesTab>('tournament');

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader
        backLabel="Home"
        title="Games 🎮"
        subtitle="Turnamen bareng teman & main santai"
      />

      {/* key=scrollKey → konten re-mount tiap sub-menu ditekan (scroll ke atas).
          Untuk Snake & Tetris ini sekaligus me-reset papannya. */}
      <View style={styles.content} key={scrollKey}>
        {tab === 'tournament' ? (
          <TournamentTab />
        ) : tab === 'snake' ? (
          <SnakeTab />
        ) : (
          <TetrisTab />
        )}
      </View>

      <BottomTabs tabs={TABS} value={tab} onChange={onTabPress} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.BACKGROUND },
  content: { flex: 1 },
});
