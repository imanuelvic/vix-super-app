// Lambang sesi hari — SATU sumber untuk seluruh app.
//
// Dulu tiap fitur memilih sendiri: Habits & Diet memakai 🌤️ untuk Siang,
// sedangkan Bacaan Alkitab & Achievement memakai ☀️. Karena ☀️ juga dipakai
// sapaan "Selamat pagi", lambang yang sama akhirnya berarti dua waktu berbeda
// tergantung layarnya.
//
// Pakai konstanta ini di mana pun ada label Pagi/Siang/Malam. Ubah di sini =
// seluruh app ikut berubah, tak ada lagi yang tertinggal.
export const DAYPART = {
  morning: '🌅',
  daytime: '🌤️',
  night: '🌙',
} as const;
