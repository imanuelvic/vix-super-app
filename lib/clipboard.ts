import { requireOptionalNativeModule } from 'expo';
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
//
// Ketersediaannya DITANYAKAN dulu lewat requireOptionalNativeModule (15 Sep
// 2026): require('expo-clipboard') di build tanpa modulnya MELEMPAR
// "Cannot find native module 'ExpoClipboard'" saat modulnya dievaluasi, dan di
// dev client galat itu tetap tercetak merah di terminal walau sudah ditangkap.
// Dengan ditanyakan dulu, di build lama tidak ada yang dilempar sama sekali.
type ExpoClipboard = typeof import('expo-clipboard');

let cached: ExpoClipboard | null | undefined;

function getModule(): ExpoClipboard | null {
  if (cached !== undefined) return cached;
  try {
    cached = requireOptionalNativeModule('ExpoClipboard')
      ? // eslint-disable-next-line @typescript-eslint/no-require-imports
        (require('expo-clipboard') as ExpoClipboard)
      : null;
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
