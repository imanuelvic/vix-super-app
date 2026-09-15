import { useState } from 'react';

import { useAuth } from '@/contexts/auth';
import { useFormSave } from '@/hooks/useFormSave';
import {
  formatDecimal,
  groupDigits,
  parseAmount,
  parseDecimal,
} from '@/lib/format';
import {
  newPurchaseId,
  saveTokenPurchases,
  TOKEN_PLATFORMS,
  type TokenPurchase,
} from '@/lib/token';

import { Timestamp } from 'firebase/firestore';

/**
 * Formulir beli token ⚡ — SATU isian, dipakai dua layar.
 *
 * Sub-tab Token memakainya untuk tombol "Beli Token" (mencatat pembelian
 * baru); halaman Pembelian Token (app/token-purchases.tsx) memakainya untuk
 * mengubah & menghapus pembelian lama dari daftarnya. Pola & alasannya sama
 * dengan useFutsalSessionForm: menyalin formulirnya ke layar kedua berarti dua
 * tempat yang harus ikut berubah tiap satu kolom bertambah.
 *
 * Isian & tombolnya ada di components/residence/TokenPurchaseSheet.tsx; hook
 * ini cuma memegang isinya, jadi "buka formulir" tetap satu panggilan fungsi.
 */
export function useTokenPurchaseForm(purchases: TokenPurchase[]) {
  const { user } = useAuth();
  const { busy, formError, setFormError, save, remove } = useFormSave();

  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<TokenPurchase | null>(null);
  const [tanggal, setTanggal] = useState(new Date());
  const [biaya, setBiaya] = useState('');
  const [kwh, setKwh] = useState('');
  const [platform, setPlatform] = useState(TOKEN_PLATFORMS[0]);
  const [catatan, setCatatan] = useState('');

  /** Buka formulir KOSONG. */
  function bukaBaru() {
    setEdit(null);
    setTanggal(new Date());
    setBiaya('');
    setKwh('');
    setPlatform(TOKEN_PLATFORMS[0]);
    setCatatan('');
    setFormError(null);
    setOpen(true);
  }

  /** Buka formulir berisi pembelian yang mau diubah. */
  function bukaUbah(p: TokenPurchase) {
    setEdit(p);
    setTanggal(p.date.toDate());
    setBiaya(groupDigits(String(p.cost)));
    setKwh(formatDecimal(p.kwh));
    setPlatform(p.platform || TOKEN_PLATFORMS[0]);
    setCatatan(p.note);
    setFormError(null);
    setOpen(true);
  }

  async function simpan() {
    if (!user || busy) return;
    const cost = parseAmount(biaya);
    const jumlahKwh = parseDecimal(kwh);
    if (cost <= 0 || jumlahKwh <= 0) {
      setFormError('Biaya & kWh-nya diisi dua-duanya, itu yang jadi harga per kWh.');
      return;
    }
    const data: TokenPurchase = {
      id: edit?.id ?? newPurchaseId(),
      date: Timestamp.fromDate(tanggal),
      cost,
      kwh: jumlahKwh,
      platform,
      note: catatan.trim(),
    };
    await save(async () => {
      await saveTokenPurchases(
        user.uid,
        edit
          ? purchases.map((p) => (p.id === edit.id ? data : p))
          : [...purchases, data],
      );
      setOpen(false);
    });
  }

  /** Hapus PERMANEN — daftarnya ditulis ulang tanpa pembelian ini. */
  async function hapus() {
    if (!user || !edit || busy) return;
    await remove(async () => {
      await saveTokenPurchases(
        user.uid,
        purchases.filter((p) => p.id !== edit.id),
      );
      setOpen(false);
    });
  }

  return {
    open,
    edit,
    tanggal,
    setTanggal,
    biaya,
    setBiaya,
    kwh,
    setKwh,
    platform,
    setPlatform,
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

export type TokenPurchaseForm = ReturnType<typeof useTokenPurchaseForm>;
