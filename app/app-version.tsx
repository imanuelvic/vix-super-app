import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CARD_SHAPE } from '@/assets/style/card';
import { Color } from '@/assets/style/color';
import { SCREEN_CONTENT, SCREEN_SAFE } from '@/assets/style/layout';
import { PressableScale } from '@/components/common/PressableScale';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { SheetModal } from '@/components/common/SheetModal';
import { VixText } from '@/components/common/VixText';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useNow } from '@/hooks/useNow';
import { CHANGELOG, changelogTotal, type ReleaseNote } from '@/lib/changelog';
import {
  dayIdToDate,
  formatDayDate,
  formatShortDayDateTime,
  formatTinyDate,
} from '@/lib/format';

type Message = { kind: 'info' | 'success' | 'error'; text: string };

/** Hari lahir aplikasi ini: Selasa, 21 Juli 2026 🎂 */
const APP_BIRTHDAY = new Date(2026, 6, 21);

// Version 📱 — versi terpasang, cap teknisnya, dan tombol tarik update.
//
// Pindah ke layar sendiri (3 Sep 2026) dari ujung bawah tab System. Di sana ia
// terkubur di bawah laporan pemakaian: justru saat update-nya paling dibutuhkan
// (app terasa aneh sesudah rilis) kamu harus menggulung melewati statistik
// dulu. Sekarang tinggal satu click dari pojok kanan atas System.
export default function AppVersionScreen() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  // 📖 Riwayat versi, dibuka dari kartu versinya sendiri (1 Okt 2026).
  const [riwayat, setRiwayat] = useState(false);
  // Jam berjalan (hook bersama) — bukan `new Date()` lepas saat render, supaya
  // umurnya ikut berganti sendiri lewat tengah malam.
  const { now } = useNow();

  // Versi app dari app.json — ini yang jadi runtimeVersion (policy appVersion).
  const appVersion = Constants.expoConfig?.version ?? '-';
  const appAgeDays =
    Math.floor((now.getTime() - APP_BIRTHDAY.getTime()) / 86_400_000) + 1;

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
      setMessage({ kind: 'info', text: 'Update ditemukan, mengunduh…' });
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
      <ScreenHeader
        backLabel="System"
        title="Version 📱"
        subtitle="Versi terpasang & tarik update terbaru"
      />

      <ScrollView contentContainerStyle={styles.content}>
        {/* Kartu versi = pintu ke riwayatnya. Angka versi sendiri tidak
            memberi tahu apa-apa ("2.0.1" itu apa?); yang sebenarnya ingin
            diingat adalah apa yang berubah sejak dulu, dan di situlah
            tempatnya bertanya. */}
        <PressableScale
          style={styles.versionCard}
          onPress={() => setRiwayat(true)}>
          <VixText heading="label" additionalStyle={styles.versionLabel}>
            Versi Aplikasi
          </VixText>
          <VixText heading="header" additionalStyle={styles.versionValue}>
            v{appVersion}
          </VixText>
          <VixText heading="label" additionalStyle={styles.versionLabel}>
            🎂 Hari ke-{appAgeDays} sejak dibuat
          </VixText>
          <View style={styles.versionHint}>
            <VixText heading="label" additionalStyle={styles.versionLabel}>
              📖 Click untuk lihat semua perubahan
            </VixText>
            <IconSymbol
              name="chevron.right"
              size={14}
              color={Color.TEXT_ON_DARK_MUTED}
            />
          </View>
        </PressableScale>

        {/* Detail teknis — berguna saat cek kenapa update tidak masuk */}
        <View style={styles.detailCard}>
          <DetailRow label="Dibuat" value={formatDayDate(APP_BIRTHDAY)} />
          <DetailRow
            label="Update terakhir"
            value={
              Updates.isEmbeddedLaunch || !Updates.createdAt
                ? 'Belum ada, bundle build'
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

      {/* Riwayat versi: tiap versi beserta rangkuman perubahannya. Daftarnya
          ditulis tangan di lib/changelog.ts, bukan dibaca dari git, dan
          alasannya ada di komentar berkas itu. */}
      <SheetModal
        visible={riwayat}
        title="📱 Version History"
        subtitle={`${CHANGELOG.length} versi, ${changelogTotal()} perubahan tercatat`}
        onClose={() => setRiwayat(false)}>
        {CHANGELOG.map((rilis) => (
          <Rilis
            key={rilis.version}
            rilis={rilis}
            terpasang={rilis.version === appVersion}
          />
        ))}
      </SheetModal>
    </SafeAreaView>
  );
}

/** Satu versi di daftar riwayat. */
function Rilis({
  rilis,
  terpasang,
}: {
  rilis: ReleaseNote;
  /** Versi inilah yang sedang berjalan di HP ini. */
  terpasang: boolean;
}) {
  return (
    <View style={styles.rilis}>
      <View style={styles.rilisTop}>
        <VixText heading="bold" additionalStyle={styles.rilisVersi}>
          v{rilis.version}
        </VixText>
        {terpasang && (
          <View style={styles.rilisPil}>
            <VixText heading="label" additionalStyle={styles.rilisPilText}>
              terpasang
            </VixText>
          </View>
        )}
        <View style={styles.rilisSpasi} />
        <VixText heading="label" additionalStyle={styles.rilisTanggal}>
          {formatTinyDate(dayIdToDate(rilis.date))}
        </VixText>
      </View>
      {rilis.items.map((baris) => (
        <VixText key={baris} heading="label" additionalStyle={styles.rilisItem}>
          {baris}
        </VixText>
      ))}
    </View>
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
  safe: { ...SCREEN_SAFE },
  content: { ...SCREEN_CONTENT, paddingBottom: 40 },
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
  // Ajakan membuka riwayat: dipisahkan garis tipis supaya terbaca sebagai
  // tombol, bukan sebagai baris keterangan ketiga.
  //
  // Garisnya MAIN (hijau sedang), bukan OVERLAY: OVERLAY itu hitam transparan
  // untuk latar belakang modal, dan di atas kartu MAIN_DARK yang memang sudah
  // gelap ia praktis tidak terlihat. Pola yang sama dipakai bar realisasi di
  // kartu gelap Budgeting.
  versionHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Color.MAIN,
  },

  // ── Riwayat versi ──────────────────────────────────────────────────────
  rilis: { marginBottom: 18, gap: 4 },
  rilisTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rilisVersi: { color: Color.TEXT_TITLE },
  rilisSpasi: { flex: 1 },
  rilisTanggal: { color: Color.TEXT_LABEL },
  // Penanda versi yang sedang berjalan di HP ini.
  rilisPil: {
    backgroundColor: Color.MAIN,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  rilisPilText: { color: Color.TEXT_REVERSE },
  rilisItem: { color: Color.TEXT_PARAGRAPH },
  detailCard: {
    ...CARD_SHAPE,
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
