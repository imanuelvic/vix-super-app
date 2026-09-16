import {
  MEETING_KINDS,
  type CoreLeader,
  type MeetingKind,
  type MonthlyMeeting,
  type Visitation,
} from './core';
import { dayId, mondayIndex } from './format';

// Kalender CORE 📆 & Rekap Visitasi 📊 — hitungan murni, tanpa Firestore dan
// tanpa tampilan, supaya bisa diuji sendiri.

// ============================== Kalender ==============================

/** Satu jadwal di kalender: visitasi ATAU rapat bulanan, diurutkan per jam. */
export type CoreEvent =
  | { kind: 'visitation'; date: Date; visitation: Visitation }
  | { kind: 'monthly'; date: Date; meeting: MonthlyMeeting };

/**
 * Kelompokkan visitasi + rapat bulanan per hari ("YYYY-MM-DD" → daftar
 * berurut jam). Hari tanpa jadwal tidak punya kunci, jadi "ada titik atau
 * tidak" cukup dijawab dengan `has(dayId)`.
 */
export function coreEventsByDay(
  visitations: Visitation[],
  meetings: MonthlyMeeting[],
): Map<string, CoreEvent[]> {
  const semua: CoreEvent[] = [
    ...visitations.map((v) => ({ kind: 'visitation' as const, date: v.date.toDate(), visitation: v })),
    ...meetings.map((m) => ({ kind: 'monthly' as const, date: m.date.toDate(), meeting: m })),
  ];
  semua.sort((a, b) => a.date.getTime() - b.date.getTime());
  const peta = new Map<string, CoreEvent[]>();
  for (const e of semua) {
    const k = dayId(e.date);
    const daftar = peta.get(k);
    if (daftar) daftar.push(e);
    else peta.set(k, [e]);
  }
  return peta;
}

export type CalendarCell = {
  date: Date;
  dayId: string;
  /** false = tanggal pinjaman dari bulan sebelah (dicetak pudar). */
  inMonth: boolean;
};

/**
 * 42 petak (6 baris × 7 hari) untuk satu bulan, SENIN dulu — mengikuti irama
 * minggu di seluruh app (mondayIndex). Baris pertama diawali tanggal bulan
 * sebelumnya sampai Senin, sisanya diisi tanggal bulan berikutnya, supaya
 * tinggi kalendernya tetap dan tidak melompat saat bulan berganti.
 */
export function calendarCells(year: number, month: number): CalendarCell[] {
  const pertama = new Date(year, month, 1);
  const mulai = new Date(year, month, 1 - mondayIndex(pertama));
  const out: CalendarCell[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(mulai.getFullYear(), mulai.getMonth(), mulai.getDate() + i);
    out.push({ date: d, dayId: dayId(d), inMonth: d.getMonth() === month });
  }
  return out;
}

// ============================== Rekap ==============================

export type RecapRow = {
  kind: MeetingKind;
  /** Jumlah visitasi SELESAI jenis ini per CL, urutan sama dengan `leaders`. */
  counts: number[];
  /** Jumlah baris ini untuk semua CL. */
  total: number;
};

export type VisitationRecap = {
  year: number;
  leaders: CoreLeader[];
  /** Satu baris per jenis pertemuan, urutan MEETING_KINDS. */
  rows: RecapRow[];
  /** Total per CL (kolom), urutan sama dengan `leaders`. */
  totals: number[];
  /** Seluruh visitasi selesai tahun itu, dihitung per CL (gabungan = tiap CL). */
  grand: number;
  /** Tanggal Thanksgiving tiap CL tahun itu (null = belum), urutan `leaders`. */
  thanksgiving: (Date | null)[];
  /** Visitasi tahun itu yang BELUM selesai (masih terjadwal / terlewat). */
  planned: number;
};

/**
 * Rekap visitasi satu tahun: berapa kali tiap CL sudah benar-benar
 * DIKUNJUNGI (✅ selesai), per jenis pertemuan.
 *
 * Acara gabungan dihitung untuk SETIAP CL yang ikut — dari sudut pandang
 * "CL ini sudah kutemui berapa kali", ikut acara gabungan tetap sebuah
 * pertemuan. Thanksgiving: baik jenisnya Thanksgiving maupun acara lain yang
 * diberi penanda 🎉, tanggalnya dicatat di baris Thanksgiving (yang paling
 * awal tahun itu), sementara hitungannya tetap masuk jenis aslinya.
 */
export function visitationRecap(
  visitations: Visitation[],
  leaders: CoreLeader[],
  year: number,
): VisitationRecap {
  const indeks = new Map(leaders.map((l, i) => [l.id, i]));
  const rows: RecapRow[] = MEETING_KINDS.map((k) => ({
    kind: k.key,
    counts: leaders.map(() => 0),
    total: 0,
  }));
  const thanksgiving: (Date | null)[] = leaders.map(() => null);
  let planned = 0;

  for (const v of visitations) {
    const d = v.date.toDate();
    if (d.getFullYear() !== year) continue;
    if (!v.done) {
      planned++;
      continue;
    }
    const row = rows.find((r) => r.kind === v.kind) ?? rows[0];
    const syukur = v.kind === 'thanksgiving' || v.thanksgiving;
    for (const id of v.leaderIds) {
      const i = indeks.get(id);
      if (i === undefined) continue;
      row.counts[i]++;
      row.total++;
      if (syukur) {
        const ada = thanksgiving[i];
        if (!ada || d.getTime() < ada.getTime()) thanksgiving[i] = d;
      }
    }
  }

  const totals = leaders.map((_, i) => rows.reduce((s, r) => s + r.counts[i], 0));
  return {
    year,
    leaders,
    rows,
    totals,
    grand: totals.reduce((s, n) => s + n, 0),
    thanksgiving,
    planned,
  };
}
