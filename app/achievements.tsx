import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CARD } from '@/assets/style/card';
import { Color } from '@/assets/style/color';
import { SECTION_SPACE } from '@/assets/style/section';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { EditFooter } from '@/components/common/EditFooter';
import { BadgeTile, badgeGrid } from '@/components/common/BadgeTile';
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
import { useAuth } from '@/contexts/auth';
import { useAchievementStats } from '@/hooks/useAchievementStats';
import {
  ACHIEVEMENTS,
  ACHIEVEMENT_CATEGORIES,
  resetAchievements,
  subscribeSelfRewardBalance,
  type AchievementCategoryKey,
} from '@/lib/achievements';
import { formatShortRupiah, groupDigits, parseAmount } from '@/lib/format';
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
import { formatRupiah } from '@/lib/transactions';

// Achievement 🏆 — pencapaian dikelompokkan per kategori (ala Duolingo).
//
// Layar ini cuma PAPAN KATEGORI: satu lambang per kategori dalam grid tiga
// kolom, ditambah saku self-reward di bawahnya. Rincian tiap kategori — tangga
// lencananya — punya halamannya sendiri (app/achievement-category.tsx).
//
// Dulu rincian itu muncul sebagai modal di layar ini. Bentuk itu memaksa dua
// hal yang tak enak sekaligus: isinya digulung DI DALAM kotak yang juga
// menggulung, dan seluruh angka mentah app (sembilan langganan) harus dirakit
// di sini walau yang membacanya cuma modalnya. Sekarang angkanya dirakit
// useAchievementStats, dan dipakai kedua layar dengan arti yang sama persis.
export default function AchievementsScreen() {
  const router = useRouter();
  const { user } = useAuth();

  // Angka mentah seluruh achievement — dirakit di satu tempat, dipakai juga
  // oleh halaman rincian kategori.
  const { stats, error: statsError } = useAchievementStats();

  const [balance, setBalance] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Daftar hadiah incaran + riwayat klaimnya (dua dokumen array kecil).
  const [rewards, setRewards] = useState<SelfReward[]>([]);
  const [claimed, setClaimed] = useState<ClaimedReward[]>([]);

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
      subscribeSelfRewardBalance(user.uid, setBalance, fail),
      subscribeSelfRewards(user.uid, setRewards, fail),
      subscribeClaimedRewards(user.uid, setClaimed, fail),
    ]);
  }, [user]);

  const unlocked = ACHIEVEMENTS.filter((a) => a.of(stats) >= a.target).length;

  // Ringkasan satu kategori: daftar + berapa yang sudah terbuka.
  function catInfo(key: AchievementCategoryKey) {
    const list = ACHIEVEMENTS.filter((a) => a.category === key);
    const done = list.filter((a) => a.of(stats) >= a.target).length;
    return { list, done, total: list.length };
  }

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

      <ScreenError message={error ?? statsError} />

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

        {/* ===== Kategori pencapaian (klik → halamannya) ===== */}
        <VixText heading="title" additionalStyle={styles.sectionTitle}>
          🎖️ Kategori Pencapaian
        </VixText>
        {/* Grid tiga kolom — bentuk yang sama dengan tangga lencana di dalam
            tiap kategori, jadi "papan besar" dan "papan kecil" terbaca satu
            keluarga. Sebagai daftar memanjang, sebelas kategori memakan dua
            layar penuh sebelum sampai ke Self-Reward di bawahnya.

            Diklik → HALAMAN kategorinya, bukan modal. */}
        <View style={badgeGrid.grid}>
          {ACHIEVEMENT_CATEGORIES.map((cat) => {
            const { done, total } = catInfo(cat.key);
            const pct = total > 0 ? (done / total) * 100 : 0;
            // Berwarna penuh begitu ADA satu yang terbuka — bukan hanya saat
            // lengkap. Kategori yang sudah kamu jalani tidak boleh terlihat
            // sama pudarnya dengan yang belum pernah disentuh.
            const mulai = done > 0;
            return (
              <BadgeTile
                key={cat.key}
                icon={cat.icon}
                tag={`${done}/${total}`}
                title={cat.label}
                unlocked={mulai}
                onPress={() =>
                  router.push({
                    pathname: '/achievement-category',
                    params: { cat: cat.key },
                  })
                }>
                <View style={styles.catBar}>
                  <View
                    style={[
                      styles.barFill,
                      { width: `${pct}%` },
                      done === total && styles.barFillDone,
                    ]}
                  />
                </View>
              </BadgeTile>
            );
          })}
        </View>

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
  sectionTitle: { ...SECTION_SPACE },
  // Baris pencapaian / reward.
  row: {
    ...CARD,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  rowLocked: { opacity: 0.55 },
  rowIcon: { fontSize: 26, lineHeight: 32 },
  rowMain: { flex: 1, gap: 4 },
  rowTitle: { color: Color.TEXT_TITLE },
  lockText: { color: Color.TEXT_PLACEHOLDER },
  // Batang kemajuan tipis di kaki petak kategori — selebar petaknya.
  catBar: {
    width: '100%',
    height: 5,
    borderRadius: 3,
    backgroundColor: Color.CONTRAST_CONTAINER,
    overflow: 'hidden',
  },
  // Progress bar (tiap hadiah self-reward).
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
  fieldLabel: { marginBottom: 6 },
  formGap: { marginBottom: 10 },
});
