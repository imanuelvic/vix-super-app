import AsyncStorage from '@react-native-async-storage/async-storage';
import { useGlobalSearchParams, usePathname } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

import { Color } from '@/assets/style/color';
import { VixText } from '@/components/common/VixText';
import { useAuth } from '@/contexts/auth';
import { useLiveAll } from '@/hooks/useLiveAll';
import { useNow } from '@/hooks/useNow';
import { type LoginStreak } from '@/lib/reward';
import { featureKeyForRoute } from '@/lib/featureTheme';
import { haptic } from '@/lib/haptics';
import {
  bumpWaterStreak,
  setWater,
  subscribeHabitDay,
  subscribeWaterStreak,
  WATER_GOAL,
  type HabitDay,
} from '@/lib/health';

// 💧 Gelas air hari ini sebagai tombol MENGAMBANG (14 Sep 2026), seperti
// AssistiveTouch iPhone: ada di semua layar, bisa diseret ke mana saja dan
// menempel sendiri ke tepi kiri/kanan begitu dilepas.
//
//   click 1×  → +1 gelas       click 2×  → −1 gelas
//
// Tampilannya cincin kemajuan 0..8 seperti donat di Habits, dan di dalamnya
// "gelas" berisi air: permukaannya naik/turun dengan pantulan pegas, dan
// gelombangnya BERGERAK TERUS selama tombolnya tampil (15 Sep 2026 malam;
// dulu cuma beriak sebentar) supaya terasa hidup, dengan percikan lebih tinggi
// saat muncul & tiap angkanya berubah. Yang berjalan terus cuma geseran
// translateX di UI thread (murah); bentuk gelombangnya (path SVG) hanya
// berubah saat riaknya berubah, dan saat tersembunyi geserannya dihentikan.
//
// Tidak tampil di gerbang doa pagi, di seluruh fitur CORE (visitasi &
// pertemuan bukan waktunya menghitung gelas) termasuk Wheel/Timeline milik
// CL yang dibuka dari sana, juga sebelum login. Begitu gelasnya LEWAT target
// (9/8) ia pamit sendiri sampai besok: 8/8 masih tampil hijau sebagai tanda
// selesai, click sekali lagi = "sudah, singkirkan". Muncul dengan MEMANTUL (skala
// pegas 0,6 → melewati 1 → 1) sambil memudar masuk, hilangnya memudar &
// mengecil, supaya tidak "berkedip" saat pindah layar. Datanya
// HabitDay hari ini + streak air, langganan yang sama dengan Home/Habits
// (liveDoc membagi satu listener), jadi tidak ada bacaan tambahan. Letak
// terakhirnya diingat di AsyncStorage: sisi (kiri/kanan) + tinggi relatif,
// jadi pas di iPhone maupun iPad dan ikut saat layarnya diputar.

// 74/6 (dari 64/5, 15 Sep 2026): di layar padat seperti header Friends,
// lingkaran 64 dengan angka 15 pt terasa kecil.
const SIZE = 74;
const RING = 6;
const INNER = SIZE - RING * 2 - 6;
const MARGIN = 10;
const KELILING = 2 * Math.PI * ((SIZE - RING) / 2);
const KUNCI_LETAK = 'water:float';
const MAKS = 20; // batas keras yang sama dengan setWater
// Tinggi riak (px): saat tenang gelombangnya tetap terlihat bergerak pelan;
// saat muncul / angkanya berubah, memercik lebih tinggi lalu meluruh ke tenang.
const RIAK_TENANG = 1.6;
const RIAK_PERCIK = 4;
// Satu putaran gelombang (geser selebar satu gelas) — pelan supaya tenang.
const PUTARAN_MS = 1800;
// Skala tombol saat tersembunyi (titik awal pantulan muncul).
const SKALA_SEMBUNYI = 0.6;
// Goyangan saat diseret: kemiringan permukaan air maksimum (derajat) dan
// pembagi kecepatan seret (px/detik → derajat). Seretan cepat ke kanan =
// airnya tertinggal di kiri = permukaan turun ke kanan (rotasi searah jarum).
const MIRING_MAKS = 16;
const MIRING_PER_PXS = 70;
// Jeda maksimum antara dua click supaya dihitung click dobel (−1). Click
// tunggal baru dihitung +1 sesudah jeda ini lewat tanpa click kedua.
const JEDA_DOBEL = 280;

