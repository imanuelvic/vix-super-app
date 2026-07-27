import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';

import { Color } from '@/assets/style/color';
import { Chip } from '@/components/common/Chip';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { DateField } from '@/components/common/DateField';
import { DualButtons } from '@/components/common/DualButtons';
import { FormInput } from '@/components/common/FormInput';
import { PressableScale } from '@/components/common/PressableScale';
import { SheetModal } from '@/components/common/SheetModal';
import { VixText } from '@/components/common/VixText';
import { TypeChips } from '@/components/finance/TypeChips';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/contexts/auth';
import { budgetKey, type BudgetMap } from '@/lib/budgets';
import {
  activeCategories,
  categoryOf,
  FINANCE_TYPE_COLOR,
  FINANCE_TYPE_LABEL,
  type FinanceType,
} from '@/lib/categories';
import {
  dayShort,
  formatFullDate,
  groupDigits,
  MONTH_NAMES,
  parseAmount,
} from '@/lib/format';
import {
  addTransaction,
  deleteTransaction,
  formatRupiah,
  updateTransaction,
  type Transaction,
} from '@/lib/transactions';

// Tab Transaction Log: ringkasan bulan, form tambah, daftar transaksi,
// modal edit (nominal/catatan/tanggal), dan konfirmasi hapus.
// `budget` (alokasi per kategori bulan ini) dipakai untuk mewarnai pilihan
// kategori: kuning saat pemakaian ≥75%, merah saat ≥100% (over budget).
export function TransactionsTab({
  items,
  budget,
}: {
  items: Transaction[];
  budget: BudgetMap;
}) {
  const { user } = useAuth();

  // Default: kartu ringkasan dikecilkan & semua nominal disembunyikan
  // (privasi dulu — buka/tampilkan hanya saat dibutuhkan).
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [amountsHidden, setAmountsHidden] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form tambah transaksi.
  const [type, setType] = useState<FinanceType>('expense');
  const [category, setCategory] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false); // sheet pilih kategori
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  // Modal edit transaksi.
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editDate, setEditDate] = useState(new Date());
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Modal konfirmasi hapus.
  const [confirmDelete, setConfirmDelete] = useState<Transaction | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const totals = useMemo(() => {
    const t: Record<FinanceType, number> = {
      income: 0,
      expense: 0,
      saving: 0,
      investment: 0,
    };
    for (const item of items) {
      if (t[item.type] !== undefined) t[item.type] += item.amount;
    }
    return t;
  }, [items]);

  // Sisa = pemasukan dikurangi semua alokasi keluar bulan ini.
  const remaining =
    totals.income - totals.expense - totals.saving - totals.investment;

  // Realisasi per "jenis:kategori" bulan ini (untuk warna pilihan kategori).
  const realization = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of items) {
      const key = budgetKey(t.type, t.category);
      map.set(key, (map.get(key) ?? 0) + t.amount);
    }
    return map;
  }, [items]);

  // Daftar transaksi disaring sesuai jenis terpilih di TypeChips.
  const filtered = useMemo(
    () => items.filter((t) => t.type === type),
    [items, type],
  );

  // Warna latar pilihan kategori sesuai pemakaian budget-nya:
  // kuning ≥75%, merah ≥100% (over budget). Kategori tanpa budget → normal.
  function categoryBudgetStyle(key: string): ViewStyle | undefined {
    const allocated = budget[budgetKey(type, key)] ?? 0;
    if (allocated <= 0) return undefined;
    const percent =
      ((realization.get(budgetKey(type, key)) ?? 0) / allocated) * 100;
    if (percent >= 100)
      return {
        backgroundColor: Color.FINANCE_EXPENSE,
        borderColor: Color.FINANCE_EXPENSE_DARK,
      };
    if (percent >= 75)
      return {
        backgroundColor: Color.FINANCE_SAVING,
        borderColor: Color.FINANCE_SAVING_DARK,
      };
    return undefined;
  }

  // Teks nominal — disamarkan saat mode sembunyi angka aktif.
  function displayAmount(n: number): string {
    return amountsHidden ? 'Rp ••••••' : formatRupiah(n);
  }

  function validate(value: number, noteText: string): string | null {
    if (!value) return 'Isi nominalnya dulu.';
    if (!noteText.trim()) return 'Isi catatannya dulu — biar tahu ini buat apa.';
    return null;
  }

  async function handleAdd() {
    if (!user || saving) return;
    const value = parseAmount(amount);
    const invalid = !category
      ? 'Pilih kategorinya dulu.'
      : validate(value, note);
    if (invalid) {
      setError(invalid);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await addTransaction(user.uid, {
        type,
        category: category!,
        amount: value,
        note: note.trim(),
      });
      setAmount('');
      setNote('');
    } catch {
      setError('Gagal menyimpan. Coba lagi.');
    } finally {
      setSaving(false);
    }
  }

  function openEdit(item: Transaction) {
    setEditing(item);
    setEditAmount(groupDigits(String(item.amount)));
    setEditNote(item.note);
    setEditDate(item.date ? item.date.toDate() : new Date());
    setEditError(null);
  }

  async function handleSaveEdit() {
    if (!user || !editing || editSaving) return;
    const value = parseAmount(editAmount);
    const invalid = validate(value, editNote);
    if (invalid) {
      setEditError(invalid);
      return;
    }
    setEditError(null);
    setEditSaving(true);
    try {
      await updateTransaction(user.uid, editing.id, {
        amount: value,
        note: editNote.trim(),
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
    if (!user || !confirmDelete || deleteBusy) return;
    setDeleteBusy(true);
    try {
      await deleteTransaction(user.uid, confirmDelete.id);
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
        {/* Hari & tanggal hari ini */}
        <VixText heading="label" additionalStyle={styles.todayText}>
          📆 {formatFullDate(new Date())}
        </VixText>

        {/* Ringkasan bulan — bisa diminimize seperti dropdown */}
        <View style={styles.summaryCard}>
          <PressableScale
            style={styles.summaryHeader}
            onPress={() => {
              const nextOpen = !summaryOpen;
              setSummaryOpen(nextOpen);
              // Dikecilkan = semua angka ikut disembunyikan; dibuka = tampil lagi.
              setAmountsHidden(!nextOpen);
            }}>
            <VixText heading="label" additionalStyle={styles.summaryLabel}>
              Ringkasan bulan
            </VixText>
            <View style={styles.summaryToggle}>
              <VixText heading="label" additionalStyle={styles.summaryLabel}>
                {summaryOpen ? 'Kecilkan' : 'Perbesar'}
              </VixText>
              <IconSymbol
                name={summaryOpen ? 'chevron.up' : 'chevron.down'}
                size={16}
                color={Color.TEXT_ON_DARK_MUTED}
              />
            </View>
          </PressableScale>

          {summaryOpen ? (
            <View>
              <VixText heading="label" additionalStyle={styles.summaryLabel}>
                Sisa bulan ini
              </VixText>
              <VixText
                heading="subheader"
                additionalStyle={styles.summaryRemaining}>
                {displayAmount(remaining)}
              </VixText>
              <View style={styles.summaryRow}>
                <View style={styles.summaryItem}>
                  <VixText heading="label" additionalStyle={styles.summaryLabel}>
                    Income
                  </VixText>
                  <VixText heading="bold" additionalStyle={styles.summaryValue}>
                    {displayAmount(totals.income)}
                  </VixText>
                </View>
                <View style={styles.summaryItem}>
                  <VixText heading="label" additionalStyle={styles.summaryLabel}>
                    Expense
                  </VixText>
                  <VixText heading="bold" additionalStyle={styles.summaryValue}>
                    {displayAmount(totals.expense)}
                  </VixText>
                </View>
              </View>
            </View>
          ) : (
            // Versi kecil: angka tersembunyi — tekan ikon mata untuk melihat.
            <View style={styles.collapsedRow}>
              <VixText heading="bold" additionalStyle={styles.summaryValue}>
                Sisa: {displayAmount(remaining)}
              </VixText>
              <PressableScale
                onPress={() => setAmountsHidden((hidden) => !hidden)}
                hitSlop={10}>
                <IconSymbol
                  name={amountsHidden ? 'eye' : 'eye.slash'}
                  size={20}
                  color={Color.TEXT_PLACEHOLDER}
                />
              </PressableScale>
            </View>
          )}
        </View>

        {/* Pilih jenis */}
        <TypeChips
          value={type}
          onChange={(next) => {
            setType(next);
            setCategory(null); // kategori tergantung jenis, jadi direset
          }}
        />

        {/* Pilih kategori — buka sheet, tidak perlu scroll ke samping */}
        <PressableScale
          style={styles.categoryField}
          onPress={() => setPickerOpen(true)}>
          <VixText
            heading="paragraph"
            additionalStyle={
              selectedCategory
                ? styles.categoryValue
                : styles.categoryPlaceholder
            }>
            {selectedCategory
              ? `${selectedCategory.icon} ${selectedCategory.label}`
              : 'Pilih kategori'}
          </VixText>
          <IconSymbol name="chevron.down" size={18} color={Color.TEXT_LABEL} />
        </PressableScale>

        {/* Catatan dulu, lalu nominal — urutan sama seperti Saku */}
        <FormInput
          placeholder="Catatan"
          value={note}
          onChangeText={setNote}
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
          <PressableScale
            style={[styles.addButton, saving && styles.disabled]}
            onPress={handleAdd}
            disabled={saving}>
            {saving ? (
              <ActivityIndicator color={Color.TEXT_REVERSE} />
            ) : (
              <IconSymbol name="plus" size={24} color={Color.TEXT_REVERSE} />
            )}
          </PressableScale>
        </View>

        {error && (
          <VixText heading="label" additionalStyle={styles.error}>
            {error}
          </VixText>
        )}
      </View>
    );
  }

  const selectedCategory = category ? categoryOf(type, category) : null;
  const editingCategory = editing
    ? categoryOf(editing.type, editing.category)
    : null;
  const deletingCategory = confirmDelete
    ? categoryOf(confirmDelete.type, confirmDelete.category)
    : null;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator
        persistentScrollbar
        indicatorStyle="black"
        ListHeaderComponent={renderHeader()}
        ListEmptyComponent={
          <View style={styles.center}>
            <VixText heading="label">
              Belum ada transaksi {FINANCE_TYPE_LABEL[type]} bulan ini.
              Tambahkan di atas 👆
            </VixText>
          </View>
        }
        renderItem={({ item }) => {
          const cat = categoryOf(item.type, item.category);
          const isIncome = item.type === 'income';
          const d = item.date ? item.date.toDate() : null;
          // Nama hari 3 huruf di samping tanggal, mis. "Sel, 14 Jul".
          const dateLabel = d
            ? `${dayShort(d)}, ${d.getDate()} ${MONTH_NAMES[d.getMonth()].slice(0, 3)}`
            : '';
          return (
            // Tekan baris untuk mengedit. Border mengikuti warna jenis.
            <PressableScale
              style={[styles.row, { borderColor: FINANCE_TYPE_COLOR[item.type] }]}
              onPress={() => openEdit(item)}>
              <View style={styles.rowIcon}>
                <VixText heading="title">{cat.icon}</VixText>
              </View>
              <View style={styles.rowMain}>
                <VixText
                  heading="bold"
                  numberOfLines={1}
                  additionalStyle={styles.rowLabel}>
                  {cat.label}
                </VixText>
                <VixText heading="label" numberOfLines={1}>
                  {dateLabel ? `${dateLabel}` : ''}
                  {item.note ? ` · ${item.note}` : ''}
                </VixText>
              </View>
              <View style={styles.rowRight}>
                <VixText
                  heading="bold"
                  additionalStyle={
                    isIncome ? styles.amountIncome : styles.amountOut
                  }>
                  {amountsHidden
                    ? 'Rp ••••••'
                    : `${isIncome ? '+' : '-'}${formatRupiah(item.amount)}`}
                </VixText>
                <PressableScale onPress={() => setConfirmDelete(item)} hitSlop={10}>
                  <IconSymbol
                    name="xmark"
                    size={16}
                    color={Color.TEXT_PLACEHOLDER}
                  />
                </PressableScale>
              </View>
            </PressableScale>
          );
        }}
      />

      {/* Sheet pilih kategori */}
      <SheetModal
        visible={pickerOpen}
        title={`Kategori ${FINANCE_TYPE_LABEL[type]}`}
        onClose={() => setPickerOpen(false)}>
        <ScrollView style={styles.pickerScroll}>
          <View style={styles.pickerWrap}>
            {activeCategories(type).map((c) => (
              <Chip
                key={c.key}
                label={`${c.icon} ${c.label}`}
                active={category === c.key}
                additionalStyle={categoryBudgetStyle(c.key)}
                onPress={() => {
                  setCategory(c.key);
                  setPickerOpen(false);
                }}
              />
            ))}
          </View>
        </ScrollView>
      </SheetModal>

      {/* Bottom sheet: edit transaksi */}
      <SheetModal
        visible={!!editing}
        title="Edit Transaksi"
        subtitle={
          editing && editingCategory
            ? `${editingCategory.icon} ${editingCategory.label} · ${FINANCE_TYPE_LABEL[editing.type]}`
            : undefined
        }
        onClose={() => setEditing(null)}>
        <FormInput
          placeholder="Nominal (Rp)"
          keyboardType="number-pad"
          value={editAmount}
          onChangeText={(t) => setEditAmount(groupDigits(t))}
          editable={!editSaving}
        />
        <FormInput
          style={styles.inputGap}
          placeholder="Catatan"
          value={editNote}
          onChangeText={setEditNote}
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
        title="Hapus transaksi ini?"
        detail={
          confirmDelete && deletingCategory
            ? `${deletingCategory.icon} ${deletingCategory.label} · ${formatRupiah(confirmDelete.amount)}${confirmDelete.note ? `\n${confirmDelete.note}` : ''}`
            : undefined
        }
        busy={deleteBusy}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={handleConfirmDelete}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  todayText: { marginBottom: 8 },
  summaryCard: {
    backgroundColor: Color.MAIN_DARK,
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  summaryToggle: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  summaryLabel: { color: Color.TEXT_ON_DARK_MUTED },
  summaryRemaining: { color: Color.TEXT_REVERSE, marginTop: 2, marginBottom: 10 },
  summaryRow: { flexDirection: 'row', marginTop: 6 },
  summaryItem: { flex: 1 },
  summaryValue: { color: Color.TEXT_REVERSE },
  collapsedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryField: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Color.CONTAINER,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Color.BORDER,
    marginBottom: 8,
  },
  categoryValue: { color: Color.TEXT_TITLE },
  categoryPlaceholder: { color: Color.TEXT_PLACEHOLDER },
  pickerScroll: { maxHeight: 400 },
  pickerWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingBottom: 8,
  },
  inputRow: { flexDirection: 'row', gap: 10 },
  inputGap: { marginTop: 8 },
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
  listContent: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 },
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
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Color.CONTRAST_CONTAINER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowMain: { flex: 1 },
  rowLabel: { color: Color.TEXT_TITLE },
  rowRight: { alignItems: 'flex-end', gap: 6 },
  amountIncome: { color: Color.SUCCESS },
  amountOut: { color: Color.TEXT_TITLE },
  center: { alignItems: 'center', justifyContent: 'center', paddingTop: 40 },
});
