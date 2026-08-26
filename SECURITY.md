# Keamanan vix-super-app

Repo ini **publik** di GitHub. Catatan ini isinya: apa yang sudah aman, apa
yang masih perlu kamu klik sendiri di Console, dan kenapa.

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

## Yang masih perlu kamu klik sendiri

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

## Opsional: Firebase App Check

App Check membuat Firestore **menolak permintaan yang bukan berasal dari
aplikasi aslimu** (diverifikasi lewat Apple App Attest). Ini lapisan terkuat
yang tersisa: walaupun ada yang punya email & password-mu, permintaan dari
skrip/Postman tetap ditolak.

⚠️ **Butuh modul native → wajib `eas build` baru, tidak cukup `eas update`.**
Bilang saja kalau mau dipasang.

---

## Kalau suatu saat rahasia terlanjur ter-commit

1. **Anggap kunci itu sudah bocor** — orang lain mungkin sudah menyalinnya.
   Menghapus commit-nya saja tidak cukup.
2. **Ganti/cabut kuncinya dulu** di Console.
3. Baru bersihkan riwayatnya (`git filter-repo`), lalu `push --force`.

Urutannya penting: cabut dulu, bersihkan belakangan.
