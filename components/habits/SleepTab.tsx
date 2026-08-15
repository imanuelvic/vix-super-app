import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { DualButtons } from '@/components/common/DualButtons';
import { FormInput } from '@/components/common/FormInput';
import { InlineDelete } from '@/components/common/InlineDelete';
import { PressableScale } from '@/components/common/PressableScale';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { SheetModal } from '@/components/common/SheetModal';
import { TimeField } from '@/components/common/TimeField';
import { VixText } from '@/components/common/VixText';
import { useAuth } from '@/contexts/auth';
import { dayIdToDate, formatFullDate } from '@/lib/format';
import { DELETE_ERROR, SAVE_ERROR } from '@/lib/messages';
import {
  dateAtMinutes,
  deleteSleepNight,
  formatClock,
  formatDuration,
  minutesOfDay,
  saveSleepNight,
  sleepAverage,
  sleepGoodNights,
  sleepMinutes,
  SLEEP_MAX_HOURS,
  SLEEP_MIN_HOURS,
  SLEEP_TONE_LABEL,
  sleepTone,
  type SleepNight,
} from '@/lib/sleep';

// Jam awal saat pertama kali mencatat: tidur 23.00, bangun 06.00 (7 jam).
const DEFAULT_BED = 23 * 60;
const DEFAULT_WAKE = 6 * 60;

