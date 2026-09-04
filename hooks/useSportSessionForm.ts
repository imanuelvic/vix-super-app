import { useState } from 'react';

import { useAuth } from '@/contexts/auth';
import { useFormSave } from '@/hooks/useFormSave';
import { dayIdToDate, groupDigits, parseAmount, dayId as toDayId } from '@/lib/format';
import {
  gangMembers,
  lastSession,
  newSportId,
  saveSport,
  type SportData,
  type SportGangKey,
  type SportSession,
} from '@/lib/sport';

/**
 * Formulir jadwal main — SATU isian, dipakai dua layar.
 *
 * Sub-tab Fun Sport memakainya untuk menjadwalkan & mengubah pertandingan
 * terdekat; halaman Jadwal Main memakainya untuk seluruh daftar (termasuk
 * riwayat, yang sekarang tinggal di sana). Menyalin formulirnya ke layar kedua
 * berarti dua tempat yang harus ikut berubah tiap kali satu kolom bertambah —
 * dan yang pertama terlupakan biasanya bukan kolomnya, melainkan aturan
 * penyimpanannya (siapa yang otomatis masuk squad, apa yang diwarisi dari sesi
 * terakhir).
 *
 * Isian & tombolnya sendiri ada di components/friends/SportSessionSheet.tsx;
 * hook ini cuma memegang isinya. Pemisahan itu yang membuat state-nya tetap
 * tinggal di layar — pola yang sama dengan formulir lain di app ini — jadi
 * "buka formulir" tetap satu panggilan fungsi, bukan efek yang harus dijaga.
 */
export function useSportSessionForm(data: SportData, gang: SportGangKey) {
  const { user } = useAuth();
  const { busy, formError, setFormError, save, remove } = useFormSave();
  const now = new Date();

  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<SportSession | null>(null);
  const [tanggal, setTanggal] = useState(now);
  const [jam, setJam] = useState(now);
  const [venue, setVenue] = useState('');
  const [fee, setFee] = useState('');
  const [catatan, setCatatan] = useState('');

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
    setVenue(terakhir?.venue ?? '');
    setFee(terakhir?.fee ? groupDigits(String(terakhir.fee)) : '');
    setCatatan('');
    setFormError(null);
    setOpen(true);
  }

  /** Buka formulir berisi sesi yang mau diubah. */
  function bukaUbah(s: SportSession) {
    setEdit(s);
    setTanggal(dayIdToDate(s.dayId));
    setJam(keJam(s.time));
    setVenue(s.venue);
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
    const isi: SportSession = {
      id: edit?.id ?? newSportId(now),
      gang,
      dayId: toDayId(tanggal),
      time: `${String(jam.getHours()).padStart(2, '0')}.${String(
        jam.getMinutes(),
      ).padStart(2, '0')}`,
      venue: venue.trim(),
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
      await saveSport(user.uid, {
        ...data,
        sessions: edit
          ? data.sessions.map((s) => (s.id === edit.id ? isi : s))
          : [...data.sessions, isi],
      });
      setOpen(false);
    });
  }

  async function hapus() {
    if (!user || !edit || busy) return;
    await remove(async () => {
      await saveSport(user.uid, {
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
    venue,
    setVenue,
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

export type SportSessionForm = ReturnType<typeof useSportSessionForm>;
