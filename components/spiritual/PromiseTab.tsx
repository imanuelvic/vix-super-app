import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { InfoChip } from '@/components/common/InfoChip';
import { Pagination } from '@/components/common/Pagination';
import { PressableScale } from '@/components/common/PressableScale';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { ProgressBar } from '@/components/common/ProgressBar';
import { SummaryCard } from '@/components/common/SummaryCard';
import { VixText } from '@/components/common/VixText';
import { QuoteBox } from '@/components/spiritual/QuoteBox';
import { usePagination } from '@/hooks/usePagination';
import { dayIdToDate, formatShortDayDate } from '@/lib/format';
import {
  promiseAnswered,
  promiseProgress,
  promiseWaitDays,
  type Promise as HisPromise,
} from '@/lib/promise';

// Sub-tab 🚩 His Promise — janji Tuhan yang kamu pegang.
//
// Daftarnya saja. Menulis & mengubahnya di layar sendiri (app/promise.tsx),
// bukan bottom sheet: ceritanya bisa panjang, dan pemilih kitab untuk ayatnya
// sendiri sebuah modal — modal di atas modal tidak andal di iOS.
export function PromiseTab({ list }: { list: HisPromise[] }) {
  const router = useRouter();

  const { done, total } = promiseProgress(list);
  // 10 per halaman — daftar ini tak pernah menyusut, cuma bertambah.
  const { currentPage, pageCount, pageItems, setPage } = usePagination(list);

  return (
    <View style={styles.flex}>
      {/* key = halaman → balik ke atas tiap ganti halaman. */}
      <ScrollView key={currentPage} contentContainerStyle={styles.content}>
        <SummaryCard
          label="Sudah digenapi"
          value={`${done}/${total} janji 🙌`}
          sub={
            total === 0
              ? 'Tulis janji Tuhan yang sedang kamu pegang.'
              : done === total
                ? 'Semua yang kamu catat sudah Dia genapi.'
                : `${total - done} janji masih ditunggu.`
          }
        />
        <View style={styles.barWrap}>
          <ProgressBar value={done} total={total} color={Color.SPIRITUAL_DARK} />
        </View>

        <PrimaryButton
          label="Tulis Janji Tuhan"
          icon="plus"
          onPress={() => router.push('/promise')}
          additionalStyle={styles.addButton}
        />

        {list.length === 0 && (
          <VixText heading="label" additionalStyle={styles.empty}>
            Belum ada janji yang dicatat. Waktu Tuhan berbicara lewat firman-Nya,
            tulis di sini — supaya waktu digenapi kamu masih ingat kapan Dia
            mengatakannya 🚩
          </VixText>
        )}

        {pageItems.map((p) => {
          const genap = promiseAnswered(p);
          const menunggu = promiseWaitDays(p);
          return (
            <PressableScale
              key={p.id}
              style={[styles.card, genap && styles.cardDone]}
              onPress={() =>
                router.push({ pathname: '/promise', params: { id: p.id } })
              }>
              <View style={styles.metaRow}>
                {p.verse ? <InfoChip label={`📖 ${p.verse}`} /> : null}
                <VixText
                  heading="label"
                  additionalStyle={genap ? styles.doneChip : styles.waitChip}>
                  {genap ? '🙌 Digenapi' : p.prayed ? '🙏 Didoakan' : '⏳ Dipegang'}
                </VixText>
              </View>

              <VixText heading="title" additionalStyle={styles.cardTitle}>
                {p.promise}
              </VixText>

              {/* Pergumulan yang relate — dibingkai jadi kutipan, bentuk yang
                  sama dengan rhema Revive & kutipan Catatan Khotbah. */}
              <QuoteBox text={p.struggle} lines={2} accent={Color.SPIRITUAL_DARK} />

              {/* Ketiga tanggalnya: perjalanan janji ini dari ditulis sampai
                  digenapi. Yang belum terjadi tidak ditulis sama sekali —
                  baris "Terjawab: —" cuma menambah baris tanpa menambah kabar. */}
              <View style={styles.dateRow}>
                {p.createdId ? (
                  <VixText heading="label" additionalStyle={styles.dateText}>
                    ✍️ {formatShortDayDate(dayIdToDate(p.createdId))}
                  </VixText>
                ) : null}
                {p.updatedId && p.updatedId !== p.createdId ? (
                  <VixText heading="label" additionalStyle={styles.dateText}>
                    🔄 {formatShortDayDate(dayIdToDate(p.updatedId))}
                  </VixText>
                ) : null}
                {genap ? (
                  <VixText heading="label" additionalStyle={styles.dateDone}>
                    🙌 {formatShortDayDate(dayIdToDate(p.answeredId))}
                    {menunggu !== null ? ` · ${menunggu} hari` : ''}
                  </VixText>
                ) : null}
              </View>
            </PressableScale>
          );
        })}

        <Pagination page={currentPage} pageCount={pageCount} onChange={setPage} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 },
  barWrap: { marginTop: -4, marginBottom: 10 },
  addButton: { marginBottom: 12 },
  empty: { textAlign: 'center', marginTop: 8 },
  // Bentuknya sengaja sekeluarga dengan kartu Catatan Khotbah: garis tepi kiri
  // tebal berwarna Spiritual, isinya bertingkat dari acuan → judul → cerita.
  card: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Color.BORDER,
    borderLeftWidth: 3,
    borderLeftColor: Color.SPIRITUAL_DARK,
    padding: 16,
    marginBottom: 10,
    gap: 6,
  },
  // Yang sudah digenapi diberi latar hijau muda — sama dengan baris kebiasaan
  // yang sudah tercentang, jadi "sudah selesai" berbunyi sama di seluruh app.
  cardDone: {
    backgroundColor: Color.MAIN_TRANSPARENT,
    borderColor: Color.MAIN_LIGHT,
  },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  waitChip: { color: Color.TEXT_LABEL },
  doneChip: { color: Color.MAIN_DARK },
  cardTitle: { color: Color.TEXT_TITLE },
  dateRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  dateText: { color: Color.TEXT_PLACEHOLDER },
  dateDone: { color: Color.MAIN_DARK },
});
