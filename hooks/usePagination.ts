import { useState } from 'react';

// Pagination sisi-klien untuk daftar yang datanya sudah ada di memori.
// Kembalikan potongan halaman + kontrolnya. `currentPage` selalu dijepit ke
// rentang valid (kalau daftar mengecil, halaman tidak "nyangkut" di luar batas).
//
// Layar yang ingin scroll balik ke atas tiap ganti halaman cukup pasang
// `<ScrollView key={currentPage}>` sendiri (sebagian layar sengaja TIDAK, mis.
// CheckupTab, agar form yang sedang diisi tidak ter-reset).
export function usePagination<T>(items: T[], size = 10) {
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(items.length / size));
  const currentPage = Math.min(page, pageCount);
  const pageItems = items.slice((currentPage - 1) * size, currentPage * size);
  return { page, setPage, currentPage, pageCount, pageItems };
}
