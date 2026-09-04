import { createContext, useContext, useMemo, useState } from 'react';

import type { FutsalGangKey } from '@/lib/futsal';

// Geng Fun Futsal yang sedang dibuka (⛪ CORE / ⚽ NDC F3) — SATU nilai untuk
// seluruh app, bukan satu per layar.
//
// Empat layar memakai deretan tab yang sama (sub-tab Fun Futsal, Jadwal Main,
// Leaderboard, Kas Tim). Selama tiap layar memegang gengnya sendiri, membuka
// Kas Tim dari tab CORE bisa mendarat di F3 — dan yang terbaca bukan "aku salah
// tab", melainkan "kas CORE-ku kosong". Sama saat menekan back: layar yang
// ditinggal tetap di geng lamanya.
//
// Tinggal di memori saja, tidak disimpan ke disk: satu sesi pemakaian memang
// selalu soal satu geng, dan app yang dibuka besok pagi lebih baik mulai dari
// bawaannya lagi.
type FutsalGangValue = {
  gang: FutsalGangKey;
  setGang: (gang: FutsalGangKey) => void;
};

const FutsalGangContext = createContext<FutsalGangValue | undefined>(undefined);

export function FutsalGangProvider({ children }: { children: React.ReactNode }) {
  // Bawaannya CORE — keputusan pemilik app.
  const [gang, setGang] = useState<FutsalGangKey>('core');
  const value = useMemo(() => ({ gang, setGang }), [gang]);
  return (
    <FutsalGangContext.Provider value={value}>
      {children}
    </FutsalGangContext.Provider>
  );
}

export function useFutsalGang() {
  const context = useContext(FutsalGangContext);
  if (!context) {
    throw new Error('useFutsalGang harus dipakai di dalam <FutsalGangProvider>');
  }
  return context;
}
