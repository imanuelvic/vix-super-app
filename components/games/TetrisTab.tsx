import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { PressableScale } from '@/components/common/PressableScale';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { VixText } from '@/components/common/VixText';
import { IconSymbol } from '@/components/ui/icon-symbol';

// Tetris 🧱 — versi sederhana. Balok jatuh sendiri tiap tick; digeser,
// diputar, atau dijatuhkan langsung. Satu baris penuh = baris itu hilang &
// yang di atasnya turun. Balok mentok sampai atas = selesai.
//
// Sama seperti Snake: MURNI di HP, tidak menyentuh Firestore sama sekali.
// Rekor cukup disimpan lokal (AsyncStorage) — gratis & instan.

const COLS = 10;
const ROWS = 18;
const BEST_KEY = 'tetris:best';

// Kecepatan jatuh: mulai 700ms, tiap naik level 70ms lebih cepat, mentok 120ms.
const START_TICK_MS = 700;
const MIN_TICK_MS = 120;
const SPEED_STEP_MS = 70;
/** Naik satu level tiap 10 baris — makin tinggi level, makin cepat. */
const LINES_PER_LEVEL = 10;

// Nilai per sekali bersih, dikali level. Empat baris sekaligus ("Tetris")
// sengaja jauh lebih mahal supaya ada alasan menahan balok panjang.
const LINE_SCORE = [0, 100, 300, 500, 800];

type Kind = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L';
type Cell = [number, number]; // [x, y] di dalam kotak size×size
type Status = 'idle' | 'playing' | 'over';

// Tiap balok digambar di dalam kotak persegi (size×size) supaya bisa diputar
// dengan satu rumus yang sama. Warnanya diambil dari palet grafik app —
// jangan hardcode hex di sini.
const SHAPES: Record<Kind, { size: number; cells: Cell[]; color: string }> = {
  I: { size: 4, cells: [[0, 1], [1, 1], [2, 1], [3, 1]], color: Color.CHART_COLORS[3] },
  O: { size: 2, cells: [[0, 0], [1, 0], [0, 1], [1, 1]], color: Color.CHART_COLORS[6] },
  T: { size: 3, cells: [[1, 0], [0, 1], [1, 1], [2, 1]], color: Color.CHART_COLORS[5] },
  S: { size: 3, cells: [[1, 0], [2, 0], [0, 1], [1, 1]], color: Color.CHART_COLORS[7] },
  Z: { size: 3, cells: [[0, 0], [1, 0], [1, 1], [2, 1]], color: Color.CHART_COLORS[4] },
  J: { size: 3, cells: [[0, 0], [0, 1], [1, 1], [2, 1]], color: Color.CHART_COLORS[9] },
  L: { size: 3, cells: [[2, 0], [0, 1], [1, 1], [2, 1]], color: Color.CHART_COLORS[10] },
};

const KINDS = Object.keys(SHAPES) as Kind[];

type Active = {
  kind: Kind;
  cells: Cell[];
  size: number;
  x: number; // posisi kotak balok di papan
  y: number;
};

type Board = (string | null)[][]; // warna balok yang sudah mengendap, null = kosong

type Game = {
  board: Board;
  active: Active | null;
  score: number;
  lines: number;
  status: Status;
};

function emptyBoard(): Board {
  return Array.from({ length: ROWS }, () => Array<string | null>(COLS).fill(null));
}

function randomKind(): Kind {
  return KINDS[Math.floor(Math.random() * KINDS.length)];
}

/** Balok baru, mendarat di tengah atas papan. */
function spawn(kind: Kind): Active {
  const { size, cells } = SHAPES[kind];
  return { kind, cells, size, x: Math.floor((COLS - size) / 2), y: 0 };
}

/**
 * Putar 90° searah jarum jam di dalam kotaknya: (x, y) → (size-1-y, x).
 * Karena setiap balok digambar di kotak persegi, satu rumus ini cukup untuk
 * ketujuhnya — balok O kebetulan menghasilkan bentuk yang sama persis, jadi
 * memutarnya tidak menggesernya sedikit pun.
 */
function rotateCells(cells: Cell[], size: number): Cell[] {
  return cells.map(([x, y]) => [size - 1 - y, x] as Cell);
}

/** Muat di posisi itu? (tidak keluar papan & tidak menabrak yang sudah mengendap) */
function fits(board: Board, cells: Cell[], ox: number, oy: number): boolean {
  return cells.every(([cx, cy]) => {
    const x = ox + cx;
    const y = oy + cy;
    if (x < 0 || x >= COLS || y >= ROWS) return false;
    if (y < 0) return true; // masih di atas papan saat baru muncul — dibolehkan
    return board[y][x] === null;
  });
}

/**
 * Balok berhenti: warnanya dicetak ke papan, baris penuh dibersihkan, lalu
 * balok berikutnya muncul. Kalau yang baru tidak muat lagi → permainan selesai.
 */
