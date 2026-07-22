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
let auth: Auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(ReactNativeAsyncStorage),
  });
} catch {
  // Sudah pernah di-init (hot-reload) — ambil instance yang ada.
  auth = getAuth(app);
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
