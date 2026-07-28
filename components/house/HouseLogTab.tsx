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
import { VixText } from '@/components/common/VixText';
import { useAuth } from '@/contexts/auth';
import { formatDate, groupDigits, parseAmount } from '@/lib/format';
import {
  addHouseLog,
  deleteHouseLog,
  HOUSE_LOG_TYPES,
  latestOfType,
  monthTotalByType,
  updateHouseLog,
  type HouseLog,
  type HouseLogType,
} from '@/lib/house';
import { formatRupiah } from '@/lib/transactions';

const TYPE_META = Object.fromEntries(
  HOUSE_LOG_TYPES.map((t) => [t.key, t]),
) as Record<HouseLogType, (typeof HOUSE_LOG_TYPES)[number]>;

// Satu komponen untuk dua tab: Air-Listrik (group 'utility') & Log (group
// 'log'). Bedanya hanya jenis yang boleh dipilih & ringkasan atasnya.
export function HouseLogTab({
  items,
  group,
}: {
  items: HouseLog[];
  group: 'utility' | 'log';
}) {
  const { user } = useAuth();

  const types = HOUSE_LOG_TYPES.filter((t) => t.group === group);
  const typeKeys = types.map((t) => t.key);
  const logs = items.filter((l) => typeKeys.includes(l.type));

  const [editing, setEditing] = useState<HouseLog | 'new' | null>(null);
  const [fType, setFType] = useState<HouseLogType>(types[0].key);
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

  function openEdit(item: HouseLog) {
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
        await addHouseLog(user.uid, data);
      } else {
        await updateHouseLog(user.uid, editing.id, data);
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
      await deleteHouseLog(user.uid, editing.id);
    } finally {
      setEditing(null);
      setBusy(false);
    }
  }

  const lastWater = latestOfType(items, 'water');
  const lastElectric = latestOfType(items, 'electric');

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={styles.content}>
        {group === 'utility' ? (
          /* Ringkasan Air-Listrik: total bulan ini per jenis + terakhir isi */
          <View style={styles.summaryCard}>
            <VixText heading="label" additionalStyle={styles.summaryLabel}>
              Pemakaian bulan ini
            </VixText>
            <View style={styles.utilRow}>
              <VixText heading="bold" additionalStyle={styles.utilText}>
                💧 Air PAM
              </VixText>
              <VixText heading="bold" additionalStyle={styles.utilText}>
                {formatRupiah(monthTotalByType(items, 'water', now))}
              </VixText>
            </View>
            <View style={styles.utilRow}>
              <VixText heading="bold" additionalStyle={styles.utilText}>
                ⚡ Listrik (token)
              </VixText>
              <VixText heading="bold" additionalStyle={styles.utilText}>
                {formatRupiah(monthTotalByType(items, 'electric', now))}
              </VixText>
            </View>
          </View>
        ) : (
          /* Ringkasan Log: total pengeluaran rumah lain bulan ini */
          <View style={styles.summaryCard}>
            <VixText heading="label" additionalStyle={styles.summaryLabel}>
              Pengeluaran rumah bulan ini
            </VixText>
            <VixText heading="subheader" additionalStyle={styles.summaryValue}>
              {formatRupiah(summary.monthTotal)}
            </VixText>
          </View>
        )}

        {group === 'utility' && (
          <View style={styles.quickCard}>
            <VixText heading="label">
              💧 Terakhir bayar air:{' '}
              {lastWater
                ? `${formatDate(lastWater.date.toDate())} · ${formatRupiah(lastWater.cost)}`
                : 'belum tercatat'}
            </VixText>
            <VixText heading="label">
              ⚡ Terakhir isi token:{' '}
              {lastElectric
                ? `${formatDate(lastElectric.date.toDate())} · ${formatRupiah(lastElectric.cost)}`
                : 'belum tercatat'}
            </VixText>
          </View>
        )}

        <PrimaryButton
          label={group === 'utility' ? 'Catat Air / Listrik' : 'Catat Pengeluaran'}
          icon="plus"
          onPress={openAdd}
          additionalStyle={styles.addButton}
        />

        {logs.length === 0 && (
          <VixText heading="label" additionalStyle={styles.empty}>
            Belum ada catatan.{' '}
            {group === 'utility'
              ? 'Mulai dari isi token listrik berikutnya ⚡'
              : 'Catat pengeluaran rumah pertamamu 🏠'}
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
          placeholder="Keterangan (mis. Isi token 100rb)"
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
  summaryCard: {
    backgroundColor: Color.MAIN_DARK,
    borderRadius: 20,
    padding: 18,
    gap: 6,
    marginBottom: 10,
  },
  summaryLabel: { color: Color.TEXT_ON_DARK_MUTED },
  summaryValue: { color: Color.TEXT_REVERSE },
  utilRow: { flexDirection: 'row', justifyContent: 'space-between' },
  utilText: { color: Color.TEXT_REVERSE },
  quickCard: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Color.BORDER,
    padding: 14,
    gap: 4,
    marginBottom: 10,
  },
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
