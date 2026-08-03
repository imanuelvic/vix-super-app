import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useMemo, useState } from 'react';
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
import { SearchBar } from '@/components/common/SearchBar';
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
import { DELETE_ERROR } from '@/lib/messages';
import { openPayApp, payAppForCategory } from '@/lib/payapps';
import {
  addTransaction,
  deleteTransaction,
  formatRupiah,
  updateTransaction,
  type Transaction,
} from '@/lib/transactions';

// Preferensi tampil/sembunyi nominal — disimpan (AsyncStorage) supaya
// pilihannya global & konsisten tiap kali masuk Finance. "1" = disembunyikan.
const AMOUNTS_HIDDEN_KEY = 'finance:amountsHidden';

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

  // Ringkasan dikecilkan by default. Nominal default TAMPIL — pilihan
  // sembunyi/tampil disimpan & dimuat lagi tiap masuk (tidak tergantung
  // buka/tutup ringkasan).
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [amountsHidden, setAmountsHidden] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Muat preferensi tersimpan sekali di awal.
  useEffect(() => {
    AsyncStorage.getItem(AMOUNTS_HIDDEN_KEY).then((v) => {
      if (v != null) setAmountsHidden(v === '1');
    });
  }, []);

  // Sembunyikan / tampilkan nominal + simpan pilihannya.
  function toggleAmountsHidden() {
    setAmountsHidden((hidden) => {
      const next = !hidden;
      AsyncStorage.setItem(AMOUNTS_HIDDEN_KEY, next ? '1' : '0').catch(() => {});
      return next;
    });
  }

  // Form tambah transaksi.
  const [type, setType] = useState<FinanceType>('expense');
  const [category, setCategory] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false); // sheet pilih kategori
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  // Mode cari (dibuka via FAB 🔍): cari kata + urutkan terbesar/terkecil.
  const [searchMode, setSearchMode] = useState(false);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'recent' | 'high' | 'low'>('recent');

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

  // Daftar transaksi: disaring jenis (TypeChips), lalu — saat mode cari aktif —
  // disaring kata (catatan/kategori) & diurutkan (terbesar/terkecil).
  const filtered = useMemo(() => {
    let list = items.filter((t) => t.type === type);
    if (searchMode) {
      const q = query.trim().toLowerCase();
      if (q) {
        list = list.filter((t) => {
          const cat = categoryOf(t.type, t.category);
          return `${cat.label} ${t.note}`.toLowerCase().includes(q);
        });
      }
      if (sort === 'high') list = [...list].sort((a, b) => b.amount - a.amount);
      else if (sort === 'low') list = [...list].sort((a, b) => a.amount - b.amount);
    }
    return list;
  }, [items, type, searchMode, query, sort]);

  // Warna latar pilihan kategori sesuai pemakaian budget-nya: kuning ≥75%,
  // biru pas 100% (budget habis persis), merah kalau MELEBIHI 100% (over
  // budget). Kategori tanpa budget → normal.
  function categoryBudgetStyle(key: string): ViewStyle | undefined {
    const allocated = budget[budgetKey(type, key)] ?? 0;
    if (allocated <= 0) return undefined;
    const percent =
      ((realization.get(budgetKey(type, key)) ?? 0) / allocated) * 100;
    if (percent > 100)
      return {
        backgroundColor: Color.FINANCE_EXPENSE,
        borderColor: Color.FINANCE_EXPENSE_DARK,
      };
    if (percent >= 100)
      return {
        backgroundColor: Color.FINANCE_INVESTMENT,
        borderColor: Color.FINANCE_INVESTMENT_DARK,
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

  // Buka/tutup mode cari. Tutup = reset kata & urutan.
  function toggleSearch() {
    setSearchMode((s) => {
      const next = !s;
      if (!next) {
        setQuery('');
        setSort('recent');
      }
      return next;
    });
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
      setError(DELETE_ERROR);
    } finally {
      setConfirmDelete(null);
      setDeleteBusy(false);
    }
  }

  function renderHeader() {
    // App tujuan (deeplink) sesuai kategori terpilih — muncul di bawah nominal.
    const payApp = category ? payAppForCategory(category) : null;
    return (
      <View>
        {/* Hari & tanggal hari ini */}
        <VixText heading="label" additionalStyle={styles.todayText}>
          📆 {formatFullDate(new Date())}
        </VixText>

        {/* Ringkasan bulan — bisa diminimize seperti dropdown */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            {/* Kiri: perbesar / kecilkan ringkasan (tidak mengubah visibilitas) */}
            <PressableScale
              style={styles.summaryHeaderMain}
              onPress={() => setSummaryOpen((o) => !o)}>
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
            {/* Kanan: sembunyikan / tampilkan nominal (pilihan tersimpan) */}
            <PressableScale onPress={toggleAmountsHidden} hitSlop={10}>
              <IconSymbol
                name={amountsHidden ? 'eye.slash' : 'eye'}
                size={20}
                color={Color.TEXT_ON_DARK_MUTED}
              />
            </PressableScale>
          </View>

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
            <View style={styles.collapsedRow}>
              <VixText heading="bold" additionalStyle={styles.summaryValue}>
                Sisa: {displayAmount(remaining)}
              </VixText>
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

        {/* Tombol deeplink ke app tujuan (warna brand) — hanya kalau kategori
            terpilih punya app terkait. Buka vix → isi data → lompat ke app. */}
        {payApp && (
          <PressableScale
            style={[
              styles.payButton,
              styles.inputGap,
              { backgroundColor: payApp.color },
            ]}
            onPress={() => openPayApp(payApp)}>
            <VixText heading="bold" additionalStyle={{ color: payApp.fg }}>
              💳 Buka {payApp.label}
            </VixText>
            <IconSymbol name="chevron.right" size={18} color={payApp.fg} />
          </PressableScale>
        )}

        {error && (
          <VixText heading="label" additionalStyle={styles.error}>
            {error}
          </VixText>
        )}
      </View>
    );
  }

  // Header saat mode cari aktif: cari kata + urutkan (terbesar/terkecil).
  // Hanya mencari transaksi bulan yang sedang dibuka (data `items`).
  function renderSearchHeader() {
    const q = query.trim();
    return (
      <View>
        <VixText heading="label" additionalStyle={styles.todayText}>
          🔍 Cari transaksi bulan ini
        </VixText>
        <TypeChips
          value={type}
          onChange={(next) => {
            setType(next);
            setCategory(null);
          }}
        />
        <View style={styles.searchWrap}>
          <SearchBar
            value={query}
            onChangeText={setQuery}
            placeholder="Cari catatan / kategori…"
          />
        </View>
        <View style={styles.sortRow}>
          <Chip
            label="🕒 Terbaru"
            active={sort === 'recent'}
            onPress={() => setSort('recent')}
          />
          <Chip
            label="🔺 Terbesar"
            active={sort === 'high'}
            onPress={() => setSort('high')}
          />
          <Chip
            label="🔻 Terkecil"
            active={sort === 'low'}
            onPress={() => setSort('low')}
          />
        </View>
        <VixText heading="label" additionalStyle={styles.searchCount}>
          {filtered.length} transaksi {FINANCE_TYPE_LABEL[type].toLowerCase()}
          {q ? ` cocok “${q}”` : ''}
        </VixText>
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
        ListHeaderComponent={searchMode ? renderSearchHeader() : renderHeader()}
        ListEmptyComponent={
          <View style={styles.center}>
            <VixText heading="label">
              {searchMode
                ? query.trim()
                  ? 'Tidak ada transaksi yang cocok 🔍'
                  : `Belum ada transaksi ${FINANCE_TYPE_LABEL[type]} bulan ini.`
                : `Belum ada transaksi ${FINANCE_TYPE_LABEL[type]} bulan ini. Tambahkan di atas 👆`}
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

      {/* FAB mengambang (seperti fitur Task): buka/tutup mode cari 🔍 */}
      <PressableScale style={styles.fab} onPress={toggleSearch}>
        <IconSymbol
          name={searchMode ? 'xmark' : 'magnifyingglass'}
          size={24}
          color={Color.TEXT_REVERSE}
        />
      </PressableScale>
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
    alignItems: 'center',
    gap: 12,
    marginBottom: 6,
  },
  summaryHeaderMain: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  // Tombol deeplink ke app tujuan — warna latar diisi warna brand app-nya.
  payButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    paddingVertical: 12,
  },
  error: { color: Color.DANGER, marginTop: 8 },
  listContent: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 88 },
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
  // Mode cari
  searchWrap: { marginBottom: 8 },
  sortRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  searchCount: { color: Color.TEXT_LABEL, marginBottom: 4 },
  // FAB mengambang (seperti Task).
  fab: {
    position: 'absolute',
    right: 18,
    bottom: 18,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Color.MAIN,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
});
