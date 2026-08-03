// Koordinasi date picker global: HANYA satu picker boleh terbuka sekaligus.
// Membuka picker lain — atau memfokus sebuah input teks — otomatis menutup
// picker yang sedang terbuka. Ini mengatasi masalah iOS di mana spinner tanggal
// tetap tampil & "makan tempat" saat menumpuk beberapa DateField dalam 1 form.
//
// Dipakai lintas komponen tanpa context/props: DateField mendaftar & menutup
// dirinya bila picker lain dibuka; FormInput memanggil closePickers() saat fokus.

type Listener = (openId: number | null) => void;

let currentId: number | null = null;
let seq = 0;
const listeners = new Set<Listener>();

/** Id unik & stabil untuk tiap DateField. */
export function nextPickerId(): number {
  seq += 1;
  return seq;
}

/** Tandai picker `id` sebagai yang terbuka → picker lain diminta menutup. */
export function openPicker(id: number) {
  currentId = id;
  listeners.forEach((l) => l(currentId));
}

/** Tutup picker yang sedang terbuka (kalau ada). */
export function closePickers() {
  if (currentId === null) return;
  currentId = null;
  listeners.forEach((l) => l(null));
}

/** Berlangganan perubahan picker aktif; kembalikan fungsi untuk berhenti. */
export function subscribePicker(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
