import { UpkeepList, type UpkeepGroup } from '@/components/common/UpkeepList';
import { useAuth } from '@/contexts/auth';
import {
  countCarAttention,
  PART_GROUPS,
  partCondition,
  setPartDate,
  setPartDueNow,
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
export function PartsTab({
  status,
  focusDue,
}: {
  status: PartStatusMap;
  /** Tab Parts ditekan 2× → lompat ke bagian yang jatuh tempo. */
  focusDue?: boolean;
}) {
  const { user } = useAuth();

  const now = new Date();

  // Hitung berapa part yang perlu perhatian (untuk ringkasan atas) — sama
  // dengan angka badge di Home.
  const allParts = PART_GROUPS.flatMap((g) => g.parts);
  const needsAttention = countCarAttention(status, now);
  const unknownCount = allParts.filter((p) => !status[p.key]).length;

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
      summary={{
        label: 'Kondisi perawatan',
        value:
          needsAttention === 0
            ? 'Semua terkendali 🙌'
            : `${needsAttention} bagian perlu perhatian ⚠️`,
        sub:
          unknownCount > 0
            ? `${unknownCount} bagian belum pernah dicatat.`
            : 'Click bagian mana pun untuk memperbarui tanggalnya.',
      }}
      groups={groups}
      dialogHint="Kapan terakhir diganti / dicek?"
      focusDue={focusDue}
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
