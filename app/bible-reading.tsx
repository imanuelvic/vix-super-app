import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { BibleRefField } from '@/components/common/BibleRefField';
import { PressableScale } from '@/components/common/PressableScale';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { VixText } from '@/components/common/VixText';
import { useAuth } from '@/contexts/auth';
import { dayDocId } from '@/lib/health';
import { SAVE_ERROR } from '@/lib/messages';
import {
  bibleSessionMeta,
  bumpBibleStreaks,
  EMPTY_BIBLE_STREAKS,
  saveBibleReading,
  subscribeBibleReadingToday,
  subscribeBibleStreaks,
  type BibleReadingSessions,
  type BibleSession,
  type BibleStreaks,
} from '@/lib/spiritual';

// Layar catat bacaan Alkitab 📖 — dibuka dari kartu Morning/Night Bible
// Reading di HOME (di bawah kartu sapaan). Dibuat halaman penuh (bukan modal)
// karena pemilih kitab sendiri sudah memakai modal; modal di atas modal tidak
// andal di iOS.
export default function BibleReadingScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { session: sessionParam } = useLocalSearchParams<{ session?: string }>();
  const session: BibleSession = sessionParam === 'night' ? 'night' : 'morning';
  const meta = bibleSessionMeta(session);

  // Beberapa acuan sekaligus — kalau hari itu baca lebih dari satu kitab.
  const [refs, setRefs] = useState<string[]>(['']);
  const [today, setToday] = useState<BibleReadingSessions | null>(null);
  const [streaks, setStreaks] = useState<BibleStreaks>(EMPTY_BIBLE_STREAKS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dayId = dayDocId(new Date());

  useEffect(() => {
    if (!user) return;
    const unsubs = [
      subscribeBibleReadingToday(user.uid, dayId, setToday),
      subscribeBibleStreaks(user.uid, setStreaks),
    ];
    return () => unsubs.forEach((unsub) => unsub());
  }, [user, dayId]);

  // Sudah pernah diisi hari ini → tampilkan lagi supaya bisa ditambah/dibetulkan.
  const existing = today?.[session] ?? '';
  useEffect(() => {
    if (existing) setRefs(existing.split(',').map((s) => s.trim()));
  }, [existing]);

  const filled = refs.map((r) => r.trim()).filter(Boolean);

  function setRefAt(index: number, ref: string) {
    setRefs((list) => list.map((r, i) => (i === index ? ref : r)));
  }

  function removeRefAt(index: number) {
    setRefs((list) => list.filter((_, i) => i !== index));
  }

  async function handleSave() {
    if (!user || !today || filled.length === 0 || busy) return;
    setBusy(true);
    setError(null);
    try {
      await saveBibleReading(user.uid, dayId, session, filled.join(', '));
      // "Lengkap" = pagi & malam hari ini dua-duanya terisi setelah simpan ini.
      const other = session === 'morning' ? 'night' : 'morning';
      await bumpBibleStreaks(user.uid, streaks, dayId, session, !!today[other]);
      router.back();
    } catch {
      setError(SAVE_ERROR);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader
        backLabel="Home"
        title={`${meta.emoji} ${meta.title}`}
        subtitle="Pilih kitab, lalu isi pasal & ayatnya"
      />

      <ScrollView contentContainerStyle={styles.content}>
        {refs.map((ref, i) => (
          <View key={i} style={styles.refCard}>
            <View style={styles.refTop}>
              <VixText heading="bold" additionalStyle={styles.refTitle}>
                Bacaan {i + 1}
              </VixText>
              {refs.length > 1 && (
                <PressableScale onPress={() => removeRefAt(i)} hitSlop={10}>
                  <VixText heading="label" additionalStyle={styles.removeText}>
                    Hapus
                  </VixText>
                </PressableScale>
              )}
            </View>
            <BibleRefField
              value={ref}
              onChange={(next) => setRefAt(i, next)}
              editable={!busy}
            />
          </View>
        ))}

        {/* Baca lebih dari satu kitab hari ini? Tambah baris baru. */}
        <PressableScale
          style={styles.addButton}
          onPress={() => setRefs((list) => [...list, ''])}>
          <VixText heading="bold" additionalStyle={styles.addText}>
            ➕ Tambah kitab lain
          </VixText>
        </PressableScale>

        {filled.length > 0 && (
          <View style={styles.summaryCard}>
            <VixText heading="label" additionalStyle={styles.summaryLabel}>
              Tersimpan sebagai
            </VixText>
            <VixText heading="bold" additionalStyle={styles.summaryText}>
              {filled.join(', ')}
            </VixText>
          </View>
        )}

        {error && (
          <VixText heading="label" additionalStyle={styles.error}>
            {error}
          </VixText>
        )}

        {/* Aktif setelah minimal satu bacaan terisi (handleSave juga menjaga). */}
        <PrimaryButton
          label="✅ Sudah baca"
          busy={busy}
          onPress={handleSave}
          additionalStyle={[
            styles.save,
            filled.length === 0 && styles.saveDisabled,
          ]}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.BACKGROUND },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 32 },
  refCard: {
    backgroundColor: Color.SPIRITUAL,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: Color.SPIRITUAL_DARK,
    padding: 14,
    gap: 10,
    marginBottom: 10,
  },
  refTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  refTitle: { color: Color.SPIRITUAL_DARK },
  removeText: { color: Color.DANGER },
  addButton: {
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Color.SPIRITUAL_DARK,
    marginBottom: 12,
  },
  addText: { color: Color.SPIRITUAL_DARK },
  summaryCard: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Color.BORDER,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 2,
    marginBottom: 12,
  },
  summaryLabel: { color: Color.TEXT_LABEL },
  summaryText: { color: Color.TEXT_TITLE },
  error: { color: Color.DANGER, marginBottom: 8 },
  save: { marginBottom: 10 },
  saveDisabled: { opacity: 0.45 },
});
