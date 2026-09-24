# vix-super-app: ringkasan aplikasi dari kode

Catatan ini disusun dengan membaca seluruh kode proyek (sekitar 91.000 baris
TypeScript: 82 layar di `app/`, 168 komponen, 98 modul `lib/`, 30 hook), bukan
dari dokumen pemasaran. Tujuannya supaya pihak lain (termasuk AI lain) bisa
menilai aplikasi ini dengan gambaran yang benar tentang apa yang sebenarnya
dibangun, untuk siapa, dan dengan batasan apa.

## 1. Apa aplikasi ini

**vix-super-app** adalah *personal super app* iOS untuk **satu orang**:
pemiliknya sendiri. Ia menggantikan belasan spreadsheet pribadi (keuangan,
mobil, token listrik, timeline hidup, multiplikasi CORE, dll) dan beberapa
aplikasi terpisah dengan satu aplikasi yang datanya tersinkron lewat Firebase.

Pemiliknya adalah seorang software engineer yang juga **MCL (Mentor CORE
Leader)** di sebuah gereja: ia menggembalakan beberapa CORE Leader (pemimpin
kelompok sel). Karena itu tiga poros terbesar aplikasi ini adalah:

1. **Kehidupan rohani pribadi** (Spiritual, Morning Journey, doa, puasa).
2. **Pelayanan** (fitur CORE: visitasi, notulen, follow up, data CL, PDF).
3. **Manajemen diri sehari-hari** (finance, kesehatan, kebiasaan, karier,
   mobil, rumah, teman, keluarga).

Bahasa antarmuka Indonesia dengan istilah Inggris untuk nama fitur.
Target platform iOS (Apple HealthKit, share sheet iOS, haptic Taptic Engine).

## 2. Prinsip desain yang terlihat konsisten di kode

- **Satu pengguna, satu pemilik.** Firestore Security Rules mengunci semua
  data ke `users/{uid}` dan hanya untuk email pemilik. Tidak ada fitur sosial,
  tidak ada multi-akun.
- **Gratis selamanya sebagai syarat keras.** Proyek Firebase harus tetap di
  paket Spark. Tidak ada Cloud Functions, tidak ada Vertex AI, tidak ada Cloud
  Storage, tidak ada server. Semua "cron" dijalankan saat app dibuka.
- **Hemat baca/tulis Firestore.** Pola dominan: satu dokumen kecil berisi
  array (daftar CL, sesi futsal, ide konten), satu dokumen per hari
  (kebiasaan, bacaan Alkitab, prioritas), satu dokumen per bulan (budget).
  Lapisan `lib/liveDoc.ts` membagi satu listener untuk banyak layar
  (ref-count) dan menyimpan nilai terakhir ke AsyncStorage supaya layar tidak
  berkedip kosong.
- **Foto disimpan sebagai base64 di dalam dokumen Firestore** (dikompres dan
  dipotong kecil), bukan di Storage, demi biaya nol.
- **Hapus selalu permanen** (hard delete). Tidak ada soft delete/arsip
  tersembunyi.
- **Reminder yang menagih, bukan fitur yang dicari.** Home menampilkan badge
  angka per tile; Dashboard memuat semua kartu pengingat hari ini; aturannya
  "tiap badge merah harus punya kartunya di Dashboard".
- **Streak & reward ala Duolingo** sebagai motivasi: doa pagi, Revive,
  baca Alkitab (3 sesi), kebiasaan, air putih, langkah, gym, belajar.
- **Privasi berlapis di dalam app:** PIN untuk Finance dan untuk Wheel/Timeline
  milik CORE Leader; tombol sembunyikan nominal; kartu Finance di Home hanya
  status tanpa angka; notifikasi tanpa nominal.
- **AI hanya sebagai asisten kecil, dipanggil saat di-click, dengan pagar
  kuota** (lihat bagian 6).
- **Komentar kode dalam Bahasa Indonesia menjelaskan "kenapa"**, bukan hanya
  "apa"; banyak keputusan produk (fitur dihapus, fitur dipindah) dicatat
  langsung di kode beserta tanggal dan alasannya.

