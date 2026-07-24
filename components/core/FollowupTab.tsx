import { useMemo, useState } from 'react';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { Greeting } from '@/components/common/Greeting';
import { PressableScale } from '@/components/common/PressableScale';
import { VixText } from '@/components/common/VixText';
import { useAuth } from '@/contexts/auth';
import {
  CORE_CATEGORIES,
  dailyTopic,
  FOLLOWUPS_MT_PER_DAY,
  FOLLOWUPS_PER_DAY,
  nextBirthday,
  pickDailyFollowups,
  saveCoreLeaders,
  saveMainTeam,
  waLink,
  type CoreLeader,
  type MainTeamMember,
} from '@/lib/core';
import { formatFullDate, MONTH_NAMES } from '@/lib/format';

// Tab Follow Up: tugas harian MCL — siapa yang di follow up hari ini
// (CORE Leader + Main Team, dibagi merata dan diacak per hari) +
// pengingat ulang tahun + ide topik chat yang bisa langsung dikirim ke WA.
export function FollowupTab({
  leaders,
  mainTeam,
  dayId,
}: {
  leaders: CoreLeader[];
  mainTeam: MainTeamMember[];
  dayId: string;
}) {
  const { user } = useAuth();
  const [error, setError] = useState<string | null>(null);
  // Override topik kalau user tekan "Ganti topik" (hanya untuk hari ini).
  const [topicOverride, setTopicOverride] = useState<
    Record<string, { c: number; q: number }>
  >({});

  const leaderById = useMemo(
    () => new Map(leaders.map((l) => [l.id, l])),
    [leaders],
  );

  // Ulang tahun CL + MT: hari ini & yang mendekat (≤ 7 hari).
  const birthdays = useMemo(() => {
    const today = new Date();
    const entries = [
      ...leaders.map((l) => ({
        key: l.id,
        name: l.name,
        label: `${l.heart} ${l.name}`,
        sub: null as string | null,
        phone: l.phone,
        birthDay: l.birthDay,
        birthMonth: l.birthMonth,
        ...nextBirthday(l, today),
      })),
      ...mainTeam.map((m) => {
        const cl = leaderById.get(m.leaderId);
        return {
          key: m.id,
          name: m.name,
          label: `👤 ${m.name}`,
          sub: cl ? `Main Team ${cl.heart} ${cl.name}` : 'Main Team',
          phone: m.phone,
          birthDay: m.birthDay,
          birthMonth: m.birthMonth,
          ...nextBirthday(m, today),
        };
      }),
    ];
    return {
      today: entries.filter((e) => e.daysUntil === 0),
      upcoming: entries
        .filter((e) => e.daysUntil > 0 && e.daysUntil <= 7)
        .sort((a, b) => a.daysUntil - b.daysUntil),
    };
    // dayId sengaja jadi dependency: ganti hari → hitung ulang ulang tahun.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaders, mainTeam, leaderById, dayId]);

  const clPicks = useMemo(
    () => pickDailyFollowups(leaders, dayId, FOLLOWUPS_PER_DAY),
    [leaders, dayId],
  );
  const mtPicks = useMemo(
    () => pickDailyFollowups(mainTeam, dayId, FOLLOWUPS_MT_PER_DAY),
    [mainTeam, dayId],
  );

  async function handleDoneLeader(leader: CoreLeader) {
    if (!user) return;
    setError(null);
    const next = leaders.map((l) =>
      l.id === leader.id ? { ...l, lastFollowupDayId: dayId } : l,
    );
    try {
      await saveCoreLeaders(user.uid, next);
    } catch {
      setError('Gagal menyimpan. Coba lagi.');
    }
  }

  async function handleDoneMember(member: MainTeamMember) {
    if (!user) return;
    setError(null);
    const next = mainTeam.map((m) =>
      m.id === member.id ? { ...m, lastFollowupDayId: dayId } : m,
    );
    try {
      await saveMainTeam(user.uid, next);
    } catch {
      setError('Gagal menyimpan. Coba lagi.');
    }
  }

  function shuffleTopic(personId: string) {
    setTopicOverride((prev) => ({
      ...prev,
      [personId]: {
        c: Math.floor(Math.random() * CORE_CATEGORIES.length),
        q: Math.floor(Math.random() * 3),
      },
    }));
  }

  function topicFor(personId: string) {
    const override = topicOverride[personId];
    if (override) {
      const category = CORE_CATEGORIES[override.c];
      return {
        category,
        question: category.questions[override.q % category.questions.length],
      };
    }
    return dailyTopic(personId, dayId);
  }

  // Buka chat WhatsApp dengan pesan yang sudah terisi — tinggal kirim.
  function openWhatsApp(phone: string, text: string) {
    Linking.openURL(waLink(phone, text)).catch(() =>
      setError('Gagal membuka WhatsApp.'),
    );
  }

  // Kartu follow up — dipakai untuk CORE Leader maupun Main Team.
  function renderFollowCard({
    id,
    title,
    sub,
    name,
    phone,
    done,
    onDone,
  }: {
    id: string;
    title: string;
    sub: string | null;
    name: string;
    phone: string | null;
    done: boolean;
    onDone: () => void;
  }) {
    const topic = topicFor(id);
    // Ada nomor → seluruh kartu bisa ditekan untuk buka chat WhatsApp,
    // border-nya diwarnai hijau WA sebagai penanda. Kalau sudah selesai,
    // gaya "done" yang menang (tidak perlu diarahkan chat lagi).
    const canChat = !!phone && !done;
    return (
      <PressableScale
        key={id}
        style={[styles.card, canChat && styles.cardChat, done && styles.cardDone]}
        onPress={
          canChat
            ? () => openWhatsApp(phone!, `Halo ${name}! ${topic.question}`)
            : undefined
        }>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleBox}>
            <VixText heading="bold" additionalStyle={styles.leaderName}>
              {title}
            </VixText>
            {sub && <VixText heading="label">{sub}</VixText>}
          </View>
          <View style={styles.categoryBadge}>
            <VixText heading="label" additionalStyle={styles.categoryText}>
              {topic.category.icon} {topic.category.label}
            </VixText>
          </View>
        </View>

        {/* Ide pembuka chat */}
        <View style={styles.questionBox}>
          <VixText heading="paragraph" additionalStyle={styles.questionText}>
            “{topic.question}”
          </VixText>
        </View>

        {/* Info hanya muncul kalau belum ada nomor; kalau ada, kartu langsung
            bisa ditekan untuk chat (border hijau WA jadi penanda). */}
        {done ? (
          <VixText heading="label" additionalStyle={styles.doneText}>
            ✅ Sudah di follow up hari ini
          </VixText>
        ) : !phone ? (
          <VixText heading="label" additionalStyle={styles.noPhoneText}>
            📱 Isi nomor HP di tab CORE Leader untuk chat WA.
          </VixText>
        ) : null}

        {!done && (
          <View style={styles.buttonRow}>
            <PressableScale
              style={styles.shuffleButton}
              onPress={() => shuffleTopic(id)}>
              <VixText heading="bold" additionalStyle={styles.shuffleText}>
                🔀 Ganti topik
              </VixText>
            </PressableScale>
            <PressableScale style={styles.doneButton} onPress={onDone}>
              <VixText heading="bold" additionalStyle={styles.doneButtonText}>
                ✅ Selesai
              </VixText>
            </PressableScale>
          </View>
        )}
      </PressableScale>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Greeting heading="title" style={styles.greeting} />
      <VixText heading="label" additionalStyle={styles.dateLine}>
        📆 {formatFullDate(new Date())}
      </VixText>

      {error && (
        <VixText heading="label" additionalStyle={styles.error}>
          {error}
        </VixText>
      )}

      {/* ===== Ulang tahun hari ini (CL + Main Team) ===== */}
      {birthdays.today.map((b) => (
        <View key={b.key} style={styles.birthdayCard}>
          <VixText heading="title" additionalStyle={styles.birthdayTitle}>
            🎂 {b.label} ulang tahun HARI INI!
          </VixText>
          <VixText heading="paragraph" additionalStyle={styles.birthdayText}>
            {b.sub ? `${b.sub} — ` : ''}Genap {b.turningAge} tahun. Jangan lupa
            kirim ucapan & doa 🥳
          </VixText>
          {b.phone && (
            <PressableScale
              style={styles.waButton}
              onPress={() =>
                openWhatsApp(
                  b.phone!,
                  `Selamat ulang tahun ke-${b.turningAge}, ${b.name}! 🎉 Tuhan Yesus memberkati tahun barumu 🙏`,
                )
              }>
              <VixText heading="bold" additionalStyle={styles.waText}>
                💬 Kirim Ucapan via WA
              </VixText>
            </PressableScale>
          )}
        </View>
      ))}

      {/* Ulang tahun mendekat (≤ 7 hari) */}
      {birthdays.upcoming.length > 0 && (
        <View style={styles.upcomingCard}>
          {birthdays.upcoming.map((b) => (
            <VixText key={b.key} heading="label">
              🎂 {b.label}
              {b.sub ? ` (${b.sub})` : ''} ultah {b.daysUntil} hari lagi (
              {b.birthDay} {MONTH_NAMES[b.birthMonth]}) — ke-{b.turningAge}
            </VixText>
          ))}
        </View>
      )}

      {/* ===== Follow Up CORE Leader ===== */}
      <VixText heading="title" additionalStyle={styles.sectionTitle}>
        🎯 Follow Up CORE Leader
      </VixText>
      {clPicks.map((l) =>
        renderFollowCard({
          id: l.id,
          title: `${l.heart} ${l.name}`,
          sub: null,
          name: l.name,
          phone: l.phone,
          done: l.lastFollowupDayId === dayId,
          onDone: () => handleDoneLeader(l),
        }),
      )}

      {/* ===== Follow Up Main Team ===== */}
      <VixText heading="title" additionalStyle={styles.sectionTitle}>
        👥 Follow Up Main Team
      </VixText>
      {mainTeam.length === 0 ? (
        <VixText heading="label" additionalStyle={styles.emptyText}>
          Belum ada Main Team — isi datanya di tab CORE Leader.
        </VixText>
      ) : (
        mtPicks.map((m) => {
          const cl = leaderById.get(m.leaderId);
          return renderFollowCard({
            id: m.id,
            title: `👤 ${m.name}`,
            sub: cl ? `Main Team ${cl.heart} ${cl.name}` : 'Main Team',
            name: m.name,
            phone: m.phone,
            done: m.lastFollowupDayId === dayId,
            onDone: () => handleDoneMember(m),
          });
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 },
  greeting: { marginBottom: 4 },
  dateLine: { marginBottom: 10 },
  error: { color: Color.DANGER, marginBottom: 8 },
  birthdayCard: {
    backgroundColor: Color.ACCENT,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    gap: 6,
  },
  birthdayTitle: { color: Color.ACCENT_DARK },
  birthdayText: { color: Color.ACCENT_DARK },
  upcomingCard: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Color.BORDER,
    padding: 14,
    marginBottom: 10,
    gap: 4,
  },
  sectionTitle: { marginTop: 6, marginBottom: 10 },
  card: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Color.BORDER,
    padding: 16,
    marginBottom: 12,
    gap: 10,
  },
  cardChat: {
    borderColor: Color.WHATSAPP,
    borderWidth: 1.5,
  },
  cardDone: {
    backgroundColor: Color.MAIN_TRANSPARENT,
    borderColor: Color.MAIN_LIGHT,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  cardTitleBox: { flex: 1, gap: 1 },
  leaderName: { color: Color.TEXT_TITLE },
  categoryBadge: {
    backgroundColor: Color.CONTRAST_CONTAINER,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  categoryText: { color: Color.TEXT_PARAGRAPH },
  questionBox: {
    backgroundColor: Color.BACKGROUND,
    borderLeftWidth: 3,
    borderLeftColor: Color.MAIN,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  questionText: { color: Color.TEXT_TITLE, fontStyle: 'italic' },
  waButton: {
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: Color.WHATSAPP,
  },
  waText: { color: Color.TEXT_REVERSE },
  noPhoneText: { color: Color.TEXT_PLACEHOLDER },
  buttonRow: { flexDirection: 'row', gap: 10 },
  shuffleButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Color.BORDER,
    backgroundColor: Color.CONTAINER,
  },
  shuffleText: { color: Color.TEXT_LABEL },
  doneButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: Color.MAIN,
  },
  doneButtonText: { color: Color.TEXT_REVERSE },
  doneText: { color: Color.SUCCESS },
  emptyText: { textAlign: 'center', marginBottom: 12 },
});
