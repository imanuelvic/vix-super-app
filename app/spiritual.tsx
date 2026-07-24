import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { EmojiButton } from '@/components/common/EmojiButton';
import { PressableScale } from '@/components/common/PressableScale';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { VixText } from '@/components/common/VixText';
import { useAuth } from '@/contexts/auth';
import { type LoginStreak as DayStreak } from '@/lib/achievements';
import { formatFullDate } from '@/lib/format';
import { dayDocId } from '@/lib/health';
import {
  dailyReminder,
  subscribeReviveEntries,
  subscribeReviveStreak,
  type ReviveEntry,
} from '@/lib/spiritual';

// Spiritual ✝️ — layar utama: rhema hari ini tampil penuh (kalau sudah
// diisi), reminder harian, streak 📖🔥. Menulis/mengedit di halaman
// terpisah; seluruh riwayat lewat tombol 📖 kanan atas.
export default function SpiritualScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [entries, setEntries] = useState<ReviveEntry[] | null>(null);
  const [streak, setStreak] = useState<DayStreak | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const fail = () => setError('Gagal memuat data. Cek koneksi internet.');
    const unsubs = [
      subscribeReviveEntries(
        user.uid,
        (next) => {
          setEntries(next);
          setError(null);
        },
        fail,
      ),
      subscribeReviveStreak(user.uid, setStreak, fail),
    ];
    return () => unsubs.forEach((unsub) => unsub());
  }, [user]);

  const todayId = dayDocId(new Date());
  const todayEntry = entries?.find((e) => e.id === todayId) ?? null;
  const reminder = dailyReminder(todayId);
  // Streak tampil 0 kalau sudah bolong lebih dari sehari.
  const streakShown =
    streak && streak.lastDayId >= dayDocId(new Date(Date.now() - 86_400_000))
      ? streak.count
      : 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        backLabel="Home"
        title="Spiritual ✝️"
        subtitle="Being with God — bukan sekadar doing for God"
        right={
          // Seluruh riwayat jurnal 📖
          <EmojiButton
            emoji="📖"
            onPress={() => router.push('/revive-history')}
          />
        }
      />

      {error && (
        <VixText heading="label" additionalStyle={styles.error}>
          {error}
        </VixText>
      )}

      {entries === null ? (
        <View style={styles.center}>
          <ActivityIndicator color={Color.MAIN} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {/* Tanggal + streak (emoji saja, ala Health) */}
          <View style={styles.topRow}>
            <VixText heading="label">📆 {formatFullDate(new Date())}</VixText>
            <View style={styles.streakPill}>
              <VixText heading="bold" additionalStyle={styles.streakText}>
                🔥 {streakShown}
              </VixText>
            </View>
          </View>

          {/* Reminder harian */}
          <View style={styles.reminderCard}>
            <VixText heading="label" additionalStyle={styles.reminderLabel}>
              🕊️ Reminder Hari Ini
            </VixText>
            <VixText heading="paragraph" additionalStyle={styles.reminderText}>
              {reminder}
            </VixText>
          </View>

          {/* Rhema hari ini — tampil PENUH kalau sudah diisi */}
          {todayEntry ? (
            <PressableScale
              style={styles.todayCard}
              onPress={() =>
                router.push({
                  pathname: '/revive',
                  params: { day: todayEntry.id },
                })
              }>
              <VixText heading="title" additionalStyle={styles.todayTitle}>
                {todayEntry.title}
              </VixText>
              {todayEntry.passage ? (
                <VixText heading="label" additionalStyle={styles.todayPassage}>
                  📖 {todayEntry.passage}
                </VixText>
              ) : null}
              <VixText heading="paragraph" additionalStyle={styles.todayRhema}>
                “{todayEntry.rhema}”
              </VixText>
              {todayEntry.reflection ? (
                <VixText heading="label" additionalStyle={styles.todayReflection}>
                  🪞 {todayEntry.reflection}
                </VixText>
              ) : null}
            </PressableScale>
          ) : (
            <PrimaryButton
              label="✍️ Tulis Revive Hari Ini"
              onPress={() => router.push('/revive')}
              additionalStyle={styles.writeButton}
            />
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.BACKGROUND },
  error: { color: Color.DANGER, paddingHorizontal: 20, marginBottom: 6 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 40 },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  streakPill: {
    backgroundColor: Color.SPIRITUAL,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  streakText: { color: Color.SPIRITUAL_DARK },
  reminderCard: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Color.BORDER,
    borderLeftWidth: 3,
    borderLeftColor: Color.SPIRITUAL_DARK,
    padding: 14,
    gap: 4,
    marginBottom: 12,
  },
  reminderLabel: { color: Color.SPIRITUAL_DARK },
  reminderText: { color: Color.TEXT_TITLE },
  writeButton: { marginTop: 4 },
  todayCard: {
    backgroundColor: Color.SPIRITUAL,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Color.SPIRITUAL_DARK,
    padding: 18,
    gap: 8,
  },
  todayTitle: { color: Color.TEXT_TITLE },
  todayPassage: { color: Color.SPIRITUAL_DARK },
  todayRhema: { color: Color.TEXT_TITLE, fontStyle: 'italic' },
  todayReflection: { color: Color.SPIRITUAL_DARK },
});
