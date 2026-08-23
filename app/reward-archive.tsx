import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { DualButtons } from '@/components/common/DualButtons';
import { InlineDelete } from '@/components/common/InlineDelete';
import { Pagination } from '@/components/common/Pagination';
import { PressableScale } from '@/components/common/PressableScale';
import { ScreenError } from '@/components/common/ScreenError';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { SheetModal } from '@/components/common/SheetModal';
import { SummaryCard } from '@/components/common/SummaryCard';
import { VixText } from '@/components/common/VixText';
import { useAuth } from '@/contexts/auth';
import { usePagination } from '@/hooks/usePagination';
import { formatShortDayDateTime } from '@/lib/format';
import { DELETE_ERROR, LOAD_ERROR } from '@/lib/messages';
import {
  saveClaimedRewards,
  subscribeClaimedRewards,
  type ClaimedReward,
} from '@/lib/selfReward';
import { formatRupiah } from '@/lib/transactions';

// Archive Self-Reward 🗄️ — semua hadiah yang PERNAH kamu klaim, terbaru di
// atas, lengkap dengan tanggal & jamnya. Isinya ditulis sendiri tiap kali
// tombol Klaim di layar Achievement ditekan.
//
// Ini catatan sejarah, bukan daftar tugas: tidak ada centang, tidak ada edit.
// Yang bisa dilakukan cuma menghapus baris yang salah catat — dan hapusnya
// permanen, seperti semua hapus di app ini.
export default function RewardArchiveScreen() {
  const { user } = useAuth();

  const [list, setList] = useState<ClaimedReward[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Baris yang sedang dibuka (untuk dihapus). null = tidak ada.
  const [open, setOpen] = useState<ClaimedReward | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    return subscribeClaimedRewards(
      user.uid,
      (next) => {
        setList(next);
        setError(null);
      },
      () => setError(LOAD_ERROR),
    );
  }, [user]);

  const items = list ?? [];
  const total = items.reduce((sum, r) => sum + r.price, 0);
  const { currentPage, pageCount, pageItems, setPage } = usePagination(items);

  /**
   * Hapus satu baris riwayat — permanen. SENGAJA tidak mengembalikan uangnya ke
   * Saku: mutasi keluarnya adalah catatan terpisah di Saku Self-Reward, dan di
   * sanalah tempatnya dibetulkan kalau memang salah.
   */
  async function handleDelete() {
    if (!user || !open || busy) return;
    setBusy(true);
    try {
      await saveClaimedRewards(
        user.uid,
        items.filter((r) => r.claimedAt.toMillis() !== open.claimedAt.toMillis()),
      );
      setOpen(null);
    } catch {
      setError(DELETE_ERROR);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        backLabel="Achievement"
        title="Archive Self-Reward 🗄️"
        subtitle="Semua hadiah yang sudah kamu klaim"
      />

      <ScreenError message={error} />

      <ScrollView contentContainerStyle={styles.content}>
        <SummaryCard
          label={`${items.length} klaim · total dinikmati`}
          value={formatRupiah(total)}
        />

        {items.length === 0 ? (
          <VixText heading="label" additionalStyle={styles.empty}>
            Belum ada yang diklaim. Kumpulkan dulu saldonya, hadiahnya menunggu
            🎁
          </VixText>
        ) : (
          <>
            {pageItems.map((r) => (
              <PressableScale
                key={`${r.id}-${r.claimedAt.toMillis()}`}
                style={styles.row}
                onPress={() => setOpen(r)}>
                <VixText additionalStyle={styles.rowIcon}>
                  {r.icon || '🎁'}
                </VixText>
                <View style={styles.rowMain}>
                  <VixText heading="bold" additionalStyle={styles.rowTitle}>
                    {r.label}
                  </VixText>
                  <VixText heading="label">
                    📆 {formatShortDayDateTime(r.claimedAt.toDate())}
                  </VixText>
                </View>
                <VixText heading="bold" additionalStyle={styles.rowPrice}>
                  {formatRupiah(r.price)}
                </VixText>
              </PressableScale>
            ))}
            <Pagination
              page={currentPage}
              pageCount={pageCount}
              onChange={setPage}
            />
          </>
        )}
      </ScrollView>

      {/* Detail satu klaim — isinya cuma tombol hapus, karena riwayat memang
          tidak untuk diubah. */}
      <SheetModal
        visible={open !== null}
        title={`${open?.icon ?? ''} ${open?.label ?? ''}`.trim()}
        subtitle={
          open
            ? `Diklaim ${formatShortDayDateTime(open.claimedAt.toDate())} · ${formatRupiah(open.price)}`
            : undefined
        }
        onClose={() => setOpen(null)}>
        <InlineDelete
          key={open ? `${open.id}-${open.claimedAt.toMillis()}` : 'none'}
          label="Hapus catatan klaim ini"
          busy={busy}
          onDelete={handleDelete}
        />
        <DualButtons
          confirmLabel="Tutup"
          busy={busy}
          onCancel={() => setOpen(null)}
          onConfirm={() => setOpen(null)}
        />
      </SheetModal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.BACKGROUND },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 28 },
  empty: { textAlign: 'center', marginVertical: 14 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Color.CONTAINER,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Color.BORDER,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
  },
  rowIcon: { fontSize: 26, lineHeight: 32 },
  rowMain: { flex: 1, gap: 2 },
  rowTitle: { color: Color.TEXT_TITLE },
  rowPrice: { color: Color.MAIN_DARK },
});
