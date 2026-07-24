import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { CenterDialog } from '@/components/common/CenterDialog';
import { DualButtons } from '@/components/common/DualButtons';
import { FormInput } from '@/components/common/FormInput';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { VixText } from '@/components/common/VixText';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/contexts/auth';
import {
  EMPTY_INSURANCE,
  insuranceMonthKey,
  saveInsuranceMonth,
  type InsuranceMonth,
  type InsuranceMonths,
} from '@/lib/career';
import { groupDigits, MONTH_NAMES, parseAmount } from '@/lib/format';
import { formatRupiah } from '@/lib/transactions';

// Tab Insurance 🛡️: target bulanan agent Allianz — pitching, closing,
// dan premi. Counter cepat (− +) untuk pencapaian, target di-set sendiri.
export function InsuranceTab({ months }: { months: InsuranceMonths }) {
  const { user } = useAuth();

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0–11
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

  function shiftMonth(delta: number) {
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  }

  async function update(partial: Partial<InsuranceMonth>) {
    if (!user) return;
    setError(null);
    try {
      await saveInsuranceMonth(user.uid, key, { ...data, ...partial });
    } catch {
      setError('Gagal menyimpan. Coba lagi.');
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

  // Kartu satu metrik dengan counter − +.
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
            <Pressable
              style={styles.counterMinus}
              onPress={() => onDelta(-1)}
              hitSlop={6}>
              <VixText heading="bold" additionalStyle={styles.counterMinusText}>
                −
              </VixText>
            </Pressable>
            <Pressable
              style={styles.counterPlus}
              onPress={() => onDelta(1)}
              hitSlop={6}>
              <IconSymbol name="plus" size={18} color={Color.TEXT_REVERSE} />
            </Pressable>
          </View>
        </View>
        <VixText heading="subheader" additionalStyle={styles.metricValue}>
          {done}
          <VixText heading="label"> / {target > 0 ? target : '—'} target</VixText>
        </VixText>
        <View style={styles.barTrack}>
          <View
            style={[
              styles.barFill,
              { width: `${percent}%` },
              hit && styles.barFillHit,
            ]}
          />
        </View>
        {hit && (
          <VixText heading="label" additionalStyle={styles.hitText}>
            🎉 Target tercapai — luar biasa!
          </VixText>
        )}
      </View>
    );
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
        <Pressable onPress={() => shiftMonth(-1)} hitSlop={10}>
          <IconSymbol name="chevron.left" size={20} color={Color.MAIN} />
        </Pressable>
        <VixText heading="bold" additionalStyle={styles.monthText}>
          {MONTH_NAMES[month]} {year}
        </VixText>
        <Pressable onPress={() => shiftMonth(1)} hitSlop={10}>
          <IconSymbol name="chevron.right" size={20} color={Color.MAIN} />
        </Pressable>
        <VixText heading="label" additionalStyle={styles.roleText}>
          🛡️ Agent Allianz
        </VixText>
      </View>

      {error && (
        <VixText heading="label" additionalStyle={styles.error}>
          {error}
        </VixText>
      )}

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
        <View style={styles.barTrack}>
          <View
            style={[
              styles.barFill,
              { width: `${premiPercent}%` },
              premiHit && styles.barFillHit,
            ]}
          />
        </View>
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
        <VixText heading="label">Target premi (Rp)</VixText>
        <FormInput
          style={styles.modalInput}
          keyboardType="number-pad"
          value={fPremiTarget}
          onChangeText={(t) => setFPremiTarget(groupDigits(t))}
          editable={!busy}
        />
        <VixText heading="label">Premi tercapai sejauh ini (Rp)</VixText>
        <FormInput
          style={styles.modalInput}
          keyboardType="number-pad"
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
  error: { color: Color.DANGER, marginBottom: 8 },
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
  barTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: Color.CONTRAST_CONTAINER,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: Color.MAIN,
  },
  barFillHit: { backgroundColor: Color.SUCCESS },
  hitText: { color: Color.SUCCESS },
  hint: { textAlign: 'center', marginTop: 10 },
  modalTitle: { marginBottom: 10 },
  modalInput: { marginBottom: 10, marginTop: 4 },
});
