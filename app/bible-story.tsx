import { useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type Svg from 'react-native-svg';

import { Color } from '@/assets/style/color';
import { Chip } from '@/components/common/Chip';
import { FormInput } from '@/components/common/FormInput';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { ScreenError } from '@/components/common/ScreenError';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { VixText } from '@/components/common/VixText';
import { BibleStoryCard } from '@/components/spiritual/BibleStoryCard';
import { useNow } from '@/hooks/useNow';
import {
  storyFileName,
  storyRefs,
  STORY_H,
  STORY_W,
} from '@/lib/bibleStory';
import { formatFullDate } from '@/lib/format';
import { archiveNo, designOf, SHARE_DESIGNS, sharePng } from '@/lib/shareImage';
import { bibleSessionMeta, bibleSessionOf } from '@/lib/spiritual';

// Ayat Alkitab 📖 → Story Instagram 9:16.
//
// Acuannya dioper dari layar catat bacaan lewat parameter (pendek, mis.
// "Mazmur 23:1-6, Yohanes 3:16") — jadi Story bisa dibuat SEBELUM bacaannya
// disimpan sekalipun, dan layar ini tidak perlu membaca Firestore sama sekali.
export default function BibleStoryScreen() {
  const { session: sessionParam, refs: refsParam } = useLocalSearchParams<{
    session?: string;
    refs?: string;
  }>();
  const session = bibleSessionOf(sessionParam);
  const meta = bibleSessionMeta(session);
  const refs = storyRefs(typeof refsParam === 'string' ? refsParam : '');

  const { width } = useWindowDimensions();
  const { now, todayId } = useNow();

  // Acuan yang sedang dipilih. Nilai awalnya yang pertama — parameternya sudah
  // ada sejak render pertama, jadi tak perlu efek penyelaras.
  const [pickedRef, setPickedRef] = useState(refs[0] ?? '');
  const [verse, setVerse] = useState('');
  const [pickedKey, setPickedKey] = useState(SHARE_DESIGNS[0].key);
  const [busy, setBusy] = useState<'save' | 'share' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const svgRef = useRef<Svg>(null);
  const design = designOf(pickedKey);
  // Acuan yang dipakai: yang dipilih, atau yang pertama kalau pilihannya
  // sempat kosong (mis. parameternya cuma satu).
  const reference = pickedRef || refs[0] || '';

  // Pratinjau selebar layar dikurangi tepi, tapi dibatasi supaya lembar 9:16-nya
  // tetap muat utuh di layar mana pun (termasuk iPhone 15 yang tingginya pas).
  const previewW = Math.min(width - 40, 260);

  /**
   * Gambar ulang kartunya pada ukuran Story SEBENARNYA (1080×1920) — bukan
   * sebesar pratinjaunya; kalau tidak, gambarnya pecah saat diunggah. Lalu
   * buka lembar berbagi iOS: di situ ada "Save Image" maupun Instagram.
   */
  async function buatStory(mode: 'save' | 'share') {
    if (!svgRef.current || busy) return;
    setBusy(mode);
    setError(null);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const svg = svgRef.current;
        if (!svg) {
          reject(new Error('kartu belum siap'));
          return;
        }
        svg.toDataURL((data) => resolve(data), {
          width: STORY_W,
          height: STORY_H,
        });
      });
      await sharePng(
        base64,
        storyFileName(todayId, reference),
        mode === 'save' ? 'Simpan ke Foto' : 'Bagikan ke Instagram Story',
      );
    } catch {
      setError('Gagal membuat gambarnya. Coba lagi ya.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        backLabel={meta.title}
        title="Bagikan Ayat 📖"
        subtitle="Bacaan hari ini jadi Story 9:16"
      />

      <ScreenError message={error} />

      {refs.length === 0 ? (
        <View style={styles.emptyWrap}>
          <VixText heading="label" additionalStyle={styles.empty}>
            Belum ada kitab & pasal yang diisi. Isi dulu bacaannya, baru bisa
            dibuatkan Story-nya 📖
          </VixText>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {/* Pilih acuan mana yang mau dipajang — cuma muncul kalau memang
              ada lebih dari satu bacaan hari itu. */}
          {refs.length > 1 && (
            <>
              <VixText heading="title" additionalStyle={styles.sectionTitle}>
                📖 Pilih bacaannya
              </VixText>
              <View style={styles.chipWrap}>
                {refs.map((r) => (
                  <Chip
                    key={r}
                    label={r}
                    active={r === reference}
                    onPress={() => setPickedRef(r)}
                  />
                ))}
              </View>
            </>
          )}

          <VixText heading="title" additionalStyle={styles.sectionTitle}>
            ✍️ Bunyi ayatnya
          </VixText>
          <VixText heading="label" additionalStyle={styles.fieldNote}>
            Opsional. Kosongkan saja kalau cuma mau memajang acuannya —
            app tidak menyimpan teks Alkitab, jadi bunyinya kamu salin sendiri
            supaya tidak ada satu huruf pun yang dikarang.
          </VixText>
          <FormInput
            style={styles.verseInput}
            placeholder="mis. TUHAN adalah gembalaku, takkan kekurangan aku."
            value={verse}
            onChangeText={setVerse}
            multiline
            editable={!busy}
          />

          {/* Pratinjau — persis yang akan keluar, cuma dikecilkan. */}
          <View style={styles.previewWrap}>
            <BibleStoryCard
              ref={svgRef}
              verse={verse}
              reference={reference}
              sessionLabel={meta.title.toUpperCase()}
              design={design}
              dateLabel={formatFullDate(now)}
              archiveLabel={archiveNo(todayId)}
              width={previewW}
            />
          </View>

          <VixText heading="title" additionalStyle={styles.sectionTitle}>
            🎨 Rupa
          </VixText>
          <View style={styles.chipWrap}>
            {SHARE_DESIGNS.map((d) => (
              <Chip
                key={d.key}
                label={d.label}
                active={d.key === design.key}
                onPress={() => setPickedKey(d.key)}
              />
            ))}
          </View>

          <PrimaryButton
            label="💾 Simpan Gambar"
            busy={busy === 'save'}
            onPress={() => buatStory('save')}
            background={Color.MAIN_DARK}
            additionalStyle={styles.actionTop}
          />
          <PrimaryButton
            label="📤 Bagikan ke Story"
            busy={busy === 'share'}
            onPress={() => buatStory('share')}
            background={Color.SPIRITUAL_DARK}
            additionalStyle={styles.action}
          />

          <VixText heading="label" additionalStyle={styles.hint}>
            Dua-duanya membuka lembar berbagi iOS: pilih “Save Image” untuk
            menyimpan ke Foto, atau Instagram untuk langsung mengunggah sebagai
            Story. Gambarnya dibuat di HP-mu sendiri dan tidak dikirim ke mana
            pun.
          </VixText>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.BACKGROUND },
  content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 32 },
  emptyWrap: { paddingHorizontal: 20, paddingTop: 20 },
  empty: { textAlign: 'center' },
  sectionTitle: { marginTop: 14, marginBottom: 8 },
  fieldNote: { marginBottom: 8 },
  verseInput: { minHeight: 96, textAlignVertical: 'top' },
  // Pratinjau ditengahkan supaya terasa seperti selembar gambar, bukan bagian
  // dari layar.
  previewWrap: { alignItems: 'center', paddingVertical: 14 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actionTop: { marginTop: 18 },
  action: { marginTop: 10 },
  hint: { color: Color.TEXT_LABEL, marginTop: 8 },
});
