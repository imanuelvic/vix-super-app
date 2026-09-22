import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { CARD_GAP } from '@/assets/style/card';
import { Color } from '@/assets/style/color';
import { Chip } from '@/components/common/Chip';
import { ChipRow } from '@/components/common/ChipRow';
import { FormError } from '@/components/common/FormError';
import { PressableScale } from '@/components/common/PressableScale';
import { SheetModal } from '@/components/common/SheetModal';
import { SoftPill } from '@/components/common/SoftPill';
import { VixText } from '@/components/common/VixText';
import {
  askCoach,
  COACH_QUESTIONS,
  coachCallsLeft,
  coachErrorMessage,
  loadCoachDay,
  saveCoachDay,
  type CoachAnswer,
  type CoachDay,
  type CoachFacts,
  type CoachQuestionKey,
} from '@/lib/financeCoach';
import type { Insight } from '@/lib/financeInsight';

// 🤖 Vix Financial Coach di Dashboard Finance.
//
// Kartunya SELALU berisi: insight lokal (rumus lib/financeInsight, tanpa AI,
// tanpa kuota) dengan headline = yang paling perlu diperhatikan. Tombol
// "✨ Tanya Coach" membuka sheet berisi pertanyaan preset; baru di situ Gemini
// dipanggil, HANYA saat pertanyaan di-click, dan jawabannya diingat per hari
// (lib/financeCoach). Jawaban dipisah DATA / INTERPRETASI / SARAN supaya
// jelas mana angka, mana dugaan, mana pilihan.
export function CoachCard({
  insights,
  facts,
  dayId,
  onSeeInsight,
}: {
  insights: Insight[];
  facts: CoachFacts;
  dayId: string;
  /** Buka daftar insight lengkap (Budget Health) di bawah. */
  onSeeInsight?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [day, setDay] = useState<CoachDay | null>(null);
  const [question, setQuestion] = useState<CoachQuestionKey | null>(null);
  const [answer, setAnswer] = useState<CoachAnswer | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let hidup = true;
    loadCoachDay(dayId).then((d) => {
      if (hidup) setDay(d);
    });
    return () => {
      hidup = false;
    };
  }, [dayId]);

  const headline = insights[0];
  const rest = insights.slice(1, 3);

  async function tanya(key: CoachQuestionKey) {
    if (busy || !day) return;
    setQuestion(key);
    setError(null);
    // Jawaban tersimpan untuk angka yang sama tampil seketika (tanpa AI).
    setBusy(true);
    try {
      const hasil = await askCoach(key, facts, dayId, day);
      setAnswer(hasil.answer);
      if (!hasil.fromCache) {
        setDay(hasil.day);
        await saveCoachDay(dayId, hasil.day);
      }
    } catch (e) {
      setAnswer(null);
      setError(coachErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const sisa = day ? coachCallsLeft(day) : 0;

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <VixText heading="title">🤖 Vix Financial Coach</VixText>
      </View>
      {headline && (
        <VixText heading="paragraph" additionalStyle={styles.headline}>
          {headline.emoji} {headline.text}
        </VixText>
      )}
      {rest.map((i, idx) => (
        <VixText key={idx} heading="label" additionalStyle={styles.more}>
          {i.emoji} {i.text}
        </VixText>
      ))}
      <View style={styles.actions}>
        <SoftPill label="✨ Tanya Coach" onPress={() => setOpen(true)} disabled={!day} />
        {onSeeInsight && (
          <PressableScale onPress={onSeeInsight} hitSlop={8}>
            <VixText heading="label" additionalStyle={styles.link}>
              See insight ›
            </VixText>
          </PressableScale>
        )}
      </View>

      <SheetModal
        visible={open}
        title="🤖 Tanya Vix Coach"
        subtitle={`Jawaban dari angka bulan ini & riwayat · sisa ${sisa} pertanyaan hari ini`}
        onClose={() => setOpen(false)}>
        {/* Pertanyaan preset: baris chip bersama (bisa digeser ke samping) */}
        <ChipRow
          activeIndex={Math.max(0, COACH_QUESTIONS.findIndex((q) => q.key === question))}
          additionalStyle={styles.chipRow}>
          {COACH_QUESTIONS.map((q) => (
            <Chip
              key={q.key}
              label={q.label}
              active={question === q.key}
              onPress={() => tanya(q.key)}
            />
          ))}
        </ChipRow>

        {busy && <SoftPill label="Coach sedang membaca angkamu…" busy onPress={() => {}} />}
        <FormError message={error} gap="top" />

        {answer && !busy ? (
          <CoachAnswerView answer={answer} />
        ) : !busy && !error ? (
          <VixText heading="label" additionalStyle={styles.hint}>
            Pilih pertanyaan di atas. Pertanyaan yang sama dengan angka yang sama
            dijawab dari ingatan, tanpa memakai kuota.
          </VixText>
        ) : null}
      </SheetModal>
    </View>
  );
}

/** Jawaban Coach: headline + DATA / INTERPRETASI / SARAN (dipakai juga layar Review). */
export function CoachAnswerView({ answer }: { answer: CoachAnswer }) {
  return (
    <View style={styles.answer}>
      <VixText heading="bold" additionalStyle={styles.answerHeadline}>
        {answer.headline}
      </VixText>
      <Bagian label="DATA" items={answer.data} />
      <Bagian label="INTERPRETASI" items={answer.interpretasi} />
      <Bagian label="SARAN" items={answer.saran} />
      <VixText heading="label" additionalStyle={styles.footnote}>
        Coach membaca ringkasan angka saja, bukan catatan transaksimu. Keputusan
        tetap milikmu.
      </VixText>
    </View>
  );
}

function Bagian({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <View style={styles.bagian}>
      <VixText heading="label" additionalStyle={styles.eyebrow}>
        {label}
      </VixText>
      {items.map((t, i) => (
        <VixText key={i} heading="paragraph" additionalStyle={styles.item}>
          • {t}
        </VixText>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Color.BORDER,
    padding: 16,
    gap: 8,
    marginBottom: CARD_GAP,
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
  headline: { color: Color.TEXT_TITLE },
  more: { color: Color.TEXT_LABEL },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginTop: 2 },
  link: { color: Color.MAIN_DARK, textDecorationLine: 'underline' },
  chipRow: { marginBottom: 10 },
  hint: { color: Color.TEXT_LABEL, marginTop: 4 },
  answer: {
    marginTop: 10,
    backgroundColor: Color.MAIN_TRANSPARENT,
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  answerHeadline: { color: Color.MAIN_DARK },
  bagian: { gap: 2 },
  eyebrow: { color: Color.TEXT_LABEL, letterSpacing: 1.4 },
  item: { color: Color.TEXT_PARAGRAPH },
  footnote: { color: Color.TEXT_LABEL, marginTop: 2 },
});
