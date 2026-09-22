import { useState } from 'react';

import { useLiveAll } from '@/hooks/useLiveAll';
import {
  subscribeCoreLeaders,
  subscribeShareLog,
  type CoreLeader,
  type ShareLog,
} from '@/lib/core';

/**
 * CORE Leader PEMILIK sebuah layar (Wheel of Life 🎡 / Timeline 📍 milik satu
 * CL) beserta catatan "terakhir dibagikan" — supaya tombol share layar itu
 * bisa langsung ke orangnya (lib/shareLeader.ts), tanpa sheet pilih CL.
 *
 * Tidak berlangganan apa pun kalau `ownerId` null (roda/timeline milik
 * sendiri) atau `when` salah (PIN belum terbuka). `leader` null = belum
 * termuat / tidak ditemukan → pemanggil memakai bagikan biasa.
 */
export function useOwnerLeader(
  ownerId: string | null,
  when: boolean,
): { leader: CoreLeader | null; log: ShareLog | null } {
  const [leaders, setLeaders] = useState<CoreLeader[]>([]);
  const [log, setLog] = useState<ShareLog | null>(null);
  useLiveAll(
    (uid) => [subscribeCoreLeaders(uid, setLeaders), subscribeShareLog(uid, setLog)],
    { when: when && ownerId !== null },
  );
  return {
    leader: ownerId ? (leaders.find((l) => l.id === ownerId) ?? null) : null,
    log,
  };
}
