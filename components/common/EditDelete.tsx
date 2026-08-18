import { InlineDelete } from '@/components/common/InlineDelete';

// Tombol hapus di dalam sheet ubah — muncul HANYA saat sedang mengubah data
// yang sudah ada, tidak saat menambah baru.
//
// Kenapa konfirmasinya INLINE, bukan dialog terpisah: di iOS modal di atas
// modal tidak andal, sedangkan blok ini selalu berada di dalam SheetModal.
//
// Dua hal yang dulu gampang terlupa saat blok ini disalin ke tiap layar dan
// sekarang dijamin di satu tempat:
//   • penjaganya — 'new' & null sama-sama berarti "jangan tampilkan";
//   • `key` dari id datanya — supaya konfirmasi "yakin hapus?" yang terlanjur
//     terbuka ikut tertutup begitu pindah ke data lain.
export function EditDelete<T extends { id: string }>({
  editing,
  label,
  busy,
  onDelete,
}: {
  /** Data yang sedang diubah. 'new' atau null = tombol tidak ditampilkan. */
  editing: T | 'new' | null;
  label: string;
  busy: boolean;
  onDelete: () => void;
}) {
  if (editing === null || editing === 'new') return null;
  return (
    <InlineDelete
      key={editing.id}
      label={label}
      busy={busy}
      onDelete={onDelete}
    />
  );
}
