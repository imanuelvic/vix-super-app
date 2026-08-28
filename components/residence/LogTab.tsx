import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Chip } from '@/components/common/Chip';
import { DateField } from '@/components/common/DateField';
import { DualButtons } from '@/components/common/DualButtons';
import { EditDelete } from '@/components/common/EditDelete';
import { FormError } from '@/components/common/FormError';
import { ExpenseRow } from '@/components/common/ExpenseRow';
import { FormInput } from '@/components/common/FormInput';
import { MoneyInput } from '@/components/common/MoneyInput';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { SheetModal } from '@/components/common/SheetModal';
import { SummaryCard } from '@/components/common/SummaryCard';
import { VixText } from '@/components/common/VixText';
import { useAuth } from '@/contexts/auth';
import { useFormSave } from '@/hooks/useFormSave';
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
// tab Air-Listrik (UtilityTab), dibaca dari transaksi Finance.
export function LogTab({ items }: { items: ResidenceLog[] }) {
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
  const { busy, setBusy, formError, setFormError, save } = useFormSave();

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
    const data = {
      type: fType,
      title: fTitle.trim(),
      note: fNote.trim(),
      cost: parseAmount(fCost),
      date: fDate,
    };
    await save(async () => {
      if (editing === 'new') {
        await addResidenceLog(user.uid, data);
      } else {
        await updateResidenceLog(user.uid, editing.id, data);
      }
      setEditing(null);
    });
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
            <ExpenseRow
              key={item.id}
              title={`${meta.icon} ${item.title}`}
              cost={item.cost}
              onPress={() => openEdit(item)}>
              <VixText heading="label">
                {meta.label}
                {item.note ? ` · ${item.note}` : ''}
              </VixText>
              <VixText heading="label">{formatDate(item.date.toDate())}</VixText>
            </ExpenseRow>
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
        <MoneyInput
          style={styles.formGap}
          placeholder="Nominal"
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
        <FormError message={formError} />
        <EditDelete
          editing={editing}
          label="Hapus catatan ini"
          busy={busy}
          onDelete={handleDelete}
        />
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
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  formGap: { marginBottom: 10 },
});
