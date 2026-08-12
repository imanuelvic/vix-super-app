import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { SegmentTabs } from '@/components/common/SegmentTabs';
import { VixText } from '@/components/common/VixText';
import { dayIdToDate, formatShortDayDate } from '@/lib/format';
import {
  BIBLE_SESSIONS,
  bibleSessionMeta,
  bibleSessionNow,
  type BibleReadDay,
  type BibleSession,
} from '@/lib/spiritual';

// Tab Bible Read 📖 — riwayat bacaan Alkitab harian yang dicatat dari
// Dashboard. Dua sesi (🌅 Pagi & 🌙 Malam) dipisah supaya kelihatan mana yang
// rutin dan mana yang bolong, plus pasal apa saja yang sering dibaca.
export function BibleReadTab({ days }: { days: BibleReadDay[] }) {
  // Default ke sesi yang jendelanya sedang terbuka; di luar jam baca → Pagi.
  const [session, setSession] = useState<BibleSession>(
    () => bibleSessionNow(new Date()) ?? 'morning',
  );

  // Hari yang sesi ini-nya terisi (days sudah urut terbaru → terlama).
  const filled = (key: BibleSession) => days.filter((d) => !!d[key]);
  const list = filled(session);
  const meta = bibleSessionMeta(session);

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heroCard}>
          <VixText heading="label" additionalStyle={styles.heroLabel}>
            📖 Bacaan {meta.label} — 90 hari terakhir
          </VixText>
          <VixText heading="subheader" additionalStyle={styles.heroValue}>
            {list.length}{' '}
            <VixText heading="label" additionalStyle={styles.heroLabel}>
              hari tercatat
            </VixText>
          </VixText>
        </View>

        <SegmentTabs
          tabs={BIBLE_SESSIONS.map((s) => ({
            key: s.key,
            label: `${s.emoji} ${s.label}`,
            sub: `${filled(s.key).length} hari`,
          }))}
          value={session}
          onChange={setSession}
        />

        {list.length === 0 && (
          <VixText heading="label" additionalStyle={styles.empty}>
            Belum ada catatan bacaan {meta.label.toLowerCase()}. Isi lewat kartu
            “{meta.title}” di Dashboard pada jam {meta.fromHour}.00–
            {meta.toHour}.00 📖
          </VixText>
        )}

        {list.map((d) => (
          <View key={d.id} style={styles.card}>
            <VixText heading="label" additionalStyle={styles.cardDate}>
              📆 {formatShortDayDate(dayIdToDate(d.id))}
            </VixText>
            <VixText heading="paragraph" additionalStyle={styles.cardText}>
              {d[session]}
            </VixText>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 },
  heroCard: {
    backgroundColor: Color.SPIRITUAL_DARK,
    borderRadius: 20,
    padding: 18,
    gap: 2,
    marginBottom: 14,
  },
  heroLabel: { color: Color.TEXT_ON_DARK_MUTED },
  heroValue: { color: Color.TEXT_REVERSE },
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
  cardDate: { color: Color.SPIRITUAL_DARK },
  cardText: { color: Color.TEXT_TITLE },
});
