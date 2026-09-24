# Restruktur "Today OS" (versi 2.0) — SELESAI 22-23 Sep 2026

Prinsip: "The app should tell Vix what matters today, not show Vix everything
he has." Urutan perhatian: JESUS → CALLING/CORE → WORK/NDC → LIFE.

Status: fase 1–9 selesai & terverifikasi (tsc TSC_OK, lint 0, 166/172 suite —
6 merah lama yang sama, pemindai export/gaya/berkas mati bersih, expo-doctor
21/21).
Versi dinaikkan ke 2.0.0; butuh BUILD EAS baru (native: expo-notifications +
warna splash/icon berubah), bukan cuma `eas update`.

---------------------------------------------------------------------------
## 1. Navigasi (terpasang)

  🏠 Today · ✝️ Walk · 👥 CORE · 💼 Work · ☰ Life   (badge hanya CORE & Work)

- Today   = app/(tabs)/index.tsx  (rute "/")
- Walk    = app/(tabs)/walk.tsx     (rute "/walk")
- CORE    = app/(tabs)/core.tsx     (rute "/core")
- Work    = app/(tabs)/work.tsx     (rute "/work") + sub-tab BARU "Focus"
- Life    = app/(tabs)/life.tsx     (rute "/life", BARU): cari + grid
- Sub-tab ketiga layar tab jadi PIL di bawah pita (BottomTabs placement="top").
- Yang keluar dari tab bar: /reminders "Semua Pengingat", /habits, /profile,
  /system — semuanya dapat BackRow.
- components/raised-home-tab.tsx DIHAPUS (Today = tab pertama biasa).

## 2. Today Engine

- lib/today.ts — murni, tanpa AI, tanpa acak. `buildToday(input, now, todayId)`
  → { god, today (≤ TODAY_MAX = 7), upNext, later, reflection }.
- hooks/useTodayData.ts — 37 langganan (gabungan Home + Dashboard lama, dibagi
  lewat ref-count lib/liveDoc; tidak ada bacaan Firestore tambahan), useMemo,
  useReadyGate supaya baris muncul serentak.
- hooks/useFinanceStatus.ts — status Finance tanpa nominal (dipakai Today,
  kartu Semua Pengingat, & isi pengingat Finance di lib/notify.ts).
- Tingkat: today (tenggat hari ini/terlewat/komitmen dalam jendelanya) ·
  next (1–3 hari, ulang tahun ≤ 7 hari, topik minggu ini) · later (sisanya).
- Rank: 1 With God · 2 time-sensitive · 3 CORE · 4 Work · 5 Life · 6 jangka
  panjang. Pemangkasan ke 7 memakai rank, sisanya turun ke Up next.

## 3. Komponen baru

  components/today/GodHero.tsx · PrioritiesBlock.tsx · TodaySection.tsx (+
  TodayRow) · ReflectionBlock.tsx · FoldedList.tsx · todayLink.ts
  components/career/WorkFocusTab.tsx · components/common/BackRow.tsx
  lib/featureIndex.ts (indeks pencarian fitur, statis)

## 4. Gerbang pagi → LUNAK

- MorningJourneyGate (dulu MorningPrayerWatcher): undangan otomatis SEKALI
  per hari (AsyncStorage
  `gate:shown`), `router.push` (bukan replace), keluar sendiri hanya kalau
  journey sudah dijalani. Tidak ada lagi ALLOWED_PATHS / penarikan paksa.
- MorningJourney: tombol "Nanti dulu" (tanpa hukuman) + "Lewati untuk hari
  ini" (hanya sebelum 09.00). Sesudah 09.00 journey tetap bisa dijalani;
  aturan streak tidak diubah.

## 5. Rupa 2.0

- Palet lebih gelap: MAIN #176B5D · MAIN_DARK #0B3D36 · MAIN_LIGHT #C9E3DC ·
  ACCENT #E6D3B3 · ACCENT_DARK #6E5030 · BACKGROUND #F7F3EC · BORDER #E6DDCF ·
  TEXT_TITLE #0F1F1A. Tile Reminder dapat pastel sendiri (TASKS #A8DCCB).
- assets/style/card.ts: SHADOW_SOFT (kartu blok) & SHADOW_RAISED (tab bar,
  tombol melayang); kartu DAFTAR tetap garis rambut.
- VixText: tambah `display` (28) & `eyebrow` (11, uppercase, letterSpacing).
- app.json: splash & lencana notifikasi ikut warna baru.

## 6. Data & rute

- Firestore: TIDAK ada koleksi/skema baru, tidak ada hapus/migrasi. Mesin
  hanya membaca.
- Lokal: satu kunci AsyncStorage baru `gate:shown`.
- 23 Sep 2026: sebagian rute BERGANTI NAMA mengikuti nama fiturnya (lihat 7b).
  Semuanya tautan internal; typed routes diregenerasi tiap kali.

## 7. Verifikasi

- cek-today.js (BARU, 78 cek): fixture kosong · With God (invite/late/done) ·
  CORE · Work · task per kategori · terlewat · 14 pengingat → dipangkas 7 ·
  refleksi · data lama · pencarian fitur · bentuk layar & navigasi · rupa.
