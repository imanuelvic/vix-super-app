# Keamanan vix-super-app

Repo ini **publik** di GitHub. Catatan ini isinya: apa yang sudah aman, apa
yang masih perlu kamu click sendiri di Console, dan kenapa.

---

## Yang sudah aman (sudah diperiksa)

| Hal | Keadaan |
|---|---|
| Rahasia ter-commit | **Tidak ada.** Seluruh riwayat commit disisir: tak pernah ada `.env`, `google-services.json`, `GoogleService-Info.plist`, service account, atau API key yang ter-commit. |
| Konfigurasi Firebase | Diambil dari variabel lingkungan (`EXPO_PUBLIC_*`), bukan ditulis di kode. |
| Jalur data | SEMUA akses Firestore di app berawalan `users/…`. Tidak ada koleksi liar di luar sana. |
| Isolasi antar-akun | `request.auth.uid == userId` di rules — tiap akun hanya bisa menyentuh cabangnya sendiri. |
| Firebase Storage | Tidak dipakai sama sekali (foto disimpan sebagai base64 di Firestore). Rules-nya tetap dipasang sebagai penutup. |
| Hapus data | Selalu permanen (hard delete), tidak ada data "terhapus" yang diam-diam masih tersimpan. |
| Repo di-clone orang | Tanpa `.env`, aplikasi **tidak menghubungi Firebase mana pun**: Auth sengaja tidak diinisialisasi sama sekali dan layar Login menampilkan "belum dikonfigurasi". Tidak ada jalur diam-diam ke proyek pemilik. |

### Firebase Web API Key itu BUKAN rahasia

Kunci di `.env` (`EXPO_PUBLIC_FIREBASE_API_KEY`) ikut ter-bundle ke dalam
aplikasi, jadi siapa pun yang membongkar file `.ipa` bisa membacanya — dan itu
memang **normal**. Fungsinya cuma menunjuk proyek mana yang dituju, bukan
memberi akses. Yang menentukan siapa boleh baca/tulis adalah Security Rules.

Yang **BENAR-BENAR rahasia** dan tidak boleh pernah masuk repo maupun aplikasi:
service account Admin SDK (`*-firebase-adminsdk-*.json`). Itu bisa melewati
SEMUA rules. Sudah masuk `.gitignore`.

### Satu jalur nyantol yang perlu diketahui: EAS Update

`app.json` memuat `owner`, `extra.eas.projectId`, dan `updates.url` — itu
identitas proyek **EAS milik pemilik**, dan memang harus ada supaya `eas build`
/ `eas update` jalan.

Akibatnya: orang yang meng-clone repo ini lalu mem-build **secara lokal** tanpa
mengganti nilai itu, aplikasinya masih menunjuk endpoint pembaruan pemilik.
Yang bisa dia dapat hanyalah bundel JavaScript yang memang sudah publik di repo
ini — datanya tetap tak tersentuh karena dijaga Security Rules. Tapi ia ikut
memakai kuota pembaruan pemilik.

Karena itu `README.md` mewajibkan langkah `eas init` bagi yang meng-clone.
Kalau suatu saat mau menutup jalur ini rapat-rapat, pindahkan ketiga nilai itu
ke `app.config.ts` yang membacanya dari variabel lingkungan.

---

## Yang masih perlu kamu click sendiri

Urut dari yang paling penting. Semuanya gratis dan tidak butuh build baru.

### 1. Matikan pendaftaran akun baru — Firebase Console

**Authentication → Settings → User actions → hilangkan centang "Enable create
(sign-up)"**

Akunmu sudah ada, jadi kamu tidak butuh pendaftaran lagi selamanya. Setelah ini
mati, **tidak ada orang yang bisa membuat akun** di proyekmu — jalur "bikin akun
lalu coba-coba" tertutup total. Ini langkah tunggal dengan dampak terbesar.

### 2. Nyalakan perlindungan penghitungan email — Firebase Console

**Authentication → Settings → Email enumeration protection → aktifkan**

Emailmu sekarang terbaca publik di repo. Ini membuat Firebase tidak lagi
menjawab beda antara "email tidak terdaftar" dan "password salah", jadi orang
tak bisa memastikan email mana yang aktif.

### 3. Password yang kuat & unik

Emailmu publik, jadi satu-satunya yang tersisa adalah passwordnya. Pakai
password panjang dan **hanya dipakai di sini** — jangan yang sama dengan akun
lain. Simpan di password manager.

### 4. Batasi API key ke aplikasimu — Google Cloud Console

**APIs & Services → Credentials → pilih API key-nya → Application restrictions
→ iOS apps → tambahkan bundle id `com.imanuelvic.vixsuperapp`**

Supaya kunci yang dibongkar dari aplikasi tidak bisa dipakai dari skrip di
komputer orang lain.

### 5. 2FA GitHub + push protection

- **Settings → Password and authentication → Two-factor authentication**
- **Repo → Settings → Code security → Secret scanning & Push protection**
  (gratis untuk repo publik)

