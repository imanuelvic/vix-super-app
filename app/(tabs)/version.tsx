import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { PressableScale } from '@/components/common/PressableScale';
import { VixText } from '@/components/common/VixText';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/contexts/auth';
import {
  dayIdToDate,
  formatFullDate,
  formatShortDayDate,
  formatShortDayDateTime,
} from '@/lib/format';
import { dayDocId } from '@/lib/health';
import {
  aggregateDays,
  dayTotal,
  fetchUsageDays,
  formatWeekRange,
  resetPastWeeks,
  subscribeUsageDay,
  topFeatures,
  weekDayIds,
  type UsageDay,
} from '@/lib/usage';

type Message = { kind: 'info' | 'success' | 'error'; text: string };

// Hari lahir aplikasi ini: Selasa, 21 Juli 2026 🎂
const APP_BIRTHDAY = new Date(2026, 6, 21);

export default function VersionScreen() {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);

  // ===== Laporan pemakaian fitur 📊 (MINGGUAN, Senin–Minggu) =====
  const todayId = dayDocId(new Date());
  const weekRangeLabel = formatWeekRange();
  const [today, setToday] = useState<UsageDay | null>(null);
  const [week, setWeek] = useState<UsageDay[]>([]);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeUsageDay(user.uid, todayId, setToday);
    // Reset mingguan: hapus data minggu-minggu lalu (tak berpengaruh ke fetch).
    resetPastWeeks(user.uid).catch(() => {});
    fetchUsageDays(user.uid, weekDayIds())
      .then(setWeek)
      .catch(() => {});
    return unsub;
  }, [user, todayId]);

  // Gabung hari ini yang LIVE ke deret minggu (hero & daftar ikut ter-update).
  const weekMerged = week.map((d) =>
    today && d.dayId === todayId ? today : d,
  );
  const todayTop = today ? topFeatures(today, 5) : [];
  const weekTop = topFeatures(aggregateDays(weekMerged), 1)[0] ?? null;
  const weekTotal = weekMerged.reduce((sum, d) => sum + dayTotal(d), 0);

  // Versi app dari app.json — ini yang jadi runtimeVersion (policy appVersion).
  const appVersion = Constants.expoConfig?.version ?? '-';

  // Umur aplikasi sejak pertama dibuat.
  const appAgeDays =
    Math.floor((Date.now() - APP_BIRTHDAY.getTime()) / 86_400_000) + 1;

  async function handleCheckUpdate() {
    if (busy) return;
    // Di Expo Go / mode development, OTA update tidak aktif —
    // checkForUpdateAsync() akan reject. Beri tahu user, jangan error.
    if (__DEV__ || !Updates.isEnabled) {
      setMessage({
        kind: 'info',
        text: 'Update OTA hanya berfungsi di build EAS (bukan Expo Go / development).',
      });
      return;
    }
    setBusy(true);
    setMessage({ kind: 'info', text: 'Memeriksa update…' });
    try {
      const check = await Updates.checkForUpdateAsync();
      if (!check.isAvailable) {
        setMessage({ kind: 'success', text: 'Aplikasi sudah versi terbaru ✅' });
        return;
      }
      setMessage({ kind: 'info', text: 'Update ditemukan — mengunduh…' });
      await Updates.fetchUpdateAsync();
      setMessage({ kind: 'info', text: 'Memasang update…' });
      // Restart app dengan bundle baru — layar akan reload sendiri.
      await Updates.reloadAsync();
    } catch {
      setMessage({
        kind: 'error',
        text: 'Gagal memeriksa update. Cek koneksi internet lalu coba lagi.',
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <VixText heading="header" additionalStyle={styles.title}>
          System ⚙️
        </VixText>

        {/* ===== Laporan pemakaian fitur (mingguan) ===== */}
        <View style={styles.usageHero}>
          <VixText heading="label" additionalStyle={styles.usageHeroLabel}>
            📊 Fitur paling sering · minggu ini
          </VixText>
          <VixText heading="subheader" additionalStyle={styles.usageHeroValue}>
            {weekTop ? `${weekTop.label}` : 'Belum ada data'}
          </VixText>
          <VixText heading="label" additionalStyle={styles.usageHeroLabel}>
            {weekTop
              ? `${weekTop.count}× · total ${weekTotal} kali buka fitur`
              : 'Buka fitur dari grid Home untuk mulai tercatat 📈'}
          </VixText>
          <VixText heading="label" additionalStyle={styles.usageHeroLabel}>
            🗓️ {weekRangeLabel} (Sen–Min) · reset tiap Senin
          </VixText>
        </View>

        {/* Hari ini */}
        <VixText heading="title" additionalStyle={styles.sectionTitle}>
          Hari Ini
        </VixText>
        <View style={styles.usageCard}>
          {todayTop.length === 0 ? (
            <VixText heading="label" additionalStyle={styles.usageEmpty}>
              Belum buka fitur apa pun hari ini.
            </VixText>
          ) : (
            todayTop.map((f, i) => (
              <View key={f.key} style={styles.usageRow}>
                <VixText heading="bold" additionalStyle={styles.usageRank}>
                  {i + 1}
                </VixText>
                <VixText heading="paragraph" additionalStyle={styles.usageName}>
                  {f.label}
                </VixText>
                <VixText heading="bold" additionalStyle={styles.usageCount}>
                  {f.count}×
                </VixText>
              </View>
            ))
          )}
        </View>

        {/* Per hari (minggu berjalan) — fitur teratas tiap hari */}
        <VixText heading="title" additionalStyle={styles.sectionTitle}>
          Per Hari — Minggu Ini
        </VixText>
        <View style={styles.usageCard}>
          {weekMerged.length === 0 ? (
            <VixText heading="label" additionalStyle={styles.usageEmpty}>
              Belum ada aktivitas minggu ini.
            </VixText>
          ) : (
            weekMerged.map((d) => {
              const top = topFeatures(d, 1)[0];
              return (
                <View key={d.dayId} style={styles.usageRow}>
                  <VixText heading="label" additionalStyle={styles.usageDay}>
                    {formatShortDayDate(dayIdToDate(d.dayId))}
                  </VixText>
                  <VixText
                    heading="paragraph"
                    additionalStyle={top ? styles.usageName : styles.usageEmpty}>
                    {top ? `${top.label} (${top.count}×)` : '—'}
                  </VixText>
                </View>
              );
            })
          )}
        </View>

        <VixText heading="title" additionalStyle={styles.sectionTitle}>
          Aplikasi
        </VixText>

        {/* Kartu versi terpasang */}
        <View style={styles.versionCard}>
          <VixText heading="label" additionalStyle={styles.versionLabel}>
            Versi Aplikasi
          </VixText>
          <VixText heading="header" additionalStyle={styles.versionValue}>
            v{appVersion}
          </VixText>
          <VixText heading="label" additionalStyle={styles.versionLabel}>
            🎂 Hari ke-{appAgeDays} sejak dibuat
          </VixText>
        </View>

        {/* Detail teknis — berguna saat cek kenapa update tidak masuk */}
        <View style={styles.detailCard}>
          <DetailRow label="Dibuat" value={formatFullDate(APP_BIRTHDAY)} />
          <DetailRow
            label="Update terakhir"
            value={
              Updates.isEmbeddedLaunch || !Updates.createdAt
                ? 'Belum ada — bundle build'
                : formatShortDayDateTime(Updates.createdAt)
            }
          />
          <DetailRow label="Runtime" value={Updates.runtimeVersion ?? '-'} />
          <DetailRow label="Channel" value={Updates.channel ?? 'development'} />
          <DetailRow
            label="Update ID"
            value={Updates.updateId ? Updates.updateId.slice(0, 8) : '-'}
          />
        </View>

        <PressableScale
          style={[styles.updateButton, busy && styles.updateButtonBusy]}
          onPress={handleCheckUpdate}
          disabled={busy}>
          {busy ? (
            <ActivityIndicator color={Color.TEXT_REVERSE} />
          ) : (
            <IconSymbol
              name="arrow.triangle.2.circlepath"
              size={20}
              color={Color.TEXT_REVERSE}
            />
          )}
          <VixText heading="bold" additionalStyle={styles.updateButtonText}>
            Update Terbaru
          </VixText>
        </PressableScale>

        {message && (
          <VixText
            heading="label"
            additionalStyle={[
              styles.message,
              message.kind === 'success' && styles.messageSuccess,
              message.kind === 'error' && styles.messageError,
            ]}>
            {message.text}
          </VixText>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// Baris label–nilai di kartu detail.
function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <VixText heading="label">{label}</VixText>
      <VixText heading="bold" additionalStyle={styles.detailValue}>
        {value}
      </VixText>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.BACKGROUND },
  content: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40 },
  title: { color: Color.MAIN, marginBottom: 16 },
  sectionTitle: { marginTop: 6, marginBottom: 10 },
  // Laporan pemakaian 📊
  usageHero: {
    backgroundColor: Color.MAIN_DARK,
    borderRadius: 20,
    padding: 20,
    gap: 4,
    marginBottom: 6,
  },
  usageHeroLabel: { color: Color.TEXT_ON_DARK_MUTED },
  usageHeroValue: { color: Color.TEXT_REVERSE },
  usageCard: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Color.BORDER,
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginBottom: 16,
  },
  usageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  usageRank: {
    color: Color.MAIN_DARK,
    width: 20,
    textAlign: 'center',
  },
  usageDay: { color: Color.TEXT_LABEL, width: 96 },
  usageName: { color: Color.TEXT_TITLE, flex: 1 },
  usageCount: { color: Color.MAIN_DARK },
  usageEmpty: { color: Color.TEXT_PLACEHOLDER, flex: 1, paddingVertical: 4 },
  versionCard: {
    backgroundColor: Color.MAIN_DARK,
    borderRadius: 20,
    padding: 22,
    alignItems: 'center',
    gap: 6,
    marginBottom: 14,
  },
  versionLabel: { color: Color.TEXT_ON_DARK_MUTED, textAlign: 'center' },
  versionValue: { color: Color.TEXT_REVERSE },
  detailCard: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Color.BORDER,
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  detailValue: { color: Color.TEXT_TITLE, flexShrink: 1, textAlign: 'right' },
  updateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Color.MAIN,
    borderRadius: 14,
    paddingVertical: 14,
  },
  updateButtonBusy: { opacity: 0.7 },
  updateButtonText: { color: Color.TEXT_REVERSE },
  message: { textAlign: 'center', marginTop: 12 },
  messageSuccess: { color: Color.SUCCESS },
  messageError: { color: Color.DANGER },
});
