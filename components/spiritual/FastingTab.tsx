import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { PressableScale } from '@/components/common/PressableScale';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { VixText } from '@/components/common/VixText';
import {
  activeFasting,
  fastingDay,
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
            {fastingDay(active, todayId).prayer || active.prayer ? (
              <VixText heading="paragraph" additionalStyle={styles.activeText}>
                🙏 {fastingDay(active, todayId).prayer || active.prayer}
              </VixText>
            ) : null}
            {active.rules ? (
              <VixText heading="label" additionalStyle={styles.activeText}>
                📜 {active.rules}
              </VixText>
            ) : null}
          </PressableScale>
        )}

        <PrimaryButton
          label="Buat Puasa Baru"
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
            <PressableScale
              key={p.id}
              style={styles.card}
              onPress={() => open(p.id)}>
              <View style={styles.cardTop}>
                <VixText heading="bold" additionalStyle={styles.cardTitle}>
                  {p.title}
                </VixText>
                <VixText heading="bold" additionalStyle={styles.cardCount}>
                  {done}/{total}
                </VixText>
              </View>
              <VixText heading="label" additionalStyle={styles.cardDate}>
                📆 {formatShortDate(dayIdToDate(p.startId))} –{' '}
                {formatShortDate(dayIdToDate(p.endId))}
                {upcoming ? ' · belum mulai' : ''}
              </VixText>
              {p.prayer ? (
                <VixText
                  heading="label"
                  numberOfLines={2}
                  additionalStyle={styles.cardPrayer}>
                  🙏 {p.prayer}
                </VixText>
              ) : null}
              {p.answer ? (
                <VixText
                  heading="label"
                  numberOfLines={2}
                  additionalStyle={styles.cardAnswer}>
                  ✨ {p.answer}
                </VixText>
              ) : null}
            </PressableScale>
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
    backgroundColor: Color.CONTAINER,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Color.BORDER,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
    gap: 3,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: { color: Color.TEXT_TITLE, flexShrink: 1 },
  cardCount: { color: Color.MAIN },
  cardDate: { color: Color.SPIRITUAL_DARK },
  cardPrayer: { color: Color.TEXT_LABEL },
  cardAnswer: { color: Color.MAIN_DARK },
});
