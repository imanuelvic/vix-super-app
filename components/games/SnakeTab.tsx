import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { PressableScale } from '@/components/common/PressableScale';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { VixText } from '@/components/common/VixText';
import { IconSymbol } from '@/components/ui/icon-symbol';

// Snake 🐍 — versi sederhana ala HP Nokia lama.
// Papan kotak GRID×GRID, ular jalan sendiri tiap tick, dikendalikan 4 tombol
// arah. Makan 1 makanan yang muncul di posisi acak → ular tambah panjang &
// jalannya makin cepat. Nabrak dinding atau badan sendiri = selesai.
//
// Semua murni di HP: tidak menyentuh Firestore sama sekali. Rekor skor cukup
// disimpan lokal (AsyncStorage) — tidak perlu biaya baca/tulis database.

const GRID = 15; // papan 15×15 kotak
const START_TICK_MS = 200; // kecepatan awal (makin kecil = makin cepat)
const MIN_TICK_MS = 90; // batas tercepat
const SPEED_STEP_MS = 6; // percepatan tiap kali makan
const BEST_KEY = 'snake:best';

type Point = { x: number; y: number };
type Dir = 'up' | 'down' | 'left' | 'right';
type Status = 'idle' | 'playing' | 'over';

type Game = {
  snake: Point[]; // kepala di index 0
  food: Point;
  dir: Dir;
  score: number;
  status: Status;
};

const DELTA: Record<Dir, Point> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const OPPOSITE: Record<Dir, Dir> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
};

/** Makanan baru di kotak kosong mana pun (tidak menimpa badan ular). */
function randomFood(snake: Point[]): Point {
  const taken = new Set(snake.map((p) => `${p.x},${p.y}`));
  const free: Point[] = [];
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      if (!taken.has(`${x},${y}`)) free.push({ x, y });
    }
  }
  return free[Math.floor(Math.random() * free.length)] ?? { x: 0, y: 0 };
}

/** Ular awal: 3 kotak di tengah papan, menghadap ke kanan. */
function newGame(): Game {
  const mid = Math.floor(GRID / 2);
  const snake = [
    { x: mid, y: mid },
    { x: mid - 1, y: mid },
    { x: mid - 2, y: mid },
  ];
  return { snake, food: randomFood(snake), dir: 'right', score: 0, status: 'idle' };
}

/**
 * Satu langkah permainan — FUNGSI MURNI (tidak mengubah apa pun di luar),
 * jadi aman dipanggil dari updater React.
 */
function step(g: Game, wanted: Dir): Game {
  if (g.status !== 'playing') return g;
  // Tidak boleh langsung balik badan 180°.
  const dir = wanted === OPPOSITE[g.dir] ? g.dir : wanted;
  const head = g.snake[0];
  const next = { x: head.x + DELTA[dir].x, y: head.y + DELTA[dir].y };

  const hitWall =
    next.x < 0 || next.x >= GRID || next.y < 0 || next.y >= GRID;
  // Ekor paling belakang ikut bergeser, jadi menempatinya TIDAK dihitung nabrak.
  const body = g.snake.slice(0, -1);
  const hitSelf = body.some((p) => p.x === next.x && p.y === next.y);
  if (hitWall || hitSelf) return { ...g, dir, status: 'over' };

  const ate = next.x === g.food.x && next.y === g.food.y;
  const snake = ate ? [next, ...g.snake] : [next, ...body];
  return {
    ...g,
    dir,
    snake,
    score: ate ? g.score + 1 : g.score,
    food: ate ? randomFood(snake) : g.food,
  };
}

