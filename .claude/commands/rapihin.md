---
description: Audit + rapikan kode dengan aman (hard delete, ekstrak komponen, buang dead code) tanpa mengubah fungsi/tampilan
---

Rapikan & sederhanakan kode proyek ini dengan AMAN. Kerjakan bertahap, satu
batch, lalu verifikasi. Argumen (opsional) = area fokus, mis. `finance`, `core`,
`health`. Tanpa arganya → lanjutkan batch fondasi berikutnya yang belum selesai
(lihat rencana di `.claude/plans/` kalau ada).

Area fokus dari argumen: $ARGUMENTS

## Aturan wajib (JANGAN dilanggar)
1. **Jangan ubah fungsi/tujuan fitur apa pun.** Perilaku harus persis sama.
2. **UI, warna, tata letak tetap identik.** Ini app modern untuk Gen-Z —
   jangan geser tampilan. Pakai `Color` dari `assets/style/color.ts`.
3. **Semua delete PERMANEN (hard delete Firestore)** — `deleteDoc` /
   `writeBatch` / tulis-ulang array. Jangan pernah bikin soft-delete
   (`isDeleted`/`archived`). Catatan: `active` di `lib/categories.ts` itu toggle
   tampilan kategori, BUKAN soft-delete → jangan diutak-atik.
4. **Reuse komponen `components/common/` & hook `hooks/` yang sudah ada.**
   Jangan bikin duplikat. Kalau ada pola berulang yang belum jadi komponen/hook,
   ekstrak jadi satu (nama jelas, gaya sama seperti komponen `common/` lain).
5. **Buang dead code** (import/var/param/export tak terpakai) yang dilaporkan
   `tsc`/lint — tapi hanya yang benar-benar tak terpakai.
6. **Library:** utamakan yang sudah terpasang di `package.json`. Boleh usul
   library baru; kalau butuh modul native (perlu BUILD EAS baru, bukan cukup
   `eas update`) → beri tanda jelas & tanya dulu sebelum menambah.

## Util bersama yang sudah ada (pakai ini)
- Pesan: `LOAD_ERROR` / `SAVE_ERROR` / `DELETE_ERROR` di `lib/messages.ts`.
- Loading: `<LoadingCenter />` di `components/common/LoadingCenter.tsx`.
- Pagination: `usePagination(items, size)` di `hooks/usePagination.ts`.
- Lain: SheetModal, Pagination, SearchBar, DateField, DualButtons, InlineDelete,
  ReminderCard, PrimaryButton, VixText, PressableScale, dll di `components/common/`.

## Langkah
1. Baca file di area fokus (atau pilih batch fondasi berikutnya).
2. Ganti pola berulang dengan util bersama; ekstrak komponen/hook baru bila ada
   pola yang jelas berulang & belum ada.
3. Hapus dead code.
4. Verifikasi: `npx tsc --noEmit` (harus `TSC_OK`) + `npx expo lint` (harus
   bersih). Perbaiki sampai bersih.
5. Lapor SINGKAT dalam Bahasa Indonesia: file yang diubah, apa yang
   disederhanakan, konfirmasi tsc+lint bersih, dan apakah cukup `eas update`
   atau perlu build baru.
