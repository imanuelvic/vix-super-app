import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { Chip } from '@/components/common/Chip';
import { FormInput } from '@/components/common/FormInput';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { VixText } from '@/components/common/VixText';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { RadarChart } from '@/components/wheel/RadarChart';
import { useAuth } from '@/contexts/auth';
import { formatDecimal } from '@/lib/format';
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
  type WheelAreaKey,
  type WheelData,
  type WheelFocus,
} from '@/lib/wheel';

type Mode = 'overview' | 'assess' | 'focus';

/** Warna skor: ≥8 sehat, 5–7 perlu perhatian, <5 darurat. */
function scoreTone(score: number) {
  if (score >= 8) return styles.toneOk;
  if (score >= 5) return styles.toneWarn;
  return styles.toneDanger;
}

// Wheel of Life 🎡 — nilai 8 area hidup per quartal, lihat bentuk "roda"-mu
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
      () => setError('Gagal memuat data. Cek koneksi internet.'),
    );
    return unsubscribe;
  }, [user, qid]);

  function shift(delta: number) {
    const next = shiftQuarter(year, q, delta);
    setYear(next.year);
    setQ(next.q);
    setMode('overview'); // ganti quartal = kembali ke ringkasan
  }

  const hasScores =
    data !== null && WHEEL_AREAS.every((a) => (data.scores[a.key] ?? 0) > 0);
  const values = WHEEL_AREAS.map((a) => data?.scores[a.key] ?? 0);
  const avg = values.reduce((s, v) => s + v, 0) / WHEEL_AREAS.length;

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
      setAssessError('Gagal menyimpan. Cek koneksi internet.');
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
      setFocusError('Gagal menyimpan. Cek koneksi internet.');
    } finally {
      setBusy(false);
    }
  }

  // ============================ RENDER ============================

  const area = WHEEL_AREAS[idx];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader backLabel="Home" title="Wheel of Life 🎡">
        {mode === 'overview' && (
          <View style={styles.quarterRow}>
            <Pressable onPress={() => shift(-1)} hitSlop={10}>
              <IconSymbol name="chevron.left" size={20} color={Color.MAIN} />
            </Pressable>
            <VixText heading="bold" additionalStyle={styles.quarterText}>
              {quarterLabel(year, q)}
            </VixText>
            <Pressable onPress={() => shift(1)} hitSlop={10}>
              <IconSymbol name="chevron.right" size={20} color={Color.MAIN} />
            </Pressable>
          </View>
        )}
      </ScreenHeader>

      {error && (
        <VixText heading="label" additionalStyle={styles.error}>
          {error}
        </VixText>
      )}

      {data === null ? (
        <View style={styles.center}>
          <ActivityIndicator color={Color.MAIN} />
        </View>
      ) : mode === 'assess' ? (
        /* ===== Wizard assessment: 1 pertanyaan per layar ===== */
        <ScrollView contentContainerStyle={styles.content}>
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
          <VixText heading="label" additionalStyle={styles.assessHint}>
            Menurutmu, berapa nilaimu di area ini?
          </VixText>

          {/* Pilihan nilai 1–10 */}
          <View style={styles.scoreWrap}>
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
              const active = draftScores[area.key] === n;
              return (
                <Pressable
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
                </Pressable>
              );
            })}
          </View>

          <FormInput
            style={styles.noteInput}
            placeholder="Jelaskan alasan penilaianmu (opsional)…"
            value={draftNotes[area.key] ?? ''}
            onChangeText={(t) =>
              setDraftNotes((prev) => ({ ...prev, [area.key]: t }))
            }
            multiline
            editable={!busy}
          />

          {assessError && (
            <VixText heading="label" additionalStyle={styles.error}>
              {assessError}
            </VixText>
          )}

          <View style={styles.navRow}>
            <Pressable
              style={styles.backButton}
              onPress={() => (idx > 0 ? setIdx(idx - 1) : setMode('overview'))}
              disabled={busy}>
              <VixText heading="bold">{idx > 0 ? 'Kembali' : 'Batal'}</VixText>
            </Pressable>
            <PrimaryButton
              label={idx === WHEEL_AREAS.length - 1 ? 'Selesai ✅' : 'Lanjut'}
              busy={busy}
              onPress={nextAssess}
              additionalStyle={styles.nextButton}
            />
          </View>
        </ScrollView>
      ) : mode === 'focus' ? (
        /* ===== Editor fokus quartal ===== */
        <ScrollView contentContainerStyle={styles.content}>
          <VixText heading="title">🎯 Fokus {quarterLabel(year, q)}</VixText>
          <VixText heading="label" additionalStyle={styles.focusHint}>
            Pilih minimal {MIN_FOCUS} area untuk dikembangkan quartal ini
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
                <VixText heading="label">Target skor quartal ini:</VixText>
                <View style={styles.scoreWrap}>
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
                    const active = targets[key] === n;
                    return (
                      <Pressable
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
                      </Pressable>
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

          {focusError && (
            <VixText heading="label" additionalStyle={styles.error}>
              {focusError}
            </VixText>
          )}
          <View style={styles.navRow}>
            <Pressable
              style={styles.backButton}
              onPress={() => setMode('overview')}
              disabled={busy}>
              <VixText heading="bold">Batal</VixText>
            </Pressable>
            <PrimaryButton
              label="Simpan Fokus"
              busy={busy}
              onPress={handleSaveFocus}
              additionalStyle={styles.nextButton}
            />
          </View>
        </ScrollView>
      ) : (
        /* ===== Overview ===== */
        <ScrollView contentContainerStyle={styles.content}>
          {!hasScores ? (
            <View style={styles.introCard}>
              <VixText additionalStyle={styles.introEmoji}>🎡</VixText>
              <VixText heading="title" additionalStyle={styles.introTitle}>
                Bagaimana bentuk hidupmu quartal ini?
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

              {/* Fokus quartal */}
              <View style={styles.sectionHeader}>
                <VixText heading="title">🎯 Fokus Quartal Ini</VixText>
                <Pressable onPress={startFocus} hitSlop={10}>
                  <VixText heading="bold" additionalStyle={styles.editText}>
                    {data.focus.length > 0 ? 'Ubah' : 'Pilih'}
                  </VixText>
                </Pressable>
              </View>
              {data.focus.length === 0 ? (
                <VixText heading="label" additionalStyle={styles.emptyFocus}>
                  Belum ada area fokus — pilih minimal {MIN_FOCUS} untuk quartal
                  ini.
                </VixText>
              ) : (
                data.focus.map((f) => {
                  const meta = WHEEL_AREAS.find((a) => a.key === f.area)!;
                  const current = data.scores[f.area] ?? 0;
                  return (
                    <View key={f.area} style={styles.focusCard}>
                      <View style={styles.focusRow}>
                        <VixText
                          heading="bold"
                          additionalStyle={styles.focusCardTitle}>
                          {meta.icon} {meta.label}
                        </VixText>
                        <VixText heading="bold" additionalStyle={scoreTone(current)}>
                          {current} → {f.targetScore}
                        </VixText>
                      </View>
                      {f.plan ? (
                        <VixText heading="paragraph" additionalStyle={styles.planText}>
                          {f.plan}
                        </VixText>
                      ) : null}
                    </View>
                  );
                })
              )}

              {/* Skor per area */}
              <VixText heading="title" additionalStyle={styles.sectionTitle}>
                📋 Skor per Area
              </VixText>
              {WHEEL_AREAS.map((a) => {
                const score = data.scores[a.key] ?? 0;
                const note = data.notes[a.key];
                return (
                  <View key={a.key} style={styles.areaRow}>
                    <View style={styles.areaLeft}>
                      <VixText heading="bold" additionalStyle={styles.areaLabel}>
                        {a.icon} {a.label}
                      </VixText>
                      {note ? (
                        <VixText heading="label" numberOfLines={2}>
                          {note}
                        </VixText>
                      ) : null}
                    </View>
                    <VixText heading="subheader" additionalStyle={scoreTone(score)}>
                      {score}
                    </VixText>
                  </View>
                );
              })}

              <Pressable onPress={startAssess} disabled={busy}>
                <VixText heading="bold" additionalStyle={styles.retakeText}>
                  🔄 Ulangi Assessment
                </VixText>
              </Pressable>
            </>
          )}
        </ScrollView>
      )}
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
  error: { color: Color.DANGER, paddingHorizontal: 20, marginBottom: 6 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
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
  assessHint: { textAlign: 'center', marginTop: 10, marginBottom: 10 },
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
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  planText: { color: Color.TEXT_PARAGRAPH },
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
    marginBottom: 10,
  },
  editText: { color: Color.MAIN },
  emptyFocus: { marginBottom: 10 },
  sectionTitle: { marginTop: 10, marginBottom: 10 },
  areaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    backgroundColor: Color.CONTAINER,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Color.BORDER,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 8,
  },
  areaLeft: { flex: 1, gap: 1 },
  areaLabel: { color: Color.TEXT_TITLE },
  toneOk: { color: Color.SUCCESS },
  toneWarn: { color: Color.WARNING },
  toneDanger: { color: Color.DANGER },
  retakeText: { color: Color.MAIN, textAlign: 'center', marginTop: 12 },
});
