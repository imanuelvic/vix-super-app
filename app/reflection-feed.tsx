import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type Svg from 'react-native-svg';

import { Color } from '@/assets/style/color';
import { ActionStack } from '@/components/common/ActionStack';
import { Chip } from '@/components/common/Chip';
import { LoadingCenter } from '@/components/common/LoadingCenter';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { ScreenError } from '@/components/common/ScreenError';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { VixText } from '@/components/common/VixText';
import { ReflectionFeedCard } from '@/components/spiritual/ReflectionFeedCard';
import { useAuth } from '@/contexts/auth';
import { useBusyTask } from '@/hooks/useBusyTask';
import { useNow } from '@/hooks/useNow';
import { formatFullDate } from '@/lib/format';
import {
  habitNoteDone,
  isNoteDrivenHabit,
  subscribeHabitSchedule,
  type ScheduledHabit,
} from '@/lib/habits';
import { subscribeHabitDay, type HabitDay } from '@/lib/health';
import { unsubscribeAll } from '@/lib/liveDoc';
import { LOAD_ERROR } from '@/lib/messages';
import {
  archiveNo,
  designOf,
  FEED_DESIGNS,
  FEED_H,
  FEED_W,
  feedFileName,
  markFeedGenerated,
  openInstagram,
  photoErrorMessage,
  saveFeedToPhotos,
} from '@/lib/reflectionFeed';