function lock(g: Game): Game {
  const a = g.active!;
  const board = g.board.map((row) => [...row]);
  for (const [cx, cy] of a.cells) {
    const y = a.y + cy;
    if (y >= 0) board[y][a.x + cx] = SHAPES[a.kind].color;
  }

  const kept = board.filter((row) => row.some((c) => c === null));
  const cleared = ROWS - kept.length;
  while (kept.length < ROWS) {
    kept.unshift(Array<string | null>(COLS).fill(null));
  }

  const lines = g.lines + cleared;
  const level = Math.floor(lines / LINES_PER_LEVEL) + 1;
  const next = spawn(randomKind());

  return {
    board: kept,
    active: next,
    score: g.score + LINE_SCORE[cleared] * level,
    lines,
    status: fits(kept, next.cells, next.x, next.y) ? 'playing' : 'over',
  };
}

/** Satu tick gravitasi — fungsi MURNI, aman dipanggil dari updater React. */
function drop(g: Game): Game {
  if (g.status !== 'playing' || !g.active) return g;
  const a = g.active;
  if (fits(g.board, a.cells, a.x, a.y + 1)) {
    return { ...g, active: { ...a, y: a.y + 1 } };
  }
  return lock(g);
}

function newGame(): Game {
  return {
    board: emptyBoard(),
    active: spawn(randomKind()),
    score: 0,
    lines: 0,
    status: 'idle',
  };
}

export function TetrisTab() {
  const [game, setGame] = useState<Game>(newGame);
  const [best, setBest] = useState(0);
  // Papan mengambil SISA ruang di antara skor & tombol kendali, lalu ukuran
  // kotaknya dipilih dari sisi yang paling sempit — supaya tombol di bawah
  // tidak pernah tertutup tab bar, di layar tinggi maupun pendek.
  const [cell, setCell] = useState(0);

  const level = Math.floor(game.lines / LINES_PER_LEVEL) + 1;

  // Rekor tersimpan di HP saja (bukan Firestore) — gratis & instan.
  useEffect(() => {
    AsyncStorage.getItem(BEST_KEY).then((v) => {
      if (v != null) setBest(Number(v) || 0);
    });
  }, []);

  const tickMs = Math.max(MIN_TICK_MS, START_TICK_MS - (level - 1) * SPEED_STEP_MS);

  useEffect(() => {
    if (game.status !== 'playing') return;
    const t = setInterval(() => setGame(drop), tickMs);
    return () => clearInterval(t);
  }, [game.status, tickMs]);

  // Selesai → simpan rekor baru kalau memang lebih tinggi.
  useEffect(() => {
    if (game.status !== 'over' || game.score <= best) return;
    setBest(game.score);
    AsyncStorage.setItem(BEST_KEY, String(game.score)).catch(() => {});
  }, [game.status, game.score, best]);

  /** Geser kiri/kanan — diabaikan kalau mentok. */
  function move(dx: number) {
    setGame((g) => {
      if (g.status !== 'playing' || !g.active) return g;
      const a = g.active;
      return fits(g.board, a.cells, a.x + dx, a.y)
        ? { ...g, active: { ...a, x: a.x + dx } }
        : g;
    });
  }

  /**
   * Putar. Kalau hasil putarannya mentok dinding/balok lain, dicoba digeser
   * sedikit ke kiri/kanan dulu (2 kotak) — tanpa ini balok panjang mustahil
   * diputar saat menempel dinding.
   */
  function turn() {
    setGame((g) => {
      if (g.status !== 'playing' || !g.active) return g;
      const a = g.active;
      const cells = rotateCells(a.cells, a.size);
      for (const dx of [0, -1, 1, -2, 2]) {
        if (fits(g.board, cells, a.x + dx, a.y)) {
          return { ...g, active: { ...a, cells, x: a.x + dx } };
        }
      }
      return g;
    });
  }

  /** Jatuhkan langsung ke dasar & langsung berhenti di situ. */
  function slam() {
    setGame((g) => {
      if (g.status !== 'playing' || !g.active) return g;
      const a = g.active;
      let y = a.y;
      while (fits(g.board, a.cells, a.x, y + 1)) y++;
      return lock({ ...g, active: { ...a, y } });
    });
  }

  function start() {
    setGame({ ...newGame(), status: 'playing' });
  }

  const active = game.active;

  return (
    <View style={styles.flex}>
      {/* Skor · baris · rekor */}
      <View style={styles.scoreRow}>
        <View style={styles.scoreBox}>
          <VixText heading="header" additionalStyle={styles.scoreValue}>
            {game.score}
          </VixText>
          <VixText heading="label" additionalStyle={styles.scoreLabel}>
            Skor
          </VixText>
        </View>
        <View style={styles.scoreBox}>
          <VixText heading="header" additionalStyle={styles.scoreValue}>
            {game.lines}
          </VixText>
          <VixText heading="label" additionalStyle={styles.scoreLabel}>
            Baris · Lv {level}
          </VixText>
        </View>
        <View style={styles.scoreBox}>
          <VixText heading="header" additionalStyle={styles.scoreValue}>
            {best}
          </VixText>
          <VixText heading="label" additionalStyle={styles.scoreLabel}>
            🏅 Rekor
          </VixText>
        </View>
      </View>

      {/* Papan — kotaknya menyesuaikan sisa ruang yang tersedia */}
      <View
        style={styles.boardWrap}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          setCell(Math.floor(Math.min(width / COLS, height / ROWS)));
        }}>
        <View
          style={[styles.board, { width: cell * COLS, height: cell * ROWS }]}>
          {cell > 0 && (
            <>
              {/* Balok yang sudah mengendap */}
              {game.board.map((row, y) =>
                row.map((color, x) =>
                  color === null ? null : (
                    <View
                      key={`${x}-${y}`}
                      style={[
                        styles.block,
                        {
                          backgroundColor: color,
                          width: cell,
                          height: cell,
                          left: x * cell,
                          top: y * cell,
                        },
                      ]}
                    />
                  ),
                ),
              )}
              {/* Balok yang sedang jatuh */}
              {active?.cells.map(([cx, cy], i) => {
                // Bagian yang masih di atas papan tidak digambar.
                if (active.y + cy < 0) return null;
                return (
                  <View
                    key={`a${i}`}
                    style={[
                      styles.block,
                      {
                        backgroundColor: SHAPES[active.kind].color,
                        width: cell,
                        height: cell,
                        left: (active.x + cx) * cell,
                        top: (active.y + cy) * cell,
                      },
                    ]}
                  />
                );
              })}
            </>
          )}

          {/* Lapisan pesan: sebelum mulai & saat kalah */}
          {game.status !== 'playing' && (
            <View style={styles.overlay}>
              <VixText additionalStyle={styles.overlayEmoji}>
                {game.status === 'over' ? '💥' : '🧱'}
              </VixText>
              <VixText heading="title" additionalStyle={styles.overlayTitle}>
                {game.status === 'over' ? 'Game Over' : 'Tetris'}
              </VixText>
              <VixText heading="label" additionalStyle={styles.overlayText}>
                {game.status === 'over'
                  ? `${game.lines} baris · skor ${game.score}`
                  : 'Susun baloknya sampai satu baris penuh — barisnya hilang.'}
              </VixText>
              <PrimaryButton
                label={game.status === 'over' ? '🔄 Main Lagi' : '▶️ Mulai'}
                onPress={start}
                additionalStyle={styles.startButton}
              />
            </View>
          )}
        </View>
      </View>

      {/* Kendali: geser kiri · putar · geser kanan · jatuhkan */}
      <View style={styles.pad}>
        <PadButton icon="chevron.left" onPress={() => move(-1)} />
        <PadButton icon="arrow.clockwise" onPress={turn} />
        <PadButton icon="chevron.right" onPress={() => move(1)} />
        <PadButton icon="arrow.down.to.line" onPress={slam} kind="slam" />
      </View>
    </View>
  );
}

