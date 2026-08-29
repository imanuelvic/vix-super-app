import { DualButtons } from '@/components/common/DualButtons';
import { EditDelete } from '@/components/common/EditDelete';

// Penutup sheet ubah — 🗑️ Hapus (kalau memang sedang mengubah) lalu
// Batal + Simpan.
//
// Tujuh belas sheet menulis pasangan yang sama persis:
//
//     <EditDelete
//       editing={editing}
//       label="Hapus catatan ini"
//       busy={busy}
//       onDelete={handleDelete}
//     />
//     <DualButtons
//       confirmLabel="Simpan"
//       busy={busy}
//       onCancel={() => setEditing(null)}
//       onConfirm={handleSave}
//     />
//
// Yang paling gampang meleset dari menyalinnya bukan tulisannya, tapi
// PASANGANNYA: `busy` harus dioper ke KEDUANYA. Kalau cuma DualButtons yang
// dapat, tombol Simpan mati saat menyimpan tapi tombol Hapus di atasnya masih
// hidup — sekali ditekan, penghapusan berjalan di tengah penyimpanan. Di sini
// satu `busy` mengunci keduanya sekaligus, tak bisa lupa.
//
// Urutannya juga bagian dari bentuknya: Hapus DI ATAS pasangan tombol, supaya
// aksi yang merusak tidak pernah bersebelahan dengan tombol yang paling sering
// ditekan.
export function EditFooter<T extends { id: string }>({
  editing,
  deleteLabel,
  busy,
  onDelete,
  onCancel,
  onConfirm,
  confirmLabel = 'Simpan',
}: {
  /** Data yang sedang diubah. 'new' atau null = tombol hapus tidak muncul. */
  editing: T | 'new' | null;
  /** Bunyi tombol hapusnya, mis. "Hapus catatan ini". */
  deleteLabel: string;
  busy: boolean;
  onDelete: () => void;
  onCancel: () => void;
  onConfirm: () => void;
  /** Bawaannya "Simpan"; isi kalau memang beda (mis. "Tambah" saat baru). */
  confirmLabel?: string;
}) {
  return (
    <>
      <EditDelete
        editing={editing}
        label={deleteLabel}
        busy={busy}
        onDelete={onDelete}
      />
      <DualButtons
        confirmLabel={confirmLabel}
        busy={busy}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />
    </>
  );
}
