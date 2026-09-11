import {
  createContext,
  useCallback,
  useContext,
  useRef,
  type RefObject,
} from 'react';
import {
  ScrollView,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewProps,
} from 'react-native';

// ScrollView yang MENAMPAKKAN picker tanggal/jam begitu ia dibuka.
//
// Masalahnya: di iOS spinner tanggal muncul INLINE, tepat di bawah kolomnya.
// Kalau kolom itu ada di bagian bawah form, spinnernya lahir di luar layar —
// jadi yang di-click membuka sesuatu yang tidak kelihatan, dan kamu harus
// menggulung sendiri untuk menemukan roda tanggalnya.
//
// Di sini wadahnya yang bergerak menghampiri picker, bukan sebaliknya:
// begitu picker tergambar, ia melapor lewat `usePickerReveal()`, lalu wadah
// ini menggulung SECUKUPNYA — hanya sebanyak bagian yang belum terlihat.
// Kalau picker-nya memang sudah terlihat utuh, tidak ada yang bergeser sama
// sekali; menggulung "supaya rapi" padahal tidak perlu justru terasa seperti
// layar yang bergerak sendiri.
//
// Kenapa lewat context, bukan prop: <DateField> dipakai di 32 berkas dan
// biasanya bersarang beberapa lapis di dalam form. Mengoper ref wadah dari
// tiap pemakainya berarti 32 kesempatan untuk lupa.

// Jarak sisa di bawah picker supaya tidak mepet ke tepi sheet.
const JARAK = 12;

type Reveal = (picker: View | null) => void;

const Ctx = createContext<Reveal | null>(null);

/**
 * Dipakai <DateField> & <TimeField> untuk melapor "picker-ku sudah tergambar".
 * null = kolomnya sedang TIDAK di dalam wadah yang bisa digulung (mis. form
 * pendek yang muat sekali layar) — panggil dengan `?.` dan biarkan saja.
 */
export function usePickerReveal(): Reveal | null {
  return useContext(Ctx);
}

export function PickerScrollView({
  children,
  onScroll,
  onLayout,
  ...rest
}: ScrollViewProps) {
  const ref = useRef<ScrollView>(null);
  // Ref ke View DI DALAM ScrollView — inilah koordinat isi yang sebenarnya.
  // Mengukur relatif ke sini membuat sedalam apa pun picker bersarang,
  // angkanya tetap benar; `layout.y` dari onLayout tidak bisa dipakai karena
  // ia cuma relatif ke induk TERDEKAT.
  const innerRef = useRef<View>(null);
  const offsetY = useRef(0);
  const tinggiLayar = useRef(0);

  const reveal = useCallback<Reveal>((picker) => {
    const inner = innerRef.current;
    // Tinggi wadahnya belum terukur → belum ada yang bisa dihitung. Tidak apa:
    // onLayout picker-nya akan memanggil lagi sesudah itu.
    if (!picker || !inner || tinggiLayar.current === 0) return;
    picker.measureLayout(
      inner,
      (_x, y, _lebar, tinggi) => {
        // Yang terlihat sekarang: [offsetY, offsetY + tinggi layar].
        const kurang =
          y + tinggi + JARAK - (offsetY.current + tinggiLayar.current);
        if (kurang <= 0) return; // sudah terlihat utuh — jangan digeser
        ref.current?.scrollTo({ y: offsetY.current + kurang, animated: true });
      },
      () => {
        // Gagal mengukur (picker keburu ditutup) — diamkan saja.
      },
    );
  }, []);

  return (
    <Ctx.Provider value={reveal}>
      <ScrollView
        {...rest}
        ref={ref}
        // Tipe RN menulis `innerViewRef` sebagai RefObject<View> tanpa null,
        // padahal ref React selalu lahir null. Cast-nya menutup celah tipe itu
        // saja — tak ada perilaku yang dipaksakan.
        innerViewRef={innerRef as RefObject<View>}
        scrollEventThrottle={16}
        onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
          offsetY.current = e.nativeEvent.contentOffset.y;
          onScroll?.(e);
        }}
        onLayout={(e: LayoutChangeEvent) => {
          tinggiLayar.current = e.nativeEvent.layout.height;
          onLayout?.(e);
        }}>
        {children}
      </ScrollView>
    </Ctx.Provider>
  );
}
