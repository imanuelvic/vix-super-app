// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', '.expo/*', 'node_modules/*'],
  },
  {
    rules: {
      // ── react-hooks/immutability DIMATIKAN, dan ini alasannya ──────────────
      //
      // Aturan ini datang bersama eslint-plugin-react-hooks v7 (ikut Expo SDK
      // 57). Ia melarang "mengubah nilai yang dianggap React tidak boleh
      // diubah". Masalahnya: ia tidak mengenali dua hal yang di app ini memang
      // SAH diubah, dan keduanya justru API resmi:
      //
      //   1. Shared value Reanimated — `scale.value = withSpring(...)`.
      //      useSharedValue sengaja mengembalikan kotak yang hidup DI LUAR
      //      siklus render React; mengubahnya tidak pernah memicu render, dan
      //      itulah alasan animasi app ini bisa jalan di UI thread tanpa
      //      membebani React. Dipakai PressableScale (tombol & kartu di SELURUH
      //      app), SheetModal, dan seret-tugas di Reminder.
      //   2. Menulis `ref.current` di dalam event handler — yang memang boleh.
      //
      // Ini false positive yang SUDAH diakui tim React, dan saran mereka
      // sendiri adalah mematikannya dulu untuk kasus shared value:
      //   https://github.com/react/react/issues/29641
      //   https://github.com/facebook/react/issues/34955
      //   https://github.com/expo/expo/discussions/41724
      //
      // Sudah diperiksa satu per satu: KESEPULUH pelanggaran di proyek ini
      // masuk dua kategori di atas — tidak ada satu pun bug sungguhan. Menuruti
      // aturannya berarti membongkar kode animasi yang sudah benar, jadi yang
      // dimatikan aturannya, bukan animasinya.
      //
      // Nyalakan lagi kalau upstream sudah mengenali shared value.
      'react-hooks/immutability': 'off',
    },
  },
]);
