import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { PressableScale } from '@/components/common/PressableScale';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { SheetModal } from '@/components/common/SheetModal';
import { VixText } from '@/components/common/VixText';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/contexts/auth';
import {
  ACHIEVEMENTS,
  ACHIEVEMENT_CATEGORIES,
  REWARDS,
  subscribeLoginStreak,
  subscribeSelfRewardBalance,
  type AchievementCategoryKey,
  type AchievementStats,
  type LoginStreak,
} from '@/lib/achievements';
import { formatShortRupiah } from '@/lib/format';
import { activeStreak, dayDocId, subscribeStreak, type Streak } from '@/lib/health';
import { subscribeReviveStreak } from '@/lib/spiritual';
import { formatRupiah } from '@/lib/transactions';

// Achievement 🏆 — pencapaian dikelompokkan per kategori (ala Duolingo).
// Tekan kartu kategori → modal berisi pencapaian bertingkat kategori itu,
// jadi tidak perlu scroll daftar panjang. Plus self-reward di bawah.
export default function AchievementsScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [login, setLogin] = useState<LoginStreak | null>(null);
  const [habit, setHabit] = useState<Streak | null>(null);
  const [revive, setRevive] = useState<LoginStreak | null>(null);
  const [balance, setBalance] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Kategori yang sedang dibuka di modal (null = tertutup).
  const [openCat, setOpenCat] = useState<AchievementCategoryKey | null>(null);

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

  // Ringkasan satu kategori: daftar + berapa yang sudah terbuka.
  function catInfo(key: AchievementCategoryKey) {
    const list = ACHIEVEMENTS.filter((a) => a.category === key);
    const done = list.filter((a) => a.of(stats) >= a.target).length;
    return { list, done, total: list.length };
  }

  const activeCat = ACHIEVEMENT_CATEGORIES.find((c) => c.key === openCat);
  const activeList = openCat
    ? ACHIEVEMENTS.filter((a) => a.category === openCat)
    : [];

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
            🙏 Streak doa {stats.loginCount} hari · terbaik {stats.loginBest} ·
            total {stats.loginTotal} hari
          </VixText>
        </View>

        {/* ===== Kategori pencapaian (tekan → modal) ===== */}
        <VixText heading="title" additionalStyle={styles.sectionTitle}>
          🎖️ Kategori Pencapaian
        </VixText>
        {ACHIEVEMENT_CATEGORIES.map((cat) => {
          const { done, total } = catInfo(cat.key);
          const pct = total > 0 ? (done / total) * 100 : 0;
          const allDone = done === total;
          return (
            <PressableScale
              key={cat.key}
              style={styles.catCard}
              onPress={() => setOpenCat(cat.key)}>
              <VixText additionalStyle={styles.catIcon}>{cat.icon}</VixText>
              <View style={styles.catMain}>
                <View style={styles.catTop}>
                  <VixText heading="bold" additionalStyle={styles.rowTitle}>
                    {cat.label}
                  </VixText>
                  <VixText
                    heading="bold"
                    additionalStyle={allDone ? styles.doneText : styles.countText}>
                    {allDone ? '✅ Lengkap' : `${done}/${total}`}
                  </VixText>
                </View>
                <VixText heading="label">{cat.desc}</VixText>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      { width: `${pct}%` },
                      allDone && styles.barFillDone,
                    ]}
                  />
                </View>
              </View>
              <IconSymbol
                name="chevron.right"
                size={18}
                color={Color.TEXT_PLACEHOLDER}
              />
            </PressableScale>
          );
        })}

        {/* ===== Self-Reward ===== */}
        <VixText heading="title" additionalStyle={styles.sectionTitle}>
          🎁 Self-Reward
        </VixText>
        <View style={styles.balanceCard}>
          <VixText heading="label" additionalStyle={styles.balanceLabel}>
            Saldo Saku Self-Reward 🏆
          </VixText>
          <VixText heading="subheader" additionalStyle={styles.balanceValue}>
            {formatRupiah(balance)}
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
          label="Kelola Saku Self-Reward 🏆"
          onPress={() =>
            router.push({ pathname: '/fund/[key]', params: { key: 'self-reward' } })
          }
          additionalStyle={styles.manageButton}
        />
      </ScrollView>

      {/* Modal pencapaian satu kategori — daftar bertingkat + progress bar */}
      <SheetModal
        visible={openCat !== null}
        title={activeCat ? `${activeCat.icon} ${activeCat.label}` : ''}
        subtitle={activeCat?.desc}
        onClose={() => setOpenCat(null)}>
        <ScrollView
          style={styles.modalList}
          showsVerticalScrollIndicator={false}>
          {activeList.map((a) => {
            const value = a.of(stats);
            const done = value >= a.target;
            const pct = Math.min((value / a.target) * 100, 100);
            return (
              <View key={a.id} style={[styles.row, !done && styles.rowLocked]}>
                <VixText additionalStyle={styles.rowIcon}>{a.icon}</VixText>
                <View style={styles.rowMain}>
                  <View style={styles.catTop}>
                    <VixText heading="bold" additionalStyle={styles.rowTitle}>
                      {a.title}
                    </VixText>
                    <VixText
                      heading="bold"
                      additionalStyle={done ? styles.doneText : styles.lockText}>
                      {done ? '✅' : `${Math.min(value, a.target)}/${a.target}`}
                    </VixText>
                  </View>
                  <VixText heading="label">{a.desc}</VixText>
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.barFill,
                        { width: `${pct}%` },
                        done && styles.barFillDone,
                      ]}
                    />
                  </View>
                </View>
              </View>
            );
          })}
        </ScrollView>
      </SheetModal>
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
  // Kartu kategori di halaman utama (tekan → modal).
  catCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: Color.CONTAINER,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Color.BORDER,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 10,
  },
  catIcon: { fontSize: 30, lineHeight: 38 },
  catMain: { flex: 1, gap: 5 },
  catTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  countText: { color: Color.TEXT_LABEL },
  // Baris pencapaian / reward.
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
  rowMain: { flex: 1, gap: 4 },
  rowTitle: { color: Color.TEXT_TITLE },
  doneText: { color: Color.SUCCESS },
  lockText: { color: Color.TEXT_PLACEHOLDER },
  // Progress bar (kategori & tiap pencapaian).
  barTrack: {
    height: 7,
    borderRadius: 4,
    backgroundColor: Color.CONTRAST_CONTAINER,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: Color.MAIN_LIGHT,
  },
  barFillDone: { backgroundColor: Color.MAIN },
  balanceCard: {
    backgroundColor: Color.ACCENT,
    borderRadius: 16,
    padding: 16,
    gap: 2,
    marginBottom: 10,
  },
  balanceLabel: { color: Color.ACCENT_DARK },
  balanceValue: { color: Color.ACCENT_DARK },
  manageButton: { marginTop: 6, marginBottom: 15 },
  modalList: { maxHeight: 460 },
});
