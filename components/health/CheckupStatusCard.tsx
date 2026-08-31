import { StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { VixText } from '@/components/common/VixText';
import { formatDate } from '@/lib/format';
import {
  CHECKUP_INFO,
  CHECKUP_TYPES,
  checkupDaysUntil,
  checkupNextDate,
  evaluateCheckup,
  type Checkup,
  type CheckupType,
} from '@/lib/health';

/**
 * Kartu lengkap satu jenis pemeriksaan — nilai terakhir, nilai normal, hasil,
 * tips kalau di luar normal, & kapan waktunya dicek lagi.
 *
 * Dulu kartu ini digambar langsung di sub-tab Check-up dan memakan hampir
 * seluruh layar untuk dua jenis saja. Sekarang tempatnya di layarnya sendiri
 * (app/checkup-status.tsx); sub-tabnya cukup satu kotak ringkas yang menuju ke
 * sana. Isi kartunya sendiri tidak berubah sedikit pun.
 */
export function CheckupStatusCard({
  meta,
  latest,
}: {
  meta: (typeof CHECKUP_TYPES)[number];
  latest?: Checkup;
}) {
  const info = CHECKUP_INFO[meta.key];
  if (!latest) {
    return (
      <View style={[styles.statusCard, styles.statusWarn]}>
        <VixText heading="bold" additionalStyle={styles.statusTitle}>
          {meta.icon} {meta.label}
        </VixText>
        <VixText heading="label" additionalStyle={styles.normalText}>
          Normal: {info.normal}
        </VixText>
        <VixText heading="label" additionalStyle={styles.warnText}>
          ⚠️ Belum pernah dicatat — segera periksa dan catat di sub-tab
          Check-up.
        </VixText>
      </View>
    );
  }

  const daysUntil = checkupDaysUntil(latest, new Date());
  const due = daysUntil <= 0;
  const nextDate = checkupNextDate(latest);
  const result = evaluateCheckup(meta.key, latest.value);
  const abnormal = result.status === 'high' || result.status === 'low';
  return (
    <View style={[styles.statusCard, due && styles.statusWarn]}>
      <View style={styles.statusHeader}>
        <VixText heading="bold" additionalStyle={styles.statusTitle}>
          {meta.icon} {meta.label}
        </VixText>
        <VixText heading="subheader" additionalStyle={styles.statusValue}>
          {latest.value}
        </VixText>
      </View>
      <VixText heading="label" additionalStyle={styles.normalText}>
        Normal: {info.normal}
      </VixText>
      {result.label ? (
        <VixText
          heading="bold"
          additionalStyle={
            result.status === 'normal' ? styles.okText : styles.abnormalText
          }>
          Hasil terakhir: {result.label}
        </VixText>
      ) : null}
      <VixText heading="label">
        Terakhir dicek: {formatDate(latest.date.toDate())}
      </VixText>
      {/* Kalau hasil terakhir tidak normal → tips + arahkan ke halaman Info */}
      {abnormal && result.tip ? (
        <View style={styles.adviceBox}>
          <VixText heading="label" additionalStyle={styles.adviceText}>
            💡 {result.tip}
          </VixText>
        </View>
      ) : null}
      {due ? (
        <VixText heading="label" additionalStyle={styles.warnText}>
          ⚠️ Waktunya cek lagi! Jadwal 6 bulan ({formatDate(nextDate)}) sudah
          {daysUntil === 0 ? ' tiba hari ini' : ` lewat ${-daysUntil} hari`}.
        </VixText>
      ) : (
        <VixText heading="label" additionalStyle={styles.nextText}>
          🗓️ Cek lagi: {formatDate(nextDate)} · {daysUntil} hari lagi
        </VixText>
      )}
    </View>
  );
}

/**
 * Ringkasan satu jenis untuk kotak gabungan: nilai + apakah perlu perhatian.
 * `null` di `latest` = belum pernah dicatat, dan itu sendiri sudah perlu
 * perhatian.
 */
export function checkupSummary(
  type: CheckupType,
  latest?: Checkup,
): { value: string; perhatian: boolean } {
  if (!latest) return { value: '—', perhatian: true };
  const hasil = evaluateCheckup(type, latest.value);
  const due = checkupDaysUntil(latest, new Date()) <= 0;
  return {
    value: latest.value,
    perhatian: due || hasil.status === 'high' || hasil.status === 'low',
  };
}

const styles = StyleSheet.create({
  statusCard: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Color.BORDER,
    padding: 16,
    marginBottom: 10,
    gap: 4,
  },
  statusWarn: {
    backgroundColor: Color.WARNING_TRANSPARENT,
    borderColor: Color.WARNING,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  statusTitle: { color: Color.TEXT_TITLE },
  statusValue: { color: Color.MAIN_DARK },
  warnText: { color: Color.WARNING },
  nextText: { color: Color.MAIN_DARK },
  normalText: { color: Color.TEXT_LABEL },
  okText: { color: Color.SUCCESS },
  abnormalText: { color: Color.DANGER },
  adviceBox: {
    backgroundColor: Color.CONTRAST_CONTAINER,
    borderRadius: 10,
    padding: 10,
    gap: 8,
    marginTop: 2,
  },
  adviceText: { color: Color.TEXT_PARAGRAPH },
});
