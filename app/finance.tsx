import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState, type ComponentProps } from 'react';
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
import { useAmountsHidden } from '@/hooks/useAmountsHidden';
import { useKeyedData } from '@/hooks/useKeyedData';
import { useLiveAll } from '@/hooks/useLiveAll';
import { useMonthCursor } from '@/hooks/useMonthCursor';
import { useNow } from '@/hooks/useNow';
import {
  EMPTY_BUDGET,
  purgeRemovedBudgets,
  subscribeBudget,
  subscribeBudgetRange,
  subscribeSubcategories,
  type BudgetDoc,
  type SubcategoryMap,
} from '@/lib/budgets';
import { debtUrgentCount, subscribeDebts, type Debt } from '@/lib/debts';
import { subscribeFinanceFocus, type FocusItem } from '@/lib/financeFocus';
import { historySlices, HISTORY_MONTHS } from '@/lib/financeInsight';
import { MONTH_NAMES, monthId } from '@/lib/format';
import { LOAD_ERROR } from '@/lib/messages';
import { PRIVACY_PIN } from '@/lib/pin';
import {
  subscribeTransactionsByMonth,
  subscribeTransactionsRange,
  type Transaction,
} from '@/lib/transactions';

type FinanceTab = 'dashboard' | 'transactions' | 'budgeting';
type IconName = ComponentProps<typeof IconSymbol>['name'];

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
  // 👁 sembunyikan nominal — pilihannya tersimpan di HP (lihat hook-nya).
  const { hidden: amountsHidden, toggle: toggleAmountsHidden } =
    useAmountsHidden();

  // Transaksi dikunci ke bulan yang dilihat: begitu bulannya digeser, daftarnya
  // kosong lagi (loading) di render yang sama — tak ada sekejap pun angka bulan
  // lama muncul di bawah judul bulan baru.
  const { data: loaded, set: setItems } = useKeyedData<string, Transaction[]>(
    `${year}-${month}`,
  );
  const items = loaded ?? [];
  const loading = loaded === null;
  const [error, setError] = useState<string | null>(null);

  // Budget bulan ini (dokumen utuh: alokasi + status kunci) — satu langganan
  // dipakai bersama sub-menu Transaksi (mewarnai pilihan kategori), Budgeting
  // (bar realisasi, kunci) & Dashboard (Safe to Spend).
  const [budgetDoc, setBudgetDoc] = useState<BudgetDoc>(EMPTY_BUDGET);
  const budget = budgetDoc.allocations;

  // Riwayat HISTORY_MONTHS bulan SEBELUM bulan yang dilihat — transaksi (satu
  // query rentang tanggal, tanpa index baru) & budget-nya — untuk analisis
  // pola di Dashboard & Coach. Dikunci ke bulan yang dilihat seperti `items`.
  const { data: histItems, set: setHistItems } = useKeyedData<string, Transaction[]>(
    `hist-${year}-${month}`,
  );
  const [histBudgets, setHistBudgets] = useState<Record<string, BudgetDoc>>({});
  const histFrom = new Date(year, month - HISTORY_MONTHS, 1);
  const histLast = new Date(year, month - 1, 1);
  const history = useMemo(
    () => historySlices(histItems ?? [], histBudgets, year, month),
    [histItems, histBudgets, year, month],
  );

  // 🎯 Fokus mingguan (batas yang ditetapkan sendiri) — satu dokumen kecil.
  const [focusItems, setFocusItems] = useState<FocusItem[]>([]);

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

  useLiveAll((uid) => [subscribeDebts(uid, setDebts)], { when: unlocked });

  useLiveAll(
    (uid) => [
      subscribeTransactionsRange(uid, histFrom, new Date(year, month, 1), setHistItems, () =>
        setHistItems([]),
      ),
      subscribeBudgetRange(
        uid,
        monthId(histFrom.getFullYear(), histFrom.getMonth()),
        monthId(histLast.getFullYear(), histLast.getMonth()),
        setHistBudgets,
        () => {},
      ),
      subscribeFinanceFocus(uid, setFocusItems, () => {}),
    ],
    { deps: [year, month, setHistItems], when: unlocked },
  );

  // Bersih-bersih SEKALI per buka layar: alokasi budget milik kategori yang
  // sudah dihapus (Electricity, Water, Wifi, Maintenance & dua sub Residence)
  // dibuang PERMANEN dari tiap dokumen bulan.
  //
  // Kenapa harus dihapus dan bukan dibiarkan: nominalnya tak pernah lagi
  // kelihatan di layar mana pun, tapi tetap ikut tersalin tiap kali budget
  // bulan baru menyalin bulan sebelumnya — jadi angka yang sudah kamu buang
  // hidup terus diam-diam. Daftarnya dikunci di REMOVED_BUDGET_KEYS, jadi
  // tidak ada budget lain yang bisa tersenggol. Gagal pun tidak apa-apa:
  // ia coba lagi lain kali, dan bulan yang sudah bersih tidak ditulis ulang.
  const purged = useRef(false);
  useEffect(() => {
    if (!user || !unlocked || purged.current) return;
    purged.current = true;
    purgeRemovedBudgets(user.uid).catch(() => {});
  }, [user, unlocked]);

  // Transaksi & budget bulan yang dipilih — keduanya berganti bersama bulannya.
  //   • Transaksi real-time; urutan dari Firestore: date DESC — tanggal terkini
  //     selalu paling atas. Gagal memuat → berhenti loading dengan daftar
  //     kosong + pesan galat.
  //   • Budget (1 dokumen kecil): errornya diabaikan diam-diam — pewarnaan
  //     budget hanya pelengkap, tak boleh mengganggu daftar transaksi.
  useLiveAll(
    (uid) => [
      subscribeTransactionsByMonth(
        uid,
        year,
        month,
        (next) => {
          setItems(next);
          setError(null);
        },
        () => {
          setItems([]);
          setError(LOAD_ERROR);
        },
      ),
      subscribeBudget(uid, year, month, setBudgetDoc, () => {}),
    ],
    { deps: [year, month, setItems], when: unlocked },
  );

  // Langganan daftar sub-kategori (1 dokumen kecil, tidak per bulan).
  useLiveAll((uid) => [subscribeSubcategories(uid, setSubcats, () => {})], { when: unlocked });

  // Belum buka PIN → tampilkan keypad, isi Finance belum dirender sama sekali.
  // Batal → kembali ke layar sebelumnya (Finance kini dibuka dari grid Home).
  if (!unlocked) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <PinLock
          pin={PRIVACY_PIN}
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
        {/* 👁 sembunyikan / tampilkan nominal — di ujung kanan baris bulan,
            sejajar navigasi bulannya. Dulu terselip di kartu "Ringkasan bulan"
            di dalam tab Transaksi dan sering tak ketemu. Cuma tampil di tab
            Transaksi karena memang hanya nominal di situ yang disamarkan. */}
        {tab === 'transactions' && (
          <PressableScale onPress={toggleAmountsHidden} hitSlop={10}>
            <IconSymbol
              name={amountsHidden ? 'eye.slash' : 'eye'}
              size={22}
              color={Color.MAIN}
            />
          </PressableScale>
        )}
      </View>

      <ScreenError message={error} />

      {/* key=scrollKey → konten re-mount tiap sub-menu ditekan (scroll ke atas) */}
      <View style={styles.content} key={scrollKey}>
        {loading ? (
          <LoadingCenter />
        ) : tab === 'dashboard' ? (
          <DashboardTab
            items={items}
            budgetDoc={budgetDoc}
            history={history}
            focusItems={focusItems}
            subcats={subcats}
            year={year}
            month={month}
            now={liveNow}
            onShowTab={onTabPress}
          />
        ) : tab === 'transactions' ? (
          <TransactionsTab
            items={items}
            budget={budget}
            subcats={subcats}
            amountsHidden={amountsHidden}
            year={year}
            month={month}
            onShowBudget={() => onTabPress('budgeting')}
          />
        ) : (
          <BudgetingTab
            items={items}
            year={year}
            month={month}
            budgetDoc={budgetDoc}
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
  // 'space-between': navigasi bulan di kiri, tombol mata 👁 di ujung kanan.
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    // Nafas ATAS & BAWAH kira-kira sama, jadi baris bulannya duduk di tengah
    // celah antara pita header & daftar — bukan menempel ke pita seperti dulu
    // (paddingTop-nya 0, jadi yang memisahkan cuma 6pt margin pita).
    paddingTop: 10,
    paddingBottom: 14,
    gap: 10,
  },
  monthRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  // minWidth dipertahankan supaya panah kanan tidak bergeser saat nama bulan
  // berganti panjang (Mei ↔ September).
  monthText: { minWidth: 140, textAlign: 'left', color: Color.TEXT_TITLE },
  headerButtons: { flexDirection: 'row', gap: 8 },
  content: { flex: 1 },
});
