import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { InfoTab } from '@/components/car/InfoTab';
import { LogTab } from '@/components/car/LogTab';
import { PartsTab } from '@/components/car/PartsTab';
import {
  BottomTabs,
  withBadge,
  type BottomTab,
} from '@/components/common/BottomTabs';
import { LoadingCenter } from '@/components/common/LoadingCenter';
import { ScreenError } from '@/components/common/ScreenError';
import { useTabScroll } from '@/components/common/useTabScroll';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { useAuth } from '@/contexts/auth';
import {
  CAR_INFO,
  countCarAttention,
  subscribeCarLogs,
  subscribePartStatus,
  type CarLog,
  type PartStatusMap,
} from '@/lib/car';
import { unsubscribeAll } from '@/lib/liveDoc';
import { LOAD_ERROR } from '@/lib/messages';

type CarTab = 'log' | 'parts' | 'info';

// Tab bar bawah di dalam layar Car.
const TABS: BottomTab<CarTab>[] = [
  { key: 'log', label: 'Log', icon: 'list.bullet' },
  { key: 'parts', label: 'Parts', icon: 'wrench.and.screwdriver.fill' },
  { key: 'info', label: 'Info', icon: 'info.circle.fill' },
];

// Car 🚗 — rawat Mazda 2 kesayangan: log pengeluaran, jadwal sparepart,
// dan identitas mobil.
export default function CarScreen() {
  const { user } = useAuth();

  // Default masuk ke Sparepart — kondisi mobil yang paling penting dilihat.
  // Hook bersama: ganti tab + scroll ke atas tiap tab ditekan.
  // `repress` = tombol Parts ditekan lagi saat sudah aktif → daftarnya langsung
  // melompat ke bagian yang jatuh tempo (angka merah di badge-nya).
  // `tabs` dioper supaya reminder Dashboard bisa menuju sub-tabnya lewat ?tab=.
  const { tab, scrollKey, onTabPress } = useTabScroll<CarTab>('parts', {
    tabs: TABS,
  });
  const [logs, setLogs] = useState<CarLog[] | null>(null);
  const [parts, setParts] = useState<PartStatusMap | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const fail = () => setError(LOAD_ERROR);
    return unsubscribeAll([
      subscribeCarLogs(
        user.uid,
        (next) => {
          setLogs(next);
          setError(null);
        },
        fail,
      ),
      subscribePartStatus(user.uid, setParts, fail),
    ]);
  }, [user]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader backLabel="Home" title="Car 🚗" subtitle={CAR_INFO.name} />

      <ScreenError message={error} />

      <View style={styles.content} key={scrollKey}>
        {logs === null || parts === null ? (
          <LoadingCenter />
        ) : tab === 'log' ? (
          <LogTab items={logs} />
        ) : tab === 'parts' ? (
          <PartsTab status={parts} />
        ) : (
          <InfoTab />
        )}
      </View>

      {/* Tab bar bawah khusus layar Car — badge Sparepart = angka yang sama
          dengan badge tile Car di Home & kartu "bagian perlu perhatian". */}
      <BottomTabs
        tabs={withBadge(TABS, {
          parts: countCarAttention(parts ?? {}, new Date()),
        })}
        value={tab}
        onChange={onTabPress}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.BACKGROUND },
  content: { flex: 1 },
});
