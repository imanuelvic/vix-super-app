// Jarak baku JUDUL BAGIAN — ruang di atas & di bawah tiap "🎁 Self-Reward",
// "⚽ Game & Score", "👥 Anggota", dan sejenisnya.
//
// Angkanya SAMA di atas dan di bawah, dan itu bukan sekadar selera: judul
// bagian adalah pemisah antara dua daftar. Ruang atas-bawah yang timpang
// membuatnya terlihat menempel pada salah satu sisi — biasanya pada daftar di
// bawahnya, yang justru bukan miliknya.
//
// Sebelum ini tiap layar menulis angkanya sendiri, dan hasilnya sepuluh pasang
// angka berbeda untuk hal yang sama: 14/8, 16/8, 14/10, 18/2, 4/8, 6/10 …
// Tidak ada satu pun yang salah sendirian; yang salah adalah tak ada dua layar
// yang sama. Dipakai dengan disebar:
//
//   const styles = StyleSheet.create({
//     sectionTitle: { ...SECTION_SPACE },
//   });
//
// Judul yang DIPATOK (SectionToggle) memakai angka yang sama sebagai padding,
// bukan margin — margin tidak ikut mewarnai latar, dan latar yang bolong
// membuat daftar di belakangnya tembus saat digulung.
// Sengaja BUKAN ViewStyle: judul bagian itu <VixText>, jadi angkanya harus
// bisa masuk ke gaya teks maupun gaya View. ViewStyle memuat properti yang
// tidak dikenal TextStyle, dan TypeScript menolak seluruh objeknya karena itu.
export const SECTION_SPACE: { marginTop: number; marginBottom: number } = {
  marginTop: 10,
  marginBottom: 10,
};
