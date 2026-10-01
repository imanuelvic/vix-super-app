import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { PANEL } from '@/assets/style/card';
import { Color } from '@/assets/style/color';
import { SCREEN_CONTENT_PINNED } from '@/assets/style/layout';
import { EmptyText } from '@/components/common/EmptyText';
import { PressableScale } from '@/components/common/PressableScale';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { StickyTop } from '@/components/common/StickyTop';
import { VixText } from '@/components/common/VixText';
import { QuoteBox } from '@/components/spiritual/QuoteBox';
import { IconSymbol } from '@/components/ui/icon-symbol';
import {
    activeFasting,
    fastingDayNumber,
    fastingProgress,
    type FastingPlan,
} from '@/lib/fasting';
import { dayIdToDate, formatShortDate } from '@/lib/format';
import { dayDocId } from '@/lib/health';

// Tab Fasting 🍽️ — daftar periode puasa. Yang sedang berjalan diangkat ke
// atas sebagai kartu besar (lengkap dengan pokok doa hari ini); sisanya jadi
// riwayat. Detail & checklist hariannya ada di layar /fasting.
export function FastingTab({ plans }: { plans: FastingPlan[] }) {
  const router = useRouter();

  const now = new Date();
  const todayId = dayDocId(now);
  const active = activeFasting(plans, now);
  const others = plans.filter((p) => p.id !== active?.id);
  const aktifTanda = active ? fastingProgress(active) : null;

  function open(id?: string) {
    router.push(id ? { pathname: '/fasting', params: { id } } : '/fasting');
  }

  /** Checklist hariannya — layar sendiri, tak perlu lewat Edit Puasa dulu. */
  function openDays(id: string) {
    router.push({ pathname: '/fasting-days', params: { id } });
  }

  return (
    <View style={styles.flex}>
      {/* Dipatok di atas seperti Jadwalkan Visitasi & Buat Rapat Bulanan:
          tombolnya tetap terjangkau walau riwayat puasanya digulung ke bawah.
          Dulu ia duduk DI BAWAH kartu puasa yang sedang berjalan, jadi saat
          ada puasa aktif ia sudah setengah layar dari atas. */}
      <StickyTop>
        <PrimaryButton label="Tambah Puasa Baru" icon="plus" onPress={() => open()} />
      </StickyTop>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Sedang puasa hari ini — pokok doa hari ini di depan mata */}
        {active && (
          <PressableScale
            style={styles.activeCard}
            onPress={() => open(active.id)}>
            <VixText heading="label" additionalStyle={styles.activeLabel}>
              🍽️ Sedang Puasa, hari ke-
              {fastingDayNumber(active, todayId)} dari{' '}
              {aktifTanda?.total ?? 0}
            </VixText>
            <VixText heading="title" additionalStyle={styles.activeTitle}>
              {active.title}
            </VixText>
            {active.rules ? (
              <VixText heading="label" additionalStyle={styles.activeText}>
                📜 {active.rules}
              </VixText>
            ) : null}
            {aktifTanda && (
              <Tanda
                done={aktifTanda.done}
                failed={aktifTanda.failed}
                onDark
              />
            )}
          </PressableScale>
        )}

        {/* Tombolnya di LUAR kartu, bukan di dalamnya: PressableScale bersarang
            tidak andal di iOS — yang di dalam sering tidak menanggapi click. */}
        {active && (
          <PressableScale
            style={styles.daysButton}
            onPress={() => openDays(active.id)}>
            <VixText heading="bold" additionalStyle={styles.daysText}>
              📆 Lihat Hari per Hari
            </VixText>
            <IconSymbol
              name="chevron.right"
              size={16}
              color={Color.SPIRITUAL_DARK}
            />
          </PressableScale>
        )}

        {/* Garis pemisah: di atasnya yang SEDANG berjalan, di bawahnya
            arsipnya. Cuma digambar kalau memang ada yang sedang berjalan —
            kalau tidak, tidak ada yang perlu dipisahkan. */}
        {active && <View style={styles.pemisah} />}

        {plans.length === 0 && (
          <EmptyText>
            Belum ada catatan puasa. Tentukan pokok doa, tanggal mulai–selesai &
            peraturanmu, lalu centang tiap hari yang berhasil 🍽️
          </EmptyText>
        )}

        {others.map((p) => {
          const { done, failed, total } = fastingProgress(p);
          const upcoming = p.startId > todayId;
          return (
            /* Dua tujuan, dua tombol BERSEBELAHAN (bukan bersarang — di iOS
               Pressable di dalam Pressable sering tidak menanggapi click):
               📆 di depan → checklist hariannya; kartunya → keterangannya. */
            <View key={p.id} style={styles.row}>
              <PressableScale
                style={styles.daysIcon}
                onPress={() => openDays(p.id)}>
                <VixText additionalStyle={styles.daysIconText}>📆</VixText>
                <VixText heading="label" additionalStyle={styles.daysIconSub}>
                  {done}/{total}
                </VixText>
              </PressableScale>
              <PressableScale
                style={styles.card}
                onPress={() => open(p.id)}>
                {/* Angka {done}/{total} pindah ke tombol 📆 di depannya —
                    di situlah tempat ia bisa di-click untuk dilihat. */}
                <VixText heading="bold" additionalStyle={styles.cardTitle}>
                  {p.title}
                </VixText>
                <VixText heading="label" additionalStyle={styles.cardDate}>
                  📆 {formatShortDate(dayIdToDate(p.startId))} –{' '}
                  {formatShortDate(dayIdToDate(p.endId))}
                  {upcoming ? ' · belum mulai' : ''}
                </VixText>
                {/* Hasilnya terbaca dari daftar, tanpa membuka apa pun. */}
                <Tanda done={done} failed={failed} />
                {/* Pokok doa utamanya TIDAK ditampilkan di sini: isinya
                    perkara pribadi yang panjang, dan di daftar ia cuma jadi
                    dua baris terpotong yang tidak terbaca utuh. Tempat
                    membacanya di layar puasanya sendiri.

                    Yang tampil JAWABAN doanya — satu kalimat, dan justru
                    itulah yang pantas dibaca ulang dari daftar. Bentuknya sama
                    dengan kutipan di daftar Catatan Khotbah. */}
                {p.answer ? (
                  <QuoteBox text={p.answer} prefix="✨" lines={3} />
                ) : null}
              </PressableScale>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

/**
 * Tanda hasil puasa di daftar: berapa hari BERHASIL, berapa hari GAGAL.
 *
 * Angka "1/6" di tombol 📆 saja tidak menjawab pertanyaan yang sebenarnya,
 * yaitu: lima sisanya itu gagal, atau memang belum sempat dijawab? Keduanya
 * terlihat sama persis dari angka itu, padahal artinya jauh berbeda, dan yang
 * satu memang layak dilihat berulang (lihat lib/fasting.ts).
 *
 * Yang nol tidak digambar: puasa tanpa kegagalan tidak perlu diberi tahu "0
 * gagal", dan puasa yang belum dijalani sama sekali tidak diberi baris kosong.
 *
 * `onDark` = sedang di atas kartu ungu pekat (puasa yang berjalan). Di situ
 * hijau & merahnya tidak terbaca, jadi yang membedakan tinggal lambangnya.
 */
function Tanda({
  done,
  failed,
  onDark = false,
}: {
  done: number;
  failed: number;
  onDark?: boolean;
}) {
  if (done === 0 && failed === 0) return null;
  return (
    <View style={styles.tanda}>
      {done > 0 && (
        <VixText
          heading="label"
          additionalStyle={onDark ? styles.tandaOnDark : styles.tandaDone}>
          ✅ {done} berhasil
        </VixText>
      )}
      {failed > 0 && (
        <VixText
          heading="label"
          additionalStyle={onDark ? styles.tandaOnDark : styles.tandaFail}>
          ✗ {failed} gagal
        </VixText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { ...SCREEN_CONTENT_PINNED, paddingBottom: 24 },
  // 26 Sep 2026: puasa yang SEDANG berjalan digambar PEKAT (ungu tergelap,
  // tulisan putih), bukan pastel seperti sebelumnya. Dulu kartu aktif dan
  // kartu arsip di bawahnya sama-sama terang, jadi harus dibaca dulu untuk
  // tahu mana yang sedang jalan. Sekarang bedanya terbaca sekali pandang,
  // pola yang sama dengan kartu ringkasan gelap di fitur lain.
  activeCard: {
    backgroundColor: Color.SPIRITUAL_DEEP,
    borderRadius: 20,
    padding: 18,
    gap: 6,
    marginBottom: 10,
  },
  activeLabel: { color: Color.TEXT_ON_DARK_MUTED },
  activeTitle: { color: Color.TEXT_REVERSE },
  activeText: { color: Color.TEXT_ON_DARK_MUTED },
  // Pemisah antara blok puasa yang sedang berjalan dan segala sesuatu di
  // bawahnya (tombol tambah + arsip). Tanpa ini ketiganya terbaca sebagai satu
  // tumpukan, dan yang sedang berjalan kehilangan kedudukannya.
  pemisah: {
    height: 1,
    backgroundColor: Color.BORDER,
    marginTop: 6,
    marginBottom: 14,
  },
  card: {
    ...PANEL,
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    // 3 → 6: kutipan jawaban doanya butuh sedikit ruang napas dari baris
    // tanggal di atasnya, sama seperti kartu Catatan Khotbah.
    gap: 6,
  },
  cardTitle: { color: Color.TEXT_TITLE, flexShrink: 1 },
  cardDate: { color: Color.SPIRITUAL_DARK },
  // Tanda berhasil & gagal, berdampingan dalam satu baris.
  tanda: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  tandaDone: { color: Color.SUCCESS },
  tandaFail: { color: Color.DANGER },
  tandaOnDark: { color: Color.TEXT_ON_DARK_MUTED },
  // Satu baris daftar = tombol 📆 + kartunya, bersebelahan.
  row: { flexDirection: 'row', alignItems: 'stretch', gap: 8, marginBottom: 8 },
  // Tombol checklist harian di DEPAN tiap puasa. Lebarnya tetap supaya
  // kartu-kartu di kanannya tetap sejajar, berapa pun angkanya.
  daysIcon: {
    width: 58,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    backgroundColor: Color.SPIRITUAL,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Color.SPIRITUAL_DARK,
  },
  daysIconText: { fontSize: 20, lineHeight: 24 },
  daysIconSub: { color: Color.SPIRITUAL_DARK },
  // Tombol checklist untuk puasa yang SEDANG berjalan (di bawah kartu besarnya).
  daysButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Color.SPIRITUAL,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Color.SPIRITUAL_DARK,
    paddingVertical: 12,
    marginBottom: 12,
  },
  daysText: { color: Color.SPIRITUAL_DARK },
});