- ~40 suite lama diarahkan ke tempat barunya (bukan dilonggarkan).
- expo-doctor 21/21 sesudah `resolutions: expo-constants 57.0.19`.

## 7b. Lanjutan 23 Sep 2026

- 📳 `lib/notify.ts`: satu mesin pengingat lokal untuk SEMUA kelompok
  (journey 06.00 · bacaan 07.00/12.30/21.15 · CORE 08.30 · Work 09.30 ·
  Life 17.30 · Finance 07.30 & 20.30 · refleksi 21.30). Isinya dari
  TodayModel, dijadwalkan dari hooks/useTodayData; kelompok tanpa isi tidak
  dibunyikan; angka ikon app = jumlah baris hari ini. Sakelar: layar
  `app/notifications.tsx` (master + 7 kelompok). lib/financeNotify.ts dilebur
  ke sini, sakelarnya tidak lagi berdiri sendiri di Finance.
- 🧹 /rapihin: token `BLOCK_CARD` (assets/style/card.ts) & `CONTENT_COLUMN`
  (assets/style/layout.ts); prop `color` Greeting yang sudah mati dibuang.
- 🏷️ Nama berkas = nama fitur: (tabs)/walk.tsx · (tabs)/work.tsx ·
  app/reminders.tsx · app/system.tsx · app/morning-journey.tsx · app/saku.tsx
  (+ app/saku/[key].tsx) · lib/saku.ts · lib/featureGrid.ts ·
  components/spiritual/MorningJourneyGate.tsx · components/reminders/.
  Rutenya ikut berganti (internal, tidak ada tautan luar).
- Suite baru: cek-notify.js. expo-doctor 21/21.

## 7c. Tiga permintaan 23 Sep 2026 (sore)

- 🎨 `lib/aiStyle.ts`: SATU gaya bahasa + aturan emoji untuk semua prompt
  Gemini. Refleksi jadi catatan pendek (≤ 45 kata, 3 emoji, bentuk tetap:
  kalimat inti, baris kosong, 2-3 baris) dengan dua contoh di dalam prompt;
  Coach 1 emoji di headline; notulen & Wheel tetap bersih (dicetak jadi PDF).
  Penjaganya `rapikanEmoji` / `tanpaEmoji` di finalisasi, bukan prompt.
  Suite: cek-gaya-ai.js.
- 📌 CORE › Monthly: kepala kartu (judul + tanggal + tombol ✏️ 📤) jadi anak
  langsung ScrollView & DIPATOK (`stickyHeaderIndices`) selama notulennya
  dibentangkan; kepala kartu berikutnya yang mendorongnya keluar. Baris
  "📸 N foto dokumentasi" dibuang. Cek: cek-patok.js bagian Monthly.
- 🪙 News: sumber ke-7 "Crypto" (CoinDesk · Cointelegraph · 2 pencarian
  Google News) + baris harga Bitcoin hari ini di atas daftarnya
  (`components/news/CryptoPulse.tsx`, memakai `loadBtc` yang sama dengan
  Investment, jadi tanpa permintaan baru).
- 📳 Pengingat ala Duolingo: `lib/notifyCopy.ts` (kalimat berganti tiap hari,
  dipilih dari tanggalnya), `lib/notifyTiming.ts` (jam ikut kebiasaan: median
  jam kamu menyelesaikannya, dikurangi 30 menit, dipatok di jendela tiap
  kelompok, semuanya di AsyncStorage), penyelamat streak 20.45, dan kelompok
  🏆 pencapaian jam 19.00 yang angkanya DITITIPKAN layar Reward
  (`saveRewardSnapshot`) supaya Today tidak menambah langganan.
  Suite: cek-notify-duo.js.
- 🌊 Layar Masuk 2.0: sapaan jam besar (`greetingText`, sama dengan seluruh
  app) + kartu mengambang + sakelar pil Masuk/Daftar yang bergeser
  (`components/auth/AuthToggle.tsx`) + ombak MAIN tiga lapis di kaki layar
  (`components/auth/WelcomeWaves.tsx`, Reanimated di utas UI, berulang mulus
  karena digambar 2× lebar layar dengan periode 1× lebar layar). Logika
  signIn/signUp TIDAK disentuh. Suite: cek-masuk.js.

## 7d. Enam permintaan 23 Sep 2026 (sore)

- 🎬 Animasi vix dipakai: `components/common/VixSplash.tsx` (layar boot) &
  `LoadingCenter` (dipotong bulat). GIF diputar `<Image>` bawaan, tanpa pustaka
  animasi; app.json splash ikut #0B3D36 supaya tidak ada kilas.
- 🏆 Achievement/Awards → **Reward** di SELURUH project (berkas, rute, kode,
  kalimat). Jalur Firestore tidak disentuh. Kartu saldo Self-Reward jadi
  pintunya sendiri (garis tepi + chevron) menuju mutasi Saku.
- 💍 Fitur **Married dihapus** total → grid Home tinggal 19 fitur; warna
  MARRIED & glif ring ikut dibuang.
