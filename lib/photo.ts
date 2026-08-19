import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

// Pemilih foto bersama untuk seluruh app (avatar Family & Profil, medali Race,
// dokumentasi rapat CORE).
//
// Semua foto di app ini ikut tersimpan DI DALAM dokumen Firestore-nya, bukan di
// Cloud Storage — jadi tiap foto WAJIB dikecilkan dulu. Batas keras Firestore
// 1 MB per dokumen, dan base64 masih menggelembungkan ±33% lagi. Makin kecil
// fotonya, makin murah & cepat pula tiap kali daftarnya dibaca ulang.

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
