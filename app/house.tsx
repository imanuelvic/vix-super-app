import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { BottomTabs, type BottomTab } from '@/components/common/BottomTabs';
import { useTabScroll } from '@/components/common/useTabScroll';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { VixText } from '@/components/common/VixText';
import { HouseLogTab } from '@/components/house/HouseLogTab';
import { HouseUtilityTab } from '@/components/house/HouseUtilityTab';
import { InfoTab } from '@/components/house/InfoTab';
import { useAuth } from '@/contexts/auth';
import {
  deleteHouseLogs,
  HOUSE_INFO,
  subscribeHouseLogs,
  type HouseLog,
} from '@/lib/house';
import {
  subscribeUtilityTransactions,
  type Transaction,
} from '@/lib/transactions';

type HouseTab = 'utility' | 'log' | 'info';

// Log di kiri, Air-Listrik di tengah (default), Info di kanan.
const TABS: BottomTab<HouseTab>[] = [
  { key: 'log', label: 'Log', icon: 'list.bullet' },
  { key: 'utility', label: 'Air-Listrik', icon: 'bolt.fill' },
  { key: 'info', label: 'Info', icon: 'info.circle.fill' },
];

// Home 🏠 — rumah kontrakan Casa Jardin: rekap air & listrik (otomatis dari
// Finance), log pengeluaran rumah lain, dan identitas rumah.
export default function HouseScreen() {
  const { user } = useAuth();

  // Hook bersama: ganti tab + scroll ke atas tiap tab ditekan. Default di
  // tengah (Air-Listrik).
  const { tab, scrollKey, onTabPress } = useTabScroll<HouseTab>('utility');
  const [logs, setLogs] = useState<HouseLog[] | null>(null);
  const [utilityTx, setUtilityTx] = useState<Transaction[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const fail = () => setError('Gagal memuat data. Cek koneksi internet.');
    const unsubs = [
      subscribeHouseLogs(
        user.uid,
        (next) => {
          setLogs(next);
          setError(null);
        },
        fail,
      ),
      subscribeUtilityTransactions(user.uid, setUtilityTx, fail),
    ];
    return () => unsubs.forEach((unsub) => unsub());
  }, [user]);

  // Bersih-bersih SEKALI: log air/listrik lama yang diinput manual dihapus
  // permanen — angkanya sekarang dibaca dari transaksi Finance. Jalan hanya
  // kalau masih ada sisa data lama.
  const cleanupRan = useRef(false);
  useEffect(() => {
    if (!user || logs === null || cleanupRan.current) return;
    const staleIds = logs
      .filter((l) => l.type === 'water' || l.type === 'electric')
      .map((l) => l.id);
    if (staleIds.length === 0) return;
    cleanupRan.current = true;
    deleteHouseLogs(user.uid, staleIds).catch(() => {
      cleanupRan.current = false; // gagal → boleh dicoba lagi nanti
    });
  }, [user, logs]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader backLabel="Home" title="Home 🏠" subtitle={HOUSE_INFO.name} />

      {error && (
        <VixText heading="label" additionalStyle={styles.error}>
          {error}
        </VixText>
      )}

      <View style={styles.content} key={scrollKey}>
        {tab === 'utility' ? (
          utilityTx === null ? (
            <View style={styles.center}>
              <ActivityIndicator color={Color.MAIN} />
            </View>
          ) : (
            <HouseUtilityTab transactions={utilityTx} />
          )
        ) : tab === 'log' ? (
          logs === null ? (
            <View style={styles.center}>
              <ActivityIndicator color={Color.MAIN} />
            </View>
          ) : (
            <HouseLogTab items={logs} />
          )
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
