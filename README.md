# vix-super-app

Personal super app — semua kebutuhan pribadi dalam satu aplikasi (tasks,
catatan, pelayanan, personal management), tersinkron di semua perangkat lewat
Firebase.

**Stack:** Expo SDK 57 · expo-router · Firebase JS SDK (Auth + Firestore)

> **Repo ini publik, tapi datanya tidak.** Tidak ada satu pun kredensial di
> sini. Setelah di-clone, aplikasi ini **tidak terhubung ke server, database,
> atau akun siapa pun** — ia menolak jalan sampai kamu mengarahkannya ke proyek
> Firebase milikmu sendiri. Langkahnya di bawah.

## Kalau kamu baru clone repo ini

Semua langkah ini **wajib**, dan semuanya menunjuk ke akunmu sendiri.

1. **Buat proyek Firebase-mu sendiri** (gratis) di
   [console.firebase.google.com](https://console.firebase.google.com), lalu
   tambahkan satu **Web app** di dalamnya.
2. **Salin `.env.example` menjadi `.env`**, isi dengan `firebaseConfig` dari
   proyek tadi. `.env` tidak pernah ikut ke git. Tanpa langkah ini aplikasi
   tetap terbuka, tapi layar Login menampilkan "Firebase belum dikonfigurasi"
   dan tidak menghubungi Firebase mana pun.
3. **Pasang security rules-nya**: isi `firestore.rules` & `storage.rules` di
   Firebase Console (tab Rules → Publish). ⚠️ **Ganti alamat email di dalam
   kedua berkas itu dengan emailmu**, dan isi `EXPO_PUBLIC_OWNER_EMAIL` di
   `.env` dengan email yang sama — kalau tidak, akunmu sendiri yang ditolak.
4. **Kalau mau di-build (EAS)**, ganti identitas aplikasinya lebih dulu di
   `app.json`: `owner`, `slug`, `ios.bundleIdentifier`, `extra.eas.projectId`,
   dan `updates.url`. Cara paling gampang: jalankan `eas init` — perintah itu
   membuat proyek EAS atas namamu dan menulis ulang id-nya.
   ⚠️ Kalau langkah ini dilewati, `updates.url` bawaan repo masih menunjuk
   proyek EAS milik pemiliknya, jadi aplikasi hasil build-mu bisa menarik
   pembaruan OTA dari sana, bukan dari punyamu.

## Menjalankan

```bash
npm install
npx expo start -c
```

Lalu buka di **Expo Go** (scan QR), atau tekan `i` (iOS simulator).

## Struktur penting

| Path | Isi |
| --- | --- |
| `lib/firebase.ts` | Inisialisasi Firebase (Auth + Firestore) |
| `lib/tasks.ts` | Data layer Tasks (CRUD + real-time) |
| `contexts/auth.tsx` | State login global |
| `app/login.tsx` | Layar login / daftar |
| `app/(tabs)/index.tsx` | Layar Home (daftar fitur) |
| `app/tasks.tsx` | Layar Tasks |
| `firestore.rules` | Security rules (kunci data per user) |

## Catatan keamanan

Selengkapnya di **[SECURITY.md](SECURITY.md)** — model ancaman, apa yang sudah
aman, dan apa yang masih perlu diklik di Console.

- `.env` dan private key Admin SDK **tidak** ikut ke git. Jangan pernah commit
  file kredensial. Web config (`EXPO_PUBLIC_FIREBASE_*`) aman karena dilindungi
  Security Rules + Auth.
- Kunci sesungguhnya ada di `firestore.rules`: `request.auth.uid == userId`
  membuat satu akun cuma bisa menyentuh cabangnya sendiri, dan `isOwner()`
  membatasi ke satu alamat email. Jangan longgarkan keduanya.
