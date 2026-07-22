import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
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

// Tab bar bawah di dalam layar Finance.
const TABS: {
  key: FinanceTab;
  label: string;
  icon: 'chart.pie.fill' | 'list.bullet' | 'chart.bar.fill';
}[] = [
  { key: 'dashboard', label: 'Dashboard', icon: 'chart.pie.fill' },
  { key: 'transactions', label: 'Transaksi', icon: 'list.bullet' },
  { key: 'budgeting', label: 'Budgeting', icon: 'chart.bar.fill' },
];

export default function FinanceScreen() {
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

  useEffect(() => {
    if (!user) return;
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
  }, [user, year, month]);

  function shiftMonth(delta: number) {
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader backLabel="Home" title="Finance">
        {/* Navigasi bulan — berlaku untuk semua tab */}
        <View style={styles.monthRow}>
          <Pressable onPress={() => shiftMonth(-1)} hitSlop={10}>
            <IconSymbol name="chevron.left" size={20} color={Color.MAIN} />
          </Pressable>
          <VixText heading="bold" additionalStyle={styles.monthText}>
            {MONTH_NAMES[month]} {year}
          </VixText>
          <Pressable onPress={() => shiftMonth(1)} hitSlop={10}>
            <IconSymbol name="chevron.right" size={20} color={Color.MAIN} />
          </Pressable>
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
          <DashboardTab items={items} />
        ) : tab === 'transactions' ? (
          <TransactionsTab items={items} />
        ) : (
          <BudgetingTab items={items} year={year} month={month} />
        )}
      </View>

      {/* Tab bar bawah khusus layar Finance */}
      <View style={styles.tabBar}>
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <Pressable
              key={t.key}
              style={styles.tabButton}
              onPress={() => setTab(t.key)}>
              <IconSymbol
                name={t.icon}
                size={24}
                color={active ? Color.MAIN : Color.TEXT_LABEL}
              />
              <VixText
                heading="label"
                additionalStyle={active ? styles.tabLabelActive : undefined}>
                {t.label}
              </VixText>
            </Pressable>
          );
        })}
      </View>
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
  monthText: { minWidth: 150, textAlign: 'center' },
  error: { color: Color.DANGER, paddingHorizontal: 20, marginBottom: 6 },
  content: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Color.CONTAINER,
    borderTopWidth: 1,
    borderTopColor: Color.BORDER,
    paddingVertical: 8,
  },
  tabButton: { flex: 1, alignItems: 'center', gap: 2 },
  tabLabelActive: { color: Color.MAIN },
});