// Sub-tab Sleep 😴 — target 6–8 jam. Catat jam tidur & jam bangun, lamanya
// dihitung otomatis (termasuk yang melewati tengah malam).
export function SleepTab({
  nights,
  dayId,
}: {
  nights: SleepNight[];
  dayId: string; // hari ini (tanggal bangun)
}) {
  const { user } = useAuth();

  const [editing, setEditing] = useState<SleepNight | 'new' | null>(null);
  const [fBed, setFBed] = useState(() => dateAtMinutes(DEFAULT_BED));
  const [fWake, setFWake] = useState(() => dateAtMinutes(DEFAULT_WAKE));
  const [fNote, setFNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = nights.find((n) => n.id === dayId) ?? null;
  const avg7 = sleepAverage(nights, 7);
  const good7 = sleepGoodNights(nights, 7);
  const draftMinutes = sleepMinutes(minutesOfDay(fBed), minutesOfDay(fWake));

  function openEdit(night: SleepNight | null) {
    setEditing(night ?? 'new');
    setFBed(dateAtMinutes(night?.bedMinutes ?? DEFAULT_BED));
    setFWake(dateAtMinutes(night?.wakeMinutes ?? DEFAULT_WAKE));
    setFNote(night?.note ?? '');
    setError(null);
  }

  async function handleSave() {
    if (!user || !editing || busy) return;
    setBusy(true);
    setError(null);
    try {
      await saveSleepNight(user.uid, editing === 'new' ? dayId : editing.id, {
        bedMinutes: minutesOfDay(fBed),
        wakeMinutes: minutesOfDay(fWake),
        note: fNote.trim(),
      });
      setEditing(null);
    } catch {
      setError(SAVE_ERROR);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!user || !editing || editing === 'new' || busy) return;
    setBusy(true);
    try {
      await deleteSleepNight(user.uid, editing.id);
      setEditing(null);
    } catch {
      setError(DELETE_ERROR);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* ===== Tidur tadi malam ===== */}
        <PressableScale style={styles.hero} onPress={() => openEdit(today)}>
          <VixText heading="label" additionalStyle={styles.heroLabel}>
            🌙 Tidur tadi malam
          </VixText>
          <VixText heading="header" additionalStyle={styles.heroValue}>
            {today ? formatDuration(today.minutes) : '—'}
          </VixText>
          {today ? (
            <VixText heading="label" additionalStyle={styles.heroSub}>
              {formatClock(today.bedMinutes)} → {formatClock(today.wakeMinutes)}{' '}
              · {SLEEP_TONE_LABEL[sleepTone(today.minutes)]}
            </VixText>
          ) : (
            <VixText heading="label" additionalStyle={styles.heroSub}>
              Belum dicatat — ketuk untuk isi jam tidur & bangun
            </VixText>
          )}
        </PressableScale>

        {/* ===== Ringkasan seminggu ===== */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <VixText heading="subheader" additionalStyle={styles.statValue}>
              {avg7 > 0 ? formatDuration(avg7) : '—'}
            </VixText>
            <VixText heading="label" additionalStyle={styles.statLabel}>
              Rata-rata 7 malam
            </VixText>
          </View>
          <View style={styles.statCard}>
            <VixText heading="subheader" additionalStyle={styles.statValue}>
              {good7}/7
            </VixText>
            <VixText heading="label" additionalStyle={styles.statLabel}>
              Malam pas {SLEEP_MIN_HOURS}–{SLEEP_MAX_HOURS} jam
            </VixText>
          </View>
        </View>

        <PrimaryButton
          label={today ? 'Ubah Catatan Tidur' : 'Catat Tidur Semalam'}
          icon="plus"
          onPress={() => openEdit(today)}
          additionalStyle={styles.addButton}
        />

        {/* ===== Riwayat ===== */}
        {nights.length === 0 ? (
          <VixText heading="label" additionalStyle={styles.empty}>
            Belum ada catatan tidur. Mulai dari semalam 😴
          </VixText>
        ) : (
          nights.map((n) => {
            const tone = sleepTone(n.minutes);
            return (
              <PressableScale
                key={n.id}
                style={styles.row}
                onPress={() => openEdit(n)}>
                <View style={styles.rowMain}>
                  <VixText heading="bold" additionalStyle={styles.rowTitle}>
                    {formatFullDate(dayIdToDate(n.id))}
                  </VixText>
                  <VixText heading="label">
                    {formatClock(n.bedMinutes)} → {formatClock(n.wakeMinutes)}
                    {n.note ? ` · ${n.note}` : ''}
                  </VixText>
                </View>
                <View
                  style={[
                    styles.durationPill,
                    tone === 'pas' ? styles.pillOk : styles.pillOff,
                  ]}>
                  <VixText heading="bold" additionalStyle={styles.durationText}>
                    {formatDuration(n.minutes)}
                  </VixText>
                </View>
              </PressableScale>
            );
          })
        )}

        <VixText heading="label" additionalStyle={styles.footNote}>
          ℹ️ Kurang dari {SLEEP_MIN_HOURS} jam bikin lapar palsu & gampang ngemil
          manis — nyambung langsung ke sub-tab Diet 🥗
        </VixText>
      </ScrollView>

      {/* ===== Sheet catat tidur ===== */}
      <SheetModal
        visible={!!editing}
        title={editing === 'new' ? 'Catat Tidur' : 'Ubah Catatan Tidur'}
        subtitle={
          editing && editing !== 'new'
            ? formatFullDate(dayIdToDate(editing.id))
            : formatFullDate(dayIdToDate(dayId))
        }
        onClose={() => setEditing(null)}>
        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          🛏️ Jam tidur
        </VixText>
        <TimeField value={fBed} onChange={setFBed} />

        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          ☀️ Jam bangun
        </VixText>
        <TimeField value={fWake} onChange={setFWake} />

        <View style={styles.draftBox}>
          <VixText heading="bold" additionalStyle={styles.draftValue}>
            {formatDuration(draftMinutes)}
          </VixText>
          <VixText heading="label" additionalStyle={styles.draftLabel}>
            {SLEEP_TONE_LABEL[sleepTone(draftMinutes)]}
          </VixText>
        </View>

        <FormInput
          style={styles.noteInput}
          placeholder="Catatan (opsional) — mis. begadang kerjaan"
          value={fNote}
          onChangeText={setFNote}
          editable={!busy}
        />

        {error && (
          <VixText heading="label" additionalStyle={styles.error}>
            {error}
          </VixText>
        )}

        {editing && editing !== 'new' && (
          <InlineDelete
            key={editing.id}
            label="Hapus catatan ini"
            busy={busy}
            onDelete={handleDelete}
          />
        )}

        <DualButtons
          confirmLabel="Simpan"
          busy={busy}
          onCancel={() => setEditing(null)}
          onConfirm={handleSave}
        />
      </SheetModal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 28 },
  hero: {
    backgroundColor: Color.MAIN_DARK,
    borderRadius: 20,
    padding: 18,
    gap: 2,
    marginBottom: 12,
  },
  heroLabel: { color: Color.TEXT_ON_DARK_MUTED },
  heroValue: { color: Color.TEXT_REVERSE },
  heroSub: { color: Color.MAIN_LIGHT },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  statCard: {
    flex: 1,
    backgroundColor: Color.CONTAINER,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Color.BORDER,
    padding: 14,
    gap: 2,
  },
  statValue: { color: Color.TEXT_TITLE },
  statLabel: { color: Color.TEXT_LABEL },
  addButton: { marginBottom: 14 },
  empty: { textAlign: 'center', marginVertical: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Color.CONTAINER,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Color.BORDER,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
  },
  rowMain: { flex: 1, gap: 2 },
  rowTitle: { color: Color.TEXT_TITLE },
  durationPill: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 },
  pillOk: { backgroundColor: Color.MAIN_LIGHT },
  pillOff: { backgroundColor: Color.CONTRAST_CONTAINER },
  durationText: { color: Color.MAIN_DARK },
  footNote: { color: Color.TEXT_LABEL, marginTop: 6, textAlign: 'center' },
  fieldLabel: { marginTop: 12, marginBottom: 6 },
  draftBox: {
    alignItems: 'center',
    backgroundColor: Color.MAIN_TRANSPARENT,
    borderRadius: 14,
    paddingVertical: 12,
    marginTop: 14,
    gap: 1,
  },
  draftValue: { color: Color.MAIN_DARK, fontSize: 22, lineHeight: 28 },
  draftLabel: { color: Color.MAIN_DARK },
  noteInput: { marginTop: 12 },
  error: { color: Color.DANGER, marginTop: 8 },
});
