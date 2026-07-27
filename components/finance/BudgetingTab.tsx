import { useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { CenterDialog } from '@/components/common/CenterDialog';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { DualButtons } from '@/components/common/DualButtons';
import { FormInput } from '@/components/common/FormInput';
import { PressableScale } from '@/components/common/PressableScale';
import { VixText } from '@/components/common/VixText';
import { TypeChips } from '@/components/finance/TypeChips';
import { useAuth } from '@/contexts/auth';
import {
  budgetKey,
  copyBudgetFromPreviousMonth,
  setBudgetAllocation,
  type BudgetMap,
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
}: {
  items: Transaction[];
  year: number;
  month: number;
  budget: BudgetMap;
  copied: boolean;
}) {
  const { user } = useAuth();

  const [type, setType] = useState<FinanceType>('expense');
  const [error, setError] = useState<string | null>(null);

  // Tombol "samakan dengan bulan lalu" — abu-abu kalau sudah pernah ditekan
  // untuk bulan ini (status `copied` disuplai dari layar Finance).
  const [copying, setCopying] = useState(false);
  const [confirmCopy, setConfirmCopy] = useState(false);

  // Modal set budget.
  const [editing, setEditing] = useState<FinanceCategory | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [saving, setSaving] = useState(false);

  // Realisasi per "jenis:kategori" dari seluruh transaksi bulan ini.
  const realization = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of items) {
      const key = budgetKey(t.type, t.category);
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
      }))
      .filter((r) => r.category.active || r.allocated > 0 || r.realized > 0);
  }, [type, budget, realization]) as BudgetRow[];

  const totalAllocated = rows.reduce((sum, r) => sum + r.allocated, 0);
  const totalRealized = rows.reduce((sum, r) => sum + r.realized, 0);
  const totalPercent =
    totalAllocated > 0 ? (totalRealized / totalAllocated) * 100 : 0;

  function openEdit(category: FinanceCategory) {
    setEditing(category);
    const current = budget[budgetKey(type, category.key)] ?? 0;
    setEditAmount(current > 0 ? groupDigits(String(current)) : '');
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
    const value = parseAmount(editAmount); // 0 = hapus budget
    setSaving(true);
    try {
      await setBudgetAllocation(user.uid, year, month, type, editing.key, value);
    } catch {
      setError('Gagal menyimpan budget. Coba lagi.');
    } finally {
      setEditing(null);
      setSaving(false);
    }
  }

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={styles.content}>
        <TypeChips value={type} onChange={setType} />

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
        <FormInput
          placeholder="Nominal budget (Rp)"
          keyboardType="number-pad"
          value={editAmount}
          onChangeText={(t) => setEditAmount(groupDigits(t))}
          autoFocus
          editable={!saving}
        />
        <VixText heading="label" additionalStyle={styles.modalHint}>
          Isi 0 atau kosongkan untuk menghapus budget.
        </VixText>
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
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 },
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
});
