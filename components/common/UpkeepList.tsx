import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { CenterDialog } from '@/components/common/CenterDialog';
import { DateField } from '@/components/common/DateField';
import { DeadlineTag, deadlineBorder } from '@/components/common/Deadline';
import { DualButtons } from '@/components/common/DualButtons';
import { FormError } from '@/components/common/FormError';
import { FormInput } from '@/components/common/FormInput';
import { PressableScale } from '@/components/common/PressableScale';
import { SummaryCard } from '@/components/common/SummaryCard';
import { VixText } from '@/components/common/VixText';
import { type DeadlineTone } from '@/lib/deadline';
import { SAVE_ERROR } from '@/lib/messages';

// Daftar perawatan berkala: barang dikelompokkan, tiap baris punya tenggat
// (🔴 sekarang / 🟡 besok / 🟢 aman / ❓ belum dicatat), dan menekannya membuka
// dialog "kapan terakhir dikerjakan?" + catatan.
//
// Dipakai bersama Car → Parts 🚗 dan Residence → Maintenance 🏠. Dulu keduanya
// file terpisah yang isinya nyaris sama persis (state, baris, dialog, sampai
// seluruh StyleSheet-nya) — jadi menambah satu kolom berarti mengubah dua
// tempat dan gampang jadi beda sendiri.
//
// Yang TIDAK di sini: dari mana datanya & rumus tenggatnya. Itu urusan tiap
// fitur (lib/car.ts & lib/residence.ts) — komponen ini cuma menampilkan baris
// yang sudah jadi dan mengembalikan tanggal yang kamu pilih.

/** Satu baris siap tampil — semua teksnya sudah dirakit oleh pemanggil. */
export type UpkeepRow = {
  key: string;
  label: string;
  tip: string;
  tone: DeadlineTone;
  /** Tulisan di ujung kanan, mis. "✅ Aman" / "🔴 Sekarang". */
  toneLabel: string;
  /** Baris abu-abu paling bawah: kapan terakhir & kapan berikutnya. */
  dateLine: string;
};

export type UpkeepGroup = { key: string; label: string; rows: UpkeepRow[] };

export function UpkeepList({
  summary,
  groups,
  dialogHint,
  noteOf,
  onSave,
}: {
  /** Kartu ringkasan paling atas. */
  summary: { label: string; value: string; sub: string };
  groups: UpkeepGroup[];
  /** Kalimat di dalam dialog, mis. "Kapan terakhir diganti / dicek?". */
  dialogHint: string;
  /** Catatan tersimpan untuk baris ini — muncul lagi saat dialog dibuka. */
  noteOf: (key: string) => string;
  onSave: (key: string, date: Date, note: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState<UpkeepRow | null>(null);
  const [fDate, setFDate] = useState(new Date());
  const [fNote, setFNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function openEdit(row: UpkeepRow) {
    setEditing(row);
    setFDate(new Date());
    setFNote(noteOf(row.key));
    setError(null);
  }

  async function handleSave() {
    if (!editing || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onSave(editing.key, fDate, fNote.trim());
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
        <SummaryCard
          label={summary.label}
          value={summary.value}
          sub={summary.sub}
        />

        {groups.map((group) => (
          <View key={group.key}>
            <VixText heading="title" additionalStyle={styles.groupTitle}>
              {group.label}
            </VixText>
            {group.rows.map((row) => (
              // Tap = tandai baru dikerjakan (atau pilih tanggalnya).
              <PressableScale
                key={row.key}
                style={[styles.row, deadlineBorder(row.tone)]}
                onPress={() => openEdit(row)}>
                <View style={styles.rowTop}>
                  <VixText
                    heading="bold"
                    numberOfLines={1}
                    additionalStyle={styles.rowLabel}>
                    {row.label}
                  </VixText>
                  <DeadlineTag tone={row.tone} label={row.toneLabel} />
                </View>
                <VixText heading="label">{row.tip}</VixText>
                <VixText heading="label" additionalStyle={styles.dateLine}>
                  {row.dateLine}
                </VixText>
              </PressableScale>
            ))}
          </View>
        ))}
      </ScrollView>

      {/* Dialog tandai tanggal terakhir dikerjakan */}
      <CenterDialog visible={!!editing} onClose={() => setEditing(null)}>
        <VixText heading="title" additionalStyle={styles.modalTitle}>
          {editing?.label}
        </VixText>
        <VixText heading="label" additionalStyle={styles.modalHint}>
          {dialogHint}
        </VixText>
        {/* key = baris supaya state picker internal reset tiap ganti barang */}
        <DateField key={editing?.key} value={fDate} onChange={setFDate} />
        {/* Catatan pribadi — hanya terlihat di dialog ini, tidak di daftar. */}
        <FormInput
          placeholder="Catatan"
          value={fNote}
          onChangeText={setFNote}
          editable={!busy}
          multiline
          style={styles.noteInput}
        />
        <FormError message={error} gap="top" />
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
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  rowLabel: { flex: 1, color: Color.TEXT_TITLE },
  dateLine: { color: Color.TEXT_PLACEHOLDER },
  modalTitle: { marginBottom: 2 },
  modalHint: { marginBottom: 10 },
  noteInput: { marginTop: 10, minHeight: 76, textAlignVertical: 'top' },
});
