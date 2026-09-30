import { OdometerCard } from '@/components/car/OdometerCard';
import { UpkeepList, type UpkeepGroup } from '@/components/common/UpkeepList';
import { useAuth } from '@/contexts/auth';
import {
  PART_GROUPS,
  partCondition,
  setPartDate,
  setPartDueNow,
  type CarOdometer,
  type PartStatusMap,
  type PartTone,
} from '@/lib/car';
import { formatDate } from '@/lib/format';

const TONE_LABEL: Record<PartTone, string> = {
  ok: '✅ Aman',
  warn: '⚠️ Besok', // tinggal sehari lagi
  over: '🔴 Sekarang', // hari-H atau sudah lewat
  unknown: '❓ Belum dicatat',
};

// Tab Parts: checklist perawatan berkala seluruh bagian mobil — mesin,
// kaki-kaki, interior, eksterior, surat. Tandai kapan terakhir diganti/dicek,
// lalu app menghitung kapan waktunya lagi.
//
// Tampilan & dialognya milik bersama <UpkeepList> (dipakai juga Residence →
// Maintenance); di sini tinggal merakit barisnya dari data mobil.
//
// Kartu paling atasnya KILOMETER (30 Sep 2026), bukan lagi ringkasan "N bagian
// perlu perhatian" — alasan lengkapnya di components/car/OdometerCard.tsx.
export function PartsTab({
  status,
  odometer,
}: {
  status: PartStatusMap;
  odometer: CarOdometer | null;
}) {
  const { user } = useAuth();

  const now = new Date();

  const groups: UpkeepGroup[] = PART_GROUPS.map((group) => ({
    key: group.key,
    label: group.label,
    rows: group.parts.map((part) => {
      const dueNow = status[part.key]?.dueNow === true;
      const { tone, dueDate } = partCondition(
        status[part.key]?.last,
        part.intervalMonths,
        now,
        dueNow,
      );
      const last = status[part.key]?.last;
      return {
        key: part.key,
        label: part.label,
        tip: part.tip,
        tone,
        toneLabel: TONE_LABEL[tone],
        // Ditandai manual → TIDAK ada tulisan "Terakhir: …" sama sekali;
        // tanggalnya memang tidak diketahui, dan menuliskannya cuma bohong.
        dateLine: dueNow
          ? `Ditandai harus diservis · biasanya tiap ${part.intervalMonths} bulan`
          : last
            ? `Terakhir: ${formatDate(last.toDate())} · berikutnya ±${dueDate ? formatDate(dueDate) : '-'}`
            : `Interval: tiap ${part.intervalMonths} bulan`,
      };
    }),
  }));

  return (
    <UpkeepList
      summary={<OdometerCard odometer={odometer} />}
      groups={groups}
      dialogHint="Kapan terakhir diganti / dicek?"
      noteOf={(key) => status[key]?.note ?? ''}
      dueNowOf={(key) => status[key]?.dueNow === true}
      // `user` selalu ada di sini (layar Car cuma terbuka setelah login);
      // penjagaan ini cuma supaya tidak pernah menulis tanpa pemilik.
      onSave={async (key, date, note) => {
        if (!user) return;
        await setPartDate(user.uid, key, date, note);
      }}
      onDueNow={async (key, dueNow) => {
        if (!user) return;
        await setPartDueNow(user.uid, key, dueNow);
      }}
    />
  );
}
