import { Color } from '@/assets/style/color';
import { EmojiButton } from '@/components/common/EmojiButton';

/**
 * Tombol ✏️ "ubah" — SATU rupa untuk SELURUH app.
 *
 * Dulu tiap daftar menggambar tombol editnya sendiri-sendiri, jadi bentuknya
 * ikut beda-beda:
 *   · CORE Leader / Timeline / History → ikon pensil telanjang, abu-abu, tanpa
 *     latar sama sekali → tidak kelihatan seperti tombol.
 *   · Multiplikasi → emoji ✏️ kuning di lingkaran abu.
 *   · Monthly → ikon pensil di lingkaran krem.
 *
 * Sekarang semuanya memakai yang ini — bentuknya persis tombol ✏️ di sub-tab
 * Monthly: lingkaran krem (latar = penanda "ini bisa ditekan") berisi ikon
 * pensil sewarna. Mau ganti rupa tombol edit? Cukup di berkas ini.
 *
 * Ukurannya ikut EmojiButton (42×42) — sekalian memenuhi anjuran Apple soal
 * luas click minimum, karena sebelumnya beberapa hanya 16px ikon polos.
 *
 * Catatan pemakaian: di dalam kartu, tombol ini harus jadi SAUDARA dari area
 * click kartunya, bukan anaknya. Pressable bersarang tidak andal di iOS —
 * click tombolnya ikut memicu aksi kartu.
 */
export function EditButton({
  onPress,
  disabled = false,
}: {
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <EmojiButton
      icon="pencil"
      iconColor={Color.ACCENT_DARK}
      onPress={onPress}
      disabled={disabled}
    />
  );
}
