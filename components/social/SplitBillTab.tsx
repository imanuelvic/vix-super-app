import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { FormError } from '@/components/common/FormError';
import { Pagination } from '@/components/common/Pagination';
import { PressableScale } from '@/components/common/PressableScale';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { SummaryCard } from '@/components/common/SummaryCard';
import { VixText } from '@/components/common/VixText';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/contexts/auth';
import { usePagination } from '@/hooks/usePagination';
import { formatCompactDate } from '@/lib/format';
import { SAVE_ERROR } from '@/lib/messages';
import {
  billTotal,
  billUnsettled,
  emptyBill,
  newBillId,
  outstandingTotal,
  saveBill,
  sortedBills,
  unpaidCount,
  type Bill,
} from '@/lib/social';
import { formatRupiah } from '@/lib/transactions';

// Sub-tab Split Bill 💸 — daftar patungan. Yang masih ada orang belum setor
// ditaruh paling atas: itulah satu-satunya alasan layar ini perlu dibuka lagi.
//
// Isi tagihannya (item, orang, pembagian) ada di layar sendiri — satu tagihan
// bisa berisi belasan item dan lima orang, terlalu penuh untuk sebuah modal.
export function SplitBillTab({ bills }: { bills: Bill[] }) {
  const router = useRouter();
  const { user } = useAuth();

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const list = sortedBills(bills);
  const { currentPage, pageCount, pageItems, setPage } = usePagination(list);
  const belumSetor = bills.filter(billUnsettled).length;
  const tertunggak = outstandingTotal(bills);

  /** Buat tagihan kosong lalu langsung buka rinciannya — di sanalah isinya. */
  async function handleAdd() {
    if (!user || busy) return;
    setBusy(true);
    setError(null);
    const bill = emptyBill(newBillId());
    try {
      await saveBill(user.uid, bill);
      router.push({ pathname: '/bill/[id]', params: { id: bill.id } });
    } catch {
      setError(SAVE_ERROR);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.flex}>
      <ScrollView
        key={currentPage}
        contentContainerStyle={styles.content}>
        <SummaryCard
          label={
            belumSetor === 0 ? 'Patungan' : `${belumSetor} tagihan belum lunas`
          }
          value={
            belumSetor === 0 ? 'Semua lunas 🙌' : formatRupiah(tertunggak)
          }
          sub={
            belumSetor === 0
              ? 'Tidak ada yang perlu ditagih.'
              : 'Total yang masih ditunggu dari teman-temanmu.'
          }
        />

        <PrimaryButton
          label="Bill Baru"
          icon="plus"
          onPress={handleAdd}
          additionalStyle={styles.addButton}
        />

        <FormError message={error} />

        {list.length === 0 ? (
          <VixText heading="label" additionalStyle={styles.empty}>
            Belum ada patungan.
          </VixText>
        ) : (
          <>
            {pageItems.map((bill) => {
              const belum = unpaidCount(bill);
              const lunas = belum === 0 && bill.people.length > 0;
              return (
                <PressableScale
                  key={bill.id}
                  style={[styles.card, lunas && styles.cardDone]}
                  onPress={() =>
                    router.push({ pathname: '/bill/[id]', params: { id: bill.id } })
                  }>
                  <View style={styles.cardMain}>
                    <VixText heading="bold" additionalStyle={styles.cardTitle}>
                      {bill.title.trim() || 'Tanpa judul'}
                    </VixText>
                    <VixText heading="label">
                      📆 {formatCompactDate(bill.date.toDate())}
                      {bill.place ? ` · 📍 ${bill.place}` : ''}
                    </VixText>
                    <VixText heading="label" additionalStyle={styles.cardTotal}>
                      {formatRupiah(billTotal(bill))} · {bill.items.length} item
                      {bill.people.length > 0
                        ? ` · ${bill.people.length} orang`
                        : ''}
                      {/* Penanda notanya sudah difoto. Fotonya sendiri TIDAK
                          ikut diunduh di daftar ini — cuma penandanya (lihat
                          catatan "Foto nota" di lib/social). */}
                      {bill.hasPhoto ? ' · 📸' : ''}
                    </VixText>
                    {bill.people.length === 0 ? (
                      <VixText heading="label" additionalStyle={styles.warn}>
                        ⚠️ Belum ada orangnya
                      </VixText>
                    ) : belum > 0 ? (
                      <VixText heading="label" additionalStyle={styles.warn}>
                        ⏳ {belum} orang belum setor
                      </VixText>
                    ) : (
                      <VixText heading="label" additionalStyle={styles.done}>
                        ✅ Semua sudah setor
                      </VixText>
                    )}
                  </View>
                  <IconSymbol
                    name="chevron.right"
                    size={18}
                    color={Color.TEXT_PLACEHOLDER}
                  />
                </PressableScale>
              );
            })}
            <Pagination
              page={currentPage}
              pageCount={pageCount}
              onChange={setPage}
            />
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 },
  addButton: { marginBottom: 12 },
  empty: { textAlign: 'center', marginVertical: 10 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Color.CONTAINER,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Color.BORDER,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
  },
  // Sudah lunas semua → diredupkan hijau. Tetap ada sebagai catatan, tapi
  // tidak lagi menuntut perhatian.
  cardDone: {
    backgroundColor: Color.MAIN_TRANSPARENT,
    borderColor: Color.MAIN_LIGHT,
  },
  cardMain: { flex: 1, gap: 2 },
  cardTitle: { color: Color.TEXT_TITLE },
  cardTotal: { color: Color.MAIN_DARK },
  warn: { color: Color.DANGER },
  done: { color: Color.SUCCESS },
});
