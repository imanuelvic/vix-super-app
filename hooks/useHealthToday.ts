import { useCallback, useState } from 'react';

import { useAsyncData } from '@/hooks/useAsyncData';
import {
  healthKitStatus,
  readTodaySummary,
  type DailyHealthSummary,
  type HealthKitStatus,
} from '@/lib/healthkit';

/**
 * Ringkasan Apple Health HARI INI — dipakai bersama tab Steps 👣 dan layar
 * Rekor Langkah 🏆, yang dulu menulis potongan yang sama masing-masing.
 *
 * Kalau izinnya belum ada (`status` bukan 'ok'), tak ada permintaan yang
 * dikirim sama sekali dan `busy` tetap false — jadi layar yang tanpa Apple
 * Health tidak menampilkan loading yang tak pernah selesai.
 *
 * Galatnya sengaja DIDIAMKAN: Apple Health cuma pelengkap, angka tersimpan
 * (Firestore) tetap tampil apa adanya.
 */
export function useHealthToday(): {
  status: HealthKitStatus;
  /** null = belum terbaca (belum sampai / izin belum ada / gagal). */
  today: DailyHealthSummary | null;
  /** Sedang mengambil — untuk menonaktifkan tombol 🔄 biar tak ditekan ganda. */
  busy: boolean;
  reload: () => void;
} {
  // Status tidak berubah selama app hidup, cukup dihitung sekali.
  const [status] = useState(() => healthKitStatus());
  const { data, loading, reload } = useAsyncData(
    status === 'ok' ? readTodaySummary : null,
    '',
  );

  // Dibungkus supaya bisa dipasang langsung ke onPress tanpa ikut mengoper
  // event tekan sebagai argumen.
  const refresh = useCallback(() => reload(), [reload]);

  return { status, today: data, busy: loading, reload: refresh };
}
