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
 * Sekarang semuanya memakai yang ini: lingkaran pekat sewarna fitur tempatnya
 * berdiri (latar = penanda "ini bisa ditekan") berisi ikon pensil putih. Mau
 * ganti rupa tombol edit? Cukup di berkas ini.
 *
 * Ukurannya ikut EmojiButton (42×42) — sekalian memenuhi anjuran Apple soal
 * luas klik minimum, karena sebelumnya beberapa hanya 16px ikon polos.
 *
 * Catatan pemakaian: di dalam kartu, tombol ini harus jadi SAUDARA dari area
 * klik kartunya, bukan anaknya. Pressable bersarang tidak andal di iOS —
 * klik tombolnya ikut memicu aksi kartu.
 */
export function EditButton({
  onPress,
  disabled = false,
}: {
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <EmojiButton icon="pencil" onPress={onPress} disabled={disabled} />
  );
}
