import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CARD } from '@/assets/style/card';
import { Color } from '@/assets/style/color';
import { SECTION_SPACE } from '@/assets/style/section';
import { CardActionButton } from '@/components/common/CardActionButton';
import { ScreenError } from '@/components/common/ScreenError';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { SegmentTabs } from '@/components/common/SegmentTabs';
import { VixText } from '@/components/common/VixText';
import { useBusyTask } from '@/hooks/useBusyTask';
import {
  CRITERIA_SHEETS,
  NDC_VALUES,
  NDC_VISION,
  type CriteriaSection,
  type CriteriaSheet,
} from '@/lib/leaderCriteria';
import { shareCriteriaPdf } from '@/lib/leaderCriteriaPdf';

// Pedoman CORE Leader 📄 — dibuka dari tombol pojok kanan atas di
// CORE › Multiplication. DUA lembar pedoman NDC milikmu:
//
//   📄 Calon CL — syarat menimbang siapa yang layak diajukan
//   📋 Tugas CL — pekerjaan yang dipegang setelah dia jadi CORE Leader
//
// Keduanya di SATU layar dengan segmen di atas, bukan dua tombol di pojok
// kanan: dua-duanya dibaca dalam momen yang sama (menyiapkan pemimpin baru),
// dan pojok kanan header sudah cukup ramai.
//
// Isi statis, tidak ada pembacaan Firestore sama sekali.

/** Warna tiap nilai NDC — diambil dari palet app, bukan hex mentah. */
const VALUE_COLOR: Record<string, string> = {
  care: Color.DANGER,
  open: Color.FINANCE_SAVING_DARK,
  reach: Color.FINANCE_INVESTMENT_DARK,
  equip: Color.FINANCE_INCOME_DARK,
};

export default function LeaderCriteriaScreen() {
  const [sheet, setSheet] = useState<CriteriaSheet>('calon');
  // Lembar mana yang sedang dicetak (null = tidak ada) — dipakai spinner
  // tombolnya, sekaligus mencegah cetak dobel.
  const pdf = useBusyTask<CriteriaSheet>();
  const [error, setError] = useState<string | null>(null);

  const { sections, count } = CRITERIA_SHEETS[sheet];

  /** Cetak lembar yang sedang dibuka jadi PDF lalu buka share sheet. */
  function handleShare() {
    return pdf.run({
      key: sheet,
      start: () => setError(null),
      task: () => shareCriteriaPdf(sheet),
      fail: () => setError('Gagal membuat PDF pedomannya. Coba lagi.'),
    });
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        backLabel="CORE"
        title="Pedoman CL 📄"
        subtitle={
          sheet === 'calon'
            ? `${count} poin sebelum mengajukan calon`
            : `${count} poin tugas seorang CORE Leader`
        }
      />

      <ScreenError message={error} />

      <ScrollView contentContainerStyle={styles.content}>
        {/* Payung kedua lembar: empat nilai + visi NDC. Sengaja di ATAS
            segmen — ia berlaku untuk dua-duanya, bukan milik salah satu. */}
        <View style={styles.visionCard}>
          <View style={styles.valueRow}>
            {NDC_VALUES.map((v) => (
              <VixText
                key={v.word}
                heading="bold"
                additionalStyle={{ color: VALUE_COLOR[v.tone] }}>
                {v.word}
              </VixText>
            ))}
          </View>
          <VixText heading="label" additionalStyle={styles.visionLabel}>
            Visi NDC
          </VixText>
          <VixText heading="paragraph" additionalStyle={styles.visionText}>
            {NDC_VISION}
          </VixText>
        </View>

        <View style={styles.tabs}>
          <SegmentTabs
            tabs={(['calon', 'tugas'] as CriteriaSheet[]).map((key) => ({
              key,
              label: CRITERIA_SHEETS[key].tab,
              sub: `${CRITERIA_SHEETS[key].count} poin`,
            }))}
            value={sheet}
            onChange={setSheet}
          />
        </View>

        {/* Cetak jadi PDF lalu buka share sheet — WhatsApp ada di situ. Sama
            bentuk & cara kerjanya dengan tombol Share PDF di Rules &
            Suggestions. Yang tercetak = lembar yang sedang dibuka, dan nama
            berkasnya persis judul lembar itu. */}
        <CardActionButton
          icon="square.and.arrow.up"
          label={`${CRITERIA_SHEETS[sheet].title}`}
          variant="filled"
          onPress={handleShare}
          busy={pdf.busy === sheet}
          disabled={pdf.busy !== null}
          additionalStyle={styles.shareButton}
        />

        {sections.map((section) => (
          <Section key={section.title} section={section} />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

/** Satu bagian pedoman: judul + kartu berisi poin bernomor. */
function Section({ section }: { section: CriteriaSection }) {
  const warn = section.tone === 'warn';
  return (
    <View>
      <VixText heading="title" additionalStyle={styles.sectionTitle}>
        {section.icon} {section.title}
      </VixText>
      {section.note && (
        <VixText heading="label" additionalStyle={styles.sectionNote}>
          {section.note}
        </VixText>
      )}
      <View style={[styles.card, warn && styles.cardWarn]}>
        {section.points.map((p, i) => (
          <View key={p} style={styles.pointRow}>
            <VixText
              heading="bold"
              additionalStyle={[styles.pointNumber, warn && styles.pointNumberWarn]}>
              {i + 1}
            </VixText>
            <VixText heading="paragraph" additionalStyle={styles.pointText}>
              {p}
            </VixText>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.BACKGROUND },
  content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 40 },
  visionCard: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Color.BORDER,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 4,
  },
  valueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    marginBottom: 6,
  },
  visionLabel: { color: Color.TEXT_LABEL },
  visionText: { color: Color.TEXT_TITLE },
  tabs: { marginTop: 14 },
  shareButton: { marginTop: 12 },
  sectionTitle: { ...SECTION_SPACE },
  sectionNote: { marginBottom: 8 },
  card: {
    ...CARD,
    gap: 10,
  },
  // Bagian PERINGATAN: merah samar + garis tepi merah. Bukan sekadar hiasan —
  // isinya hal yang bisa merugikan CORE kalau dilanggar, jadi harus terbaca
  // beda dari daftar tugas biasa.
  cardWarn: {
    backgroundColor: Color.DANGER_TRANSPARENT,
    borderColor: Color.DANGER,
  },
  pointRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  // Nomor poin dibuat lebar tetap supaya teksnya rata walau nomornya 2 digit.
  pointNumber: { color: Color.MAIN, minWidth: 16 },
  pointNumberWarn: { color: Color.DANGER },
  pointText: { flex: 1, color: Color.TEXT_PARAGRAPH },
});
