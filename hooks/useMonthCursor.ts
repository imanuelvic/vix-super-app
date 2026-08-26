import { useState } from 'react';

/**
 * Bulan yang sedang DILIHAT di sebuah layar — pasangan `year` + `month` (0–11)
 * beserta cara menggesernya.
 *
 * Tiga layar menulis blok yang persis sama (Finance 💰, Reminder 🔔, dan
 * Career → Insurance 🛡️):
 *
 *     const now = new Date();
 *     const [year, setYear] = useState(now.getFullYear());
 *     const [month, setMonth] = useState(now.getMonth());
 *     function shiftMonth(delta: number) {
 *       const d = new Date(year, month + delta, 1);
 *       setYear(d.getFullYear());
 *       setMonth(d.getMonth());
 *     }
 *
 * Kenapa lewat `new Date(year, month + delta, 1)` dan bukan `month + delta`
 * langsung: Date-lah yang mengurus pergantian tahun. Dari Desember (11) maju
 * 1 → bulan 12 tidak ada, tapi Date memutarnya jadi Januari tahun berikutnya;
 * begitu pula mundur dari Januari ke Desember tahun sebelumnya. Tanggal 1
 * dipakai supaya bulan pendek tidak meleset (31 Maret − 1 bulan bukan Februari).
 *
 * `goNow()` = balik ke bulan berjalan (dipakai saat label bulannya ditekan).
 */
export function useMonthCursor(now: Date): {
  year: number;
  /** 0–11, sama seperti `Date.getMonth()`. */
  month: number;
  /** Geser `delta` bulan; negatif = mundur. Tahun ikut menyesuaikan. */
  shiftMonth: (delta: number) => void;
  /** Kembali ke bulan berjalan. */
  goNow: () => void;
} {
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0–11

  function shiftMonth(delta: number) {
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  }

  function goNow() {
    setYear(now.getFullYear());
    setMonth(now.getMonth());
  }

  return { year, month, shiftMonth, goNow };
}
