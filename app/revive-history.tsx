import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { VixText } from '@/components/common/VixText';
import { useAuth } from '@/contexts/auth';
import { formatFullDate } from '@/lib/format';
import { subscribeReviveEntries, type ReviveEntry } from '@/lib/spiritual';

// Riwayat Revive 📖 — seluruh jurnal yang pernah ditulis.
// Tap jurnal → buka halaman editor untuk membaca/mengubahnya.
export default function ReviveHistoryScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [entries, setEntries] = useState<ReviveEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    return subscribeReviveEntries(
      user.uid,
      (next) => {
        setEntries(next);
        setError(null);
      },
      () => setError('Gagal memuat data. Cek koneksi internet.'),
    );
  }, [user]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        backLabel="Spiritual"
        title="Riwayat Revive 📖"
        subtitle={
          entries ? `${entries.length} jurnal — satu rhema sehari 🌱` : undefined
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
          {entries.length === 0 && (
            <VixText heading="label" additionalStyle={styles.empty}>
              Belum ada jurnal — mulai hari ini dari layar Spiritual ✍️
            </VixText>
          )}
          {entries.map((e) => (
            <Pressable
              key={e.id}
              style={styles.card}
              onPress={() =>
                router.push({ pathname: '/revive', params: { day: e.id } })
              }>
              <VixText heading="label">
                {formatFullDate(e.date.toDate())}
                {e.passage ? ` · 📖 ${e.passage}` : ''}
              </VixText>
              <VixText heading="bold" additionalStyle={styles.cardTitle}>
                {e.title}
              </VixText>
              <VixText heading="paragraph" numberOfLines={3}>
                {e.rhema}
              </VixText>
            </Pressable>
          ))}
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
  empty: { textAlign: 'center', marginTop: 20 },
  card: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Color.BORDER,
    padding: 14,
    marginBottom: 10,
    gap: 3,
  },
  cardTitle: { color: Color.TEXT_TITLE },
});
