import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { CenterDialog } from '@/components/common/CenterDialog';
import { DualButtons } from '@/components/common/DualButtons';
import { FormError } from '@/components/common/FormError';
import { FormInput } from '@/components/common/FormInput';
import { PressableScale } from '@/components/common/PressableScale';
import { ProgressBar } from '@/components/common/ProgressBar';
import { VixText } from '@/components/common/VixText';
import { useAuth } from '@/contexts/auth';
import { useFormSave } from '@/hooks/useFormSave';
import { formatDecimal, parseDecimal } from '@/lib/format';
import {
  clearWeekTarget,
  saveWeekTarget,
  subscribeWeekTarget,
  WEEK_TARGET_DEFAULT_KM,
  weekTargetLeft,
  type WeekDistanceTarget,
} from '@/lib/health';

// Kartu 🎯 Target Langkah Mingguan — target jarak yang KAMU tentukan sendiri,
// dengan tulisan "sisa sekian lagi", persis pola target berat di layar Habits.
//
// Bedanya dengan kartu "Target Sehat Mingguan" di bawahnya: yang itu ANJURAN
// umum untuk orang dewasa (±150 menit aerobik + 2 hari strength). Yang ini
// milikmu — dan seperti akumulasi mingguannya, ia mulai dari nol lagi tiap
// Senin jam 00.00.
export function WeekTargetCard({ km }: { km: number }) {
  const { user } = useAuth();
  const [target, setTarget] = useState<WeekDistanceTarget | null>(null);
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const { busy, formError, setFormError, save, remove } = useFormSave();

  useEffect(() => {
    if (!user) return;
    return subscribeWeekTarget(user.uid, setTarget);
  }, [user]);

  function bukaDialog() {
    setInput(
      target ? formatDecimal(target.km) : String(WEEK_TARGET_DEFAULT_KM),
    );
    setFormError(null);
    setOpen(true);
  }

  async function simpan() {
    if (!user || busy) return;
    const nilai = parseDecimal(input);
    if (!nilai || nilai <= 0) {
      setFormError('Isi targetnya dalam km, mis. 25.');
      return;
    }
    await save(async () => {
      await saveWeekTarget(user.uid, nilai);
      setOpen(false);
    });
  }

  async function hapus() {
    if (!user || busy) return;
    await remove(async () => {
      await clearWeekTarget(user.uid);
      setOpen(false);
    });
  }

  // Belum dipasang → kartunya jadi ajakan memasangnya, bukan kartu kosong.
  if (!target) {
    return (
      <PressableScale style={styles.card} onPress={bukaDialog}>
        <VixText heading="title" additionalStyle={styles.title}>
          🎯 Target Langkah Mingguan
        </VixText>
        <VixText heading="label" additionalStyle={styles.hint}>
          Belum dipasang. Tentukan targetmu minggu ini — biar ada yang dikejar,
          bukan cuma dicatat ›
        </VixText>
        {dialog()}
      </PressableScale>
    );
  }

  const sisa = weekTargetLeft(km, target.km);
  const tercapai = sisa === 0;
  return (
    <PressableScale style={styles.card} onPress={bukaDialog}>
      <View style={styles.top}>
        <VixText heading="title" additionalStyle={styles.title}>
          🎯 Target Langkah Mingguan
        </VixText>
        <VixText heading="subheader" additionalStyle={styles.value}>
          {formatDecimal(km)} / {formatDecimal(target.km)} km
        </VixText>
      </View>
      <ProgressBar value={km} total={target.km} color={Color.MAIN_DARK} />
      <VixText
        heading="bold"
        additionalStyle={tercapai ? styles.done : styles.left}>
        {tercapai
          ? '✅ Target minggu ini tercapai 🎉'
          : `Sisa ${formatDecimal(sisa)} km lagi minggu ini 💪`}
      </VixText>
      {dialog()}
    </PressableScale>
  );

  function dialog() {
    return (
      <CenterDialog visible={open} onClose={() => setOpen(false)}>
        <VixText heading="title" additionalStyle={styles.dialogTitle}>
          🎯 Target Langkah Mingguan
        </VixText>
        <FormInput
          placeholder="mis. 25"
          value={input}
          onChangeText={setInput}
          keyboardType="decimal-pad"
          editable={!busy}
          autoFocus
        />
        <FormError message={formError} gap="top" />
        {target && (
          <PressableScale
            style={styles.clearButton}
            onPress={hapus}
            disabled={busy}>
            <VixText heading="bold" additionalStyle={styles.clearText}>
              Hapus target
            </VixText>
          </PressableScale>
        )}
        <DualButtons
          confirmLabel="Simpan"
          busy={busy}
          onCancel={() => setOpen(false)}
          onConfirm={simpan}
        />
      </CenterDialog>
    );
  }
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Color.MAIN,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 10,
    gap: 6,
  },
  // "🎯 Target Langkah Mingguan" + "47,7 / 20 km" hampir tak muat sebaris di
  // iPhone 15 — dan begitu angkanya jadi lima digit, angkanya yang terpotong
  // keluar kartu. `flexWrap` menurunkannya ke baris berikutnya (lihat catatan
  // lengkapnya di StepsTab).
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  title: { color: Color.TEXT_TITLE },
  value: { color: Color.MAIN_DARK },
  hint: { color: Color.TEXT_LABEL },
  left: { color: Color.MAIN_DARK },
  done: { color: Color.SUCCESS },
  dialogTitle: { marginBottom: 4 },
  clearButton: { alignItems: 'center', paddingVertical: 10, marginTop: 4 },
  clearText: { color: Color.DANGER },
});