## 3. Arsitektur teknis singkat

| Hal | Isi |
|---|---|
| Framework | Expo SDK 57, React Native 0.86, React 19.2, New Architecture, React Compiler |
| Navigasi | expo-router (file-based, typed routes): 5 tab bawah + puluhan layar stack |
| Backend | Firebase JS SDK: Auth (email/password, satu akun) + Firestore. Tanpa Storage, tanpa Functions |
| Cache lokal | AsyncStorage (nilai terakhir dokumen, cache AI per hari, rekor game, memo harian) |
| Modul native | Apple HealthKit (langkah), expo-notifications (pengingat lokal), expo-text-extractor (OCR nota di HP), expo-clipboard, expo-print + expo-sharing (PDF), expo-image-picker/manipulator, react-native-svg |
| Sumber data luar | Yahoo Finance chart endpoint (emas, BTC, IHSG, kurs; tanpa API key), RSS publik berita, feed RSS kanal YouTube. Tidak ada API berbayar |
| AI | Gemini lewat Firebase AI Logic (Gemini Developer API, kuota gratis Spark); model utama `gemini-3.8-flash`, cadangan `gemini-3.5-flash-lite`; kunci API tidak pernah ada di app |
| Distribusi | EAS Build (preview/dev client) + EAS Update untuk perubahan JS; modul native yang belum ada di build dimuat lazy supaya JS baru tidak membuat build lama crash |
| Pengujian | `tsc --noEmit`, ESLint, dan 182 suite verifikasi di `cek/` (`npm run cek`) yang menjalankan modul `lib/` murni dengan data fixture dan memeriksa bentuk layar. Sampai 24 Sep 2026 suite ini tinggal di folder sementara di luar repo; sejak dipindahkan ke dalam, ia ikut ter-commit dan tidak bisa hilang bersama `%TEMP%` |

Semua jalur Firestore berawalan `users/{uid}/…`. Rules menolak apa pun di
luar itu.

## 4. Struktur navigasi

**Lima tab bawah:**

1. **Home 🏠**: launcher. Sapaan + streak doa pagi, kartu Doa Syafaat harian
   (pokok doa tetap per hari; Sabtu Gereja & Minggu Negara ditambah kliping
   judul berita RSS sepekan), kartu Baca Alkitab yang hanya muncul di jendela
   jamnya (pagi/siang/malam), kalimat penyegar/Reminder 🕊️ (bisa dijadikan
   gambar persegi untuk WhatsApp), tombol Daily Priority, dan **grid 20 fitur**
   dengan badge tagihan per tile. Badge baru digambar setelah semua sumbernya
   tiba supaya muncul serentak.
2. **Dashboard**: seluruh kartu pengingat hari ini (kebiasaan sesi, task,
   puasa, pokok doa bulanan, khotbah, follow up, doa rantai, pinjaman,
   learning, diskusi, olahraga, ulang tahun keluarga, fun, kuartal Wheel, car,
   residence, friends, finance status, badge lain yang belum punya kartu).
3. **Habits 📋**: kebiasaan harian tiga sesi (Pagi/Siang/Malam) dengan centang,
   lewati (✗), catatan per baris, 📓 Daily Reflection Journal dengan panel AI
   Reflection, target berat, donat progres.
4. **Profile 🪪**: identitas WNI (NIK, KK, NPWP, paspor, BPJS, alamat), foto,
   Data Tubuh 🧍 (tinggi/berat/lingkar perut, satu sumber untuk Fitness),
   Personality 🧠 (MBTI, Love Language, DISC, Enneagram, temperamen; diingatkan
   tes ulang setahun sekali), Ikigai 🎌 dan SWOT 📊 (tab kuadran bersama).
5. **System ⚙️**: laporan pemakaian fitur (berapa kali tiap tile dibuka per
   hari, anti double-count) dan pintu ke layar versi app + tombol update.

