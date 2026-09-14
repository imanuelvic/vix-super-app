# Build iOS gratis, tanpa Mac, tanpa jatah EAS Cloud

## Kenapa tidak bisa di laptop ini

`eas build --local --platform ios` butuh **Xcode**, dan Xcode hanya ada di macOS.
Di Windows perintah itu langsung berhenti:

```
Unsupported platform, macOS is required to build apps for iOS
```

Windows cuma bisa membangun Android, dan app ini iOS (di `app.json` bagian
`android` kosong). Jadi "lokal" di laptop ini bukan pilihan, apa pun alatnya.

## Dua jalan yang benar-benar gratis

### 1. Paket Free EAS sudah cukup (cek dulu ini)

Paket **Free** EAS memberi **15 build iOS per bulan**, antrean prioritas rendah,
batas 45 menit per build. Riwayat build repo ini kira-kira **4 build per bulan**.
Kalau selama ini bayar, buka expo.dev › akun `imanuelvic` › Billing dan turunkan
ke Free; build cloud biasa tetap jalan seperti sekarang.

### 2. `eas build --local` di runner macOS GitHub (repo publik = gratis)

Repo ini publik, dan GitHub Actions memberi runner **macOS standar gratis untuk
repo publik** (tidak ada batas menit). Workflow
[`.github/workflows/ios-build.yml`](.github/workflows/ios-build.yml) menjalankan
`eas build --local` di runner itu, persis perintah yang kamu mau, lalu mengirim
hasilnya ke **TestFlight** supaya tinggal di-install dari HP. Build lokal
**tidak memakai jatah EAS** sama sekali, dan tidak ada antrean.

## Yang perlu kamu siapkan (sekali saja)

1. **Token EAS** untuk runner:
   expo.dev › klik avatar › *Access tokens* › *Create token* (nama: `github-actions`).
   Lalu di GitHub: repo › *Settings* › *Secrets and variables* › *Actions* ›
   *New repository secret* › nama **`EXPO_TOKEN`**, isi tokennya.
   Token ini yang membuat runner bisa mengambil sertifikat, provisioning profile,
   dan variabel `EXPO_PUBLIC_*` dari akun EAS-mu, sama seperti build cloud.

2. **Kredensial App Store** untuk profil `*-testflight` (dari laptop ini, boleh):

   ```bash
   eas credentials --platform ios
   ```

   Pilih profil `development-testflight` › *Build credentials* › biarkan EAS
   membuat **Distribution Certificate** dan **App Store provisioning profile**
   (login Apple ID sekali). Ulangi untuk `preview-testflight`.
   Kalau selama ini baru pernah build `development`/`preview` (ad hoc), yang ini
   memang belum ada, dan runner (`--non-interactive`) tidak bisa membuatnya sendiri.

3. **App Store Connect API Key** untuk `eas submit` (masih di menu yang sama):
   *App Store Connect: Manage your API Key* › buat & simpan di EAS.
   Kalau kamu sudah pernah `eas submit` untuk produksi, kemungkinan sudah ada.

4. Di App Store Connect, tambahkan Apple ID-mu sebagai **internal tester**
   TestFlight untuk app ini (sekali saja), dan pasang app **TestFlight** di iPhone.

## Cara pakai

GitHub › tab **Actions** › **Build iOS (gratis)** › *Run workflow*:

| Input | Isi |
|---|---|
| `profile` | `development-testflight` (dev client) atau `preview-testflight` |
| `kirim_testflight` | biarkan ✔ |
| `simpan_ipa` | biarkan kosong (repo publik: artifact bisa diunduh siapa pun yang login GitHub) |

Kira-kira 20–35 menit. Sesudah selesai, buka app **TestFlight** di iPhone: build
barunya muncul di sana, tinggal *Install*. Untuk dev client, setelah terpasang
jalankan `npx expo start --dev-client` di laptop seperti biasa.

Profil `development` / `preview` (ad hoc) juga bisa dipilih, tapi hasilnya
cuma bisa disimpan sebagai `.ipa`; memasangnya ke iPhone dari Windows butuh alat
pihak ketiga lewat kabel. TestFlight lebih sederhana dan tertutup.

## Kalau gagal

| Pesan | Sebab & obat |
|---|---|
| `Unauthorized` / `EXPO_TOKEN` | secret belum ada atau tokennya dicabut (langkah 1) |
| `Distribution certificate` / `provisioning profile` tidak ditemukan | langkah 2 belum dijalankan untuk profil itu |
| `eas submit` minta login Apple | API Key belum tersimpan di EAS (langkah 3) |
| TestFlight menolak: build number sudah dipakai | `eas build:version:set --platform ios` lalu naikkan angkanya, atau jalankan ulang (profil `*-testflight` memakai `autoIncrement`) |
| Build berhenti > 90 menit | naikkan `timeout-minutes` di workflow; normalnya 20–35 menit |

## Catatan biaya & privasi

- Runner macOS gratis **hanya selama repo publik**. Kalau repo dijadikan
  privat, macOS dihitung 10 menit per 1 menit dari jatah 2.000 menit/bulan
  paket Free GitHub, kira-kira 6–8 build per bulan, masih gratis.
- Artifact `.ipa` di repo publik bisa diunduh siapa pun yang login GitHub. Itu
  sebabnya `simpan_ipa` bawaannya mati dan jalur bawaannya TestFlight (tertutup,
  hanya tester yang kamu daftarkan).
- Isi `.ipa` sama dengan yang ada di App Store: bundle JS + config Firebase publik.
  Bukan rahasia, tapi juga tidak perlu disebar.
