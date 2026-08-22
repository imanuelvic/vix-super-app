import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Color } from '@/assets/style/color';
import { Chip } from '@/components/common/Chip';
import { DateField } from '@/components/common/DateField';
import { FormError } from '@/components/common/FormError';
import { FormInput } from '@/components/common/FormInput';
import { InlineDelete } from '@/components/common/InlineDelete';
import { LoadingCenter } from '@/components/common/LoadingCenter';
import { PressableScale } from '@/components/common/PressableScale';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { ScreenError } from '@/components/common/ScreenError';
import { SegmentTabs } from '@/components/common/SegmentTabs';
import { SheetModal } from '@/components/common/SheetModal';
import { VixText } from '@/components/common/VixText';
import { useAuth } from '@/contexts/auth';
import { formatFullDate, formatShortDayDate } from '@/lib/format';
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
  tournamentDate,
  withDetails,
  type BracketSize,
  type Match,
  type Tournament,
} from '@/lib/tournament';

const SIZES: BracketSize[] = [4, 8, 16];

/** Berapa laga sudah diputuskan dari total laga turnamen (size − 1). */
function progressOf(t: Tournament): { done: number; total: number } {
  return {
    done: t.matches.filter((m) => m.winner !== null).length,
    total: t.size - 1,
  };
}

