import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { SCREEN_CONTENT } from '@/assets/style/layout';
import { PressableScale } from '@/components/common/PressableScale';
import { SheetModal } from '@/components/common/SheetModal';
import { VixText } from '@/components/common/VixText';
import {
  GOSPEL_ACTS,
  GOSPEL_HERE,
  type GospelAct,
} from '@/lib/gospelStory';
import { openYouVersion } from '@/lib/spiritual';

// Tab God's Story ✝️ — lima babak cerita besar Alkitab sebagai TIMELINE.
//
// Kenapa ini bukan sekadar bacaan: lihat komentar panjang di lib/gospelStory.ts.
// Singkatnya, seluruh app ini mengurus hari ini, dan tab ini satu-satunya yang
// memberi tahu hari ini itu bagian dari apa.
//
// ── Bentuknya (29 Sep 2026) ────────────────────────────────────────────
// Garis tegak di tengah, bulatan beremoji di tiap babak, dan papan namanya
// berselang-seling kiri-kanan. Isi lengkap tiap babak (ayat, kutipan, artinya
// hari ini) PINDAH ke modal yang terbuka saat babaknya di-click.
//
// Sebelumnya kelimanya digambar sebagai lima kartu penuh yang berderet, dan
// akibatnya kebalikan dari maksudnya: yang harus terbaca sekali pandang adalah
// URUTAN & LETAKMU di dalamnya, tapi yang memenuhi layar justru isi kelima
// babak sekaligus — jadi harus digulung jauh cuma untuk melihat bahwa ceritanya
// ada lima. Sekarang seluruh ceritanya muat dalam satu layar, dan yang ingin
// dibaca dalam-dalam tinggal di-click.
//
// Babak berjalan (Renewal) tidak lagi diumumkan lewat kartu pembuka "kamu di
// babak Pengudusan". Ia cukup DIBERI WARNA yang berbeda: dalam sebuah timeline,
// satu titik yang berbeda sendiri sudah berarti "kamu di sini" tanpa perlu
// dikalimatkan.
export function GospelStoryTab() {
  const [buka, setBuka] = useState<GospelAct | null>(null);

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={styles.content}>
        {GOSPEL_ACTS.map((a, i) => {
          const here = a.key === GOSPEL_HERE;
          // Berselang-seling kiri-kanan: itu yang membuat deretan ini terbaca
          // sebagai perjalanan, bukan sebagai daftar.
          const kanan = i % 2 === 0;
          const papan = (
            <PressableScale
              style={[styles.papan, here && styles.papanHere]}
              scaleTo={0.97}
              onPress={() => setBuka(a)}>
              <VixText
                heading="bold"
                additionalStyle={here ? styles.namaHere : styles.nama}>
                {a.title}
              </VixText>
              <VixText
                heading="label"
                additionalStyle={here ? styles.namaIdHere : styles.namaId}>
                {a.titleId}
              </VixText>
            </PressableScale>
          );

          return (
            <View key={a.key}>
              {/* Garis penyambung antar-babak. Ceritanya SATU: kalau garisnya
                  hilang, kelima bulatan cuma jadi lima tombol berdekatan. */}
              {i > 0 && <View style={styles.garis} />}

              <View style={styles.baris}>
                {/* Kedua sisi sama-sama `flex: 1`, jadi bulatannya tetap tepat
                    di tengah berapa pun panjang nama babaknya — dan garis
                    tegak di atas & bawahnya benar-benar menyambung, bukan
                    meleset sedikit di babak bernama panjang. */}
                <View style={styles.sisi}>{!kanan ? papan : null}</View>
                <PressableScale
                  style={[styles.bulat, here && styles.bulatHere]}
                  scaleTo={0.92}
                  onPress={() => setBuka(a)}>
                  <VixText additionalStyle={styles.emoji}>{a.emoji}</VixText>
                </PressableScale>
                <View style={styles.sisi}>{kanan ? papan : null}</View>
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* Penjelasan satu babak. Judulnya sudah menyebut babaknya, jadi di
          dalamnya tinggal isinya. */}
      <SheetModal
        visible={buka !== null}
        title={buka ? `${buka.emoji} ${buka.title}` : ''}
        subtitle={buka?.titleId}
        onClose={() => setBuka(null)}>
        {buka ? (
          <View style={styles.isiModal}>
            {/* Tahap keselamatan yang jatuh di babak ini — cuma tiga babak
                terakhir yang punya, jadi barisnya memang tidak selalu ada. */}
            {buka.stage ? (
              <View
                style={[
                  styles.tahap,
                  buka.key === GOSPEL_HERE && styles.tahapHere,
                ]}>
                <VixText
                  heading="label"
                  additionalStyle={
                    buka.key === GOSPEL_HERE
                      ? styles.tahapTeksHere
                      : styles.tahapTeks
                  }>
                  {buka.stage} · {buka.stageId}
                </VixText>
              </View>
            ) : null}

            <VixText heading="paragraph" additionalStyle={styles.ringkas}>
              {buka.summary}
            </VixText>

            {/* Ayatnya bisa di-click → terbuka di YouVersion, sama seperti
                acuan ayat di Revive & Promise. */}
            <PressableScale onPress={() => void openYouVersion(buka.verseRef)}>
              <VixText heading="label" additionalStyle={styles.ayat}>
                📖 {buka.verseRef}
              </VixText>
            </PressableScale>
            <VixText heading="label" additionalStyle={styles.kutipan}>
              “{buka.verseText}”
            </VixText>

            <View style={styles.kiniBox}>
              <VixText heading="label" additionalStyle={styles.kiniText}>
                {buka.now}
              </VixText>
            </View>
          </View>
        ) : null}
      </SheetModal>
    </View>
  );
}

const BULAT = 58;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { ...SCREEN_CONTENT, paddingBottom: 32 },

  // ── Timeline ───────────────────────────────────────────────────────────
  baris: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sisi: { flex: 1 },
  // Garis tegak antar-babak. `alignSelf: 'center'` cukup karena kedua sisi
  // barisnya sama lebar — jadi ia jatuh tepat di bawah bulatannya.
  garis: {
    width: 3,
    height: 22,
    alignSelf: 'center',
    backgroundColor: Color.SPIRITUAL_DARK,
    borderRadius: 2,
  },
  bulat: {
    width: BULAT,
    height: BULAT,
    borderRadius: BULAT / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Color.CONTAINER,
    borderWidth: 3,
    borderColor: Color.SPIRITUAL_DARK,
  },
  // Babak berjalan: bulatannya PEKAT. Inilah satu-satunya penanda "kamu di
  // sini" sekarang, jadi bedanya harus terbaca sekali pandang.
  bulatHere: {
    backgroundColor: Color.SPIRITUAL_DEEP,
    borderColor: Color.SPIRITUAL_DEEP,
  },
  emoji: { fontSize: 24, lineHeight: 30 },
  papan: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Color.BORDER,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 1,
  },
  papanHere: {
    backgroundColor: Color.SPIRITUAL_DEEP,
    borderColor: Color.SPIRITUAL_DEEP,
  },
  nama: { color: Color.TEXT_TITLE },
  namaHere: { color: Color.TEXT_REVERSE },
  namaId: { color: Color.TEXT_LABEL },
  namaIdHere: { color: Color.SPIRITUAL },

  // ── Isi modal ──────────────────────────────────────────────────────────
  isiModal: { gap: 10 },
  tahap: {
    alignSelf: 'flex-start',
    backgroundColor: Color.CONTRAST_CONTAINER,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  tahapHere: { backgroundColor: Color.SPIRITUAL_DEEP },
  tahapTeks: { color: Color.TEXT_LABEL },
  tahapTeksHere: { color: Color.TEXT_REVERSE },
  ringkas: { color: Color.TEXT_PARAGRAPH },
  ayat: { color: Color.MAIN, textDecorationLine: 'underline' },
  kutipan: { color: Color.TEXT_LABEL, fontStyle: 'italic' },
  kiniBox: {
    borderLeftWidth: 3,
    borderLeftColor: Color.SPIRITUAL_DARK,
    paddingLeft: 10,
    marginTop: 2,
  },
  kiniText: { color: Color.TEXT_PARAGRAPH },
});
