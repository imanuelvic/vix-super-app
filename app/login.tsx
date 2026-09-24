import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SHADOW_RAISED, SHADOW_SOFT } from '@/assets/style/card';
import { Color } from '@/assets/style/color';
import { AuthToggle, type AuthMode } from '@/components/auth/AuthToggle';
import { WelcomeWaves, WAVE_HEIGHT } from '@/components/auth/WelcomeWaves';
import { FormError } from '@/components/common/FormError';
import { greetingText } from '@/components/common/Greeting';
import { PressableScale } from '@/components/common/PressableScale';
import { VixText } from '@/components/common/VixText';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/contexts/auth';
import { isFirebaseConfigured } from '@/lib/firebase';

// 🌊 Layar Masuk versi 2.0 (23 Sep 2026).
//
// Bentuknya: sapaan besar sesuai jam di atas (sapaan yang SAMA dengan seluruh
// app, greetingText), kartu isian yang mengambang di tengah, dan ombak warna
// utama yang bergerak pelan di kaki layar (components/auth/WelcomeWaves).
//
// Masuk & Daftar tidak lagi dua layar rasa berbeda: keduanya satu kartu dengan
// sakelar pil yang bergeser di kepalanya, jadi berganti niat tidak pernah
// terasa seperti tersesat. Logikanya sendiri tidak berubah sedikit pun.

function messageFromError(code: string): string {
  switch (code) {
    case 'auth/invalid-email':
      return 'Format email tidak valid.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Email atau password salah.';
    case 'auth/email-already-in-use':
      return 'Email ini sudah terdaftar. Silakan masuk.';
    case 'auth/weak-password':
      return 'Password minimal 6 karakter.';
    case 'auth/network-request-failed':
      return 'Gagal terhubung. Cek koneksi internet.';
    case 'auth/invalid-api-key':
      return 'Konfigurasi Firebase belum benar (cek file .env).';
    // Repo ini publik: yang baru clone belum punya .env sama sekali.
    case 'auth/not-configured':
      return 'Firebase belum dikonfigurasi. Isi .env dengan proyek Firebase milikmu sendiri, lalu restart aplikasi.';
    case 'auth/not-owner':
      return 'Akun ini tidak diizinkan. Hanya pemilik yang bisa masuk.';
    default:
      return 'Terjadi kesalahan. Coba lagi.';
  }
}

