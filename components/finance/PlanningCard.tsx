import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { CARD_GAP } from '@/assets/style/card';
import { Color } from '@/assets/style/color';
import { PressableScale } from '@/components/common/PressableScale';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { VixText } from '@/components/common/VixText';
import { IconSymbol } from '@/components/ui/icon-symbol';
import type { BudgetDoc } from '@/lib/budgets';
import { planRollup } from '@/lib/financeInsight';
import { formatTinyDate, MONTH_NAMES } from '@/lib/format';
import { formatRupiah } from '@/lib/transactions';

// 🗓️ Monthly Planning + 🔒 Budget Lock di sub-tab Budgeting.
//
// Alur awal bulan: Income → Fixed → Variable → Savings → Emergency Fund →
// Investment → sisa Flexible, dihitung dari alokasi per kategori yang sudah
// kamu isi (tidak ada persentase universal yang dipaksakan; angkanya
// persentase dari income-mu sendiri). Ditutup dengan jatah mingguan/harian
// kategori variable, lalu tombol Lock.
//
// Sesudah dikunci kartunya menyusut jadi satu baris status (komitmen sudah
// dibuat, tidak perlu dilihat lagi tiap buka), bisa dibuka kembali.
export function PlanningCard({
  budgetDoc,
  year,
  month,
  onLock,
  onUnlock,
}: {
  budgetDoc: BudgetDoc;
  year: number;
  month: number;
  onLock: () => void;
  onUnlock: () => void;
}) {
  const [open, setOpen] = useState<boolean | null>(null);
  const plan = planRollup(budgetDoc.allocations, year, month);
  const adaAlokasi = Object.keys(budgetDoc.allocations).length > 0;
  const terbuka = open ?? !budgetDoc.locked;
  const lastUnlock = budgetDoc.unlocks[budgetDoc.unlocks.length - 1];

  return (
    <View style={styles.card}>
      <PressableScale style={styles.head} onPress={() => setOpen(!terbuka)}>
        <View style={styles.headMain}>
          <VixText heading="title">🗓️ Monthly Planning</VixText>
          <VixText heading="label">
            {budgetDoc.locked
              ? `🔒 Terkunci${budgetDoc.lockedAt ? ` sejak ${formatTinyDate(budgetDoc.lockedAt.toDate())}` : ''} · komitmen ${MONTH_NAMES[month]}`
              : adaAlokasi
                ? '🔓 Belum dikunci · masih bisa diubah bebas'
                : 'Isi budget per kategori dulu, lalu kunci'}
          </VixText>
        </View>
        <IconSymbol
          name={terbuka ? 'chevron.up' : 'chevron.down'}
          size={18}
          color={Color.TEXT_LABEL}
        />
      </PressableScale>

      {terbuka && (
        <>
          {plan.groups.map((g) => (
            <View key={g.key} style={styles.row}>
              <VixText heading="paragraph" additionalStyle={styles.rowLabel}>
                {g.emoji} {g.label}
              </VixText>
              <View style={styles.rowRight}>
                <VixText
                  heading="bold"
                  additionalStyle={g.key === 'flexible' && g.amount < 0 ? styles.minus : styles.rowValue}>
                  {formatRupiah(g.amount)}
                </VixText>
                <VixText heading="label" additionalStyle={styles.pct}>
                  {g.pct === null ? '' : `${Math.round(g.pct)}%`}
                </VixText>
              </View>
            </View>
          ))}
          <View style={styles.sep} />
          <VixText heading="label">
            Total alokasi {formatRupiah(plan.allocated)}
            {plan.income > 0 ? ` (${Math.round((plan.allocated / plan.income) * 100)}% dari income)` : ''}
            {plan.flexible < 0 ? ' Alokasi melebihi rencana income.' : ''}
          </VixText>
          <VixText heading="label">
            Jatah kategori harian: {formatRupiah(plan.weeklyAllowance)}/minggu{'\n'}
            {formatRupiah(plan.dailyAllowance)}/hari ({plan.daysInMonth} hari)
          </VixText>
          {budgetDoc.unlocks.length > 0 && (
            <VixText heading="label" additionalStyle={styles.unlockNote}>
              🔓 Pernah di-unlock {budgetDoc.unlocks.length}×
              {lastUnlock?.reason ? ` · terakhir: "${lastUnlock.reason}"` : ''}
            </VixText>
          )}
          {budgetDoc.locked ? (
            <PressableScale onPress={onUnlock} hitSlop={8} style={styles.unlockLink}>
              <VixText heading="label" additionalStyle={styles.link}>
                Unlock Budget (butuh alasan)
              </VixText>
            </PressableScale>
          ) : (
            <View style={styles.lockWrap}>
              <PrimaryButton
                label="🔒 Lock Budget Bulan Ini"
                onPress={onLock}
                background={adaAlokasi ? Color.MAIN_DARK : Color.DISABLED}
              />
            </View>
          )}
        </>
      )}
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
    gap: 8,
    marginBottom: CARD_GAP,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headMain: { flex: 1, gap: 1 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  rowLabel: { flex: 1, color: Color.TEXT_TITLE },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowValue: { color: Color.TEXT_TITLE },
  minus: { color: Color.DANGER },
  pct: { width: 38, textAlign: 'right' },
  sep: { height: 1, backgroundColor: Color.BORDER, marginVertical: 2 },
  unlockNote: { color: Color.WARNING },
  unlockLink: { alignSelf: 'flex-start', marginTop: 4 },
  link: { color: Color.MAIN_DARK, textDecorationLine: 'underline' },
  lockWrap: { marginTop: 4, gap: 6 },
});
