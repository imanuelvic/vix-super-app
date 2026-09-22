import { StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { CenterDialog } from '@/components/common/CenterDialog';
import { PressableScale } from '@/components/common/PressableScale';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { VixText } from '@/components/common/VixText';
import type { QuickCheck } from '@/lib/financeInsight';
import { formatRupiah } from '@/lib/transactions';

// 👀 Quick check: jeda sadar SEBELUM transaksi expense disimpan, hanya saat
// ambangnya terpenuhi (lib/financeInsight quickCheck: sisa jadi minus, sisa
// < 15%, atau nominalnya jauh di atas jatah harian). Bukan larangan, bukan
// rasa bersalah: cuma menaruh angka di depan mata lalu bertanya "masih sesuai
// rencanamu?". Keputusannya tetap milikmu; "Tetap Tambahkan" tetap ada dan
// sesudah itu kategori yang sama tidak ditanya lagi di hari yang sama.
export function QuickCheckDialog({
  check,
  amount,
  busy,
  onKeep,
  onCancel,
  onShowBudget,
}: {
  check: QuickCheck | null;
  amount: number;
  busy: boolean;
  onKeep: () => void;
  onCancel: () => void;
  onShowBudget: () => void;
}) {
  if (!check) return null;
  const c = check.category;
  const after = check.remainingAfter;
  return (
    <CenterDialog visible onClose={onCancel}>
      <VixText heading="title" additionalStyle={styles.title}>
        Quick check 👀
      </VixText>
      <VixText heading="label" additionalStyle={styles.sub}>
        {c.icon} {c.label} · {formatRupiah(amount)}
      </VixText>
      <VixText heading="paragraph" additionalStyle={styles.body}>
        Budget {c.label} kamu bulan ini tersisa {formatRupiah(check.remainingBefore)}.
        {'\n'}
        Setelah transaksi ini,{' '}
        {after >= 0
          ? `tersisa ${formatRupiah(after)}.`
          : `melewati budget sebesar ${formatRupiah(-after)}.`}
        {check.dailyAfter !== null && after > 0
          ? `\nJatah harian jadi sekitar ${formatRupiah(check.dailyAfter)} untuk ${check.daysLeft} hari ke depan.`
          : ''}
      </VixText>
      <VixText heading="bold" additionalStyle={styles.ask}>
        Masih sesuai rencanamu?
      </VixText>
      <View style={styles.actions}>
        <PrimaryButton label="Tetap Tambahkan" onPress={onKeep} busy={busy} />
        <View style={styles.links}>
          <PressableScale onPress={onCancel} hitSlop={8} disabled={busy}>
            <VixText heading="bold" additionalStyle={styles.link}>
              Batal
            </VixText>
          </PressableScale>
          <PressableScale onPress={onShowBudget} hitSlop={8} disabled={busy}>
            <VixText heading="bold" additionalStyle={styles.link}>
              Lihat Budget
            </VixText>
          </PressableScale>
        </View>
      </View>
    </CenterDialog>
  );
}

const styles = StyleSheet.create({
  title: { marginBottom: 2 },
  sub: { marginBottom: 10 },
  body: { color: Color.TEXT_PARAGRAPH },
  ask: { color: Color.TEXT_TITLE, marginTop: 10 },
  actions: { marginTop: 14, gap: 12 },
  links: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  link: { color: Color.MAIN_DARK },
});
