---
name: review-fitur
description: Review sebuah fitur atau screen aplikasi, lalu kasih saran konkret apa yang perlu ditambah, dikurangi, dan disederhanakan supaya lebih simpel, keren, dan berguna. Membandingkan fitur dengan kebutuhan user, data yang sudah diinput, dan aplikasi sejenis yang populer. Gunakan setiap kali user mengetik /review-fitur, atau minta review, saran, kritik, ide, atau perbandingan untuk fitur, screen, halaman, flow, atau tampilan aplikasi (misalnya "review fitur reminder ini", "screen ini kurang apa", "gimana biar halaman ini lebih simpel", "bandingin sama app lain"), walaupun kata review tidak disebut.
---

# Review Fitur / Screen

Tujuan: bantu user bikin fitur atau screen jadi lebih simpel, keren, dan berguna, lewat saran yang jujur dan bisa langsung dikerjakan.

## Apa yang di-review

Fitur atau screen yang disebut user, misalnya teks setelah `/review-fitur` (contoh: `/review-fitur reminder`). Kalau user tidak menyebut apa pun, pakai fitur yang sedang dibahas atau yang ada di screenshot. Kalau tetap tidak jelas, tanya satu pertanyaan singkat saja.

## Langkah kerja

### 1. Pahami fiturnya

Pakai sumber yang ada, dari yang paling akurat:

- **Kode** (kalau ada akses): cari file screen dan komponennya, model data, state, API, dan notifikasi. Telusuri alur user dari buka app sampai tugas selesai, lalu hitung jumlah tap-nya.
- **Screenshot atau rekaman layar**: baca layout, urutan informasi, tombol utama, dan teks.
- **Penjelasan user**: kalau cuma ini yang ada, pakai saja dan sebutkan asumsi yang kamu ambil.

Petakan juga fitur lain yang terhubung (misalnya notifikasi, kalender, home, widget, profil, settings). Masalah sering muncul di sambungan antar fitur, bukan di fiturnya sendiri.

### 2. Pelajari data yang sudah diisi

Cari data asli yang sudah diinput user: database atau API (hanya baca, jangan ubah apa pun), file export atau CSV, screenshot daftar, atau data yang ditempel di chat. Lalu cari polanya:

- Apa yang paling sering dibuat atau berulang setiap hari?
- Field mana yang hampir selalu kosong (kandidat dihapus) dan mana yang isinya selalu sama (kandidat jadi default)?
- Apa yang sering telat, terlewat, atau dihapus?

Kalau data tidak bisa diakses, bilang dalam satu kalimat lalu lanjut dengan yang ada.

### 3. Bandingkan dengan kebutuhan dan app sejenis

- **Kebutuhan**: siapa pemakainya, dan apa satu tugas utama yang harus terasa paling gampang? Pakai konteks yang sudah ada (chat, project, CLAUDE.md, README) sebelum bertanya.
- **App sejenis**: cari 3 sampai 5 aplikasi populer dengan fungsi yang sama, pakai web search kalau tersedia. Contoh untuk reminder atau tasks: Todoist, TickTick, Things 3, Apple Reminders, Google Tasks, Microsoft To Do.
- Ambil pola yang terbukti bagus dan cocok dengan kebutuhan user. Jangan meniru semua fitur mereka, karena tujuannya tetap simpel.

### 4. Susun saran

Setiap saran harus konkret: sebut screen, komponen, teks, atau jumlah tap sebelum dan sesudah. Hindari saran umum seperti "perbaiki UX" atau "buat lebih modern".

## Format jawaban

Pakai struktur ini, singkat dan gampang di-scan:

**📌 Ringkasan**
2 sampai 3 kalimat: kondisi sekarang dan satu masalah terbesar.

**👍 Yang sudah bagus**
Maksimal 3 poin, supaya tidak ikut dibuang.

**➕ Tambah**
Maksimal 5, urut dari dampak terbesar. Tiap poin: apa, kenapa (kaitkan dengan data atau kebutuhan), dan app yang sudah melakukannya.

**➖ Kurangi / Hapus**
Fitur, field, atau langkah yang jarang dipakai atau bikin ribet, beserta alasannya.

**✨ Tampilan yang lebih simpel**
Usulan susunan screen dari atas ke bawah. Kalau membantu, sertakan sketsa sederhana (ASCII) atau tawarkan mockup.

**🎯 Prioritas**
Tabel: Saran | Dampak (tinggi/sedang/rendah) | Usaha (kecil/sedang/besar). Tandai 1 sampai 3 quick win (dampak tinggi, usaha kecil) untuk dikerjakan duluan.

Tutup dengan satu tawaran langkah berikutnya, misalnya bikin mockup atau langsung mengerjakan quick win pertama.

## Prinsip

- Jujur, bukan cuma memuji. Kalau sebuah fitur sebaiknya dihapus, bilang dan jelaskan alasannya.
- Lebih sedikit lebih baik: lebih sedikit tap, lebih sedikit field wajib, lebih banyak default yang pintar.
- Aksi utama idealnya selesai dalam 1 sampai 2 tap dan gampang dijangkau jempol.
- Setiap saran punya dasar: data user, kebutuhan, atau pola dari app populer. Sebutkan dasarnya.
- Jangan ubah kode atau data sebelum user setuju.
- Pakai Bahasa Indonesia yang santai tapi jelas, istilah teknis secukupnya.

## Checklist cepat (bahan analisis, tidak perlu ditampilkan semua)

- Berapa tap untuk aksi utama? Bisa dikurangi?
- Apa yang pertama kali terlihat? Apakah itu yang paling penting?
- Empty state, loading, dan error sudah jelas?
- Ada input yang bisa dipercepat? Contoh: ketik "besok jam 7 doa pagi" langsung jadi reminder lengkap dengan jamnya.
- Bisa dipakai satu tangan? Tombol utama ada di area jempol?
- Konsisten dengan screen lain (warna, ikon, istilah)?
- Teks cukup besar, kontras cukup, dan area sentuh cukup luas?