- 🔔 Badge sub-tab tidak lagi terpotong pita header (topBarContent paddingTop
  2 → 10); tombol pojok Work jadi 🔔 (lambang yang sama dengan Reminder 🔔).
- ⚖️ Tombol Berhasil & Gagal di catatan puasa seukuran (CheckCircle 42).
- ✔️ Lambang judul Habits: 📋 → ✔️, seragam sampai indeks pencarian.
- Suite: cek-reward-rupa.js; ~30 suite lama diarahkan ke nama baru.

## 7e. Bahasa judul 23 Sep 2026 (malam)

- "Semua Pengingat" jadi **All Reminder 📊**; judulnya mengalah (flexShrink 1 +
  adjustsFontSizeToFit) dan tanggalnya tidak lagi terpotong.
- **Semua judul layar & sheet berbahasa Inggris** (70 judul), ISINYA tetap
  bahasa Indonesia. Judul layar tetap berlambang di BELAKANG ("Work 💼"),
  judul sheet/bagian berlambang di DEPAN ("📝 Donor Note").
- Pertanyaan konfirmasi ("Hapus janji ini?") SENGAJA tetap Indonesia: itu
  kalimat yang berbicara ke pemakainya, bukan judul.
- Sub-tab memang sudah Inggris semua (54 label) sejak awal.
- **Label kolom & judul bagian**: Huruf Besar Tiap Kata + lambang di depan
  (123 label). Kelonggaran yang disengaja: kata sambung di tengah (di, ke,
  yang, per), keterangan dalam kurung, dan satuan (kWh) tetap huruf kecil.
- Suite: cek-judul-inggris.js; ~50 suite lama diarahkan ke judul barunya.

- 💳 **PayApps dihapus**: lib/payapps.ts + tombol lompat ke Bank JAGO / GoPay /
  Bibit / dst di Finance › Transactions & layar Saku. Tidak dipakai pemiliknya;
  lib/linking.ts (openExternalUrl) tetap dipakai WhatsApp, ChatGPT, NDC, dll.

## 7f. Tiga permintaan 23 Sep 2026 (malam)

- 🟩 Tab utama di kaki app: tab AKTIF dapat PIL MAIN_LIGHT di belakang
  ikonnya (components/bounce-tab-icon.tsx), bahasa yang sama dengan pil
  sub-tab. Posisinya mutlak, jadi tinggi tab bar tidak bergeser.
- 🔀 Delapan tile grid Life bertukar: Finance→Learning→Fitness→Health→
  Reminder→Finance (putaran lima), Car↔Fun, Residence↔Wheel, Device↔Friends.
  Yang diubah cuma nomor -nya.
- 📝 Notulen AI mengikuti BENTUK notulen pemiliknya: "• N - ⛪Judul" lalu
  🗓️ tanggal · 🕙 jam · 📍 tempat di barisnya sendiri, rincian "- ".
  Lambang kini BAGIAN dari bentuknya, jadi penyaring tanpaEmoji() dilepas dari
  finalisasi notulen (Wheel tetap tanpa lambang). maxOutputTokens 4096 → 8192.
- Suite: cek-pil-grid-notulen.js.

## 7g. Empat permintaan 23 Sep 2026 (malam, lanjutan)

- 📊 Tabel Rekap Visitasi: kolom CL minWidth 28 → 48, kolom label 96 → 46,
  gap 6 antar kolom. Melebihi layar = digeser mendatar (sudah disiapkan).
- 📆 Kalender CORE: kepala kolom & angka tanggal Sabtu/Minggu berhuruf merah
  (Color.DANGER). Hari ini tetap menang (lingkaran pekat, huruf putih).
- ⚙️ Kepala System pindah ke ScreenHeader; dua pilnya (📳 Notif & 📱 Version)
  duduk di slot `right` pita, jadi tidak lagi terpotong tepi kanan.
- 🎨 Tiap layar berpita warna TILE-nya: featureTheme kini mencari di
  `ALL_FEATURES` (grid Home + tile tambahan Life), dan Habits/Profile/System
  memakai ScreenHeader seperti layar fitur lain. Yang tersisa berwarna merek
  cuma layar Masuk.
- Warna Reward #D9A441 → **#F0C36B** (madu emas, lebih terang; ΔE 16 dari
  Fitness, 20 dari Games, kontras teks 5,3).
- Suite: cek-pita-grid.js.

## 8. Yang sengaja TIDAK dikerjakan

- Native tabs (Liquid Glass) — masih `unstable-native-tabs` di SDK 57.
- SDK 58 / RN 0.87 / Gesture Handler 3 — masih preview.
- TypeScript 7 — ditunda sampai eslint-config-expo mendukungnya.
- expo-background-task (refresh notifikasi di latar): ditolak — di iOS ia
  oportunistik, dan membaca Firestore dari tugas latar menambah rumit tanpa
  jaminan. Penjadwalnya tetap app yang dibuka, dan itu disebut jujur di layar.
- expo-blur / native tabs (tab bar tembus pandang): menggeser tata letak isi
  layar; ditunda supaya rupa 2.0 tidak berubah dua kali.
