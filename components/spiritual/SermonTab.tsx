import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { InfoChip } from '@/components/common/InfoChip';
import { Pagination } from '@/components/common/Pagination';
import { PressableScale } from '@/components/common/PressableScale';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { VixText } from '@/components/common/VixText';
import { QuoteBox } from '@/components/spiritual/QuoteBox';
import { usePagination } from '@/hooks/usePagination';
import { dayIdToDate, formatFullDate } from '@/lib/format';
import {
  currentSundayId,
  isSunday,
  sermonEditable,
  type SermonNote,
} from '@/lib/sermon';

// Tab Sermon ⛪ — catatan khotbah ibadah Minggu NDC.
// Hanya bisa DITAMBAH pada hari Minggu, satu catatan per Minggu.
//
// Layar ini cuma DAFTARNYA. Mengisi & membacanya di layar sendiri
// (app/sermon.tsx), bukan bottom sheet: isi catatannya bisa puluhan baris,
// dan modal yang tingginya dibatasi ¾ layar bukan tempat menulis sepanjang itu.
export function SermonTab({ sermons }: { sermons: SermonNote[] }) {
  const router = useRouter();

  const now = new Date();
  const todaySundayId = currentSundayId(now);
  const canAddToday = isSunday(now) && !sermons.some((s) => s.id === todaySundayId);

  // 10 catatan per halaman — daftarnya menumpuk terus tiap minggu.
  const { currentPage, pageCount, pageItems, setPage } = usePagination(sermons);

  function buka(sundayId: string) {
    router.push({ pathname: '/sermon', params: { id: sundayId } });
  }

  return (
    <View style={styles.flex}>
      {/* key = halaman → balik ke atas tiap ganti halaman (pola yang sama
          dipakai daftar panjang lainnya di app ini). */}
      <ScrollView key={currentPage} contentContainerStyle={styles.content}>
        {canAddToday && (
          <PrimaryButton
            label="Tambah Catatan Khotbah"
            icon="plus"
            onPress={() => buka(todaySundayId)}
            additionalStyle={styles.addButton}
          />
        )}

        {sermons.length === 0 && (
          <VixText heading="label" additionalStyle={styles.empty}>
            Belum ada catatan. Datang ke ibadah Minggu & catat firmannya di sini ⛪
          </VixText>
        )}

        {pageItems.map((s) => {
          const cardLocked = !sermonEditable(s.id, now);
          return (
            <PressableScale
              key={s.id}
              style={styles.card}
              onPress={() => buka(s.id)}>
              <VixText heading="label" additionalStyle={styles.cardDate}>
                📆 {formatFullDate(dayIdToDate(s.id))}
              </VixText>
              <VixText heading="title" additionalStyle={styles.cardTitle}>
                {s.title}
              </VixText>
              <View style={styles.metaRow}>
                {s.preacher ? <InfoChip label={`🎤 ${s.preacher}`} /> : null}
                {s.serviceTime ? (
                  <InfoChip label={`🕙 ${s.serviceTime}`} />
                ) : null}
                {cardLocked ? <InfoChip label="🔒 Arsip" tone="muted" /> : null}
              </View>
              {/* Kutipannya saja. Catatan & aplikasinya SENGAJA tidak
                  mengintip di sini: keduanya berbaris-baris, dan cuplikan dua
                  baris dari tulisan sepanjang itu bukan ringkasan — cuma
                  kalimat yang terpotong di tengah. Isinya dibaca utuh di layar
                  catatannya, sekali klik dari kartu ini. */}
              <QuoteBox text={s.quote} lines={3} />
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
  addButton: { marginBottom: 12 },
  empty: { textAlign: 'center', marginTop: 8 },
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
  cardDate: { color: Color.SPIRITUAL_DARK },
  cardTitle: { color: Color.TEXT_TITLE },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
