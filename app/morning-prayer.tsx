import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import { MorningPrayerGate } from '@/components/spiritual/MorningPrayerGate';
import { useAuth } from '@/contexts/auth';
import {
  recordDailyPrayer,
  skipDailyPrayer,
  subscribeLoginStreak,
  type LoginStreak,
} from '@/lib/achievements';
import {
  EMPTY_MONTHLY_PRAYERS,
  isPrayerFollowupDay,
  monthlyPointsFor,
  prayerFollowupLeaders,
  subscribeCoreLeaders,
  subscribeMonthlyPrayers,
  type CoreLeader,
  type MonthlyPrayers,
} from '@/lib/core';
import { dayDocId } from '@/lib/health';
import { subscribeReviveStreak } from '@/lib/spiritual';

// Lock screen doa pagi — halaman PENUH di root stack (di luar tab), jadi
// menutupi seluruh layar termasuk tab bar. Yang mengarahkan ke sini adalah
// <MorningPrayerWatcher/> di app/_layout.tsx, jadi berlaku dari layar mana pun.
export default function MorningPrayerScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [login, setLogin] = useState<LoginStreak | null>(null);
  const [reviveStreak, setReviveStreak] = useState<LoginStreak | null>(null);
  const [leaders, setLeaders] = useState<CoreLeader[]>([]);
  const [monthlyPrayers, setMonthlyPrayers] = useState<MonthlyPrayers>(
    EMPTY_MONTHLY_PRAYERS,
  );

  useEffect(() => {
    if (!user) return;
    const unsubs = [
      subscribeLoginStreak(user.uid, setLogin),
      subscribeReviveStreak(user.uid, setReviveStreak),
      subscribeCoreLeaders(user.uid, setLeaders),
      subscribeMonthlyPrayers(user.uid, setMonthlyPrayers),
    ];
    return () => unsubs.forEach((unsub) => unsub());
  }, [user]);

  const now = new Date();
  const todayId = dayDocId(now);

  // Revive hari ini sudah disimpan → gate mencentang langkah Revive otomatis.
  const reviveDone = reviveStreak?.lastDayId === todayId;

  // Doa Rantai: hanya di hari jadwalnya (Sel/Kam/Sab) & kalau memang ada CL
  // giliran hari ini. Sumber hitungannya SAMA dengan kartu Dashboard.
  const chainLeaders = prayerFollowupLeaders(
    leaders,
    monthlyPointsFor(monthlyPrayers, now),
    now,
  );
  const chainDue = isPrayerFollowupDay(now) && chainLeaders.length > 0;
  const chainLeft = chainDue
    ? chainLeaders.filter((l) => monthlyPrayers.followedDayId[l.id] !== todayId)
        .length
    : 0;

  async function handleConfirm() {
    // Fire-and-forget: jangan tunggu server (biar tidak hang saat offline);
    // cache lokal langsung terupdate sehingga watcher tak mengarahkan balik.
    if (user) {
      recordDailyPrayer(user.uid, login, new Date()).catch(() => {});
    }
    router.replace('/');
  }

  function handleSkip() {
    // Keadaan mendesak: streak hangus tapi hari ini ditandai selesai supaya
    // lock screen tidak muncul lagi, lalu langsung ke Home. Fire-and-forget
    // biar tidak hang saat offline.
    if (user) {
      skipDailyPrayer(user.uid, login, new Date()).catch(() => {});
    }
    router.replace('/');
  }

  return (
    <MorningPrayerGate
      streakCount={login?.count ?? 0}
      reviveDone={reviveDone}
      chainDue={chainDue}
      chainLeft={chainLeft}
      onConfirm={handleConfirm}
      onOpenRevive={() => router.push('/revive')}
      onOpenChain={() =>
        router.push({ pathname: '/core', params: { tab: 'followup' } })
      }
      onSkip={handleSkip}
    />
  );
}
