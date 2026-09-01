import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { EditFooter } from '@/components/common/EditFooter';
import { EmojiButton } from '@/components/common/EmojiButton';
import { FormError } from '@/components/common/FormError';
import { FormInput } from '@/components/common/FormInput';
import { MoneyInput } from '@/components/common/MoneyInput';
import { PressableScale } from '@/components/common/PressableScale';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { ScreenError } from '@/components/common/ScreenError';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { SheetModal } from '@/components/common/SheetModal';
import { VixText } from '@/components/common/VixText';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/contexts/auth';
import {
  achievementCategoryOf,
  ACHIEVEMENTS,
  ACHIEVEMENT_CATEGORIES,
  resetAchievements,
  subscribeLoginStreak,
  subscribeSelfRewardBalance,
  type AchievementCategoryKey,
  type AchievementStats,
  type LoginStreak,
} from '@/lib/achievements';
import { settleFitDays, subscribeFitStreak } from '@/lib/fitness';
import { formatShortRupiah, groupDigits, parseAmount } from '@/lib/format';
import {
  activeStreak,
  dayDocId,
  stepAchievements,
  runRecords,
  stepTierLastDates,
  subscribeHealthProfile,
  subscribeStepDays,
  subscribeStreak,
  subscribeWaterStreak,
  subscribeWeekStats,
  weekGoalStats,
  type HealthProfile,
  type StepDaysMap,
  type Streak,
  type WeekStatsMap,
} from '@/lib/health';
import { subscribeLearningStreak, type WeekStreak } from '@/lib/learning';
import { unsubscribeAll } from '@/lib/liveDoc';
import { DELETE_ERROR, LOAD_ERROR, SAVE_ERROR } from '@/lib/messages';
import {
  claimSelfReward,
  newRewardId,
  saveSelfRewards,
  subscribeClaimedRewards,
  subscribeSelfRewards,
  type ClaimedReward,
  type SelfReward,
} from '@/lib/selfReward';
import { EMPTY_DAY_STREAK as EMPTY_WEEK_STREAK } from '@/lib/streak';
import {
  EMPTY_BIBLE_STREAKS,
  subscribeBibleStreaks,
  type BibleStreaks,
} from '@/lib/spiritual';
import { formatRupiah } from '@/lib/transactions';

