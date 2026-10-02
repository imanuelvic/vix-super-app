import { useState } from 'react';

import { useBusyTask } from '@/hooks/useBusyTask';
import { openInstagram, photoErrorMessage, savePngToPhotos } from '@/lib/shareImage';

/** Dua tombol di bawah pratinjau kartu: simpan saja, atau simpan lalu buka Instagram. */
export type PhotoMode = 'save' | 'ig';

/**
 * 💾 Simpan kartu ke Foto, lalu (kalau diminta) 📸 buka Instagram.
 *
 * Tiga layar dulu menulis blok yang sama persis — Bagikan Ayat 📖
 * (bible-story), Pause & Pray 🙏, dan Generate Feed 🖼️ (reflection-feed):
 *
 *   - dua tombol, SATU proses: yang satu jalan, yang lain tidak bisa ditekan
 *     (useBusyTask), dan pesan gagalnya dari `photoErrorMessage`;
 *   - gambar yang PERSIS sama tidak disimpan dua kali ke galeri — menekan
 *     "Buka Instagram" sesudah "Simpan" cuma membuka Instagram;
 *   - urutannya selalu simpan DULU baru buka Instagram: iOS tidak mengizinkan
 *     app lain menaruh gambar langsung ke dalam Instagram, jadi gambarnya
 *     harus sudah ada di galeri — di sana ia jadi foto paling baru.
 *
 * `kunci` = gambar yang SEDANG tampil (rupa + isinya). Berubah sedikit saja
 * (ganti rupa, ubah satu huruf) berarti gambar baru, jadi boleh disimpan lagi.
 */
export function useSaveToPhotos({
  kunci,
  buatPng,
  namaBerkas,
  instagram,
  setError,
  sesudah,
}: {
  kunci: string;
  /** Dari useCardPng — menggambar kartunya jadi PNG ukuran asli. */
  buatPng: () => Promise<string>;
  /** Nama berkasnya di Foto, mis. `storyFileName(todayId, acuan)`. */
  namaBerkas: string;
  /** 'story' = kamera Story · 'app' = Instagram biasa (untuk Feed). */
  instagram: 'story' | 'app';
  setError: (pesan: string | null) => void;
  /** Langkah tambahan SESUDAH gambarnya jadi (gagal di tengah = tidak jalan). */
  sesudah?: () => Promise<void>;
}) {
  const kerja = useBusyTask<PhotoMode>();
  // Gambar mana yang SUDAH tersimpan di Foto (kunci gambarnya, null = belum ada).
  const [saved, setSaved] = useState<string | null>(null);

  /** Simpan ke Foto — dilewati kalau gambar yang persis sama sudah tersimpan. */
  async function simpanKeFoto(): Promise<void> {
    if (saved === kunci) return;
    await savePngToPhotos(await buatPng(), namaBerkas);
    setSaved(kunci);
  }

  async function jalankan(mode: PhotoMode) {
    await kerja.run({
      key: mode,
      start: () => setError(null),
      task: async () => {
        await simpanKeFoto();
        if (mode === 'ig') await openInstagram(instagram);
        if (sesudah) await sesudah();
      },
      fail: (e) => setError(photoErrorMessage(e)),
    });
  }

  return {
    /** Tombol mana yang sedang bekerja; `null` = tidak ada. */
    busy: kerja.busy,
    jalankan,
    /** Gambar yang sedang tampil sudah ada di Foto. */
    tersimpan: saved === kunci,
  };
}
