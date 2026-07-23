import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { VixText } from '@/components/common/VixText';
import { useAuth } from '@/contexts/auth';
import {
  ACHIEVEMENTS,
  REWARDS,
  subscribeLoginStreak,
  subscribeSelfRewardBalance,
  type AchievementStats,
  type LoginStreak,
} from '@/lib/achievements';
import { formatShortRupiah } from '@/lib/format';
import { activeStreak, dayDocId, subscribeStreak, type Streak } from '@/lib/health';
import { subscribeReviveStreak } from '@/lib/spiritual';
import { formatRupiah } from '@/lib/transactions';

// Achievement 🏆 — pencapaian dari daily login & kebiasaan sehat,
// plus daftar self-reward yang nyambung ke saldo pocket Self-Reward.
export default function AchievementsScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [login, setLogin] = useState<LoginStreak | null>(null);
  const [habit, setHabit] = useState<Streak | null>(null);
  const [revive, setRevive] = useState<LoginStreak | null>(null);
  const [balance, setBalance] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const fail = () => setError('Gagal memuat data. Cek koneksi internet.');
    const unsubs = [
      subscribeLoginStreak(user.uid, setLogin, fail),
      subscribeStreak(user.uid, setHabit, fail),
      subscribeReviveStreak(user.uid, setRevive, fail),
      subscribeSelfRewardBalance(user.uid, setBalance, fail),
    ];
    return () => unsubs.forEach((unsub) => unsub());
  }, [user]);

  const stats: AchievementStats = {
    loginCount: login?.count ?? 0,
    loginBest: login?.best ?? 0,
    loginTotal: login?.total ?? 0,
    habitStreak: activeStreak(habit, dayDocId(new Date())),
    reviveBest: revive?.best ?? 0,
    reviveTotal: revive?.total ?? 0,
  };
  const unlocked = ACHIEVEMENTS.filter((a) => a.of(stats) >= a.target).length;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        backLabel="Home"
        title="Achievement 🏆"
        subtitle="Streak, pencapaian & self-reward"
      />

      {error && (
        <VixText heading="label" additionalStyle={styles.error}>
          {error}
        </VixText>
      )}

      <ScrollView contentContainerStyle={styles.content}>
        {/* Hero: ringkasan streak */}
        <View style={styles.heroCard}>
          <VixText additionalStyle={styles.heroEmoji}>🏆</VixText>
          <VixText heading="subheader" additionalStyle={styles.heroValue}>
            {unlocked}{' '}
            <VixText heading="label" additionalStyle={styles.heroLabel}>
              dari {ACHIEVEMENTS.length} achievement
            </VixText>
          </VixText>
          <VixText heading="label" additionalStyle={styles.heroLabel}>
            🔥 Streak {stats.loginCount} hari · terbaik {stats.loginBest} ·
            total {stats.loginTotal} hari login
          </VixText>
        </View>

        {/* ===== Daftar achievement ===== */}
        <VixText heading="title" additionalStyle={styles.sectionTitle}>
          🎖️ Pencapaian
        </VixText>
        {ACHIEVEMENTS.map((a) => {
          const value = a.of(stats);
          const done = value >= a.target;
          return (
            <View key={a.id} style={[styles.row, !done && styles.rowLocked]}>
              <VixText additionalStyle={styles.rowIcon}>{a.icon}</VixText>
              <View style={styles.rowMain}>
                <VixText heading="bold" additionalStyle={styles.rowTitle}>
                  {a.title}
                </VixText>
                <VixText heading="label">{a.desc}</VixText>
              </View>
              <VixText
                heading="bold"
                additionalStyle={done ? styles.doneText : styles.lockText}>
                {done ? '✅' : `${Math.min(value, a.target)}/${a.target}`}
              </VixText>
            </View>
          );
        })}

        {/* ===== Self-Reward ===== */}
        <VixText heading="title" additionalStyle={styles.sectionTitle}>
          🎁 Self-Reward
        </VixText>
        <View style={styles.balanceCard}>
          <VixText heading="label" additionalStyle={styles.balanceLabel}>
            Saldo pocket Self-Reward 🏆
          </VixText>
          <VixText heading="subheader" additionalStyle={styles.balanceValue}>
            {formatRupiah(balance)}
          </VixText>
          <VixText heading="label" additionalStyle={styles.balanceLabel}>
            Kerja kerasmu layak dirayakan — tanpa merusak budget 😉
          </VixText>
        </View>

        {REWARDS.map((r) => {
          const affordable = balance >= r.price;
          return (
            <View
              key={r.label}
              style={[styles.row, !affordable && styles.rowLocked]}>
              <VixText additionalStyle={styles.rowIcon}>{r.icon}</VixText>
              <View style={styles.rowMain}>
                <VixText heading="bold" additionalStyle={styles.rowTitle}>
                  {r.label}
                </VixText>
                <VixText heading="label">{formatRupiah(r.price)}</VixText>
              </View>
              <VixText
                heading="bold"
                additionalStyle={affordable ? styles.doneText : styles.lockText}>
                {affordable
                  ? '✅ Bisa diklaim!'
                  : `kurang ${formatShortRupiah(r.price - balance)}`}
              </VixText>
            </View>
          );
        })}

        <PrimaryButton
          label="Kelola Pocket Self-Reward 🏆"
          onPress={() =>
            router.push({ pathname: '/fund/[key]', params: { key: 'self-reward' } })
          }
          additionalStyle={styles.manageButton}
        />
        <VixText heading="label" additionalStyle={styles.hint}>
          Klaim reward = catat pengeluaran di pocket Self-Reward, jadi saldonya
          ikut berkurang otomatis.
        </VixText>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.BACKGROUND },
  error: { color: Color.DANGER, paddingHorizontal: 20, marginBottom: 6 },
  content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 40 },
  heroCard: {
    backgroundColor: Color.MAIN_DARK,
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  heroEmoji: { fontSize: 44, lineHeight: 54 },
  heroValue: { color: Color.TEXT_REVERSE },
  heroLabel: { color: Color.TEXT_ON_DARK_MUTED, textAlign: 'center' },
  sectionTitle: { marginTop: 14, marginBottom: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Color.CONTAINER,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Color.BORDER,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
  },
  rowLocked: { opacity: 0.55 },
  rowIcon: { fontSize: 26, lineHeight: 32 },
  rowMain: { flex: 1, gap: 1 },
  rowTitle: { color: Color.TEXT_TITLE },
  doneText: { color: Color.SUCCESS },
  lockText: { color: Color.TEXT_PLACEHOLDER },
  balanceCard: {
    backgroundColor: Color.ACCENT,
    borderRadius: 16,
    padding: 16,
    gap: 2,
    marginBottom: 10,
  },
  balanceLabel: { color: Color.ACCENT_DARK },
  balanceValue: { color: Color.ACCENT_DARK },
  manageButton: { marginTop: 6 },
  hint: { textAlign: 'center', marginTop: 10 },
});
