import { useRouter } from 'expo-router';

import { Color } from '@/assets/style/color';
import { ReminderCard } from '@/components/common/ReminderCard';
import { useFinanceStatus } from '@/hooks/useFinanceStatus';

// 💰 Kartu Finance di Semua Pengingat: keadaan hari ini TANPA nominal.
//
// Finance dikunci PIN dan punya tombol 👁 sembunyikan angka, jadi yang boleh
// tampil di luar gerbang cuma statusnya: "masih sesuai rencana", "Food
// mendekati batas", "Gojek 2× lagi minggu ini", "belum ada transaksi tercatat
// hari ini". Angkanya menunggu di dalam (click → Finance → PIN).
//
// Hitungan & langganannya di hooks/useFinanceStatus (dipakai juga Today
// Engine), jadi kartu ini tinggal menggambar.
export function FinanceStatusCard({ now }: { now: Date }) {
  const router = useRouter();
  const teks = useFinanceStatus(now);
  if (!teks) return null;
  return (
    <ReminderCard
      bg={Color.FINANCE}
      fg={Color.FINANCE_DARK}
      title={`💰 Finance hari ini ${teks.emoji}`}
      texts={teks.lines}
      onPress={() => router.push('/finance')}
      corner="→"
    />
  );
}
