import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { SHADOW_SOFT } from '@/assets/style/card';
import { Color } from '@/assets/style/color';
import { EmojiButton } from '@/components/common/EmojiButton';
import { PressableScale } from '@/components/common/PressableScale';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { VixText } from '@/components/common/VixText';
import { todayHref } from '@/components/today/todayLink';
import { IconSymbol } from '@/components/ui/icon-symbol';
import type { IntercessionTopic } from '@/lib/intercession';
import type { TodayModel } from '@/lib/today';

// 🌅 WITH GOD — puncak layar Today. Bukan checklist rohani: satu undangan
// besar sebelum Morning Journey, satu baris tenang sesudahnya. Baris-baris di
// bawahnya (bacaan, syafaat, puasa, khotbah) mengikuti jam & keadaan hari ini;
// yang sudah beres digambar redup dengan ✓, bukan dihapus — supaya yang
// terbaca adalah "sudah bersama Tuhan pagi ini", bukan daftar yang menyusut.
//
// Nada yang dijaga: mengundang ("Sebelum yang lain, bersama Yesus dulu"),
// bukan menuntut. Streak hanya satu keterangan kecil.
export function GodHero({
  god,
  name,
  intercession,
  onDismissIntercession,
  onNudgeSeen,
}: {
  god: TodayModel['god'];
  /** Nama panggilan untuk sapaan. */
  name: string;
  intercession: IntercessionTopic;
  onDismissIntercession: () => void;
  onNudgeSeen: () => void;
}) {
  const router = useRouter();
  const [openPrayer, setOpenPrayer] = useState(false);
  const pagi = new Date().getHours() < 11;
  const sapaan =
    god.state === 'done'
      ? `Hari ini bersama Yesus, ${name}`
      : god.state === 'late'
        ? `Hai ${name}`
        : pagi
          ? `Selamat pagi, ${name}`
          : `Hai ${name}`;
  const ajakan =
    god.state === 'invite'
      ? 'Sebelum yang lain, bersama Yesus dulu.'
      : god.state === 'late'
        ? 'Belum sempat pagi ini? Luangkan waktu sekarang.'
        : god.state === 'done'
          ? 'Morning Journey sudah dijalani.'
          : '';

  return (
    <View style={styles.card}>
      <VixText heading="eyebrow" additionalStyle={styles.eyebrow}>
        With God
      </VixText>
      <VixText heading="display" additionalStyle={styles.title}>
        {sapaan}
      </VixText>
      {ajakan ? (
        <VixText heading="paragraph" additionalStyle={styles.lead}>
          {ajakan}
        </VixText>
      ) : null}

      {god.state === 'invite' || god.state === 'late' ? (
        <View style={styles.cta}>
          <PrimaryButton
            label={god.state === 'invite' ? '🌅 Mulai Morning Journey' : '🌅 Jalani Morning Journey'}
            onPress={() => router.push('/morning-journey')}
            background={Color.MAIN_DARK}
          />
        </View>
      ) : god.state === 'done' ? (
        <PressableScale
          style={styles.doneRow}
          onPress={() => router.push('/journey-history')}
          hitSlop={6}>
          <IconSymbol name="checkmark" size={16} color={Color.MAIN} />
          <VixText heading="label" additionalStyle={styles.doneText}>
            Morning Journey{god.streak > 1 ? ` · ${god.streak} hari berturut` : ''}
          </VixText>
        </PressableScale>
      ) : null}

      {/* Baris-baris hari ini: bacaan, syafaat, puasa, khotbah. */}
      {god.lines.length > 0 && (
        <View style={styles.lines}>
          {god.lines.map((l) => {
            const isPrayer = l.id === 'intercession';
            const terbuka = isPrayer && openPrayer;
            return (
              <View key={l.id}>
                <PressableScale
                  style={styles.line}
                  onPress={() =>
                    isPrayer && l.href.pathname !== '/core'
                      ? setOpenPrayer((v) => !v)
                      : router.push(todayHref(l.href))
                  }>
                  <VixText additionalStyle={styles.lineEmoji}>{l.emoji}</VixText>
                  <View style={styles.lineMain}>
                    <VixText
                      heading="bold"
                      numberOfLines={2}
                      additionalStyle={[styles.lineTitle, l.done && styles.lineDone]}>
                      {l.title}
                    </VixText>
                    {l.detail && !terbuka ? (
                      <VixText heading="label" numberOfLines={2}>
                        {l.detail}
                      </VixText>
                    ) : null}
                  </View>
                  {l.done ? (
                    <IconSymbol name="checkmark" size={16} color={Color.MAIN} />
                  ) : (
                    <IconSymbol
                      name={terbuka ? 'chevron.up' : 'chevron.right'}
                      size={16}
                      color={Color.TEXT_PLACEHOLDER}
                    />
                  )}
                </PressableScale>
                {terbuka && (
                  <View style={styles.prayerBox}>
                    {intercession.points.map((p, i) => (
                      <VixText key={i} heading="paragraph" additionalStyle={styles.prayerPoint}>
                        • {p}
                      </VixText>
                    ))}
                    {!l.done && (
                      <PressableScale
                        style={styles.prayedButton}
                        onPress={() => {
                          onDismissIntercession();
                          setOpenPrayer(false);
                        }}>
                        <VixText heading="label" additionalStyle={styles.prayedText}>
                          ✓ Sudah didoakan hari ini
                        </VixText>
                      </PressableScale>
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}

      {/* 🕊️ Penyegar giliran jam ini — kalimat pendek, bisa dibagikan. */}
      {god.nudge && (
        <View style={styles.nudge}>
          <PressableScale
            style={styles.nudgeMain}
            onPress={() => {
              onNudgeSeen();
              if (god.nudge?.day) {
                router.push({ pathname: '/revive', params: { day: god.nudge.day } });
              }
            }}>
            <VixText heading="label" additionalStyle={styles.nudgeLabel}>
              🕊️ {god.nudge.day ? 'Dari Revive-mu' : 'Reminder'}
            </VixText>
            <VixText heading="paragraph" additionalStyle={styles.nudgeText}>
              {god.nudge.text}
            </VixText>
          </PressableScale>
          <EmojiButton
            icon="square.and.arrow.up"
            onPress={() =>
              router.push({ pathname: '/reminder-share', params: { text: god.nudge?.text ?? '' } })
            }
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    ...SHADOW_SOFT,
    backgroundColor: Color.CONTAINER,
    borderRadius: 22,
    padding: 20,
    gap: 6,
  },
  eyebrow: { color: Color.MAIN },
  title: { marginTop: 2 },
  lead: { color: Color.TEXT_PARAGRAPH, marginTop: 2 },
  cta: { marginTop: 12 },
  doneRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  doneText: { color: Color.MAIN },
  lines: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: Color.BORDER,
    paddingTop: 6,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 9,
  },
  lineEmoji: { fontSize: 18, lineHeight: 24, width: 26, textAlign: 'center' },
  lineMain: { flex: 1, gap: 1 },
  lineTitle: { color: Color.TEXT_TITLE },
  lineDone: { color: Color.TEXT_LABEL, textDecorationLine: 'line-through' },
  prayerBox: {
    backgroundColor: Color.SPIRITUAL,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    gap: 4,
  },
  prayerPoint: { color: Color.SPIRITUAL_DEEP },
  prayedButton: { alignSelf: 'flex-start', marginTop: 6 },
  prayedText: { color: Color.SPIRITUAL_DARK, textDecorationLine: 'underline' },
  nudge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
    backgroundColor: Color.MAIN_TRANSPARENT,
    borderRadius: 14,
    padding: 12,
  },
  nudgeMain: { flex: 1, gap: 2 },
  nudgeLabel: { color: Color.MAIN },
  nudgeText: { color: Color.MAIN_DARK },
});
