import { type FirebaseApp } from 'firebase/app';
import { CustomProvider, initializeAppCheck } from 'firebase/app-check';

// ===================== 🛡️ Firebase App Check =====================
//
// Menutup satu-satunya pintu di app ini yang benar-benar terbuka untuk umum:
// **Firebase AI Logic**.
//
// ── Kenapa ini perlu ──────────────────────────────────────────────────────
// `firestore.rules` menjaga Firestore dengan benar, tapi AI Logic adalah
// LAYANAN TERPISAH yang tidak disentuh Security Rules sama sekali. Config
// Firebase-mu terbaca publik di repo (dan memang normal begitu), tapi config
// yang sama cukup untuk memanggil proxy AI Logic-mu langsung. Artinya semua
// pagar di lib/aiGuard.ts (memo, dedupe, cooldown, kunci 429, batas 30/hari)
// berjalan di SISI KLIEN, jadi bisa dilewati begitu saja oleh siapa pun yang
// memanggil endpoint-nya sendiri. Karena proyeknya Spark, akibatnya bukan
// tagihan melainkan kuota gratismu habis dipakai orang.
//
// Dan ada tenggat keras: **2 November 2026** App Check ditegakkan otomatis
// untuk AI Logic dan tidak bisa dimatikan lagi. Lewat tanggal itu, tanpa App
// Check, keempat fitur AI di app ini berhenti bekerja.
//
// ── Kenapa DEBUG TOKEN, bukan App Attest ──────────────────────────────────
// Ini keputusan sadar, bukan jalan pintas karena tidak tahu.
//
// Token App Check terikat ke satu App ID. `@firebase/ai` mengirim
// `X-Firebase-Appid` berisi appId **Web** (`1:…:web:…`) bersama tokennya, jadi
// token yang dicetak SDK native untuk appId **iOS** akan ditolak. Itu membuat
// jalur "pakai @react-native-firebase/app-check lalu suapkan ke CustomProvider"
// mustahil bekerja, walau kelihatannya masuk akal.
//
// Sisa jalur untuk aplikasi Web ada dua, dan cuma satu yang hidup di React
// Native:
//   • reCAPTCHA (v3 / Enterprise) → butuh `document`, tidak ada di RN. Mati.
//   • Debug token → jalur exchange-nya tidak menyentuh `document` sama sekali
//     (sudah diperiksa di sumber @firebase/app-check 12.19.0), dan tokennya
//     dicetak untuk aplikasi Web, jadi cocok dengan header yang dikirim.
//
// Jujur soal batasnya: token ini RAHASIA STATIS yang ikut ter-bundle ke dalam
// IPA, jadi orang yang membongkar IPA bisa memakainya. Tapi dibanding keadaan
// sebelum ini (tanpa pagar sama sekali, cukup membaca repo publik), palangnya
// naik jauh. Ini pengaman SEMENTARA yang disengaja: rencananya diganti App
// Attest sungguhan lewat @react-native-firebase/ai sebelum 2 November 2026,
// dan waktu itu seluruh berkas ini dibuang.
//
// ── Cara memasangnya (sekali, di Console) ─────────────────────────────────
//   1. Firebase Console › Build › App Check › Apps › pilih aplikasi WEB-nya.
//   2. Menu ⋮ › "Manage debug tokens" › Add debug token › beri nama
//      (mis. "iPhone Vix") › salin nilainya.
//   3. Tempel ke `.env` sebagai EXPO_PUBLIC_APP_CHECK_DEBUG_TOKEN.
//   4. JANGAN nyalakan enforcement sebelum app yang memuat token ini sudah
//      benar-benar terpasang di HP dan AI-nya terbukti jalan. Menyalakannya
//      lebih dulu akan mematikan AI seketika.

/** Nama global yang dibaca @firebase/app-check untuk menyalakan mode debug. */
const KUNCI_GLOBAL = 'FIREBASE_APPCHECK_DEBUG_TOKEN';

/**
 * Provider yang sengaja TIDAK bisa mencetak token.
 *
 * `initializeAppCheck` selalu memanggil `provider.initialize(app)` walau
 * sedang mode debug, jadi providernya harus yang tidak menyentuh apa pun.
 * `ReCaptchaV3Provider` akan membuat elemen `<div>` dan memuat script Google,
 * dan itu langsung meledak di React Native karena tidak ada `document`.
 * `CustomProvider` hanya menyimpan `app`, jadi aman.
 *
 * `getToken`-nya tidak pernah dipanggil selama mode debug hidup. Kalau suatu
 * saat ia TERPANGGIL, artinya tokennya tidak terbaca dan app sedang berjalan
 * tanpa perlindungan. Lebih baik berisik daripada diam: melempar galat
 * membuatnya ketahuan sekarang, bukan pada 2 November saat AI mendadak mati.
 */
function providerInert(): CustomProvider {
  return new CustomProvider({
    getToken: () =>
      Promise.reject(
        new Error(
          'App Check: token debug tidak terbaca, app berjalan tanpa perlindungan.',
        ),
      ),
  });
}

/**
 * Nyalakan App Check kalau tokennya ada di .env.
 *
 * Tanpa token, fungsi ini DIAM SAJA dan app berjalan seperti sebelumnya. Itu
 * disengaja: orang yang meng-clone repo ini (atau kamu sendiri sebelum sempat
 * mengisi .env) tidak boleh mendapat app yang gagal jalan. Sampai 2 November
 * 2026 pun app tanpa App Check masih bisa memakai AI seperti biasa.
 *
 * Mengembalikan true kalau App Check benar-benar dinyalakan, supaya pemanggil
 * (dan suite) bisa memastikannya.
 */
export function setupAppCheck(app: FirebaseApp): boolean {
  const token = process.env.EXPO_PUBLIC_APP_CHECK_DEBUG_TOKEN;
  if (!token) return false;

  // SDK membaca token ini dari objek global, bukan dari argumen — jadi ia
  // WAJIB sudah terpasang sebelum initializeAppCheck dipanggil.
  // `getGlobal()` milik @firebase/util jatuh ke `global`, yang ada di Hermes.
  (globalThis as Record<string, unknown>)[KUNCI_GLOBAL] = token;

  try {
    initializeAppCheck(app, {
      provider: providerInert(),
      // Token debug berumur pendek; biarkan SDK memperbaruinya sendiri supaya
      // sesi panjang (app dibiarkan terbuka seharian) tidak mendadak ditolak.
      isTokenAutoRefreshEnabled: true,
    });
    return true;
  } catch {
    // Sudah pernah dinyalakan (hot reload) — tidak apa-apa, biarkan yang lama.
    return true;
  }
}
