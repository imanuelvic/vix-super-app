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

- 🔔 `lib/notify.ts`: satu mesin pengingat lokal untuk SEMUA kelompok
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
- 🔔 Pengingat ala Duolingo: `lib/notifyCopy.ts` (kalimat berganti tiap hari,
  dipilih dari tanggalnya), `lib/notifyTiming.ts` (jam ikut kebiasaan: median
  jam kamu menyelesaikannya, dikurangi 30 menit, dipatok di jendela tiap
  kelompok, semuanya di AsyncStorage), penyelamat streak 20.45, dan kelompok
  🏆 pencapaian jam 19.00 yang angkanya DITITIPKAN layar Achievement
  (`saveAchievementSnapshot`) supaya Today tidak menambah langganan.
  Suite: cek-notify-duo.js.

## 8. Yang sengaja TIDAK dikerjakan

- Native tabs (Liquid Glass) — masih `unstable-native-tabs` di SDK 57.
- SDK 58 / RN 0.87 / Gesture Handler 3 — masih preview.
- TypeScript 7 — ditunda sampai eslint-config-expo mendukungnya.
- expo-background-task (refresh notifikasi di latar): ditolak — di iOS ia
  oportunistik, dan membaca Firestore dari tugas latar menambah rumit tanpa
  jaminan. Penjadwalnya tetap app yang dibuka, dan itu disebut jujur di layar.
- expo-blur / native tabs (tab bar tembus pandang): menggeser tata letak isi
  layar; ditunda supaya rupa 2.0 tidak berubah dua kali.
