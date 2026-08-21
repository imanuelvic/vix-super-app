import { UpkeepList, type UpkeepGroup } from '@/components/common/UpkeepList';
import { useAuth } from '@/contexts/auth';
import { formatDate } from '@/lib/format';
import {
  choreCondition,
  choreIntervalLabel,
  CHORE_GROUPS,
  countResidenceAttention,
  setChoreDate,
  type ChoreStatusMap,
  type ChoreTone,
} from '@/lib/residence';

const TONE_LABEL: Record<ChoreTone, string> = {
  ok: '✅ Bersih',
  warn: '⚠️ Besok', // rumah tidak memakai status ini (langsung hari-H)
  over: '🔴 Sekarang',
  unknown: '❓ Belum dicatat',
};

// Tab Maintenance: checklist bersih-bersih rumah berkala per kategori frekuensi
// (mingguan → kuartalan). Tandai kapan terakhir dikerjakan, app hitung kapan
// waktunya lagi.
//
// Tampilan & dialognya milik bersama <UpkeepList> — persis yang dipakai Car →
// Parts; di sini tinggal merakit barisnya dari data rumah.
export function ChoreTab({ status }: { status: ChoreStatusMap }) {
  const { user } = useAuth();

  const now = new Date();

  const allChores = CHORE_GROUPS.flatMap((g) => g.parts);
  const needsAttention = countResidenceAttention(status, now);
  const unknownCount = allChores.filter((p) => !status[p.key]).length;

  const groups: UpkeepGroup[] = CHORE_GROUPS.map((group) => ({
    key: group.key,
    label: group.label,
    rows: group.parts.map((chore) => {
      const { tone, dueDate } = choreCondition(
        status[chore.key]?.last,
        chore.intervalDays,
        now,
      );
      const last = status[chore.key]?.last;
      return {
        key: chore.key,
        label: chore.label,
        tip: chore.tip,
        tone,
        toneLabel: TONE_LABEL[tone],
        dateLine: last
          ? `Terakhir: ${formatDate(last.toDate())} · berikutnya ±${dueDate ? formatDate(dueDate) : '-'}`
          : `Interval: tiap ${choreIntervalLabel(chore.intervalDays)}`,
      };
    }),
  }));

  return (
    <UpkeepList
      summary={{
        label: 'Kebersihan rumah',
        value:
          needsAttention === 0
            ? 'Semua bersih 🙌'
            : `${needsAttention} perlu dibersihkan ⚠️`,
        sub:
          unknownCount > 0
            ? `${unknownCount} item belum pernah dicatat — tap untuk mengisi.`
            : 'Tap item mana pun untuk memperbarui tanggalnya.',
      }}
      groups={groups}
      dialogHint="Kapan terakhir dibersihkan / dikerjakan?"
      noteOf={(key) => status[key]?.note ?? ''}
      // `user` selalu ada di sini (layar Residence cuma terbuka setelah login).
      onSave={async (key, date, note) => {
        if (!user) return;
        await setChoreDate(user.uid, key, date, note);
      }}
    />
  );
}
