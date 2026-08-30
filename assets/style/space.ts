// Jarak baku tombol aksi — tombol lebar penuh yang ditumpuk di bawah isi layar.
//
// Dua angka, dua peran yang memang berbeda:
//   ACTION_TOP  jarak tombol PERTAMA dari isi di atasnya. Lebih lega, karena
//               yang dipisahkan dua hal berbeda: bacaan vs aksi.
//   ACTION_GAP  jarak antar tombol yang bertumpuk. Lebih rapat, supaya
//               terbaca sebagai satu kelompok tombol, bukan tombol lepas-lepas.
//
// Angkanya bukan karangan baru: 18/10 sudah dipakai Bagikan Ayat 📖, Generate
// Feed 🖼️, & gerbang Doa Pagi 🌅. Yang meleset justru Catatan Revive (0) &
// Catatan Khotbah (20) — di situlah tombol Share ke WhatsApp menempel ke
// tulisan Aplikasi.
//
// Dipakai lewat <ActionStack/> supaya tiap layar tidak menuliskan angkanya
// sendiri: sekali ditulis tangan, di situ pula ia mulai bergeser.
export const ACTION_TOP = 18;
export const ACTION_GAP = 10;
