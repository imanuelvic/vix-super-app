import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { FormError } from '@/components/common/FormError';
import { PressableScale } from '@/components/common/PressableScale';
import { VixText } from '@/components/common/VixText';
import { useAuth } from '@/contexts/auth';
import { isFirebaseConfigured } from '@/lib/firebase';

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
    case 'auth/not-owner':
      return 'Akun ini tidak diizinkan. Hanya pemilik yang bisa masuk.';
    default:
      return 'Terjadi kesalahan. Coba lagi.';
  }
}

export default function LoginScreen() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  // Email pemilik langsung terisi — tinggal ketik password.
  const [email, setEmail] = useState(process.env.EXPO_PUBLIC_OWNER_EMAIL ?? '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isSignup = mode === 'signup';

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
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.container}>
          <VixText heading="subheader" additionalStyle={styles.brand}>
            vix <VixText heading="label">super app</VixText>
          </VixText>
          <VixText heading="header" additionalStyle={styles.title}>
            {isSignup ? 'Buat akun' : 'Masuk'}
          </VixText>
          <VixText heading="label" additionalStyle={styles.subtitle}>
            Login cukup sekali — setelah ini app selalu langsung terbuka.
          </VixText>

          {!isFirebaseConfigured && (
            <View style={styles.warning}>
              <VixText heading="label" additionalStyle={styles.warningText}>
                Firebase belum dikonfigurasi. Isi file .env dengan firebaseConfig
                dari Firebase Console, lalu restart aplikasi.
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
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={Color.TEXT_PLACEHOLDER}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            editable={!loading}
          />

          <FormError message={error} gap="none" />

          <PressableScale
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={loading}>
            {loading ? (
              <ActivityIndicator color={Color.TEXT_REVERSE} />
            ) : (
              <VixText heading="bold" additionalStyle={styles.buttonText}>
                {isSignup ? 'Daftar' : 'Masuk'}
              </VixText>
            )}
          </PressableScale>

          <PressableScale
            onPress={() => {
              setError(null);
              setMode(isSignup ? 'signin' : 'signup');
            }}
            disabled={loading}>
            <VixText heading="label" additionalStyle={styles.switchText}>
              {isSignup ? 'Sudah punya akun? Masuk' : 'Belum punya akun? Daftar'}
            </VixText>
          </PressableScale>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.BACKGROUND },
  flex: { flex: 1 },
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 12,
  },
  brand: { color: Color.MAIN },
  title: { marginTop: 8 },
  subtitle: { marginBottom: 12 },
  input: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: Color.TEXT_TITLE,
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    borderWidth: 1,
    borderColor: Color.BORDER,
  },
  button: {
    backgroundColor: Color.MAIN,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 6,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: Color.TEXT_REVERSE },
  switchText: { textAlign: 'center', marginTop: 14 },
  warning: {
    backgroundColor: Color.WARNING_TRANSPARENT,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: Color.WARNING,
  },
  warningText: { color: Color.TEXT_PARAGRAPH },
});
