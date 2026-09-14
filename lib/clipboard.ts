import { Clipboard as ClipboardLama } from 'react-native';

// Salin teks ke papan klip (clipboard) iOS.
//
// Modul yang benar untuk ini `expo-clipboard`, tapi ia modul NATIVE: build yang
// belum memuatnya (dev client lama, atau build produksi yang cuma menerima
// `eas update`) akan gagal START kalau modul itu di-import statis, bukan cuma
// tombol salinnya yang mati. Jadi ia dimuat dengan require() saat pertama
// dipakai, persis seperti HealthKit di lib/healthkit.ts, dan kalau tidak ada,
// jatuh ke Clipboard bawaan React Native yang masih dibawa RN 0.86 (sudah
// ditandai usang, tapi masih jalan). Begitu build barunya terpasang, jalur
// cadangan itu tidak pernah tersentuh lagi.
type ExpoClipboard = typeof import('expo-clipboard');

let cached: ExpoClipboard | null | undefined;

function getModule(): ExpoClipboard | null {
  if (cached !== undefined) return cached;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = require('expo-clipboard') as ExpoClipboard;
  } catch {
    cached = null;
  }
  return cached;
}

/** Salin `text`. Tidak pernah melempar; false = gagal. */
export async function copyText(text: string): Promise<boolean> {
  try {
    const mod = getModule();
    if (mod) return await mod.setStringAsync(text);
    ClipboardLama.setString(text);
    return true;
  } catch {
    return false;
  }
}
