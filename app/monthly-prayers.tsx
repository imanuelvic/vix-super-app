import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { PrayerPointsTab } from '@/components/core/PrayerPointsTab';

// Prayer Points 🙏 sebagai LAYAR sendiri.
//
// 26 Sep 2026: isinya pindah ke components/core/PrayerPointsTab supaya bisa
// dipakai dua tempat. Layar ini TIDAK dihapus, dan itu disengaja: banyak yang
// sudah menunjuk ke rute `/monthly-prayers` dan semuanya harus tetap sampai —
// kartu Doa Bulanan di Today, layar Semua Pengingat, tombol di sub-tab Follow
// Up, pencarian fitur di Life, sampai tautan notifikasi yang sudah terjadwal
// di HP dari hari-hari sebelumnya.
//
// Nama rutenya sengaja TIDAK ikut berganti walau judulnya sekarang "Prayer
// Points": mengganti nama rute berarti semua tautan lama itu jadi buntu, dan
// notifikasi yang sudah dijadwalkan di HP tidak bisa diperbaiki dari sini.
export default function MonthlyPrayersScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        backLabel="CORE"
        title="Prayer Points 🙏"
        subtitle="Pergumulan tiap CORE Leader bulan ini"
      />
      <PrayerPointsTab />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.BACKGROUND },
});
