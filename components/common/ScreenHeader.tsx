import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { PressableScale } from '@/components/common/PressableScale';
import { VixText } from '@/components/common/VixText';
import { IconSymbol } from '@/components/ui/icon-symbol';

// Header standar layar (pola 3 kolom seperti Header.js lama):
// tombol kembali + Title/Subtitle di kiri + slot `right` di ujung kanan
// (mis. tombol emoji riwayat/budget khusus) + konten tambahan di bawah.
export function ScreenHeader({
  backLabel,
  title,
  subtitle,
  right,
  children,
}: {
  backLabel: string;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <View>
      <PressableScale
        style={styles.backRow}
        onPress={() => router.back()}
        hitSlop={8}>
        <IconSymbol name="chevron.left" size={22} color={Color.MAIN} />
        <VixText heading="bold" additionalStyle={styles.backText}>
          {backLabel}
        </VixText>
      </PressableScale>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View style={styles.titleBox}>
            <VixText heading="header" additionalStyle={styles.title}>
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
            layar tanpa tombol lebarnya sama persis seperti dulu. */}
        {subtitle ? <VixText heading="label">{subtitle}</VixText> : null}
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

const styles = StyleSheet.create({
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 6,
  },
  backText: { color: Color.MAIN },
  header: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 10 },
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
  title: { color: Color.MAIN },
  // Baris, bukan tumpukan: sebagian layar punya DUA tombol di pojok kanan
  // (mis. Spiritual 📖 riwayat + 🔥 achievement).
  rightBox: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
