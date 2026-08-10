import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { Chip } from '@/components/common/Chip';
import { FormInput } from '@/components/common/FormInput';
import { InlineDelete } from '@/components/common/InlineDelete';
import { LoadingCenter } from '@/components/common/LoadingCenter';
import { PressableScale } from '@/components/common/PressableScale';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { SheetModal } from '@/components/common/SheetModal';
import { VixText } from '@/components/common/VixText';
import { useAuth } from '@/contexts/auth';
import { DELETE_ERROR, LOAD_ERROR, SAVE_ERROR } from '@/lib/messages';
import {
  applyWinner,
  createTournament,
  deleteTournament,
  hasStarted,
  reshuffle,
  roundLabel,
  roundsOf,
  saveTournament,
  subscribeTournaments,
  type BracketSize,
  type Match,
  type Tournament,
} from '@/lib/tournament';

const SIZES: BracketSize[] = [4, 8, 16];

export default function TournamentScreen() {
  const { user } = useAuth();

  const [list, setList] = useState<Tournament[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Form buat turnamen.
  const [createOpen, setCreateOpen] = useState(false);
  const [cName, setCName] = useState('');
  const [cSize, setCSize] = useState<BracketSize>(8);
  const [cNames, setCNames] = useState<string[]>(() => Array(8).fill(''));
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    return subscribeTournaments(
      user.uid,
      (l) => {
        setList(l);
        setError(null);
      },
      () => setError(LOAD_ERROR),
    );
  }, [user]);

  const selected = selectedId
    ? (list?.find((t) => t.id === selectedId) ?? null)
    : null;

  function openCreate() {
    setCName('');
    setCSize(8);
    setCNames(Array(8).fill(''));
    setFormError(null);
    setCreateOpen(true);
  }

  function changeSize(size: BracketSize) {
    setCSize(size);
    setCNames((prev) => {
      const a = prev.slice(0, size);
      while (a.length < size) a.push('');
      return a;
    });
  }

  function setName(i: number, v: string) {
    setCNames((prev) => prev.map((n, idx) => (idx === i ? v : n)));
  }

  async function handleCreate() {
    if (!user || busy) return;
    if (!cName.trim()) {
      setFormError('Nama turnamen wajib diisi.');
      return;
    }
    const names = cNames.map((n) => n.trim());
    if (names.some((n) => !n)) {
      setFormError(`Semua ${cSize} nama peserta wajib diisi.`);
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      const t = createTournament(user.uid, cName.trim(), cSize, names);
      await saveTournament(user.uid, t);
      setCreateOpen(false);
      setSelectedId(t.id);
    } catch {
      setFormError(SAVE_ERROR);
    } finally {
      setBusy(false);
    }
  }

  // Pilih pemenang satu laga → otomatis maju ke babak berikutnya.
  function pick(m: Match, side: 'a' | 'b') {
    if (!user || !selected) return;
    if ((side === 'a' ? m.a : m.b) == null) return;
    saveTournament(user.uid, applyWinner(selected, m.round, m.slot, side)).catch(
      () => setError(SAVE_ERROR),
    );
  }

  function handleReshuffle() {
    if (!user || !selected) return;
    saveTournament(user.uid, reshuffle(selected)).catch(() =>
      setError(SAVE_ERROR),
    );
  }

  async function handleDelete() {
    if (!user || !selected) return;
    setBusy(true);
    try {
      await deleteTournament(user.uid, selected.id);
      setSelectedId(null);
    } catch {
      setError(DELETE_ERROR);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {error && (
        <VixText heading="label" additionalStyle={styles.error}>
          {error}
        </VixText>
      )}

      {list === null ? (
        <LoadingCenter />
      ) : selected ? (
        // ===== Detail bracket =====
        <ScrollView contentContainerStyle={styles.content}>
          <PressableScale style={styles.back} onPress={() => setSelectedId(null)}>
            <VixText heading="bold" additionalStyle={styles.backText}>
              ‹ Daftar turnamen
            </VixText>
          </PressableScale>

          <VixText heading="header" additionalStyle={styles.title}>
            {selected.name}
          </VixText>
          <VixText heading="label" additionalStyle={styles.subtitle}>
            🏸 {selected.size} Besar · sistem gugur
          </VixText>

          {selected.champion && (
            <View style={styles.championCard}>
              <VixText heading="label" additionalStyle={styles.championLabel}>
                🏆 JUARA
              </VixText>
              <VixText heading="header" additionalStyle={styles.championName}>
                {selected.champion}
              </VixText>
            </View>
          )}

          {!hasStarted(selected) && (
            <PressableScale style={styles.reshuffle} onPress={handleReshuffle}>
              <VixText heading="bold" additionalStyle={styles.reshuffleText}>
                🎲 Acak ulang undian
              </VixText>
            </PressableScale>
          )}

          {roundsOf(selected).map((round, r) => (
            <View key={r} style={styles.roundBlock}>
              <VixText heading="title" additionalStyle={styles.roundTitle}>
                {roundLabel(round.length)}
              </VixText>
              {round.map((m) => (
                <MatchCard
                  key={`${m.round}-${m.slot}`}
                  match={m}
                  onPick={(side) => pick(m, side)}
                />
              ))}
            </View>
          ))}

          <InlineDelete
            key={selected.id}
            label="Hapus turnamen ini"
            busy={busy}
            onDelete={handleDelete}
          />
        </ScrollView>
      ) : (
        // ===== Daftar turnamen =====
        <ScrollView contentContainerStyle={styles.content}>
          <VixText heading="header" additionalStyle={styles.title}>
            Tournament 🏆
          </VixText>
          <VixText heading="label" additionalStyle={styles.subtitle}>
            Bikin turnamen badminton sistem gugur — isi nama, pilih 4/8/16 besar,
            lalu tentukan pemenang tiap laga.
          </VixText>

          <PrimaryButton
            label="Buat Turnamen"
            icon="plus"
            onPress={openCreate}
            additionalStyle={styles.addBtn}
          />

          {list.length === 0 ? (
            <View style={styles.emptyCard}>
              <VixText additionalStyle={styles.emptyEmoji}>🏸</VixText>
              <VixText heading="title" additionalStyle={styles.emptyTitle}>
                Belum ada turnamen
              </VixText>
              <VixText heading="label" additionalStyle={styles.emptyText}>
                Ketuk “Buat Turnamen” untuk mulai. Peserta akan diundi acak, lalu
                pemenang tiap laga otomatis maju ke babak berikutnya.
              </VixText>
            </View>
          ) : (
            list.map((t) => (
              <TournamentCard
                key={t.id}
                t={t}
                onOpen={() => setSelectedId(t.id)}
              />
            ))
          )}
        </ScrollView>
      )}

      {/* ===== Modal buat turnamen ===== */}
      <SheetModal
        visible={createOpen}
        title="Buat Turnamen"
        onClose={() => setCreateOpen(false)}>
        <FormInput
          style={styles.formGap}
          placeholder="Nama turnamen"
          value={cName}
          onChangeText={setCName}
          editable={!busy}
        />

        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          Jumlah peserta
        </VixText>
        <View style={styles.sizeRow}>
          {SIZES.map((s) => (
            <Chip
              key={s}
              label={`${s} Besar`}
              active={cSize === s}
              onPress={() => changeSize(s)}
              additionalStyle={styles.sizeChip}
            />
          ))}
        </View>

        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          Nama peserta ({cSize})
        </VixText>
        {cNames.map((n, i) => (
          <FormInput
            key={i}
            style={styles.formGap}
            placeholder={`Peserta ${i + 1}`}
            value={n}
            onChangeText={(v) => setName(i, v)}
            editable={!busy}
          />
        ))}

        {formError && (
          <VixText heading="label" additionalStyle={styles.formError}>
            {formError}
          </VixText>
        )}
        <PrimaryButton
          label="🎲 Acak & Mulai"
          onPress={handleCreate}
          busy={busy}
          additionalStyle={styles.createBtn}
        />
        <VixText heading="label" additionalStyle={styles.hint}>
          Undian babak pertama diacak otomatis. Kamu masih bisa “acak ulang”
          sebelum laga pertama diputuskan.
        </VixText>
      </SheetModal>
    </SafeAreaView>
  );
}