// Sub-menu Tournament 🏆 — bracket sistem gugur bertema emas: kartu turnamen
// dengan bar kemajuan, babak dipilih lewat tab (bukan scroll panjang), dan
// kartu juara yang bikin puas saat selesai.
export function TournamentTab() {
  const { user } = useAuth();

  const [list, setList] = useState<Tournament[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Babak yang sedang dilihat di detail bracket (0 = babak pertama).
  const [round, setRound] = useState(0);

  // Form buat turnamen.
  const [createOpen, setCreateOpen] = useState(false);
  const [cName, setCName] = useState('');
  const [cDate, setCDate] = useState(() => new Date());
  const [cSize, setCSize] = useState<BracketSize>(8);
  const [cNames, setCNames] = useState<string[]>(() => Array(8).fill(''));
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form ubah keterangan turnamen yang sudah jalan (nama & tanggal saja).
  const [editOpen, setEditOpen] = useState(false);
  const [eName, setEName] = useState('');
  const [eDate, setEDate] = useState(() => new Date());
  const [editError, setEditError] = useState<string | null>(null);

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

  function openTournament(id: string) {
    setSelectedId(id);
    setRound(0);
  }

  function openCreate() {
    setCName('');
    setCDate(new Date());
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
      const t = createTournament(user.uid, cName.trim(), cSize, names, cDate);
      await saveTournament(user.uid, t);
      setCreateOpen(false);
      openTournament(t.id);
    } catch {
      setFormError(SAVE_ERROR);
    } finally {
      setBusy(false);
    }
  }

  function openEdit() {
    if (!selected) return;
    setEName(selected.name);
    setEDate(tournamentDate(selected));
    setEditError(null);
    setEditOpen(true);
  }

  /**
   * Simpan nama & tanggal yang dibetulkan. Bracket-nya tidak ikut berubah —
   * ini jalan satu-satunya membetulkan tanggal tanpa menghapus turnamennya
   * (dulu tanggal hanya bisa diisi sekali, saat turnamennya dibuat).
   */
  async function handleEdit() {
    if (!user || !selected || busy) return;
    if (!eName.trim()) {
      setEditError('Nama turnamen wajib diisi.');
      return;
    }
    setBusy(true);
    setEditError(null);
    try {
      await saveTournament(user.uid, withDetails(selected, eName.trim(), eDate));
      setEditOpen(false);
    } catch {
      setEditError(SAVE_ERROR);
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

  const rounds = selected ? roundsOf(selected) : [];
  const shownRound = rounds[Math.min(round, rounds.length - 1)] ?? [];

  return (
    <View style={styles.flex}>
      <ScreenError message={error} />

      {list === null ? (
        <LoadingCenter />
      ) : selected ? (
        // ============ Detail bracket ============
        <ScrollView contentContainerStyle={styles.content}>
          <PressableScale
            style={styles.back}
            onPress={() => setSelectedId(null)}>
            <VixText heading="bold" additionalStyle={styles.backText}>
              ‹ Semua turnamen
            </VixText>
          </PressableScale>

          {/* Hero emas: nama + kemajuan laga */}
          <Animated.View entering={FadeInDown.duration(280)} style={styles.hero}>
            <VixText heading="label" additionalStyle={styles.heroKicker}>
              🏸 {selected.size} BESAR · SISTEM GUGUR
            </VixText>
            <VixText heading="subheader" additionalStyle={styles.heroName}>
              {selected.name}
            </VixText>
            {/* Ketuk barisnya untuk membetulkan nama & tanggal. Dulu tanggal
                cuma bisa diisi sekali saat turnamen dibuat — kalau salah,
                satu-satunya jalan adalah menghapus turnamennya (dan bracket
                yang sudah jalan ikut hilang). */}
            <PressableScale style={styles.heroDateBtn} onPress={openEdit}>
              <VixText heading="label" additionalStyle={styles.heroDate}>
                📆 {formatFullDate(tournamentDate(selected))} ✏️
              </VixText>
            </PressableScale>
            <ProgressBar {...progressOf(selected)} />
          </Animated.View>

          {selected.champion && (
            <Animated.View
              entering={FadeInDown.delay(80).duration(320)}
              style={styles.championCard}>
              <VixText additionalStyle={styles.championEmoji}>🏆</VixText>
              <VixText heading="label" additionalStyle={styles.championLabel}>
                JUARA
              </VixText>
              <VixText heading="header" additionalStyle={styles.championName}>
                {selected.champion}
              </VixText>
              <VixText heading="label" additionalStyle={styles.championSub}>
                🎉 Turnamen selesai — selamat!
              </VixText>
            </Animated.View>
          )}

          {!hasStarted(selected) && (
            <PressableScale style={styles.reshuffle} onPress={handleReshuffle}>
              <VixText heading="bold" additionalStyle={styles.reshuffleText}>
                🎲 Acak ulang undian
              </VixText>
            </PressableScale>
          )}

          {/* Babak dipilih lewat tab — tidak perlu scroll panjang */}
          <SegmentTabs
            tabs={rounds.map((r, i) => ({
              key: String(i),
              label: roundLabel(r.length),
              sub: `${r.filter((m) => m.winner).length}/${r.length}`,
            }))}
            value={String(Math.min(round, rounds.length - 1))}
            onChange={(k) => setRound(Number(k))}
          />

          {shownRound.map((m, i) => (
            <MatchCard
              key={`${m.round}-${m.slot}`}
              index={i}
              match={m}
              onPick={(side) => pick(m, side)}
            />
          ))}

          <InlineDelete
            key={selected.id}
            label="Hapus turnamen ini"
            busy={busy}
            onDelete={handleDelete}
          />
        </ScrollView>
      ) : (
        // ============ Daftar turnamen ============
        <ScrollView contentContainerStyle={styles.content}>
          {/* Tiga angka ringkas — biar sekilas tahu keadaannya */}
          <View style={styles.statsRow}>
            <StatBox value={list.length} label="Turnamen" />
            <StatBox
              value={list.filter((t) => !t.champion && hasStarted(t)).length}
              label="Berjalan"
            />
            <StatBox
              value={list.filter((t) => t.champion).length}
              label="Selesai"
            />
          </View>

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
                Ketuk “Buat Turnamen” untuk mulai. Peserta diundi acak, lalu
                pemenang tiap laga otomatis maju ke babak berikutnya.
              </VixText>
            </View>
          ) : (
            list.map((t, i) => (
              <Animated.View
                key={t.id}
                entering={FadeInDown.delay(i * 50).duration(280)}>
                <TournamentCard t={t} onOpen={() => openTournament(t.id)} />
              </Animated.View>
            ))
          )}
        </ScrollView>
      )}

      {/* ============ Modal buat turnamen ============ */}
      <SheetModal
        visible={createOpen}
        title="Buat Turnamen"
        subtitle="Undian babak pertama diacak otomatis 🎲"
        onClose={() => setCreateOpen(false)}>
        <FormInput
          style={styles.formGap}
          placeholder="Nama turnamen"
          value={cName}
          onChangeText={setCName}
          editable={!busy}
        />

        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          📆 Tanggal turnamen
        </VixText>
        <View style={styles.formGap}>
          {/* key = sesi buka modal → picker kembali ke tanggal awal tiap kali
              form dibuka lagi, tidak menyimpan sisa pilihan sebelumnya. */}
          <DateField
            key={createOpen ? 'open' : 'closed'}
            value={cDate}
            onChange={setCDate}
          />
        </View>

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
          <View key={i} style={styles.seedRow}>
            <View style={styles.seedBadge}>
              <VixText heading="label" additionalStyle={styles.seedText}>
                {i + 1}
              </VixText>
            </View>
            <FormInput
              style={styles.seedInput}
              placeholder={`Peserta ${i + 1}`}
              value={n}
              onChangeText={(v) => setName(i, v)}
              editable={!busy}
            />
          </View>
        ))}

        <FormError message={formError} />
        <PrimaryButton
          label="🎲 Acak & Mulai"
          onPress={handleCreate}
          busy={busy}
          additionalStyle={styles.createBtn}
        />
        <VixText heading="label" additionalStyle={styles.hint}>
          Masih bisa “acak ulang” selama belum ada laga yang diputuskan.
        </VixText>
      </SheetModal>

      {/* ============ Modal ubah keterangan turnamen ============
          Sengaja hanya nama & tanggal: peserta dan hasil laganya tidak boleh
          bergeser diam-diam dari sini. */}
      <SheetModal
        visible={editOpen}
        title="Ubah Turnamen"
        subtitle="Bracket & hasil laganya tidak berubah 🏆"
        onClose={() => setEditOpen(false)}>
        <FormInput
          style={styles.formGap}
          placeholder="Nama turnamen"
          value={eName}
          onChangeText={setEName}
          editable={!busy}
        />

        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          📆 Tanggal turnamen
        </VixText>
        <View style={styles.formGap}>
          {/* key = sesi buka modal → picker selalu mulai dari tanggal yang
              tersimpan, bukan sisa pilihan sebelumnya. */}
          <DateField
            key={editOpen ? 'edit-open' : 'edit-closed'}
            value={eDate}
            onChange={setEDate}
          />
        </View>

        <FormError message={editError} />
        <PrimaryButton
          label="Simpan"
          onPress={handleEdit}
          busy={busy}
          additionalStyle={styles.createBtn}
        />
      </SheetModal>
    </View>
  );
}

