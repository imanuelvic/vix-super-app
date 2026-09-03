import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/inter';
import { DefaultTheme, ThemeProvider } from "expo-router/react-navigation";
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { LoadingCenter } from '@/components/common/LoadingCenter';
import { MorningPrayerWatcher } from '@/components/spiritual/MorningPrayerWatcher';
import { AuthProvider, useAuth } from '@/contexts/auth';

function LoadingView() {
  return <LoadingCenter size="large" style={styles.boot} />;
}

const styles = StyleSheet.create({
  // Latar diberi warna app: layar ini muncul sebelum apa pun tergambar, jadi
  // tanpa ini kilas putih bawaan sistem sempat terlihat.
  boot: { backgroundColor: Color.BACKGROUND },
  root: { flex: 1 },
});

export const unstable_settings = {
  anchor: '(tabs)',
};

// Tema navigasi mengikuti palet emerald (desain tetap, tidak ikut dark mode HP).
const navigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: Color.MAIN,
    background: Color.BACKGROUND,
    card: Color.CONTAINER,
    text: Color.TEXT_TITLE,
    border: Color.BORDER,
  },
};

function RootNavigator() {
  const { user, initializing } = useAuth();

  // Selagi mengecek sesi tersimpan, tampilkan loading agar tidak "berkedip".
  if (initializing) {
    return <LoadingView />;
  }

  return (
    <>
    {/* headerShown: false untuk SEMUA layar — tiap layar sudah punya header
        sendiri (ScreenHeader). Diset sekali di sini, jadi layar baru pun
        otomatis tanpa header bawaan (tak perlu didaftarkan satu-satu lagi).

        freezeOnBlur: layar yang tertutup layar lain berhenti me-render selama
        tertimbun. Membuka Finance dari Home tidak lagi menyisakan Home yang
        terus bekerja di belakang. Langganan Firestore tetap hidup, jadi
        datanya tetap segar & tak ada biaya baca tambahan. */}
    <Stack screenOptions={{ headerShown: false, freezeOnBlur: true }}>
      {/* Hanya bisa diakses kalau sudah login (login cukup SEKALI per perangkat) */}
      <Stack.Protected guard={!!user}>
        {/* Home + tab bar utama */}
        <Stack.Screen name="(tabs)" />

        {/* Lock screen doa pagi — full screen, tak bisa di-swipe balik */}
        <Stack.Screen name="morning-prayer" options={{ gestureEnabled: false }} />

        {/* Fitur utama — urut mengikuti grid di Home, dikelompokkan per fitur
            (fitur induk + sub-halamannya dipisah baris kosong antar grup) */}
        <Stack.Screen name="tasks" />

        <Stack.Screen name="spiritual" />
        <Stack.Screen name="revive" />
        <Stack.Screen name="revive-history" />
        <Stack.Screen name="bible-reading" />
        {/* Ayat yang dibaca → gambar Instagram Story (vixtory.archive) */}
        <Stack.Screen name="bible-story" />
        {/* Doa singkat → gambar Instagram Story, kartu yang sama persis */}
        <Stack.Screen name="pause-pray" />
        {/* Refleksi harian → gambar Instagram Feed (vixtory.archive) */}
        <Stack.Screen name="reflection-feed" />
        <Stack.Screen name="fasting" />
        {/* Checklist hari per hari satu puasa — layar sendiri, bukan ekor
            layar Edit Puasa (yang diatur sekali ≠ yang dibuka tiap malam). */}
        <Stack.Screen name="fasting-days" />
        <Stack.Screen name="learning" />

        <Stack.Screen name="health" />
        <Stack.Screen name="steps" />
        <Stack.Screen name="diseases" />
        <Stack.Screen name="health-info" />
        <Stack.Screen name="donor" />

        <Stack.Screen name="core" />
        <Stack.Screen name="visitations" />
        <Stack.Screen name="monthly-prayers" />
        {/* Pedoman CORE Leader (syarat calon + tugasnya) — dari sub-tab Multiplication */}
        <Stack.Screen name="leader-criteria" />

        {/* Finance: dulu tab utama, kini dibuka dari grid Home */}
        <Stack.Screen name="finance" />
        <Stack.Screen name="funds" />
        <Stack.Screen name="fund/[key]" />
        <Stack.Screen name="debts" />

        <Stack.Screen name="investment" />
        <Stack.Screen name="car" />
        <Stack.Screen name="residence" />
        <Stack.Screen name="wheel" />
        <Stack.Screen name="career" />
        {/* Freelance: rincian satu proyek (baca-saja) + layar isiannya */}
        <Stack.Screen name="project/[id]" />
        <Stack.Screen name="project/edit/[id]" />
        <Stack.Screen name="family" />
        <Stack.Screen name="fun" />
        <Stack.Screen name="fitness" />
        <Stack.Screen name="book" />
        <Stack.Screen name="book/[key]" />
        <Stack.Screen name="news" />

        {/* Sepasang: masa lalu & masa depan — dibuka dari tab Profile */}
        <Stack.Screen name="history" />
        <Stack.Screen name="timeline" />
        <Stack.Screen name="achievements" />

        {/* Version 📱 — versi terpasang & tarik update, dari pojok kanan System */}
        <Stack.Screen name="app-version" />

        {/* Rincian satu sesi futsal ⚽ — skuad, setoran, & skor tiap game */}
        <Stack.Screen name="sport/[id]" />
        {/* Kas tim 💰 — saldo & mutasi uang bersama tiap geng */}
        <Stack.Screen name="sport-cash" />
        {/* Jadwal Main 📅 — semua pertandingan yang akan datang */}
        <Stack.Screen name="sport-schedule" />
      </Stack.Protected>

      {/* Hanya muncul kalau belum login */}
      <Stack.Protected guard={!user}>
        <Stack.Screen name="login" />
      </Stack.Protected>
    </Stack>

    {/* Pengawal doa pagi — tidak menggambar apa pun, hanya mengalihkan ke
        lock screen begitu jam doa tiba, dari layar mana pun. */}
    {!!user && <MorningPrayerWatcher />}
    </>
  );
}

export default function RootLayout() {
  // Font Inter dipakai oleh SEMUA teks lewat komponen VixText.
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

  if (!fontsLoaded) {
    return <LoadingView />;
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <AuthProvider>
          <ThemeProvider value={navigationTheme}>
            <RootNavigator />
            <StatusBar style="dark" />
          </ThemeProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