// ============ Kartu turnamen di daftar (module-scope) ============
function TournamentCard({ t, onOpen }: { t: Tournament; onOpen: () => void }) {
  const status = t.champion
    ? `🏆 Juara: ${t.champion}`
    : hasStarted(t)
      ? '⏳ Sedang berlangsung'
      : '🎲 Siap diundi';
  return (
    <PressableScale style={styles.tCard} onPress={onOpen}>
      <View style={styles.tCardTop}>
        <VixText heading="subheader" additionalStyle={styles.tName}>
          {t.name}
        </VixText>
        <View style={styles.tSizeBadge}>
          <VixText heading="label" additionalStyle={styles.tSizeText}>
            {t.size} Besar
          </VixText>
        </View>
      </View>
      <VixText heading="label" additionalStyle={styles.tStatus}>
        {status}
      </VixText>
    </PressableScale>
  );
}

// ============ Satu laga (dua sisi yang bisa dipilih) ============
function MatchCard({
  match,
  onPick,
}: {
  match: Match;
  onPick: (side: 'a' | 'b') => void;
}) {
  return (
    <View style={styles.matchCard}>
      <MatchSide match={match} side="a" onPick={onPick} />
      <VixText heading="label" additionalStyle={styles.vsText}>
        vs
      </VixText>
      <MatchSide match={match} side="b" onPick={onPick} />
    </View>
  );
}

