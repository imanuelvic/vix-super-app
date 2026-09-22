import { lastSharedTo, markSharedToLeader, type CoreLeader, type ShareDocKind, type ShareLog } from './core';
import { openWhatsAppChat } from './whatsapp';

// Bagikan sebuah PDF ke SATU CORE Leader, lalu susul chat WhatsApp-nya.
// Dipakai dua jalur:
//   • sheet "Bagikan ke CORE Leader" (Rekap Visitasi: pilih CL-nya dulu);
//   • tombol share di layar milik satu CL (Wheel of Life 🎡 & Timeline 📍,
//     22 Sep 2026): langsung ke orangnya, tanpa memilih.
//
// Urutannya sama di keduanya:
//   1. PDF-nya dibuat pemanggil (`share`) & share sheet iOS terbuka → pilih
//      WhatsApp → chat CL-nya, kirim;
//   2. sesudah share sheet tertutup, tanggalnya dicatat (lib/core.ts, shares);
//      gagal mencatat diabaikan (PDF-nya sudah terlanjur terkirim);
//   3. chat WhatsApp ke NOMOR CL itu dibuka dengan pesan pengantar.
// iOS tidak mengizinkan berkas didorong langsung ke satu chat lewat tautan;
// yang bisa dituju lewat nomor cuma chat-nya (wa.me), makanya dua langkah.

/** "Halo David 💚 aku barusan kirim PDF Wheel of Life … ya, dicek yaa 🙏😊" */
export function sharePesanPengantar(l: CoreLeader, doc: string): string {
  return `Halo ${l.name} ${l.heart} aku barusan kirim PDF ${doc} ya, dicek yaa 🙏😊`;
}

export async function shareDocToLeader(input: {
  uid: string;
  leader: CoreLeader;
  kind: ShareDocKind;
  /** Nama dokumennya untuk manusia, mis. "Timeline 💚 David". */
  doc: string;
  log: ShareLog | null;
  /** Buat PDF-nya & buka share sheet; `lastShared` untuk dicetak di kop. */
  share: (leader: CoreLeader, lastShared: Date | null) => Promise<void>;
  /** Chat WhatsApp gagal dibuka (WhatsApp tidak terpasang / nomor salah). */
  onWaError: () => void;
}): Promise<void> {
  const { uid, leader, kind, doc, log, share, onWaError } = input;
  await share(leader, lastSharedTo(log, leader.id, kind));
  markSharedToLeader(uid, leader.id, kind, new Date()).catch(() => undefined);
  if (leader.phone) {
    await openWhatsAppChat(leader.phone, sharePesanPengantar(leader, doc), onWaError);
  }
}