**Elemen global:** tombol air putih 💧 mengambang di semua layar (seperti
AssistiveTouch: click +1 gelas, click 2× −1), dan **Morning Journey** yang
mengunci app setiap pagi sampai jam 09.00 (lihat 5.2).

## 5. Fitur per fitur (20 tile di Home)

### 5.1 Reminder ✅ (`tasks`)
- **Daily**: to-do per kategori PERSONAL / WORK / MINISTRY / FUN / LEARNING,
  bisa di-drag ke kategori atau ke blok hari.
- **Priority**: daftar bertenggat P1/P2/P3 yang hidup berhari-hari (P1 ikut
  jadi badge Career & Reminder).
- **Daily Priority 💡**: tiga hal terpenting hari ini; satu dokumen per
  tanggal, jadi otomatis kosong lewat tengah malam tanpa tugas latar.

### 5.2 Spiritual ✝️
Sub-tab: Revive, Sermon, Bible Reading, Promise, Fasting. Ditambah layar
pendamping.
- **Morning Journey 🌅**: layar penuh sekali sehari (Arrive → Receive → Reflect
  → Respond → Worship → Pray → Close), tanpa centang dan tanpa persen; isian
  menumpang ke Revive hari itu dan jurnal refleksi Habits. Terlewat setelah
  09.00 = streak doa pagi hangus. Ada riwayat per hari.
- **Revive 📖**: renungan harian (judul, bacaan, ayat hafalan, ✨ rhema,
  refleksi, aplikasi, respons hati, doa pagi), streak, riwayat dengan pencarian
  dan pagination, 📌 pasang rhema/aplikasi jadi reminder Home, 🔗 sambungkan
  catatan ke acara CORE mendatang.
- **Sermon ⛪**: catatan khotbah ibadah Minggu, satu per Minggu, hanya bisa
  ditambah hari Minggu, terkunci mulai Selasa; kutipan khotbah ditonjolkan;
  reminder "renungkan khotbah" dan "kirim catatan" pada hari tertentu.
- **Bible Reading**: tiga sesi (05–10, 12–14, 21–24), pemilih 66 kitab,
  rekomendasi bacaan berikutnya per sesi (baca berurutan), versi terjemahan,
  empat streak dalam satu dokumen, riwayat 90 hari, dan **Bagikan Ayat** jadi
  Story Instagram 9:16 (SVG → PNG di HP).
- **Promise 🚩**: janji Tuhan yang dipegang; menyimpan tanggal ditulis,
  diperbarui, dan digenapi.
- **Fasting 🍽️**: periode puasa (pokok doa, peraturan, tanggal, jawaban) dan
  layar **Hari per Hari** dengan jawaban tegas ✓ berhasil / ✗ gagal per hari;
  reminder malam di Dashboard.
- **Gratitude 🙏**: arsip "3 hal yang aku syukuri" per hari (dokumen sendiri,
  dengan migrasi dari catatan kebiasaan lama).
- **Pause & Pray**: doa singkat → Story 9:16, tidak disimpan.
- **Reflection Feed**: jurnal refleksi → gambar Feed 4:5 bertanda arsip.
- **Doa Syafaat**: jadwal tetap di kode (Sen keluarga·kesehatan, Sel/Kam doa
  rantai CL, Rab ekonomi, Jum kesatuan, Sab gereja, Min negara) + kliping
  berita mingguan tanpa AI.

### 5.3 Health ❤️
- **Race 🏃**: catatan lomba lari (jarak, waktu, foto medali).
- **Steps 👣**: langkah hari ini dari Apple Health; akumulasi mingguan dan
  bulanan ala tantangan Strava; tier 20k/30k/40k/50k; target jarak mingguan
  sendiri; anjuran sehat WHO.
- **Check-up 🩺**: tekanan darah dan gula darah dengan nilai normal, tips,
  jadwal cek ulang, riwayat.
- Layar tambahan: riwayat sakit (Diseases), Donor Darah 🩸 (hitung mundur
  jeda 3 bulan, jadwal, syarat), Info kesehatan statis.
