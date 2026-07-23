import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { VixText } from '@/components/common/VixText';

// Info statis — pengingat pribadi (terjemahan dari catatan QnA lama)
// + tips sehat. Tidak pakai Firestore, murni tampilan.

const QNA: { q: string; a: string }[] = [
  { q: 'Bangun tidur masih terasa lelah?', a: 'Kamu butuh Kalium (Potassium)' },
  { q: 'Susah tidur?', a: 'Kamu butuh Magnesium' },
  { q: 'Badan terasa lemah?', a: 'Kamu butuh Zinc' },
  { q: 'Energi rendah, gampang capek?', a: 'Kamu butuh Zat Besi (Iron)' },
  { q: 'Ada gangguan mata?', a: 'Kamu butuh Vitamin A' },
  { q: 'Sering sakit kepala?', a: 'Kamu butuh Natrium (Sodium)' },
  { q: 'Gangguan organ dalam?', a: 'Kamu butuh Vitamin B' },
  { q: 'Imun lemah, gampang tertular?', a: 'Kamu butuh Vitamin C' },
  { q: 'Merasa sedih / murung?', a: 'Kamu butuh Vitamin D' },
  { q: 'Gejala seperti stroke ringan?', a: 'Kamu butuh Vitamin E' },
  { q: 'Ada masalah darah?', a: 'Kamu butuh Vitamin K' },
];

const TIPS: string[] = [
  '😴 Tidur 7–8 jam di jam yang konsisten — otot pulih & tumbuh saat tidur.',
  '💧 Minum air putih ±2 liter per hari; mulai segelas begitu bangun.',
  '🏃 Olahraga minimal 150 menit per minggu, plus latihan beban 2–3× kalau mau otot besar.',
  '🍗 Cukupi protein ±1,6 g per kg berat badan untuk membangun otot.',
  '🌅 Kena sinar matahari pagi 10–15 menit — vitamin D alami & mood lebih baik.',
  '🍬 Kurangi gula, gorengan, dan jajanan pinggir jalan (ingat kejadian cilor 2024 🤧).',
  '🧘 Kelola stres: napas dalam, jalan santai, atau rehat dari layar.',
  '🩺 Cek tekanan darah & gula darah tiap 6 bulan — catat di tab Check-up.',
];

export default function HealthInfoScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        backLabel="Health"
        title="Info Kesehatan 💊"
        subtitle="Pengingat cepat: tubuh lagi butuh apa?"
      />

      <ScrollView contentContainerStyle={styles.content}>
        <VixText heading="title" additionalStyle={styles.sectionTitle}>
          Kalau tubuhmu begini…
        </VixText>
        {QNA.map((item) => (
          <View key={item.q} style={styles.qnaCard}>
            <VixText heading="bold" additionalStyle={styles.question}>
              {item.q}
            </VixText>
            <VixText heading="paragraph" additionalStyle={styles.answer}>
              → {item.a}
            </VixText>
          </View>
        ))}

        <VixText heading="title" additionalStyle={styles.sectionTitle}>
          Tips tetap sehat
        </VixText>
        <View style={styles.tipsCard}>
          {TIPS.map((tip) => (
            <VixText key={tip} heading="paragraph" additionalStyle={styles.tip}>
              {tip}
            </VixText>
          ))}
        </View>

        <VixText heading="label" additionalStyle={styles.disclaimer}>
          Pengingat pribadi, bukan pengganti saran dokter. Kalau gejala
          berlanjut, periksa ke dokter ya 🙏
        </VixText>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.BACKGROUND },
  content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 40 },
  sectionTitle: { marginTop: 8, marginBottom: 10 },
  qnaCard: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Color.BORDER,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
    gap: 2,
  },
  question: { color: Color.TEXT_TITLE },
  answer: { color: Color.MAIN, fontWeight: '700' },
  tipsCard: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Color.BORDER,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  tip: { color: Color.TEXT_PARAGRAPH },
  disclaimer: { textAlign: 'center', marginTop: 16 },
});
