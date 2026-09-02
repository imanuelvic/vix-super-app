import { useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type Svg from 'react-native-svg';

import { Color } from '@/assets/style/color';
import { ActionStack } from '@/components/common/ActionStack';
import { Chip } from '@/components/common/Chip';
import { FormInput } from '@/components/common/FormInput';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { ScreenError } from '@/components/common/ScreenError';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { VixText } from '@/components/common/VixText';
import { BibleStoryCard } from '@/components/spiritual/BibleStoryCard';
import { useBusyTask } from '@/hooks/useBusyTask';
import { useNow } from '@/hooks/useNow';
import {
  storyFileName,
  storyRefs,
  STORY_H,
  STORY_W,
} from '@/lib/bibleStory';
import { formatFullDate } from '@/lib/format';
import {
  archiveNo,
  designOf,
  openInstagram,
  photoErrorMessage,
  savePngToPhotos,
  SHARE_DESIGNS,
} from '@/lib/shareImage';
import {
  BIBLE_VERSION_DEFAULT,
  bibleSessionMeta,
  bibleSessionOf,
} from '@/lib/spiritual';

// Ayat Alkitab 📖 → Story Instagram 9:16.
//
// Acuannya dioper dari layar catat bacaan lewat parameter (pendek, mis.
// "Mazmur 23:1-6, Yohanes 3:16") — jadi Story bisa dibuat SEBELUM bacaannya
// disimpan sekalipun, dan layar ini tidak perlu membaca Firestore sama sekali.
export default function BibleStoryScreen() {
  const {
    session: sessionParam,
    refs: refsParam,
    version: versionParam,
  } = useLocalSearchParams<{
    session?: string;
    refs?: string;
    version?: string;
  }>();
  const session = bibleSessionOf(sessionParam);
  const meta = bibleSessionMeta(session);
  const refs = storyRefs(typeof refsParam === 'string' ? refsParam : '');
  // Terjemahan yang sedang diketik di layar catat bacaan, dioper apa adanya.
  // Kosong (mis. Story dibuka dari pintu lama) → TB, sama seperti di sana.
  const version =
    (typeof versionParam === 'string' ? versionParam.trim() : '') ||
    BIBLE_VERSION_DEFAULT;

  const { width } = useWindowDimensions();
  const { now, todayId } = useNow();

  // Acuan yang sedang dipilih. Nilai awalnya yang pertama — parameternya sudah
  // ada sejak render pertama, jadi tak perlu efek penyelaras.
  const [pickedRef, setPickedRef] = useState(refs[0] ?? '');
  const [verse, setVerse] = useState('');
  const [pickedKey, setPickedKey] = useState(SHARE_DESIGNS[0].key);
  // Tombol mana yang sedang bekerja — dua tombol, satu proses.
  const kerja = useBusyTask<'save' | 'ig'>();
  // Gambar mana yang SUDAH tersimpan di Foto (kunci = rupa + acuan + ayatnya).
  // Dipakai supaya menekan "Buka Instagram" sesudah "Simpan" tidak menyimpan
  // gambar yang sama dua kali ke galerimu.
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const svgRef = useRef<Svg>(null);
  const design = designOf(pickedKey);
  // Acuan yang dipakai: yang dipilih, atau yang pertama kalau pilihannya
  // sempat kosong (mis. parameternya cuma satu).
  const reference = pickedRef || refs[0] || '';

  // Pratinjau selebar layar dikurangi tepi, tapi dibatasi supaya lembar 9:16-nya
  // tetap muat utuh di layar mana pun (termasuk iPhone 15 yang tingginya pas).
  const previewW = Math.min(width - 40, 260);
  const previewH = (previewW * STORY_H) / STORY_W;
  // Kartunya SELALU dirender pada ukuran asli 1080×1920, lalu dikecilkan
  // dengan transform. Lihat catatan panjang di lib/shareImage.ts: yang
  // tertangkap toDataURL itu ukuran TATA LETAK view-nya, bukan kanvas yang
  // kita minta — dirender sebesar pratinjau, hasilnya kartu kecil di pojok
  // kiri-atas dengan sisanya hitam.
  const scale = previewW / STORY_W;

  /** Gambar kartunya jadi PNG 1080×1920 (base64, tanpa awalan `data:`). */
  function buatPng(): Promise<string> {
    return new Promise<string>((resolve, reject) => {
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
  }

  /** Simpan ke Foto — dilewati kalau gambar yang persis sama sudah tersimpan. */
  async function simpanKeFoto(): Promise<void> {
    const kunci = `${design.key}|${reference}|${verse}`;
    if (saved === kunci) return;
    await savePngToPhotos(await buatPng(), storyFileName(todayId, reference));
    setSaved(kunci);
  }

  /**
   * `save` = simpan ke Foto saja.
   * `ig`   = simpan ke Foto LALU buka kamera Story Instagram. Urutannya memang
   *          begitu: iOS tidak mengizinkan app lain menaruh gambar langsung ke
   *          dalam Instagram, jadi gambarnya harus sudah ada di galeri dulu —
   *          di kamera Story, foto terbaru muncul di pojok kiri bawah.
   */
  async function buatStory(mode: 'save' | 'ig') {
    await kerja.run({
      key: mode,
      start: () => setError(null),
      task: async () => {
        await simpanKeFoto();
        if (mode === 'ig') await openInstagram('story');
      },
      fail: (e) => setError(photoErrorMessage(e)),
    });
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        backLabel={meta.title}
        title="Bagikan Ayat 📖"
        subtitle="Instastory"
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
            ✍️ Isi Ayat
          </VixText>
          <FormInput
            style={styles.verseInput}
            placeholder="mis. TUHAN adalah gembalaku, takkan kekurangan aku."
            value={verse}
            onChangeText={setVerse}
            multiline
            editable={kerja.busy === null}
          />

          <View style={styles.previewWrap}>
            <View
              style={[styles.previewClip, { width: previewW, height: previewH }]}>
              <View style={[styles.full, { transform: [{ scale }] }]}>
                <BibleStoryCard
                  ref={svgRef}
                  verse={verse}
                  reference={reference}
                  version={version}
                  sessionLabel={meta.title.toUpperCase()}
                  design={design}
                  dateLabel={formatFullDate(now)}
                  archiveLabel={archiveNo(todayId)}
                  width={STORY_W}
                />
              </View>
            </View>
          </View>

          <VixText heading="title" additionalStyle={styles.sectionTitle}>
            🎨 Style
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

          <ActionStack>
            <PrimaryButton
              label="💾 Simpan ke Foto"
              busy={kerja.busy === 'save'}
              onPress={() => buatStory('save')}
              background={Color.MAIN_DARK}
            />
            <PrimaryButton
              label="📸 Buka Instagram Story"
              busy={kerja.busy === 'ig'}
              onPress={() => buatStory('ig')}
              background={Color.SPIRITUAL_DARK}
            />

            {saved === `${design.key}|${reference}|${verse}` && (
              <VixText heading="label" additionalStyle={styles.savedNote}>
                ✅ Tersimpan di Photos
              </VixText>
            )}
          </ActionStack>
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
  verseInput: { minHeight: 96, textAlignVertical: 'top' },
  previewWrap: { alignItems: 'center', paddingVertical: 14 },
  // Kartunya dirender seukuran aslinya lalu dikecilkan; kotak ini yang
  // memotongnya jadi sebesar pratinjau.
  previewClip: { overflow: 'hidden' },
  full: { width: STORY_W, height: STORY_H, transformOrigin: 'top left' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  savedNote: { textAlign: 'center', color: Color.SUCCESS },
});
