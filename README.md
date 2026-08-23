# vix-super-app

Personal super app — semua kebutuhan pribadi dalam satu aplikasi (tasks,
catatan, pelayanan, personal management), tersinkron di semua perangkat lewat
Firebase.

**Stack:** Expo SDK 57 · expo-router · Firebase JS SDK (Auth + Firestore)

## Menjalankan

1. Isi `.env` dengan firebaseConfig dari Firebase Console (lihat `.env.example`).
2. Install & start:

   ```bash
   npm install
   npx expo start -c
   ```

3. Buka di **Expo Go** (scan QR), atau tekan `a` (Android) / `i` (iOS simulator).

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

- `.env` dan private key Admin SDK **tidak** ikut ke git. Jangan pernah commit
  file kredensial. Web config (`EXPO_PUBLIC_FIREBASE_*`) aman karena dilindungi
  Security Rules + Auth.