- Diet/kalori **sengaja dihapus** (tidak pernah benar-benar dijalani); yang
  menjaga tubuh: langkah, Fitness, berat di Check-up, air putih.

### 5.4 CORE 👥 (fitur pelayanan, paling besar)
Sub-tab: Visitation, Monthly, Follow Up, Leaders, Multiplication.
- **Visitation 📅**: jadwal MCL bertemu CORE tiap CL. 10 jenis pertemuan
  (Visitasi, Fellowship, One-on-One, Mentoring, Gathering, Charity,
  Thanksgiving, Christmas, CORE Gabungan, Fellowship Gabungan); acara besar
  diingatkan H-14/7/3/2/1, biasa H-3 dan hari-H; PDF notulen + panduan resmi
  acara dikirim ke CL lewat WhatsApp; Kalender CORE 📆 (satu bulan, titik per
  tanggal); **Rekap Visitasi 📊** per tahun (tabel jenis × CL, tanggal
  Thanksgiving tiap CORE, Σ) dan PDF rekap per CL dengan warna hati CORE-nya.
- **Monthly 🗒️**: notulen mentoring bulanan gereja dengan 5 agenda tetap,
  foto, tautan catatan Revive/khotbah, ✨ "Rapihkan dengan AI" (Gemini), PDF.
- **Follow Up 🎯**: tiap minggu 2 CL diundi untuk dibangun hubungannya (Senin
  pertanyaan doa, hari lain pertanyaan acak dari 8 aspek hidup / diskusi
  ringan / penggali kepribadian); pengingat ulang tahun CL & Main Team dengan
  ucapan siap kirim; **Pokok Doa Bulanan** tiap CL → Doa Rantai Selasa & Kamis;
  Template Chat 💬 (berduka, sakit, wisuda, dst) langsung ke WhatsApp.
- **Leaders 👤**: data tiap CL (nama, warna hati CORE, lahir, HP, gender,
  tanggal Thanksgiving CORE, pendidikan/pekerjaan, DISC/MBTI/Love Language,
  data tubuh + PDF lembut soal kesehatan), Main Team, arsip Ex-Leader dengan
  alasan; dari sini dibuka **Wheel of Life & Timeline milik CL** (dikunci PIN)
  yang PDF-nya bisa langsung dikirim ke CL tersebut.
- **Multiplication 🌱**: pemekaran CORE: timeline langkah (Training calon CL →
  CORE Perdana) dengan status, pembagian anggota beserta alasannya; Pedoman
  Calon CL & Tugas CL (statis) + PDF.
- **Rules & Suggestions 📜**: panduan resmi per jenis acara, satu dokumen per
  topik, parser yang sama untuk layar dan PDF.

### 5.5 Finance 💵 (dikunci PIN)
Sub-tab: Dashboard, Transactions, Budgeting. Ditambah Saku dan Pinjaman.
- **Transactions**: log Income / Saving / Investment / Expense dengan kategori
  (dari spreadsheet lama) dan sub-kategori buatan sendiri; ringkasan bulan;
  edit/hapus; **Quick check 👀**:
  jeda sadar sebelum expense disimpan bila sisa jadi minus, sisa < 15%, atau
  nominal jauh di atas jatah harian ([Tetap Tambahkan] [Batal] [Lihat Budget],
  tidak ditanya lagi untuk kategori yang sama di hari yang sama).
- **Budgeting**: alokasi per kategori/sub per bulan, salin dari bulan lalu,
  **Monthly Planning** (Income → Fixed → Variable → Savings → Emergency →
  Investment → Flexible, persentase dari income sendiri, jatah harian/mingguan)
  dan **Budget Lock** (unlock harus beralasan, dicatat).
