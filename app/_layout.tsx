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
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-reanimated';

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
    <Stack>
      {/* Hanya bisa diakses kalau sudah login (login cukup SEKALI per perangkat) */}
      <Stack.Protected guard={!!user}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="tasks" options={{ headerShown: false }} />
          <Stack.Screen name="finance" options={{ headerShown: false }} />
            <Stack.Screen name="funds" options={{ headerShown: false }} />
            <Stack.Screen name="fund/[key]" options={{ headerShown: false }} />
          <Stack.Screen name="health" options={{ headerShown: false }} />
            <Stack.Screen name="diseases" options={{ headerShown: false }} />
            <Stack.Screen name="health-info" options={{ headerShown: false }} />
          <Stack.Screen name="timeline" options={{ headerShown: false }} />
          <Stack.Screen name="core" options={{ headerShown: false }} />
          <Stack.Screen name="trading" options={{ headerShown: false }} />
          <Stack.Screen name="car" options={{ headerShown: false }} />
          <Stack.Screen name="wheel" options={{ headerShown: false }} />
          <Stack.Screen name="spiritual" options={{ headerShown: false }} />
          <Stack.Screen name="achievements" options={{ headerShown: false }} />
      </Stack.Protected>

      {/* Hanya muncul kalau belum login */}
      <Stack.Protected guard={!user}>
        <Stack.Screen name="login" options={{ headerShown: false }} />
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
    <SafeAreaProvider>
      <AuthProvider>
        <ThemeProvider value={navigationTheme}>
          <RootNavigator />
          <StatusBar style="dark" />
        </ThemeProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
