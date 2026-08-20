import { Timestamp } from 'firebase/firestore';
import { useState } from 'react';

import { isMultiLeaderKind, type MeetingKind, type Visitation } from '@/lib/core';
import { daysBetween } from '@/lib/format';

// Isian form satu pertemuan — dipakai DUA layar: sub-tab Pertemuan (CORE) &
// Riwayat Pertemuan 🕘. Datanya memang satu, cuma disunting dari dua tempat,
// jadi aturannya (kapan Thanksgiving diabaikan, kapan "sudah selesai" dipaksa
// mati, sisa satu CORE saat pindah dari jenis gabungan) ditaruh di sini supaya
// tidak mungkin berbeda antar-layar.

export type VisitationForm = ReturnType<typeof useVisitationForm>;

export function useVisitationForm() {
  const [kind, setKind] = useState<MeetingKind>('visitasi');
  const [leaderIds, setLeaderIds] = useState<string[]>([]);
  const [thanksgiving, setThanksgiving] = useState(false);
  const [date, setDate] = useState(new Date());
  const [agenda, setAgenda] = useState('');
  const [note, setNote] = useState('');
  const [done, setDone] = useState(false);

  /** Acara gabungan → pemilih CORE-nya jadi centang banyak. */
  const multiLeader = isMultiLeaderKind(kind);
  /** Tanggalnya masih di masa depan → toggle "sudah selesai" disembunyikan. */
  const futureDate = daysBetween(new Date(), date) > 0;

  /** Isi form dari jadwal yang sudah ada (mode ubah). */
  function fill(v: Visitation) {
    setKind(v.kind);
    setLeaderIds(v.leaderIds);
    setThanksgiving(v.thanksgiving);
    setDate(v.date.toDate());
    setAgenda(v.agenda);
    setNote(v.note);
    setDone(v.done);
  }

  /** Kosongkan form untuk jadwal BARU; `leaderId` = pilihan awal CORE-nya. */
  function reset(leaderId?: string) {
    setKind('visitasi');
    setLeaderIds(leaderId ? [leaderId] : []);
    setThanksgiving(false);
    setDate(new Date());
    setAgenda('');
    setNote('');
    setDone(false);
  }

  /**
   * Ganti jenis acara. Kalau pindah dari jenis gabungan ke jenis biasa, sisakan
   * SATU CORE saja — kalau tidak, pilihan ganda ikut tersimpan diam-diam
   * padahal pemilihnya sudah kembali jadi tunggal.
   */
  function changeKind(k: MeetingKind) {
    setKind(k);
    if (!isMultiLeaderKind(k)) setLeaderIds((ids) => ids.slice(0, 1));
  }

  /** Centang / hapus centang satu CORE Leader (mode gabungan). */
  function toggleLeader(id: string) {
    setLeaderIds((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
    );
  }

  /**
   * Bagian Visitation yang berasal dari form. `id` & `pdfSentDayId` sengaja
   * TIDAK ikut: keduanya milik jadwalnya, bukan formnya.
   */
  function payload(): Omit<Visitation, 'id' | 'pdfSentDayId'> {
    return {
      kind,
      leaderIds,
      // Kalau jenisnya memang Thanksgiving, penanda tambahannya tak perlu.
      thanksgiving: kind === 'thanksgiving' ? false : thanksgiving,
      date: Timestamp.fromDate(date),
      agenda: agenda.trim(),
      note: note.trim(),
      // Jadwal masa depan dipaksa belum divisit — toggle-nya juga disembunyikan.
      done: futureDate ? false : done,
    };
  }

  return {
    kind,
    leaderIds,
    thanksgiving,
    date,
    agenda,
    note,
    done,
    setLeaderIds,
    setThanksgiving,
    setDate,
    setAgenda,
    setNote,
    setDone,
    multiLeader,
    futureDate,
    fill,
    reset,
    changeKind,
    toggleLeader,
    payload,
  };
}
