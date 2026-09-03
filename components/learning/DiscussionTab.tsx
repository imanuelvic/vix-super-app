import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { CARD } from '@/assets/style/card';
import { Color } from '@/assets/style/color';
import { attentionBorder, AttentionMark } from '@/components/common/Badge';
import { CheckCircle } from '@/components/common/CheckCircle';
import { FilterChips } from '@/components/common/FilterChips';
import { FormError } from '@/components/common/FormError';
import { PressableScale } from '@/components/common/PressableScale';
import { ProgressBar } from '@/components/common/ProgressBar';
import { SummaryCard } from '@/components/common/SummaryCard';
import { VixText } from '@/components/common/VixText';
import { useAuth } from '@/contexts/auth';
import { useScrollTop } from '@/hooks/useScrollTop';
import {
  setTopicDone,
  TOPIC_GROUPS,
  topicGroupMeta,
  TOPICS,
  topicsOfWeek,
  type TopicsDone,
} from '@/lib/learning';
import { SAVE_ERROR } from '@/lib/messages';

// Sub-tab 💬 Discussion — 62 bahan percakapan dari daftarmu, dikelompokkan
// jadi 6.
//
// Gunanya bukan sekadar checklist: ilmu baru benar-benar melekat kalau
// DIUCAPKAN, bukan cuma dibaca. Tiap minggu TIGA topik dari sini jadi pemantik
// langkah ke-4 ("Ceritakan"), dan sisanya bisa dipakai kapan saja — ngobrol
// dengan pasangan, teman CORE, atau keluarga.
export function DiscussionTab({
  topicsDone,
  now,
}: {
  topicsDone: TopicsDone;
  now: Date;
}) {
  const { user } = useAuth();

  const [group, setGroup] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Tekan chip kelompok yang sedang aktif LAGI → daftar balik ke paling atas.
  const { ref: scrollRef, toTop } = useScrollTop();

  // Ketiga topik giliran minggu ini — ditandai di daftar panjang ini juga.
  const weekly = topicsOfWeek(now);
  const weeklyKeys = new Set(weekly.map((t) => t.key));
  const doneCount = TOPICS.filter((t) => topicsDone[t.key]).length;
  const shown = group ? TOPICS.filter((t) => t.group === group) : TOPICS;

  async function toggle(key: string, checked: boolean) {
    if (!user) return;
    setError(null);
    try {
      await setTopicDone(user.uid, key, !checked);
    } catch {
      setError(SAVE_ERROR);
    }
  }

  return (
    <View style={styles.flex}>
      <ScrollView ref={scrollRef} contentContainerStyle={styles.content}>
        <SummaryCard
          label="Sudah dibahas"
          value={`${doneCount}/${TOPICS.length} topik 💬`}
        />
        <View style={styles.barWrap}>
          <ProgressBar value={doneCount} total={TOPICS.length} color={Color.LEARNING_DARK} />
        </View>

        {/* ===== Diskusi Dalam Minggu Ini =====
            Dipindah ke sini dari sub-tab Target (28 Agu 2026). Tempatnya
            memang di sub-tab ini: daftar topiknya ada di bawah, dan yang
            giliran minggu ini tinggal ditarik ke atas — bukan disalin ke
            layar lain. Badge sub-tabnya ikut pindah. */}
        <VixText heading="title" additionalStyle={styles.weeklyTitle}>
          Diskusi Dalam Minggu Ini
        </VixText>
        
        {weekly.map((t) => {
          const meta = topicGroupMeta(t.group);
          const checked = !!topicsDone[t.key];
          return (
            <PressableScale
              key={`weekly-${t.key}`}
              style={[
                styles.topicCard,
                checked && styles.topicCardDone,
                attentionBorder(!checked),
              ]}
              onPress={() => toggle(t.key, checked)}
              haptic={checked ? 'light' : 'success'}>
              <CheckCircle checked={checked} />
              <View style={styles.rowMain}>
                <VixText heading="bold">
                  {meta.emoji} {t.label}
                </VixText>
              </View>
              {/* INI yang menyalakan badge sub-tab Topics — aturannya sama
                  persis dengan `pendingTopicsOfWeek`: topik giliran minggu ini
                  yang belum diobrolkan. Jadi titiknya mustahil menyala di
                  baris yang tidak ikut dihitung. */}
              {!checked && <AttentionMark corner />}
            </PressableScale>
          );
        })}

        <VixText heading="title" additionalStyle={styles.allTitle}>
          Semua Bahan Diskusi
        </VixText>

        <FilterChips
          options={TOPIC_GROUPS.map((g) => ({
            key: g.key,
            label: `${g.emoji} ${g.label}`,
            count: TOPICS.filter((t) => t.group === g.key && topicsDone[t.key])
              .length,
          }))}
          value={group}
          onChange={setGroup}
          onRepress={toTop}
        />

        {shown.map((t) => {
          const checked = !!topicsDone[t.key];
          const meta = TOPIC_GROUPS.find((g) => g.key === t.group);
          const isWeekly = weeklyKeys.has(t.key);
          return (
            <PressableScale
              key={t.key}
              style={[
                styles.row,
                checked && styles.rowDone,
                isWeekly && styles.rowWeekly,
              ]}
              onPress={() => toggle(t.key, checked)}
              haptic={checked ? 'light' : 'success'}>
              <CheckCircle checked={checked} />
              <View style={styles.rowMain}>
                <VixText
                  heading="bold"
                  additionalStyle={checked ? styles.rowTitleDone : undefined}>
                  {t.label}
                </VixText>
                <VixText heading="label" additionalStyle={styles.rowGroup}>
                  {meta?.emoji} {meta?.label}
                  {isWeekly ? ' · 🎯 giliran minggu ini' : ''}
                </VixText>
              </View>
            </PressableScale>
          );
        })}

        <FormError message={error} gap="none" additionalStyle={styles.error} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 28 },
  barWrap: { marginTop: -4, marginBottom: 10 },
  row: {
    ...CARD,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  rowDone: {
    backgroundColor: Color.MAIN_TRANSPARENT,
    borderColor: Color.MAIN_LIGHT,
  },
  // Topik yang jadi bahan "Ceritakan" minggu ini.
  rowWeekly: { borderColor: Color.LEARNING_DARK, borderWidth: 1.5 },
  // ---- Blok "Diskusi Dalam Minggu Ini" (pindahan dari sub-tab Target) ----
  weeklyTitle: { marginTop: 4, marginBottom: 8 },
  allTitle: { marginTop: 14, marginBottom: 8 },
  topicCard: {
    ...CARD,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  topicCardDone: {
    backgroundColor: Color.MAIN_TRANSPARENT,
    borderColor: Color.MAIN_LIGHT,
  },
  rowMain: { flex: 1, gap: 2 },
  rowTitleDone: { color: Color.TEXT_LABEL },
  rowGroup: { color: Color.TEXT_LABEL },
  error: { marginTop: 10 },
});
