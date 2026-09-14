import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

// Preferensi tampil/sembunyi nominal di Finance. Disimpan di HP (AsyncStorage)
// supaya pilihannya bertahan tiap kali masuk Finance, tidak ikut buka/tutup
// ringkasan.
//
// Dulu state ini hidup di dalam TransactionsTab bersama tombol matanya.
// 14 Sep 2026 tombolnya naik ke baris bulan di layar Finance (di kanan nama
// bulan), jadi state-nya ikut naik ke layar dan turun ke tab lewat prop.
const KEY = 'finance:amountsHidden'; // "1" = disembunyikan

export function useAmountsHidden(): { hidden: boolean; toggle: () => void } {
  const [hidden, setHidden] = useState(false);

  // Muat pilihan tersimpan sekali di awal. setState-nya di dalam .then,
  // bukan di badan efek, jadi tidak memicu render bertubi-tubi.
  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => {
      if (v != null) setHidden(v === '1');
    });
  }, []);

  const toggle = useCallback(() => {
    setHidden((h) => {
      const next = !h;
      AsyncStorage.setItem(KEY, next ? '1' : '0').catch(() => {});
      return next;
    });
  }, []);

  return { hidden, toggle };
}
