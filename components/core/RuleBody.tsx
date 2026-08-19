import { StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { VixText } from '@/components/common/VixText';
import { parseRuleBody } from '@/lib/coreRules';

// Penampil isi dokumen Rules & Suggestions.
//
// Strukturnya dibaca parseRuleBody() — parser yang SAMA dengan yang dipakai
// pembuat PDF, jadi tampilan di layar & di PDF tak mungkin berbeda tafsir.
export function RuleBody({ body }: { body: string }) {
  return (
    <View>
      {parseRuleBody(body).map((line, i) => {
        // Indeks aman jadi key: daftarnya hasil parse teks statis, tidak
        // pernah disusun ulang atau disisipi item di tengah.
        const key = `${i}-${line.type}`;
        switch (line.type) {
          case 'sep':
            return <View key={key} style={styles.sep} />;
          case 'head':
            return (
              <VixText key={key} heading="title" additionalStyle={styles.head}>
                {line.text}
              </VixText>
            );
          case 'warn':
            return (
              <View key={key} style={styles.warn}>
                <VixText heading="bold" additionalStyle={styles.warnText}>
                  ⚠️ {line.text}
                </VixText>
                {/* Butir milik blok ini ikut MASUK ke dalam kotaknya */}
                {(line.children ?? []).map((k, j) => (
                  <View key={`${j}-${k.type}`} style={styles.warnRow}>
                    {k.type === 'bullet' || k.type === 'num' ? (
                      <VixText
                        heading="paragraph"
                        additionalStyle={styles.warnDot}>
                        {k.type === 'num' ? `${k.marker}.` : '•'}
                      </VixText>
                    ) : null}
                    <VixText
                      heading="paragraph"
                      additionalStyle={styles.warnChild}>
                      {k.text}
                    </VixText>
                  </View>
                ))}
              </View>
            );
          case 'bullet':
            return (
              <View key={key} style={styles.row}>
                <VixText heading="paragraph" additionalStyle={styles.dot}>
                  •
                </VixText>
                <VixText heading="paragraph" additionalStyle={styles.rowText}>
                  {line.text}
                </VixText>
              </View>
            );
          case 'num':
            return (
              <View key={key} style={styles.row}>
                <VixText heading="bold" additionalStyle={styles.num}>
                  {line.marker}.
                </VixText>
                <VixText heading="paragraph" additionalStyle={styles.rowText}>
                  {line.text}
                </VixText>
              </View>
            );
          case 'text':
            return (
              <VixText key={key} heading="paragraph" additionalStyle={styles.text}>
                {line.text}
              </VixText>
            );
          default:
            // 'blank' — jaraknya sudah diatur margin, baris kosong tak perlu
            // dicetak; kalau dicetak, dokumennya jadi berlubang-lubang.
            return null;
        }
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  sep: {
    height: 1,
    backgroundColor: Color.BORDER,
    marginVertical: 14,
  },
  head: { color: Color.MAIN_DARK, marginTop: 16, marginBottom: 6 },
  text: { color: Color.TEXT_PARAGRAPH, marginBottom: 8 },
  row: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  dot: { color: Color.MAIN, width: 12 },
  num: { color: Color.MAIN_DARK, minWidth: 18 },
  rowText: { flex: 1, color: Color.TEXT_PARAGRAPH },
  warn: {
    backgroundColor: Color.WARNING_TRANSPARENT,
    borderLeftWidth: 3,
    borderLeftColor: Color.WARNING,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginVertical: 10,
  },
  warnText: { color: Color.WARNING },
  warnRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
  warnDot: { color: Color.WARNING, width: 14 },
  warnChild: { flex: 1, color: Color.WARNING },
});
