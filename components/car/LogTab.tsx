import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { Chip } from '@/components/common/Chip';
import { DateField } from '@/components/common/DateField';
import { DualButtons } from '@/components/common/DualButtons';
import { FormInput } from '@/components/common/FormInput';
import { InlineDelete } from '@/components/common/InlineDelete';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { SheetModal } from '@/components/common/SheetModal';
import { VixText } from '@/components/common/VixText';
import { useAuth } from '@/contexts/auth';
import {
  addCarLog,
  CAR_LOG_TYPES,
  deleteCarLog,
  updateCarLog,
  type CarLog,
  type CarLogType,
} from '@/lib/car';
import {
  formatDate,
  formatDecimal,
  groupDigits,
  parseAmount,
  parseDecimal,
} from '@/lib/format';
import { formatRupiah } from '@/lib/transactions';

const TYPE_META = Object.fromEntries(
  CAR_LOG_TYPES.map((t) => [t.key, t]),
) as Record<CarLogType, (typeof CAR_LOG_TYPES)[number]>;

// Tab Log: riwayat pengeluaran mobil — bensin (dengan Rp/liter), servis,
// parkir, surat — seperti sheet "My Mazda" lama, plus total & info terakhir.
export function LogTab({ items }: { items: CarLog[] }) {
  const { user } = useAuth();

  // Form tambah/edit lewat bottom sheet. 'new' = sedang menambah baru.
  const [editing, setEditing] = useState<CarLog | 'new' | null>(null);
  const [fType, setFType] = useState<CarLogType>('bensin');
  const [fTitle, setFTitle] = useState('');
  const [fLocation, setFLocation] = useState('');
  const [fNote, setFNote] = useState('');
  const [fCost, setFCost] = useState('');
  const [fLiters, setFLiters] = useState('');
  const [fDate, setFDate] = useState(new Date());
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const now = new Date();
  const stats = useMemo(() => {
    const totalAll = items.reduce((sum, i) => sum + i.cost, 0);
    const totalMonth = items
      .filter((i) => {
        const d = i.date.toDate();
        return (
          d.getFullYear() === now.getFullYear() &&
          d.getMonth() === now.getMonth()
        );
      })
      .reduce((sum, i) => sum + i.cost, 0);
    return {
      totalAll,
      totalMonth,
      lastFuel: items.find((i) => i.type === 'bensin'),
      lastService: items.find((i) => i.type === 'servis'),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  function openAdd() {
    setEditing('new');
    setFType('bensin');
    setFTitle('');
    setFLocation('');
    setFNote('');
    setFCost('');
    setFLiters('');
    setFDate(new Date());
    setFormError(null);
  }

  function openEdit(item: CarLog) {
    setEditing(item);
    setFType(item.type);
    setFTitle(item.title);
    setFLocation(item.location);
    setFNote(item.note);
    setFCost(item.cost > 0 ? groupDigits(String(item.cost)) : '');
    setFLiters(item.liters ? String(item.liters) : '');
    setFDate(item.date.toDate());
    setFormError(null);
  }

  async function handleSave() {
    if (!user || !editing || busy) return;
    if (!fTitle.trim()) {
      setFormError('Nama produk/kegiatan wajib diisi.');
      return;
    }
    setBusy(true);
    setFormError(null);
    const liters = fType === 'bensin' ? parseDecimal(fLiters) : 0;
    const data = {
      type: fType,
      title: fTitle.trim(),
      location: fLocation.trim(),
      note: fNote.trim(),
      cost: parseAmount(fCost), // Rp0 diperbolehkan (mis. isi angin gratis)
      liters: liters > 0 ? liters : null,
      date: fDate,
    };
    try {
      if (editing === 'new') {
        await addCarLog(user.uid, data);
      } else {
        await updateCarLog(user.uid, editing.id, data);
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
      await deleteCarLog(user.uid, editing.id);
    } finally {
      setEditing(null);
      setBusy(false);
    }
  }

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Ringkasan total */}
        <View style={styles.summaryCard}>
          <VixText heading="label" additionalStyle={styles.summaryLabel}>
            Total pengeluaran mobil
          </VixText>
          <VixText heading="subheader" additionalStyle={styles.summaryValue}>
            {formatRupiah(stats.totalAll)}
          </VixText>
          <VixText heading="label" additionalStyle={styles.summaryLabel}>
            Bulan ini: {formatRupiah(stats.totalMonth)}
          </VixText>
        </View>

        {/* Info cepat: terakhir isi bensin & servis */}
        <View style={styles.quickCard}>
          <VixText heading="label">
            ⛽ Terakhir isi bensin:{' '}
            {stats.lastFuel
              ? `${formatDate(stats.lastFuel.date.toDate())} · ${formatRupiah(stats.lastFuel.cost)}`
              : 'belum tercatat'}
          </VixText>
          <VixText heading="label">
            🔧 Servis terakhir:{' '}
            {stats.lastService
              ? `${formatDate(stats.lastService.date.toDate())} · ${stats.lastService.title}`
              : 'belum tercatat'}
          </VixText>
        </View>

        <PrimaryButton
          label="Catat Pengeluaran"
          icon="plus"
          onPress={openAdd}
          additionalStyle={styles.addButton}
        />

        {items.length === 0 && (
          <VixText heading="label" additionalStyle={styles.empty}>
            Belum ada catatan. Mulai dari isi bensin berikutnya ⛽
          </VixText>
        )}

        {items.map((item) => {
          const meta = TYPE_META[item.type];
          const subParts = [item.location, item.note].filter(Boolean);
          const perLiter =
            item.type === 'bensin' && item.liters
              ? Math.round(item.cost / item.liters)
              : null;
          return (
            // Tekan untuk edit/hapus.
            <Pressable
              key={item.id}
              style={styles.row}
              onPress={() => openEdit(item)}>
              <View style={styles.rowLeft}>
                <VixText heading="bold" additionalStyle={styles.rowTitle}>
                  {meta.icon} {item.title}
                </VixText>
                {subParts.length > 0 && (
                  <VixText heading="label" numberOfLines={1}>
                    {subParts.join(' · ')}
                  </VixText>
                )}
                <VixText heading="label">
                  {formatDate(item.date.toDate())}
                  {item.liters
                    ? ` · ${formatDecimal(item.liters)} L${perLiter ? ` · ${formatRupiah(perLiter)}/L` : ''}`
                    : ''}
                </VixText>
              </View>
              <VixText heading="bold" additionalStyle={styles.rowCost}>
                {formatRupiah(item.cost)}
              </VixText>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Bottom sheet tambah/edit */}
      <SheetModal
        visible={!!editing}
        title={editing === 'new' ? 'Catat Pengeluaran' : 'Edit Catatan'}
        onClose={() => setEditing(null)}>
        <View style={styles.chipRow}>
          {CAR_LOG_TYPES.map((t) => (
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
          placeholder="Produk — mis. Gasoline (Full)"
          value={fTitle}
          onChangeText={setFTitle}
          editable={!busy}
        />
        <FormInput
          style={styles.formGap}
          placeholder="Lokasi / bengkel (opsional)"
          value={fLocation}
          onChangeText={setFLocation}
          editable={!busy}
        />
        <FormInput
          style={styles.formGap}
          placeholder="Keterangan (opsional) — mis. 7 sticks left"
          value={fNote}
          onChangeText={setFNote}
          editable={!busy}
        />
        <View style={styles.moneyRow}>
          <FormInput
            style={styles.moneyInput}
            placeholder="Nominal (Rp)"
            keyboardType="number-pad"
            value={fCost}
            onChangeText={(t) => setFCost(groupDigits(t))}
            editable={!busy}
          />
          {fType === 'bensin' && (
            <FormInput
              style={styles.literInput}
              placeholder="Liter"
              keyboardType="decimal-pad"
              value={fLiters}
              onChangeText={setFLiters}
              editable={!busy}
            />
          )}
        </View>
        <View style={styles.formGap}>
          {/* key = id supaya state picker internal reset tiap ganti item */}
          <DateField
            key={editing === 'new' ? 'new' : editing?.id}
            value={fDate}
            onChange={setFDate}
          />
        </View>
        {fType === 'bensin' && (
          <VixText heading="label" additionalStyle={styles.hint}>
            Isi liter supaya harga per liter terhitung otomatis.
          </VixText>
        )}
        {formError && (
          <VixText heading="label" additionalStyle={styles.error}>
            {formError}
          </VixText>
        )}
        {/* Konfirmasi hapus inline — iOS tidak bisa modal di atas modal */}
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
    gap: 4,
    marginBottom: 10,
  },
  summaryLabel: { color: Color.TEXT_ON_DARK_MUTED },
  summaryValue: { color: Color.TEXT_REVERSE },
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
  moneyRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  moneyInput: { flex: 2 },
  literInput: { flex: 1 },
  hint: { marginBottom: 8 },
  error: { color: Color.DANGER, marginBottom: 8 },
});
