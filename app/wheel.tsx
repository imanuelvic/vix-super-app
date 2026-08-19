import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { CenterDialog } from '@/components/common/CenterDialog';
import { Chip } from '@/components/common/Chip';
import { FormInput } from '@/components/common/FormInput';
import { KeyboardAwareScrollView } from '@/components/common/KeyboardAwareScrollView';
import { LoadingCenter } from '@/components/common/LoadingCenter';
import { PressableScale } from '@/components/common/PressableScale';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { ProgressBar } from '@/components/common/ProgressBar';
import { ScreenError } from '@/components/common/ScreenError';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { VixText } from '@/components/common/VixText';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { RadarChart } from '@/components/wheel/RadarChart';
import { ScoreMeter } from '@/components/wheel/ScoreMeter';
import { useAuth } from '@/contexts/auth';
import { formatDecimal, formatFullDateTime } from '@/lib/format';
import { LOAD_ERROR, SAVE_ERROR } from '@/lib/messages';
import {
  MIN_FOCUS,
  quarterDocId,
  quarterLabel,
  quarterOf,
  saveWheelFocus,
  saveWheelScores,
  shiftQuarter,
  subscribeWheel,
  WHEEL_AREAS,
  WHEEL_TIPS,
  type WheelAreaKey,
  type WheelData,
  type WheelFocus,
} from '@/lib/wheel';

type Mode = 'overview' | 'assess' | 'focus';

/**
 * Nada skor: ≥8 sehat, 5–7 perlu naik, <5 darurat. Satu skor memberi tiga hal
 * sekaligus — warna bar, latar pil, & warna angkanya — supaya tingkat "sehat"
 * kebaca dari bentuk, bukan cuma dari angka.
 */
function scoreTone(score: number) {
  if (score >= 8) {
    return { color: Color.MAIN, pill: styles.pillOk, text: styles.toneOk };
  }
  if (score >= 5) {
    return { color: Color.WARNING, pill: styles.pillWarn, text: styles.toneWarn };
  }
  return { color: Color.DANGER, pill: styles.pillDanger, text: styles.toneDanger };
}

