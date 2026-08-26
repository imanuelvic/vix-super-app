import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { CenterDialog } from '@/components/common/CenterDialog';
import { DualButtons } from '@/components/common/DualButtons';
import { FormError } from '@/components/common/FormError';
import { FormInput } from '@/components/common/FormInput';
import { MoneyInput } from '@/components/common/MoneyInput';
import { PressableScale } from '@/components/common/PressableScale';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { ProgressBar } from '@/components/common/ProgressBar';
import { VixText } from '@/components/common/VixText';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/contexts/auth';
import { useMonthCursor } from '@/hooks/useMonthCursor';
import {
  EMPTY_INSURANCE,
  insuranceMonthKey,
  saveInsuranceMonth,
  type InsuranceMonth,
  type InsuranceMonths,
} from '@/lib/career';
import { groupDigits, MONTH_NAMES, parseAmount } from '@/lib/format';
import { SAVE_ERROR } from '@/lib/messages';
import { formatRupiah } from '@/lib/transactions';

// Kartu satu metrik dengan counter − +.
//
// Sengaja di LUAR InsuranceTab: kalau didefinisikan di dalamnya, tiap render
// menghasilkan komponen "jenis baru" → React membongkar & memasang ulang kedua
// kartunya tiap satu angka berubah (kedip, dan kalau ada kolom isian fokusnya
// hilang). Isinya cuma bergantung pada prop, jadi tidak ada yang perlu ikut
// masuk ke dalam.
function MetricCard({
  icon,
  label,
  done,
  target,
  onDelta,
}: {
  icon: string;
  label: string;
  done: number;
  target: number;
  onDelta: (d: number) => void;
}) {
  const percent = target > 0 ? Math.min((done / target) * 100, 100) : 0;
  const hit = target > 0 && done >= target;
  return (
    <View style={styles.metricCard}>
      <View style={styles.metricTop}>
        <VixText heading="title">
          {icon} {label}
        </VixText>
        <View style={styles.counterRow}>
          <PressableScale
            style={styles.counterMinus}
            onPress={() => onDelta(-1)}
            hitSlop={6}>
            <VixText heading="bold" additionalStyle={styles.counterMinusText}>
              −
            </VixText>
          </PressableScale>
          <PressableScale
            style={styles.counterPlus}
            onPress={() => onDelta(1)}
            hitSlop={6}>
            <IconSymbol name="plus" size={18} color={Color.TEXT_REVERSE} />
          </PressableScale>
        </View>
      </View>
      <VixText heading="subheader" additionalStyle={styles.metricValue}>
        {done}
        <VixText heading="label"> / {target > 0 ? target : '—'} target</VixText>
      </VixText>
      <ProgressBar
        value={percent}
        total={100}
        height={8}
        color={hit ? Color.SUCCESS : Color.MAIN}
        track={Color.CONTRAST_CONTAINER}
      />
      {hit && (
        <VixText heading="label" additionalStyle={styles.hitText}>
          🎉 Target tercapai — luar biasa!
        </VixText>
      )}
    </View>
  );
}