- **Dashboard (Financial Awareness)**, urut dari keputusan berikutnya ke
  yang sudah terjadi: **Safe to Spend** hari ini / sisa minggu / sisa bulan
  (kategori berirama harian, dihitung dari tanggal aktual); **Weekly & Monthly
  Review**; **Vix Financial Coach 🤖** (insight lokal tanpa AI selalu ada;
  tombol tanya Gemini hanya saat di-click, jawaban DATA/INTERPRETASI/SARAN,
  non-judgmental, tanpa saran investasi, hanya menerima angka agregat, cache
  per hari, maksimal 6 panggilan/hari); **Fokus mingguan 🎯** (batas nominal
  dan jumlah kali per kategori, mis. Gojek ≤ 4× seminggu, progres otomatis
  dari transaksi); notifikasi lokal pagi 07.30 & malam 20.30 tanpa nominal;
  pola pengeluaran 3 bulan (jujur "data belum cukup"); budget health per
  kategori; transaksi terbaru; detail bulan (cashflow, budget vs realisasi,
  grafik harian, donat, kutipan harian).
- **Saku 👛**: dompet per tujuan dengan mutasi dan saldo yang di-update
  atomik (batch + increment).
- **Pinjaman 🤝**: dua arah (saya meminjam / orang meminjam), cicilan, jatuh
  tempo, reminder H-1.
- Di Home hanya status ("masih sesuai rencana", "Food mendekati batas"),
  tanpa angka.

### 5.6 Learning 🎓
Satu ilmu baru tiap minggu: **Target** (topik giliran + 4 langkah kecil,
rotasi otomatis, rangkuman Jumat), **Skills** (22 topik per bidang, tercentang
otomatis bila 4 langkah beres), **Discussion** (62 bahan obrolan; 3 per minggu
jadi pemantik langkah "Ceritakan"), arsip rangkuman, streak mingguan.

### 5.7 Fitness 💪
**Program** lean-atletis (3 hari beban, 2 lari, 2 jalan) sebagai saran yang
bisa diambil, bukan perintah; **Exercise** (pilih sesi hari ini, centang
gerakan, lewati ✗, hasil lari jam/menit/detik); **Progress** (streak sesi dengan
hari istirahat, rekap lari mingguan, data tubuh dari Profile); **Notes**
(tautan video/program).

### 5.8 Family 👨‍👩‍👧‍👦
Silsilah keluarga ala The Sims: anggota dengan foto kecil, tanggal lahir,
status meninggal; relasi hanya lewat `parentIds` (pasangan dan anak
diturunkan, satu sumber kebenaran). Ulang tahun keluarga jadi kartu Dashboard.

### 5.9 Invest 📈
Harga live dari Yahoo Finance tanpa API key: Crypto (BTC dalam Rupiah), Gold
(COMEX × kurs ÷ 31,1035 per gram; disebut jujur bukan harga Antam), Stocks
(IHSG), Forex (USD/IDR); grafik ~6 bulan, statistik, fallback error + coba lagi.

### 5.10 Career 💼
Empat "topi": **Fulltime** (roadmap prioritas & deadline), **Freelance**
(proyek: client, deadline, requirement, fee, rincian biaya, halaman detail
baca-saja, **invoice PDF** dengan letterhead perusahaan), **Affiliate** (ide
konten 💡 → 🎬 → ✅ + produk & link), **Business** (coming soon).

### 5.11 News 📰
Judul berita dari RSS publik (isi dibuka di browser penerbit), simpan 🔖;
tujuh kategori: Tech · Dev · Indo · Dunia · Bisnis · **Crypto** (CoinDesk,
Cointelegraph & pencarian "kenapa harganya bergerak", dengan baris harga
Bitcoin hari ini di atasnya) · Kristen;
**Population**: perkiraan populasi dunia berjalan tiap detik + catatan bulanan
manual dari worldometers (badge tiap tanggal 1).

### 5.12 Book 📚
Daftar buku statik per tema, checklist bab per buku (hanya centang yang
disimpan), buku "selesai" bila semua bab tercentang, filter/urut.

### 5.13 Car 🚗
**Log** (bensin dengan Rp/liter, servis, parkir, surat), **Parts** (checklist
perawatan berkala dengan tenggat, komponen `UpkeepList` bersama dengan
Residence), **Info** (identitas mobil, pengingat STNK, tips mekanik).

