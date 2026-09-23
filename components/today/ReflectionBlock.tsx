import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { BLOCK_CARD } from '@/assets/style/card';
import { Color } from '@/assets/style/color';
import { PressableScale } from '@/components/common/PressableScale';
import { SoftPill } from '@/components/common/SoftPill';
import { VixText } from '@/components/common/VixText';
import type { TodayReflection } from '@/lib/today';

// 📝 REFLEKSI HARI INI — penutup layar Today. Tiga pertanyaan yang sama tiap
// hari; jurnalnya sendiri tetap baris 📓 Daily Reflection Journal di Habits
// (satu tulisan, satu tempat), dan AI-nya asisten di dalam sheet itu: ia
// membantu melihat, tidak memutuskan apa kata Tuhan.
//
// Siang hari kecil (satu baris), malam & jam baca-ulang membesar: itulah saat
// pertanyaannya paling pantas dijawab.
export function ReflectionBlock({ reflection }: { reflection: TodayReflection }) {
  const router = useRouter();
  if (!reflection.available) return null;
  const tulis = () => router.push({ pathname: '/habits', params: { focus: 'rhema' } });

  if (!reflection.emphasis && !reflection.written) {
    return (
      <PressableScale style={styles.quiet} onPress={tulis} hitSlop={6}>
        <VixText heading="label" additionalStyle={styles.quietText}>
          📝 Refleksi hari ini menunggu nanti malam
        </VixText>
      </PressableScale>
    );
  }

  return (
    <View style={styles.card}>
      <VixText heading="eyebrow" additionalStyle={styles.eyebrow}>
        Refleksi hari ini
      </VixText>
      {reflection.written ? (
        <PressableScale onPress={tulis}>
          <VixText heading="paragraph" numberOfLines={4} additionalStyle={styles.text}>
            {reflection.text}
          </VixText>
        </PressableScale>
      ) : (
        <View style={styles.questions}>
          <VixText heading="paragraph" additionalStyle={styles.q}>Apa yang terjadi hari ini?</VixText>
          <VixText heading="paragraph" additionalStyle={styles.q}>Apa yang Tuhan ajarkan?</VixText>
          <VixText heading="paragraph" additionalStyle={styles.q}>Apa yang kubawa ke besok?</VixText>
        </View>
      )}
      <View style={styles.actions}>
        <SoftPill label={reflection.written ? '✍️ Lanjutkan' : '✍️ Tulis'} onPress={tulis} />
        <SoftPill label="✨ Generate with AI" onPress={tulis} />
        {reflection.showGenerate && (
          <SoftPill label="🖼️ Feed" onPress={() => router.push('/reflection-feed')} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Blok Refleksi memang berlatar ungu Spiritual & sedikit lebih tinggi:
  // isinya tiga pertanyaan, bukan daftar baris.
  card: { ...BLOCK_CARD, backgroundColor: Color.SPIRITUAL, paddingVertical: 16, gap: 8 },
  eyebrow: { color: Color.SPIRITUAL_DARK },
  text: { color: Color.SPIRITUAL_DEEP },
  questions: { gap: 2 },
  q: { color: Color.SPIRITUAL_DEEP },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  quiet: { paddingHorizontal: 6, paddingVertical: 4 },
  quietText: {},
});
