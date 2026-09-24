import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePathname, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

import { useAuth } from '@/contexts/auth';
import { useLiveAll } from '@/hooks/useLiveAll';
import {
  prayerDoneToday,
  prayerGateDue,
  subscribeLoginStreak,
  type LoginStreak,
} from '@/lib/reward';
import { dayDocId } from '@/lib/health';

const GATE_PATH = '/morning-journey';
/** AsyncStorage: dayId saat undangan pagi terakhir dibuka OTOMATIS. */
const GATE_SHOWN_KEY = 'gate:shown';

/**
 * Pengawal Morning Journey 🌅 — dipasang SEKALI di root layout, tidak
 * menggambar apa pun. (Nama berkas & rute tetap "morning-prayer".)
 *
 * GERBANG LUNAK (22 Sep 2026, versi 2.0). Dulu: 00.00–08.59 semua layar
 * dipaksa ke /morning-prayer sampai dikonfirmasi, dan lewat 09.00 journey tak
 * bisa dibuka sama sekali. Sekarang:
 *   • Undangannya dibuka otomatis SEKALI per hari — saat app pertama dibuka
 *     di jendela pagi (00.00–08.59) & journey belum dijalani. Ditandai di
 *     AsyncStorage supaya app yang dibuka ulang tidak mengundang dua kali.
 *   • "Nanti dulu" menutupnya tanpa hukuman; undangan besarnya tetap ada di
 *     puncak Today, dan journey bisa dibuka kapan pun dari sana (juga sesudah
 *     09.00 — yang berubah cuma streaknya, ikut aturan lama).
 *   • Dikonfirmasi di HP lain → gerbang di HP ini ditinggalkan sendiri
 *     (`login` datang dari langganan Firestore yang hidup).
 *
 * Yang hilang: paksaan. Yang tetap: app mengarahkan perhatian pertama kepada
 * Tuhan, dengan undangan, bukan kunci.
 */
export function MorningJourneyGate() {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();

  // undefined = belum termuat → jangan memutuskan apa pun dulu (hindari kedip).
  const [login, setLogin] = useState<LoginStreak | null | undefined>(undefined);
  // dayId undangan otomatis terakhir — di ref (ditulis dari dalam efek), dan
  // `loaded` menahan keputusan sampai nilai tersimpannya terbaca.
  const shownDay = useRef<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [now, setNow] = useState(() => new Date());

  useLiveAll((uid) => [subscribeLoginStreak(uid, setLogin)]);

  useEffect(() => {
    AsyncStorage.getItem(GATE_SHOWN_KEY)
      .then((v) => {
        shownDay.current = v;
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!user || login === undefined || !loaded) return;
    const todayId = dayDocId(now);
    const atGate = pathname.startsWith(GATE_PATH);

    if (prayerGateDue(login, now)) {
      // Sudah diundang otomatis hari ini → selebihnya lunak: Today yang
      // mengundang, bukan pengawal ini.
      if (atGate || shownDay.current === todayId) return;
      shownDay.current = todayId;
      AsyncStorage.setItem(GATE_SHOWN_KEY, todayId).catch(() => {});
      // push, bukan replace: "Nanti dulu" cukup kembali ke layar sebelumnya.
      router.push(GATE_PATH);
      return;
    }

    // Sudah dikonfirmasi — di HP ini atau HP lain. Jangan biarkan gerbangnya
    // nyangkut.
    if (atGate && prayerDoneToday(login, now)) router.replace('/');
  }, [user, login, loaded, now, pathname, router]);

  return null;
}