// Tab Insurance 🛡️: target bulanan agent Manulife — pitching, closing,
// dan premi. Counter cepat (− +) untuk pencapaian, target di-set sendiri.
export function InsuranceTab({ months }: { months: InsuranceMonths }) {
  const { user } = useAuth();

  const now = new Date();
  const { year, month, shiftMonth, goNow } = useMonthCursor(now);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Dialog atur target & premi tercapai.
  const [targetOpen, setTargetOpen] = useState(false);
  const [fPitch, setFPitch] = useState('');
  const [fClose, setFClose] = useState('');
  const [fPremiTarget, setFPremiTarget] = useState('');
  const [fPremiDone, setFPremiDone] = useState('');

  const key = insuranceMonthKey(year, month);
  const data = months[key] ?? EMPTY_INSURANCE;

  async function update(partial: Partial<InsuranceMonth>) {
    if (!user) return;
    setError(null);
    try {
      await saveInsuranceMonth(user.uid, key, { ...data, ...partial });
    } catch {
      setError(SAVE_ERROR);
    }
  }

  function openTargets() {
    setFPitch(data.pitchTarget > 0 ? String(data.pitchTarget) : '');
    setFClose(data.closeTarget > 0 ? String(data.closeTarget) : '');
    setFPremiTarget(
      data.premiTarget > 0 ? groupDigits(String(data.premiTarget)) : '',
    );
    setFPremiDone(
      data.premiDone > 0 ? groupDigits(String(data.premiDone)) : '',
    );
    setTargetOpen(true);
  }

  async function handleSaveTargets() {
    if (busy) return;
    setBusy(true);
    await update({
      pitchTarget: parseAmount(fPitch),
      closeTarget: parseAmount(fClose),
      premiTarget: parseAmount(fPremiTarget),
      premiDone: parseAmount(fPremiDone),
    });
    setBusy(false);
    setTargetOpen(false);
  }

  const premiPercent =
    data.premiTarget > 0
      ? Math.min((data.premiDone / data.premiTarget) * 100, 100)
      : 0;
  const premiHit = data.premiTarget > 0 && data.premiDone >= data.premiTarget;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {/* Navigasi bulan */}
      <View style={styles.monthRow}>
        <PressableScale onPress={() => shiftMonth(-1)} hitSlop={10}>
          <IconSymbol name="chevron.left" size={20} color={Color.MAIN} />
        </PressableScale>
        {/* Tekan label bulan → balik ke bulan berjalan */}
        <PressableScale onPress={goNow} hitSlop={10}>
          <VixText heading="bold" additionalStyle={styles.monthText}>
            {MONTH_NAMES[month]} {year}
          </VixText>
        </PressableScale>
        <PressableScale onPress={() => shiftMonth(1)} hitSlop={10}>
          <IconSymbol name="chevron.right" size={20} color={Color.MAIN} />
        </PressableScale>
        <VixText heading="label" additionalStyle={styles.roleText}>
          🛡️ Agent Manulife
        </VixText>
      </View>

      <FormError message={error} />

      <MetricCard
        icon="🎯"
        label="Pitching"
        done={data.pitchDone}
        target={data.pitchTarget}
        onDelta={(d) =>
          update({ pitchDone: Math.max(0, data.pitchDone + d) })
        }
      />
      <MetricCard
        icon="🤝"
        label="Closing"
        done={data.closeDone}
        target={data.closeTarget}
        onDelta={(d) =>
          update({ closeDone: Math.max(0, data.closeDone + d) })
        }
      />

      {/* Premi (Rp) */}
      <View style={styles.metricCard}>
        <VixText heading="title">💰 Premi</VixText>
        <VixText heading="subheader" additionalStyle={styles.metricValue}>
          {formatRupiah(data.premiDone)}
          <VixText heading="label">
            {' '}
            / {data.premiTarget > 0 ? formatRupiah(data.premiTarget) : '—'}
          </VixText>
        </VixText>
        <ProgressBar
          value={premiPercent}
          total={100}
          height={8}
          color={premiHit ? Color.SUCCESS : Color.MAIN}
          track={Color.CONTRAST_CONTAINER}
        />
        {premiHit && (
          <VixText heading="label" additionalStyle={styles.hitText}>
            🎉 Target premi tercapai!
          </VixText>
        )}
      </View>

      <PrimaryButton
        label="⚙️ Atur Target & Premi Bulan Ini"
        onPress={openTargets}
      />
      <VixText heading="label" additionalStyle={styles.hint}>
        Tekan + tiap selesai pitching / closing — kecil-kecil, konsisten 💪
      </VixText>

      {/* Dialog atur target */}
      <CenterDialog visible={targetOpen} onClose={() => setTargetOpen(false)}>
        <VixText heading="title" additionalStyle={styles.modalTitle}>
          Target {MONTH_NAMES[month]} {year}
        </VixText>
        <VixText heading="label">Target pitching (orang)</VixText>
        <FormInput
          style={styles.modalInput}
          keyboardType="number-pad"
          value={fPitch}
          onChangeText={setFPitch}
          editable={!busy}
        />
        <VixText heading="label">Target closing (polis)</VixText>
        <FormInput
          style={styles.modalInput}
          keyboardType="number-pad"
          value={fClose}
          onChangeText={setFClose}
          editable={!busy}
        />
        <VixText heading="label">Target premi</VixText>
        <MoneyInput
          style={styles.modalInput}
          value={fPremiTarget}
          onChangeText={(t) => setFPremiTarget(groupDigits(t))}
          editable={!busy}
        />
        <VixText heading="label">Premi tercapai sejauh ini</VixText>
        <MoneyInput
          style={styles.modalInput}
          value={fPremiDone}
          onChangeText={(t) => setFPremiDone(groupDigits(t))}
          editable={!busy}
        />
        <DualButtons
          confirmLabel="Simpan"
          busy={busy}
          onCancel={() => setTargetOpen(false)}
          onConfirm={handleSaveTargets}
        />
      </CenterDialog>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  monthText: { minWidth: 130 },
  roleText: { marginLeft: 'auto' },
  metricCard: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Color.BORDER,
    padding: 16,
    gap: 8,
    marginBottom: 10,
  },
  metricTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metricValue: { color: Color.TEXT_TITLE },
  counterRow: { flexDirection: 'row', gap: 8 },
  counterMinus: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    borderColor: Color.BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterMinusText: { color: Color.TEXT_LABEL },
  counterPlus: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Color.MAIN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hitText: { color: Color.SUCCESS },
  hint: { textAlign: 'center', marginTop: 10 },
  modalTitle: { marginBottom: 10 },
  modalInput: { marginBottom: 10, marginTop: 4 },
});
