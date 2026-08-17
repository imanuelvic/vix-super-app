import { usePathname, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import { useAuth } from '@/contexts/auth';
import {
  prayerGateDue,
  subscribeLoginStreak,
  type LoginStreak,
} from '@/lib/achievements';

const GATE_PATH = '/morning-prayer';

// Layar yang BOLEH dibuka selagi gerbang pagi aktif — semuanya bagian dari
// menyelesaikan langkahnya: gerbang itu sendiri, Revive (langkah 1), dan CORE
// (langkah 3 Doa Rantai). Selain ini, ditarik balik ke gerbang.
const ALLOWED_PATHS = [GATE_PATH, '/revive', '/core'];

/**
 * Pengawal doa pagi — dipasang SEKALI di root layout, tidak menggambar apa pun.
 *
 * Jendela doa pagi: 04.00 (batas hari doa) sampai 08.59. Selama jendela itu dan
 * doa hari ini belum dikonfirmasi, layar mana pun otomatis dialihkan ke gerbang
 * `/morning-prayer`. Jam berjalan dicek tiap 30 detik, jadi kalau app sedang
 * terbuka saat jam 04.00 lewat, gerbang langsung muncul sendiri.
 *
 * Pengawal ini bekerja DUA ARAH. Dulu ia cuma bisa mendorong MASUK ke gerbang,
 * sehingga layarnya bisa nyangkut: doa sudah dikonfirmasi di HP lain, atau jam
 * 09.00 keburu lewat, tapi gerbangnya tetap terbuka. Sekarang begitu doa hari
 * ini tidak lagi tertagih, gerbang ditinggalkan sendiri.
 *
 * Karena `login` datang dari langganan Firestore yang hidup, konfirmasi di HP A
 * sampai ke HP B dalam hitungan detik — HP B keluar dari gerbang tanpa disentuh.
 */
export function MorningPrayerWatcher() {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();

  // undefined = streak belum termuat → jangan alihkan dulu (hindari kedip).
  const [login, setLogin] = useState<LoginStreak | null | undefined>(undefined);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!user) return;
    return subscribeLoginStreak(user.uid, setLogin);
  }, [user]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!user || login === undefined) return;
    const atGate = pathname.startsWith(GATE_PATH);

    if (prayerGateDue(login, now)) {
      if (ALLOWED_PATHS.some((p) => pathname.startsWith(p))) return;
      router.replace(GATE_PATH);
      return;
    }

    // Tidak tertagih lagi — entah barusan dikonfirmasi (di HP ini atau HP lain)
    // atau jam 09.00 sudah lewat. Jangan biarkan gerbangnya nyangkut.
    if (atGate) router.replace('/');
  }, [user, login, now, pathname, router]);

  return null;
}
