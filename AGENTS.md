# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

This project is on **Expo SDK 57** — React Native 0.86, React 19.2.3, New
Architecture enabled, React Compiler enabled. Do not trust older Expo answers:
APIs moved between SDK 54 and 57 (for example `useScrollToTop` now comes from
`expo-router/react-navigation`, not `@react-navigation/native`).

# Catat tiap perubahan besar di `lib/changelog.ts`

Pemilik app ini membaca riwayat perubahannya DARI DALAM APP (layar Version,
click kartu versinya). Daftar itu ditulis tangan, bukan dibaca dari git, karena
pesan commit di repo ini hampir seluruhnya "Update Version: x.y.z" dan tidak
menjelaskan apa pun.

**Sebelum melapor selesai**, tambahkan barisnya ke entri PALING ATAS
`lib/changelog.ts`. Yang dihitung besar:

- fitur baru, fitur dibuang, atau fitur berganti nama
- apa pun yang terlihat berbeda di layar
- perapihan yang mengubah cara kerja (bukan cuma bentuk kodenya)
- perbaikan bug yang memang pernah terlihat oleh pemakainya

Yang TIDAK dicatat: perapihan nol perubahan perilaku, suite, komentar, dokumen.

Kalau `version` di `app.json` naik, buat entri BARU di paling atas daftar itu
dengan nomor versi yang sama.

Bentuk tiap baris, supaya enak dibaca di layar HP:

- satu kalimat, satu perubahan, maksimal sekitar 12 kata
- lambang di DEPAN, dan lambangnya ikut fiturnya (💰 Finance, 🍽️ Puasa)
- tulis APA YANG BERUBAH BAGI PEMAKAINYA, bukan nama berkas atau fungsi
- tanpa tanda pisah panjang, dan pakai "click" bukan "tekan"

Penjaganya `cek/cek-changelog.js` (ikut `npm run cek`): versi di `app.json`
wajib punya entri, nomornya tidak boleh dobel, urutannya terbaru di atas, dan
kata-katanya diperiksa menurut aturan di atas.
