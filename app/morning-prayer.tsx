import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import { MorningPrayerGate } from '@/components/spiritual/MorningPrayerGate';
import { useAuth } from '@/contexts/auth';
import {
  recordDailyPrayer,
  subscribeLoginStreak,
  type LoginStreak,
} from '@/lib/achievements';
import { dayDocId } from '@/lib/health';
import { subscribeReviveStreak } from '@/lib/spiritual';

// Lock screen doa pagi — halaman PENUH di root stack (di luar tab), jadi
// menutupi seluruh layar termasuk tab bar. Home mengarahkan ke sini kalau
// doa hari ini (batas jam 4) belum dikonfirmasi.
export default function MorningPrayerScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [login, setLogin] = useState<LoginStreak | null>(null);
  const [reviveStreak, setReviveStreak] = useState<LoginStreak | null>(null);

  useEffect(() => {
    if (!user) return;
    const unsubs = [
      subscribeLoginStreak(user.uid, setLogin),
      subscribeReviveStreak(user.uid, setReviveStreak),
    ];
    return () => unsubs.forEach((unsub) => unsub());
  }, [user]);

  // Sudah Revive hari ini? (streak Revive terupdate saat jurnal hari ini
  // disimpan) → gate mencentang langkah Revive otomatis.
  const reviveDone = reviveStreak?.lastDayId === dayDocId(new Date());

  async function handleConfirm() {
    // Fire-and-forget: jangan tunggu server (biar tidak hang saat offline);
    // cache lokal langsung terupdate sehingga Home tak mengarahkan balik.
    if (user) {
      recordDailyPrayer(user.uid, login, new Date()).catch(() => {});
    }
    router.replace('/');
  }

  return (
    <MorningPrayerGate
      streakCount={login?.count ?? 0}
      reviveDone={reviveDone}
      onConfirm={handleConfirm}
      onOpenRevive={() => router.push('/revive')}
    />
  );
}
