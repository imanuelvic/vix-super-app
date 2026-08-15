import { useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { CenterDialog } from '@/components/common/CenterDialog';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { DualButtons } from '@/components/common/DualButtons';
import { FormInput } from '@/components/common/FormInput';
import { MoneyInput } from '@/components/common/MoneyInput';
import { PressableScale } from '@/components/common/PressableScale';
import { VixText } from '@/components/common/VixText';
import { TypeChips } from '@/components/finance/TypeChips';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/contexts/auth';
import {
  budgetKey,
  copyBudgetFromPreviousMonth,
  customSubsOf,
  newSubKey,
  saveCategoryBudget,
  saveSubcategories,
  subBudgetKey,
  subsOf,
  type BudgetMap,
  type SubcategoryMap,
} from '@/lib/budgets';
import {
  categoryOf,
  FINANCE_CATEGORIES,
  FINANCE_TYPE_LABEL,
  type FinanceCategory,
  type FinanceType,
} from '@/lib/categories';
import { groupDigits, parseAmount } from '@/lib/format';
import { formatRupiah, type Transaction } from '@/lib/transactions';

type BudgetRow = {
  key: string;
  category: FinanceCategory;
  allocated: number; // budget yang di-set manual
  realized: number; // realisasi otomatis dari transaksi
  subCount: number; // jumlah sub-budget kategori ini
};

// Baris sub-budget yang sedang diedit di dalam modal. `amount` disimpan
// sebagai teks (sudah berformat ribuan) karena langsung diikat ke MoneyInput.
// `builtin` = sub bawaan (⛽ Bensin) — boleh diberi budget, tapi tak bisa
// dihapus karena dipakai untuk sinkron ke fitur Car.
type SubDraft = {
  key: string;
  label: string;
  amount: string;
  builtin?: boolean;
};

// Tab Budgeting: budget per kategori per bulan (di-set manual) dibandingkan
// dengan realisasi yang terhitung otomatis dari transaksi bulan itu.
// `budget` & `copied` datang dari layar Finance (satu langganan dipakai
// bersama tab Transaksi supaya tidak double-read).
export function BudgetingTab({
  items,
  year,
  month,
  budget,
  copied,
  subcats,
}: {
  items: Transaction[];
  year: number;
  month: number;
  budget: BudgetMap;
  copied: boolean;
  subcats: SubcategoryMap;
}) {
  const { user } = useAuth();

  const [type, setType] = useState<FinanceType>('expense');
  const [error, setError] = useState<string | null>(null);

  // Tombol "samakan dengan bulan lalu" — abu-abu kalau sudah pernah ditekan
  // untuk bulan ini (status `copied` disuplai dari layar Finance).
  const [copying, setCopying] = useState(false);
  const [confirmCopy, setConfirmCopy] = useState(false);

  // Modal set budget (kategori + sub-budget-nya).
  const [editing, setEditing] = useState<FinanceCategory | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [saving, setSaving] = useState(false);
  // Salinan kerja sub-budget selama modal terbuka — baru ditulis saat Simpan.
  const [subDraft, setSubDraft] = useState<SubDraft[]>([]);
  const [removedSubs, setRemovedSubs] = useState<string[]>([]);
  const [newSubLabel, setNewSubLabel] = useState('');

  // Realisasi per "jenis:kategori" dari seluruh transaksi bulan ini.
  const realization = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of items) {
      const key = budgetKey(t.type, t.category);
      map.set(key, (map.get(key) ?? 0) + t.amount);
    }
    return map;
  }, [items]);

  // Realisasi per sub-kategori — hanya transaksi yang memang memilih sub.
  const subRealization = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of items) {
      if (!t.sub) continue;
      const key = subBudgetKey(t.type, t.category, t.sub);
      map.set(key, (map.get(key) ?? 0) + t.amount);
    }
    return map;
  }, [items]);

  // Baris kategori: semua kategori aktif + kategori nonaktif yang masih
  // punya budget/realisasi (biar data lama tidak hilang dari tampilan).
  const rows = useMemo(() => {
    return FINANCE_CATEGORIES[type]
      .map((c) => ({
        key: c.key,
        category: categoryOf(type, c.key),
        allocated: budget[budgetKey(type, c.key)] ?? 0,
        realized: realization.get(budgetKey(type, c.key)) ?? 0,
        subCount: subsOf(subcats, type, c.key).length,
      }))
      .filter((r) => r.category.active || r.allocated > 0 || r.realized > 0);
  }, [type, budget, realization, subcats]) as BudgetRow[];

  const totalAllocated = rows.reduce((sum, r) => sum + r.allocated, 0);
  const totalRealized = rows.reduce((sum, r) => sum + r.realized, 0);
  const totalPercent =
    totalAllocated > 0 ? (totalRealized / totalAllocated) * 100 : 0;

  // Sub-budget MENJUMLAH jadi budget kategorinya. Begitu ada minimal satu sub
  // yang diisi nominal, kolom budget utama tidak diketik manual lagi —
  // nilainya = total semua sub (satu sumber angka, tidak bisa beda).
  const subTotal = subDraft.reduce((sum, s) => sum + parseAmount(s.amount), 0);
  const rolledUp = subTotal > 0;
  // Nominal yang benar-benar disimpan sebagai budget kategori ini.
  const mainAmount = rolledUp ? subTotal : parseAmount(editAmount);

  function openEdit(category: FinanceCategory) {
    setEditing(category);
    const current = budget[budgetKey(type, category.key)] ?? 0;
    setEditAmount(current > 0 ? groupDigits(String(current)) : '');
    // Sub-budget disalin dulu ke draft; nominalnya diambil dari alokasi bulan
    // yang sedang dibuka.
    setSubDraft(
      subsOf(subcats, type, category.key).map((s) => {
        const value = budget[subBudgetKey(type, category.key, s.key)] ?? 0;
        return {
          key: s.key,
          label: s.label,
          builtin: s.builtin,
          amount: value > 0 ? groupDigits(String(value)) : '',
        };
      }),
    );
    setRemovedSubs([]);
    setNewSubLabel('');
  }

  /** Tambah sub baru ke draft (belum ditulis ke Firestore sampai Simpan). */
  function addSub() {
    const label = newSubLabel.trim();
    if (!label) return;
    setSubDraft((list) => [...list, { key: newSubKey(label), label, amount: '' }]);
    setNewSubLabel('');
  }

  /** Buang sub dari draft — alokasinya ikut dihapus permanen saat Simpan. */
  function removeSub(key: string) {
    setSubDraft((list) => list.filter((s) => s.key !== key));
    setRemovedSubs((list) => [...list, key]);
  }

  function changeSubAmount(key: string, text: string) {
    setSubDraft((list) =>
      list.map((s) => (s.key === key ? { ...s, amount: groupDigits(text) } : s)),
    );
  }

  function handleCopyPress() {
    // Sudah pernah disamakan → minta konfirmasi dulu sebelum menimpa lagi.
    if (copied) setConfirmCopy(true);
    else doCopy();
  }

  async function doCopy() {
    if (!user || copying) return;
    setCopying(true);
    setError(null);
    try {
      const ok = await copyBudgetFromPreviousMonth(user.uid, year, month);
      if (!ok) setError('Bulan lalu belum ada budget yang bisa disalin.');
    } catch {
      setError('Gagal menyalin budget. Coba lagi.');
    } finally {
      setConfirmCopy(false);
      setCopying(false);
    }
  }

  async function handleSave() {
    if (!user || !editing || saving) return;
    // Budget kategori = total sub-budget kalau ada; kalau tidak, angka yang
    // diketik manual. 0 = budget dihapus.
    const value = mainAmount;
    const subAmounts: Record<string, number> = {};
    for (const s of subDraft) subAmounts[s.key] = parseAmount(s.amount);
    setSaving(true);
    try {
      // Daftar sub (lintas bulan) & nominalnya (per bulan) tersimpan di dua
      // dokumen berbeda — daftarnya cuma ditulis kalau memang berubah.
      const before = customSubsOf(subcats, type, editing.key);
      const after = subDraft
        .filter((s) => !s.builtin) // sub bawaan tidak ikut disimpan
        .map((s) => ({ key: s.key, label: s.label }));
      if (JSON.stringify(before) !== JSON.stringify(after)) {
        await saveSubcategories(user.uid, type, editing.key, after);
      }
      await saveCategoryBudget(
        user.uid,
        year,
        month,
        type,
        editing.key,
        value,
        subAmounts,
        removedSubs,
      );
    } catch {
      setError('Gagal menyimpan budget. Coba lagi.');
    } finally {
      setEditing(null);
      setSaving(false);
    }
  }

  return (
    <View style={styles.flex}>
      {/* Kategori (jenis) menempel di atas — tetap bisa ditekan saat scroll */}
      <View style={styles.stickyHeader}>
        <TypeChips value={type} onChange={setType} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {error && (
          <VixText heading="label" additionalStyle={styles.error}>
            {error}
          </VixText>
        )}

        {/* Ringkasan budget jenis terpilih */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryTop}>
            <VixText heading="label" additionalStyle={styles.summaryLabel}>
              Total Budget {FINANCE_TYPE_LABEL[type]}
            </VixText>
            {/* 📋 = samakan dengan bulan lalu; abu-abu = sudah pernah */}
            <PressableScale
              style={[styles.copyChip, copied && styles.copyChipUsed]}
              onPress={handleCopyPress}
              disabled={copying}
              hitSlop={6}>
              {copying ? (
                <ActivityIndicator size="small" color={Color.TEXT_REVERSE} />
              ) : (
                <VixText heading="label" additionalStyle={styles.copyChipText}>
                  {copied ? '✓ 📋' : '📋'}
                </VixText>
              )}
            </PressableScale>
          </View>
          <VixText heading="subheader" additionalStyle={styles.summaryValue}>
            {formatRupiah(totalRealized)}{' '}
            <VixText heading="label" additionalStyle={styles.summaryLabel}>
              dari {formatRupiah(totalAllocated)}
            </VixText>
          </VixText>
          <ProgressBar percent={totalPercent} onDark />
          <VixText heading="label" additionalStyle={styles.summaryLabel}>
            {totalAllocated > 0
              ? `${totalPercent.toFixed(1)}% terpakai`
              : 'Belum ada budget — tekan kategori untuk mengatur.'}
          </VixText>
        </View>

        {rows.map((row) => {
          const percent =
            row.allocated > 0 ? (row.realized / row.allocated) * 100 : 0;
          const over = row.allocated > 0 && row.realized > row.allocated;
          return (
            // Tekan kategori untuk set/ubah budget-nya.
            <PressableScale
              key={row.key}
              style={styles.row}
              onPress={() => openEdit(row.category)}>
              <View style={styles.rowTop}>
                <VixText
                  heading="bold"
                  numberOfLines={1}
                  additionalStyle={styles.rowLabel}>
                  {row.category.icon} {row.category.label}
                </VixText>
                <VixText
                  heading="label"
                  additionalStyle={over ? styles.overText : undefined}>
                  {row.allocated > 0
                    ? `${percent.toFixed(0)}%`
                    : row.realized > 0
                      ? 'tanpa budget'
                      : '—'}
                </VixText>
              </View>
              <ProgressBar percent={percent} />
              <View style={styles.rowBottom}>
                <VixText heading="label">
                  Realisasi:{' '}
                  <VixText
                    heading="label"
                    additionalStyle={over ? styles.overText : styles.realText}>
                    {formatRupiah(row.realized)}
                  </VixText>
                </VixText>
                <VixText heading="label">
                  Budget: {formatRupiah(row.allocated)}
                </VixText>
              </View>
              {row.subCount > 0 && (
                <VixText heading="label" additionalStyle={styles.subHint}>
                  🧩 {row.subCount} sub-budget
                </VixText>
              )}
            </PressableScale>
          );
        })}
      </ScrollView>

      {/* Modal kecil: set budget kategori */}
      <CenterDialog visible={!!editing} onClose={() => setEditing(null)}>
        <VixText heading="title" additionalStyle={styles.modalTitle}>
          Set Budget
        </VixText>
        {editing && (
          <VixText heading="label" additionalStyle={styles.modalCategory}>
            {editing.icon} {editing.label} · {FINANCE_TYPE_LABEL[type]}
          </VixText>
        )}
        {/* Ada sub-budget → kolom ini jadi hasil penjumlahan (tidak diketik) */}
        <MoneyInput
          placeholder="Nominal budget"
          value={rolledUp ? groupDigits(String(subTotal)) : editAmount}
          onChangeText={(t) => setEditAmount(groupDigits(t))}
          autoFocus={!rolledUp}
          editable={!saving && !rolledUp}
        />
        <VixText heading="label" additionalStyle={styles.modalHint}>
          {rolledUp
            ? '🧮 Terisi otomatis dari total sub-budget di bawah.'
            : 'Isi 0 atau kosongkan untuk menghapus budget.'}
        </VixText>

        {/* Sub-budget: rincian di dalam kategori ini (mis. Groceries → Telur).
            Totalnya LANGSUNG jadi budget kategori di atas. */}
        <View style={styles.subSection}>
          <View style={styles.subHeader}>
            <VixText heading="bold" additionalStyle={styles.subTitle}>
              🧩 Sub-budget
            </VixText>
            <VixText heading="bold" additionalStyle={styles.subTotalText}>
              Total {formatRupiah(subTotal)}
            </VixText>
          </View>

          {subDraft.length > 0 && (
            <ScrollView style={styles.subScroll} nestedScrollEnabled>
              {subDraft.map((s) => {
                const real = editing
                  ? (subRealization.get(
                      subBudgetKey(type, editing.key, s.key),
                    ) ?? 0)
                  : 0;
                return (
                  <View key={s.key} style={styles.subRow}>
                    <View style={styles.subRowTop}>
                      <VixText
                        heading="bold"
                        numberOfLines={1}
                        additionalStyle={styles.subLabel}>
                        {s.label}
                      </VixText>
                      <VixText heading="label" additionalStyle={styles.realText}>
                        {formatRupiah(real)}
                      </VixText>
                      {/* Hapus sub — permanen begitu Simpan ditekan.
                          Sub bawaan (⛽ Bensin) tidak bisa dihapus. */}
                      {!s.builtin && (
                        <PressableScale
                          onPress={() => removeSub(s.key)}
                          disabled={saving}
                          hitSlop={10}>
                          <IconSymbol
                            name="xmark"
                            size={16}
                            color={Color.TEXT_PLACEHOLDER}
                          />
                        </PressableScale>
                      )}
                    </View>
                    <MoneyInput
                      placeholder="Nominal sub-budget"
                      value={s.amount}
                      onChangeText={(t) => changeSubAmount(s.key, t)}
                      editable={!saving}
                    />
                  </View>
                );
              })}
            </ScrollView>
          )}

          {/* Tambah sub baru — namanya bebas, diketik sendiri */}
          <View style={styles.subAddRow}>
            <FormInput
              style={styles.subAddInput}
              placeholder="Nama sub-budget"
              value={newSubLabel}
              onChangeText={setNewSubLabel}
              onSubmitEditing={addSub}
              returnKeyType="done"
              editable={!saving}
            />
            <PressableScale
              style={styles.subAddButton}
              onPress={addSub}
              disabled={saving}>
              <IconSymbol name="plus" size={20} color={Color.TEXT_REVERSE} />
            </PressableScale>
          </View>

          <VixText heading="label" additionalStyle={styles.modalHint}>
            {rolledUp
              ? 'Total sub inilah budget kategorinya. Butuh jatah bebas? Tambah sub “Lain-lain”.'
              : 'Isi sub-budget kalau mau dirinci — totalnya otomatis jadi budget kategori ini.'}
          </VixText>
        </View>

        <DualButtons
          confirmLabel="Simpan"
          busy={saving}
          onCancel={() => setEditing(null)}
          onConfirm={handleSave}
        />
      </CenterDialog>

      {/* Konfirmasi menyamakan ulang (menimpa budget bulan ini) */}
      <ConfirmDialog
        visible={confirmCopy}
        title="Samakan lagi dengan bulan lalu?"
        detail="Seluruh budget bulan ini akan DITIMPA dengan template bulan sebelumnya."
        confirmLabel="Samakan"
        busy={copying}
        onCancel={() => setConfirmCopy(false)}
        onConfirm={doCopy}
      />
    </View>
  );
}

