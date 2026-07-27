import { Timestamp } from 'firebase/firestore';
import { useMemo, useState } from 'react';
import { Linking, Share, ScrollView, StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { Chip } from '@/components/common/Chip';
import { DateField } from '@/components/common/DateField';
import { DualButtons } from '@/components/common/DualButtons';
import { FormInput } from '@/components/common/FormInput';
import { GreetingHeader } from '@/components/common/Greeting';
import { InlineDelete } from '@/components/common/InlineDelete';
import { PressableScale } from '@/components/common/PressableScale';
import { SheetModal } from '@/components/common/SheetModal';
import { VixText } from '@/components/common/VixText';
import { useAuth } from '@/contexts/auth';
import {
  CORE_CATEGORIES,
  dailyTopic,
  FOLLOWUPS_MT_PER_DAY,
  FOLLOWUPS_PER_DAY,
  IDEA_CADENCE_LABEL,
  loveLangLabel,
  newCoreIdeaId,
  nextBirthday,
  personalityTips,
  pickDailyFollowups,
  saveCoreIdeas,
  saveCoreLeaders,
  saveMainTeam,
  waLink,
  type CoreIdea,
  type CoreIdeasData,
  type CoreLeader,
  type IdeaCadence,
  type MainTeamMember,
} from '@/lib/core';
import { formatDate, MONTH_NAMES } from '@/lib/format';

// Tab Follow Up: tugas harian MCL — siapa yang di follow up hari ini
// (CORE Leader + Main Team, dibagi merata dan diacak per hari) +
// pengingat ulang tahun + ide topik chat yang bisa langsung dikirim ke WA.
export function FollowupTab({
  leaders,
  mainTeam,
  dayId,
  ideas,
}: {
  leaders: CoreLeader[];
  mainTeam: MainTeamMember[];
  dayId: string;
  ideas: CoreIdeasData;
}) {
  const { user } = useAuth();
  const [error, setError] = useState<string | null>(null);
  // Override topik kalau user tekan "Ganti topik" (hanya untuk hari ini).
  const [topicOverride, setTopicOverride] = useState<
    Record<string, { c: number; q: number }>
  >({});

  // ===== Idea For CORE — form tambah/edit =====
  const [editingIdea, setEditingIdea] = useState<CoreIdea | 'new' | null>(null);
  const [iText, setIText] = useState('');
  const [iNote, setINote] = useState('');
  const [iDate, setIDate] = useState(new Date());
  const [iBusy, setIBusy] = useState(false);
  const [iError, setIError] = useState<string | null>(null);

  // Ide terbaru di atas.
  const sortedIdeas = useMemo(
    () =>
      [...ideas.ideas].sort((a, b) => b.date.toMillis() - a.date.toMillis()),
    [ideas.ideas],
  );

  async function setCadence(cadence: IdeaCadence) {
    if (!user || cadence === ideas.cadence) return;
    try {
      await saveCoreIdeas(user.uid, { ...ideas, cadence });
    } catch {
      setError('Gagal menyimpan. Coba lagi.');
    }
  }

  function openAddIdea() {
    setEditingIdea('new');
    setIText('');
    setINote('');
    setIDate(new Date());
    setIError(null);
  }

  function openEditIdea(idea: CoreIdea) {
    setEditingIdea(idea);
    setIText(idea.text);
    setINote(idea.note);
    setIDate(idea.date ? idea.date.toDate() : new Date());
    setIError(null);
  }

  async function handleSaveIdea() {
    if (!user || !editingIdea || iBusy) return;
    if (!iText.trim()) {
      setIError('Isi idenya dulu.');
      return;
    }
    setIBusy(true);
    setIError(null);
    const data: CoreIdea = {
      id: editingIdea === 'new' ? newCoreIdeaId() : editingIdea.id,
      text: iText.trim(),
      note: iNote.trim(),
      date: Timestamp.fromDate(iDate),
    };
    const nextIdeas =
      editingIdea === 'new'
        ? [...ideas.ideas, data]
        : ideas.ideas.map((i) => (i.id === editingIdea.id ? data : i));
    try {
      await saveCoreIdeas(user.uid, { ...ideas, ideas: nextIdeas });
      setEditingIdea(null);
    } catch {
      setIError('Gagal menyimpan. Cek koneksi internet.');
    } finally {
      setIBusy(false);
    }
  }

  async function handleDeleteIdea() {
    if (!user || !editingIdea || editingIdea === 'new' || iBusy) return;
    setIBusy(true);
    try {
      await saveCoreIdeas(user.uid, {
        ...ideas,
        ideas: ideas.ideas.filter((i) => i.id !== editingIdea.id),
      });
    } catch {
      setError('Gagal menghapus. Coba lagi.');
    } finally {
      setEditingIdea(null);
      setIBusy(false);
    }
  }

  // Share ide + catatannya ke grup MT lewat share sheet iOS (pilih WhatsApp).
  async function shareIdea(idea: CoreIdea) {
    const message = `💡 Idea For CORE\n\n${idea.text}${
      idea.note ? `\n\n📝 ${idea.note}` : ''
    }`;
    try {
      await Share.share({ message });
    } catch {
      // Dibatalkan user — abaikan.
    }
  }

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
    phone,
    person,
    done,
    onDone,
  }: {
    id: string;
    title: string;
    sub: string | null;
    phone: string | null;
    person: { disc?: string | null; mbti?: string | null; loveLanguage?: string | null };
    done: boolean;
    onDone: () => void;
  }) {
    const topic = topicFor(id);
    const tips = personalityTips(person);
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
            ? () => openWhatsApp(phone!, `Shalom!`)
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

        {/* Badge kepribadian */}
        {(person.disc || person.mbti || loveLangLabel(person.loveLanguage)) && (
          <View style={styles.persBadgeRow}>
            {person.disc ? (
              <View style={styles.persBadge}>
                <VixText heading="label" additionalStyle={styles.persBadgeText}>
                  🎨 {person.disc}
                </VixText>
              </View>
            ) : null}
            {person.mbti ? (
              <View style={styles.persBadge}>
                <VixText heading="label" additionalStyle={styles.persBadgeText}>
                  🧩 {person.mbti}
                </VixText>
              </View>
            ) : null}
            {loveLangLabel(person.loveLanguage) ? (
              <View style={styles.persBadge}>
                <VixText heading="label" additionalStyle={styles.persBadgeText}>
                  {loveLangLabel(person.loveLanguage)}
                </VixText>
              </View>
            ) : null}
          </View>
        )}

        {/* Ide pendekatan sesuai kepribadian */}
        {tips.length > 0 && (
          <View style={styles.tipBox}>
            <VixText heading="label" additionalStyle={styles.tipHeader}>
              💡 Ide pendekatan
            </VixText>
            {tips.map((t) => (
              <VixText key={t.label} heading="label" additionalStyle={styles.tipItem}>
                <VixText heading="bold" additionalStyle={styles.tipItemLabel}>
                  {t.label}:{' '}
                </VixText>
                {t.text}
              </VixText>
            ))}
          </View>
        )}

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
    <>
    <ScrollView contentContainerStyle={styles.content}>
      <GreetingHeader />

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

      {/* ===== Idea For CORE ===== */}
      <View style={styles.ideaHeader}>
        <VixText heading="title">💡 Idea For CORE</VixText>
        <PressableScale
          style={styles.ideaAddButton}
          onPress={openAddIdea}
          hitSlop={8}>
          <VixText heading="bold" additionalStyle={styles.ideaAddText}>
            + Tambah
          </VixText>
        </PressableScale>
      </View>
      <VixText heading="label" additionalStyle={styles.ideaHint}>
        Masukan spontan buat CORE — boleh dikerjakan, boleh juga tidak 🙂 Rutin{' '}
        {IDEA_CADENCE_LABEL[ideas.cadence].toLowerCase()}.
      </VixText>
      <View style={styles.cadenceRow}>
        <Chip
          label="🗓️ Mingguan"
          active={ideas.cadence === 'weekly'}
          onPress={() => setCadence('weekly')}
          additionalStyle={styles.cadenceChip}
        />
        <Chip
          label="📅 Bulanan"
          active={ideas.cadence === 'monthly'}
          onPress={() => setCadence('monthly')}
          additionalStyle={styles.cadenceChip}
        />
      </View>
      {sortedIdeas.length === 0 ? (
        <VixText heading="label" additionalStyle={styles.emptyText}>
          Belum ada idea. Tekan “+ Tambah” untuk mulai memberi masukan.
        </VixText>
      ) : (
        sortedIdeas.map((idea) => (
          // Tekan kartu untuk edit; tombol share membuka share sheet.
          <PressableScale
            key={idea.id}
            style={styles.ideaCard}
            onPress={() => openEditIdea(idea)}>
            <VixText heading="bold" additionalStyle={styles.ideaText}>
              {idea.text}
            </VixText>
            <VixText heading="label" additionalStyle={styles.ideaDate}>
              🗓️ {formatDate(idea.date.toDate())}
            </VixText>
            {idea.note ? (
              <View style={styles.ideaNoteBox}>
                <VixText heading="label" additionalStyle={styles.ideaNoteText}>
                  📝 {idea.note}
                </VixText>
              </View>
            ) : null}
            <PressableScale
              style={styles.shareButton}
              onPress={() => shareIdea(idea)}>
              <VixText heading="bold" additionalStyle={styles.shareText}>
                📤 Share ke grup MT
              </VixText>
            </PressableScale>
          </PressableScale>
        ))
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
          phone: l.phone,
          person: l,
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
            phone: m.phone,
            person: m,
            done: m.lastFollowupDayId === dayId,
            onDone: () => handleDoneMember(m),
          });
        })
      )}
    </ScrollView>

    {/* Sheet tambah/edit Idea For CORE */}
    <SheetModal
      visible={!!editingIdea}
      title={editingIdea === 'new' ? 'Tambah Idea' : 'Edit Idea'}
      subtitle="Masukan buat CORE — bisa di-share ke grup MT"
      onClose={() => setEditingIdea(null)}>
      <FormInput
        style={styles.ideaInput}
        placeholder="Idenya apa? (mis. games ice-breaking tiap CORE)"
        value={iText}
        onChangeText={setIText}
        multiline
        editable={!iBusy}
      />
      <FormInput
        style={styles.ideaInput}
        placeholder="Catatan untuk grup MT (opsional)"
        value={iNote}
        onChangeText={setINote}
        multiline
        editable={!iBusy}
      />
      <VixText heading="label" additionalStyle={styles.fieldLabel}>
        Tanggal
      </VixText>
      <View style={styles.formGap}>
        <DateField
          key={editingIdea === 'new' ? 'new' : editingIdea?.id}
          value={iDate}
          onChange={setIDate}
        />
      </View>
      {iError && (
        <VixText heading="label" additionalStyle={styles.error}>
          {iError}
        </VixText>
      )}
      {/* Konfirmasi hapus inline — iOS tidak bisa modal di atas modal */}
      {editingIdea !== 'new' && editingIdea !== null && (
        <InlineDelete
          key={editingIdea.id}
          label="Hapus idea ini"
          busy={iBusy}
          onDelete={handleDeleteIdea}
        />
      )}
      <DualButtons
        confirmLabel="Simpan"
        busy={iBusy}
        onCancel={() => setEditingIdea(null)}
        onConfirm={handleSaveIdea}
      />
    </SheetModal>
    </>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 },
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
  persBadgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  persBadge: {
    backgroundColor: Color.MAIN_TRANSPARENT,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  persBadgeText: { color: Color.MAIN_DARK },
  tipBox: {
    backgroundColor: Color.ACCENT,
    borderRadius: 10,
    padding: 10,
    gap: 4,
  },
  tipHeader: { color: Color.ACCENT_DARK },
  tipItem: { color: Color.TEXT_PARAGRAPH },
  tipItemLabel: { color: Color.ACCENT_DARK },
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
  // Idea For CORE
  ideaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 4,
  },
  ideaAddButton: {
    backgroundColor: Color.MAIN,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  ideaAddText: { color: Color.TEXT_REVERSE },
  ideaHint: { marginBottom: 10 },
  cadenceRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  cadenceChip: { flex: 1 },
  ideaCard: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Color.ACCENT_DARK,
    padding: 14,
    marginBottom: 10,
    gap: 6,
  },
  ideaText: { color: Color.TEXT_TITLE },
  ideaDate: { color: Color.TEXT_PLACEHOLDER },
  ideaNoteBox: {
    backgroundColor: Color.ACCENT,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  ideaNoteText: { color: Color.ACCENT_DARK },
  shareButton: {
    alignItems: 'center',
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: Color.WHATSAPP,
  },
  shareText: { color: Color.TEXT_REVERSE },
  ideaInput: {
    marginBottom: 10,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  fieldLabel: { marginBottom: 6 },
  formGap: { marginBottom: 10 },
});
