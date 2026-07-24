import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { BottomTabs, type BottomTab } from '@/components/common/BottomTabs';
import { EmojiButton } from '@/components/common/EmojiButton';
import { PinLock } from '@/components/common/PinLock';
import { PressableScale } from '@/components/common/PressableScale';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { VixText } from '@/components/common/VixText';
import { BudgetingTab } from '@/components/finance/BudgetingTab';
import { DashboardTab } from '@/components/finance/DashboardTab';
import { TransactionsTab } from '@/components/finance/TransactionsTab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/contexts/auth';
import { MONTH_NAMES } from '@/lib/format';
import { subscribeTransactionsByMonth, type Transaction } from '@/lib/transactions';

type FinanceTab = 'dashboard' | 'transactions' | 'budgeting';

// PIN pembuka layar Finance. Kunci privasi (biar isi dompet tidak kelihatan
// kalau HP dipegang orang lain) — bukan pengamanan data.
const FINANCE_PIN = '9811';

// Tab bar bawah di dalam layar Finance.
const TABS: BottomTab<FinanceTab>[] = [
  { key: 'dashboard', label: 'Dashboard', icon: 'chart.pie.fill' },
  { key: 'transactions', label: 'Transaksi', icon: 'list.bullet' },
  { key: 'budgeting', label: 'Budgeting', icon: 'chart.bar.fill' },
];

export default function FinanceScreen() {
  const router = useRouter();
  const { user } = useAuth();

  // Default masuk ke tab Transaksi.
  const [tab, setTab] = useState<FinanceTab>('transactions');

  // Bulan yang sedang dilihat (default: bulan ini) — dipakai semua tab.
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0–11

  const [items, setItems] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Layar terkunci sampai PIN benar. Selama terkunci, Firestore belum
  // di-subscribe sama sekali — jadi tidak ada biaya read kalau batal masuk.
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    if (!user || !unlocked) return;
    setLoading(true);
    // Real-time, hanya untuk bulan yang dipilih.
    // Urutan dari Firestore: date DESC — tanggal terkini selalu paling atas.
    const unsubscribe = subscribeTransactionsByMonth(
      user.uid,
      year,
      month,
      (next) => {
        setItems(next);
        setError(null);
        setLoading(false);
      },
      () => {
        setError('Gagal memuat data. Cek koneksi internet.');
        setLoading(false);
      },
    );
    return unsubscribe;
  }, [user, year, month, unlocked]);

  // Tekan label bulan di tengah → langsung balik ke bulan berjalan.
  function goNow() {
    setYear(now.getFullYear());
    setMonth(now.getMonth());
  }

  function shiftMonth(delta: number) {
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  }

  // Belum buka PIN → tampilkan keypad, isi Finance belum dirender sama sekali.
  if (!unlocked) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <PinLock
          pin={FINANCE_PIN}
          title="Finance Terkunci"
          subtitle="Masukkan PIN untuk membuka"
          onUnlock={() => setUnlocked(true)}
          onCancel={() => router.back()}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader
        backLabel="Home"
        title="Finance 💵"
        subtitle="Kelola uang, jangan dikuasai uang"
        right={
          <View style={styles.headerButtons}>
            {/* Hutang 🤝 (utang-piutang) */}
            <EmojiButton emoji="🤝" onPress={() => router.push('/debts')} />
            {/* Saku 👛 (dana per tujuan) — beda dari ikon Career */}
            <EmojiButton emoji="👛" onPress={() => router.push('/funds')} />
          </View>
        }>
        {/* Navigasi bulan — berlaku untuk semua tab */}
        <View style={styles.monthRow}>
          <PressableScale onPress={() => shiftMonth(-1)} hitSlop={10}>
            <IconSymbol name="chevron.left" size={20} color={Color.MAIN} />
          </PressableScale>
          {/* Tekan label bulan → balik ke bulan berjalan */}
          <PressableScale onPress={goNow} hitSlop={10}>
            <VixText heading="bold" additionalStyle={styles.monthText}>
              {MONTH_NAMES[month]} {year}
            </VixText>
          </PressableScale>
          <PressableScale onPress={() => shiftMonth(1)} hitSlop={10}>
            <IconSymbol name="chevron.right" size={20} color={Color.MAIN} />
          </PressableScale>
        </View>
      </ScreenHeader>

      {error && (
        <VixText heading="label" additionalStyle={styles.error}>
          {error}
        </VixText>
      )}

      <View style={styles.content}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={Color.MAIN} />
          </View>
        ) : tab === 'dashboard' ? (
          <DashboardTab items={items} year={year} month={month} />
        ) : tab === 'transactions' ? (
          <TransactionsTab items={items} />
        ) : (
          <BudgetingTab items={items} year={year} month={month} />
        )}
      </View>

      {/* Tab bar bawah khusus layar Finance */}
      <BottomTabs tabs={TABS} value={tab} onChange={setTab} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.BACKGROUND },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 2,
  },
  headerButtons: { flexDirection: 'row', gap: 8 },
  monthText: { minWidth: 150, textAlign: 'center' },
  error: { color: Color.DANGER, paddingHorizontal: 20, marginBottom: 6 },
  content: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
