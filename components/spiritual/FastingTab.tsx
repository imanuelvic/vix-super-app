import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { PressableScale } from '@/components/common/PressableScale';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { VixText } from '@/components/common/VixText';
import { QuoteBox } from '@/components/spiritual/QuoteBox';
import { IconSymbol } from '@/components/ui/icon-symbol';
import {
    activeFasting,
    fastingDayNumber,
    fastingProgress,
    type FastingPlan,
} from '@/lib/fasting';
import { dayIdToDate, formatShortDate } from '@/lib/format';
import { dayDocId } from '@/lib/health';

// Tab Fasting 🍽️ — daftar periode puasa. Yang sedang berjalan diangkat ke
// atas sebagai kartu besar (lengkap dengan pokok doa hari ini); sisanya jadi
// riwayat. Detail & checklist hariannya ada di layar /fasting.
export function FastingTab({ plans }: { plans: FastingPlan[] }) {
  const router = useRouter();

  const now = new Date();
  const todayId = dayDocId(now);
  const active = activeFasting(plans, now);
  const others = plans.filter((p) => p.id !== active?.id);

  function open(id?: string) {
    router.push(id ? { pathname: '/fasting', params: { id } } : '/fasting');
  }

  /** Checklist hariannya — layar sendiri, tak perlu lewat Edit Puasa dulu. */
  function openDays(id: string) {
    router.push({ pathname: '/fasting-days', params: { id } });
  }

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Sedang puasa hari ini — pokok doa hari ini di depan mata */}
        {active && (
          <PressableScale
            style={styles.activeCard}
            onPress={() => open(active.id)}>
            <VixText heading="label" additionalStyle={styles.activeLabel}>
              🍽️ Sedang Puasa — hari ke-
              {fastingDayNumber(active, todayId)} dari{' '}
              {fastingProgress(active).total}
            </VixText>
            <VixText heading="title" additionalStyle={styles.activeTitle}>
              {active.title}
            </VixText>
            {active.rules ? (
              <VixText heading="label" additionalStyle={styles.activeText}>
                📜 {active.rules}
              </VixText>
            ) : null}
          </PressableScale>
        )}

        {/* Tombolnya di LUAR kartu, bukan di dalamnya: PressableScale bersarang
            tidak andal di iOS — yang di dalam sering tak menerima tekanan. */}
        {active && (
          <PressableScale
            style={styles.daysButton}
            onPress={() => openDays(active.id)}>
            <VixText heading="bold" additionalStyle={styles.daysText}>
              📆 Lihat Hari per Hari
            </VixText>
            <IconSymbol
              name="chevron.right"
              size={16}
              color={Color.SPIRITUAL_DARK}
            />
          </PressableScale>
        )}

        <PrimaryButton
          label="Tambah Puasa Baru"
          icon="plus"
          onPress={() => open()}
          additionalStyle={styles.addButton}
        />

        {plans.length === 0 && (
          <VixText heading="label" additionalStyle={styles.empty}>
            Belum ada catatan puasa. Tentukan pokok doa, tanggal mulai–selesai &
            peraturanmu, lalu centang tiap hari yang berhasil 🍽️
          </VixText>
        )}

        {others.map((p) => {
          const { done, total } = fastingProgress(p);
          const upcoming = p.startId > todayId;
          return (
            /* Dua tujuan, dua tombol BERSEBELAHAN (bukan bersarang — di iOS
               Pressable di dalam Pressable sering tak menerima tekanan):
               📆 di depan → checklist hariannya; kartunya → keterangannya. */
            <View key={p.id} style={styles.row}>
              <PressableScale
                style={styles.daysIcon}
                onPress={() => openDays(p.id)}>
                <VixText additionalStyle={styles.daysIconText}>📆</VixText>
                <VixText heading="label" additionalStyle={styles.daysIconSub}>
                  {done}/{total}
                </VixText>
              </PressableScale>
              <PressableScale
                style={styles.card}
                onPress={() => open(p.id)}>
                {/* Angka {done}/{total} pindah ke tombol 📆 di depannya —
                    di situlah tempat ia bisa di-klik untuk dilihat. */}
                <VixText heading="bold" additionalStyle={styles.cardTitle}>
                  {p.title}
                </VixText>
                <VixText heading="label" additionalStyle={styles.cardDate}>
                  📆 {formatShortDate(dayIdToDate(p.startId))} –{' '}
                  {formatShortDate(dayIdToDate(p.endId))}
                  {upcoming ? ' · belum mulai' : ''}
                </VixText>
                {/* Pokok doa utamanya TIDAK ditampilkan di sini: isinya
                    perkara pribadi yang panjang, dan di daftar ia cuma jadi
                    dua baris terpotong yang tidak terbaca utuh. Tempat
                    membacanya di layar puasanya sendiri.

                    Yang tampil JAWABAN doanya — satu kalimat, dan justru
                    itulah yang pantas dibaca ulang dari daftar. Bentuknya sama
                    dengan kutipan di daftar Catatan Khotbah. */}
                {p.answer ? (
                  <QuoteBox text={p.answer} prefix="✨" lines={3} />
                ) : null}
              </PressableScale>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 },
  activeCard: {
    backgroundColor: Color.SPIRITUAL,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: Color.SPIRITUAL_DARK,
    padding: 18,
    gap: 6,
    marginBottom: 12,
  },
  activeLabel: { color: Color.SPIRITUAL_DARK },
  activeTitle: { color: Color.TEXT_TITLE },
  activeText: { color: Color.SPIRITUAL_DARK },
  addButton: { marginBottom: 14 },
  empty: { textAlign: 'center', marginTop: 20 },
  card: {
    flex: 1,
    backgroundColor: Color.CONTAINER,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Color.BORDER,
    paddingHorizontal: 14,
    paddingVertical: 12,
    // 3 → 6: kutipan jawaban doanya butuh sedikit ruang napas dari baris
    // tanggal di atasnya, sama seperti kartu Catatan Khotbah.
    gap: 6,
  },
  cardTitle: { color: Color.TEXT_TITLE, flexShrink: 1 },
  cardDate: { color: Color.SPIRITUAL_DARK },
  // Satu baris daftar = tombol 📆 + kartunya, bersebelahan.
  row: { flexDirection: 'row', alignItems: 'stretch', gap: 8, marginBottom: 8 },
  // Tombol checklist harian di DEPAN tiap puasa. Lebarnya tetap supaya
  // kartu-kartu di kanannya tetap sejajar, berapa pun angkanya.
  daysIcon: {
    width: 58,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    backgroundColor: Color.SPIRITUAL,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Color.SPIRITUAL_DARK,
  },
  daysIconText: { fontSize: 20, lineHeight: 24 },
  daysIconSub: { color: Color.SPIRITUAL_DARK },
  // Tombol checklist untuk puasa yang SEDANG berjalan (di bawah kartu besarnya).
  daysButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Color.SPIRITUAL,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Color.SPIRITUAL_DARK,
    paddingVertical: 12,
    marginBottom: 12,
  },
  daysText: { color: Color.SPIRITUAL_DARK },
});