export function SnakeTab() {
  const [game, setGame] = useState<Game>(newGame);
  const [best, setBest] = useState(0);
  // Arah yang ditekan pemain — dibaca saat tick berikutnya supaya menekan dua
  // tombol dalam satu tick tidak membuat ular menembus badannya sendiri.
  const wantedDir = useRef<Dir>('right');
  // Papan mengambil SISA ruang di antara skor & tombol arah, lalu dibuat
  // persegi dari sisi terpendeknya — supaya tombol arah tidak pernah tertutup
  // tab bar di bawah, di layar tinggi maupun pendek.
  const [boardSize, setBoardSize] = useState(0);
  const cell = boardSize / GRID;

  // Rekor tersimpan di HP saja (bukan Firestore) — gratis & instan.
  useEffect(() => {
    AsyncStorage.getItem(BEST_KEY).then((v) => {
      if (v != null) setBest(Number(v) || 0);
    });
  }, []);

  // Makin panjang ularnya, makin cepat jalannya (ala Nokia).
  const tickMs = Math.max(MIN_TICK_MS, START_TICK_MS - game.score * SPEED_STEP_MS);

  useEffect(() => {
    if (game.status !== 'playing') return;
    const t = setInterval(() => setGame((g) => step(g, wantedDir.current)), tickMs);
    return () => clearInterval(t);
  }, [game.status, tickMs]);

  // Selesai → simpan rekor baru kalau memang lebih tinggi.
  useEffect(() => {
    if (game.status !== 'over' || game.score <= best) return;
    setBest(game.score);
    AsyncStorage.setItem(BEST_KEY, String(game.score)).catch(() => {});
  }, [game.status, game.score, best]);

  function start() {
    wantedDir.current = 'right';
    setGame({ ...newGame(), status: 'playing' });
  }

  return (
    <View style={styles.flex}>
      {/* Skor & rekor */}
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
            {best}
          </VixText>
          <VixText heading="label" additionalStyle={styles.scoreLabel}>
            🏅 Rekor
          </VixText>
        </View>
      </View>

      {/* Papan — ukurannya menyesuaikan sisa ruang yang tersedia */}
      <View
        style={styles.boardWrap}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          setBoardSize(Math.floor(Math.min(width, height)));
        }}>
        <View style={[styles.board, { width: boardSize, height: boardSize }]}>
        {boardSize > 0 && (
          <>
            {/* Makanan */}
            <View
              style={[
                styles.food,
                {
                  width: cell,
                  height: cell,
                  left: game.food.x * cell,
                  top: game.food.y * cell,
                },
              ]}
            />
            {/* Badan ular — kepala diberi warna berbeda */}
            {game.snake.map((p, i) => (
              <View
                key={i}
                style={[
                  styles.segment,
                  i === 0 ? styles.head : styles.body,
                  {
                    width: cell,
                    height: cell,
                    left: p.x * cell,
                    top: p.y * cell,
                  },
                ]}
              />
            ))}
          </>
        )}

        {/* Lapisan pesan: sebelum mulai & saat kalah */}
        {game.status !== 'playing' && (
          <View style={styles.overlay}>
            <VixText additionalStyle={styles.overlayEmoji}>
              {game.status === 'over' ? '💥' : '🐍'}
            </VixText>
            <VixText heading="title" additionalStyle={styles.overlayTitle}>
              {game.status === 'over' ? 'Game Over' : 'Snake'}
            </VixText>
            <VixText heading="label" additionalStyle={styles.overlayText}>
              {game.status === 'over'
                ? `Panjang ${game.snake.length} · skor ${game.score}`
                : 'Makan titik merahnya, jangan nabrak dinding & badan sendiri.'}
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

      {/* Tombol arah: atas · kiri/kanan · bawah */}
      <View style={styles.pad}>
        <DirButton dir="up" icon="chevron.up" wanted={wantedDir} />
        <View style={styles.padMiddle}>
          <DirButton dir="left" icon="chevron.left" wanted={wantedDir} />
          <DirButton dir="right" icon="chevron.right" wanted={wantedDir} />
        </View>
        <DirButton dir="down" icon="chevron.down" wanted={wantedDir} />
      </View>
    </View>
  );
}

// Satu tombol arah. Arahnya cuma dicatat di ref — dipakai saat tick berikutnya.
function DirButton({
  dir,
  icon,
  wanted,
}: {
  dir: Dir;
  icon: 'chevron.up' | 'chevron.down' | 'chevron.left' | 'chevron.right';
  wanted: React.RefObject<Dir>;
}) {
  return (
    <PressableScale
      style={styles.padButton}
      onPress={() => {
        wanted.current = dir;
      }}>
      <IconSymbol name={icon} size={30} color={Color.TOURNAMENT_DARK} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, paddingHorizontal: 20, paddingTop: 4, paddingBottom: 8 },
  scoreRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  scoreBox: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: Color.TOURNAMENT,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Color.TOURNAMENT_DARK,
    paddingVertical: 8,
  },
  scoreValue: { color: Color.TOURNAMENT_DARK },
  scoreLabel: { color: Color.TOURNAMENT_DARK },
  // Pembungkus papan: mengambil SISA tinggi layar, papannya ditengahkan.
  boardWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  // Papan persegi — ukurannya diisi dari hasil pengukuran boardWrap.
  board: {
    backgroundColor: Color.MAIN_DARK,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: Color.TOURNAMENT_DARK,
    overflow: 'hidden',
  },
  segment: { position: 'absolute', borderRadius: 3, borderWidth: 1 },
  head: {
    backgroundColor: Color.TOURNAMENT,
    borderColor: Color.MAIN_DARK,
  },
  body: {
    backgroundColor: Color.MAIN_LIGHT,
    borderColor: Color.MAIN_DARK,
  },
  food: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 2,
    borderColor: Color.MAIN_DARK,
    backgroundColor: Color.DANGER,
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 28,
    backgroundColor: Color.OVERLAY,
  },
  overlayEmoji: { fontSize: 46, lineHeight: 56 },
  overlayTitle: { color: Color.TEXT_REVERSE },
  overlayText: { color: Color.TEXT_ON_DARK_MUTED, textAlign: 'center' },
  startButton: { marginTop: 12, alignSelf: 'stretch' },
  // Tombol arah — tinggi tetap, jadi papan di atasnya yang mengalah.
  pad: { alignItems: 'center', gap: 8, marginTop: 10 },
  padMiddle: { flexDirection: 'row', gap: 56 },
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
});
