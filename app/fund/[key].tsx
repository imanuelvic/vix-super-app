import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { DateField } from '@/components/common/DateField';
import { DualButtons } from '@/components/common/DualButtons';
import { FormInput } from '@/components/common/FormInput';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { SheetModal } from '@/components/common/SheetModal';
import { VixText } from '@/components/common/VixText';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/contexts/auth';
import { groupDigits, MONTH_NAMES, parseAmount } from '@/lib/format';
import {
  addFundEntry,
  deleteFundEntry,
  fundOf,
  reconcileFundBalance,
  subscribeFundEntries,
  updateFundEntry,
  type FundDirection,
  type FundEntry,
} from '@/lib/funds';
import { formatRupiah } from '@/lib/transactions';

// Halaman mutasi satu Budget Khusus — seperti sheet Pocket di spreadsheet:
// Date · Transaction · Catatan · Debit (masuk) · Credit (keluar).
export default function FundScreen() {
  const { user } = useAuth();
  const { key } = useLocalSearchParams<{ key: string }>();
  const fund = fundOf(key ?? '');

  const [entries, setEntries] = useState<FundEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form tambah mutasi.
  const [direction, setDirection] = useState<FundDirection>('credit');
  const [title, setTitle] = useState('');
  const [cause, setCause] = useState('');
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);

  // Modal edit mutasi.
  const [editing, setEditing] = useState<FundEntry | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editCause, setEditCause] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editDate, setEditDate] = useState(new Date());
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Modal konfirmasi hapus.
  const [confirmDelete, setConfirmDelete] = useState<FundEntry | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  useEffect(() => {
    if (!user || !key) return;
    setLoading(true);
    const unsubscribe = subscribeFundEntries(
      user.uid,
      key,
      (next) => {
        setEntries(next);
        setError(null);
        setLoading(false);
      },
      () => {
        setError('Gagal memuat mutasi. Cek koneksi internet.');
        setLoading(false);
      },
    );
    return unsubscribe;
  }, [user, key]);

  // TOTAL seperti di spreadsheet: debit (masuk), credit (keluar), saldo.
  const totals = useMemo(() => {
    let debit = 0;
    let credit = 0;
    for (const e of entries) {
      if (e.direction === 'debit') debit += e.amount;
      else credit += e.amount;
    }
    return { debit, credit, balance: debit - credit };
  }, [entries]);

  // Selaraskan saldo tersimpan di dokumen dompet (untuk daftar Budget Khusus)
  // dengan saldo hasil hitung — menulis hanya kalau berbeda.
  useEffect(() => {
    if (!user || !key || loading) return;
    reconcileFundBalance(user.uid, key, totals.balance).catch(() => {});
  }, [user, key, loading, totals.balance]);

  function validate(t: string, c: string, value: number): string | null {
    if (!value) return 'Isi nominalnya dulu.';
    if (!t.trim()) return 'Isi nama transaksinya dulu.';
    if (!c.trim()) return 'Isi catatannya dulu — biar tahu ini buat apa.';
    return null;
  }

  async function handleAdd() {
    if (!user || !key || saving) return;
    const value = parseAmount(amount);
    const invalid = validate(title, cause, value);
    if (invalid) {
      setError(invalid);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await addFundEntry(user.uid, key, {
        title: title.trim(),
        cause: cause.trim(),
        direction,
        amount: value,
      });
      setTitle('');
      setCause('');
      setAmount('');
    } catch {
      setError('Gagal menyimpan. Coba lagi.');
    } finally {
      setSaving(false);
    }
  }

  function openEdit(entry: FundEntry) {
    setEditing(entry);
    setEditTitle(entry.title);
    setEditCause(entry.cause);
    setEditAmount(groupDigits(String(entry.amount)));
    setEditDate(entry.date ? entry.date.toDate() : new Date());
    setEditError(null);
  }

  async function handleSaveEdit() {
    if (!user || !key || !editing || editSaving) return;
    const value = parseAmount(editAmount);
    const invalid = validate(editTitle, editCause, value);
    if (invalid) {
      setEditError(invalid);
      return;
    }
    setEditError(null);
    setEditSaving(true);
    try {
      await updateFundEntry(user.uid, key, editing, {
        title: editTitle.trim(),
        cause: editCause.trim(),
        amount: value,
        date: editDate,
      });
      setEditing(null);
    } catch {
      setEditError('Gagal menyimpan. Coba lagi.');
    } finally {
      setEditSaving(false);
    }
  }

  async function handleConfirmDelete() {
    if (!user || !key || !confirmDelete || deleteBusy) return;
    setDeleteBusy(true);
    try {
      await deleteFundEntry(user.uid, key, confirmDelete);
    } catch {
      setError('Gagal menghapus. Coba lagi.');
    } finally {
      setConfirmDelete(null);
      setDeleteBusy(false);
    }
  }

  function renderHeader() {
    return (
      <View>
        {/* TOTAL: saldo dompet + total masuk/keluar */}
        <View style={styles.summaryCard}>
          <VixText heading="label" additionalStyle={styles.summaryLabel}>
            Saldo {fund.label}
          </VixText>
          <VixText heading="subheader" additionalStyle={styles.summaryBalance}>
            {formatRupiah(totals.balance)}
          </VixText>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <VixText heading="label" additionalStyle={styles.summaryLabel}>
                Masuk (Debit)
              </VixText>
              <VixText heading="bold" additionalStyle={styles.summaryValue}>
                {formatRupiah(totals.debit)}
              </VixText>
            </View>
            <View style={styles.summaryItem}>
              <VixText heading="label" additionalStyle={styles.summaryLabel}>
                Keluar (Credit)
              </VixText>
              <VixText heading="bold" additionalStyle={styles.summaryValue}>
                {formatRupiah(totals.credit)}
              </VixText>
            </View>
          </View>
        </View>

        {/* Pilih arah mutasi */}
        <View style={styles.directionRow}>
          {(
            [
              ['debit', '⬇️ Masuk', Color.FINANCE_INCOME],
              ['credit', '⬆️ Keluar', Color.FINANCE_EXPENSE],
            ] as const
          ).map(([dir, label, bg]) => (
            <Pressable
              key={dir}
              style={[
                styles.directionChip,
                { backgroundColor: bg },
                direction === dir
                  ? styles.directionActive
                  : styles.directionInactive,
              ]}
              onPress={() => setDirection(dir)}>
              <VixText heading="label" additionalStyle={styles.directionText}>
                {label}
              </VixText>
            </Pressable>
          ))}
        </View>

        {/* Form tambah mutasi (semua wajib) */}
        <FormInput
          placeholder="Transaksi"
          value={title}
          onChangeText={setTitle}
          editable={!saving}
        />
        <FormInput
          style={styles.inputGap}
          placeholder="Catatan"
          value={cause}
          onChangeText={setCause}
          editable={!saving}
        />
        <View style={[styles.inputRow, styles.inputGap]}>
          <FormInput
            style={styles.flexInput}
            placeholder="Nominal (Rp)"
            keyboardType="number-pad"
            value={amount}
            onChangeText={(t) => setAmount(groupDigits(t))}
            onSubmitEditing={handleAdd}
            returnKeyType="done"
            editable={!saving}
          />
          <Pressable
            style={[styles.addButton, saving && styles.disabled]}
            onPress={handleAdd}
            disabled={saving}>
            {saving ? (
              <ActivityIndicator color={Color.TEXT_REVERSE} />
            ) : (
              <IconSymbol name="plus" size={24} color={Color.TEXT_REVERSE} />
            )}
          </Pressable>
        </View>

        {error && (
          <VixText heading="label" additionalStyle={styles.error}>
            {error}
          </VixText>
        )}
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScreenHeader
          backLabel="Budget Khusus"
          title={`${fund.icon} ${fund.label}`}
          subtitle="Mutasi masuk & keluar dana ini."
        />

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={Color.MAIN} />
          </View>
        ) : (
          <FlatList
            data={entries}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={renderHeader()}
            ListEmptyComponent={
              <View style={styles.center}>
                <VixText heading="label">
                  Belum ada mutasi. Tambahkan di atas 👆
                </VixText>
              </View>
            }
            renderItem={({ item }) => {
              const isDebit = item.direction === 'debit';
              const d = item.date ? item.date.toDate() : null;
              const dateLabel = d
                ? `${d.getDate()} ${MONTH_NAMES[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`
                : '';
              return (
                // Tekan baris untuk mengedit. Border hijau = masuk, merah = keluar.
                <Pressable
                  style={[
                    styles.row,
                    {
                      borderColor: isDebit
                        ? Color.FINANCE_INCOME
                        : Color.FINANCE_EXPENSE,
                    },
                  ]}
                  onPress={() => openEdit(item)}>
                  <View style={styles.rowMain}>
                    <VixText
                      heading="bold"
                      numberOfLines={1}
                      additionalStyle={styles.rowLabel}>
                      {item.title}
                    </VixText>
                    <VixText heading="label" numberOfLines={1}>
                      {[dateLabel, item.cause].filter(Boolean).join(' · ')}
                    </VixText>
                  </View>
                  <View style={styles.rowRight}>
                    <VixText
                      heading="bold"
                      additionalStyle={isDebit ? styles.amountIn : styles.amountOut}>
                      {isDebit ? '+' : '-'}
                      {formatRupiah(item.amount)}
                    </VixText>
                    <Pressable onPress={() => setConfirmDelete(item)} hitSlop={10}>
                      <IconSymbol
                        name="xmark"
                        size={16}
                        color={Color.TEXT_PLACEHOLDER}
                      />
                    </Pressable>
                  </View>
                </Pressable>
              );
            }}
          />
        )}
      </KeyboardAvoidingView>

      {/* Bottom sheet: edit mutasi */}
      <SheetModal
        visible={!!editing}
        title="Edit Mutasi"
        subtitle={
          editing
            ? `${fund.icon} ${fund.label} · ${editing.direction === 'debit' ? 'Masuk' : 'Keluar'}`
            : undefined
        }
        onClose={() => setEditing(null)}>
        <FormInput
          placeholder="Transaksi"
          value={editTitle}
          onChangeText={setEditTitle}
          editable={!editSaving}
        />
        <FormInput
          style={styles.inputGap}
          placeholder="Catatan"
          value={editCause}
          onChangeText={setEditCause}
          editable={!editSaving}
        />
        <FormInput
          style={styles.inputGap}
          placeholder="Nominal (Rp)"
          keyboardType="number-pad"
          value={editAmount}
          onChangeText={(t) => setEditAmount(groupDigits(t))}
          editable={!editSaving}
        />
        <View style={styles.inputGap}>
          <DateField key={editing?.id} value={editDate} onChange={setEditDate} />
        </View>
        {editError && (
          <VixText heading="label" additionalStyle={styles.error}>
            {editError}
          </VixText>
        )}
        <DualButtons
          confirmLabel="Simpan"
          busy={editSaving}
          onCancel={() => setEditing(null)}
          onConfirm={handleSaveEdit}
        />
      </SheetModal>

      {/* Konfirmasi hapus */}
      <ConfirmDialog
        visible={!!confirmDelete}
        title="Hapus mutasi ini?"
        detail={
          confirmDelete
            ? `${confirmDelete.title} · ${formatRupiah(confirmDelete.amount)}`
            : undefined
        }
        busy={deleteBusy}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={handleConfirmDelete}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.BACKGROUND },
  flex: { flex: 1 },
  summaryCard: {
    backgroundColor: Color.MAIN_DARK,
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
  },
  summaryLabel: { color: Color.TEXT_ON_DARK_MUTED },
  summaryBalance: { color: Color.TEXT_REVERSE, marginTop: 2, marginBottom: 10 },
  summaryRow: { flexDirection: 'row' },
  summaryItem: { flex: 1 },
  summaryValue: { color: Color.TEXT_REVERSE },
  directionRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  directionChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  directionActive: { borderColor: Color.TEXT_TITLE },
  directionInactive: { borderColor: 'transparent', opacity: 0.55 },
  directionText: { color: Color.TEXT_TITLE },
  inputGap: { marginTop: 8 },
  inputRow: { flexDirection: 'row', gap: 10 },
  flexInput: { flex: 1 },
  addButton: {
    width: 48,
    borderRadius: 12,
    backgroundColor: Color.MAIN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.6 },
  error: { color: Color.DANGER, marginTop: 8 },
  listContent: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Color.CONTAINER,
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginTop: 10,
    gap: 10,
  },
  rowMain: { flex: 1 },
  rowLabel: { color: Color.TEXT_TITLE },
  rowRight: { alignItems: 'flex-end', gap: 6 },
  amountIn: { color: Color.SUCCESS },
  amountOut: { color: Color.DANGER },
  center: { alignItems: 'center', justifyContent: 'center', paddingTop: 40 },
});
