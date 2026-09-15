import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

/**
 * "Tutup untuk hari ini" — kartu yang bisa disingkirkan sampai besok.
 *
 *   const syafaat = useDailyDismiss('home:intercession', todayId);
 *   {!syafaat.dismissed && <Kartu onClose={syafaat.dismiss} />}
 *
 * Yang disimpan cuma dayId hari ia ditutup (AsyncStorage, per perangkat):
 * begitu `todayId` berganti tengah malam, `dismissed` otomatis salah lagi
 * tanpa perlu dibersihkan — kartunya memang harus kembali tiap pagi. Sengaja
 * bukan Firestore: ini urusan tampilan, bukan data, dan satu tulisan per hari
 * untuk menyembunyikan kartu tak layak dibayar dengan kuota.
 *
 * Sebelum nilai tersimpannya terbaca `dismissed` = false, jadi kartunya
 * tampil sekejap lalu hilang kalau memang sudah ditutup. Itu dibiarkan:
 * kebalikannya (menahan kartu sampai terbaca) membuat SEMUA kartu telat
 * muncul tiap kali Home dibuka, demi kasus yang jauh lebih jarang.
 */
export function useDailyDismiss(
  key: string,
  todayId: string,
): { dismissed: boolean; dismiss: () => void } {
  // dayId hari kartunya ditutup; null = belum pernah / belum terbaca.
  const [closedDay, setClosedDay] = useState<string | null>(null);

  useEffect(() => {
    let batal = false;
    AsyncStorage.getItem(key)
      .then((v) => {
        if (!batal) setClosedDay(v);
      })
      .catch(() => {});
    return () => {
      batal = true;
    };
  }, [key]);

  function dismiss() {
    setClosedDay(todayId);
    AsyncStorage.setItem(key, todayId).catch(() => {});
  }

  return { dismissed: closedDay === todayId, dismiss };
}