export default function LoginScreen() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<AuthMode>('signin');
  // Email pemilik langsung terisi — tinggal ketik password.
  const [email, setEmail] = useState(process.env.EXPO_PUBLIC_OWNER_EMAIL ?? '');
  const [password, setPassword] = useState('');
  // 👁️ tampilkan password apa adanya (bawaannya disamarkan).
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isSignup = mode === 'signup';

  // Masuknya layar: sapaan dulu, kartunya menyusul sepersekian detik kemudian.
  // Sekali jalan saat layar dibuka, bukan tiap kali sesuatu diketik.
  const hadir = useSharedValue(0);
  const hadirKartu = useSharedValue(0);
  useEffect(() => {
    const gerak = { duration: 520, easing: Easing.out(Easing.cubic) };
    hadir.value = withTiming(1, gerak);
    hadirKartu.value = withDelay(140, withTiming(1, gerak));
  }, [hadir, hadirKartu]);

  const gayaSapaan = useAnimatedStyle(() => ({
    opacity: hadir.value,
    transform: [{ translateY: (1 - hadir.value) * 14 }],
  }));
  const gayaKartu = useAnimatedStyle(() => ({
    opacity: hadirKartu.value,
    transform: [{ translateY: (1 - hadirKartu.value) * 26 }],
  }));

  async function handleSubmit() {
    if (!email || !password) {
      setError('Email dan password wajib diisi.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      if (isSignup) {
        await signUp(email, password);
      } else {
        await signIn(email, password);
      }
      // Setelah berhasil, auth gate di root layout otomatis mengarahkan ke Home.
    } catch (e: any) {
      setError(messageFromError(e?.code ?? ''));
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Ombaknya di lapis paling bawah & tidak bisa disentuh, jadi kartunya
          tetap sepenuhnya milik jari. */}
      <WelcomeWaves />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <Animated.View style={[styles.sapaan, gayaSapaan]}>
            <VixText heading="eyebrow">vix super app</VixText>
            <VixText heading="display" additionalStyle={styles.halo}>
              {greetingText()}
            </VixText>
            <VixText heading="paragraph" additionalStyle={styles.sub}>
              {isSignup
                ? 'Satu akun untuk semuanya: doa pagi, CORE, kerjaan, kebiasaan, keuangan.'
                : 'Selamat datang kembali. Hari ini sudah menunggu di dalam.'}
            </VixText>
          </Animated.View>

          <Animated.View style={[styles.kartu, gayaKartu]}>
            <AuthToggle mode={mode} onChange={setMode} disabled={loading} />

            {!isFirebaseConfigured && (
              <View style={styles.warning}>
                <VixText heading="label" additionalStyle={styles.warningText}>
                  Firebase belum dikonfigurasi. Isi file .env dengan firebaseConfig dari Firebase
                  Console, lalu restart aplikasi.
                </VixText>
              </View>
            )}

            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor={Color.TEXT_PLACEHOLDER}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              value={email}
              onChangeText={setEmail}
              editable={!loading}
            />
            {/* Password: ✕ menghapus seluruh isinya (muncul begitu ada yang
                diketik), 👁️ menampilkan/menyamarkan. Keduanya duduk di dalam
                kolomnya, di kanan; teksnya diberi ruang supaya tidak tertutup. */}
            <View style={styles.passwordWrap}>
              <TextInput
                style={[styles.input, styles.passwordInput]}
                placeholder="Password"
                placeholderTextColor={Color.TEXT_PLACEHOLDER}
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
                editable={!loading}
              />
              <View style={styles.passwordTools}>
                {password.length > 0 && (
                  <PressableScale
                    onPress={() => setPassword('')}
                    hitSlop={8}
                    disabled={loading}>
                    <IconSymbol name="xmark" size={18} color={Color.TEXT_LABEL} />
                  </PressableScale>
                )}
                <PressableScale onPress={() => setShowPassword((v) => !v)} hitSlop={8}>
                  <IconSymbol
                    name={showPassword ? 'eye.slash' : 'eye'}
                    size={20}
                    color={Color.TEXT_LABEL}
                  />
                </PressableScale>
              </View>
            </View>

            <FormError message={error} gap="none" />

            <PressableScale
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleSubmit}
              disabled={loading}
              haptic="medium">
              {loading ? (
                <ActivityIndicator color={Color.TEXT_REVERSE} />
              ) : (
                <>
                  <VixText heading="bold" additionalStyle={styles.buttonText}>
                    {isSignup ? 'Buat akun' : 'Masuk'}
                  </VixText>
                  <IconSymbol name="chevron.right" size={18} color={Color.TEXT_REVERSE} />
                </>
              )}
            </PressableScale>

            <VixText heading="label" additionalStyle={styles.kaki}>
              🔒 Datanya tersimpan di akun ini saja.
            </VixText>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.BACKGROUND },
  flex: { flex: 1 },
  // Isinya di tengah layar; ruang bawahnya disisakan untuk ombak supaya
  // kartunya tidak pernah duduk persis di atas gelombang.
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: WAVE_HEIGHT * 0.42,
    gap: 18,
  },
  sapaan: { gap: 4 },
  halo: { color: Color.MAIN_DARK },
  sub: { color: Color.TEXT_PARAGRAPH, maxWidth: 320 },
  kartu: {
    ...SHADOW_SOFT,
    backgroundColor: Color.CONTAINER,
    borderRadius: 22,
    padding: 18,
    gap: 12,
  },
  input: {
    backgroundColor: Color.BACKGROUND,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: Color.TEXT_TITLE,
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    borderWidth: 1,
    borderColor: Color.BORDER,
  },
  passwordWrap: { justifyContent: 'center' },
  // Ruang di kanan untuk ✕ + 👁️ (dua ikon + jarak), supaya ketikan panjang
  // tidak tersembunyi di bawahnya.
  passwordInput: { paddingRight: 84 },
  passwordTools: {
    position: 'absolute',
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  button: {
    ...SHADOW_RAISED,
    backgroundColor: Color.MAIN,
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 2,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: Color.TEXT_REVERSE },
  kaki: { textAlign: 'center', marginTop: 2 },
  warning: {
    backgroundColor: Color.WARNING_TRANSPARENT,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: Color.WARNING,
  },
  warningText: { color: Color.TEXT_PARAGRAPH },
});