// Daily Reflection Journal 📓 → gambar Instagram Feed 4:5.
//
// Refleksi yang kamu tulis di Habits ditata jadi selembar arsip
// `vixtory.archive`, bisa dilihat dulu, lalu disimpan ke Foto atau langsung
// dibawa ke Instagram.
export default function ReflectionFeedScreen() {
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const { now, todayId } = useNow();

  const [habits, setHabits] = useState<ScheduledHabit[] | null>(null);
  const [day, setDay] = useState<HabitDay | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Tombol mana yang sedang bekerja — dua tombol, satu proses; yang lain ikut
  // mati supaya tidak dobel.
  const kerja = useBusyTask<'save' | 'ig'>();
  // Gambar mana yang SUDAH tersimpan di Foto (kunci = rupa + isi tulisannya).
  // Dipakai supaya menekan "Buka Instagram" sesudah "Simpan" tidak menyimpan
  // gambar yang sama dua kali ke galerimu.
  const [saved, setSaved] = useState<string | null>(null);

  const [pickedKey, setPickedKey] = useState<string>(FEED_DESIGNS[0].key);

  const svgRef = useRef<Svg>(null);

  useEffect(() => {
    if (!user) return;
    const fail = () => setError(LOAD_ERROR);
    return unsubscribeAll([
      subscribeHabitSchedule(user.uid, setHabits, fail),
      subscribeHabitDay(user.uid, todayId, setDay, fail),
    ]);
  }, [user, todayId]);

  const reflectionHabit = habits?.find(isNoteDrivenHabit);
  const text = reflectionHabit ? (day?.notes[reflectionHabit.id] ?? '') : '';
  const ada = habitNoteDone(text);
  const design = designOf(pickedKey);

  // Pratinjau selebar layar dikurangi tepi, tapi dibatasi supaya lembar 4:5-nya
  // tetap muat utuh di layar mana pun.
  const previewW = Math.min(width - 40, 320);
  const previewH = (previewW * FEED_H) / FEED_W;
  // Kartunya SELALU dirender pada ukuran asli 1080×1350, lalu dikecilkan
  // dengan transform. Lihat catatan panjang di lib/shareImage.ts: yang
  // tertangkap toDataURL itu ukuran TATA LETAK view-nya, bukan kanvas yang
  // kita minta — dirender sebesar pratinjau, hasilnya kartu kecil di pojok
  // kiri-atas dengan sisanya hitam.
  const scale = previewW / FEED_W;

  /** Gambar kartunya jadi PNG 1080×1350 (base64, tanpa awalan `data:`). */
  function buatPng(): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const svg = svgRef.current;
      if (!svg) {
        reject(new Error('kartu belum siap'));
        return;
      }
      svg.toDataURL((data) => resolve(data), { width: FEED_W, height: FEED_H });
    });
  }

  /** Simpan ke Foto — dilewati kalau gambar yang persis sama sudah tersimpan. */
  async function simpanKeFoto(): Promise<void> {
    const kunci = `${design.key}|${text}`;
    if (saved === kunci) return;
    await saveFeedToPhotos(await buatPng(), feedFileName(todayId));
    setSaved(kunci);
  }

  /**
   * `save` = simpan ke Foto saja.
   * `ig`   = simpan ke Foto LALU buka Instagram. Urutannya memang begitu:
   *          iOS tidak mengizinkan app lain menaruh gambar langsung ke dalam
   *          Instagram, jadi gambarnya harus sudah ada di galeri dulu — begitu
   *          Instagram terbuka, dia jadi foto paling baru & tinggal dipilih.
   */
  async function jalankan(mode: 'save' | 'ig') {
    if (!user) return;
    await kerja.run({
      key: mode,
      start: () => setError(null),
      task: async () => {
        await simpanKeFoto();
        if (mode === 'ig') await openInstagram('app');
        // Tombol "Generate Feed" di Home berhenti menagih setelah ini. Sengaja
        // ditandai SESUDAH gambarnya jadi — gagal di tengah jalan tidak boleh
        // membuat tombolnya hilang.
        await markFeedGenerated(user.uid, todayId);
      },
      fail: (e) => setError(photoErrorMessage(e)),
    });
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        backLabel="Home"
        title="Generate Feed 🖼️"
        subtitle="Feed Instagram"
      />

      <ScreenError message={error} />

      {habits === null || day === null ? (
        <LoadingCenter />
      ) : !ada ? (
        <View style={styles.emptyWrap}>
          <VixText heading="label" additionalStyle={styles.empty}>
            Refleksi hari ini belum ditulis. Isi dulu di Habits → sesi Pagi →
            📓 Daily Reflection Journal, baru bisa dibuatkan feed-nya.
          </VixText>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.previewWrap}>
            <View
              style={[styles.previewClip, { width: previewW, height: previewH }]}>
              <View style={[styles.full, { transform: [{ scale }] }]}>
                <ReflectionFeedCard
                  ref={svgRef}
                  text={text}
                  design={design}
                  dateLabel={formatFullDate(now)}
                  archiveLabel={archiveNo(todayId)}
                  width={FEED_W}
                />
              </View>
            </View>
          </View>

          <VixText heading="title" additionalStyle={styles.sectionTitle}>
            🎨 Style
          </VixText>
          <View style={styles.chipWrap}>
            {FEED_DESIGNS.map((d) => (
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
              onPress={() => jalankan('save')}
              background={Color.MAIN_DARK}
            />
            <PrimaryButton
              label="📸 Buka Instagram"
              busy={kerja.busy === 'ig'}
              onPress={() => jalankan('ig')}
              background={Color.SPIRITUAL_DARK}
            />

            {saved === `${design.key}|${text}` && (
              <VixText heading="label" additionalStyle={styles.savedNote}>
                ✅ Tersimpan di Foto — di Instagram, dia foto yang paling baru.
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
  previewWrap: { alignItems: 'center', paddingVertical: 8 },
  // Kartunya dirender seukuran aslinya lalu dikecilkan; kotak ini yang
  // memotongnya jadi sebesar pratinjau.
  previewClip: { overflow: 'hidden' },
  full: { width: FEED_W, height: FEED_H, transformOrigin: 'top left' },
  sectionTitle: { marginTop: 14, marginBottom: 8 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  savedNote: { textAlign: 'center', color: Color.SUCCESS },
});
