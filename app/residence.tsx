import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import {
  BottomTabs,
  withBadge,
  type BottomTab,
} from '@/components/common/BottomTabs';
import { LoadingCenter } from '@/components/common/LoadingCenter';
import { ScreenError } from '@/components/common/ScreenError';
import { useTabScroll } from '@/components/common/useTabScroll';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { ChoreTab } from '@/components/residence/ChoreTab';
import { LogTab } from '@/components/residence/LogTab';
import { UtilityTab } from '@/components/residence/UtilityTab';
import { InfoTab } from '@/components/residence/InfoTab';
import { useAuth } from '@/contexts/auth';
import {
  countResidenceAttention,
  deleteResidenceLogs,
  RESIDENCE_INFO,
  subscribeChoreStatus,
  subscribeResidenceLogs,
  type ChoreStatusMap,
  type ResidenceLog,
} from '@/lib/residence';
import { LOAD_ERROR } from '@/lib/messages';
import {
  subscribeUtilityTransactions,
  type Transaction,
} from '@/lib/transactions';

type ResidenceTab = 'utility' | 'log' | 'chores' | 'info';

// Log · Air-Listrik (default) · Perawatan · Info.
const TABS: BottomTab<ResidenceTab>[] = [
  { key: 'log', label: 'Log', icon: 'list.bullet' },
  { key: 'utility', label: 'Utility', icon: 'bolt.fill' },
  { key: 'chores', label: 'Maintenance', icon: 'wrench.and.screwdriver.fill' },
  { key: 'info', label: 'Info', icon: 'info.circle.fill' },
];

// Residence 🏠 — rumah kontrakan Casa Jardin: rekap air & listrik (otomatis dari
// Finance), log pengeluaran rumah lain, dan identitas rumah.
export default function ResidenceScreen() {
  const { user } = useAuth();

  // Hook bersama: ganti tab + scroll ke atas tiap tab ditekan. Default di
  // tengah (Air-Listrik).
  // Masuk langsung ke Perawatan — sub-tab yang paling sering perlu dicek.
  const { tab, scrollKey, onTabPress } = useTabScroll<ResidenceTab>('chores');
  const [logs, setLogs] = useState<ResidenceLog[] | null>(null);
  const [utilityTx, setUtilityTx] = useState<Transaction[] | null>(null);
  const [chores, setChores] = useState<ChoreStatusMap | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const fail = () => setError(LOAD_ERROR);
    const unsubs = [
      subscribeResidenceLogs(
        user.uid,
        (next) => {
          setLogs(next);
          setError(null);
        },
        fail,
      ),
      subscribeUtilityTransactions(user.uid, setUtilityTx, fail),
      subscribeChoreStatus(user.uid, setChores, fail),
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
    deleteResidenceLogs(user.uid, staleIds).catch(() => {
      cleanupRan.current = false; // gagal → boleh dicoba lagi nanti
    });
  }, [user, logs]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader backLabel="Home" title="Residence 🏠" subtitle={RESIDENCE_INFO.name} />

      <ScreenError message={error} />

      <View style={styles.content} key={scrollKey}>
        {tab === 'utility' ? (
          utilityTx === null ? (
            <LoadingCenter />
          ) : (
            <UtilityTab transactions={utilityTx} />
          )
        ) : tab === 'log' ? (
          logs === null ? (
            <LoadingCenter />
          ) : (
            <LogTab items={logs} />
          )
        ) : tab === 'chores' ? (
          chores === null ? (
            <LoadingCenter />
          ) : (
            <ChoreTab status={chores} />
          )
        ) : (
          <InfoTab />
        )}
      </View>

      {/* Badge Perawatan = angka yang sama dengan badge tile Residence di Home */}
      <BottomTabs
        tabs={withBadge(TABS, {
          chores: countResidenceAttention(chores ?? {}, new Date()),
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
