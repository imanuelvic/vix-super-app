import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Color } from '@/assets/style/color';
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
// BACA SAJA — bukan tombol (2 Sep 2026). Dulu satu klik menurunkan
// pertanyaannya ke kolom catatan; sekarang tidak ada lagi yang bisa diklik di
// sini. Gunanya cuma jadi bahan perenungan selagi angkanya dipilih. Sasaran
// yang mengambang memang sulit dikenai, dan klik yang meleset terasa seperti
// app-nya rusak — padahal yang dibutuhkan cuma dibaca.

/** Tinggi kolam gelembungnya. Muat ±3 gelembung sekaligus tanpa berdesakan. */
const FIELD_H = 170;

/**
 * Padding kiri-kanan layar Wheel (`content` di app/wheel.tsx).
 *
 * Dibatalkan oleh `wrap` supaya kolamnya selebar LAYAR. Tanpa itu gelembung
 * tepi berhenti di garis dalam yang tak kelihatan — terlihat seperti tertahan
 * batas, bukan seperti lewat begitu saja.
 */
const PAD_LAYAR = 20;

/** Sejauh apa gelembung tepi menyembul keluar layar sebelum dipotong. */
const SEMBUL = 18;

/**
 * Lama satu gelembung naik dari dasar sampai hilang di atas.
 *
 * Sengaja LAMBAT (13 detik): kalimatnya harus sempat dibaca sampai habis
 * sambil matamu tetap di layar penilaian.
 */
const RISE_MS = 13000;

/**
 * Jarak antar-gelembung berangkat.
 *
 * Dulu RISE_MS dibagi rata jumlah pertanyaan (±2,6 detik untuk lima) — terlalu
 * rapat: tiga pertanyaan mengambang berbarengan dan tak satu pun sempat
 * benar-benar dibaca. Sekarang jaraknya tetap, tidak ikut mengecil kalau
 * pertanyaannya bertambah.
 */
const JEDA_MS = 4200;

export function ReflectionBubbles({ questions }: { questions: string[] }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.field}>
        {questions.map((q, i) => (
          // key = pertanyaannya: ganti area → gelembungnya berganti identitas,
          // jadi animasinya mulai dari awal, bukan melanjutkan yang tadi.
          <Bubble key={q} text={q} index={i} total={questions.length} />
        ))}
      </View>
    </View>
  );
}

function Bubble({
  text,
  index,
  total,
}: {
  text: string;
  index: number;
  total: number;
}) {
  // Bukan state React: nilainya berubah 60x/detik di UI thread, jadi tidak
  // boleh memicu render sama sekali.
  const naik = useSharedValue(0);

  useEffect(() => {
    // Satu putaran = SEMUA pertanyaan berangkat sekali, berselang JEDA_MS.
    // Sesudah sampai di atas, gelembungnya menunggu di luar layar sampai
    // gilirannya datang lagi. Tanpa penantian itu tiap gelembung berulang tiap
    // RISE_MS sendiri-sendiri, dan yang berangkat belakangan lama-lama
    // menyusul yang duluan sampai jaraknya berantakan.
    const tunggu = Math.max(0, total * JEDA_MS - RISE_MS);
    naik.value = withDelay(
      index * JEDA_MS,
      withRepeat(
        withSequence(
          withTiming(1, { duration: RISE_MS, easing: Easing.linear }),
          // Diam di ujung atas: di sini opacity-nya sudah 0, jadi penantiannya
          // tak terlihat — begitu juga lompatan balik ke dasar sesudahnya.
          withTiming(1, { duration: tunggu }),
          withTiming(0, { duration: 0 }),
        ),
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
    // pointerEvents 'none': bukan cuma tidak ada tombolnya — jarinya menembus
    // begitu saja, jadi mustahil ada tekanan yang tertelan gelembung lewat.
    <Animated.View
      style={[styles.slot, LANE[index % LANE.length], gaya]}
      pointerEvents="none">
      <View style={styles.bubble}>
        <VixText heading="label" additionalStyle={styles.text}>
          {text}
        </VixText>
      </View>
    </Animated.View>
  );
}

// Tiga jalur mendatar bergantian — kalau semuanya di tengah, gelembung yang
// berpapasan akan saling menutupi. Yang di tepi sengaja ditarik keluar layar
// sejauh SEMBUL: terpotong tepi layar itulah yang bikin kolamnya terasa lebih
// luas dari layarnya.
const LANE = [
  { alignItems: 'flex-start' as const, left: -SEMBUL },
  { alignItems: 'flex-end' as const, right: -SEMBUL },
  { alignItems: 'center' as const },
];

const styles = StyleSheet.create({
  wrap: { marginTop: 10, marginHorizontal: -PAD_LAYAR },
  field: {
    height: FIELD_H,
    marginTop: 4,
    // Gelembung yang belum masuk & yang sudah lewat dipotong di tepi kolam —
    // dan karena kolamnya selebar layar, yang memotong = tepi layar.
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
  text: { color: Color.WHEEL_DEEP },
});
