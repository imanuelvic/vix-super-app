import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { CenterDialog } from '@/components/common/CenterDialog';
import { DateField } from '@/components/common/DateField';
import { DualButtons } from '@/components/common/DualButtons';
import { FormInput } from '@/components/common/FormInput';
import { PressableScale } from '@/components/common/PressableScale';
import { SummaryCard } from '@/components/common/SummaryCard';
import { VixText } from '@/components/common/VixText';
import { useAuth } from '@/contexts/auth';
import {
  countCarAttention,
  PART_GROUPS,
  partCondition,
  setPartDate,
  type CarPart,
  type PartStatusMap,
  type PartTone,
} from '@/lib/car';
import { formatDate } from '@/lib/format';
import { SAVE_ERROR } from '@/lib/messages';

const TONE_LABEL: Record<PartTone, string> = {
  ok: '✅ Aman',
  warn: '⚠️ Besok', // tinggal sehari lagi
  over: '🔴 Sekarang', // hari-H atau sudah lewat
  unknown: '❓ Belum dicatat',
};

// Tab Sparepart: checklist perawatan berkala seluruh bagian mobil —
// mesin, kaki-kaki, interior, eksterior, surat. Tandai kapan terakhir
// diganti/dicek, lalu app menghitung kapan waktunya lagi.
export function PartsTab({ status }: { status: PartStatusMap }) {
  const { user } = useAuth();

  const [editing, setEditing] = useState<CarPart | null>(null);
  const [fDate, setFDate] = useState(new Date());
  const [fNote, setFNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const now = new Date();

  // Hitung berapa part yang perlu perhatian (untuk ringkasan atas) — sama
  // dengan angka badge di Home.
  const allParts = PART_GROUPS.flatMap((g) => g.parts);
  const needsAttention = countCarAttention(status, now);
  const unknownCount = allParts.filter((p) => !status[p.key]).length;

  function openEdit(part: CarPart) {
    setEditing(part);
    setFDate(new Date());
    // Catatan terakhir untuk part ini muncul lagi — biar tak lupa.
    setFNote(status[part.key]?.note ?? '');
    setError(null);
  }

  async function handleSave() {
    if (!user || !editing || busy) return;
    setBusy(true);
    setError(null);
    try {
      await setPartDate(user.uid, editing.key, fDate, fNote.trim());
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
        {/* Ringkasan kondisi */}
        <SummaryCard
          label="Kondisi perawatan"
          value={
            needsAttention === 0
              ? 'Semua terkendali 🙌'
              : `${needsAttention} bagian perlu perhatian ⚠️`
          }
          sub={
            unknownCount > 0
              ? `${unknownCount} bagian belum pernah dicatat — tap untuk mengisi.`
              : 'Tap bagian mana pun untuk memperbarui tanggalnya.'
          }
        />

        {PART_GROUPS.map((group) => (
          <View key={group.key}>
            <VixText heading="title" additionalStyle={styles.groupTitle}>
              {group.label}
            </VixText>
            {group.parts.map((part) => {
              const { tone, dueDate } = partCondition(
                status[part.key]?.last,
                part.intervalMonths,
                now,
              );
              const last = status[part.key]?.last;
              return (
                // Tap = tandai baru diganti/dicek.
                <PressableScale
                  key={part.key}
                  style={[
                    styles.row,
                    tone === 'ok' && styles.rowOk,
                    tone === 'warn' && styles.rowWarn,
                    tone === 'over' && styles.rowOver,
                  ]}
                  onPress={() => openEdit(part)}>
                  <View style={styles.rowTop}>
                    <VixText
                      heading="bold"
                      numberOfLines={1}
                      additionalStyle={styles.rowLabel}>
                      {part.label}
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
                  <VixText heading="label">{part.tip}</VixText>
                  <VixText heading="label" additionalStyle={styles.dateLine}>
                    {last
                      ? `Terakhir: ${formatDate(last.toDate())} · berikutnya ±${dueDate ? formatDate(dueDate) : '-'}`
                      : `Interval: tiap ${part.intervalMonths} bulan`}
                  </VixText>
                </PressableScale>
              );
            })}
          </View>
        ))}
      </ScrollView>

      {/* Dialog tandai tanggal terakhir diganti/dicek */}
      <CenterDialog visible={!!editing} onClose={() => setEditing(null)}>
        <VixText heading="title" additionalStyle={styles.modalTitle}>
          {editing?.label}
        </VixText>
        <VixText heading="label" additionalStyle={styles.modalHint}>
          Kapan terakhir diganti / dicek?
        </VixText>
        {/* key = part supaya state picker internal reset tiap ganti part */}
        <DateField key={editing?.key} value={fDate} onChange={setFDate} />
        {/* Catatan pribadi — hanya terlihat di modal ini, tidak di daftar. */}
        <FormInput
          placeholder="Catatan (bengkel, merek, harga…)"
          value={fNote}
          onChangeText={setFNote}
          editable={!busy}
          multiline
          style={styles.noteInput}
        />
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
  // Border warna status: hijau aman / kuning segera / merah lewat jadwal.
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
  noteInput: { marginTop: 10, minHeight: 76, textAlignVertical: 'top' },
  error: { color: Color.DANGER, marginTop: 8 },
});
