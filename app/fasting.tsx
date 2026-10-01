import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { SCREEN_CONTENT, SCREEN_SAFE } from '@/assets/style/layout';
import { ACTION_TOP } from '@/assets/style/space';
import { DateField } from '@/components/common/DateField';
import { FormError } from '@/components/common/FormError';
import { FormInput } from '@/components/common/FormInput';
import { InlineDelete } from '@/components/common/InlineDelete';
import { PressableScale } from '@/components/common/PressableScale';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { ReadBlock } from '@/components/common/ReadBlock';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { VixText } from '@/components/common/VixText';
import { FastingIntro } from '@/components/spiritual/FastingIntro';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/contexts/auth';
import { useDraft } from '@/hooks/useDraft';
import { useLive } from '@/hooks/useLive';
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
import { fastingTitleOf } from '@/lib/fastingWhy';
import { dayIdToDate, formatShortDayDate, monthLabel } from '@/lib/format';
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

  const [plans] = useLive<FastingPlan[]>(subscribeFastingPlans);
  const [planId, setPlanId] = useState(
    typeof idParam === 'string' ? idParam : '',
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  // Perjalanan tiga langkah sudah dilewati? Hanya berlaku untuk puasa BARU;
  // membuka puasa lama (?id=…) langsung ke formulirnya.
  const [introSelesai, setIntroSelesai] = useState(false);
  const introTampil = !planId && !introSelesai;

  const progress = plan
    ? fastingProgress(plan)
    : { done: 0, failed: 0, total: 0 };
  // Lewat masa tenggang → catatannya baca-saja SELAMANYA (lihat lib/fasting.ts).
  const terkunci = plan ? fastingLocked(plan, today) : false;
  const sisaKunci = plan ? fastingLockDaysLeft(plan, today) : null;

  // Puasa yang tanggal mulainya masih di depan: hitungan hari yang berhasil
  // memang 0 dan itu wajar, jadi keterangannya MENGHITUNG MUNDUR, bukan
  // menagih sesuatu yang belum waktunya dijalani.
  const todayId = dayDocId(today);
  const belumMulai = !!plan && todayId < plan.startId;
  // Berapa hari lagi sampai hari pertamanya.
  const menujuMulai =
    belumMulai && plan
      ? Math.max(
          1,
          Math.round(
            (dayIdToDate(plan.startId).getTime() -
              dayIdToDate(todayId).getTime()) /
              86_400_000,
          ),
        )
      : 0;

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
    const sudahAda = !!planId;
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
      // 💾 Simpan Perubahan → langsung kembali (22 Sep 2026): perubahannya
      // sudah tersimpan, tak ada lagi yang perlu dilihat di sini. Puasa BARU
      // tetap tinggal di layar ini (jadi mode edit) supaya Hari per Hari-nya
      // langsung bisa dibuka.
      if (sudahAda) router.back();
      else setPlanId(id);
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
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        backLabel="Spiritual"
        title={
          terkunci ? 'Puasa 🍽️' : planId ? 'Edit Puasa 🍽️' : 'Puasa Baru 🍽️'
        }
        subtitle={
          terkunci
            ? '🔒 Sudah dikunci, tinggal dibaca'
            : 'Pokok doa, peraturan & jawaban doa'
        }
      />

      {/* ===== Puasa BARU: perjalanan tiga langkah dulu (28 Sep 2026) =====
          Formulirnya baru terbuka sesudah tiga pertanyaan dijawab — kenapa
          puasa, fokusnya apa, apa yang dilepas. Alasan lengkapnya ada di
          lib/fastingWhy.ts; singkatnya, puasa yang diisi dalam 30 detik
          gampang jadi rutinitas kosong, dan itu kekhawatiran pemiliknya
          sendiri. Puasa LAMA (`planId` terisi) tidak lewat sini: ia sudah
          punya jawabannya. */}
      {introTampil ? (
        <FastingIntro
          onCancel={() => router.back()}
          onDone={({ focus, rule }) => {
            // Jawabannya langsung mengisi formulirnya, jadi tidak ada
            // pekerjaan yang terbuang — tiga langkah tadi justru memotong
            // waktu mengetik.
            setTitle(fastingTitleOf(focus, monthLabel()));
            setPrayer(focus.prayer);
            setRules(rule.text);
            setIntroSelesai(true);
          }}
        />
      ) : (
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled">
          {/* ===== Pintu ke checklist harian =====
              1 Okt 2026: kartu keadaan di atasnya DIBUANG, jadi inilah yang
              pertama terlihat. Kartu itu memakan sepertiga layar untuk
              mengulang hal yang sudah tertulis di tempat lain — tanggalnya ada
              di bagian 📆 Periode tepat di bawah, dan keadaan terkuncinya sudah
              disebut pita judul. Yang benar-benar hilang cuma hitungan harinya,
              dan hitungan itu pindah ke sini: ia keterangan dari pintu yang
              dibukanya, bukan kartu tersendiri.

              Inilah yang dibuka tiap malam, sedangkan kolom di bawahnya diisi
              sekali di awal lalu jarang disentuh lagi. */}
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
                  {belumMulai
                    ? `🗓️ Mulai ${menujuMulai} hari lagi`
                    : `✅ ${progress.done} berhasil${
                        progress.failed > 0 ? ` · ✗ ${progress.failed} gagal` : ''
                      } dari ${progress.total} hari`}
                </VixText>
              </View>
              <IconSymbol
                name="chevron.right"
                size={18}
                color={Color.SPIRITUAL_DARK}
              />
            </PressableScale>
          )}

          {/* ===== Isi puasanya: dua keadaan =====
              Terkunci → TAMPILAN BACA (29 Sep 2026), bentuk yang sama persis
              dengan Catatan Khotbah yang sudah lewat masanya: label kecil,
              teksnya di bawahnya, tanpa kotak isian sama sekali.

              Dulu kotaknya tetap digambar, cuma `editable={false}`. Kotak yang
              masih terlihat seperti kotak tetap mengundang diketik — dan
              begitu di-click tidak terjadi apa-apa, yang terbaca "app-nya
              rusak", bukan "ini sudah dikunci". */}
          {terkunci ? (
            <>
              <Bagian judul="📝 Tentang Puasa">
                <ReadBlock label="Nama puasa" text={title} />
                <ReadBlock label="🙏 Pokok doa utama" text={prayer} />
                <ReadBlock label="📜 Peraturan puasa saya" text={rules} />
              </Bagian>

              <Bagian judul="📆 Periode">
                <ReadBlock
                  label="Mulai puasa"
                  text={formatShortDayDate(startDate)}
                />
                <ReadBlock
                  label="Selesai puasa"
                  text={formatShortDayDate(endDate)}
                />
              </Bagian>

              {/* Judul bagiannya sudah menyebut isinya, jadi tidak perlu label
                  lagi. Kosong → seluruh kartunya tidak digambar: kartu berjudul
                  "Jawaban Doa" yang isinya kosong cuma menagih sesuatu yang
                  memang sudah tidak bisa diisi lagi. */}
              {plan && answer.trim() ? (
                <Bagian judul="✨ Jawaban Doa">
                  <ReadBlock text={answer} />
                </Bagian>
              ) : null}
            </>
          ) : (
            <>
              {/* ===== Tentang puasanya ===== */}
              <Bagian judul="📝 Tentang Puasa">
                <Kolom label="Nama puasa">
                  <FormInput
                    placeholder="mis. Puasa 6 Hari Agustus"
                    value={title}
                    onChangeText={setTitle}
                    editable={!busy}
                  />
                </Kolom>
                <Kolom label="🙏 Pokok doa utama">
                  <FormInput
                    placeholder="Apa yang kamu doakan sepanjang puasa ini?"
                    value={prayer}
                    onChangeText={setPrayer}
                    editable={!busy}
                    multiline
                    style={styles.textArea}
                  />
                </Kolom>
                <Kolom label="📜 Peraturan puasa saya">
                  <FormInput
                    placeholder="mis. makan hanya jam 12.00–19.00"
                    value={rules}
                    onChangeText={setRules}
                    editable={!busy}
                    multiline
                    style={styles.textArea}
                  />
                </Kolom>
              </Bagian>

              {/* ===== Rentangnya ===== */}
              <Bagian judul="📆 Periode">
                <Kolom label="Mulai puasa">
                  <DateField value={startDate} onChange={setStartDate} />
                </Kolom>
                <Kolom label="Selesai puasa">
                  <DateField value={endDate} onChange={setEndDate} />
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
                    editable={!busy}
                    multiline
                    style={styles.textArea}
                  />
                </Bagian>
              )}
            </>
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
              tetap terpampang cuma mengundang di-click berulang. */}
          {terkunci ? (
            <VixText heading="label" additionalStyle={styles.locked}>
              🔒 Puasa ini sudah selesai lebih dari {FASTING_GRACE_DAYS} hari
              lalu, jadi catatannya dikunci, tinggal dibaca.
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
      )}
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
  safe: { ...SCREEN_SAFE },
  flex: { flex: 1 },
  // paddingTop 4 = sama dengan layar berisian lain (mis. Template Chat).
  content: { ...SCREEN_CONTENT, paddingBottom: 40 },
  textArea: { minHeight: 84, textAlignVertical: 'top' },
  error: { marginTop: 10 },
  // Jarak tombol aksi dari isian di atasnya — sama dengan layar Spiritual lain.
  saveButton: { marginTop: ACTION_TOP },
  locked: { color: Color.TEXT_LABEL, marginTop: ACTION_TOP },

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
