import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, initializeAuth, type Auth } from 'firebase/auth';
// `getReactNativePersistence` ada di build React Native firebase saat runtime,
// tetapi belum tercantum di type wrapper `firebase/auth`, jadi kita abaikan
// peringatan TypeScript pada baris impor ini saja.
// @ts-ignore
import { getReactNativePersistence } from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  type Firestore,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

/**
 * True kalau semua nilai penting sudah diisi di file .env.
 * Dipakai UI untuk menampilkan pesan "belum dikonfigurasi" alih-alih crash.
 */
export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId,
);

// initializeApp hanya boleh sekali. Saat hot-reload modul dievaluasi ulang,
// jadi pakai app yang sudah ada bila tersedia.
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Auth dengan penyimpanan lokal (AsyncStorage) supaya login tetap tersimpan
// setelah aplikasi ditutup. initializeAuth juga hanya boleh sekali.
//
// PENTING — kalau .env belum diisi, Firebase Auth MELEMPAR `auth/invalid-api-key`
// baik lewat initializeAuth MAUPUN getAuth. Dulu keduanya dipanggil di sini
// tanpa syarat, jadi modul ini gagal dimuat dan aplikasi mati sebelum layar
// apa pun tampil — orang yang baru clone repo ini cuma melihat layar putih,
// padahal layar Login sudah menyiapkan pesan "belum dikonfigurasi".
//
// Jadi saat belum dikonfigurasi, Auth sengaja TIDAK disentuh sama sekali.
// `auth` menjadi null dan satu-satunya pemakainya (contexts/auth.tsx) sudah
// menjaga: tanpa konfigurasi ia tidak memanggil Firebase apa pun.
let auth: Auth | null = null;
if (isFirebaseConfigured) {
  try {
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(ReactNativeAsyncStorage),
    });
  } catch {
    // Sudah pernah di-init (hot-reload) — ambil instance yang ada.
    auth = getAuth(app);
  }
}

// Firestore. experimentalForceLongPolling mencegah koneksi "menggantung"
// di sebagian jaringan/perangkat React Native.
let db: Firestore;
try {
  db = initializeFirestore(app, { experimentalForceLongPolling: true });
} catch {
  db = getFirestore(app);
}

export { app, auth, db };