// Wheel of Life 🎡 — nilai 8 area hidup per kuartal, lihat bentuk "roda"-mu
// di radar chart, lalu fokus perbaiki minimal 3 area.
export default function WheelScreen() {
  const { user } = useAuth();

  const nowQ = quarterOf(new Date());
  const [year, setYear] = useState(nowQ.year);
  const [q, setQ] = useState(nowQ.q);
  const qid = quarterDocId(year, q);

  const [data, setData] = useState<WheelData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('overview');
  const [busy, setBusy] = useState(false);

  // ---- Wizard assessment ----
  const [idx, setIdx] = useState(0);
  const [draftScores, setDraftScores] = useState<WheelData['scores']>({});
  const [draftNotes, setDraftNotes] = useState<WheelData['notes']>({});
  const [assessError, setAssessError] = useState<string | null>(null);

  // ---- Editor fokus ----
  const [selected, setSelected] = useState<WheelAreaKey[]>([]);
  const [targets, setTargets] = useState<Partial<Record<WheelAreaKey, number>>>({});
  const [plans, setPlans] = useState<Partial<Record<WheelAreaKey, string>>>({});
  const [focusError, setFocusError] = useState<string | null>(null);

  // Modal tips: area yang sedang dilihat tips-nya (null = tertutup).
  const [tipArea, setTipArea] = useState<WheelAreaKey | null>(null);

  useEffect(() => {
    if (!user) return;
    setData(null);
    const unsubscribe = subscribeWheel(
      user.uid,
      qid,
      (next) => {
        setData(next);
        setError(null);
      },
      () => setError(LOAD_ERROR),
    );
    return unsubscribe;
  }, [user, qid]);

  function shift(delta: number) {
    const next = shiftQuarter(year, q, delta);
    setYear(next.year);
    setQ(next.q);
    setMode('overview'); // ganti kuartal = kembali ke ringkasan
  }

  const hasScores =
    data !== null && WHEEL_AREAS.every((a) => (data.scores[a.key] ?? 0) > 0);
  const values = WHEEL_AREAS.map((a) => data?.scores[a.key] ?? 0);
  const avg = values.reduce((s, v) => s + v, 0) / WHEEL_AREAS.length;

  // Sebaran nada skor — ringkasan sekilas di atas daftar "Skor per Area".
  const okCount = values.filter((v) => v >= 8).length;
  const warnCount = values.filter((v) => v >= 5 && v < 8).length;
  const dangerCount = values.filter((v) => v < 5).length;

  // Total poin yang masih harus dikejar dari semua area fokus.
  const focusGap = (data?.focus ?? []).reduce(
    (s, f) => s + Math.max(0, f.targetScore - (data?.scores[f.area] ?? 0)),
    0,
  );

  // Poligon target: skor target untuk area fokus, skor sekarang untuk sisanya.
  const targetValues =
    data && data.focus.length > 0
      ? WHEEL_AREAS.map((a) => {
          const f = data.focus.find((x) => x.area === a.key);
          return f ? f.targetScore : (data.scores[a.key] ?? 0);
        })
      : undefined;

  // ---- Mulai assessment (prefill kalau mengulang) ----
  function startAssess() {
    setDraftScores({ ...(data?.scores ?? {}) });
    setDraftNotes({ ...(data?.notes ?? {}) });
    setIdx(0);
    setAssessError(null);
    setMode('assess');
  }

  async function nextAssess() {
    const area = WHEEL_AREAS[idx];
    if (!draftScores[area.key]) {
      setAssessError('Pilih nilai 1–10 dulu ya.');
      return;
    }
    setAssessError(null);
    if (idx < WHEEL_AREAS.length - 1) {
      setIdx(idx + 1);
      return;
    }
    // Pertanyaan terakhir → simpan.
    if (!user || busy) return;
    setBusy(true);
    try {
      await saveWheelScores(user.uid, qid, draftScores, draftNotes);
      setMode('overview');
    } catch {
      setAssessError(SAVE_ERROR);
    } finally {
      setBusy(false);
    }
  }

  // ---- Editor fokus ----
  function startFocus() {
    if (!data) return;
    if (data.focus.length > 0) {
      // Edit fokus yang sudah ada.
      setSelected(data.focus.map((f) => f.area));
      setTargets(
        Object.fromEntries(data.focus.map((f) => [f.area, f.targetScore])),
      );
      setPlans(Object.fromEntries(data.focus.map((f) => [f.area, f.plan])));
    } else {
      // Saran awal: 3 area dengan skor terendah.
      const lowest = [...WHEEL_AREAS]
        .sort((a, b) => (data.scores[a.key] ?? 0) - (data.scores[b.key] ?? 0))
        .slice(0, MIN_FOCUS)
        .map((a) => a.key);
      setSelected(lowest);
      setTargets({});
      setPlans({});
    }
    setFocusError(null);
    setMode('focus');
  }

  function toggleArea(key: WheelAreaKey) {
    setSelected((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  }

  async function handleSaveFocus() {
    if (!user || !data || busy) return;
    if (selected.length < MIN_FOCUS) {
      setFocusError(`Pilih minimal ${MIN_FOCUS} area fokus.`);
      return;
    }
    const focus: WheelFocus[] = [];
    for (const key of selected) {
      const target = targets[key];
      if (!target) {
        setFocusError('Semua area fokus harus punya target skor.');
        return;
      }
      focus.push({ area: key, targetScore: target, plan: (plans[key] ?? '').trim() });
    }
    setBusy(true);
    setFocusError(null);
    try {
      await saveWheelFocus(user.uid, qid, focus);
      setMode('overview');
    } catch {
      setFocusError(SAVE_ERROR);
    } finally {
      setBusy(false);
    }
  }

  // ============================ RENDER ============================

  const area = WHEEL_AREAS[idx];
  const tipMeta = tipArea ? WHEEL_AREAS.find((a) => a.key === tipArea)! : null;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        backLabel="Home"
        title="Wheel of Life 🎡"
        subtitle="8 area hidupmu per kuartal">
        {mode === 'overview' && (
          <View style={styles.quarterRow}>
            <PressableScale onPress={() => shift(-1)} hitSlop={10}>
              <IconSymbol name="chevron.left" size={20} color={Color.MAIN} />
            </PressableScale>
            {/* Tekan label kuartal → balik ke kuartal berjalan */}
            <PressableScale
              onPress={() => {
                setYear(nowQ.year);
                setQ(nowQ.q);
              }}
              hitSlop={10}>
              <VixText heading="bold" additionalStyle={styles.quarterText}>
                {quarterLabel(year, q)}
              </VixText>
            </PressableScale>
            <PressableScale onPress={() => shift(1)} hitSlop={10}>
              <IconSymbol name="chevron.right" size={20} color={Color.MAIN} />
            </PressableScale>
          </View>
        )}
      </ScreenHeader>

      <ScreenError message={error} />

      {data === null ? (
        <LoadingCenter />
      ) : mode === 'assess' ? (
        /* ===== Wizard assessment: 1 pertanyaan per layar ===== */
        <KeyboardAwareScrollView contentContainerStyle={styles.content}>
          <VixText heading="label">
            Pertanyaan {idx + 1} dari {WHEEL_AREAS.length}
          </VixText>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${((idx + 1) / WHEEL_AREAS.length) * 100}%` },
              ]}
            />
          </View>

          <VixText additionalStyle={styles.assessIcon}>{area.icon}</VixText>
          <VixText heading="subheader" additionalStyle={styles.assessTitle}>
            {area.label}
          </VixText>
          <VixText heading="paragraph" additionalStyle={styles.assessQuestion}>
            {area.question}
          </VixText>

          {/* Pilihan nilai 1–10 */}
          <View style={styles.scoreWrap}>
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
              const active = draftScores[area.key] === n;
              return (
                <PressableScale
                  key={n}
                  style={[styles.scoreChip, active && styles.scoreActive]}
                  onPress={() =>
                    setDraftScores((prev) => ({ ...prev, [area.key]: n }))
                  }>
                  <VixText
                    heading="bold"
                    additionalStyle={active ? styles.scoreTextActive : undefined}>
                    {n}
                  </VixText>
                </PressableScale>
              );
            })}
          </View>

          <FormInput
            style={styles.noteInput}
            placeholder="Jelaskan alasan penilaianmu (opsional)"
            value={draftNotes[area.key] ?? ''}
            onChangeText={(t) =>
              setDraftNotes((prev) => ({ ...prev, [area.key]: t }))
            }
            multiline
            editable={!busy}
          />

          <ScreenError message={assessError} />

          <View style={styles.navRow}>
            <PressableScale
              style={styles.backButton}
              onPress={() => (idx > 0 ? setIdx(idx - 1) : setMode('overview'))}
              disabled={busy}>
              <VixText heading="bold">{idx > 0 ? 'Kembali' : 'Batal'}</VixText>
            </PressableScale>
            <PrimaryButton
              label={idx === WHEEL_AREAS.length - 1 ? 'Selesai ✅' : 'Lanjut'}
              busy={busy}
              onPress={nextAssess}
              additionalStyle={styles.nextButton}
            />
          </View>
        </KeyboardAwareScrollView>
      ) : mode === 'focus' ? (
        /* ===== Editor fokus kuartal ===== */
        <KeyboardAwareScrollView contentContainerStyle={styles.content}>
          <VixText heading="title">🎯 Fokus {quarterLabel(year, q)}</VixText>
          <VixText heading="label" additionalStyle={styles.focusHint}>
            Pilih minimal {MIN_FOCUS} area untuk dikembangkan kuartal ini
            (disarankan {MIN_FOCUS} saja biar fokus). Saran otomatis: area
            dengan skor terendah.
          </VixText>

          <View style={styles.chipWrap}>
            {WHEEL_AREAS.map((a) => (
              <Chip
                key={a.key}
                label={`${a.icon} ${a.label} · ${data.scores[a.key] ?? 0}`}
                active={selected.includes(a.key)}
                onPress={() => toggleArea(a.key)}
              />
            ))}
          </View>

          {selected.map((key) => {
            const meta = WHEEL_AREAS.find((a) => a.key === key)!;
            const current = data.scores[key] ?? 0;
            return (
              <View key={key} style={styles.focusCard}>
                <VixText heading="bold" additionalStyle={styles.focusCardTitle}>
                  {meta.icon} {meta.label}{' '}
                  <VixText heading="label">· sekarang {current}</VixText>
                </VixText>
                <VixText heading="label">Target skor kuartal ini:</VixText>
                <View style={styles.scoreWrap}>
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
                    const active = targets[key] === n;
                    return (
                      <PressableScale
                        key={n}
                        style={[styles.scoreChip, active && styles.scoreActive]}
                        onPress={() =>
                          setTargets((prev) => ({ ...prev, [key]: n }))
                        }>
                        <VixText
                          heading="bold"
                          additionalStyle={
                            active ? styles.scoreTextActive : undefined
                          }>
                          {n}
                        </VixText>
                      </PressableScale>
                    );
                  })}
                </View>
                <FormInput
                  style={styles.noteInput}
                  placeholder="Action plan — apa yang akan kamu lakukan?"
                  value={plans[key] ?? ''}
                  onChangeText={(t) =>
                    setPlans((prev) => ({ ...prev, [key]: t }))
                  }
                  multiline
                  editable={!busy}
                />
              </View>
            );
          })}

          <ScreenError message={focusError} />
          <View style={styles.navRow}>
            <PressableScale
              style={styles.backButton}
              onPress={() => setMode('overview')}
              disabled={busy}>
              <VixText heading="bold">Batal</VixText>
            </PressableScale>
            <PrimaryButton
              label="Simpan Fokus"
              busy={busy}
              onPress={handleSaveFocus}
              additionalStyle={styles.nextButton}
            />
          </View>
        </KeyboardAwareScrollView>
      ) : (
        /* ===== Overview ===== */
        <ScrollView contentContainerStyle={styles.content}>
          {!hasScores ? (
            <View style={styles.introCard}>
              <VixText additionalStyle={styles.introEmoji}>🎡</VixText>
              <VixText heading="title" additionalStyle={styles.introTitle}>
                Bagaimana bentuk hidupmu kuartal ini?
              </VixText>
              <VixText heading="label" additionalStyle={styles.introText}>
                Nilai 8 area hidupmu (1–10), lihat bentuk “roda”-mu di radar
                chart, lalu pilih minimal {MIN_FOCUS} area untuk dikembangkan.
              </VixText>
              <PrimaryButton
                label="Mulai Assessment"
                onPress={startAssess}
                additionalStyle={styles.introButton}
              />
            </View>
          ) : (
            <>
              {/* Radar chart + rata-rata */}
              <View style={styles.chartCard}>
                <RadarChart
                  size={300}
                  values={values}
                  secondary={targetValues}
                  labels={WHEEL_AREAS.map((a) => a.icon)}
                />
                <VixText heading="subheader" additionalStyle={styles.avgValue}>
                  {formatDecimal(avg)}
                  <VixText heading="label"> / 10 rata-rata</VixText>
                </VixText>
                {targetValues && (
                  <VixText heading="label">
                    ── skor sekarang · ┄┄ target fokus
                  </VixText>
                )}
              </View>

              {/* Fokus kuartal */}
              <View style={styles.sectionHeader}>
                <View style={styles.sectionHeadMain}>
                  <VixText heading="title">🎯 Fokus Kuartal</VixText>
                  {data.focus.length > 0 && (
                    <VixText heading="label">
                      {data.focus.length} area ·{' '}
                      {focusGap > 0
                        ? `kurang ${focusGap} poin lagi`
                        : 'semua target tercapai 🎉'}
                    </VixText>
                  )}
                </View>
                <PressableScale
                  style={styles.editButton}
                  onPress={startFocus}
                  hitSlop={10}>
                  <VixText heading="bold" additionalStyle={styles.editText}>
                    {data.focus.length > 0 ? 'Ubah' : 'Pilih'}
                  </VixText>
                </PressableScale>
              </View>
              {data.focus.length === 0 ? (
                <VixText heading="label" additionalStyle={styles.emptyFocus}>
                  Belum ada area fokus — pilih minimal {MIN_FOCUS} untuk kuartal
                  ini.
                </VixText>
              ) : (
                data.focus.map((f) => {
                  const meta = WHEEL_AREAS.find((a) => a.key === f.area)!;
                  const current = data.scores[f.area] ?? 0;
                  const tone = scoreTone(current);
                  const gap = Math.max(0, f.targetScore - current);
                  return (
                    // Tekan kartu → modal tips menaikkan skor area ini.
                    <PressableScale
                      key={f.area}
                      style={styles.focusCard}
                      onPress={() => setTipArea(f.area)}>
                      {/* Emoji besar + nama + pil sisa poin */}
                      <View style={styles.focusRow}>
                        <View style={styles.focusEmojiBox}>
                          <VixText additionalStyle={styles.focusEmoji}>
                            {meta.icon}
                          </VixText>
                        </View>
                        <View style={styles.focusHeadMain}>
                          <VixText
                            heading="bold"
                            additionalStyle={styles.focusCardTitle}>
                            {meta.label}
                          </VixText>
                          <VixText heading="label">
                            sekarang {current} · target {f.targetScore}
                          </VixText>
                        </View>
                        <View
                          style={[
                            styles.deltaPill,
                            gap === 0 ? styles.pillOk : styles.pillGap,
                          ]}>
                          <VixText
                            heading="bold"
                            additionalStyle={
                              gap === 0 ? styles.toneOk : styles.deltaText
                            }>
                            {gap === 0 ? '✓ tercapai' : `+${gap}`}
                          </VixText>
                        </View>
                      </View>

                      {/* Satu bar, dua angka: mint = target, warna = sekarang */}
                      <ScoreMeter
                        value={current}
                        target={f.targetScore}
                        color={tone.color}
                      />

                      {f.plan ? (
                        <View style={styles.planBox}>
                          <VixText
                            heading="paragraph"
                            additionalStyle={styles.planText}>
                            {f.plan}
                          </VixText>
                        </View>
                      ) : null}
                      <View style={styles.tipsHintRow}>
                        <VixText heading="label" additionalStyle={styles.tipsHint}>
                          💡 Tips naikkan skor
                        </VixText>
                        <IconSymbol
                          name="chevron.right"
                          size={14}
                          color={Color.MAIN}
                        />
                      </View>
                    </PressableScale>
                  );
                })
              )}

              {/* Tanggal & jam terakhir data kuartal ini diubah */}
              {data.updatedAt && (
                <VixText heading="label" additionalStyle={styles.updatedLabel}>
                  🕒 Terakhir diubah:{' '}
                  {formatFullDateTime(data.updatedAt.toDate())}
                </VixText>
              )}

              {/* Skor per area */}
              <VixText heading="title" additionalStyle={styles.sectionTitle}>
                📋 Skor per Area
              </VixText>
              {/* Sebaran nada — sekaligus keterangan arti warnanya */}
              <View style={styles.legendRow}>
                <View style={[styles.legendPill, styles.pillOk]}>
                  <VixText heading="label" additionalStyle={styles.toneOk}>
                    {okCount} sehat
                  </VixText>
                </View>
                <View style={[styles.legendPill, styles.pillWarn]}>
                  <VixText heading="label" additionalStyle={styles.toneWarn}>
                    {warnCount} perlu naik
                  </VixText>
                </View>
                <View style={[styles.legendPill, styles.pillDanger]}>
                  <VixText heading="label" additionalStyle={styles.toneDanger}>
                    {dangerCount} darurat
                  </VixText>
                </View>
              </View>
              {WHEEL_AREAS.map((a) => {
                const score = data.scores[a.key] ?? 0;
                const note = data.notes[a.key];
                const tone = scoreTone(score);
                const isFocus = data.focus.some((f) => f.area === a.key);
                return (
                  // Tiap area bisa ditekan untuk lihat tips menaikkan skornya —
                  // dulu tips hanya bisa dibuka dari kartu area fokus.
                  <PressableScale
                    key={a.key}
                    style={styles.areaRow}
                    onPress={() => setTipArea(a.key)}>
                    <View style={styles.areaTop}>
                      <VixText
                        heading="bold"
                        additionalStyle={styles.areaLabel}
                        numberOfLines={1}>
                        {a.icon} {a.label}
                      </VixText>
                      {isFocus && (
                        <View style={styles.focusBadge}>
                          <VixText
                            heading="label"
                            additionalStyle={styles.focusBadgeText}>
                            🎯 fokus
                          </VixText>
                        </View>
                      )}
                      <View style={[styles.scorePill, tone.pill]}>
                        <VixText heading="bold" additionalStyle={tone.text}>
                          {score}
                        </VixText>
                        <VixText heading="label" additionalStyle={tone.text}>
                          /10
                        </VixText>
                      </View>
                    </View>
                    <ProgressBar
                      value={score}
                      total={10}
                      color={tone.color}
                      height={7}
                    />
                    {note ? (
                      <VixText heading="label" numberOfLines={2}>
                        {note}
                      </VixText>
                    ) : null}
                  </PressableScale>
                );
              })}

              <PressableScale
                style={styles.retakeButton}
                onPress={startAssess}
                disabled={busy}>
                <VixText heading="bold" additionalStyle={styles.retakeText}>
                  🔄 Ulangi Assessment
                </VixText>
              </PressableScale>
            </>
          )}
        </ScrollView>
      )}

      {/* Modal tips & ide menaikkan skor area fokus */}
      <CenterDialog visible={tipArea !== null} onClose={() => setTipArea(null)}>
        {tipMeta && tipArea ? (
          <>
            <VixText heading="subheader" additionalStyle={styles.tipDialogTitle}>
              {tipMeta.icon} {tipMeta.label}
            </VixText>
            <VixText heading="label" additionalStyle={styles.tipDialogSub}>
              💡 Ide & tips menaikkan skor
            </VixText>
            <ScrollView style={styles.tipDialogList}>
              {WHEEL_TIPS[tipArea].map((t) => (
                <View key={t} style={styles.tipRow}>
                  <VixText heading="paragraph" additionalStyle={styles.tipRowText}>
                    {t}
                  </VixText>
                </View>
              ))}
            </ScrollView>
            <PressableScale
              style={styles.tipCloseButton}
              onPress={() => setTipArea(null)}>
              <VixText heading="bold" additionalStyle={styles.tipCloseText}>
                Tutup
              </VixText>
            </PressableScale>
          </>
        ) : null}
      </CenterDialog>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.BACKGROUND },
  quarterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 2,
  },
  quarterText: { minWidth: 80, textAlign: 'center' },
  content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 40 },
  // Wizard
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: Color.CONTRAST_CONTAINER,
    overflow: 'hidden',
    marginTop: 6,
    marginBottom: 20,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: Color.MAIN,
  },
  assessIcon: { fontSize: 44, lineHeight: 54, textAlign: 'center' },
  assessTitle: { textAlign: 'center', marginTop: 4 },
  assessQuestion: { textAlign: 'center', marginTop: 6 },
  scoreWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  scoreChip: {
    width: '17.5%',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Color.BORDER,
    backgroundColor: Color.CONTAINER,
    alignItems: 'center',
  },
  scoreActive: { backgroundColor: Color.MAIN, borderColor: Color.MAIN },
  scoreTextActive: { color: Color.TEXT_REVERSE },
  noteInput: { marginTop: 12, minHeight: 80, textAlignVertical: 'top' },
  navRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  backButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Color.BORDER,
    backgroundColor: Color.CONTAINER,
  },
  nextButton: { flex: 1 },
  // Fokus
  focusHint: { marginTop: 4, marginBottom: 10 },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  focusCard: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Color.BORDER,
    padding: 14,
    marginBottom: 10,
    gap: 6,
  },
  focusCardTitle: { color: Color.TEXT_TITLE },
  focusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  // Emoji area dalam kotak merah muda — warna fitur Wheel, jadi kartu fokus
  // langsung terbaca "ini punya Wheel of Life".
  focusEmojiBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Color.WHEEL,
    alignItems: 'center',
    justifyContent: 'center',
  },
  focusEmoji: { fontSize: 22, lineHeight: 28 },
  focusHeadMain: { flex: 1, gap: 1 },
  // Pil sisa poin di kanan: "+2" (masih dikejar) atau "✓ tercapai".
  deltaPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pillGap: { backgroundColor: Color.WHEEL },
  deltaText: { color: Color.WHEEL_DARK },
  // Action plan — dikutip dengan garis aksen kiri biar beda dari teks biasa.
  planBox: {
    backgroundColor: Color.BACKGROUND,
    borderRadius: 12,
    borderLeftWidth: 3,
    borderLeftColor: Color.MAIN,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  planText: { color: Color.TEXT_PARAGRAPH },
  tipsHintRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 2 },
  tipsHint: { color: Color.MAIN },
  // Modal tips menaikkan skor
  tipDialogTitle: { textAlign: 'center', marginBottom: 2 },
  tipDialogSub: {
    textAlign: 'center',
    color: Color.TEXT_LABEL,
    marginBottom: 12,
  },
  tipDialogList: { maxHeight: 320 },
  tipRow: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Color.BORDER,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  tipRowText: { color: Color.TEXT_PARAGRAPH },
  tipCloseButton: {
    marginTop: 4,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Color.MAIN,
  },
  tipCloseText: { color: Color.TEXT_REVERSE },
  // Overview
  introCard: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Color.BORDER,
    padding: 24,
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  introEmoji: { fontSize: 52, lineHeight: 64 },
  introTitle: { textAlign: 'center' },
  introText: { textAlign: 'center' },
  introButton: { alignSelf: 'stretch', marginTop: 8 },
  chartCard: {
    alignItems: 'center',
    backgroundColor: Color.CONTAINER,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Color.BORDER,
    paddingVertical: 16,
    gap: 4,
    marginBottom: 14,
  },
  avgValue: { color: Color.TEXT_TITLE },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  sectionHeadMain: { flex: 1, gap: 1 },
  // "Ubah / Pilih" jadi pil bergaris — lebih kelihatan bisa ditekan
  // daripada teks polos.
  editButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Color.MAIN,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  editText: { color: Color.MAIN },
  emptyFocus: { marginBottom: 10 },
  updatedLabel: { color: Color.TEXT_LABEL, marginTop: 2, marginBottom: 4 },
  sectionTitle: { marginTop: 10, marginBottom: 10 },
  // Sebaran nada skor di atas daftar area.
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  legendPill: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  areaRow: {
    gap: 8,
    backgroundColor: Color.CONTAINER,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Color.BORDER,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
  },
  areaTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  areaLabel: { color: Color.TEXT_TITLE, flexShrink: 1 },
  // Penanda area yang sedang jadi fokus kuartal ini.
  focusBadge: {
    borderRadius: 999,
    backgroundColor: Color.WHEEL,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  focusBadgeText: { color: Color.WHEEL_DARK },
  // Angka skor + "/10" dalam pil berwarna nada — didorong ke kanan.
  scorePill: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 1,
    marginLeft: 'auto',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pillOk: { backgroundColor: Color.MAIN_TRANSPARENT },
  pillWarn: { backgroundColor: Color.WARNING_TRANSPARENT },
  pillDanger: { backgroundColor: Color.DANGER_TRANSPARENT },
  toneOk: { color: Color.SUCCESS },
  toneWarn: { color: Color.WARNING },
  toneDanger: { color: Color.DANGER },
  retakeButton: {
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Color.BORDER,
    backgroundColor: Color.CONTAINER,
    marginTop: 12,
  },
  retakeText: { color: Color.MAIN },
});