### 5.14 Residence 🏠
**Log** (pengeluaran rumah, BACA-SAJA dari transaksi Finance supaya tidak
dicatat dua kali), **Utility** (air & listrik), **Token ⚡** (catat sisa kWh
meteran pagi & sore; app menghitung kWh/jam, rupiah, pemakaian saat di rumah
vs ditinggal, prediksi habis; riwayat pembelian token), **Maintenance**
(bersih-bersih berkala), **Info** (kontrak).

### 5.15 Fun 🎉
**Summit** (gunung yang ditaklukkan; daftar gunung Jawa statik dengan tanda ✓),
**Creators** (video terbaru kanal YouTube via feed publik), **Recreation**
(tempat rekreasi). Semua entri di satu dokumen kecil.

### 5.16 Wheel 🎡 (+ Timeline 📍 & History 📜)
- **Wheel of Life**: 8 area (Spirituality, Health, Family, Finance, Ministry,
  Career, Relationship, Fun) dinilai 1–10 per kuartal dengan alasan, pilih
  minimal 3 area fokus dengan target score + action plan, radar chart SVG,
  PDF; dipakai juga untuk tiap CL saat visitasi; ✨ AI merapikan catatan
  jadi poin tanpa mengubah isi.
- **Timeline**: wishlist/target per tahun (ditempel ke bulan atau tahunan) per
  bidang hidup, PDF; **History**: perjalanan hidup yang sudah terjadi per tahun.

### 5.17 Device 📱
**Log** (biaya perangkat, BACA-SAJA dari Finance sub "Mobile") dan **iPhone**
(paket kuota aktif: sisa GB, habis kapan, harga; badge H-1).

### 5.18 Games 🎮
**Tournament** (bracket sistem gugur 4/8/16 peserta, undian acak, pilih
pemenang), **Snake** dan **Tetris** (murni lokal, rekor di HP).

### 5.19 Friends 🤝
**Split Bill 💸** (foto nota → OCR di HP → item → siapa makan apa; pajak &
service dibagi proporsional), **Fun Futsal ⚽** (dua geng: jadwal & lokasi,
setoran per orang, skor tiap game, kas tim dengan saldo berjalan,
leaderboard top score & paling rajin, jadwal lengkap), **Places 🍜** (mau
coba / sudah pernah).

### 5.20 Married 💍
Coming soon; tile sudah ada supaya tempatnya jelas.

### 5.21 Reward 🏆 & Self-Reward
Kategori bertingkat ala Duolingo: Morning Prayer, Morning/Midday/Night
Reading, Good Habit, Daily Steps, Distance (patokan 5K dst), Weekly Steps,
Weekly Strength, Water, Learning, Fitness. Dihitung dari data yang sudah ada.
Self-Reward: daftar hadiah untuk diri sendiri yang dananya dari Saku, dengan
arsip klaim.

## 6. Integrasi lintas fitur yang menonjol

- **WhatsApp**: nomor CL dinormalisasi (`lib/phone.ts`), tautan wa.me dengan
  pesan pengantar; PDF selalu lewat share sheet iOS lalu chat WA dibuka.
- **PDF** (expo-print): notulen visitasi + rules, notulen bulanan, rekap
  visitasi, Wheel of Life, Timeline, data tubuh CL, pedoman CL, invoice
  freelance. Kerangka bersama `lib/pdfDoc.ts`.
- **Gambar untuk dibagikan** (SVG → PNG di HP, tanpa AI): Feed 4:5 (jurnal),
  Story 9:16 (ayat / doa), persegi 1:1 (reminder untuk WhatsApp).
