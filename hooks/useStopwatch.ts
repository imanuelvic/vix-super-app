import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

import { formatTime } from '@/lib/format';
import { type FitKind } from '@/lib/fitness';

// ⏱️ Stopwatch olahraga — sub-tab Record di Fitness 💪.
//
// Satu hal yang menentukan seluruh bentuk hook ini: waktunya TIDAK PERNAH
// dihitung dengan menambah 1 tiap detik. Yang disimpan dua CAP WAKTU (kapan
// segmen berjalan ini dimulai, dan berapa yang sudah terkumpul sebelumnya),
// lalu sisanya dihitung dari selisih jam. Alasannya sederhana: kamu memulai
// stopwatch lalu mengantongi HP dan berlari 30 menit. Selama itu layarnya
// mati, app-nya dibekukan iOS, dan penghitung per detik berhenti berdetak —
// yang kembali bukan 30 menit, melainkan beberapa detik pertama saja.
//
// Karena yang disimpan cap waktu, sesi yang sedang berjalan juga selamat kalau
// app-nya benar-benar ditutup: begitu dibuka lagi, selisihnya dihitung ulang
// dari jam, bukan dipulihkan dari hitungan yang terlanjur hilang.
//
// Letaknya di AsyncStorage (bukan Firestore): ini keadaan SEMENTARA di HP ini,
// belum jadi catatan. Yang tersimpan ke Firestore cuma hasilnya, saat kamu
// meng-click Selesai (lihat appendFitLog di lib/fitness.ts).

const KEY = 'fit:stopwatch';

/** Keadaan yang disimpan di HP. Null = tidak ada sesi yang sedang berjalan. */
type Simpanan = {
  kind: FitKind;
  /** Epoch ms saat Mulai PERTAMA kali di-click — untuk label jam mulainya. */
  startedEpoch: number;
  /** Milidetik yang sudah terkumpul dari segmen-segmen yang sudah dijeda. */
  accruedMs: number;
  /** Epoch ms saat segmen berjalan ini dimulai; null = sedang dijeda. */
  runningSince: number | null;
};

export type Stopwatch = {
  /** Jenis olahraga yang dipilih sebelum mulai. */
  kind: FitKind;
  setKind: (kind: FitKind) => void;
  /** Sedang berjalan (bukan dijeda). */
  running: boolean;
  /** Ada sesi yang belum disimpan (sedang berjalan ATAU sedang dijeda). */
  active: boolean;
  /** Lama sesi ini, dalam detik utuh. */
  seconds: number;
  /** Jam mulainya, "07.34". Kosong kalau belum ada sesi. */
  startedAt: string;
  /** Keadaan tersimpan sudah dibaca dari HP (sebelum itu jangan menggambar). */
  ready: boolean;
  start: () => void;
  pause: () => void;
  resume: () => void;
  /** Buang sesi ini tanpa menyimpan apa pun. */
  reset: () => void;
};

function elapsedMs(s: Simpanan | null, now: number): number {
  if (!s) return 0;
  return s.accruedMs + (s.runningSince === null ? 0 : now - s.runningSince);
}

export function useStopwatch(): Stopwatch {
  const [kind, setKindState] = useState<FitKind>('run');
  const [sesi, setSesi] = useState<Simpanan | null>(null);
  const [ready, setReady] = useState(false);
  // Jam sekarang, DISIMPAN sebagai state & disegarkan tiap detik — bukan
  // `Date.now()` di badan render. Dua alasan, dan keduanya nyata:
  //   1. React Compiler melarangnya (fungsi tak murni saat render), jadi
  //      lint-nya memang menolak.
  //   2. Lebih penting: detak yang terlewat jadi tidak menghilangkan waktu.
  //      Yang digambar selalu SELISIH dua cap waktu, jadi app yang sempat
  //      dibekukan iOS kembali dengan angka yang benar, bukan dengan hitungan
  //      yang tertinggal selama layarnya mati.
  const [now, setNow] = useState(() => Date.now());

  // Baca keadaan tersimpan sekali, saat layarnya dibuka.
  useEffect(() => {
    let hidup = true;
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (!hidup) return;
        if (raw) {
          const s = JSON.parse(raw) as Simpanan;
          if (typeof s?.accruedMs === 'number') {
            setSesi(s);
            setKindState(s.kind);
            // Sesi yang berjalan saat app ditutup langsung tampil dengan
            // waktu yang benar, tanpa menunggu detak pertama.
            setNow(Date.now());
          }
        }
      })
      .catch(() => {
        // Gagal membaca = mulai dari kosong. Stopwatch yang hilang menyebalkan,
        // tapi layar yang menolak terbuka jauh lebih buruk.
      })
      .finally(() => {
        if (hidup) setReady(true);
      });
    return () => {
      hidup = false;
    };
  }, []);

  // Tulis tiap kali keadaannya berubah. Sengaja TIDAK menulis sebelum bacaan
  // pertama selesai, supaya keadaan kosong awal tidak menimpa sesi yang
  // sebenarnya masih berjalan.
  useEffect(() => {
    if (!ready) return;
    const tulis = sesi
      ? AsyncStorage.setItem(KEY, JSON.stringify(sesi))
      : AsyncStorage.removeItem(KEY);
    tulis.catch(() => {});
  }, [sesi, ready]);

  // Berdetak hanya selagi berjalan — stopwatch yang dijeda tidak perlu
  // membangunkan layar tiap detik.
  const running = sesi?.runningSince != null;
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [running]);

  const start = useCallback(() => {
    const t = Date.now();
    setNow(t);
    setSesi({ kind, startedEpoch: t, accruedMs: 0, runningSince: t });
  }, [kind]);

  const pause = useCallback(() => {
    const t = Date.now();
    setNow(t);
    setSesi((s) =>
      !s || s.runningSince === null
        ? s
        : {
            ...s,
            accruedMs: s.accruedMs + (t - s.runningSince),
            runningSince: null,
          },
    );
  }, []);

  const resume = useCallback(() => {
    const t = Date.now();
    setNow(t);
    setSesi((s) =>
      !s || s.runningSince !== null ? s : { ...s, runningSince: t },
    );
  }, []);

  const reset = useCallback(() => setSesi(null), []);

  const setKind = useCallback((k: FitKind) => {
    setKindState(k);
    // Jenisnya masih bisa dibetulkan di tengah sesi: salah pilih sebelum mulai
    // itu wajar, dan memaksa membuang sesinya berarti membuang waktu yang
    // sudah terlanjur berjalan.
    setSesi((s) => (s ? { ...s, kind: k } : s));
  }, []);

  return {
    kind: sesi?.kind ?? kind,
    setKind,
    running,
    active: sesi !== null,
    seconds: Math.floor(elapsedMs(sesi, now) / 1000),
    startedAt: sesi ? formatTime(new Date(sesi.startedEpoch)) : '',
    ready,
    start,
    pause,
    resume,
    reset,
  };
}
