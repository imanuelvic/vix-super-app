import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Color } from '@/assets/style/color';
import { PressableScale } from '@/components/common/PressableScale';
import { VixText } from '@/components/common/VixText';

// Gelembung refleksi 💭 — pertanyaan tambahan yang naik pelan-pelan selagi
// kamu menilai satu area Wheel of Life.
//
// Kenapa naik, bukan daftar diam: daftar lima pertanyaan sekaligus dibaca
// sekilas lalu dilewati. Yang muncul satu-satu & bergerak menahan mata
// sebentar di tiap pertanyaan — itulah "waktu berpikir keras" yang diminta.
// Efeknya juga menutupi maksud lain: layar penilaian ini tadinya sepi, dan
// kesepian itu bikin skornya ditebak cepat-cepat.
//
// Click satu gelembung = pertanyaannya turun ke kolom catatan di bawah, siap
// dijawab. Tidak wajib: yang wajib tetap skor 1–10.

/** Tinggi kolam gelembungnya. Muat ±3 gelembung sekaligus tanpa berdesakan. */
const FIELD_H = 170;

/**
 * Lama satu gelembung naik dari dasar sampai hilang di atas.
 *
 * Sengaja LAMBAT (13 detik): selain memberi waktu membaca, gelembung yang
 * pelan itu yang membuatnya bisa di-click. Sasaran yang bergerak cepat cuma
 * bikin gagal click berkali-kali.
 */
const RISE_MS = 13000;

export function ReflectionBubbles({
  questions,
  note,
  onPick,
}: {
  questions: string[];
  /** Catatan area ini — dipakai menandai pertanyaan yang sudah diambil. */
  note: string;
  onPick: (question: string) => void;
}) {
  return (
    <View style={styles.wrap}>
      <VixText heading="label" additionalStyle={styles.hint}>
        💭 Renungkan dulu — click gelembungnya buat menjawabnya di catatan.
      </VixText>
      <View style={styles.field}>
        {questions.map((q, i) => (
          // key = pertanyaannya: ganti area → gelembungnya berganti identitas,
          // jadi animasinya mulai dari awal, bukan melanjutkan yang tadi.
          <Bubble
            key={q}
            text={q}
            index={i}
            total={questions.length}
            taken={note.includes(q)}
            onPress={() => onPick(q)}
          />
        ))}
      </View>
    </View>
  );
}

function Bubble({
  text,
  index,
  total,
  taken,
  onPress,
}: {
  text: string;
  index: number;
  total: number;
  taken: boolean;
  onPress: () => void;
}) {
  // Bukan state React: nilainya berubah 60x/detik di UI thread, jadi tidak
  // boleh memicu render sama sekali.
  const naik = useSharedValue(0);

  useEffect(() => {
    // Jedanya dibagi rata — kelimanya berangkat berurutan, bukan bersamaan.
    naik.value = withDelay(
      (index * RISE_MS) / total,
      withRepeat(
        withTiming(1, { duration: RISE_MS, easing: Easing.linear }),
        -1,
        false,
      ),
    );
  }, [naik, index, total]);

  const gaya = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(naik.value, [0, 1], [FIELD_H, -70]) },
      // Goyangan kecil kiri-kanan — supaya naiknya terasa mengambang, bukan
      // digeser lurus oleh mesin.
      {
        translateX: interpolate(
          naik.value,
          [0, 0.25, 0.5, 0.75, 1],
          [0, 8, 0, -8, 0],
        ),
      },
    ],
    // Muncul & hilang perlahan di kedua ujung, jadi tidak ada gelembung yang
    // "terpotong" di tepi kolamnya.
    opacity: interpolate(naik.value, [0, 0.12, 0.84, 1], [0, 1, 1, 0]),
  }));

  return (
    <Animated.View
      style={[styles.slot, LANE[index % LANE.length], gaya]}
      pointerEvents="box-none">
      {/* PressableScale memakai transform untuk efek tekannya, jadi
          mengambangnya dipasang di pembungkus ini — dua transform di satu
          tampilan akan saling menimpa. */}
      <PressableScale
        style={[styles.bubble, taken && styles.bubbleTaken]}
        onPress={onPress}>
        <VixText
          heading="label"
          additionalStyle={taken ? styles.textTaken : styles.text}>
          {taken ? '✓ ' : ''}
          {text}
        </VixText>
      </PressableScale>
    </Animated.View>
  );
}

// Tiga jalur mendatar bergantian — kalau semuanya di tengah, gelembung yang
// berpapasan akan saling menutupi.
const LANE = [
  { alignItems: 'flex-start' as const },
  { alignItems: 'flex-end' as const },
  { alignItems: 'center' as const },
];

const styles = StyleSheet.create({
  wrap: { marginTop: 10 },
  hint: { textAlign: 'center', color: Color.TEXT_LABEL },
  field: {
    height: FIELD_H,
    marginTop: 4,
    // Gelembung yang belum masuk & yang sudah lewat dipotong di tepi kolam.
    overflow: 'hidden',
  },
  slot: { position: 'absolute', left: 0, right: 0, top: 0 },
  bubble: {
    maxWidth: '84%',
    backgroundColor: Color.WHEEL,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Color.WHEEL_DARK,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  // Sudah diambil ke catatan → gelembungnya jadi pekat & bertanda ✓, supaya
  // kelihatan mana yang sudah kamu jawab tanpa harus membaca catatannya.
  bubbleTaken: { backgroundColor: Color.WHEEL_DEEP, borderColor: Color.WHEEL_DEEP },
  text: { color: Color.WHEEL_DEEP },
  textTaken: { color: Color.TEXT_REVERSE },
});
