import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/inter';
import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { AuthProvider, useAuth } from '@/contexts/auth';

function LoadingView() {
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Color.BACKGROUND,
      }}>
      <ActivityIndicator size="large" color={Color.MAIN} />
    </View>
  );
}

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
    // headerShown: false untuk SEMUA layar — tiap layar sudah punya header
    // sendiri (ScreenHeader). Diset sekali di sini, jadi layar baru pun otomatis
    // tanpa header bawaan (tak perlu didaftarkan satu-satu lagi).
    <Stack screenOptions={{ headerShown: false }}>
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

        <Stack.Screen name="health" />
        <Stack.Screen name="steps" />
        <Stack.Screen name="diseases" />
        <Stack.Screen name="health-info" />
        <Stack.Screen name="donor" />

        <Stack.Screen name="core" />
        <Stack.Screen name="visitations" />
        <Stack.Screen name="monthly-prayers" />

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
        <Stack.Screen name="family" />
        <Stack.Screen name="fun" />
        <Stack.Screen name="fitness" />
        <Stack.Screen name="book" />
        <Stack.Screen name="book/[key]" />

        {/* Diakses dari kartu welcome & tombol streak di Home */}
        <Stack.Screen name="timeline" />
        <Stack.Screen name="achievements" />
      </Stack.Protected>

      {/* Hanya muncul kalau belum login */}
      <Stack.Protected guard={!user}>
        <Stack.Screen name="login" />
      </Stack.Protected>
    </Stack>
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
    <GestureHandlerRootView style={{ flex: 1 }}>
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
