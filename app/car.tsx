import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { InfoTab } from '@/components/car/InfoTab';
import { LogTab } from '@/components/car/LogTab';
import { PartsTab } from '@/components/car/PartsTab';
import { BottomTabs, type BottomTab } from '@/components/common/BottomTabs';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { VixText } from '@/components/common/VixText';
import { useAuth } from '@/contexts/auth';
import {
  CAR_INFO,
  subscribeCarLogs,
  subscribePartStatus,
  type CarLog,
  type PartStatusMap,
} from '@/lib/car';

type CarTab = 'log' | 'parts' | 'info';

// Tab bar bawah di dalam layar Car.
const TABS: BottomTab<CarTab>[] = [
  { key: 'log', label: 'Log', icon: 'list.bullet' },
  { key: 'parts', label: 'Sparepart', icon: 'wrench.and.screwdriver.fill' },
  { key: 'info', label: 'Info', icon: 'info.circle.fill' },
];

// Car 🚗 — rawat Mazda 2 kesayangan: log pengeluaran, jadwal sparepart,
// dan identitas mobil.
export default function CarScreen() {
  const { user } = useAuth();

  const [tab, setTab] = useState<CarTab>('log');
  const [logs, setLogs] = useState<CarLog[] | null>(null);
  const [parts, setParts] = useState<PartStatusMap | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const fail = () => setError('Gagal memuat data. Cek koneksi internet.');
    const unsubs = [
      subscribeCarLogs(
        user.uid,
        (next) => {
          setLogs(next);
          setError(null);
        },
        fail,
      ),
      subscribePartStatus(user.uid, setParts, fail),
    ];
    return () => unsubs.forEach((unsub) => unsub());
  }, [user]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader backLabel="Home" title="Car 🚗" subtitle={CAR_INFO.name} />

      {error && (
        <VixText heading="label" additionalStyle={styles.error}>
          {error}
        </VixText>
      )}

      <View style={styles.content}>
        {logs === null || parts === null ? (
          <View style={styles.center}>
            <ActivityIndicator color={Color.MAIN} />
          </View>
        ) : tab === 'log' ? (
          <LogTab items={logs} />
        ) : tab === 'parts' ? (
          <PartsTab status={parts} />
        ) : (
          <InfoTab />
        )}
      </View>

      {/* Tab bar bawah khusus layar Car */}
      <BottomTabs tabs={TABS} value={tab} onChange={setTab} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.BACKGROUND },
  error: { color: Color.DANGER, paddingHorizontal: 20, marginBottom: 6 },
  content: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