/**
 * Pembeda click tunggal vs dobel, di JS: click pertama menunggu JEDA_DOBEL;
 * click kedua dalam jeda itu membatalkannya dan menjadi dobel. Timernya hidup
 * di closure modul, bukan di komponen: tombolnya cuma satu di seluruh app,
 * dan ini bukan state yang digambar.
 */
function buatPenghitungClick(jeda: number) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (tunggal: () => void, dobel: () => void) => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
      dobel();
      return;
    }
    timer = setTimeout(() => {
      timer = null;
      tunggal();
    }, jeda);
  };
}
const hitungClick = buatPenghitungClick(JEDA_DOBEL);

type Letak = { side: 'left' | 'right'; yFrac: number };
const LETAK_AWAL: Letak = { side: 'right', yFrac: 0.62 };

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPath = Animated.createAnimatedComponent(Path);

/**
 * Gelombang permukaan air selebar 3×INNER; `a` = tinggi riaknya (px).
 * Polanya berulang tiap INNER, jadi digeser satu gelas lalu melompat balik
 * tanpa terlihat. Tiga gelas (bukan dua) karena badan airnya sekarang
 * melebar setengah gelas ke kiri & kanan supaya bisa dimiringkan.
 */
function gelombang(a: number): string {
  'worklet';
  const w = INNER;
  const y = 6;
  return (
    `M0 ${y} Q ${w * 0.25} ${y - a} ${w * 0.5} ${y} T ${w} ${y} ` +
    `T ${w * 1.5} ${y} T ${w * 2} ${y} T ${w * 2.5} ${y} T ${w * 3} ${y} V 14 H 0 Z`
  );
}