2FA menutup jalur "orang mengubah kodemu". Push protection menolak commit yang
mengandung kunci rahasia — jaring pengaman kalau suatu saat `.env` nyaris
ikut ter-commit.

### 6. 2FA akun Expo — **ini yang melindungi HP-mu**

**expo.dev → Account settings → Two-factor authentication**

Kalau akun Expo-mu diambil orang, dia bisa mengirim `eas update` berisi kode
JavaScript apa pun, dan **HP-mu akan memasangnya sendiri** karena memang
terdaftar di channel itu. Ini jalur paling berbahaya untuk "penjahat mengubah
kode", jauh lebih berbahaya daripada repo publiknya sendiri.

### 7. Alarm anggaran — Google Cloud Console

**Billing → Budgets & alerts → buat budget kecil (mis. Rp 50.000) dengan email
notifikasi**

Bukan mencegah serangan, tapi membuatmu tahu dalam hitungan jam kalau ada yang
tidak beres — bukan setelah tagihannya membengkak.

---

## Firebase App Check — TERPASANG (sementara), tenggat 2 November 2026

### Kenapa ini yang paling mendesak

`firestore.rules` menjaga Firestore dengan benar, tapi **Firebase AI Logic
adalah layanan terpisah yang tidak disentuh Security Rules sama sekali.**
Config Firebase yang terbaca publik di repo ini sudah cukup untuk memanggil
proxy AI Logic-mu langsung. Artinya semua pagar di `lib/aiGuard.ts` (memo,
dedupe, cooldown, kunci 429, batas 30/hari) berjalan di sisi klien dan bisa
dilewati. Karena proyeknya Spark, akibatnya **bukan tagihan** melainkan kuota
Gemini gratismu habis dipakai orang.

Dan ada tenggat keras dari Google: **mulai 2 November 2026 App Check
ditegakkan otomatis untuk AI Logic dan tidak bisa dimatikan lagi.** Lewat
tanggal itu, tanpa App Check, keempat fitur AI berhenti bekerja.

### Yang sudah terpasang: debug token (`lib/appCheck.ts`)

Ini keputusan sadar, bukan jalan pintas. Token App Check terikat ke satu App
ID, dan `@firebase/ai` mengirim `X-Firebase-Appid` berisi appId **Web**
(`1:…:web:…`). Jadi:

| Jalur | Bisa? |
|---|---|
| reCAPTCHA v3 / Enterprise (jalur resmi aplikasi Web) | ❌ butuh `document`, tidak ada di React Native |
| App Attest lewat `@react-native-firebase/app-check` | ❌ tokennya dicetak untuk appId **iOS**, ditolak karena headernya bilang **Web** |
| **Debug token aplikasi Web** | ✅ jalur exchange-nya tidak menyentuh `document`, dan appId-nya cocok |

**Cara memasangnya (sekali):** Firebase Console › Build › App Check › Apps ›
pilih aplikasi **Web** › menu ⋮ › Manage debug tokens › Add debug token ›
salin nilainya ke `.env` sebagai `EXPO_PUBLIC_APP_CHECK_DEBUG_TOKEN`.

⚠️ **Jangan nyalakan enforcement sebelum app yang memuat token ini sudah
terpasang di HP dan AI-nya terbukti jalan.** Menyalakannya lebih dulu
mematikan AI seketika.

**Batasnya, jujur:** token ini rahasia statis yang ikut ter-bundle ke dalam
IPA, jadi orang yang membongkar IPA bisa memakainya. Dibanding keadaan
sebelumnya (tanpa pagar sama sekali, cukup membaca repo publik) palangnya naik
jauh, tapi ini **bukan** perlindungan sekelas attestation.

### Rencana sebelum 2 November 2026: App Attest sungguhan

Pindahkan pemanggilan AI dari `firebase/ai` (JS SDK, aplikasi Web) ke
**`@react-native-firebase/ai` + `@react-native-firebase/app-check`** (aplikasi
iOS, App Attest asli, tanpa rahasia di bundle). Auth & Firestore tetap di JS
SDK. Butuh `GoogleService-Info.plist`, kapabilitas App Attest di Apple
Developer, dan `eas build` baru. Setelah itu `lib/appCheck.ts` dibuang.

Yang menahan: AI-nya terisolasi rapi di `lib/gemini.ts`, jadi prompt, skema,
dan seluruh pagar `aiGuard` tidak perlu berubah.

---

## Kalau suatu saat rahasia terlanjur ter-commit

1. **Anggap kunci itu sudah bocor** — orang lain mungkin sudah menyalinnya.
   Menghapus commit-nya saja tidak cukup.
2. **Ganti/cabut kuncinya dulu** di Console.
3. Baru bersihkan riwayatnya (`git filter-repo`), lalu `push --force`.

Urutannya penting: cabut dulu, bersihkan belakangan.
