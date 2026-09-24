import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/common/PressableScale';
import { VixText } from '@/components/common/VixText';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useFeatureTheme } from '@/hooks/useFeatureTheme';

// Header standar layar (pola 3 kolom seperti Header.js lama):
// tombol kembali + Title/Subtitle di kiri + slot `right` di ujung kanan
// (mis. tombol emoji riwayat/budget khusus) + konten tambahan di bawah.
//
// Seluruh header duduk di atas PITA berwarna fitur — warna yang sama persis
// dengan tile-nya di grid Home (lihat hooks/useFeatureTheme). Jadi begitu
// sebuah fitur dibuka, warnanya ikut masuk: bukan cuma judulnya yang berganti,
// tapi seluruh kepala layarnya. Layar di luar fitur (Reward, Timeline,
// Riwayat) memakai pita warna merek, jadi bentuknya tetap seragam.
//
// `backLabel` opsional (22 Sep 2026): layar yang menjadi TAB UTAMA (Walk ·
// CORE · Work) tidak punya "kembali" — tanpa label, baris kembalinya tidak
// digambar dan judulnya naik mengisi tempatnya.
export function ScreenHeader({
  backLabel,
  title,
  subtitle,
  right,
  children,
}: {
  backLabel?: string;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const theme = useFeatureTheme();
  // Pita ikut menutupi jalur status bar di atasnya. Layar-layar ini memakai
  // SafeAreaView edges={['top']}, jadi ruang aman atas tergambar sebagai
  // paddingTop milik SafeAreaView — tanpa trik ini akan tersisa sepotong krem
  // di atas pita, dan pitanya terbaca sebagai kotak melayang, bukan kepala
  // layar. Caranya sama dengan yang dipakai BottomTabs untuk ruang aman bawah:
  // pitanya ditinggikan sebesar ruang aman lalu ditarik balik dengan margin
  // negatif, sehingga posisi isinya TIDAK bergeser sedikit pun.
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.band,
        {
          backgroundColor: theme.bg,
          paddingTop: insets.top,
          marginTop: -insets.top,
        },
      ]}>
      {backLabel ? (
        <PressableScale
          style={styles.backRow}
          onPress={() => router.back()}
          hitSlop={8}>
          <IconSymbol name="chevron.left" size={22} color={theme.fg} />
          <VixText heading="bold" additionalStyle={{ color: theme.fg }}>
            {backLabel}
          </VixText>
        </PressableScale>
      ) : (
        <View style={styles.noBack} />
      )}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View style={styles.titleBox}>
            <VixText heading="header" additionalStyle={{ color: theme.fg }}>
              {title}
            </VixText>
          </View>
          {right ? <View style={styles.rightBox}>{right}</View> : null}
        </View>
        {/* Subjudul mengambil LEBAR PENUH header, bukan cuma sisa di kiri
            tombol. Sebelumnya ia ikut menyempit tiap ada tombol di pojok
            kanan — dengan dua tombol (mis. Spiritual: 📖 + 🔥) kolomnya
            tinggal 251pt di iPhone 15, sedangkan "Being with God, bukan
            sekadar doing for God" butuh 282pt, jadi pecah dua baris. Di
            layar tanpa tombol lebarnya sama persis seperti dulu.

            Warnanya ikut fitur tapi diredupkan: di atas pita berwarna,
            abu-abu bawaan VixText terbaca kusam — dan pada pita paling pekat
            (emas Games, jingga Fitness) nyaris hilang. */}
        {subtitle ? (
          <VixText
            heading="label"
            additionalStyle={[styles.subtitle, { color: theme.fg }]}>
            {subtitle}
          </VixText>
        ) : null}
        {children}
      </View>
    </View>
  );
}

// Tinggi baris judul dipatok, TIDAK ikut isinya.
//
// Sebelumnya baris ini setinggi isi tertingginya: judul saja setinggi 45
// (lineHeight `header`), sedangkan judul + tombol pojok kanan setinggi tombolnya
// (42) ditambah jarak atasnya. Akibatnya subjudul di bawahnya pindah tempat
// setiap kali tombol pojok kanan muncul atau hilang — dan itu terjadi TIAP
// GANTI SUB-TAB (mis. Spiritual: Revive punya 📖 + 🔥, Sermon tidak punya
// keduanya), jadi kalimat "Being with God…" ikut naik-turun sendiri padahal
// tulisannya sama.
//
// Dipatok 46 = tombol 42 + sedikit napas, cukup memuat judul 45 juga. Sekarang
// baris ini selalu setinggi itu, ada tombol atau tidak, jadi subjudulnya diam
// di tempat. Berlaku untuk SEMUA layar yang memakai header ini.
const TITLE_ROW_HEIGHT = 46;

/**
 * Napas antara pita header dan isi layar di bawahnya.
 *
 * Diekspor supaya baris sub-tab (`BottomTabs` placement="top") bisa
 * MENIADAKANNYA dengan margin negatif sebesar angka yang sama. Tanpa satu
 * sumber angka, keduanya harus diubah bersamaan setiap kali dan cepat
 * melenceng: sisa 1pt krem di antara dua warna gelap langsung terlihat.
 */
export const BAND_GAP = 6;

const styles = StyleSheet.create({
  // Pita berwarna fitur. RATA di keempat sudutnya (24 Sep 2026, permintaan
  // pemiliknya) — sebelumnya sudut bawahnya membulat 24.
  //
  // Sudut membulat itu bermasalah justru di layar yang punya baris sub-tab:
  // di bawah pita ada bar emerald gelap, dan dua sudut membulat di atas bar
  // gelap menyisakan takik krem yang terbaca seperti salah gambar. Dengan
  // sudut rata, pita berwarna fitur dan bar emerald menyatu jadi SATU kepala
  // layar dua warna. Lengkungannya sekarang dipegang ujung bawah bar
  // emerald itu (lihat topBar di components/common/BottomTabs.tsx).
  band: {
    // Napas sebelum isi layar, menggantikan garis pemisah yang dulu tak pernah
    // ada: batas pita sekarang yang memisahkan kepala dari isi.
    // 6 + paddingTop 4 milik isi layar = CARD_GAP (10), jarak yang sama
    // dengan antar-kartu di bawahnya (lihat assets/style/card.ts).
    //
    // Layar yang punya baris sub-tab MENIADAKAN napas ini (BottomTabs menarik
    // dirinya naik sebesar BAND_GAP), supaya barnya benar-benar menempel.
    marginBottom: BAND_GAP,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 6,
  },
  // Tab utama: sedikit napas di atas judul sebagai ganti baris kembali.
  noBack: { height: 6 },
  subtitle: { opacity: 0.78 },
  header: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 12 },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    // Ditengahkan, bukan menempel atas: judul & tombol sama-sama duduk di
    // tengah tinggi tetap di atas, jadi keduanya tidak lagi saling mendorong.
    alignItems: 'center',
    gap: 10,
    minHeight: TITLE_ROW_HEIGHT,
  },
  titleBox: { flex: 1 },
  // Baris, bukan tumpukan: sebagian layar punya DUA tombol di pojok kanan
  // (mis. Spiritual 📖 riwayat + 🔥 reward).
  rightBox: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
