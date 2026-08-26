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
import { ScreenError } from '@/components/common/ScreenError';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { useTabScroll } from '@/components/common/useTabScroll';
import { VixText } from '@/components/common/VixText';
import { BudgetingTab } from '@/components/finance/BudgetingTab';
import { DashboardTab } from '@/components/finance/DashboardTab';
import { TransactionsTab } from '@/components/finance/TransactionsTab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/contexts/auth';
import {
  subscribeBudget,
  subscribeSubcategories,
  type BudgetMap,
  type SubcategoryMap,
} from '@/lib/budgets';
import { useKeyedData } from '@/hooks/useKeyedData';
import { useMonthCursor } from '@/hooks/useMonthCursor';
import { useNow } from '@/hooks/useNow';
import { debtUrgentCount, subscribeDebts, type Debt } from '@/lib/debts';
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
  { key: 'transactions', label: 'Transactions', icon: 'list.bullet' },
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
  const { year, month, shiftMonth, goNow } = useMonthCursor(now);

  // Transaksi dikunci ke bulan yang dilihat: begitu bulannya digeser, daftarnya
  // kosong lagi (loading) di render yang sama — tak ada sekejap pun angka bulan
  // lama muncul di bawah judul bulan baru.
  const { data: loaded, set: setItems } = useKeyedData<string, Transaction[]>(
    `${year}-${month}`,
  );
  const items = loaded ?? [];
  const loading = loaded === null;
  const [error, setError] = useState<string | null>(null);

  // Budget bulan ini — satu langganan dipakai bersama sub-menu Transaksi
  // (mewarnai pilihan kategori) & Budgeting (bar realisasi).
  const [budget, setBudget] = useState<BudgetMap>({});
  const [budgetCopied, setBudgetCopied] = useState(false);

  // Daftar sub-kategori buatan sendiri (mis. Groceries → Telur). Berlaku
  // lintas bulan, jadi langganannya TIDAK ikut berganti saat bulan digeser.
  const [subcats, setSubcats] = useState<SubcategoryMap>({});

  // Layar terkunci sampai PIN benar. Selama terkunci, Firestore belum
  // di-subscribe sama sekali — jadi tidak ada biaya read kalau batal masuk.
  const [unlocked, setUnlocked] = useState(false);

  // Pinjaman 🤝 — cuma untuk angka merah di tombol header. Jam berjalannya
  // dipakai supaya badge ikut berganti sendiri lewat tengah malam.
  const [debts, setDebts] = useState<Debt[]>([]);
  const { now: liveNow } = useNow();

  useEffect(() => {
    if (!user || !unlocked) return;
    return subscribeDebts(user.uid, setDebts);
  }, [user, unlocked]);

  useEffect(() => {
    if (!user || !unlocked) return;
    // Real-time, hanya untuk bulan yang dipilih.
    // Urutan dari Firestore: date DESC — tanggal terkini selalu paling atas.
    return subscribeTransactionsByMonth(
      user.uid,
      year,
      month,
      (next) => {
        setItems(next);
        setError(null);
      },
      () => {
        // Gagal memuat → berhenti loading dengan daftar kosong + pesan galat.
        setItems([]);
        setError(LOAD_ERROR);
      },
    );
  }, [user, year, month, unlocked, setItems]);

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

  // Langganan daftar sub-kategori (1 dokumen kecil, tidak per bulan).
  useEffect(() => {
    if (!user || !unlocked) return;
    return subscribeSubcategories(user.uid, setSubcats, () => {});
  }, [user, unlocked]);

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
      {/* Judul layar (seragam dengan fitur lain) + akses cepat Pinjaman/Saku */}
      <ScreenHeader
        backLabel="Home"
        title="Finance 💰"
        subtitle="Catat pemasukan, pengeluaran & budget"
        right={
          <View style={styles.headerButtons}>
            {/* Pinjaman 🤝 (pinjam-meminjam). Angka merah = pinjaman yang
                jatuh temponya sudah H-1 — tombolnya sama di semua sub-menu. */}
            <EmojiButton
              emoji="🤝"
              badge={debtUrgentCount(debts, liveNow)}
              onPress={() => router.push('/debts')}
            />
            {/* Saku 👛 (dana per tujuan) */}
            <EmojiButton emoji="👛" onPress={() => router.push('/funds')} />
          </View>
        }
      />

      {/* Navigasi bulan */}
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
      </View>

      <ScreenError message={error} />

      {/* key=scrollKey → konten re-mount tiap sub-menu ditekan (scroll ke atas) */}
      <View style={styles.content} key={scrollKey}>
        {loading ? (
          <LoadingCenter />
        ) : tab === 'dashboard' ? (
          <DashboardTab
            items={items}
            budget={budget}
            year={year}
            month={month}
          />
        ) : tab === 'transactions' ? (
          <TransactionsTab items={items} budget={budget} subcats={subcats} />
        ) : (
          <BudgetingTab
            items={items}
            year={year}
            month={month}
            budget={budget}
            copied={budgetCopied}
            subcats={subcats}
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 20,
    // Beri nafas ke daftar di bawahnya — dengan 4 kartu transaksi teratas
    // terasa menempel persis di bawah nama bulan.
    paddingBottom: 12,
    gap: 10,
  },
  monthRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  // minWidth dipertahankan supaya panah kanan tidak bergeser saat nama bulan
  // berganti panjang (Mei ↔ September).
  monthText: { minWidth: 140, textAlign: 'left', color: Color.TEXT_TITLE },
  headerButtons: { flexDirection: 'row', gap: 8 },
  content: { flex: 1 },
});
