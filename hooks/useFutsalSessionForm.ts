import { useState } from 'react';

import { useAuth } from '@/contexts/auth';
import { useFormSave } from '@/hooks/useFormSave';
import { dayIdToDate, groupDigits, parseAmount, dayId as toDayId } from '@/lib/format';
import {
  gangMembers,
  lastSession,
  newFutsalId,
  saveFutsal,
  type FutsalData,
  type FutsalGangKey,
  type FutsalSession,
} from '@/lib/futsal';

/**
 * Formulir jadwal main — SATU isian, dipakai dua layar.
 *
 * Sub-tab Fun Futsal memakainya untuk menjadwalkan & mengubah pertandingan
 * terdekat; halaman Jadwal Main memakainya untuk seluruh daftar (termasuk
 * riwayat, yang sekarang tinggal di sana). Menyalin formulirnya ke layar kedua
 * berarti dua tempat yang harus ikut berubah tiap kali satu kolom bertambah —
 * dan yang pertama terlupakan biasanya bukan kolomnya, melainkan aturan
 * penyimpanannya (siapa yang otomatis masuk squad, apa yang diwarisi dari sesi
 * terakhir).
 *
 * Isian & tombolnya sendiri ada di components/friends/FutsalSessionSheet.tsx;
 * hook ini cuma memegang isinya. Pemisahan itu yang membuat state-nya tetap
 * tinggal di layar — pola yang sama dengan formulir lain di app ini — jadi
 * "buka formulir" tetap satu panggilan fungsi, bukan efek yang harus dijaga.
 */
export function useFutsalSessionForm(data: FutsalData, gang: FutsalGangKey) {
  const { user } = useAuth();
  const { busy, formError, setFormError, save, remove } = useFormSave();
  const now = new Date();

  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<FutsalSession | null>(null);
  const [tanggal, setTanggal] = useState(now);
  const [jam, setJam] = useState(now);
  const [jamSelesai, setJamSelesai] = useState(now);
  const [venue, setVenue] = useState('');
  const [maps, setMaps] = useState('');
  const [bank, setBank] = useState('');
  const [fee, setFee] = useState('');
  const [catatan, setCatatan] = useState('');

  /** "18.00" + 2 → "20.00" (mentok 23.59, tidak pernah lewat tengah malam). */
  function tambahJam(teks: string, jamTambahan: number): string {
    const [j, m] = teks.split('.').map((n) => Number(n) || 0);
    const total = Math.min(j * 60 + m + jamTambahan * 60, 23 * 60 + 59);
    return `${String(Math.floor(total / 60)).padStart(2, '0')}.${String(
      total % 60,
    ).padStart(2, '0')}`;
  }

  /** Jam "20.00" → Date hari ini pada jam itu (isian jam memakai Date). */
  function keJam(teks: string): Date {
    const [j, m] = teks.split('.').map((n) => Number(n) || 0);
    const t = new Date(now);
    t.setHours(j, m, 0, 0);
    return t;
  }

  /**
   * Buka formulir KOSONG.
   *
   * Jam, lapangan & iuran diwarisi dari sesi terakhir: futsal rutin hampir
   * selalu di jam & lapangan yang sama, jadi mengetik ulang tiap dua minggu itu
   * pekerjaan yang tidak perlu ada.
   */
  function bukaBaru(dariTanggal?: string) {
    const terakhir = lastSession(data.sessions, gang);
    setEdit(null);
    setTanggal(dariTanggal ? dayIdToDate(dariTanggal) : now);
    setJam(keJam(terakhir?.time ?? '20.00'));
    // Lama mainnya hampir selalu sama tiap sesi, jadi ikut diwarisi. Kalau
    // sesi terakhir belum punya jam selesai, dipakai 2 jam sesudah mulainya —
    // durasi sewa lapangan yang paling lazim.
    setJamSelesai(
      keJam(terakhir?.endTime ?? tambahJam(terakhir?.time ?? '20.00', 2)),
    );
    setVenue(terakhir?.venue ?? '');
    setMaps(terakhir?.mapsUrl ?? '');
    setBank(terakhir?.bank ?? '');
    setFee(terakhir?.fee ? groupDigits(String(terakhir.fee)) : '');
    setCatatan('');
    setFormError(null);
    setOpen(true);
  }

  /** Buka formulir berisi sesi yang mau diubah. */
  function bukaUbah(s: FutsalSession) {
    setEdit(s);
    setTanggal(dayIdToDate(s.dayId));
    setJam(keJam(s.time));
    setJamSelesai(keJam(s.endTime ?? tambahJam(s.time, 2)));
    setVenue(s.venue);
    setMaps(s.mapsUrl ?? '');
    setBank(s.bank ?? '');
    setFee(s.fee ? groupDigits(String(s.fee)) : '');
    setCatatan(s.note);
    setFormError(null);
    setOpen(true);
  }

  async function simpan() {
    if (!user || busy) return;
    if (!venue.trim()) {
      setFormError('Lapangannya diisi dulu — itu yang paling sering ditanya di grup.');
      return;
    }
    // Roda jamnya sudah menolak jam yang lebih awal (minimumDate), tapi data
    // lama & Android tidak lewat situ — jadi diperiksa lagi di sini.
    if (menit(jamSelesai) <= menit(jam)) {
      setFormError('Jam selesainya harus lebih malam dari jam mulai.');
      return;
    }
    const isi: FutsalSession = {
      id: edit?.id ?? newFutsalId(now),
      gang,
      dayId: toDayId(tanggal),
      time: jamTeks(jam),
      endTime: jamTeks(jamSelesai),
      venue: venue.trim(),
      mapsUrl: maps.trim(),
      bank: bank.trim(),
      fee: parseAmount(fee),
      // Sesi baru: SEMUA anggota geng langsung masuk squad. Menghapus yang
      // berhalangan jauh lebih cepat daripada mencentang satu per satu, dan
      // absen kosong bikin sesinya terlihat batal padahal belum.
      squad: edit?.squad ?? gangMembers(data, gang).map((m) => m.id),
      paid: edit?.paid ?? [],
      games: edit?.games ?? [],
      note: catatan.trim(),
    };
    await save(async () => {
      await saveFutsal(user.uid, {
        ...data,
        sessions: edit
          ? data.sessions.map((s) => (s.id === edit.id ? isi : s))
          : [...data.sessions, isi],
      });
      setOpen(false);
    });
  }

  /** Date → "18.00" (bentuk yang disimpan). */
  function jamTeks(d: Date): string {
    return `${String(d.getHours()).padStart(2, '0')}.${String(
      d.getMinutes(),
    ).padStart(2, '0')}`;
  }

  /** Menit sejak 00.00 — untuk membandingkan dua jam. */
  function menit(d: Date): number {
    return d.getHours() * 60 + d.getMinutes();
  }

  async function hapus() {
    if (!user || !edit || busy) return;
    await remove(async () => {
      await saveFutsal(user.uid, {
        ...data,
        sessions: data.sessions.filter((s) => s.id !== edit.id),
      });
      setOpen(false);
    });
  }

  return {
    open,
    edit,
    tanggal,
    setTanggal,
    jam,
    setJam,
    jamSelesai,
    setJamSelesai,
    venue,
    setVenue,
    maps,
    setMaps,
    bank,
    setBank,
    fee,
    setFee,
    catatan,
    setCatatan,
    busy,
    formError,
    bukaBaru,
    bukaUbah,
    simpan,
    hapus,
    tutup: () => setOpen(false),
  };
}

export type FutsalSessionForm = ReturnType<typeof useFutsalSessionForm>;
