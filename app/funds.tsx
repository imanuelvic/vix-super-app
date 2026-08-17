import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { FormError } from '@/components/common/FormError';
import { PressableScale } from '@/components/common/PressableScale';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { VixText } from '@/components/common/VixText';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/contexts/auth';
import { FUNDS, subscribeFundBalances, type FundBalances } from '@/lib/funds';
import { formatRupiah } from '@/lib/transactions';

// Daftar Saku + saldo tersimpan tiap dompet.
// Tekan salah satu untuk membuka mutasinya.
export default function FundsScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [balances, setBalances] = useState<FundBalances>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    // 1 listener untuk saldo semua dompet (dokumen kecil, bukan mutasinya).
    const unsubscribe = subscribeFundBalances(
      user.uid,
      (next) => {
        setBalances(next);
        setError(null);
      },
      () => setError('Gagal memuat saldo. Cek koneksi internet.'),
    );
    return unsubscribe;
  }, [user]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        backLabel="Finance"
        title="Saku 👛"
        subtitle="Dana per tujuan dengan mutasi masuk & keluar sendiri."
      />

      <ScrollView contentContainerStyle={styles.content}>
        <FormError message={error} />

        {FUNDS.map((fund) => {
          const balance = balances[fund.key] ?? 0;
          return (
            <PressableScale
              key={fund.key}
              style={styles.row}
              onPress={() =>
                router.push({
                  pathname: '/fund/[key]',
                  params: { key: fund.key },
                })
              }>
              <View style={styles.rowIcon}>
                <VixText heading="title">{fund.icon}</VixText>
              </View>
              <View style={styles.rowMain}>
                <VixText heading="bold" additionalStyle={styles.rowLabel}>
                  {fund.label}
                </VixText>
                <VixText
                  heading="label"
                  additionalStyle={balance < 0 ? styles.balanceMinus : undefined}>
                  Saldo: {formatRupiah(balance)}
                </VixText>
              </View>
              <IconSymbol
                name="chevron.right"
                size={20}
                color={Color.TEXT_LABEL}
              />
            </PressableScale>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.BACKGROUND },
  content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 40 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Color.CONTAINER,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Color.BORDER,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
    gap: 12,
  },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Color.CONTRAST_CONTAINER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowMain: { flex: 1 },
  rowLabel: { color: Color.TEXT_TITLE },
  balanceMinus: { color: Color.DANGER },
});
