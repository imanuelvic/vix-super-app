import { useRouter } from 'expo-router';
import { useEffect, useState, type ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { BottomTabs } from '@/components/common/BottomTabs';
import { EmojiButton } from '@/components/common/EmojiButton';
import { LoadingCenter } from '@/components/common/LoadingCenter';
import { PinLock } from '@/components/common/PinLock';
import { PressableScale } from '@/components/common/PressableScale';
import { useTabScroll } from '@/components/common/useTabScroll';
import { VixText } from '@/components/common/VixText';
import { BudgetingTab } from '@/components/finance/BudgetingTab';
import { DashboardTab } from '@/components/finance/DashboardTab';
import { TransactionsTab } from '@/components/finance/TransactionsTab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/contexts/auth';
import { subscribeBudget, type BudgetMap } from '@/lib/budgets';
import { MONTH_NAMES } from '@/lib/format';
import { LOAD_ERROR } from '@/lib/messages';
import { subscribeTransactionsByMonth, type Transaction } from '@/lib/transactions';

type FinanceTab = 'dashboard' | 'transactions' | 'budgeting';
type IconName = ComponentProps<typeof IconSymbol>['name'];

// PIN pembuka layar Finance. Kunci privasi (biar isi dompet tidak kelihatan
// kalau HP dipegang orang lain) — bukan pengamanan data.
const FINANCE_PIN = '9811';

// Sub-menu Finance — tab bar DI BAWAH (pakai komponen BottomTabs bersama).
const SEGMENTS: { key: FinanceTab; label: string; icon: IconName }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: 'chart.pie.fill' },
  { key: 'transactions', label: 'Transaksi', icon: 'list.bullet' },
  { key: 'budgeting', label: 'Budgeting', icon: 'chart.bar.fill' },
];

export default function FinanceScreen() {
  const router = useRouter();
  const { user } = useAuth();

  // Default masuk ke sub-menu Transaksi. Hook bersama: ganti sub-menu + scroll
  // ke atas tiap ditekan.
  const { tab, scrollKey, onTabPress } = useTabScroll<FinanceTab>('transactions');

  // Bulan yang sedang dilihat (default: bulan ini) — dipakai semua sub-menu.
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0–11

  const [items, setItems] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Budget bulan ini — satu langganan dipakai bersama sub-menu Transaksi
  // (mewarnai pilihan kategori) & Budgeting (bar realisasi).
  const [budget, setBudget] = useState<BudgetMap>({});
  const [budgetCopied, setBudgetCopied] = useState(false);

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
        setError(LOAD_ERROR);
        setLoading(false);
      },
    );
    return unsubscribe;
  }, [user, year, month, unlocked]);

  // Langganan budget bulan ini (1 dokumen kecil). Error diabaikan diam-diam —
  // pewarnaan budget hanya pelengkap, tak boleh mengganggu daftar transaksi.
  useEffect(() => {
    if (!user || !unlocked) return;
    const unsubscribe = subscribeBudget(
      user.uid,
      year,
      month,
      (next) => {
        setBudget(next.allocations);
        setBudgetCopied(next.copiedFromPrev);
      },
      () => {},
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
  // Batal → kembali ke layar sebelumnya (Finance kini dibuka dari grid Home).
  if (!unlocked) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
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
      {/* Tombol kembali ke Home (Finance kini halaman yang di-push dari grid) */}
      <PressableScale
        style={styles.backRow}
        onPress={() => router.back()}
        hitSlop={8}>
        <IconSymbol name="chevron.left" size={22} color={Color.MAIN} />
        <VixText heading="bold" additionalStyle={styles.backText}>
          Home
        </VixText>
      </PressableScale>

      {/* Header ringkas: navigasi bulan + akses cepat Pinjaman/Saku. */}
      <View style={styles.topBar}>
        <View style={styles.monthRow}>
          <PressableScale onPress={() => shiftMonth(-1)} hitSlop={10}>
            <IconSymbol name="chevron.left" size={22} color={Color.MAIN} />
          </PressableScale>
          {/* Tekan label bulan → balik ke bulan berjalan */}
          <PressableScale onPress={goNow} hitSlop={10}>
            <VixText heading="title" additionalStyle={styles.monthText}>
              {MONTH_NAMES[month]} {year}
            </VixText>
          </PressableScale>
          <PressableScale onPress={() => shiftMonth(1)} hitSlop={10}>
            <IconSymbol name="chevron.right" size={22} color={Color.MAIN} />
          </PressableScale>
        </View>
        <View style={styles.headerButtons}>
          {/* Pinjaman 🤝 (pinjam-meminjam) */}
          <EmojiButton emoji="🤝" onPress={() => router.push('/debts')} />
          {/* Saku 👛 (dana per tujuan) */}
          <EmojiButton emoji="👛" onPress={() => router.push('/funds')} />
        </View>
      </View>

      {error && (
        <VixText heading="label" additionalStyle={styles.error}>
          {error}
        </VixText>
      )}

      {/* key=scrollKey → konten re-mount tiap sub-menu ditekan (scroll ke atas) */}
      <View style={styles.content} key={scrollKey}>
        {loading ? (
          <LoadingCenter />
        ) : tab === 'dashboard' ? (
          <DashboardTab items={items} year={year} month={month} />
        ) : tab === 'transactions' ? (
          <TransactionsTab items={items} budget={budget} />
        ) : (
          <BudgetingTab
            items={items}
            year={year}
            month={month}
            budget={budget}
            copied={budgetCopied}
          />
        )}
      </View>

      {/* Sub-menu Finance: tab bar DI BAWAH (Dashboard · Transaksi · Budgeting) */}
      <BottomTabs tabs={SEGMENTS} value={tab} onChange={onTabPress} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.BACKGROUND },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 6,
  },
  backText: { color: Color.MAIN },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
    gap: 10,
  },
  monthRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  monthText: { minWidth: 140, textAlign: 'center', color: Color.TEXT_TITLE },
  headerButtons: { flexDirection: 'row', gap: 8 },
  error: { color: Color.DANGER, paddingHorizontal: 20, marginBottom: 6 },
  content: { flex: 1 },
});
