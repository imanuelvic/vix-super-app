import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { CARD_GAP } from '@/assets/style/card';
import { Color } from '@/assets/style/color';
import { DualButtons } from '@/components/common/DualButtons';
import { FormError } from '@/components/common/FormError';
import { FormInput } from '@/components/common/FormInput';
import { MoneyInput } from '@/components/common/MoneyInput';
import { PressableScale } from '@/components/common/PressableScale';
import { ProgressBar } from '@/components/common/ProgressBar';
import { SelectField } from '@/components/common/SelectField';
import { SheetModal } from '@/components/common/SheetModal';
import { VixText } from '@/components/common/VixText';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/contexts/auth';
import { useFormSave } from '@/hooks/useFormSave';
import { subsOf, type SubcategoryMap } from '@/lib/budgets';
import { activeCategories } from '@/lib/categories';
import {
  focusValid,
  newFocusId,
  saveFinanceFocus,
  type FocusItem,
  type FocusProgress,
} from '@/lib/financeFocus';
import { PACE_EMOJI } from '@/lib/financeInsight';
import { groupDigits, parseAmount } from '@/lib/format';
import { formatRupiah } from '@/lib/transactions';

// 🎯 Fokus minggu ini: batas yang kamu tetapkan sendiri untuk pengeluaran
// yang rawan (mis. Transportation › Gojek ≤ Rp150.000 & ≤ 4× seminggu).
// Checklist yang mengisi dirinya sendiri dari transaksi: progres nominal +
// jumlah kali, Senin s.d. Minggu. Ini "reminder untuk besok & seminggu ke
// depan" yang diminta: tiap membuka Finance kamu melihat sisa jatahnya.
//
// Warna status ikut PACE_EMOJI (🟢 aman · 🟡 ≥ 80% / jumlah sudah pas ·
// 🔴 lewat). Menghapus fokus = hilang dari array (hard delete).
export function FocusCard({
  progress,
  items,
  subcats,
}: {
  progress: FocusProgress[];
  items: FocusItem[];
  subcats: SubcategoryMap;
}) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<string | null>(null);
  const [sub, setSub] = useState<string | null>(null);
  const [limitAmount, setLimitAmount] = useState('');
  const [limitCount, setLimitCount] = useState('');
  const { busy, formError, setFormError, save, remove } = useFormSave();

  const subOptions = category ? subsOf(subcats, 'expense', category) : [];

  function reset() {
    setCategory(null);
    setSub(null);
    setLimitAmount('');
    setLimitCount('');
    setFormError(null);
  }

  async function tambah() {
    if (!user) return;
    const draft = {
      id: newFocusId(),
      category: category ?? '',
      sub: sub ?? '',
      limitAmount: parseAmount(limitAmount),
      limitCount: Math.max(0, Math.floor(Number(limitCount) || 0)),
    };
    if (!focusValid(draft)) {
      setFormError('Pilih kategorinya dan isi minimal satu batas (nominal atau jumlah kali).');
      return;
    }
    await save(async () => {
      await saveFinanceFocus(user.uid, [...items, draft]);
      reset();
      setOpen(false);
    });
  }

  async function hapus(id: string) {
    if (!user) return;
    await remove(() => saveFinanceFocus(user.uid, items.filter((f) => f.id !== id)));
  }

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <VixText heading="title">🎯 Fokus Minggu Ini</VixText>
        <PressableScale onPress={() => setOpen(true)} hitSlop={8}>
          <VixText heading="label" additionalStyle={styles.link}>
            + Tambah
          </VixText>
        </PressableScale>
      </View>
      {progress.length === 0 ? (
        <VixText heading="label">
          Belum ada fokus. Tetapkan batas mingguan untuk pengeluaran yang rawan
          (mis. Gojek ≤ 4× seminggu) supaya kamu diingatkan sebelum lewat.
        </VixText>
      ) : (
        progress.map((p) => {
          const amountPct =
            p.item.limitAmount > 0 ? (p.spent / p.item.limitAmount) * 100 : null;
          const countPct =
            p.item.limitCount > 0 ? (p.count / p.item.limitCount) * 100 : null;
          const pct = Math.max(amountPct ?? 0, countPct ?? 0);
          return (
            <View key={p.item.id} style={styles.row}>
              <View style={styles.rowTop}>
                <VixText heading="bold" numberOfLines={1} additionalStyle={styles.rowLabel}>
                  {PACE_EMOJI[p.status]} {p.category.icon} {p.category.label}
                  {p.subLabel ? ` › ${p.subLabel}` : ''}
                </VixText>
                <PressableScale onPress={() => hapus(p.item.id)} hitSlop={10} disabled={busy}>
                  <IconSymbol name="xmark" size={14} color={Color.TEXT_PLACEHOLDER} />
                </PressableScale>
              </View>
              <ProgressBar
                value={Math.min(100, pct)}
                total={100}
                height={6}
                color={
                  p.status === 'over'
                    ? Color.DANGER
                    : p.status === 'watch'
                      ? Color.BUDGET_WARN
                      : Color.MAIN_LIGHT
                }
                track={Color.CONTRAST_CONTAINER}
              />
              <VixText heading="label">
                {p.item.limitAmount > 0
                  ? `${formatRupiah(p.spent)} dari ${formatRupiah(p.item.limitAmount)}`
                  : `${formatRupiah(p.spent)} minggu ini`}
                {p.item.limitCount > 0 ? ` · ${p.count}× dari ${p.item.limitCount}×` : ` · ${p.count}×`}
                {p.leftText ? ` · ${p.leftText}` : ''}
              </VixText>
            </View>
          );
        })
      )}
      <FormError message={formError && !open ? formError : null} gap="top" />

      <SheetModal
        visible={open}
        title="🎯 Fokus baru"
        subtitle="Batas per minggu (Senin s.d. Minggu), berlaku terus sampai dihapus"
        onClose={() => {
          reset();
          setOpen(false);
        }}>
        <SelectField
          value={category}
          options={activeCategories('expense').map((c) => ({
            key: c.key,
            label: `${c.icon} ${c.label}`,
          }))}
          onChange={(k) => {
            setCategory(k);
            setSub(null);
          }}
          placeholder="Pilih kategori"
          disabled={busy}
        />
        {subOptions.length > 0 && (
          <View style={styles.gap}>
            <SelectField
              value={sub}
              options={subOptions.map((s) => ({ key: s.key, label: s.label }))}
              onChange={setSub}
              placeholder="Sub-kategori (opsional, mis. Gojek)"
              disabled={busy}
              clearable
            />
          </View>
        )}
        <View style={styles.gap}>
          <MoneyInput
            placeholder="Batas nominal per minggu (opsional)"
            value={limitAmount}
            onChangeText={(t) => setLimitAmount(groupDigits(t))}
            editable={!busy}
          />
        </View>
        <FormInput
          style={styles.gap}
          placeholder="Batas jumlah kali per minggu (opsional)"
          keyboardType="number-pad"
          value={limitCount}
          onChangeText={(t) => setLimitCount(t.replace(/[^0-9]/g, ''))}
          editable={!busy}
        />
        <FormError message={open ? formError : null} gap="top" />
        <DualButtons
          confirmLabel="Simpan"
          busy={busy}
          onCancel={() => {
            reset();
            setOpen(false);
          }}
          onConfirm={tambah}
        />
      </SheetModal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Color.BORDER,
    padding: 16,
    gap: 10,
    marginBottom: CARD_GAP,
  },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  link: { color: Color.MAIN_DARK },
  row: { gap: 5 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowLabel: { flex: 1, color: Color.TEXT_TITLE },
  gap: { marginTop: 8 },
});
