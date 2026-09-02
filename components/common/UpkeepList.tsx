import { Fragment, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { CARD } from '@/assets/style/card';
import { Color } from '@/assets/style/color';
import { AttentionMark } from '@/components/common/Badge';
import { CenterDialog } from '@/components/common/CenterDialog';
import { DateField } from '@/components/common/DateField';
import { DeadlineTag, deadlineBorder } from '@/components/common/Deadline';
import { DualButtons } from '@/components/common/DualButtons';
import { FormError } from '@/components/common/FormError';
import { FormInput } from '@/components/common/FormInput';
import { PressableScale } from '@/components/common/PressableScale';
import { SummaryCard } from '@/components/common/SummaryCard';
import { VixText } from '@/components/common/VixText';
import { useDueJump } from '@/hooks/useDueJump';
import { deadlineDue, type DeadlineTone } from '@/lib/deadline';
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
  dueNowOf,
  onDueNow,
}: {
  /** Kartu ringkasan paling atas. */
  summary: { label: string; value: string; sub: string };
  groups: UpkeepGroup[];
  /** Kalimat di dalam dialog, mis. "Kapan terakhir diganti / dicek?". */
  dialogHint: string;
  /** Catatan tersimpan untuk baris ini — muncul lagi saat dialog dibuka. */
  noteOf: (key: string) => string;
  onSave: (key: string, date: Date, note: string) => Promise<void>;
  /** Baris ini sedang bertanda "harus dikerjakan sekarang"? */
  dueNowOf: (key: string) => boolean;
  /**
   * Pasang / lepas tanda "harus dikerjakan sekarang" — jalan pintas untuk
   * barang yang jelas sudah waktunya tapi tanggal terakhirnya tidak diketahui.
   * Mengarang tanggal cuma bikin jadwal berikutnya ikut salah.
   */
  onDueNow: (key: string, dueNow: boolean) => Promise<void>;
}) {
  const [editing, setEditing] = useState<UpkeepRow | null>(null);
  const [fDate, setFDate] = useState(new Date());
  const [fNote, setFNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Baris jatuh tempo PERTAMA menurut urutan tampilnya — sama isinya dengan
  // yang dihitung badge tab (🔴 sekarang / 🟡 besok).
  const firstDue =
    groups.flatMap((g) => g.rows).find((r) => deadlineDue(r.tone)) ?? null;
  const { ref, setRowY, onContentSizeChange } = useDueJump(firstDue?.key ?? null);

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

  /** Pasang / lepas tanda "sekarang" lalu tutup dialognya. */
  async function handleDueNow() {
    if (!editing || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onDueNow(editing.key, !dueNowOf(editing.key));
      setEditing(null);
    } catch {
      setError(SAVE_ERROR);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.flex}>
      <ScrollView
        ref={ref}
        contentContainerStyle={styles.content}
        onContentSizeChange={onContentSizeChange}>
        <SummaryCard
          label={summary.label}
          value={summary.value}
          sub={summary.sub}
        />

        {/* Judul kelompok & barisnya sengaja jadi SAUDARA (Fragment, bukan View
            pembungkus): posisi onLayout tiap baris jadi langsung relatif ke isi
            ScrollView, sehingga lompatan ke baris jatuh tempo tidak perlu
            menjumlah offset kelompok. Tata letaknya sama persis — View
            pembungkusnya memang tanpa gaya. */}
        {groups.map((group) => (
          <Fragment key={group.key}>
            <VixText heading="title" additionalStyle={styles.groupTitle}>
              {group.label}
            </VixText>
            {group.rows.map((row) => (
              // Click = tandai baru dikerjakan (atau pilih tanggalnya).
              <PressableScale
                key={row.key}
                style={[styles.row, deadlineBorder(row.tone)]}
                onLayout={(e) => setRowY(row.key, e.nativeEvent.layout.y)}
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
                {/* Baris JATUH TEMPO = yang dihitung badge merah tab & tile
                    Home. Titik berdenyut di pojoknya menjawab "yang mana?"
                    tanpa perlu membaca seluruh daftar dulu. Ambangnya persis
                    sama dengan yang dipakai badge-nya (deadlineDue). */}
                {deadlineDue(row.tone) && (
                  <AttentionMark corner />
                )}
                <VixText heading="label">{row.tip}</VixText>
                <VixText heading="label" additionalStyle={styles.dateLine}>
                  {row.dateLine}
                </VixText>
              </PressableScale>
            ))}
          </Fragment>
        ))}
      </ScrollView>

      {/* Dialog tandai tanggal terakhir dikerjakan */}
      <CenterDialog visible={!!editing} onClose={() => setEditing(null)}>
        {/* Judul di kiri, jalan pintas "🔴 Sekarang" di KANAN ATAS. Tombol itu
            untuk barang yang jelas sudah waktunya tapi tanggal terakhirnya
            tidak diketahui — barisnya langsung merah tanpa tulisan "Terakhir:"
            sama sekali. Tekan lagi untuk melepas tandanya. */}
        <View style={styles.modalHead}>
          <VixText heading="title" additionalStyle={styles.modalTitle}>
            {editing?.label}
          </VixText>
          <PressableScale
            style={[
              styles.dueNowChip,
              editing && dueNowOf(editing.key) && styles.dueNowChipOn,
            ]}
            disabled={busy}
            haptic="warning"
            onPress={handleDueNow}>
            <VixText heading="label" additionalStyle={styles.dueNowText}>
              {editing && dueNowOf(editing.key)
                ? '↩️ Batalkan'
                : '🔴 Sekarang'}
            </VixText>
          </PressableScale>
        </View>
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
    ...CARD,
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
  // Judul + tombol "sekarang" sebaris; judul boleh memanjang, tombol tetap
  // menempel di kanan atas.
  modalHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
  },
  modalTitle: { flex: 1, marginBottom: 2 },
  dueNowChip: {
    backgroundColor: Color.CONTRAST_CONTAINER,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Color.BORDER,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  // Sedang bertanda → chip-nya ikut merah samar, jadi keadaannya kebaca
  // sebelum tombolnya dibaca.
  dueNowChipOn: {
    backgroundColor: Color.DANGER_TRANSPARENT,
    borderColor: Color.DANGER,
  },
  dueNowText: { color: Color.TEXT_TITLE },
  modalHint: { marginBottom: 10 },
  noteInput: { marginTop: 10, minHeight: 76, textAlignVertical: 'top' },
});
