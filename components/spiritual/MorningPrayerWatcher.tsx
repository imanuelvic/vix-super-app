import { usePathname, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import { useAuth } from '@/contexts/auth';
import {
  prayerDeadlinePassed,
  prayerDoneToday,
  subscribeLoginStreak,
  type LoginStreak,
} from '@/lib/achievements';

// Layar yang BOLEH dibuka selagi gate doa pagi aktif — semuanya bagian dari
// menyelesaikan langkahnya: gate itu sendiri, Revive (langkah 1), dan CORE
// (langkah 3 Doa Rantai). Selain ini, ditarik balik ke gate.
const ALLOWED_PATHS = ['/morning-prayer', '/revive', '/core'];

/**
 * Pengawal doa pagi — dipasang SEKALI di root layout, tidak menggambar apa pun.
 *
 * Jendela doa pagi: 04.00 (batas hari doa) sampai 10.59. Selama jendela itu
 * dan doa hari ini belum dikonfirmasi, layar mana pun otomatis dialihkan ke
 * lock screen `/morning-prayer`. Jam berjalan dicek tiap 30 detik, jadi kalau
 * app sedang terbuka saat jam 04.00 lewat, gate langsung muncul sendiri —
 * tidak perlu menekan Home dulu.
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
    const due = !prayerDoneToday(login, now) && !prayerDeadlinePassed(now);
    if (!due) return;
    if (ALLOWED_PATHS.some((p) => pathname.startsWith(p))) return;
    router.replace('/morning-prayer');
  }, [user, login, now, pathname, router]);

  return null;
}
