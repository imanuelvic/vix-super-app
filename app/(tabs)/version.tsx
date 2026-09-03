import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { PressableScale } from '@/components/common/PressableScale';
import { VixText } from '@/components/common/VixText';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/contexts/auth';
import { useNow } from '@/hooks/useNow';
import { useScrollTop } from '@/hooks/useScrollTop';
import { dayIdToDate, formatShortDayDate, monthLabel } from '@/lib/format';
import {
  aggregateDays,
  dayTotal,
  fetchUsageDays,
  formatMonthRange,
  formatWeekRange,
  monthDayIds,
  resetPastMonths,
  subscribeUsageDay,
  topFeatures,
  weekDayIds,
  type UsageDay,
} from '@/lib/usage';

// Tab System ⚙️ — laporan pemakaian fitur.
//
// Versi app & tombol update PINDAH ke layar sendiri (app/app-version.tsx),
// pintunya pil "📱 Aplikasi" di pojok kanan judul.
export default function VersionScreen() {
  const { user } = useAuth();
  const router = useRouter();

  // Tekan tab System lagi saat halamannya sedang dibuka → balik ke paling atas.
  const { ref: scrollRef } = useScrollTop();

  // ===== Laporan pemakaian fitur 📊 =====
  // Dua lapis: ringkasan BULAN berjalan + rincian MINGGU berjalan. Yang diambil
  // dari Firestore CUMA satu deret — hari-hari bulan ini (paling banyak 31
  // dokumen kecil, sekali baca saat tab dibuka). Minggu ini tinggal disaring
  // dari deret yang sama, jadi tidak ada pembacaan tambahan.
  // Jam berjalan (hook bersama) — bukan `new Date()` lepas saat render.
  // Dua untungnya: render jadi murni (React Compiler tidak lagi menandainya),
  // dan lewat tengah malam `todayId` ikut berganti sendiri, jadi layar ini
  // tidak menampilkan angka kemarin kalau dibiarkan terbuka semalaman.
  const { todayId } = useNow();
  const thisMonth = monthLabel();
  const monthRangeLabel = formatMonthRange();
  const weekRangeLabel = formatWeekRange();
  const [today, setToday] = useState<UsageDay | null>(null);
  const [month, setMonth] = useState<UsageDay[]>([]);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeUsageDay(user.uid, todayId, setToday);
    // Reset bulanan: hapus data bulan-bulan lalu (tak berpengaruh ke fetch).
    resetPastMonths(user.uid).catch(() => {});
    fetchUsageDays(user.uid, monthDayIds())
      .then(setMonth)
      .catch(() => {});
    return unsub;
  }, [user, todayId]);

  // Gabung hari ini yang LIVE ke deret bulan (semua angka ikut ter-update).
  const monthMerged = month.map((d) =>
    today && d.dayId === todayId ? today : d,
  );
  // Minggu berjalan = bagian ekor deret bulan (Senin s/d hari ini). Awal bulan
  // yang jatuh di tengah minggu tetap benar: yang dipakai daftar hari Senin-nya,
  // bukan tanggalnya.
  const weekIds = weekDayIds();
  const weekMerged = monthMerged.filter((d) => weekIds.includes(d.dayId));

  const todayTop = today ? topFeatures(today, 5) : [];
  const monthTop = topFeatures(aggregateDays(monthMerged), 1)[0] ?? null;
  const monthTotal = monthMerged.reduce((sum, d) => sum + dayTotal(d), 0);
  const weekTop = topFeatures(aggregateDays(weekMerged), 1)[0] ?? null;
  const weekTotal = weekMerged.reduce((sum, d) => sum + dayTotal(d), 0);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView ref={scrollRef} contentContainerStyle={styles.content}>
        {/* Judul + pintu ke layar Version 📱 (versi terpasang & tarik update).
            Isinya dulu menempel di ujung bawah layar ini, terkubur di bawah
            laporan pemakaian — justru saat paling dibutuhkan. */}
        <View style={styles.titleRow}>
          <VixText heading="header" additionalStyle={styles.title}>
            System ⚙️
          </VixText>
          <PressableScale
            style={styles.appButton}
            onPress={() => router.push('/app-version')}
            hitSlop={8}>
            <IconSymbol name="iphone" size={16} color={Color.MAIN_DARK} />
            <VixText heading="bold" additionalStyle={styles.appButtonText}>
              Aplikasi
            </VixText>
          </PressableScale>
        </View>

        {/* ===== Fitur paling sering: minggu ini (kiri) & bulan ini (kanan) =====
            Sebelahan, bukan bertumpuk — keduanya menjawab pertanyaan yang sama
            ("fitur apa yang paling sering kubuka?") untuk dua rentang waktu,
            jadi memang untuk DIBANDINGKAN. Ditumpuk ke bawah, mata harus
            mengingat angka kartu atas sambil membaca kartu bawah.
            Kata-katanya ikut dipendekkan supaya muat di setengah lebar. */}
        <View style={styles.usageRowHero}>
          <View style={styles.usageHero}>
            <VixText heading="label" additionalStyle={styles.usageHeroLabel}>
              📊 Minggu ini
            </VixText>
            <VixText heading="subheader" additionalStyle={styles.usageHeroValue}>
              {weekTop ? `${weekTop.label}` : '—'}
            </VixText>
            <VixText heading="label" additionalStyle={styles.usageHeroLabel}>
              {weekTop ? `${weekTop.count}× · ${weekTotal} total` : 'Belum ada data'}
            </VixText>
            <VixText heading="label" additionalStyle={styles.usageHeroLabel}>
              🗓️ {weekRangeLabel}
            </VixText>
          </View>

          <View style={styles.usageHero}>
            <VixText heading="label" additionalStyle={styles.usageHeroLabel}>
              📊 Bulan {thisMonth}
            </VixText>
            <VixText heading="subheader" additionalStyle={styles.usageHeroValue}>
              {monthTop ? `${monthTop.label}` : '—'}
            </VixText>
            <VixText heading="label" additionalStyle={styles.usageHeroLabel}>
              {monthTop ? `${monthTop.count}× · ${monthTotal} total` : 'Belum ada data'}
            </VixText>
            <VixText heading="label" additionalStyle={styles.usageHeroLabel}>
              🗓️ {monthRangeLabel}
            </VixText>
          </View>
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

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.BACKGROUND },
  content: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  title: { color: Color.MAIN, marginBottom: 16 },
  // Pil "📱 Aplikasi" di pojok kanan judul — pintu ke layar Version.
  appButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Color.MAIN,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 16,
  },
  appButtonText: { color: Color.MAIN_DARK },
  sectionTitle: { marginTop: 6, marginBottom: 10 },
  // Laporan pemakaian 📊
  // Dua kartu sebelahan; `alignItems: 'stretch'` (bawaan) menyamakan tingginya
  // walau nama fiturnya beda panjang, jadi tak ada yang menggantung.
  usageRowHero: { flexDirection: 'row', gap: 10, marginBottom: 6 },
  usageHero: {
    flex: 1,
    backgroundColor: Color.MAIN_DARK,
    borderRadius: 20,
    // Padding dikecilkan dari 20 → 16: di setengah lebar, 20 di kiri-kanan
    // memakan terlalu banyak ruang teks.
    padding: 16,
    gap: 4,
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