// Satu tombol kendali. Tombol jatuhkan sengaja diberi getaran lebih tegas —
// itu satu-satunya gerakan yang tidak bisa dibatalkan.
function PadButton({
  icon,
  onPress,
  kind = 'move',
}: {
  icon: 'chevron.left' | 'chevron.right' | 'arrow.clockwise' | 'arrow.down.to.line';
  onPress: () => void;
  kind?: 'move' | 'slam';
}) {
  return (
    <PressableScale
      style={[styles.padButton, kind === 'slam' && styles.padSlam]}
      haptic={kind === 'slam' ? 'medium' : 'light'}
      onPress={onPress}>
      <IconSymbol name={icon} size={28} color={Color.TOURNAMENT_DARK} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, paddingHorizontal: 20, paddingTop: 4, paddingBottom: 8 },
  scoreRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  scoreBox: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: Color.TOURNAMENT,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Color.TOURNAMENT_DARK,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  scoreValue: { color: Color.TOURNAMENT_DARK },
  scoreLabel: { color: Color.TOURNAMENT_DARK },
  // Pembungkus papan: mengambil SISA tinggi layar, papannya ditengahkan.
  boardWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  board: {
    backgroundColor: Color.MAIN_DARK,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: Color.TOURNAMENT_DARK,
    overflow: 'hidden',
  },
  block: {
    position: 'absolute',
    borderRadius: 3,
    borderWidth: 1,
    borderColor: Color.MAIN_DARK,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 24,
    backgroundColor: Color.OVERLAY,
  },
  overlayEmoji: { fontSize: 46, lineHeight: 56 },
  overlayTitle: { color: Color.TEXT_REVERSE },
  overlayText: { color: Color.TEXT_ON_DARK_MUTED, textAlign: 'center' },
  startButton: { marginTop: 12, alignSelf: 'stretch' },
  // Kendali — tinggi tetap, jadi papan di atasnya yang mengalah.
  pad: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 14,
    marginTop: 10,
  },
  padButton: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Color.TOURNAMENT,
    borderWidth: 1.5,
    borderColor: Color.TOURNAMENT_DARK,
  },
  // Jatuhkan langsung — dibedakan warnanya karena efeknya permanen.
  padSlam: {
    backgroundColor: Color.ACCENT,
    borderColor: Color.ACCENT_DARK,
  },
});
