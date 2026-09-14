# AI di vix: gratis dulu, gagal-aman terhadap biaya

Dua fitur AI saat ini, keduanya lewat satu pintu `lib/gemini.ts`:

- **✨ Rapihkan dengan AI** di CORE › Monthly › Ubah Notulen (`lib/notulenAi.ts`).
- **✨ AI Reflection** di Habits › 📓 Daily Reflection Journal
  (`lib/reflectionAi.ts`, panel `components/habits/ReflectionAiPanel.tsx`):
  merapikan tulisan refleksi dan menambahkan satu-dua kalimat renungan yang
  tentatif, tanpa mengubah makna atau mengarang kejadian. Sekali sehari untuk
  tombol utamanya, Try Again sampai total 3 kali; hasilnya disimpan per hari di
  perangkat sehingga membuka sheet lagi tidak memanggil AI lagi.

Dokumen ini menjelaskan kenapa keduanya gratis, apa yang bisa menagih, dan
cara memastikannya tetap gratis.

## Prinsip

| Yang dipakai | Yang sengaja TIDAK dipakai |
|---|---|
| Firebase AI Logic, backend **Gemini Developer API** | Vertex AI / Agent Platform (wajib Blaze, selalu berbayar) |
| Paket Firebase **Spark** (tanpa kartu) | Paket Blaze (pay-as-you-go) |
| Kuota gratis Gemini (lewat = ditolak 429) | Cloud Functions / Cloud Run (wajib Blaze) |
| Config Firebase yang memang publik | Kunci API Gemini / Anthropic di kode atau repo |

Aturan emasnya satu: **proyek `vix-super-app` tetap di paket Spark.** Di Spark
tidak ada kartu, jadi tidak ada yang bisa ditagih. Begitu proyek naik ke Blaze,
Google menyatakan *seluruh* pemakaian Gemini Developer API menjadi berbayar
(kuota gratisnya hilang), dan Firestore/Auth yang lewat kuota ikut ditagih.
Sumber: firebase.google.com/docs/ai-logic/pricing.

Kalau kamu terlanjur click **Confirm purchase** untuk Blaze: Firebase console
› ⚙️ › *Usage and billing* › *Details & settings* › *Modify plan* › **Spark**.
Tahanan Rp400.000 di kartu lepas sendiri dalam beberapa hari.

## Setup sekali (di console, bukan di kode)

1. Firebase console › project `vix-super-app` › **Build › AI Logic** ›
   **Get started** › pilih **Gemini Developer API** (BUKAN Vertex AI) › selesaikan.
   Firebase menyalakan API-nya dan membuat kunci Gemini **di dalam proyek**;
   app tidak pernah memegang kunci itu.
2. Pastikan halaman *Usage and billing* masih menunjukkan **Spark**.
3. Buka app › CORE › Monthly › ✏️ (atau + Buat Rapat Bulanan) › isi satu
   bagian › **✨ Rapihkan** di kanan atas, sebaris dengan judul layar (dulu
   "Rapihkan dengan AI" di dalam sheet). Sebelum langkah 1, tombolnya menjawab
   "Firebase AI Logic belum diaktifkan".

Tidak ada `.env`, secret, deploy, maupun build baru yang dibutuhkan; ini JS saja.

## Model

| Peran | Model | Kenapa |
|---|---|---|
| Utama | `gemini-3.8-flash` | model stabil terbaru di kuota gratis |
| Cadangan | `gemini-3.5-flash-lite` | kuotanya terpisah & lebih longgar; dipakai otomatis kalau yang utama 429/404 |

Keduanya tercantum sebagai *free tier* di firebase.google.com/docs/ai-logic/models
(Sep 2026). Kalau Google mengganti nama model, cukup ubah dua konstanta di
`lib/gemini.ts` (dipakai kedua fitur). Jawaban dipaksa JSON lima kunci (structured output), suhu
0,3, maksimal 4096 token keluaran.

## Pagar di app (`lib/aiGuard.ts`)

Semua panggilan model lewat `guardedAiCall`:

1. Masukan yang persis sama tidak dikirim dua kali (jawaban terakhir diingat).
2. Permintaan yang sama selagi berjalan dipakai bersama, bukan dikirim lagi.
3. Jeda minimal 5 detik antar panggilan.
4. Sesudah server menjawab **429** (kuota penuh), semua panggilan dikunci 60
   detik dan tombolnya menjelaskan "tidak ada biaya, coba lagi nanti".
5. Maksimal **30 permintaan per hari per perangkat**, jauh di bawah kuota
   gratis harian Gemini.

Di sheet notulen sendiri tombolnya cuma bisa di-click **sekali** per sheet; di
jurnal harian **sekali sehari** (+2 Try Again), dan hasilnya diingat per hari.

## Yang bisa menagih, dan cara menghindarinya

| Sumber tagihan | Terjadi kalau | Status di vix |
|---|---|---|
| Gemini Developer API (paid tier) | proyek di Blaze | dihindari: tetap Spark |
| Vertex AI / Agent Platform | backend `VertexAIBackend` dipakai | tidak dipakai (`GoogleAIBackend`) |
| Cloud Functions / Cloud Run / Cloud Build / Artifact Registry | ada function yang di-deploy | dihapus 14 Sep 2026 (`functions/`, `firebase.json`, `.firebaserc`) |
| Anthropic (Claude) | kunci API + saldo prabayar | dihapus bersama function-nya |
| Firestore / Auth lewat kuota | proyek di Blaze | di Spark cuma ditolak, tidak ditagih |
| EAS Build / GitHub Actions | bukan Firebase; lihat BUILD-GRATIS.md | gratis di paket Free / repo publik |

## Cara memastikan tetap di kuota gratis

- **Paket**: Firebase console › *Usage and billing* harus **Spark**. Ini
  pemeriksaan terpenting; selama Spark, tagihan mustahil.
- **Pemakaian AI**: Firebase console › AI Logic › *Usage*, atau Google AI
  Studio › *Rate limits* (aistudio.google.com/rate-limit) untuk melihat batas
  per model & pemakaian hari ini.
- **Kalau mentok**: app menampilkan "Kuota gratis Gemini sedang penuh". Tidak
  ada yang perlu dilakukan; kuota per menit pulih dalam semenit, kuota harian
  pulih tengah malam waktu Pasifik.

## Catatan keamanan

Repo ini publik dan config Firebase memang bisa dibaca siapa saja; itu normal
untuk Firebase. Tanpa App Check (belum tersedia untuk Firebase JS SDK di
React Native), orang yang mengambil config itu paling jauh cuma bisa ikut
**menghabiskan kuota gratis** proyek ini, bukan uang. Firestore-nya tetap
dijaga `firestore.rules` (hanya pemilik). Kalau suatu saat kuota sering habis
tanpa kamu pakai, itu tandanya; ganti kunci Gemini dari console AI Logic.

**Tenggat App Check: 2 November 2026.** Console AI Logic memberi peringatan
bahwa sejak tanggal itu *enforcement* App Check WAJIB untuk Firebase AI Logic;
tanpa token App Check, permintaan Gemini akan ditolak (fitur ✨ berhenti,
tidak ada biaya). Provider web resminya reCAPTCHA Enterprise, yang butuh
browser, jadi untuk Firebase JS SDK di React Native harus dicari jalan lain
sebelum tanggal itu (debug token yang didaftarkan di console, atau custom
provider). Sampai itu beres: **jangan** menyalakan enforcement App Check di
console, karena app akan langsung ditolak.
