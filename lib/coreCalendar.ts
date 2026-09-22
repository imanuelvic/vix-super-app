import {
  MEETING_KINDS,
  type CoreLeader,
  type MeetingKind,
  type MonthlyMeeting,
  type Visitation,
} from './core';
import { dayId, dayIdToDate, mondayIndex } from './format';

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

/**
 * Tanggal Thanksgiving yang DIISI di data CL (thanksgivingDayId), apa pun
 * tahunnya — ini tanggal milik CORE-nya, bukan hitungan per tahun (22 Sep
 * 2026; dulu disaring tahun rekap, jadi isian tahun lain tampil "belum").
 * Sumber utama baris 📅 Tanggal — visitasi ber-penanda Thanksgiving cuma
 * cadangan kalau belum diisi (lihat pemakainya).
 */
function plannedThanksgiving(thanksgivingDayId: string | null | undefined): Date | null {
  return thanksgivingDayId ? dayIdToDate(thanksgivingDayId) : null;
}

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
  /** Tanggal Thanksgiving tiap CL (isian CL, tahun apa pun; null = belum),
      urutan `leaders`. */
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
 * pertemuan. Baris 📅 Tanggal: tanggal yang DIISI di data CL
 * (thanksgivingDayId, tahun apa pun) menang; kalau belum diisi, dipakai
 * visitasi tahun itu yang jenisnya Thanksgiving atau diberi penanda 🎉 (yang
 * paling awal), sementara hitungannya tetap masuk jenis aslinya.
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
  const diisi = leaders.map((l) => plannedThanksgiving(l.thanksgivingDayId));
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
    thanksgiving: thanksgiving.map((d, i) => diisi[i] ?? d),
    planned,
  };
}

// ======================= Rekap SATU CORE (untuk PDF-nya) =======================

export type LeaderRecapRow = {
  kind: MeetingKind;
  /** Tanggal tiap pertemuan SELESAI jenis ini dengan CL ini, urut naik. */
  dates: Date[];
};

export type LeaderRecap = {
  year: number;
  /** Satu baris per jenis pertemuan, urutan MEETING_KINDS. */
  rows: LeaderRecapRow[];
  /** Seluruh pertemuan selesai tahun itu dengan CL ini. */
  total: number;
  /** Tanggal Thanksgiving CL ini: isian CL (tahun apa pun), atau yang paling
      awal dari visitasinya tahun itu; null = belum. */
  thanksgiving: Date | null;
  /** Jadwal tahun itu yang BELUM selesai, urut naik: masih menunggu / terlewat. */
  upcoming: { kind: MeetingKind; date: Date }[];
};

/**
 * Rekap satu tahun dari sudut pandang SATU CL — isi PDF yang dikirim ke CORE
 * itu sendiri. Aturannya sama dengan tabel di layar (visitationRecap): yang
 * dihitung hanya yang ✅ selesai, acara gabungan tetap sebuah pertemuan,
 * Thanksgiving = tanggal yang diisi di data CL (`thanksgivingDayId`, tahun
 * apa pun), kalau belum diisi yang paling awal dari visitasinya. Bedanya, di
 * sini TANGGALNYA ikut: "3× Visitasi CORE" tanpa tanggal tidak berarti
 * apa-apa buat yang menerima.
 */
export function leaderRecap(
  visitations: Visitation[],
  leaderId: string,
  year: number,
  thanksgivingDayId: string | null = null,
): LeaderRecap {
  const rows: LeaderRecapRow[] = MEETING_KINDS.map((k) => ({ kind: k.key, dates: [] }));
  const upcoming: LeaderRecap['upcoming'] = [];
  let thanksgiving: Date | null = null;

  const urut = [...visitations].sort((a, b) => a.date.toMillis() - b.date.toMillis());
  for (const v of urut) {
    if (!v.leaderIds.includes(leaderId)) continue;
    const d = v.date.toDate();
    if (d.getFullYear() !== year) continue;
    if (!v.done) {
      upcoming.push({ kind: v.kind, date: d });
      continue;
    }
    (rows.find((r) => r.kind === v.kind) ?? rows[0]).dates.push(d);
    const syukur = v.kind === 'thanksgiving' || v.thanksgiving;
    if (syukur && (!thanksgiving || d.getTime() < thanksgiving.getTime())) thanksgiving = d;
  }

  return {
    year,
    rows,
    total: rows.reduce((s, r) => s + r.dates.length, 0),
    thanksgiving: plannedThanksgiving(thanksgivingDayId) ?? thanksgiving,
    upcoming,
  };
}
