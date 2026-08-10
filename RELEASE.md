# Panduan Rilis vix (EAS) 🚀

Catatan singkat kapan pakai **`eas build`** (bikin binary baru) vs **`eas update`**
(kirim JS lewat udara / OTA). Salah pilih = app **force-quit** atau update tak
nyampai.

---

## Aturan inti

### ➜ WAJIB `eas build` (binary baru) kalau ada perubahan NATIVE


Karena `eas update` **tidak bisa** menambah kode native ke app yang sudah
terpasang. Termasuk:

- Menambah / mengubah / menghapus **dependency native** — mis. `expo-print`,
  `expo-sharing`, `expo-image-picker`, `@kingstinct/react-native-healthkit`,
  `react-native-*`, dll (apa pun yang ada di `package.json`).
- Mengubah **`plugins`** atau setelan native di `app.json` (izin, splash,
  `newArchEnabled`, `reactCompiler`, dll).
- Menaikkan **`version`** di `app.json` — karena
  `runtimeVersion.policy = "appVersion"`, ganti versi = runtimeVersion baru =
  butuh build baru (update OTA hanya nyampai ke build dengan runtimeVersion sama).

Perintah:

```bash
eas build --profile preview --platform ios
```

Lalu **pasang hasilnya di HP** (internal distribution / TestFlight).

### ➜ Cukup `eas update` (OTA) kalau HANYA JS/TS/aset

Warna, teks, logika, tata letak, gambar — tanpa menyentuh yang di atas.

Perintah:

```bash
eas update --branch preview --message "deskripsi singkat"
```

**JANGAN naikkan `version`** untuk OTA — biar runtimeVersion tetap cocok dengan
build yang ada di HP.

---

## Cara cepat menentukan: native atau JS?

Cek `git diff` sejak build terakhir:

- Menyentuh **`package.json`** (dependency), **`app.json`** (plugins / native /
  `version`), atau folder **`ios/` / `android/`** → **NATIVE** → `eas build`.
- Selain itu (cuma `.ts` / `.tsx` / aset) → **JS** → `eas update`.

---

## Peta channel

Profil di `eas.json` → channel → branch update:

| Profil build | Channel | Branch `eas update` |
| --- | --- | --- |
| `development` | `development` | `development` |
| `preview` | `preview` | `preview` |
| `production` | `production` | `production` |

`eas update --branch preview` hanya sampai ke app yang di-build dengan profil
`preview`.

---

## Konsistensi versi antar-mesin (laptop ↔ iMac)

Kerja di 2 mesin (laptop Windows & iMac) yang sinkron lewat `git push/pull`.
Supaya `pull` lalu `eas update` di iMac berjalan mulus, toolchain dikunci sama.

**Toolchain terkunci:** Node **18.20.4** · yarn **1.22.19** · eas-cli **≥ 21.5.0**
(dipatok lewat `.nvmrc`, `.node-version`, `engines` + `packageManager` di
`package.json`, dan `cli.version` di `eas.json`).

**Alur wajib tiap habis `git pull` (di mesin mana pun):**

1. Pastikan Node 18.20.4 → `node -v` (di iMac: `nvm use` membaca `.nvmrc`).
2. `corepack enable` → yarn otomatis 1.22.19 (baca `packageManager`).
3. `yarn install --frozen-lockfile` → pasang PERSIS dari `yarn.lock`.
4. `git status` → `yarn.lock` HARUS tetap bersih = dependency identik.
5. `npx expo-doctor` (`yarn doctor`) → cek kesehatan & native-module mismatch.

**Aturan emas:** SELALU pakai **`yarn`**, JANGAN `npm install` — `npm` bikin
`package-lock.json` dan bisa menggeser versi. `yarn.lock` = sumber kebenaran,
wajib ikut commit.

**Klarifikasi mitos:** beda versi Node/EAS antar-mesin **BUKAN** sebab `eas
update` tak nyampai / app force-quit. Sebab sebenarnya ada di bagian
**Troubleshooting** di bawah (modul native ditambah tanpa build baru, `version`
naik, atau channel beda). Yang menjaga konsistensi antar-mesin = **lockfile +
package manager sama**, bukan angka versi Node-nya.

**Catatan Node 18:** 18.20.4 di bawah minimum resmi SDK 54 (≥ 20.19.4) → Metro /
regen `.expo/types/router.d.ts` tetap manual. Kalau mau mulus nanti, upgrade
**kedua** mesin ke Node 20 LTS bersamaan (ubah `.nvmrc`, `.node-version`,
`engines` sekaligus).

---

## Troubleshooting

**Gejala:** setelah `eas update`, di HP app **force-quit** dan **tidak
terupdate**.
**Sebab:** bundle JS baru memanggil **modul native yang tidak ada** di binary
terpasang (mis. `expo-print`/`expo-sharing` untuk Invoice PDF ditambah setelah
build terakhir). App crash saat launch → `expo-updates` otomatis rollback ke
bundle lama → tampak "tidak terupdate".
**Solusi:** bukan `eas update` — **build ulang** (`eas build --profile preview
--platform ios`), pasang di HP. Setelah itu perubahan JS-only berikutnya baru
boleh OTA.

> Konteks per rilis ini: `expo-print` + `expo-sharing` (fitur Invoice PDF di
> Career → Freelance) menuntut build baru. Karena `runtimeVersion = appVersion`,
> setiap kenaikan `version` juga selalu menuntut build baru.
