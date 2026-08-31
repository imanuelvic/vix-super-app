import { useEffect, useState } from 'react';
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
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { useTabScroll } from '@/components/common/useTabScroll';
import { DeviceLogTab } from '@/components/device/DeviceLogTab';
import { PlanTab } from '@/components/device/PlanTab';
import { useAuth } from '@/contexts/auth';
import { useNow } from '@/hooks/useNow';
import {
  subscribeSubcategories,
  subsOf,
  type SubcategoryMap,
} from '@/lib/budgets';
import {
  DEVICE_EXPENSE_CATEGORIES,
  DEVICE_EXPENSE_CATEGORY,
  deviceNeedsTopUp,
  deviceSubKeys,
  isDeviceExpense,
  subscribeDataPlans,
  type DataPlan,
} from '@/lib/device';
import { unsubscribeAll } from '@/lib/liveDoc';
import { LOAD_ERROR } from '@/lib/messages';
import {
  subscribeCategoryTransactions,
  type Transaction,
} from '@/lib/transactions';

type DeviceTab = 'log' | 'iphone' | 'ipad';

// Log dulu (pengeluarannya), baru perangkatnya satu per satu.
const TABS: BottomTab<DeviceTab>[] = [
  { key: 'log', label: 'Log', icon: 'list.bullet' },
  { key: 'iphone', label: 'iPhone 15', icon: 'iphone' },
  { key: 'ipad', label: 'iPad 10', icon: 'ipad' },
];

// Device 📱 — perangkat harian & biayanya.
//
//   Log        → semua pengeluaran soal perangkat, dibaca dari Finance
//                (Mobile, Data & Administration). BACA-SAJA.
//   iPhone 15  → paket kuota/pulsa: sisa GB, habis kapan, harganya berapa.
//   iPad 10    → sama, untuk tabletnya.
//
// Kenapa paketnya dicatat sendiri padahal app operator sudah menampilkannya:
// app operator cuma tahu paket yang SEDANG jalan. Yang tidak dijawabnya —
// sebulan habis berapa untuk kuota, dan pemakaian sehari rata-rata berapa —
// baru bisa dijawab kalau paketnya punya riwayat.
export default function DeviceScreen() {
  const { user } = useAuth();
  const { tab, scrollKey, onTabPress } = useTabScroll<DeviceTab>('log');

  const [plans, setPlans] = useState<DataPlan[] | null>(null);
  const [expenses, setExpenses] = useState<Transaction[] | null>(null);
  // Daftar sub-kategori Finance — dipakai mengenali mana yang sub "Mobile".
  // Dokumen yang sama sudah dibaca layar Finance, jadi tak ada bentuk data baru.
  const [subcats, setSubcats] = useState<SubcategoryMap | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Jam berjalan: sisa hari paket ikut berganti sendiri lewat tengah malam,
  // tanpa perlu layarnya dibuka ulang.
  const { now } = useNow();

  useEffect(() => {
    if (!user) return;
    const fail = () => setError(LOAD_ERROR);
    return unsubscribeAll([
      subscribeDataPlans(
        user.uid,
        (next) => {
          setPlans(next);
          setError(null);
        },
        fail,
      ),
      subscribeCategoryTransactions(
        user.uid,
        DEVICE_EXPENSE_CATEGORIES,
        setExpenses,
        fail,
      ),
      subscribeSubcategories(user.uid, setSubcats, fail),
    ]);
  }, [user]);

  // Yang masuk tab Log CUMA sub "Mobile". Kategori Mobile, Data &
  // Administration juga menampung Admin Bank, Cost/Taxes & Subscriptions —
  // dan tak satu pun dari mereka biaya perangkat (lihat lib/device.ts).
  const subKeys = deviceSubKeys(
    subsOf(subcats ?? {}, 'expense', DEVICE_EXPENSE_CATEGORY),
  );
  const biayaPerangkat = (expenses ?? []).filter((t) =>
    isDeviceExpense(t, subKeys),
  );

  // Badge H-1: paket perangkat itu habis besok atau hari ini. Angkanya SAMA
  // dengan badge tile Device di Home — satu aturan, dua tempat.
  const tabsBerbadge = withBadge(TABS, {
    iphone: deviceNeedsTopUp(plans ?? [], 'iphone', now) ? 1 : 0,
    ipad: deviceNeedsTopUp(plans ?? [], 'ipad', now) ? 1 : 0,
  });

  const memuat =
    tab === 'log' ? expenses === null || subcats === null : plans === null;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader
        backLabel="Home"
        title="Device 📱"
        subtitle="Paket kuota & biaya perangkat"
      />

      <ScreenError message={error} />

      <View style={styles.body} key={scrollKey}>
        {memuat ? (
          <LoadingCenter />
        ) : tab === 'log' ? (
          <DeviceLogTab transactions={biayaPerangkat} />
        ) : (
          <PlanTab device={tab} plans={plans ?? []} now={now} />
        )}
      </View>

      <BottomTabs tabs={tabsBerbadge} value={tab} onChange={onTabPress} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.BACKGROUND },
  body: { flex: 1 },
});
