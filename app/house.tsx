import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { BottomTabs, type BottomTab } from '@/components/common/BottomTabs';
import { useTabScroll } from '@/components/common/useTabScroll';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { VixText } from '@/components/common/VixText';
import { HouseLogTab } from '@/components/house/HouseLogTab';
import { InfoTab } from '@/components/house/InfoTab';
import { useAuth } from '@/contexts/auth';
import { HOUSE_INFO, subscribeHouseLogs, type HouseLog } from '@/lib/house';

type HouseTab = 'utility' | 'log' | 'info';

// Log di kiri, Air-Listrik di tengah (default), Info di kanan.
const TABS: BottomTab<HouseTab>[] = [
  { key: 'log', label: 'Log', icon: 'list.bullet' },
  { key: 'utility', label: 'Air-Listrik', icon: 'bolt.fill' },
  { key: 'info', label: 'Info', icon: 'info.circle.fill' },
];

// Home 🏠 — rumah kontrakan Casa Jardin: catatan air & listrik harian, log
// pengeluaran rumah lain, dan identitas rumah.
export default function HouseScreen() {
  const { user } = useAuth();

  // Hook bersama: ganti tab + scroll ke atas tiap tab ditekan. Default di
  // tengah (Air-Listrik).
  const { tab, scrollKey, onTabPress } = useTabScroll<HouseTab>('utility');
  const [logs, setLogs] = useState<HouseLog[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const fail = () => setError('Gagal memuat data. Cek koneksi internet.');
    return subscribeHouseLogs(
      user.uid,
      (next) => {
        setLogs(next);
        setError(null);
      },
      fail,
    );
  }, [user]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader backLabel="Home" title="Home 🏠" subtitle={HOUSE_INFO.name} />

      {error && (
        <VixText heading="label" additionalStyle={styles.error}>
          {error}
        </VixText>
      )}

      <View style={styles.content} key={scrollKey}>
        {logs === null ? (
          <View style={styles.center}>
            <ActivityIndicator color={Color.MAIN} />
          </View>
        ) : tab === 'utility' ? (
          <HouseLogTab items={logs} group="utility" />
        ) : tab === 'log' ? (
          <HouseLogTab items={logs} group="log" />
        ) : (
          <InfoTab />
        )}
      </View>

      <BottomTabs tabs={TABS} value={tab} onChange={onTabPress} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.BACKGROUND },
  error: { color: Color.DANGER, paddingHorizontal: 20, marginBottom: 6 },
  content: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