export function WaterFloat() {
  const pathname = usePathname();
  // ?leaderId= = Wheel/Timeline milik CL (dibuka dari CORE), ikut disembunyikan;
  // roda & timeline-ku sendiri (tanpa param) tetap dapat tombolnya.
  const { leaderId } = useGlobalSearchParams<{ leaderId?: string }>();
  const { user } = useAuth();
  const { todayId } = useNow();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const [day, setDay] = useState<HabitDay | null>(null);
  const [streak, setStreak] = useState<LoginStreak | null>(null);

  useLiveAll(
    (uid) => [
      subscribeHabitDay(uid, todayId, setDay),
      subscribeWaterStreak(uid, setStreak),
    ],
    { deps: [todayId] },
  );

  // ---- letak ----
  const batasX = (side: Letak['side']) => (side === 'left' ? MARGIN : width - SIZE - MARGIN);
  const atas = insets.top + 8;
  const bawah = height - insets.bottom - SIZE - 8;
  const x = useSharedValue(batasX(LETAK_AWAL.side));
  const y = useSharedValue(atas + (bawah - atas) * LETAK_AWAL.yFrac);
  const mulaiX = useSharedValue(0);
  const mulaiY = useSharedValue(0);
  const menekan = useSharedValue(0);

  // Letak tersimpan dibaca sekali; tiap ganti ukuran layar (putar iPad) letak
  // dihitung ulang dari sisi + tinggi relatifnya, bukan dari piksel lama.
  useEffect(() => {
    let hidup = true;
    AsyncStorage.getItem(KUNCI_LETAK)
      .then((v) => {
        if (!hidup) return;
        // Belum pernah diseret → letak awal; ini juga yang menjaga tombolnya
        // tetap di dalam layar sesudah iPad diputar.
        const tersimpan = v ? (JSON.parse(v) as Partial<Letak>) : null;
        const l: Letak =
          tersimpan &&
          (tersimpan.side === 'left' || tersimpan.side === 'right') &&
          typeof tersimpan.yFrac === 'number'
            ? { side: tersimpan.side, yFrac: tersimpan.yFrac }
            : LETAK_AWAL;
        x.value = batasX(l.side);
        y.value = atas + (bawah - atas) * Math.min(1, Math.max(0, l.yFrac));
      })
      .catch(() => {});
    return () => {
      hidup = false;
    };
    // Hanya saat mount & ukuran layar berubah.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height, insets.top, insets.bottom]);

  function simpanLetak(side: Letak['side'], yFrac: number) {
    const l: Letak = { side, yFrac };
    AsyncStorage.setItem(KUNCI_LETAK, JSON.stringify(l)).catch(() => {});
  }

  // ---- air ----
  const water = day?.water ?? 0;
  const isi = useSharedValue(0); // 0..1 tinggi air di gelas (bisa memantul lewat)
  const cincin = useSharedValue(0); // 0..1 busur cincin
  const riak = useSharedValue(0); // tinggi riak, px
  const geser = useSharedValue(0); // geseran gelombang, px
  const miring = useSharedValue(0); // kemiringan permukaan saat diseret, derajat
  const pertama = useRef(true);

  useEffect(() => {
    if (!day) return; // belum termuat: jangan animasikan dari nol
    const pct = Math.min(1, water / WATER_GOAL);
    if (pertama.current) {
      // Buka app: langsung di posisinya, tanpa "mengisi" dari nol.
      pertama.current = false;
      isi.value = pct;
      cincin.value = pct;
      return;
    }
    isi.value = withSpring(pct, { damping: 11, stiffness: 150, mass: 0.7 });
    cincin.value = withTiming(pct, { duration: 450, easing: Easing.out(Easing.cubic) });
    // Percikan: riaknya melonjak lalu meluruh ke tinggi tenang. Geseran
    // gelombangnya tidak disentuh — ia sudah berjalan terus selama tampil.
    riak.value = RIAK_PERCIK;
    riak.value = withTiming(RIAK_TENANG, { duration: 1900, easing: Easing.out(Easing.quad) });
  }, [day, water, isi, cincin, riak]);

  async function ubah(delta: number) {
    if (!user || !day) return;
    const next = Math.max(0, Math.min(day.water + delta, MAKS));
    if (next === day.water) return;
    haptic(delta > 0 ? 'light' : 'warning');
    try {
      await setWater(user.uid, todayId, next);
      // Streak naik SEKALI per hari, tepat saat target tercapai (aturan yang
      // sama dengan yang dulu di kartu sapaan Home).
      if (next >= WATER_GOAL) await bumpWaterStreak(user.uid, streak, todayId);
    } catch {
      // Diamkan — snapshot mengoreksi tampilan sendiri.
    }
  }

  /**
   * Satu click. Click kedua yang datang dalam JEDA_DOBEL membatalkan +1 yang
   * sedang menunggu dan menjadi −1. Dihitung di JS, bukan lewat
   * Gesture.Exclusive(dobel, tunggal) di worklet: di build ini click tunggal
   * lewat jalur itu tidak pernah sampai ke ubah(), jadi jalurnya dibuat
   * sesederhana mungkin dan callback-nya dijalankan di JS thread
   * (.runOnJS(true)) supaya selalu memakai user/day terbaru.
   */
  function catatClick() {
    hitungClick(
      () => void ubah(1),
      () => void ubah(-1),
    );
  }

  // ---- gestur: seret (menempel ke tepi saat dilepas) · 1× +1 · 2× −1 ----
  const seret = Gesture.Pan()
    .onStart(() => {
      mulaiX.value = x.value;
      mulaiY.value = y.value;
    })
    .onUpdate((e) => {
      x.value = Math.min(Math.max(mulaiX.value + e.translationX, MARGIN), width - SIZE - MARGIN);
      y.value = Math.min(Math.max(mulaiY.value + e.translationY, atas), bawah);
      // Air bergoyang mengikuti seretan: permukaannya miring searah
      // kelembaman (pegas, supaya menyusul dengan lembut, bukan patah-patah),
      // dan riaknya naik sesuai laju seretan.
      const sasaran = Math.min(Math.max(e.velocityX / MIRING_PER_PXS, -MIRING_MAKS), MIRING_MAKS);
      miring.value = withSpring(sasaran, { damping: 12, stiffness: 160, mass: 0.6 });
      const laju = Math.abs(e.velocityX) + Math.abs(e.velocityY);
      riak.value = Math.min(RIAK_TENANG + laju / 350, 6);
    })
    .onEnd(() => {
      const kiri = x.value + SIZE / 2 < width / 2;
      x.value = withSpring(kiri ? MARGIN : width - SIZE - MARGIN, { damping: 18, stiffness: 190 });
      // Dilepas: permukaannya berayun balik beberapa kali (redaman rendah)
      // lalu tenang, riaknya meluruh — seperti air di gelas yang diletakkan.
      miring.value = withSpring(0, { damping: 6, stiffness: 140, mass: 0.9 });
      riak.value = withTiming(RIAK_TENANG, { duration: 1500, easing: Easing.out(Easing.quad) });
      runOnJS(simpanLetak)(kiri ? 'left' : 'right', (y.value - atas) / Math.max(1, bawah - atas));
    });
  // Click: callback di JS thread (runOnJS(true)); nilai bersama tetap boleh
  // ditulis dari JS untuk animasi mengecil saat disentuh.
  const click = Gesture.Tap()
    .maxDuration(300)
    .runOnJS(true)
    .onBegin(() => {
      menekan.value = withTiming(1, { duration: 80 });
    })
    .onFinalize(() => {
      menekan.value = withTiming(0, { duration: 140 });
    })
    .onEnd(() => {
      catatClick();
    });
  const gestur = Gesture.Race(seret, click);

  // Gerbang doa pagi, seluruh fitur CORE (termasuk Wheel/Timeline CL),
  // sebelum login, dan sesudah gelasnya LEWAT target (9/8; tugas hari ini
  // beres, kembali besok saat HabitDay-nya baru): tidak tampil. Komponennya
  // TETAP terpasang supaya letak & animasinya tidak hilang, dan supaya
  // muncul/hilangnya bisa dianimasikan.
  const sembunyi =
    !user ||
    pathname.startsWith('/morning-journey') ||
    pathname.startsWith('/login') ||
    featureKeyForRoute(pathname) === 'core' ||
    ((pathname.startsWith('/wheel') || pathname.startsWith('/timeline')) && !!leaderId) ||
    water > WATER_GOAL;
  // Mulai dari tersembunyi walau layar pertamanya boleh tampil: dengan begitu
  // buka app pun tombolnya MUNCUL memantul, bukan tahu-tahu sudah ada.
  const tampak = useSharedValue(0); // opacity
  const pantul = useSharedValue(SKALA_SEMBUNYI); // skala badan (pegas)
  useEffect(() => {
    if (sembunyi) {
      tampak.value = withTiming(0, { duration: 240, easing: Easing.out(Easing.cubic) });
      pantul.value = withTiming(SKALA_SEMBUNYI, { duration: 240, easing: Easing.out(Easing.cubic) });
      // Tak terlihat → geseran gelombangnya dihentikan (tidak membakar frame).
      cancelAnimation(geser);
      return;
    }
    tampak.value = withTiming(1, { duration: 200, easing: Easing.out(Easing.cubic) });
    // Memantul: pegas dengan redaman rendah melewati 1 sedikit lalu kembali.
    pantul.value = withSpring(1, { damping: 8, stiffness: 220, mass: 0.8 });
    // Air hidup: gelombang bergeser terus (satu gelas per putaran, lalu
    // melompat balik ke 0 tanpa terlihat karena polanya berulang tiap gelas).
    geser.value = 0;
    geser.value = withRepeat(
      withTiming(-INNER, { duration: PUTARAN_MS, easing: Easing.linear }),
      -1,
      false,
    );
    // Percikan saat muncul, lalu tenang.
    riak.value = RIAK_PERCIK;
    riak.value = withTiming(RIAK_TENANG, { duration: 1600, easing: Easing.out(Easing.quad) });
  }, [sembunyi, tampak, pantul, geser, riak]);

  const gayaBadan = useAnimatedStyle(() => ({
    opacity: tampak.value,
    transform: [
      { translateX: x.value },
      { translateY: y.value },
      // Memantul masuk (0,6 → 1 lewat pegas), lalu mengecil sedikit saat di-click.
      { scale: pantul.value * (1 - menekan.value * 0.08) },
    ],
  }));
  // Badan air melebar setengah gelas ke kiri, kanan, & bawah (lihat styles.air)
  // supaya saat dimiringkan tepinya tidak pernah masuk ke dalam gelas.
  const gayaAir = useAnimatedStyle(() => ({
    height: INNER / 2 + INNER * Math.min(1.15, Math.max(0, isi.value)),
    transform: [{ rotate: `${miring.value}deg` }],
  }));
  const gayaGelombang = useAnimatedStyle(() => ({
    transform: [{ translateX: geser.value }],
  }));
  const propGelombang = useAnimatedProps(() => ({ d: gelombang(riak.value) }));
  const propCincin = useAnimatedProps(() => ({
    strokeDashoffset: KELILING * (1 - Math.min(1, Math.max(0, cincin.value))),
  }));

  // Sebelum login tidak ada yang perlu digambar; selebihnya tombolnya tetap
  // di pohon (tersembunyi = pudar & tidak bisa disentuh).
  if (!user) return null;

  const cukup = water >= WATER_GOAL;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <GestureDetector gesture={gestur}>
        <Animated.View
          style={[styles.badan, gayaBadan]}
          pointerEvents={sembunyi ? 'none' : 'auto'}>
          {/* Cincin kemajuan 0..8 — seperti donat di Habits */}
          <Svg width={SIZE} height={SIZE} style={StyleSheet.absoluteFill}>
            <Circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={(SIZE - RING) / 2}
              stroke={Color.CONTRAST_CONTAINER}
              strokeWidth={RING}
              fill="none"
            />
            <AnimatedCircle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={(SIZE - RING) / 2}
              stroke={cukup ? Color.MAIN : Color.WATER}
              strokeWidth={RING}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={`${KELILING} ${KELILING}`}
              animatedProps={propCincin}
              rotation={-90}
              origin={`${SIZE / 2}, ${SIZE / 2}`}
            />
          </Svg>

          {/* Gelas: air naik dari bawah, permukaannya beriak sebentar */}
          <View style={styles.gelas}>
            <Animated.View style={[styles.air, gayaAir]}>
              <Animated.View style={[styles.gelombangWrap, gayaGelombang]}>
                <Svg width={INNER * 3} height={14}>
                  <AnimatedPath animatedProps={propGelombang} fill={Color.WATER} />
                </Svg>
              </Animated.View>
            </Animated.View>
            <VixText heading="title" additionalStyle={styles.angka}>
              {water}/{WATER_GOAL}
            </VixText>
          </View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  badan: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    backgroundColor: Color.CONTAINER,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Color.TEXT_TITLE,
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  gelas: {
    width: INNER,
    height: INNER,
    borderRadius: INNER / 2,
    backgroundColor: Color.WATER_LIGHT,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Badan air: menempel ke dasar gelas, tingginya dianimasikan. Melebar
  // setengah gelas ke kiri, kanan, & bawah (dipotong overflow gelas) supaya
  // bisa dimiringkan saat diseret tanpa memperlihatkan tepinya.
  air: {
    position: 'absolute',
    left: -INNER / 2,
    right: -INNER / 2,
    bottom: -INNER / 2,
    backgroundColor: Color.WATER,
  },
  // Gelombangnya menggantung di permukaan air (di atas badannya), selebar tiga
  // kali gelas supaya bisa digeser satu gelas tanpa terlihat ujungnya.
  gelombangWrap: {
    position: 'absolute',
    left: 0,
    top: -8,
    width: INNER * 3,
    height: 14,
  },
  angka: { color: Color.WATER_DARK },
});