// ============ Bar kemajuan laga (emas di atas latar gelap) ============
function ProgressBar({ done, total }: { done: number; total: number }) {
  const percent = total > 0 ? (done / total) * 100 : 0;
  return (
    <View style={styles.progressWrap}>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${percent}%` }]} />
      </View>
      <VixText heading="label" additionalStyle={styles.progressText}>
        {done}/{total} laga
      </VixText>
    </View>
  );
}

// ============ Angka ringkas di daftar ============
function StatBox({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.statBox}>
      <VixText heading="header" additionalStyle={styles.statValue}>
        {value}
      </VixText>
      <VixText heading="label" additionalStyle={styles.statLabel}>
        {label}
      </VixText>
    </View>
  );
}

// ============ Kartu turnamen di daftar ============
function TournamentCard({ t, onOpen }: { t: Tournament; onOpen: () => void }) {
  const { done, total } = progressOf(t);
  const percent = total > 0 ? (done / total) * 100 : 0;
  const status = t.champion
    ? `🏆 ${t.champion}`
    : hasStarted(t)
      ? '⏳ Sedang berlangsung'
      : '🎲 Siap diundi';
  return (
    <PressableScale
      style={[styles.tCard, t.champion && styles.tCardDone]}
      onPress={onOpen}>
      <View style={styles.tCardTop}>
        <VixText
          heading="subheader"
          numberOfLines={1}
          additionalStyle={styles.tName}>
          {t.name}
        </VixText>
        <View style={styles.tSizeBadge}>
          <VixText heading="label" additionalStyle={styles.tSizeText}>
            {t.size} Besar
          </VixText>
        </View>
      </View>
      <VixText heading="label" additionalStyle={styles.tDate}>
        📆 {formatShortDayDate(tournamentDate(t))}
      </VixText>
      <View style={styles.tBarTrack}>
        <View style={[styles.tBarFill, { width: `${percent}%` }]} />
      </View>
      <VixText heading="label" additionalStyle={styles.tStatus}>
        {status}
      </VixText>
    </PressableScale>
  );
}

// ============ Satu laga (dua sisi yang bisa dipilih) ============
function MatchCard({
  index,
  match,
  onPick,
}: {
  index: number;
  match: Match;
  onPick: (side: 'a' | 'b') => void;
}) {
  return (
    <View style={styles.matchCard}>
      <View style={styles.matchHead}>
        <VixText heading="label" additionalStyle={styles.matchLabel}>
          LAGA {index + 1}
        </VixText>
        {match.winner && (
          <VixText heading="label" additionalStyle={styles.matchDone}>
            ✓ selesai
          </VixText>
        )}
      </View>
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
          🏅
        </VixText>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 24 },
  back: { alignSelf: 'flex-start', marginBottom: 10 },
  backText: { color: Color.MAIN },
  // ===== Daftar turnamen =====
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  statBox: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: Color.TOURNAMENT,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Color.TOURNAMENT_DARK,
    paddingVertical: 12,
  },
  statValue: { color: Color.TOURNAMENT_DARK },
  statLabel: { color: Color.TOURNAMENT_DARK },
  addBtn: { marginBottom: 16 },
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
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: Color.BORDER,
    padding: 16,
    gap: 8,
    marginBottom: 12,
  },
  tCardDone: { borderColor: Color.TOURNAMENT_DARK },
  tCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  tName: { color: Color.TEXT_TITLE, flexShrink: 1 },
  tSizeBadge: {
    backgroundColor: Color.TOURNAMENT,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  tSizeText: { color: Color.TOURNAMENT_DARK },
  tBarTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: Color.CONTRAST_CONTAINER,
    overflow: 'hidden',
  },
  tBarFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: Color.TOURNAMENT_DARK,
  },
  tStatus: { color: Color.TEXT_LABEL },
  tDate: { color: Color.TEXT_LABEL },
  // ===== Detail bracket =====
  hero: {
    backgroundColor: Color.MAIN_DARK,
    borderRadius: 22,
    padding: 20,
    gap: 4,
    marginBottom: 12,
  },
  heroKicker: { color: Color.TOURNAMENT, letterSpacing: 1 },
  heroName: { color: Color.TEXT_REVERSE },
  heroDate: { color: Color.TEXT_ON_DARK_MUTED, marginTop: 2 },
  // Area ketuk sebesar tulisannya saja — tanpa padding, jadi tinggi hero tetap.
  heroDateBtn: { alignSelf: 'flex-start' },
  progressWrap: { gap: 4, marginTop: 8 },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: Color.MAIN,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: Color.TOURNAMENT,
  },
  progressText: { color: Color.TEXT_ON_DARK_MUTED },
  championCard: {
    backgroundColor: Color.TOURNAMENT,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: Color.TOURNAMENT_DARK,
    padding: 20,
    alignItems: 'center',
    gap: 2,
    marginBottom: 14,
  },
  championEmoji: { fontSize: 48, lineHeight: 58 },
  championLabel: { color: Color.TOURNAMENT_DARK, letterSpacing: 2 },
  championName: { color: Color.TEXT_TITLE, textAlign: 'center' },
  championSub: { color: Color.TOURNAMENT_DARK },
  reshuffle: {
    alignSelf: 'flex-start',
    backgroundColor: Color.TOURNAMENT,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 14,
  },
  reshuffleText: { color: Color.TOURNAMENT_DARK },
  matchCard: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Color.BORDER,
    padding: 10,
    gap: 4,
    marginBottom: 10,
  },
  matchHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
    marginBottom: 2,
  },
  matchLabel: { color: Color.TEXT_PLACEHOLDER, letterSpacing: 1 },
  matchDone: { color: Color.MAIN },
  vsText: { color: Color.TEXT_PLACEHOLDER, textAlign: 'center' },
  sideRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    backgroundColor: Color.BACKGROUND,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Color.BORDER,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  sideWinner: {
    backgroundColor: Color.TOURNAMENT,
    borderColor: Color.TOURNAMENT_DARK,
  },
  sideLoser: { opacity: 0.4 },
  sideName: { color: Color.TEXT_TITLE, flexShrink: 1 },
  sideNameWinner: { color: Color.TEXT_TITLE, fontWeight: '700' },
  sideEmpty: { color: Color.TEXT_PLACEHOLDER },
  check: { color: Color.TOURNAMENT_DARK },
  // ===== Form =====
  formGap: { marginBottom: 10 },
  fieldLabel: { marginBottom: 6 },
  sizeRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  sizeChip: { flex: 1 },
  seedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  seedBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Color.TOURNAMENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seedText: { color: Color.TOURNAMENT_DARK },
  seedInput: { flex: 1 },
  createBtn: { marginTop: 4 },
  hint: { color: Color.TEXT_LABEL, marginTop: 10, textAlign: 'center' },
});
