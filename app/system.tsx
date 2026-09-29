import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { SCREEN_CONTENT, SCREEN_SAFE } from '@/assets/style/layout';
import { SECTION_SPACE } from '@/assets/style/section';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { PressableScale } from '@/components/common/PressableScale';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { ScreenError } from '@/components/common/ScreenError';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { VixText } from '@/components/common/VixText';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/contexts/auth';
import { useBusyTask } from '@/hooks/useBusyTask';
import { useLive } from '@/hooks/useLive';
import { useNow } from '@/hooks/useNow';
import { useScrollTop } from '@/hooks/useScrollTop';
import {
  backupDue,
  backupDueLine,
  backupLine,
  EMPTY_BACKUP,
  recordBackup,
  subscribeBackupInfo,
  type BackupInfo,
} from '@/lib/backup';
import {
  exportAllData,
  exportFileName,
  formatBytes,
  shareExport,
} from '@/lib/dataExport';
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
  const { user, logout } = useAuth();
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

  // ===== Cadangan data 📦 =====
  // Satu-satunya tempat di app ini yang membaca SEMUA dokumen sekaligus, jadi
  // ia cuma jalan saat tombolnya di-click. Tidak ada langganan, tidak ada
  // pemanggilan otomatis saat layar dibuka.
  const { busy, run } = useBusyTask<'ekspor' | 'keluar'>();
  const [exportNote, setExportNote] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportStep, setExportStep] = useState<string | null>(null);

  // ===== Keluar dari akun 🚪 =====
  const [confirmKeluar, setConfirmKeluar] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  async function onLogout() {
    await run({
      key: 'keluar',
      start: () => setLogoutError(null),
      task: async () => {
        await logout();
        setConfirmKeluar(false);
      },
      // Gagal → dialognya ditutup dan galatnya tampil di KARTU, satu tempat
      // dengan galat ekspor. Kalau dibiarkan di dalam dialog, pesannya ikut
      // hilang begitu dialognya ditutup, dan kamu tidak pernah tahu kenapa
      // tadi tidak jadi keluar.
      fail: () => {
        setConfirmKeluar(false);
        setLogoutError('Gagal keluar. Coba lagi.');
      },
    });
  }

  // Kapan terakhir dicadangkan — satu dokumen kecil, dilanggan supaya
  // tanggalnya ikut berubah begitu ekspornya beres, tanpa muat ulang layar.
  const [backup] = useLive<BackupInfo>(subscribeBackupInfo, {
    initial: EMPTY_BACKUP,
  });
  const perluCadangan = backupDue(backup, todayId);

  async function onExport() {
    if (!user) return;
    await run({
      key: 'ekspor',
      start: () => {
        setExportError(null);
        setExportNote(null);
      },
      task: async () => {
        const hasil = await exportAllData(
          user.uid,
          Constants.expoConfig?.version ?? '-',
          (p) => setExportStep(`${p.done}/${p.total} · ${p.label}`),
        );
        setExportStep(null);
        await shareExport(hasil.json, exportFileName(todayId));
        // Dicatat SESUDAH share sheet-nya selesai, bukan sesudah dibaca:
        // berkas yang belum sempat disimpan ke Files bukan cadangan.
        await recordBackup(user.uid, todayId, hasil.docCount).catch(() => {});
        const kurang = hasil.errors.length
          ? ` · ${hasil.errors.length} koleksi gagal dibaca`
          : '';
        setExportNote(
          `${hasil.docCount} dokumen · ${hasil.filledCount} koleksi · ${formatBytes(hasil.bytes)}${kurang}`,
        );
      },
      fail: (e) => {
        setExportStep(null);
        setExportError(
          e instanceof Error && e.message === 'sharing off'
            ? 'Berbagi berkas tidak tersedia di perangkat ini.'
            : 'Gagal mengekspor data. Coba lagi.',
        );
      },
    });
  }

  const todayTop = today ? topFeatures(today, 5) : [];
  const monthTop = topFeatures(aggregateDays(monthMerged), 1)[0] ?? null;
  const monthTotal = monthMerged.reduce((sum, d) => sum + dayTotal(d), 0);
  const weekTop = topFeatures(aggregateDays(weekMerged), 1)[0] ?? null;
  const weekTotal = weekMerged.reduce((sum, d) => sum + dayTotal(d), 0);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Pita berwarna tile System di grid Life (grafit). Dua pintunya
          (🔔 Pengingat & 📱 Version) duduk RATA KANAN di dalam pita: dulu
          ketiganya bersaing di satu baris 'space-between' dan di iPhone 15
          pil Version terpotong tepi kanan. */}
      <ScreenHeader
        backLabel="Kembali"
        title="System ⚙️"
        right={
          <>
            <PressableScale
              style={styles.appButton}
              onPress={() => router.push('/notifications')}
              hitSlop={8}>
              <VixText heading="bold" additionalStyle={styles.appButtonText}>
                📳 Notif
              </VixText>
            </PressableScale>
            <PressableScale
              style={styles.appButton}
              onPress={() => router.push('/app-version')}
              hitSlop={8}>
              <IconSymbol name="iphone" size={16} color={Color.DEVICE_DEEP} />
              <VixText heading="bold" additionalStyle={styles.appButtonText}>
                Version
              </VixText>
            </PressableScale>
          </>
        }
      />
      <ScrollView ref={scrollRef} contentContainerStyle={styles.content}>

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
              {weekTop ? `${weekTop.label}` : '-'}
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
              {monthTop ? `${monthTop.label}` : '-'}
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
          📅 Hari Ini
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
          📊 Per Hari · Minggu Ini
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
                    {top ? `${top.label} (${top.count}×)` : '-'}
                  </VixText>
                </View>
              );
            })
          )}
        </View>

        {/* ===== Cadangan data 📦 =====
            Ditaruh paling bawah dengan sengaja: ini pekerjaan sebulan sekali,
            bukan yang dilihat tiap hari seperti laporan pemakaian di atas. */}
        <VixText heading="title" additionalStyle={styles.sectionTitle}>
          📦 Cadangan Data
        </VixText>
        <View style={styles.usageCard}>
          {/* Kapan terakhir dicadangkan. Kalau sudah lewat sebulan (atau belum
              pernah sama sekali), barisnya berganti jadi ajakan berwarna —
              tanggal saja tidak menagih apa pun. */}
          <VixText
            heading="label"
            additionalStyle={perluCadangan ? styles.backupDue : styles.backupLast}>
            {backupLine(backup, todayId)}
          </VixText>
          {perluCadangan && (
            <VixText heading="label" additionalStyle={styles.backupDue}>
              ⏰ {backupDueLine(backup, todayId)}
            </VixText>
          )}
          <PrimaryButton
            label={exportStep ? `Membaca ${exportStep}` : 'Ekspor semua data'}
            icon="square.and.arrow.up"
            busy={busy === 'ekspor'}
            onPress={onExport}
            additionalStyle={styles.backupButton}
          />
          <ScreenError message={exportError} />
          {!!exportNote && (
            <VixText heading="label" additionalStyle={styles.backupNote}>
              ✅ {exportNote}
            </VixText>
          )}
        </View>

        {/* ===== Keluar dari akun 🚪 =====
            Pindahan dari pojok judul tab Life (28 Sep 2026). Tempatnya TEPAT
            di bawah Cadangan Data dengan sengaja: keluar sebelum pernah
            mencadangkan berarti seluruh isinya cuma tergantung pada satu akun
            yang harus bisa kamu masuki lagi. Urutan ini membuat tombol
            cadangan terbaca lebih dulu.

            Merah, dan pakai konfirmasi: di Life dulu ia satu ikon polos di
            samping judul, tepat di atas kolom cari — satu click meleset
            langsung mengeluarkan, tanpa sempat ditanya. */}
        <VixText heading="title" additionalStyle={styles.sectionTitle}>
          🚪 Akun
        </VixText>
        <View style={styles.usageCard}>
          <VixText heading="label" additionalStyle={styles.signOutWho}>
            Masuk sebagai {user?.email ?? '-'}
          </VixText>
          <PrimaryButton
            label="Sign Out"
            icon="rectangle.portrait.and.arrow.right"
            background={Color.DANGER}
            busy={busy === 'keluar'}
            onPress={() => setConfirmKeluar(true)}
            additionalStyle={styles.backupButton}
          />
          <ScreenError message={logoutError} />
        </View>
      </ScrollView>

      {/* Ditanya dulu. `busy` yang sama dengan ekspor, jadi mustahil keluar di
          tengah pencadangan yang sedang berjalan — berkasnya tidak akan pernah
          selesai ditulis kalau akunnya sudah dilepas duluan. */}
      <ConfirmDialog
        visible={confirmKeluar}
        title="Keluar dari akun?"
        detail="Kamu perlu masuk lagi dengan email & password untuk membukanya. Datamu di server tidak ada yang terhapus."
        confirmLabel="Keluar"
        busy={busy === 'keluar'}
        onCancel={() => setConfirmKeluar(false)}
        onConfirm={onLogout}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { ...SCREEN_SAFE },
  content: { ...SCREEN_CONTENT, paddingBottom: 40 },
  // Pil pintu ke layar 🔔 Pengingat & 📱 Version — duduk di slot kanan
  // <ScreenHeader/>, jadi warnanya mengikuti pita grafit System.
  appButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Color.DEVICE_DEEP,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  appButtonText: { color: Color.DEVICE_DEEP },
  sectionTitle: { ...SECTION_SPACE },
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
  backupButton: { marginTop: 12, marginBottom: 10 },
  backupNote: { color: Color.MAIN_DARK, paddingBottom: 10 },
  backupLast: { color: Color.TEXT_LABEL, paddingTop: 10 },
  backupDue: { color: Color.WARNING, paddingTop: 10 },
  // Baris "Masuk sebagai …" di atas tombol merah. paddingTop-nya sama dengan
  // baris pertama kartu Cadangan Data, jadi kedua kartu bernapas sama.
  signOutWho: { color: Color.TEXT_LABEL, paddingTop: 10 },
});