function MatchSide({
  match,
  side,
  onPick,
}: {
  match: Match;
  side: 'a' | 'b';
  onPick: (side: 'a' | 'b') => void;
}) {
  const name = side === 'a' ? match.a : match.b;
  const isWinner = match.winner === side;
  const decided = match.winner !== null;
  const empty = name == null;
  return (
    <PressableScale
      style={[
        styles.sideRow,
        isWinner && styles.sideWinner,
        decided && !isWinner && styles.sideLoser,
      ]}
      disabled={empty}
      onPress={() => onPick(side)}>
      <VixText
        heading="paragraph"
        numberOfLines={1}
        additionalStyle={[
          styles.sideName,
          empty && styles.sideEmpty,
          isWinner && styles.sideNameWinner,
        ]}>
        {name ?? 'Menunggu pemenang…'}
      </VixText>
      {isWinner && (
        <VixText heading="bold" additionalStyle={styles.check}>
          ✓
        </VixText>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.BACKGROUND },
  error: { color: Color.DANGER, paddingHorizontal: 20, marginBottom: 6 },
  content: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40 },
  title: { color: Color.MAIN, marginBottom: 4 },
  subtitle: { color: Color.TEXT_LABEL, marginBottom: 14 },
  addBtn: { marginBottom: 16 },
  back: { alignSelf: 'flex-start', marginBottom: 8 },
  backText: { color: Color.MAIN },
  // Daftar turnamen
  emptyCard: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Color.BORDER,
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  emptyEmoji: { fontSize: 52, lineHeight: 64 },
  emptyTitle: { textAlign: 'center' },
  emptyText: { textAlign: 'center', color: Color.TEXT_LABEL },
  tCard: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Color.BORDER,
    padding: 16,
    gap: 6,
    marginBottom: 12,
  },
  tCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  tName: { color: Color.TEXT_TITLE, flexShrink: 1 },
  tSizeBadge: {
    backgroundColor: Color.CONTRAST_CONTAINER,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  tSizeText: { color: Color.ACCENT_DARK },
  tStatus: { color: Color.TEXT_LABEL },
  // Detail bracket
  championCard: {
    backgroundColor: Color.MAIN_DARK,
    borderRadius: 18,
    padding: 18,
    alignItems: 'center',
    gap: 2,
    marginBottom: 14,
  },
  championLabel: { color: Color.TEXT_ON_DARK_MUTED },
  championName: { color: Color.TEXT_REVERSE, textAlign: 'center' },
  reshuffle: {
    alignSelf: 'flex-start',
    backgroundColor: Color.CONTRAST_CONTAINER,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 14,
  },
  reshuffleText: { color: Color.ACCENT_DARK },
  roundBlock: { marginBottom: 18 },
  roundTitle: { color: Color.MAIN_DARK, marginBottom: 10 },
  matchCard: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Color.BORDER,
    padding: 8,
    gap: 4,
    marginBottom: 10,
  },
  vsText: { color: Color.TEXT_PLACEHOLDER, textAlign: 'center' },
  sideRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    backgroundColor: Color.BACKGROUND,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Color.BORDER,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  sideWinner: {
    backgroundColor: Color.MAIN_TRANSPARENT,
    borderColor: Color.MAIN,
  },
  sideLoser: { opacity: 0.45 },
  sideName: { color: Color.TEXT_TITLE, flexShrink: 1 },
  sideNameWinner: { color: Color.MAIN_DARK },
  sideEmpty: { color: Color.TEXT_PLACEHOLDER },
  check: { color: Color.MAIN_DARK },
  // Form
  formGap: { marginBottom: 10 },
  fieldLabel: { marginBottom: 6 },
  sizeRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  sizeChip: { flex: 1 },
  formError: { color: Color.DANGER, marginBottom: 8 },
  createBtn: { marginTop: 4 },
  hint: { color: Color.TEXT_LABEL, marginTop: 10, textAlign: 'center' },
});
