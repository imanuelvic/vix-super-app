import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

// Pemilih foto bersama untuk seluruh app (avatar Family & Profil, medali Race,
// dokumentasi rapat CORE).
//
// Semua foto di app ini ikut tersimpan DI DALAM dokumen Firestore-nya, bukan di
// Cloud Storage — jadi tiap foto WAJIB dikecilkan dulu. Batas keras Firestore
// 1 MB per dokumen, dan base64 masih menggelembungkan ±33% lagi. Makin kecil
// fotonya, makin murah & cepat pula tiap kali daftarnya dibaca ulang.

/**
 * Foto tersimpan (base64 polos) → alamat yang bisa dipasang di `<Image>` atau
 * `<img>`.
 *
 * Prefiksnya dulu diketik ulang di sepuluh tempat. Satu huruf meleset —
 * `image/jpg` alih-alih `image/jpeg`, koma hilang — dan fotonya tidak muncul
 * sama sekali, tanpa pesan galat apa pun: `<Image>` hanya diam. Jadi bentuk
 * alamatnya ditulis SEKALI di sini.
 */
export function photoUri(base64: string): string {
  return `data:image/jpeg;base64,${base64}`;
}

/** Pilih 1 foto dari galeri lalu kompres → JPEG base64 (tanpa prefix `data:`). */
export async function pickCompressedImage({
  width,
  compress = 0.5,
  square = false,
}: {
  /** Lebar akhir dalam piksel; tingginya ikut proporsi aslinya. */
  width: number;
  /** Mutu JPEG 0–1. Makin kecil, makin ringan tapi makin kasar. */
  compress?: number;
  /** Paksa crop kotak 1:1 lewat editor bawaan — untuk foto avatar. */
  square?: boolean;
}): Promise<string | null> {
  const res = await ImagePicker.launchImageLibraryAsync(
    square
      ? {
          mediaTypes: ['images'],
          allowsEditing: true,
          aspect: [1, 1],
          quality: 1,
        }
      : { mediaTypes: ['images'], quality: 1 },
  );
  if (res.canceled || !res.assets[0]) return null;
  const small = await ImageManipulator.manipulateAsync(
    res.assets[0].uri,
    [{ resize: { width } }],
    {
      compress,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: true,
    },
  );
  return small.base64 ?? null;
}

/**
 * Foto yang perlu DIBACA MESIN (nota Split Bill), bukan sekadar disimpan.
 *
 * Mengembalikan DUA hal dari satu jepretan, dan itu memang disengaja:
 * - `scanUri` — salinan lebar 1600 px untuk OCR. Foto asli iPhone (±4000 px)
 *   bisa dibaca juga tapi jauh lebih lambat, sedangkan versi simpan 640 px
 *   terlalu kasar: huruf struk thermal-nya hancur dan hasilnya ngawur.
 * - `base64`  — versi kecil 640 px yang benar-benar disimpan ke Firestore,
 *   sama ukurannya dengan foto dokumentasi lain di app ini.
 *
 * `scanUri` cuma berkas sementara di HP — tidak ikut tersimpan ke mana pun.
 */
export async function pickPhotoToRead({
  fromCamera,
}: {
  /** true = buka kamera (motret nota), false = ambil dari galeri. */
  fromCamera: boolean;
}): Promise<{ scanUri: string; base64: string | null } | null> {
  const res = fromCamera
    ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 })
    : await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 1,
      });
  if (res.canceled || !res.assets[0]) return null;
  const asli = res.assets[0].uri;

  const untukBaca = await ImageManipulator.manipulateAsync(
    asli,
    [{ resize: { width: 1600 } }],
    { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG },
  );
  const untukSimpan = await ImageManipulator.manipulateAsync(
    asli,
    [{ resize: { width: 640 } }],
    { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG, base64: true },
  );
  return { scanUri: untukBaca.uri, base64: untukSimpan.base64 ?? null };
}
