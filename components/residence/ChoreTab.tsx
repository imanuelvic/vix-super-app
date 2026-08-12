import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { CenterDialog } from '@/components/common/CenterDialog';
import { DateField } from '@/components/common/DateField';
import { DualButtons } from '@/components/common/DualButtons';
import { PressableScale } from '@/components/common/PressableScale';
import { SummaryCard } from '@/components/common/SummaryCard';
import { VixText } from '@/components/common/VixText';
import { useAuth } from '@/contexts/auth';
import { formatDate } from '@/lib/format';
import { SAVE_ERROR } from '@/lib/messages';
import {
  choreCondition,
  choreIntervalLabel,
  CHORE_GROUPS,
  countResidenceAttention,
  setChoreDate,
  type ChoreStatusMap,
  type ChoreTone,
  type ResidenceChore,
} from '@/lib/residence';

const TONE_LABEL: Record<ChoreTone, string> = {
  ok: '✅ Bersih',
  warn: '⚠️ Segera',
  over: '🔴 Lewat jadwal',
  unknown: '❓ Belum dicatat',
};

// Tab Perawatan: checklist bersih-bersih rumah berkala per kategori frekuensi
// (mingguan → kuartalan). Tandai kapan terakhir dikerjakan, app hitung kapan
// waktunya lagi. Mirip Sparepart di Car.
export function ChoreTab({ status }: { status: ChoreStatusMap }) {
  const { user } = useAuth();

  const [editing, setEditing] = useState<ResidenceChore | null>(null);
  const [fDate, setFDate] = useState(new Date());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const now = new Date();

  const allChores = CHORE_GROUPS.flatMap((g) => g.parts);
  const needsAttention = countResidenceAttention(status, now);
  const unknownCount = allChores.filter((p) => !status[p.key]).length;

  function openEdit(chore: ResidenceChore) {
    setEditing(chore);
    setFDate(new Date());
    setError(null);
  }

  async function handleSave() {
    if (!user || !editing || busy) return;
    setBusy(true);
    setError(null);
    try {
      await setChoreDate(user.uid, editing.key, fDate);
      setEditing(null);
    } catch {
      setError(SAVE_ERROR);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Ringkasan kondisi kebersihan */}
        <SummaryCard
          label="Kebersihan rumah"
          value={
            needsAttention === 0
              ? 'Semua bersih 🙌'
              : `${needsAttention} perlu dibersihkan ⚠️`
          }
          sub={
            unknownCount > 0
              ? `${unknownCount} item belum pernah dicatat — tap untuk mengisi.`
              : 'Tap item mana pun untuk memperbarui tanggalnya.'
          }
        />

        {CHORE_GROUPS.map((group) => (
          <View key={group.key}>
            <VixText heading="title" additionalStyle={styles.groupTitle}>
              {group.label}
            </VixText>
            {group.parts.map((chore) => {
              const { tone, dueDate } = choreCondition(
                status[chore.key]?.last,
                chore.intervalDays,
                now,
              );
              const last = status[chore.key]?.last;
              return (
                // Tap = tandai baru dibersihkan hari ini (atau pilih tanggal).
                <PressableScale
                  key={chore.key}
                  style={[
                    styles.row,
                    tone === 'ok' && styles.rowOk,
                    tone === 'warn' && styles.rowWarn,
                    tone === 'over' && styles.rowOver,
                  ]}
                  onPress={() => openEdit(chore)}>
                  <View style={styles.rowTop}>
                    <VixText
                      heading="bold"
                      numberOfLines={1}
                      additionalStyle={styles.rowLabel}>
                      {chore.label}
                    </VixText>
                    <VixText
                      heading="label"
                      additionalStyle={
                        tone === 'ok'
                          ? styles.toneOk
                          : tone === 'warn'
                            ? styles.toneWarn
                            : tone === 'over'
                              ? styles.toneOver
                              : styles.toneUnknown
                      }>
                      {TONE_LABEL[tone]}
                    </VixText>
                  </View>
                  <VixText heading="label">{chore.tip}</VixText>
                  <VixText heading="label" additionalStyle={styles.dateLine}>
                    {last
                      ? `Terakhir: ${formatDate(last.toDate())} · berikutnya ±${dueDate ? formatDate(dueDate) : '-'}`
                      : `Interval: tiap ${choreIntervalLabel(chore.intervalDays)}`}
                  </VixText>
                </PressableScale>
              );
            })}
          </View>
        ))}
      </ScrollView>

      {/* Dialog tandai tanggal terakhir dibersihkan */}
      <CenterDialog visible={!!editing} onClose={() => setEditing(null)}>
        <VixText heading="title" additionalStyle={styles.modalTitle}>
          {editing?.label}
        </VixText>
        <VixText heading="label" additionalStyle={styles.modalHint}>
          Kapan terakhir dibersihkan / dikerjakan?
        </VixText>
        {/* key = chore supaya state picker internal reset tiap ganti item */}
        <DateField key={editing?.key} value={fDate} onChange={setFDate} />
        {error && (
          <VixText heading="label" additionalStyle={styles.error}>
            {error}
          </VixText>
        )}
        <DualButtons
          confirmLabel="Simpan"
          busy={busy}
          onCancel={() => setEditing(null)}
          onConfirm={handleSave}
        />
      </CenterDialog>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 },
  groupTitle: { marginTop: 14, marginBottom: 8 },
  row: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Color.BORDER,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
    gap: 4,
  },
  // Border warna status: hijau bersih / kuning segera / merah lewat jadwal.
  rowOk: { borderColor: Color.SUCCESS, borderWidth: 1.5 },
  rowWarn: { borderColor: Color.BUDGET_WARN, borderWidth: 1.5 },
  rowOver: { borderColor: Color.DANGER, borderWidth: 1.5 },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  rowLabel: { flex: 1, color: Color.TEXT_TITLE },
  toneOk: { color: Color.SUCCESS },
  toneWarn: { color: Color.WARNING },
  toneOver: { color: Color.DANGER },
  toneUnknown: { color: Color.TEXT_PLACEHOLDER },
  dateLine: { color: Color.TEXT_PLACEHOLDER },
  modalTitle: { marginBottom: 2 },
  modalHint: { marginBottom: 10 },
  error: { color: Color.DANGER, marginTop: 8 },
});
