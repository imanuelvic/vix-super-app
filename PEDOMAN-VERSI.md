# Pedoman Versi — 2 Project di 1 Laptop 🧰

Laptop ini dipakai untuk **2 project Expo** yang butuh **Node berbeda**. Kalau
Node-nya salah, `yarn install` / `eas update` / `eas build` bisa gagal atau app
**force-quit**.

| Project | Expo SDK | Node | eas-cli | yarn |
| --- | --- | --- | --- | --- |
| **vix-super-app** | 57 | **20.19.4** | 22.2+ (terbaru) | 1.22.19 |
| **ndc-ministry-mobile-application** | 48 | **18.20.4** | 5.9.3 | 1.22.19 |

Alatnya: **fnm** — otomatis ganti Node begitu kamu masuk folder project (baca
file `.node-version` di tiap repo). Sekali setup, tidak perlu ganti manual lagi.

> ⚠️ Pakai **PowerShell** (bukan `cmd.exe`). Auto-switch fnm hanya jalan di
> PowerShell / Git Bash — tidak di cmd. (Error kemarin muncul karena jalan di
> cmd + Node 18.)

---

## BAGIAN A — Pasang fnm & Node (SEKALI SAJA)

**1. Uninstall Node lama** (yang di `C:\Program Files\nodejs`):
Settings → Apps → Installed apps → cari **Node.js** → Uninstall.
Lalu bersihkan sisa paket global lama biar tidak bentrok:
```powershell
Remove-Item -Recurse -Force "$env:APPDATA\npm" -ErrorAction SilentlyContinue
```

**2. Pasang fnm:**
```powershell
winget install Schniz.fnm
```
Tutup, lalu buka lagi PowerShell.

**3. Aktifkan auto-switch** (tambah 1 baris ke profil PowerShell):
```powershell
if (-not (Test-Path $PROFILE)) { New-Item -ItemType File -Path $PROFILE -Force }
Add-Content $PROFILE 'fnm env --use-on-cd | Out-String | Invoke-Expression'
```
Tutup, lalu buka lagi PowerShell.

**4. Pasang 2 versi Node:**
```powershell
fnm install 20.19.4
fnm install 18.20.4
fnm default 20.19.4
```

Cek: `fnm list` → harus muncul 20.19.4 dan 18.20.4.

---

## BAGIAN B — Siapkan tiap project (SEKALI per project)

Paket global (`yarn`, `eas-cli`) terpasang **terpisah per versi Node**, jadi tiap
project otomatis dapat versi tool-nya sendiri — tidak bentrok.

### vix-super-app (Node 20)
```powershell
cd C:\Users\ASUS\Downloads\vix-super-app   # fnm auto-switch → Node 20.19.4
node -v                                     # pastikan: v20.19.4
npm install -g yarn@1.22.19 eas-cli@latest  # tool global utk Node 20
yarn install                                # pasang dependency
```

### ndc-ministry-mobile-application (Node 18)
```powershell
cd C:\Users\ASUS\Downloads\ndc-ministry-mobile-application  # auto-switch → Node 18
node -v                                     # pastikan: v18.20.4
npm install -g yarn@1.22.19 eas-cli@5.9.3   # tool global utk Node 18
yarn install
```

---

## BAGIAN C — Pakai sehari-hari (INI yang gampang 🎉)

Tidak ada lagi ganti versi manual. Cukup pindah folder:
```powershell
cd C:\Users\ASUS\Downloads\vix-super-app        # otomatis Node 20 + eas 21
# ...atau...
cd C:\Users\ASUS\Downloads\ndc-ministry-mobile-application   # otomatis Node 18 + eas 5.9.3
```

Cek cepat kamu di versi yang benar:
```powershell
node -v        # vix → v20.x  |  NDC → v18.x
eas --version  # vix → 22.x   |  NDC → 5.9.3
```

Lalu jalankan seperti biasa, mis. di vix:
```powershell
eas update --branch preview --environment preview -m "deskripsi"  # OTA (JS saja)
eas build --profile preview --platform ios                 # binary baru (native)
```

> Kapan `update` vs `build`? Lihat **`RELEASE.md`**. Ingat: menambah modul native
> (mis. `expo-print`) = WAJIB `eas build`, bukan `eas update` → kalau salah, app
> force-quit.

---

## BAGIAN D — Kalau bermasalah / rollback

- **`eas` atau `yarn` "not found" setelah pindah folder** → tool global belum
  dipasang untuk Node versi itu. Ulangi `npm install -g ...` (Bagian B) di folder
  tersebut.
- **Node tidak auto-switch** → pastikan pakai **PowerShell** (bukan cmd) & profil
  sudah berisi baris `fnm env --use-on-cd ...` (Bagian A no.3). Restart PowerShell.
  Cek isi profil: `Get-Content $PROFILE`.
- **Mau balik seperti semula** → `winget uninstall Schniz.fnm`, lalu pasang lagi
  Node dari nodejs.org (installer biasa). Kondisi kembali seperti awal.
- **eas-cli 5.9.3 ditolak server EAS** saat build NDC → kabari; kita cari versi
  eas-cli yang masih mendukung SDK 48.

---

## Kenapa harus begini (ringkas)

- **vix pakai SDK 57 (RN 0.86) → wajib Node ≥ 20.19.4.** Di Node 18, `yarn install` gagal
  karena `@react-native/dev-middleware` menolak (`Expected ">= 20.19.4"`).
- **NDC pakai SDK 48 (RN 0.71) → cocoknya Node 18.** Menaikkan Node bisa bikin
  tooling lama (Metro/Expo SDK 48) rewel.
- **fnm** baca `.node-version` di tiap repo → Node ganti otomatis. `eas-cli` &
  `yarn` terpasang per-Node → tiap project dapat versinya sendiri.
- File penanda: `.node-version` (+ `.nvmrc`) di vix = `20.19.4`; di NDC =
  `18.20.4`. Ikut commit supaya di mesin lain (iMac) juga auto-switch.
