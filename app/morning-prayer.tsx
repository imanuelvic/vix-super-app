import { Redirect, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import { MorningPrayerGate } from '@/components/spiritual/MorningPrayerGate';
import { useAuth } from '@/contexts/auth';
import { useNow } from '@/hooks/useNow';
import {
  markPrayerHandled,
  prayerGateDue,
  prayerMinutesLeft,
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
import { intercessionToday } from '@/lib/intercession';
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

  // Jam BERJALAN (di-segarkan tiap menit), bukan `new Date()` sekali render —
  // dipakai untuk hitung mundur ke jam 09.00 & untuk keluar sendiri saat
  // jendelanya habis.
  const { now, todayId } = useNow();

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
    // Tandai LOKAL dulu, sebelum pindah halaman. Inilah yang menghilangkan bug
    // "harus konfirmasi 2×": tulisan ke Firestore butuh sesaat untuk kembali
    // sebagai snapshot, dan tanpa penanda ini Home masih membaca data lama lalu
    // melempar balik ke gerbang. Tulisannya sendiri tetap fire-and-forget
    // supaya tidak menggantung saat sinyal jelek.
    markPrayerHandled(new Date());
    if (user) {
      recordDailyPrayer(user.uid, login, new Date()).catch(() => {});
    }
    router.replace('/');
  }

  function handleSkip() {
    // Keadaan mendesak: streak hangus tapi hari ini ditandai selesai supaya
    // gerbang tidak muncul lagi hari ini, lalu langsung ke Home.
    markPrayerHandled(new Date());
    if (user) {
      skipDailyPrayer(user.uid, login, new Date()).catch(() => {});
    }
    router.replace('/');
  }

  // CEK LANGSUNG tiap kali layar ini digambar: kalau doa hari ini ternyata
  // sudah dikonfirmasi — di HP ini maupun HP lain — atau jam 09.00 sudah
  // lewat, gerbangnya tidak ditampilkan sama sekali. Karena `login` datang
  // dari langganan Firestore yang hidup, konfirmasi di HP A menutup layar ini
  // di HP B dalam hitungan detik, tanpa disentuh.
  if (!prayerGateDue(login, now)) {
    return <Redirect href="/" />;
  }

  return (
    <MorningPrayerGate
      streakCount={login?.count ?? 0}
      reviveDone={reviveDone}
      chainDue={chainDue}
      chainLeft={chainLeft}
      topic={intercessionToday(now)}
      minutesLeft={prayerMinutesLeft(now)}
      onConfirm={handleConfirm}
      onOpenRevive={() => router.push('/revive')}
      onOpenChain={() =>
        router.push({ pathname: '/core', params: { tab: 'followup' } })
      }
      onSkip={handleSkip}
    />
  );
}