- **AI (Gemini) hanya empat pemakaian**, semuanya dipanggil saat di-click:
  rapikan notulen bulanan, AI Reflection jurnal (1×/hari + Try Again terbatas),
  rapikan catatan Wheel, Financial Coach (maks 6/hari). Pagar umum
  `lib/aiGuard.ts`: memo per masukan, dedupe permintaan berjalan, cooldown 5
  detik, kunci 60 detik setelah 429, batas 30 permintaan/hari/perangkat.
  Tidak ada retry otomatis. Gaya jawabannya satu untuk semua (`lib/aiStyle.ts`):
  kalimat pendek, emoji maksimal 3 dan cuma di ujung baris, dan tanpa emoji
  sama sekali untuk yang dicetak jadi PDF (notulen, Wheel).
- **Catatan rohani ⇄ acara CORE**: bahan Revive/khotbah ditautkan ke visitasi
  atau rapat yang akan datang (hanya penunjuk, tidak menyalin).
- **Finance sebagai sumber tunggal pengeluaran** untuk Car, Residence, Device.
- **Streak** memakai satu rumus murni (`lib/streak.ts`) untuk semua fitur.
- **Warna fitur** ikut dari tile Home ke pita header dan tab dalam layar
  (dipetakan dari nama rute).
- **Kaki layar emerald gelap** (24 Sep 2026): tab bar utama DAN baris sub-tab
  tiap fitur memakai bar `#0B3D36` bersudut membulat, dengan pil di belakang
  ikon yang aktif. Di kaki app pilnya emerald (`#176B5D`) dengan ikon mint dan
  tulisan putih tebal; di sub-tab fitur pilnya tetap **pastel warna fiturnya**,
  jadi sistem warna fitur tidak hilang, malah makin menyala di atas gelap.

## 7. Keamanan & privasi

- Repo publik, tapi tanpa kredensial: konfigurasi Firebase dari `.env`
  (`EXPO_PUBLIC_*`), tanpa `.env` app tidak menghubungi Firebase mana pun.
- Rules: `request.auth.uid == userId` dan email pemilik; tolak semua di luar
  `users/{uid}`; Storage tidak dipakai.
- Data sensitif (NIK, NPWP, keuangan, data CL) hanya di Firestore pribadi;
  tidak pernah ke log/analytics; AI hanya menerima agregat.
- PIN di app adalah kunci dari orang iseng yang memegang HP, bukan pengaman
  data (disebut jujur di kode).
- **Ekspor Data 📦** (System ⚙️, 24 Sep 2026): satu tombol menyalin seluruh
  `users/{uid}/…` (46 koleksi + 4 subkoleksi) jadi satu JSON lalu menyerahkannya
  ke share sheet iOS. Ini satu-satunya operasi yang sengaja membaca semua
  dokumen sekaligus, jadi ia hanya jalan saat di-click. Sebelum ini tidak ada
  jalan keluar sama sekali untuk data pemilik, padahal semua hapus permanen.
- Yang masih perlu di Console (didokumentasikan di SECURITY.md): matikan
  sign-up, email enumeration protection, batasi API key ke bundle id, App
  Check, alarm anggaran.

## 8. Konteks yang adil untuk penilaian

- Dibangun oleh **satu orang** yang baru belajar pengembangan aplikasi, dengan
  bantuan AI coding assistant, dalam beberapa bulan (app "lahir" 21 Juli 2026,
  versi sekarang 1.4.x).
- Batasan keras: **biaya nol** (Spark, tanpa server, tanpa API berbayar),
  **iOS**, **satu pengguna**. Banyak keputusan (base64 di Firestore, "cron"
  saat app dibuka, RSS alih-alih API resmi) adalah konsekuensi sadar dari
  batasan itu, bukan kelalaian.
- Ruang lingkupnya sangat luas (20 fitur) dan sengaja begitu: tujuannya satu
  aplikasi yang menggantikan semua spreadsheet dan catatan pribadi pemiliknya.
- Beberapa bagian masih placeholder (Married, Business) dan beberapa fitur
  butuh build native baru (notifikasi Finance).

Hal yang layak dinilai: kejelasan tujuan tiap fitur, konsistensi pola data
dan UI, kebijakan biaya/keamanan, cara AI dipagari, serta apakah luasnya
lingkup masih terkelola untuk satu pengembang.
