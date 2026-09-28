import { ScrollView, StyleSheet, View } from 'react-native';

import { CARD_GAP, PANEL } from '@/assets/style/card';
import { Color } from '@/assets/style/color';
import { SCREEN_CONTENT } from '@/assets/style/layout';
import { PressableScale } from '@/components/common/PressableScale';
import { VixText } from '@/components/common/VixText';
import {
  GOSPEL_ACTS,
  GOSPEL_HERE,
  gospelHereAct,
} from '@/lib/gospelStory';
import { openYouVersion } from '@/lib/spiritual';

// Tab God's Story ✝️ — lima babak cerita besar Alkitab, dengan penanda
// "kamu di sini" di babak Pengudusan.
//
// Kenapa ini bukan sekadar bacaan: lihat komentar panjang di lib/gospelStory.ts.
// Singkatnya, seluruh app ini mengurus hari ini, dan tab ini satu-satunya yang
// memberi tahu hari ini itu bagian dari apa.
//
// Bentuknya sengaja KOLOM BERURUT ke bawah, bukan lima kotak sejajar seperti
// bagan aslinya: di layar HP lima kolom berarti tulisan sekecil biji, dan yang
// hilang justru isinya. Urut ke bawah juga lebih jujur pada bentuk ceritanya —
// ia memang berjalan dari atas ke bawah, satu arah, dan kita berhenti di
// tengah.
export function GospelStoryTab() {
  const sini = gospelHereAct();

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {/* Kartu pembuka: satu kalimat yang paling ingin diingat. */}
      <View style={styles.heroCard}>
        <VixText heading="eyebrow" additionalStyle={styles.heroEyebrow}>
          God&apos;s Big Story
        </VixText>
        <VixText heading="title" additionalStyle={styles.heroTitle}>
          {sini.emoji} Kamu di babak {sini.stageId}
        </VixText>
        <VixText heading="paragraph" additionalStyle={styles.heroText}>
          Pembenaranmu sudah selesai dikerjakan Yesus. Pemuliaan belum tiba. Di
          antara keduanya, kamu sedang dikuduskan, dan itu memang belum selesai.
        </VixText>
        <VixText heading="paragraph" additionalStyle={styles.heroText}>
          Jadi teruslah hidup kudus, hidup berkenan, hidup melayani. Bukan
          supaya diterima, tapi karena sudah diterima.
        </VixText>
      </View>

      {GOSPEL_ACTS.map((a, i) => {
        const here = a.key === GOSPEL_HERE;
        return (
          <View key={a.key}>
            {/* Garis penyambung antar-babak: ceritanya satu, bukan lima kartu
                yang kebetulan berdekatan. */}
            {i > 0 && <View style={styles.connector} />}
            <View style={[styles.card, here && styles.cardHere]}>
              <View style={styles.cardTop}>
                <VixText
                  heading="bold"
                  additionalStyle={here ? styles.titleHere : styles.title}>
                  {a.emoji} {a.title}
                </VixText>
                <VixText
                  heading="label"
                  additionalStyle={here ? styles.subHere : styles.sub}>
                  {a.titleId}
                </VixText>
              </View>

              {/* Tahap keselamatan yang jatuh di babak ini — cuma tiga babak
                  terakhir yang punya, jadi barisnya memang tidak selalu ada. */}
              {a.stage ? (
                <View style={[styles.stagePill, here && styles.stagePillHere]}>
                  <VixText
                    heading="label"
                    additionalStyle={here ? styles.stageTextHere : styles.stageText}>
                    {here ? '📍 ' : ''}
                    {a.stage} · {a.stageId}
                  </VixText>
                </View>
              ) : null}

              <VixText
                heading="paragraph"
                additionalStyle={here ? styles.bodyHere : styles.body}>
                {a.summary}
              </VixText>

              {/* Ayatnya bisa di-click → terbuka di YouVersion, sama seperti
                  acuan ayat di Revive & Promise. */}
              <PressableScale onPress={() => void openYouVersion(a.verseRef)}>
                <VixText
                  heading="label"
                  additionalStyle={here ? styles.verseHere : styles.verse}>
                  📖 {a.verseRef}
                </VixText>
              </PressableScale>
              <VixText
                heading="label"
                additionalStyle={here ? styles.quoteHere : styles.quote}>
                “{a.verseText}”
              </VixText>

              <View style={[styles.nowBox, here && styles.nowBoxHere]}>
                <VixText
                  heading="label"
                  additionalStyle={here ? styles.nowTextHere : styles.nowText}>
                  {a.now}
                </VixText>
              </View>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { ...SCREEN_CONTENT, paddingBottom: 24 },
  // Kartu pembuka: ungu pekat Spiritual, satu-satunya blok gelap di tab ini.
  heroCard: {
    backgroundColor: Color.SPIRITUAL_DEEP,
    borderRadius: 18,
    padding: 16,
    gap: 6,
    marginBottom: CARD_GAP,
  },
  heroEyebrow: { color: Color.SPIRITUAL },
  heroTitle: { color: Color.TEXT_REVERSE },
  heroText: { color: Color.TEXT_ON_DARK_MUTED },
  // Garis tegak penyambung babak — pendek saja, cukup untuk membaca urutannya.
  connector: {
    width: 2,
    height: 14,
    alignSelf: 'center',
    backgroundColor: Color.SPIRITUAL_DARK,
  },
  card: {
    ...PANEL,
    padding: 14,
    gap: 6,
  },
  // Babak berjalan: pastel Spiritual bergaris tepi tegas, jadi ia langsung
  // ketemu mata tanpa perlu dibaca satu per satu.
  cardHere: {
    backgroundColor: Color.SPIRITUAL,
    borderColor: Color.SPIRITUAL_DEEP,
    borderWidth: 2,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  title: { color: Color.TEXT_TITLE },
  titleHere: { color: Color.SPIRITUAL_DEEP },
  sub: { color: Color.TEXT_LABEL },
  subHere: { color: Color.SPIRITUAL_DARK },
  stagePill: {
    alignSelf: 'flex-start',
    backgroundColor: Color.CONTRAST_CONTAINER,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  stagePillHere: { backgroundColor: Color.SPIRITUAL_DEEP },
  stageText: { color: Color.TEXT_LABEL },
  stageTextHere: { color: Color.TEXT_REVERSE },
  body: { color: Color.TEXT_PARAGRAPH },
  bodyHere: { color: Color.SPIRITUAL_DEEP },
  verse: { color: Color.MAIN, textDecorationLine: 'underline' },
  verseHere: { color: Color.SPIRITUAL_DEEP, textDecorationLine: 'underline' },
  quote: { color: Color.TEXT_LABEL, fontStyle: 'italic' },
  quoteHere: { color: Color.SPIRITUAL_DARK, fontStyle: 'italic' },
  nowBox: {
    borderLeftWidth: 3,
    borderLeftColor: Color.BORDER,
    paddingLeft: 10,
    marginTop: 2,
  },
  nowBoxHere: { borderLeftColor: Color.SPIRITUAL_DEEP },
  nowText: { color: Color.TEXT_PARAGRAPH },
  nowTextHere: { color: Color.SPIRITUAL_DEEP },
});
