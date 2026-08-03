import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { KeyboardAwareScrollView } from '@/components/common/KeyboardAwareScrollView';
import { LoadingCenter } from '@/components/common/LoadingCenter';
import { FormInput } from '@/components/common/FormInput';
import { PressableScale } from '@/components/common/PressableScale';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { VixText } from '@/components/common/VixText';
import { useAuth } from '@/contexts/auth';
import {
  EMPTY_MONTHLY_PRAYERS,
  isCurrentMonthPrayers,
  monthDocId,
  MONTHLY_PRAYER_QUESTION,
  saveMonthlyPrayers,
  subscribeCoreLeaders,
  subscribeMonthlyPrayers,
  type CoreLeader,
  type MonthlyPrayers,
} from '@/lib/core';
import { MONTH_NAMES } from '@/lib/format';
import { LOAD_ERROR, SAVE_ERROR } from '@/lib/messages';

// Pokok Doa Bulanan 🙏 — kumpulkan pergumulan tiap CORE Leader untuk bulan ini.
// Pokok doa inilah yang menentukan follow up berkala (Sel/Kam/Sab). Otomatis
// direset saat bulan berganti (data lama tertimpa permanen saat diisi ulang).
export default function MonthlyPrayersScreen() {
  const { user } = useAuth();

  const [leaders, setLeaders] = useState<CoreLeader[] | null>(null);
  const [data, setData] = useState<MonthlyPrayers>(EMPTY_MONTHLY_PRAYERS);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const fail = () => setError(LOAD_ERROR);
    const unsubs = [
      subscribeCoreLeaders(
        user.uid,
        (next) => {
          setLeaders(next);
          setError(null);
        },
        fail,
      ),
      subscribeMonthlyPrayers(user.uid, setData, fail),
    ];
    return () => unsubs.forEach((unsub) => unsub());
  }, [user]);

  const now = new Date();
  const monthTitle = `${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`;
  // Poin bulan ini saja (kalau dokumen milik bulan lain → dianggap kosong).
  const points = isCurrentMonthPrayers(data, now) ? data.points : {};
  const filledCount = (leaders ?? []).filter(
    (l) => (points[l.id]?.length ?? 0) > 0,
  ).length;

  // Tulis ulang dokumen dengan monthId bulan ini. Kalau dokumen sebelumnya milik
  // bulan lain, followedDayId ikut direset (mulai bersih untuk bulan baru).
  async function persist(nextPoints: Record<string, string[]>) {
    if (!user) return;
    const monthId = monthDocId(new Date());
    const followedDayId = isCurrentMonthPrayers(data, new Date())
      ? data.followedDayId
      : {};
    try {
      await saveMonthlyPrayers(user.uid, {
        monthId,
        points: nextPoints,
        followedDayId,
      });
    } catch {
      setError(SAVE_ERROR);
    }
  }

  function addPoint(leaderId: string) {
    const text = (drafts[leaderId] ?? '').trim();
    if (!text) return;
    const next = {
      ...points,
      [leaderId]: [...(points[leaderId] ?? []), text],
    };
    setDrafts((d) => ({ ...d, [leaderId]: '' }));
    persist(next);
  }

  function removePoint(leaderId: string, idx: number) {
    const arr = (points[leaderId] ?? []).filter((_, i) => i !== idx);
    const next = { ...points };
    if (arr.length) next[leaderId] = arr;
    else delete next[leaderId];
    persist(next);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        backLabel="CORE"
        title="Pokok Doa Bulanan 🙏"
        subtitle={monthTitle}
      />

      {error && (
        <VixText heading="label" additionalStyle={styles.error}>
          {error}
        </VixText>
      )}

      {leaders === null ? (
        <LoadingCenter />
      ) : (
        <KeyboardAwareScrollView contentContainerStyle={styles.content}>
          {/* Intro: pertanyaan pembuka + info reset + progres pengisian */}
          <View style={styles.introCard}>
            <VixText heading="label" additionalStyle={styles.introQuote}>
              “{MONTHLY_PRAYER_QUESTION}”
            </VixText>
            <VixText heading="bold" additionalStyle={styles.introValue}>
              {filledCount}
              <VixText heading="label" additionalStyle={styles.introLabel}>
                {' '}
                dari {leaders.length} CORE Leader sudah terisi
              </VixText>
            </VixText>
            <VixText heading="label" additionalStyle={styles.introNote}>
              🔄 Otomatis direset awal bulan depan — isi ulang tiap bulan.
            </VixText>
          </View>

          {leaders.map((l) => {
            const list = points[l.id] ?? [];
            return (
              <View key={l.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.avatar}>
                    <VixText heading="title">{l.heart}</VixText>
                  </View>
                  <VixText heading="bold" additionalStyle={styles.name}>
                    {l.name}
                  </VixText>
                  {list.length > 0 && (
                    <View style={styles.countBadge}>
                      <VixText
                        heading="label"
                        additionalStyle={styles.countBadgeText}>
                        {list.length} poin
                      </VixText>
                    </View>
                  )}
                </View>

                {list.length === 0 ? (
                  <VixText heading="label" additionalStyle={styles.emptyPoint}>
                    Belum ada pokok doa — tambahkan di bawah 👇
                  </VixText>
                ) : (
                  list.map((p, i) => (
                    <View key={`${p}-${i}`} style={styles.pointRow}>
                      <VixText heading="paragraph" additionalStyle={styles.pointText}>
                        🙏 {p}
                      </VixText>
                      <PressableScale
                        onPress={() => removePoint(l.id, i)}
                        hitSlop={8}>
                        <VixText heading="label" additionalStyle={styles.removeText}>
                          ✕
                        </VixText>
                      </PressableScale>
                    </View>
                  ))
                )}

                {/* Tambah pokok doa baru */}
                <View style={styles.addRow}>
                  <FormInput
                    style={styles.addInput}
                    placeholder="Tambah pokok doa…"
                    value={drafts[l.id] ?? ''}
                    onChangeText={(t) =>
                      setDrafts((d) => ({ ...d, [l.id]: t }))
                    }
                    onSubmitEditing={() => addPoint(l.id)}
                    returnKeyType="done"
                  />
                  <PressableScale
                    style={styles.addButton}
                    onPress={() => addPoint(l.id)}>
                    <VixText heading="bold" additionalStyle={styles.addButtonText}>
                      ＋
                    </VixText>
                  </PressableScale>
                </View>
              </View>
            );
          })}
        </KeyboardAwareScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.BACKGROUND },
  error: { color: Color.DANGER, paddingHorizontal: 20, marginBottom: 6 },
  content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 40 },
  introCard: {
    backgroundColor: Color.MAIN_DARK,
    borderRadius: 20,
    padding: 18,
    gap: 6,
    marginBottom: 14,
  },
  introQuote: { color: Color.MAIN_LIGHT, fontStyle: 'italic' },
  introValue: { color: Color.TEXT_REVERSE },
  introLabel: { color: Color.TEXT_ON_DARK_MUTED },
  introNote: { color: Color.TEXT_ON_DARK_MUTED },
  card: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Color.BORDER,
    padding: 14,
    marginBottom: 12,
    gap: 8,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Color.BACKGROUND,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { flex: 1, color: Color.TEXT_TITLE },
  countBadge: {
    backgroundColor: Color.MAIN_TRANSPARENT,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  countBadgeText: { color: Color.MAIN_DARK },
  emptyPoint: { color: Color.TEXT_PLACEHOLDER },
  pointRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Color.BACKGROUND,
    borderLeftWidth: 3,
    borderLeftColor: Color.MAIN,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  pointText: { flex: 1, color: Color.TEXT_TITLE },
  removeText: { color: Color.TEXT_PLACEHOLDER },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  addInput: { flex: 1 },
  addButton: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: Color.MAIN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: { color: Color.TEXT_REVERSE, fontSize: 20, lineHeight: 24 },
});