// Achievement 🏆 — pencapaian dikelompokkan per kategori (ala Duolingo).
// Tekan kartu kategori → modal berisi pencapaian bertingkat kategori itu,
// jadi tidak perlu scroll daftar panjang. Plus self-reward di bawah.
export default function AchievementsScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [login, setLogin] = useState<LoginStreak | null>(null);
  const [habit, setHabit] = useState<Streak | null>(null);
  const [bible, setBible] = useState<BibleStreaks>(EMPTY_BIBLE_STREAKS);
  const [fit, setFit] = useState<LoginStreak | null>(null);
  const [water, setWater] = useState<LoginStreak | null>(null);
  const [stepDays, setStepDays] = useState<StepDaysMap>({});
  // Tinggi badan dipakai mengubah langkah → kilometer (patokan pelari).
  const [body, setBody] = useState<HealthProfile | null>(null);
  const [weeks, setWeeks] = useState<WeekStatsMap>({});
  // Streak MINGGUAN Learning 🎓 — satu dokumen kecil, sama seperti yang lain.
  const [learning, setLearning] = useState<WeekStreak>(EMPTY_WEEK_STREAK);
  const [balance, setBalance] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Daftar hadiah incaran + riwayat klaimnya (dua dokumen array kecil).
  const [rewards, setRewards] = useState<SelfReward[]>([]);
  const [claimed, setClaimed] = useState<ClaimedReward[]>([]);

  // Kategori yang sedang dibuka di modal (null = tertutup).
  //
  // Nilai AWALNYA boleh datang dari tautan yang membuka layar ini: pil 🔥 di
  // Habits mengirim ?cat=health → modal "Kebiasaan Sehat" sudah terbuka begitu
  // layarnya muncul, tanpa perlu mencarinya lagi di daftar. Dipasang sebagai
  // nilai awal useState (bukan lewat efek) supaya modalnya ada sejak render
  // PERTAMA — tak ada kedipan daftar dulu baru modal menyusul. Setelah itu
  // parameternya tidak dilihat lagi: ditutup ya tetap tertutup.
  const { cat } = useLocalSearchParams<{ cat?: string }>();
  const [openCat, setOpenCat] = useState<AchievementCategoryKey | null>(() =>
    achievementCategoryOf(cat),
  );

  // Sheet tambah/ubah hadiah + isiannya.
  const [editing, setEditing] = useState<SelfReward | 'new' | null>(null);
  const [fIcon, setFIcon] = useState('');
  const [fLabel, setFLabel] = useState('');
  const [fPrice, setFPrice] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Hadiah yang sedang menunggu validasi klaim (null = tidak ada).
  const [claiming, setClaiming] = useState<SelfReward | null>(null);

  // Konfirmasi reset semua pencapaian (permanen).
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);

  function openAddReward() {
    setEditing('new');
    setFIcon('');
    setFLabel('');
    setFPrice('');
    setFormError(null);
  }

  function openEditReward(r: SelfReward) {
    setEditing(r);
    setFIcon(r.icon);
    setFLabel(r.label);
    setFPrice(r.price > 0 ? groupDigits(String(r.price)) : '');
    setFormError(null);
  }

  async function handleSaveReward() {
    if (!user || !editing || busy) return;
    if (!fLabel.trim()) {
      setFormError('Nama hadiahnya diisi dulu ya.');
      return;
    }
    const price = parseAmount(fPrice);
    if (price <= 0) {
      setFormError('Harganya diisi dulu — itu yang jadi patokan bisa diklaim.');
      return;
    }
    setBusy(true);
    setFormError(null);
    const data = { icon: fIcon.trim(), label: fLabel.trim(), price };
    try {
      await saveSelfRewards(
        user.uid,
        editing === 'new'
          ? [...rewards, { id: newRewardId(), ...data }]
          : rewards.map((r) => (r.id === editing.id ? { ...r, ...data } : r)),
      );
      setEditing(null);
    } catch {
      setFormError(SAVE_ERROR);
    } finally {
      setBusy(false);
    }
  }

  /** Hapus hadiah dari daftar incaran — permanen. Riwayat klaim tidak ikut. */
  async function handleDeleteReward() {
    if (!user || !editing || editing === 'new' || busy) return;
    setBusy(true);
    try {
      await saveSelfRewards(
        user.uid,
        rewards.filter((r) => r.id !== editing.id),
      );
      setEditing(null);
    } catch {
      setError(DELETE_ERROR);
    } finally {
      setBusy(false);
    }
  }

  /** Klaim: saldo Saku berkurang & satu baris masuk ke Archive 🗄️. */
  async function handleClaim() {
    if (!user || !claiming || busy) return;
    setBusy(true);
    try {
      await claimSelfReward(user.uid, claimed, claiming);
      setClaiming(null);
    } catch {
      setError(SAVE_ERROR);
    } finally {
      setBusy(false);
    }
  }

  async function handleReset() {
    if (!user || resetting) return;
    setResetting(true);
    setError(null);
    try {
      await resetAchievements(user.uid);
      setConfirmReset(false);
    } catch {
      setError(DELETE_ERROR);
    } finally {
      setResetting(false);
    }
  }

  useEffect(() => {
    if (!user) return;
    const fail = () => setError(LOAD_ERROR);
    return unsubscribeAll([
      subscribeLoginStreak(user.uid, setLogin, fail),
      subscribeStreak(user.uid, setHabit, fail),
      subscribeBibleStreaks(user.uid, setBible, fail),
      subscribeFitStreak(user.uid, setFit, fail),
      subscribeWaterStreak(user.uid, setWater, fail),
      subscribeStepDays(user.uid, setStepDays, fail),
      subscribeHealthProfile(user.uid, setBody, fail),
      subscribeWeekStats(user.uid, setWeeks, fail),
      subscribeLearningStreak(user.uid, setLearning, fail),
      subscribeSelfRewardBalance(user.uid, setBalance, fail),
      subscribeSelfRewards(user.uid, setRewards, fail),
      subscribeClaimedRewards(user.uid, setClaimed, fail),
    ]);
  }, [user]);

  // Tutup buku sesi gym yang harinya sudah habis 🔥 — sama seperti yang
  // dijalankan layar Fitness. Diulang di sini karena halaman INI yang
  // menampilkan angkanya: kalau Achievement dibuka lebih dulu, sesi kemarin
  // harus sudah ikut terhitung, bukan menunggu Fitness dibuka.
  //
  // Murah: kalau tidak ada hari yang perlu ditutup, cuma 1 baca dokumen kecil
  // lalu berhenti. Aman diulang — `lastDayId` yang menjaga tidak dobel hitung.
  useEffect(() => {
    if (!user) return;
    settleFitDays(user.uid, new Date()).catch(() => {});
  }, [user]);

  const stepAch = stepAchievements(stepDays);
  const runs = runRecords(stepDays, body?.heightCm ?? 170);
  const wk = weekGoalStats(weeks);
  const stats: AchievementStats = {
    loginCount: login?.count ?? 0,
    loginBest: login?.best ?? 0,
    habitStreak: activeStreak(habit, dayDocId(new Date())),
    bibleMorningBest: bible.morning.best,
    bibleDaytimeBest: bible.daytime.best,
    bibleNightBest: bible.night.best,
    learningWeekBest: learning.best,
    fitTotal: fit?.total ?? 0,
    fitBest: fit?.best ?? 0,
    bestSteps: stepAch.best?.steps ?? 0,
    stepTierLastDate: stepTierLastDates(stepDays),
    weekStepHits: wk.stepHits,
    weekGymHits: wk.gymHits,
    weekBothHits: wk.bothHits,
    bestDayKm: runs.bestDayKm,
    bestWeekKm: runs.bestWeekKm,
    bestMonthKm: runs.bestMonthKm,
    waterCount: water?.count ?? 0,
    waterBest: water?.best ?? 0,
    waterTotal: water?.total ?? 0,
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
        // Pintasan ke riwayat klaim, sama pola dengan tombol 🕘 di CORE.
        right={
          <EmojiButton
            emoji="🗄️"
            onPress={() => router.push('/reward-archive')}
          />
        }
      />

      <ScreenError message={error} />

      <ScrollView contentContainerStyle={styles.content}>
        {/* Hero: ringkasan streak. Pialanya di KIRI (dulu di atas, di tengah) —
            sebaris dengan angkanya, kartunya jadi jauh lebih pendek tanpa
            kehilangan apa pun. */}
        <View style={styles.heroCard}>
          <VixText additionalStyle={styles.heroEmoji}>🏆</VixText>
          <View style={styles.heroMain}>
            <VixText heading="subheader" additionalStyle={styles.heroValue}>
              {unlocked}{' '}
              <VixText heading="label" additionalStyle={styles.heroLabel}>
                dari {ACHIEVEMENTS.length} achievement
              </VixText>
            </VixText>
          </View>
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

        {rewards.length === 0 && (
          <VixText heading="label" additionalStyle={styles.empty}>
            Belum ada hadiah. Tulis sendiri apa saja yang ingin kamu klaim
            kalau sakunya sudah cukup 🎁
          </VixText>
        )}

        {/* Tombol Klaim & area ubah sengaja jadi SAUDARA, bukan bersarang:
            Pressable di dalam Pressable tidak andal di iOS. */}
        {rewards.map((r) => {
          const affordable = balance >= r.price;
          return (
            <View
              key={r.id}
              style={[styles.row, !affordable && styles.rowLocked]}>
              <VixText additionalStyle={styles.rowIcon}>{r.icon || '🎁'}</VixText>
              <PressableScale
                style={styles.rowMain}
                onPress={() => openEditReward(r)}>
                <VixText heading="bold" additionalStyle={styles.rowTitle}>
                  {r.label}
                </VixText>
                <VixText heading="label">{formatRupiah(r.price)}</VixText>
              </PressableScale>
              {affordable ? (
                <PressableScale
                  style={styles.claimButton}
                  onPress={() => setClaiming(r)}
                  disabled={busy}>
                  <VixText heading="bold" additionalStyle={styles.claimText}>
                    ✅ Klaim
                  </VixText>
                </PressableScale>
              ) : (
                <VixText heading="bold" additionalStyle={styles.lockText}>
                  kurang {formatShortRupiah(r.price - balance)}
                </VixText>
              )}
            </View>
          );
        })}

        <PrimaryButton
          label="Tambah Self-Reward"
          icon="plus"
          onPress={openAddReward}
          additionalStyle={styles.manageButton}
        />

        <PrimaryButton
          label="Kelola Saku Self-Reward 🏆"
          onPress={() =>
            router.push({ pathname: '/fund/[key]', params: { key: 'self-reward' } })
          }
          additionalStyle={styles.manageButton}
        />

        {/* Mulai dari nol lagi — semua streak & rekor dihapus permanen.
            Saldo Self-Reward TIDAK ikut terhapus (itu uang di Finance). */}
        <PressableScale onPress={() => setConfirmReset(true)}>
          <VixText heading="bold" additionalStyle={styles.resetLink}>
            ♻️ Reset semua achievement ke 0
          </VixText>
        </PressableScale>
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
                      {done
                        ? '✅'
                        : a.fmt
                          ? `${a.fmt(Math.min(value, a.target))}/${a.fmt(a.target)}`
                          : `${Math.min(value, a.target)}/${a.target}`}
                    </VixText>
                  </View>
                  <VixText heading="label">{a.desc}</VixText>
                  {a.detail?.(stats) ? (
                    <VixText heading="label" additionalStyle={styles.detailText}>
                      {a.detail(stats)}
                    </VixText>
                  ) : null}
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

      {/* Sheet tambah / ubah hadiah incaran */}
      <SheetModal
        visible={!!editing}
        title={editing === 'new' ? 'Tambah Self-Reward' : 'Ubah Self-Reward'}
        subtitle="Hadiahnya bebas — yang penting kamu sendiri yang mau"
        onClose={() => setEditing(null)}>
        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          🎁 Emoji
        </VixText>
        <FormInput
          style={styles.formGap}
          placeholder="Isi emoji"
          value={fIcon}
          onChangeText={setFIcon}
          maxLength={4}
          editable={!busy}
        />

        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          🏷️ Nama hadiah
        </VixText>
        <FormInput
          style={styles.formGap}
          placeholder="mis. Kopi favorit"
          value={fLabel}
          onChangeText={setFLabel}
          editable={!busy}
        />

        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          💰 Harga — batas saldo sebelum bisa diklaim
        </VixText>
        <MoneyInput
          style={styles.formGap}
          placeholder="Nominal"
          value={fPrice}
          onChangeText={(t) => setFPrice(groupDigits(t))}
          editable={!busy}
        />

        <FormError message={formError} />
        <EditFooter
          editing={editing}
          deleteLabel="Hapus hadiah ini"
          busy={busy}
          onDelete={handleDeleteReward}
          onCancel={() => setEditing(null)}
          onConfirm={handleSaveReward}
        />
      </SheetModal>

      {/* Validasi klaim — uangnya benar-benar berkurang, jadi wajib ditanya
          dulu. Sesudah ini hadiahnya TETAP ada di daftar (boleh diklaim lagi
          kapan-kapan); yang bertambah adalah satu baris di Archive 🗄️. */}
      <ConfirmDialog
        visible={claiming !== null}
        title={`Klaim ${claiming?.icon ?? ''} ${claiming?.label ?? ''}?`.trim()}
        detail={
          claiming
            ? `Kamu menyatakan self-reward ini SUDAH benar-benar kamu ambil.\n\n💸 Saku Self-Reward berkurang ${formatRupiah(claiming.price)} → sisa ${formatRupiah(balance - claiming.price)}.\n🗄️ Satu baris masuk ke Archive lengkap dengan tanggal hari ini.\n\nJangan dicatat lagi sebagai mutasi keluar di Saku yang sama — nanti terpotong dua kali.`
            : ''
        }
        confirmLabel="Ya, Sudah Kuklaim"
        busy={busy}
        onCancel={() => setClaiming(null)}
        onConfirm={handleClaim}
      />

      <ConfirmDialog
        visible={confirmReset}
        title="Reset semua achievement?"
        detail="Semua streak & rekor kembali ke 0."
        confirmLabel="Ya, Reset"
        busy={resetting}
        onCancel={() => setConfirmReset(false)}
        onConfirm={handleReset}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.BACKGROUND },
  content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 40 },
  // Piala di KIRI, angkanya di sebelahnya — kartunya jadi satu baris pendek.
  heroCard: {
    flexDirection: 'row',
    backgroundColor: Color.MAIN_DARK,
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    gap: 14,
    marginBottom: 6,
  },
  heroEmoji: { fontSize: 40, lineHeight: 50 },
  heroMain: { flex: 1 },
  heroValue: { color: Color.TEXT_REVERSE },
  heroLabel: { color: Color.TEXT_ON_DARK_MUTED },
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
    flexWrap: 'wrap',
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
  detailText: { color: Color.MAIN_DARK },
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
  empty: { textAlign: 'center', marginVertical: 10 },
  // Tombol Klaim — hijau penuh, dibedakan tegas dari baris yang belum cukup
  // saldonya (yang cuma menampilkan tulisan "kurang …").
  claimButton: {
    backgroundColor: Color.MAIN,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  claimText: { color: Color.TEXT_REVERSE },
  manageButton: { marginTop: 6, marginBottom: 4 },
  resetLink: { color: Color.DANGER, textAlign: 'center', paddingVertical: 12 },
  modalList: { maxHeight: 460 },
  fieldLabel: { marginBottom: 6 },
  formGap: { marginBottom: 10 },
});
