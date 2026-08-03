import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { Chip } from '@/components/common/Chip';
import { DateField } from '@/components/common/DateField';
import { DualButtons } from '@/components/common/DualButtons';
import { FormInput } from '@/components/common/FormInput';
import { InlineDelete } from '@/components/common/InlineDelete';
import { PressableScale } from '@/components/common/PressableScale';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { SheetModal } from '@/components/common/SheetModal';
import { SummaryCard } from '@/components/common/SummaryCard';
import { VixText } from '@/components/common/VixText';
import { useAuth } from '@/contexts/auth';
import { formatDate, groupDigits, parseAmount } from '@/lib/format';
import {
  addResidenceLog,
  deleteResidenceLog,
  RESIDENCE_LOG_TYPES,
  updateResidenceLog,
  type ResidenceLog,
  type ResidenceLogType,
} from '@/lib/residence';
import { formatRupiah } from '@/lib/transactions';

const TYPE_META = Object.fromEntries(
  RESIDENCE_LOG_TYPES.map((t) => [t.key, t]),
) as Record<ResidenceLogType, (typeof RESIDENCE_LOG_TYPES)[number]>;

// Tab Log 🧾 — pengeluaran rumah selain listrik/air (iuran lingkungan, water
// heater, wifi, cleaning, dll). Air & listrik direkap terpisah & read-only di
// tab Air-Listrik (ResidenceUtilityTab), dibaca dari transaksi Finance.
export function ResidenceLogTab({ items }: { items: ResidenceLog[] }) {
  const { user } = useAuth();

  const types = RESIDENCE_LOG_TYPES.filter((t) => t.group === 'log');
  const typeKeys = types.map((t) => t.key);
  const logs = items.filter((l) => typeKeys.includes(l.type));

  const [editing, setEditing] = useState<ResidenceLog | 'new' | null>(null);
  const [fType, setFType] = useState<ResidenceLogType>(types[0].key);
  const [fTitle, setFTitle] = useState('');
  const [fNote, setFNote] = useState('');
  const [fCost, setFCost] = useState('');
  const [fDate, setFDate] = useState(new Date());
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const now = new Date();
  const summary = useMemo(() => {
    const monthTotal = logs
      .filter((l) => {
        const d = l.date.toDate();
        return (
          d.getFullYear() === now.getFullYear() &&
          d.getMonth() === now.getMonth()
        );
      })
      .reduce((sum, l) => sum + l.cost, 0);
    return { monthTotal };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logs]);

  function openAdd() {
    setEditing('new');
    setFType(types[0].key);
    setFTitle('');
    setFNote('');
    setFCost('');
    setFDate(new Date());
    setFormError(null);
  }

  function openEdit(item: ResidenceLog) {
    setEditing(item);
    setFType(item.type);
    setFTitle(item.title);
    setFNote(item.note);
    setFCost(item.cost > 0 ? groupDigits(String(item.cost)) : '');
    setFDate(item.date.toDate());
    setFormError(null);
  }

  async function handleSave() {
    if (!user || !editing || busy) return;
    if (!fTitle.trim()) {
      setFormError('Keterangannya diisi dulu ya.');
      return;
    }
    setBusy(true);
    setFormError(null);
    const data = {
      type: fType,
      title: fTitle.trim(),
      note: fNote.trim(),
      cost: parseAmount(fCost),
      date: fDate,
    };
    try {
      if (editing === 'new') {
        await addResidenceLog(user.uid, data);
      } else {
        await updateResidenceLog(user.uid, editing.id, data);
      }
      setEditing(null);
    } catch {
      setFormError('Gagal menyimpan. Cek koneksi internet.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!user || !editing || editing === 'new' || busy) return;
    setBusy(true);
    try {
      await deleteResidenceLog(user.uid, editing.id);
    } finally {
      setEditing(null);
      setBusy(false);
    }
  }

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Ringkasan Log: total pengeluaran rumah (selain air/listrik) bulan ini */}
        <SummaryCard
          label="Pengeluaran rumah bulan ini"
          value={formatRupiah(summary.monthTotal)}
        />

        <PrimaryButton
          label="Catat Pengeluaran"
          icon="plus"
          onPress={openAdd}
          additionalStyle={styles.addButton}
        />

        {logs.length === 0 && (
          <VixText heading="label" additionalStyle={styles.empty}>
            Belum ada catatan. Catat pengeluaran rumah pertamamu 🏠
          </VixText>
        )}

        {logs.map((item) => {
          const meta = TYPE_META[item.type];
          return (
            <PressableScale
              key={item.id}
              style={styles.row}
              onPress={() => openEdit(item)}>
              <View style={styles.rowLeft}>
                <VixText heading="bold" additionalStyle={styles.rowTitle}>
                  {meta.icon} {item.title}
                </VixText>
                <VixText heading="label">
                  {meta.label}
                  {item.note ? ` · ${item.note}` : ''}
                </VixText>
                <VixText heading="label">{formatDate(item.date.toDate())}</VixText>
              </View>
              <VixText heading="bold" additionalStyle={styles.rowCost}>
                {formatRupiah(item.cost)}
              </VixText>
            </PressableScale>
          );
        })}
      </ScrollView>

      <SheetModal
        visible={!!editing}
        title={editing === 'new' ? 'Catat Pengeluaran' : 'Edit Catatan'}
        onClose={() => setEditing(null)}>
        <View style={styles.chipRow}>
          {types.map((t) => (
            <Chip
              key={t.key}
              label={`${t.icon} ${t.label}`}
              active={fType === t.key}
              onPress={() => setFType(t.key)}
            />
          ))}
        </View>
        <FormInput
          style={styles.formGap}
          placeholder="Keterangan"
          value={fTitle}
          onChangeText={setFTitle}
          editable={!busy}
        />
        <FormInput
          style={styles.formGap}
          placeholder="Catatan (opsional)"
          value={fNote}
          onChangeText={setFNote}
          editable={!busy}
        />
        <FormInput
          style={styles.formGap}
          placeholder="Nominal (Rp)"
          keyboardType="number-pad"
          value={fCost}
          onChangeText={(t) => setFCost(groupDigits(t))}
          editable={!busy}
        />
        <View style={styles.formGap}>
          <DateField
            key={editing === 'new' ? 'new' : editing?.id}
            value={fDate}
            onChange={setFDate}
          />
        </View>
        {formError && (
          <VixText heading="label" additionalStyle={styles.error}>
            {formError}
          </VixText>
        )}
        {editing !== 'new' && editing !== null && (
          <InlineDelete
            key={editing.id}
            label="Hapus catatan ini"
            busy={busy}
            onDelete={handleDelete}
          />
        )}
        <DualButtons
          confirmLabel="Simpan"
          busy={busy}
          onCancel={() => setEditing(null)}
          onConfirm={handleSave}
        />
      </SheetModal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 },
  addButton: { marginBottom: 12 },
  empty: { textAlign: 'center', marginVertical: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    backgroundColor: Color.CONTAINER,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Color.BORDER,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
  },
  rowLeft: { flex: 1, gap: 2 },
  rowTitle: { color: Color.TEXT_TITLE },
  rowCost: { color: Color.MAIN_DARK },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  formGap: { marginBottom: 10 },
  error: { color: Color.DANGER, marginBottom: 8 },
});
