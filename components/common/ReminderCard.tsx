import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type TextStyle } from 'react-native';

import { Color } from '@/assets/style/color';
import { PressableScale } from '@/components/common/PressableScale';
import { VixText } from '@/components/common/VixText';

// Kartu reminder di Home: latar pastel + border & teks gelap senada, judul
// tebal lalu daftar baris teks. Semua reminder memakai ini biar seragam
// (satu tempat mengatur bentuk & jarak kartunya).
//
// Dua mode tekan:
// - `onPress`  → seluruh kartu satu tombol (perilaku default).
// - `onItemPress` → TIAP baris (yang berbentuk {id,text}) jadi tombol sendiri
//   dengan tanda › — dipakai saat tiap baris menuju tujuan berbeda (mis. tiap
//   nama ulang tahun membuka orang itu di Family). Tak ada pressable bersarang.
export function ReminderCard({
  bg,
  fg,
  title,
  texts,
  onPress,
  onItemPress,
  right,
  children,
}: {
  bg: string; // warna latar pastel
  fg: string; // warna border + teks (versi gelap senada)
  title: string;
  texts?: (string | { id: string; text: string })[];
  onPress?: () => void;
  onItemPress?: (id: string) => void;
  /**
   * Tombol kecil di sebelah judul, mis. 📤 bagikan kartunya jadi gambar.
   *
   * Ada = kartunya TIDAK lagi jadi satu tombol besar; yang bisa ditekan cuma
   * badan teksnya. Pressable bersarang di iOS bikin tombol di dalam ikut
   * memicu tombol pembungkusnya — jadi keduanya sengaja bersebelahan, bukan
   * bertumpuk.
   */
  right?: ReactNode;
  children?: ReactNode; // isi khusus (mis. kutipan yang di-clamp)
}) {
  const color: StyleProp<TextStyle> = { color: fg };
  const cardStyle = [styles.card, { backgroundColor: bg, borderColor: fg }];

  // Judul selalu hitam (kontras di semua warna kartu); isi baris ikut fg.
  const judul = (
    <VixText heading="bold" additionalStyle={styles.title}>
      {title}
    </VixText>
  );

  const isi = (
    <>
      {texts?.map((t, i) => {
        if (typeof t !== 'string') {
          if (onItemPress) {
            return (
              <PressableScale
                key={t.id}
                style={styles.itemRow}
                onPress={() => onItemPress(t.id)}>
                <VixText
                  heading="label"
                  additionalStyle={[color, styles.itemText]}>
                  {t.text}
                </VixText>
                <VixText heading="label" additionalStyle={color}>
                  ›
                </VixText>
              </PressableScale>
            );
          }
          return (
            <VixText key={t.id} heading="label" additionalStyle={color}>
              {t.text}
            </VixText>
          );
        }
        return (
          <VixText key={i} heading="label" additionalStyle={color}>
            {t}
          </VixText>
        );
      })}
      {children}
    </>
  );

  // Mode per-baris: bungkus View biasa (tombolnya ada di tiap baris).
  if (onItemPress) {
    return (
      <View style={cardStyle}>
        {judul}
        {isi}
      </View>
    );
  }

  // Ada tombol di sebelah judul → judul & tombolnya berdampingan, dan yang
  // bisa ditekan cuma badan teksnya (tanpa Pressable bersarang).
  if (right) {
    return (
      <View style={cardStyle}>
        <View style={styles.headRow}>
          <View style={styles.headTitle}>{judul}</View>
          {right}
        </View>
        <PressableScale onPress={onPress}>{isi}</PressableScale>
      </View>
    );
  }

  return (
    <PressableScale style={cardStyle} onPress={onPress}>
      {judul}
      {isi}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  // Jarak antar-kartu diatur oleh kontainer (gap) di layar pemakainya — kartu
  // ini sendiri tak lagi punya marginBottom supaya jaraknya selalu seragam.
  card: {
    borderRadius: 16,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 3,
  },
  title: { color: Color.TEXT_TITLE },
  // Baris judul saat kartunya punya tombol sendiri di kanan.
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headTitle: { flex: 1 },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingVertical: 2,
  },
  itemText: { flexShrink: 1 },
});
