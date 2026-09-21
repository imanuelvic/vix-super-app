import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type TextStyle } from 'react-native';

import { Color } from '@/assets/style/color';
import { PressableScale } from '@/components/common/PressableScale';
import { VixText } from '@/components/common/VixText';
import { IconSymbol } from '@/components/ui/icon-symbol';

// Kartu reminder di Home: latar pastel + border & teks gelap senada, judul
// tebal lalu daftar baris teks. Semua reminder memakai ini biar seragam
// (satu tempat mengatur bentuk & jarak kartunya).
//
// Dua mode click:
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
  action,
  onClose,
  corner,
  children,
}: {
  bg: string; // warna latar pastel
  fg: string; // warna border + teks (versi gelap senada)
  title: string;
  texts?: (string | { id: string; text: string })[];
  onPress?: () => void;
  onItemPress?: (id: string) => void;
  /**
   * Tombol aksi di pojok kanan BAWAH kartu, mis. bagikan kartunya jadi gambar.
   *
   * Di BAWAH, bukan di samping judul: judulnya pendek ("🕊️ Reminder") tapi
   * kalimatnya panjang, jadi tombol di atas menggantung sendirian jauh dari
   * tulisan yang ia bagikan. Di kaki kartu ia jatuh tepat sesudah kalimat yang
   * baru selesai dibaca — dan itu memang saat kamu memutuskan mau
   * membagikannya.
   *
   * Ada = kartunya TIDAK lagi jadi satu tombol besar; yang bisa di-click cuma
   * badan teksnya. Pressable bersarang di iOS bikin tombol di dalam ikut
   * memicu tombol pembungkusnya — jadi keduanya sengaja bersaudara, bukan
   * bertumpuk.
   */
  action?: ReactNode;
  /**
   * Tombol ✕ kecil di pojok kanan ATAS kartu — "singkirkan kartu ini" (mis.
   * Doa Syafaat: tutup untuk hari ini, muncul lagi besok; 15 Sep 2026).
   *
   * Sama seperti `action`, adanya tombol ini membuat kartunya TIDAK lagi satu
   * tombol besar: ✕ berdiri sebagai SAUDARA badan teks yang bisa di-click,
   * bukan anaknya — Pressable bersarang di iOS bikin click ✕ ikut memicu
   * tombol pembungkusnya. Judulnya diberi ruang kanan supaya tidak
   * terselip di bawah ✕.
   */
  onClose?: () => void;
  /**
   * Lambang kecil di pojok kanan BAWAH kartu, tepat di bawah ✕ (21 Sep 2026)
   * — mis. ▾/▴ "kartu ini bisa dibuka/ditutup" atau → "menuju layar lain".
   * Dulu ditempel di ujung judul; begitu judulnya membungkus, lambangnya
   * jatuh sendirian di kiri baris kedua. Ia kolom sendiri di kanan badan
   * teks (rata bawah), jadi tak pernah menimpa tulisan sepanjang apa pun.
   */
  corner?: string;
  children?: ReactNode; // isi khusus (mis. kutipan yang di-clamp)
}) {
  const color: StyleProp<TextStyle> = { color: fg };
  const cardStyle = [styles.card, { backgroundColor: bg, borderColor: fg }];

  // Judul selalu hitam (kontras di semua warna kartu); isi baris ikut fg.
  const judul = (
    <VixText
      heading="bold"
      additionalStyle={[styles.title, onClose ? styles.titleRoom : undefined]}>
      {title}
    </VixText>
  );

  // ✕ di pojok — posisi mutlak supaya menambahkannya tidak menggeser judul
  // maupun tinggi kartu; hitSlop-nya lebar karena ikonnya kecil.
  const tutup = onClose ? (
    <PressableScale
      style={styles.closeButton}
      onPress={onClose}
      hitSlop={10}
      accessibilityLabel="Tutup kartu ini">
      <IconSymbol name="xmark" size={13} color={fg} />
    </PressableScale>
  ) : null;

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

  // Judul + baris teks, dan (kalau ada) lambang pojok di kolom kanannya yang
  // rata bawah — badan teks yang memanjang tinggal mendorongnya ke bawah.
  const badan = corner ? (
    <View style={styles.bodyRow}>
      <View style={styles.bodyMain}>
        {judul}
        {isi}
      </View>
      <VixText heading="bold" additionalStyle={[styles.title, styles.corner]}>
        {corner}
      </VixText>
    </View>
  ) : (
    <>
      {judul}
      {isi}
    </>
  );

  // Mode per-baris: bungkus View biasa (tombolnya ada di tiap baris).
  if (onItemPress) {
    return (
      <View style={cardStyle}>
        {badan}
        {tutup}
      </View>
    );
  }

  // Ada tombol aksi / tombol tutup → keduanya berdiri sendiri (kaki kartu
  // rata kanan / pojok kanan atas), dan yang bisa di-click cuma judul + badan
  // teksnya (tanpa Pressable bersarang).
  if (action || onClose) {
    return (
      <View style={cardStyle}>
        <PressableScale onPress={onPress}>{badan}</PressableScale>
        {action ? <View style={styles.actionRow}>{action}</View> : null}
        {tutup}
      </View>
    );
  }

  return (
    <PressableScale style={cardStyle} onPress={onPress}>
      {badan}
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
  // Ruang untuk ✕ di kanan judul (lebar tombolnya + celah).
  titleRoom: { paddingRight: 28 },
  // ✕ di pojok kanan atas, di dalam padding kartu.
  closeButton: {
    position: 'absolute',
    top: 10,
    right: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Kaki kartu saat ia punya tombol aksi sendiri — menempel ke kanan bawah.
  actionRow: { alignItems: 'flex-end', marginTop: 4 },
  // Badan teks + kolom lambang pojok. `gap` kartu pindah ke bodyMain supaya
  // jarak judul–baris teks tetap sama dengan kartu tanpa lambang.
  bodyRow: { flexDirection: 'row', alignItems: 'flex-end' },
  bodyMain: { flex: 1, gap: 3 },
  // Selebar tombol ✕ dan segaris dengannya (✕ ada di right 12, di dalam
  // padding 16 → margin kanan -4), jadi lambangnya persis di bawah ✕.
  corner: { width: 24, textAlign: 'center', marginRight: -4 },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingVertical: 2,
  },
  itemText: { flexShrink: 1 },
});
