import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { ACTION_TOP } from '@/assets/style/space';
import { DateField } from '@/components/common/DateField';
import { FormError } from '@/components/common/FormError';
import { FormInput } from '@/components/common/FormInput';
import { InlineDelete } from '@/components/common/InlineDelete';
import { PressableScale } from '@/components/common/PressableScale';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { ProgressBar } from '@/components/common/ProgressBar';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { SummaryCard, summaryText } from '@/components/common/SummaryCard';
import { VixText } from '@/components/common/VixText';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/contexts/auth';
import { useDraft } from '@/hooks/useDraft';
import {
  deleteFastingPlan,
  FASTING_GRACE_DAYS,
  fastingLockDaysLeft,
  fastingLocked,
  fastingProgress,
  newFastingId,
  saveFastingPlan,
  subscribeFastingPlans,
  type FastingPlan,
} from '@/lib/fasting';
import { dayIdToDate, formatShortDayDate } from '@/lib/format';
import { dayDocId } from '@/lib/health';
import { DELETE_ERROR, SAVE_ERROR } from '@/lib/messages';

// Layar Puasa 🍽️ — MENGATUR satu periode puasa: pokok doa, peraturan, tanggal
// mulai–selesai, dan jawaban doanya. Checklist hariannya punya layar sendiri
// (/fasting-days) — yang ditulis sekali dan yang dibuka tiap malam memang dua
// urusan berbeda. Tanpa ?id= berarti membuat periode BARU.
export default function FastingScreen() {
  const router = useRouter();
  const { user } = useAuth();
  // ?id=<puasa> membuka periode tertentu.
  const { id: idParam } = useLocalSearchParams<{ id?: string }>();

  const [plans, setPlans] = useState<FastingPlan[] | null>(null);
  const [planId, setPlanId] = useState(
    typeof idParam === 'string' ? idParam : '',
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    return subscribeFastingPlans(user.uid, setPlans);
  }, [user]);

  const plan = plans?.find((p) => p.id === planId) ?? null;

  // Keterangan periode. Isinya ikut data tersimpan SELAMA belum diketik —
  // begitu diketik, ketikan itu yang menang (snapshot berikutnya tidak
  // menimpanya). Hook bersama useDraft; dulu satu bendera `loaded` + satu efek
  // besar yang mengisi keenam kolom sekaligus.
  const [today] = useState(() => new Date());
  const [title, setTitle] = useDraft(plan?.title ?? '');
  const [prayer, setPrayer] = useDraft(plan?.prayer ?? '');
  const [rules, setRules] = useDraft(plan?.rules ?? '');
  const [answer, setAnswer] = useDraft(plan?.answer ?? '');
  const [startDate, setStartDate] = useDraft(
    plan?.startId ? dayIdToDate(plan.startId) : today,
  );
  const [endDate, setEndDate] = useDraft(
    plan?.endId ? dayIdToDate(plan.endId) : today,
  );

  const progress = plan ? fastingProgress(plan) : { done: 0, total: 0 };
  // Lewat masa tenggang → catatannya baca-saja SELAMANYA (lihat lib/fasting.ts).
  const terkunci = plan ? fastingLocked(plan, today) : false;
  const sisaKunci = plan ? fastingLockDaysLeft(plan, today) : null;

  // Pil keadaan di kartu atas. Tiga saja, dan ketiganya menjawab pertanyaan
  // yang sama: hari ini aku masih puasa atau tidak?
  const todayId = dayDocId(today);
  const keadaan = terkunci
    ? { label: '🔒 Terkunci', gaya: styles.pillLocked }
    : plan && todayId >= plan.startId && todayId <= plan.endId
      ? { label: '🔥 Berjalan', gaya: styles.pillLive }
      : { label: '✅ Selesai', gaya: styles.pillDone };

  async function handleSaveInfo() {
    if (!user || busy || terkunci) return;
    if (!title.trim()) {
      setError('Isi nama puasanya dulu.');
      return;
    }
    if (endDate < startDate) {
      setError('Tanggal selesai tidak boleh sebelum tanggal mulai.');
      return;
    }
    const id = planId || newFastingId();
    setBusy(true);
    setError(null);
    try {
      await saveFastingPlan(user.uid, id, {
        title: title.trim(),
        prayer: prayer.trim(),
        rules: rules.trim(),
        answer: answer.trim(),
        startId: dayDocId(startDate),
        endId: dayDocId(endDate),
      });
      setPlanId(id);
    } catch {
      setError(SAVE_ERROR);
    } finally {
      setBusy(false);
    }
  }

  async function handleDeletePlan() {
    if (!user || !planId || busy) return;
    setBusy(true);
    try {
      await deleteFastingPlan(user.uid, planId);
      router.back();
    } catch {
      setError(DELETE_ERROR);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader
        backLabel="Spiritual"
        title={
          terkunci ? 'Puasa 🍽️' : planId ? 'Edit Puasa 🍽️' : 'Puasa Baru 🍽️'
        }
        subtitle={
          terkunci
            ? '🔒 Sudah dikunci — tinggal dibaca'
            : 'Pokok doa, peraturan & jawaban doa'
        }
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled">
          {/* ===== Kartu keadaan =====
              Yang paling ingin kamu tahu begitu layar ini terbuka bukan kolom
              isian, tapi: puasa ini sedang apa, dan sudah sejauh mana. Dulu
              jawabannya harus dikumpulkan sendiri dari enam kolom yang
              berderet. */}
          {plan && (
            <SummaryCard style={styles.hero}>
              <View style={styles.heroTop}>
                <VixText heading="label" additionalStyle={summaryText.label}>
                  🍽️ Puasa berhasil
                </VixText>
                <View style={[styles.pill, keadaan.gaya]}>
                  <VixText heading="label" additionalStyle={styles.pillText}>
                    {keadaan.label}
                  </VixText>
                </View>
              </View>
              <VixText heading="header" additionalStyle={summaryText.value}>
                {progress.done}
                <VixText heading="title" additionalStyle={styles.heroTotal}>
                  {' '}
                  / {progress.total} hari
                </VixText>
              </VixText>
              <ProgressBar
                value={progress.done}
                total={progress.total}
                color={Color.SPIRITUAL}
                track={Color.OVERLAY}
              />
              <VixText heading="label" additionalStyle={summaryText.label}>
                📆 {formatShortDayDate(startDate)} → {formatShortDayDate(endDate)}
              </VixText>
            </SummaryCard>
          )}

          {/* ===== Pintu ke checklist harian =====
              Naik ke atas: inilah yang dibuka tiap malam, sedangkan kolom di
              bawahnya diisi sekali di awal lalu jarang disentuh lagi. */}
          {plan && (
            <PressableScale
              style={styles.daysLink}
              onPress={() =>
                router.push({
                  pathname: '/fasting-days',
                  params: { id: plan.id },
                })
              }>
              <View style={styles.daysMain}>
                <VixText heading="bold" additionalStyle={styles.daysTitle}>
                  📆 Lihat Hari per Hari
                </VixText>
                <VixText heading="label" additionalStyle={styles.daysSub}>
                  Centang puasamu tiap malam di sini
                </VixText>
              </View>
              <IconSymbol
                name="chevron.right"
                size={18}
                color={Color.SPIRITUAL_DARK}
              />
            </PressableScale>
          )}

          {/* ===== Tentang puasanya ===== */}
          <Bagian judul="📝 Tentang Puasa">
            <Kolom label="Nama puasa">
              <FormInput
                placeholder="mis. Puasa 6 Hari Agustus"
                value={title}
                onChangeText={setTitle}
                editable={!busy && !terkunci}
              />
            </Kolom>
            <Kolom label="🙏 Pokok doa utama">
              <FormInput
                placeholder="Apa yang kamu doakan sepanjang puasa ini?"
                value={prayer}
                onChangeText={setPrayer}
                editable={!busy && !terkunci}
                multiline
                style={styles.textArea}
              />
            </Kolom>
            <Kolom label="📜 Peraturan puasa saya">
              <FormInput
                placeholder="mis. makan hanya jam 18.00–20.00"
                value={rules}
                onChangeText={setRules}
                editable={!busy && !terkunci}
                multiline
                style={styles.textArea}
              />
            </Kolom>
          </Bagian>

          {/* ===== Rentangnya ===== */}
          <Bagian judul="📆 Periode">
            <Kolom label="Mulai puasa">
              <DateField
                value={startDate}
                onChange={setStartDate}
                disabled={terkunci}
              />
            </Kolom>
            <Kolom label="Selesai puasa">
              <DateField
                value={endDate}
                onChange={setEndDate}
                disabled={terkunci}
              />
            </Kolom>
          </Bagian>

          {/* ===== Hasil keseluruhan =====
              Hanya untuk puasa yang sudah tersimpan: menanyakan jawaban doa
              sebelum puasanya dimulai tidak ada gunanya. */}
          {plan && (
            <Bagian judul="✨ Jawaban Doa">
              <FormInput
                placeholder="Apa yang Tuhan kerjakan lewat puasa ini?"
                value={answer}
                onChangeText={setAnswer}
                editable={!busy && !terkunci}
                multiline
                style={styles.textArea}
              />
            </Bagian>
          )}

          <FormError message={error} gap="none" additionalStyle={styles.error} />

          {/* ===== SATU tombol simpan, di paling bawah =====
              Dulu ada dua — "Simpan Perubahan" di tengah layar dan "Simpan
              Jawaban Doa" di bawah — padahal keduanya memanggil fungsi yang
              sama persis dan menyimpan keenam kolomnya sekaligus. Dua tombol
              untuk satu perbuatan bukan cuma memenuhi layar; ia membuat orang
              mengira jawaban doanya disimpan terpisah, dan ragu apakah yang
              di atas sudah ikut tersimpan atau belum.

              Terkunci → tombolnya HILANG, bukan sekadar mati: tombol mati yang
              tetap terpampang cuma mengundang ditekan berulang. */}
          {terkunci ? (
            <VixText heading="label" additionalStyle={styles.locked}>
              🔒 Puasa ini sudah selesai lebih dari {FASTING_GRACE_DAYS} hari
              lalu, jadi catatannya dikunci — tinggal dibaca.
            </VixText>
          ) : (
            <PrimaryButton
              label={planId ? '💾 Simpan Perubahan' : '✅ Mulai Puasa'}
              busy={busy}
              onPress={handleSaveInfo}
              additionalStyle={styles.saveButton}
              background={Color.SPIRITUAL_DARK}
            />
          )}

          {/* Peringatan sebelum terkunci — biar tidak kaget kehilangan akses. */}
          {sisaKunci !== null && (
            <VixText heading="label" additionalStyle={styles.locked}>
              ⏳ Bisa diubah{' '}
              {sisaKunci === 0 ? 'sampai hari ini saja' : `${sisaKunci} hari lagi`},
              sesudah itu dikunci selamanya.
            </VixText>
          )}

          {/* Hapus TETAP ada walau terkunci. Yang dikunci itu MENGUBAH
              catatannya — mencentang hari yang dulu gagal jadi berhasil.
              Membuang seluruh catatan yang salah masuk itu perkara lain, dan
              tanpa ini catatan salah ketik tertinggal selamanya. */}
          {plan && (
            <InlineDelete
              label="Hapus puasa ini…"
              busy={busy}
              onDelete={handleDeletePlan}
            />
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/**
 * Satu kelompok isian dalam kartunya sendiri.
 *
 * Enam kolom yang berderet lurus tanpa jeda terbaca sebagai satu formulir
 * panjang yang harus dihabiskan. Dikelompokkan begini, layarnya jadi tiga
 * urusan yang jelas — tentang puasanya, kapan, dan hasilnya — dan mata punya
 * tempat berhenti di antara ketiganya.
 */
function Bagian({ judul, children }: { judul: string; children: ReactNode }) {
  return (
    <View style={styles.bagian}>
      <VixText heading="title" additionalStyle={styles.bagianJudul}>
        {judul}
      </VixText>
      {children}
    </View>
  );
}

function Kolom({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.kolom}>
      <VixText heading="label" additionalStyle={styles.kolomLabel}>
        {label}
      </VixText>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.BACKGROUND },
  flex: { flex: 1 },
  // paddingTop 4 = sama dengan layar berisian lain (mis. Template Chat).
  content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 32 },
  textArea: { minHeight: 84, textAlignVertical: 'top' },
  error: { marginTop: 10 },
  // Jarak tombol aksi dari isian di atasnya — sama dengan layar Spiritual lain.
  saveButton: { marginTop: ACTION_TOP },
  locked: { color: Color.TEXT_LABEL, marginTop: ACTION_TOP },

  // ── Kartu keadaan ──────────────────────────────────────────────────────
  hero: { gap: 8, marginBottom: 14 },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  // Angka besar "6" diikuti "/ 6 hari" yang lebih kecil — penyebutnya konteks,
  // bukan berita, jadi tidak perlu sebesar yang dicapai.
  heroTotal: { color: Color.TEXT_REVERSE, opacity: 0.75 },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  pillText: { color: Color.TEXT_REVERSE },
  pillLive: { backgroundColor: Color.SPIRITUAL_DARK, borderColor: Color.SPIRITUAL },
  pillDone: { backgroundColor: 'transparent', borderColor: Color.SPIRITUAL },
  pillLocked: { backgroundColor: 'transparent', borderColor: Color.BORDER },

  // ── Kelompok isian ─────────────────────────────────────────────────────
  bagian: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Color.BORDER,
    padding: 16,
    marginTop: 14,
    gap: 12,
  },
  bagianJudul: { marginBottom: 2 },
  kolom: { gap: 6 },
  kolomLabel: { color: Color.TEXT_LABEL },

  // Pintu ke checklist harian — kartu ungu muda, bentuk yang sama dengan
  // kartu "Sedang Puasa" di daftarnya.
  daysLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Color.SPIRITUAL,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Color.SPIRITUAL_DARK,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  daysMain: { flex: 1, gap: 2 },
  daysTitle: { color: Color.TEXT_TITLE },
  daysSub: { color: Color.SPIRITUAL_DARK },
});
