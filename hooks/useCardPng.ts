import { useCallback, useRef } from 'react';
import type Svg from 'react-native-svg';

/**
 * Kartu SVG → PNG base64 (tanpa awalan `data:`) pada ukuran ASLINYA.
 *
 * Dipakai keempat layar "kartu jadi gambar": Bagikan Ayat 📖, Pause & Pray 🙏,
 * Daily Reflection 📓, & Bagikan Reminder 🕊️. Keempatnya dulu menyalin fungsi
 * yang sama persis, cuma berbeda angka lebar & tingginya.
 *
 * `width` & `height` = ukuran KANVAS yang diminta (1080×1920, 1080×1350,
 * 1080×1080), bukan ukuran pratinjau di layar. Kartunya memang harus dirender
 * seukuran aslinya lalu dikecilkan dengan transform; alasan lengkapnya ada di
 * catatan panjang lib/shareImage.ts, dan <CardPreview/> yang mengurusnya.
 */
export function useCardPng(
  width: number,
  height: number,
): { svgRef: React.RefObject<Svg | null>; buatPng: () => Promise<string> } {
  const svgRef = useRef<Svg>(null);
  const buatPng = useCallback(
    () =>
      new Promise<string>((resolve, reject) => {
        const svg = svgRef.current;
        if (!svg) {
          reject(new Error('kartu belum siap'));
          return;
        }
        svg.toDataURL((data) => resolve(data), { width, height });
      }),
    [width, height],
  );
  return { svgRef, buatPng };
}
