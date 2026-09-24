import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { LoadingCenter } from '@/components/common/LoadingCenter';
import { PressableScale } from '@/components/common/PressableScale';
import { ScreenError } from '@/components/common/ScreenError';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { VixText } from '@/components/common/VixText';
import { CheckupStatusCard } from '@/components/health/CheckupStatusCard';
import { useLive } from '@/hooks/useLive';
import {
  CHECKUP_TYPES,
  subscribeCheckups,
  type Checkup,
  type CheckupType,
} from '@/lib/health';

// Layar 🩺 Hasil Pemeriksaan — Tekanan Darah & Gula Darah, lengkap.
//
// Dulu kedua kartu ini digambar langsung di sub-tab Check-up dan memakan
// hampir seluruh layar; tombol "Catat Pemeriksaan" dan riwayatnya jadi harus
// digulung jauh dulu. Sekarang di sub-tabnya cukup SATU kotak ringkas, dan
// keterangan panjangnya di sini.
export default function CheckupStatusScreen() {
  const router = useRouter();

  const [error, setError] = useState<string | null>(null);
  const [checkups] = useLive<Checkup[]>(subscribeCheckups, { onError: setError });

  // Catatan TERBARU per jenis — daftarnya sudah urut terbaru dulu, jadi yang
  // pertama ketemu itulah yang terakhir dicek.
  const latestByType = new Map<CheckupType, Checkup>();
  for (const c of checkups ?? []) {
    if (!latestByType.has(c.type)) latestByType.set(c.type, c);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        backLabel="Health"
        title="Check-up Result 🩺"
        // Dipendekkan: yang panjang butuh 399pt, sedangkan satu baris di
        // iPhone 15 cuma muat 353pt — ia akan pecah dua baris & menaikkan
        // tinggi headernya. Jenis pemeriksaannya toh sudah tertulis di
        // kartunya masing-masing.
        subtitle="Hasil terakhir & jadwal cek berikutnya"
      />

      <ScreenError message={error} />

      {checkups === null ? (
        <LoadingCenter />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {CHECKUP_TYPES.map((meta) => (
            <CheckupStatusCard
              key={meta.key}
              meta={meta}
              latest={latestByType.get(meta.key)}
            />
          ))}

          <PressableScale
            style={styles.infoButton}
            onPress={() => router.push('/health-info')}>
            <VixText heading="bold" additionalStyle={styles.infoText}>
              📚 Baca penjelasan lengkapnya
            </VixText>
          </PressableScale>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.BACKGROUND },
  content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 40 },
  infoButton: {
    backgroundColor: Color.ACCENT,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Color.ACCENT_DARK,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 4,
  },
  infoText: { color: Color.ACCENT_DARK },
});
