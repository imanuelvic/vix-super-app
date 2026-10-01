import { Color } from '@/assets/style/color';
import { PressableScale } from '@/components/common/PressableScale';
import { IconSymbol } from '@/components/ui/icon-symbol';

// Tombol ✗ kecil di ujung kanan SATU BARIS daftar — hapus baris itu.
//
// Sengaja samar (abu-abu, 16px, tanpa latar): ia harus bisa dijangkau tanpa
// menarik perhatian. Baris daftar dibaca puluhan kali dan dihapus sekali;
// tombol merah bertuliskan "Hapus" di tiap baris membuat seluruh daftar
// terbaca seperti daftar hal yang mau dibuang.
//
// `hitSlop` 10 itu yang membuatnya tetap gampang di-click walau gambarnya
// kecil: daerah sentuhnya 36×36, bukan 16×16.
//
// ⚠️ Pemanggilnya WAJIB menyediakan konfirmasi — semua hapus di app ini
// permanen. Di layar biasa pakai <ConfirmDialog>; di dalam SheetModal pakai
// <InlineDeleteConfirm> (iOS tidak menampilkan modal di atas modal).
export function DeleteX({
  onPress,
  disabled = false,
}: {
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <PressableScale onPress={onPress} disabled={disabled} hitSlop={10}>
      <IconSymbol name="xmark" size={16} color={Color.TEXT_PLACEHOLDER} />
    </PressableScale>
  );
}
