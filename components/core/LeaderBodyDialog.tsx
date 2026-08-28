import { StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { CenterDialog } from '@/components/common/CenterDialog';
import { InfoRow } from '@/components/common/InfoRow';
import { PressableScale } from '@/components/common/PressableScale';
import { VixText } from '@/components/common/VixText';
import { hasLeaderBody, type CoreLeader } from '@/lib/core';
import { dayIdToDate, formatDecimal, formatFullDate } from '@/lib/format';
import { bmiCategory, bmiValue, idealWeightRange } from '@/lib/health';

// Data Tubuh CL 🧍 — BACA SAJA.
//
// Gunanya memantau: apakah CL yang kamu gembalakan bergerak menuju badan yang
// sehat. Isinya sengaja jauh lebih pendek daripada Data Tubuh di Profile —
// itu data dirimu sendiri, ini data orang lain, dan tiga angka (tinggi, berat,
// lingkar perut) sudah cukup untuk menjawab pertanyaannya.
//
// TIDAK ada tombol ubah di sini. Mengubahnya lewat ✏️ seperti data CL yang
// lain, jadi cuma ada SATU pintu masuk perubahan — tidak ada dua form yang
// bisa berbeda pendapat, dan modal ini tidak pernah tidak sengaja tersimpan.

/** Warna penilaian — sama persis dengan kartu Data Tubuh di Profile. */
function toneColor(tone: 'ok' | 'warn' | 'danger'): string {
  return tone === 'ok'
    ? Color.SUCCESS
    : tone === 'warn'
      ? Color.WARNING
      : Color.DANGER;
}

export function LeaderBodyDialog({
  leader,
  onClose,
}: {
  leader: CoreLeader | null;
  onClose: () => void;
}) {
  const ada = leader ? hasLeaderBody(leader) : false;

  // Angka turunan hanya masuk akal kalau tinggi & beratnya lengkap.
  const lengkap = !!leader?.heightCm && !!leader?.weightKg;
  const bmi = lengkap ? bmiValue(leader!.weightKg!, leader!.heightCm!) : null;
  const kategori = bmi != null ? bmiCategory(bmi) : null;
  const ideal = leader?.heightCm ? idealWeightRange(leader.heightCm) : null;
  // Rasio perut/tinggi — patokan paling sederhana untuk lemak perut:
  // di bawah 0,5 berarti lingkar perut kurang dari setengah tinggi badan.
  const rasio =
    leader?.waistCm && leader?.heightCm
      ? leader.waistCm / leader.heightCm
      : null;

  return (
    <CenterDialog visible={!!leader} onClose={onClose}>
      {leader && (
        <>
          <VixText heading="title" additionalStyle={styles.title}>
            🧍 Data Tubuh {leader.name}
          </VixText>
          <VixText heading="label" additionalStyle={styles.updated}>
            {leader.bodyUpdatedDayId
              ? `Diperbarui: ${formatFullDate(dayIdToDate(leader.bodyUpdatedDayId))}`
              : 'Belum pernah diperbarui'}
          </VixText>

          {!ada ? (
            <VixText heading="paragraph" additionalStyle={styles.empty}>
              Belum ada data tubuh {leader.name}. Isi lewat tombol ✏️ — cukup
              tinggi, berat & lingkar perut.
            </VixText>
          ) : (
            <View style={styles.rows}>
              {leader.heightCm != null && (
                <InfoRow label="Tinggi" value={`${formatDecimal(leader.heightCm)} cm`} />
              )}
              {leader.weightKg != null && (
                <InfoRow label="Berat" value={`${formatDecimal(leader.weightKg)} kg`} />
              )}
              {ideal && (
                <InfoRow
                  label="Berat ideal"
                  value={`${formatDecimal(ideal.min)}–${formatDecimal(ideal.max)} kg`}
                />
              )}
              {bmi != null && kategori && (
                <InfoRow
                  label="BMI"
                  value={`${formatDecimal(bmi)} · ${kategori.label}`}
                  valueColor={toneColor(kategori.tone)}
                />
              )}
              {leader.waistCm != null && (
                <InfoRow
                  label="Lingkar perut"
                  value={`${formatDecimal(leader.waistCm)} cm`}
                />
              )}
              {rasio != null && (
                <InfoRow
                  label="Rasio perut/tinggi"
                  // Dua angka di belakang koma — sama seperti kartu Data Tubuh
                  // di Profile; 0,53 vs 0,5 memang bedanya di situ.
                  value={`${rasio.toFixed(2).replace('.', ',')} · ${rasio < 0.5 ? 'Sehat' : 'Perhatian'}`}
                  valueColor={toneColor(rasio < 0.5 ? 'ok' : 'warn')}
                />
              )}
              {!lengkap && (
                <VixText heading="label" additionalStyle={styles.partial}>
                  Isi tinggi & beratnya biar BMI dan berat idealnya ikut
                  terhitung.
                </VixText>
              )}
            </View>
          )}

          <PressableScale style={styles.close} onPress={onClose}>
            <VixText heading="label" additionalStyle={styles.closeText}>
              Tutup
            </VixText>
          </PressableScale>
        </>
      )}
    </CenterDialog>
  );
}

const styles = StyleSheet.create({
  title: { color: Color.TEXT_TITLE },
  updated: { marginTop: 2, marginBottom: 10 },
  empty: { color: Color.TEXT_PARAGRAPH },
  rows: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Color.BORDER,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  partial: { color: Color.TEXT_LABEL, paddingVertical: 10 },
  close: { alignItems: 'center', paddingVertical: 10, marginTop: 6 },
  closeText: { color: Color.TEXT_LABEL },
});
