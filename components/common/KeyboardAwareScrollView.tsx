import { ScrollView, type ScrollViewProps } from 'react-native';

// ScrollView "sadar-keyboard" untuk layar NON-modal yang punya textbox.
// Ganti <ScrollView> jadi <KeyboardAwareScrollView> — prop lain (mis.
// contentContainerStyle, style) tetap dioper seperti biasa.
//
// - automaticallyAdjustKeyboardInsets: khas iOS — konten yang difokuskan
//   (TextInput) otomatis naik di atas keyboard, jadi tidak tertutup.
// - keyboardShouldPersistTaps="handled": tombol tetap bisa ditekan sekali
//   walau keyboard sedang terbuka (tanpa harus menutup keyboard dulu).
// - keyboardDismissMode="interactive": seret daftar ke bawah untuk menutup
//   keyboard secara mulus.
//
// (Sheet/dialog TIDAK perlu ini — SheetModal & form modal sudah pakai
//  KeyboardAvoidingView sendiri.)
export function KeyboardAwareScrollView(props: ScrollViewProps) {
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      automaticallyAdjustKeyboardInsets
      {...props}
    />
  );
}
