import { useCallback, useEffect, useState } from 'react';
import { Keyboard } from 'react-native';

import {
  closePickers,
  nextPickerId,
  openPicker,
  subscribePicker,
} from '@/components/common/pickerBus';

/**
 * Satu "slot" picker di papan koordinasi bersama (components/common/pickerBus).
 *
 * Mengurus tiga hal yang dulu disalin utuh di <DateField> dan <TimeField>:
 *   • mengambil id unik SEKALI seumur komponen,
 *   • menutup diri kalau picker lain dibuka,
 *   • sakelar buka/tutup yang sekalian menutup keyboard.
 *
 * Idnya diambil lewat useState dengan initializer malas — BUKAN useRef yang
 * ditulis saat render. Menulis ref saat render itu terlarang di React Compiler
 * (yang memang menyala di app ini): render boleh dijalankan ulang atau dibuang,
 * jadi efek sampingnya bisa terjadi dua kali atau tidak sama sekali.
 * `useState(nextPickerId)` dijamin memanggilnya tepat sekali.
 */
export function usePickerSlot(): { open: boolean; toggle: () => void } {
  const [open, setOpen] = useState(false);
  const [myId] = useState(nextPickerId);

  useEffect(
    () => subscribePicker((openId) => setOpen(openId === myId)),
    [myId],
  );

  const toggle = useCallback(() => {
    if (open) {
      setOpen(false);
      closePickers();
    } else {
      // Tutup keyboard teks dulu supaya spinner tidak menumpuk dengan keyboard.
      Keyboard.dismiss();
      // openPicker menutup picker lain lewat subscriber, lalu membuka ini.
      setOpen(true);
      openPicker(myId);
    }
  }, [open, myId]);

  return { open, toggle };
}