// Bar kemajuan realisasi vs budget. Hijau normal → kuning saat pemakaian
// ≥75% → biru saat pas 100% (budget habis persis) → merah saat MELEBIHI 100%.
function ProgressBar({
  percent,
  onDark = false,
}: {
  percent: number;
  onDark?: boolean;
}) {
  const width = Math.max(0, Math.min(percent, 100));
  const fill =
    percent > 100
      ? Color.DANGER
      : percent >= 100
        ? Color.FINANCE_INVESTMENT_DARK
        : percent >= 75
          ? Color.BUDGET_WARN
          : Color.MAIN_LIGHT;
  return (
    <View style={[styles.barTrack, onDark && styles.barTrackDark]}>
      <View style={[styles.barFill, { width: `${width}%`, backgroundColor: fill }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  // Header menempel (tidak ikut scroll) berisi pilihan jenis kategori.
  stickyHeader: {
    paddingHorizontal: 20,
    paddingTop: 8,
    backgroundColor: Color.BACKGROUND,
  },
  content: { paddingHorizontal: 20, paddingTop: 2, paddingBottom: 24 },
  error: { color: Color.DANGER, marginBottom: 8 },
  summaryTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  copyChip: {
    backgroundColor: Color.MAIN,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    minWidth: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copyChipUsed: { backgroundColor: Color.TEXT_PLACEHOLDER },
  copyChipText: { color: Color.TEXT_REVERSE },
  summaryCard: {
    backgroundColor: Color.MAIN_DARK,
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    gap: 6,
  },
  summaryLabel: { color: Color.TEXT_ON_DARK_MUTED },
  summaryValue: { color: Color.TEXT_REVERSE },
  row: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Color.BORDER,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
    gap: 8,
  },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  rowLabel: { flex: 1, color: Color.TEXT_TITLE },
  rowBottom: { flexDirection: 'row', justifyContent: 'space-between' },
  realText: { color: Color.MAIN },
  overText: { color: Color.DANGER },
  barTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: Color.CONTRAST_CONTAINER,
    overflow: 'hidden',
  },
  barTrackDark: { backgroundColor: Color.MAIN },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },
  modalTitle: { marginBottom: 2 },
  modalCategory: { marginBottom: 12 },
  modalHint: { marginTop: 6 },
  // Penanda di baris kategori kalau ada rinciannya.
  subHint: { color: Color.TEXT_LABEL },
  // ===== Sub-budget di dalam modal Set Budget =====
  subSection: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Color.BORDER,
  },
  subHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  subTitle: { color: Color.TEXT_TITLE },
  // Total sub = budget kategorinya, jadi ditonjolkan warna utama.
  subTotalText: { color: Color.MAIN_DARK },
  // Dibatasi tingginya supaya dialog tidak memanjang keluar layar.
  subScroll: { maxHeight: 210 },
  subRow: { marginBottom: 10, gap: 6 },
  subRowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  subLabel: { flex: 1, color: Color.TEXT_TITLE },
  subAddRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  subAddInput: { flex: 1 },
  subAddButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Color.MAIN,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
