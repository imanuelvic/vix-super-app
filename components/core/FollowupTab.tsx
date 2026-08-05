import { useRouter } from 'expo-router';
import { Timestamp } from 'firebase/firestore';
import { useMemo, useState } from 'react';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';

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
    isCurrentMonthPrayers,
    isPrayerFollowupDay,
    loveLangLabel,
    monthDocId,
    monthlyPointsFor,
    monthlyPrayersFilled,
    newCoreIdeaId,
    nextBirthday,
    personalityTips,
    prayerFollowupLeaders,
    saveCoreIdeas,
    saveCoreLeaders,
    saveMonthlyPrayers,
    waLink,
    weekIndex,
    WEEKLY_FOCUS_COUNT,
    weeklyFollowupTopic,
    weeklyLeaders,
    type CoreIdea,
    type CoreIdeasData,
    type CoreLeader,
    type IdeaCadence,
    type MainTeamMember,
    type MonthlyPrayers,
} from '@/lib/core';
import { formatDate, MONTH_NAMES } from '@/lib/format';
import { DELETE_ERROR, SAVE_ERROR } from '@/lib/messages';

// Tab Follow Up Mingguan: tiap minggu (Sen–Min) fokus ke 2 CORE Leader untuk
// membangun hubungan — Senin pertanyaan doa wajib, hari lain pertanyaan acak
// (8 aspek hidup / obrolan ringan / penggali kepribadian). Plus pengingat
// ulang tahun & Idea For CORE.
export function FollowupTab({
  leaders,
  mainTeam,
  dayId,
  ideas,
  monthlyPrayers,
}: {
  leaders: CoreLeader[];
  mainTeam: MainTeamMember[];
  dayId: string;
  ideas: CoreIdeasData;
  monthlyPrayers: MonthlyPrayers;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const [error, setError] = useState<string | null>(null);
  // "Ganti pertanyaan" → seed acak per orang untuk memilih pertanyaan lain.
  const [topicOverride, setTopicOverride] = useState<Record<string, number>>({});
  // Ide Pendekatan tiap kartu bisa dibuka/tutup — default tertutup (ringkas).
  const [openTips, setOpenTips] = useState<Record<string, boolean>>({});

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
      setIError(SAVE_ERROR);
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
      setError(DELETE_ERROR);
    } finally {
      setEditingIdea(null);
      setIBusy(false);
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

  // 2 CORE Leader fokus minggu ini (bergilir tiap minggu).
  const weekLeaders = useMemo(
    () => weeklyLeaders(leaders, weekIndex(new Date()), WEEKLY_FOCUS_COUNT),
    // dayId sebagai dependency: pindah hari/minggu → hitung ulang.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [leaders, dayId],
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

  // ===== Pokok Doa Bulanan =====
  const nowDate = new Date();
  const monthTitle = `${MONTH_NAMES[nowDate.getMonth()]} ${nowDate.getFullYear()}`;
  const monthPoints = monthlyPointsFor(monthlyPrayers, nowDate);
  const monthNeedsFill = !monthlyPrayersFilled(monthlyPrayers, nowDate);
  // Sel/Kam/Sab → follow up pokok doa (bergilir beberapa CL per sesi).
  const isPrayerDay = isPrayerFollowupDay(nowDate);
  const prayerLeadersToday = prayerFollowupLeaders(leaders, monthPoints, nowDate);

  // Tandai satu CL sudah difollowup pokok doanya pada sesi hari ini.
  async function handlePrayerDone(leaderId: string) {
    if (!user) return;
    setError(null);
    const monthId = monthDocId(nowDate);
    const base = isCurrentMonthPrayers(monthlyPrayers, nowDate)
      ? monthlyPrayers
      : { monthId, points: {}, followedDayId: {} };
    try {
      await saveMonthlyPrayers(user.uid, {
        monthId,
        points: base.points,
        followedDayId: { ...base.followedDayId, [leaderId]: dayId },
      });
    } catch {
      setError('Gagal menyimpan. Coba lagi.');
    }
  }

  function shuffleTopic(personId: string) {
    setTopicOverride((prev) => ({
      ...prev,
      [personId]: Math.floor(Math.random() * 100000),
    }));
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
    const topic = weeklyFollowupTopic(person, id, dayId, topicOverride[id]);
    const tips = personalityTips(person);
    const tipsOpen = !!openTips[id];
    // Ada nomor → seluruh kartu bisa ditekan untuk chat WA. Menekan kartu =
    // menindaklanjuti orang ini, jadi SEKALIGUS menandai "sudah follow up hari
    // ini" (badge di Home ikut hilang). Border hijau WA sebagai penanda.
    const canChat = !!phone;
    return (
      <PressableScale
        key={id}
        style={[
          styles.card,
          canChat && !done && styles.cardChat,
          done && styles.cardDone,
        ]}
        onPress={
          canChat
            ? () => {
                openWhatsApp(phone!, `Shalom! 🙏\n\n${topic.question}`);
                if (!done) onDone();
              }
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
              {topic.icon} {topic.label}
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

        {/* Ide pendekatan sesuai kepribadian — kartu modern & berlapis:
            tiap ide punya pill label (bold) + deskripsi cara pendekatannya. */}
        {tips.length > 0 && (
          <View style={styles.tipBox}>
            {/* Header bisa diketuk untuk buka/tutup — default tertutup (ringkas).
                PressableScale bersarang: menekan header hanya toggle, tidak
                ikut memicu chat WA kartu (inner menangkap sentuhan). */}
            <PressableScale
              style={styles.tipHeaderRow}
              onPress={() =>
                setOpenTips((prev) => ({ ...prev, [id]: !prev[id] }))
              }>
              <VixText additionalStyle={styles.tipHeaderEmoji}>💡</VixText>
              <VixText heading="bold" additionalStyle={styles.tipHeader}>
                Ide Pendekatan
              </VixText>
              <VixText heading="label" additionalStyle={styles.tipChevron}>
                {tipsOpen ? '▴' : `▾ ${tips.length}`}
              </VixText>
            </PressableScale>
            {tipsOpen &&
              tips.map((t) => (
                <View key={t.label} style={styles.tipRow}>
                  <View style={styles.tipBadge}>
                    <VixText
                      heading="label"
                      additionalStyle={styles.tipBadgeText}>
                      {t.label}
                    </VixText>
                  </View>
                  <VixText heading="paragraph" additionalStyle={styles.tipText}>
                    {t.text}
                  </VixText>
                </View>
              ))}
          </View>
        )}

        {/* Status: sudah follow up, belum ada nomor, atau ajakan ketuk kartu. */}
        {done ? (
          <VixText heading="label" additionalStyle={styles.doneText}>
            ✅ Sudah di follow up hari ini
          </VixText>
        ) : !phone ? (
          <VixText heading="label" additionalStyle={styles.noPhoneText}>
            📱 Isi nomor HP di tab CORE Leader untuk chat WA.
          </VixText>
        ) : (
          <VixText heading="label" additionalStyle={styles.chatHint}>
            💬 Ketuk kartu untuk chat WA & tandai sudah follow up
          </VixText>
        )}

        {!done && (
          <View style={styles.buttonRow}>
            <PressableScale
              style={styles.shuffleButton}
              onPress={() => shuffleTopic(id)}>
              <VixText heading="bold" additionalStyle={styles.shuffleText}>
                🔀 Ganti pertanyaan
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

  // Kartu follow up pokok doa bulanan untuk satu CL (Sel/Kam/Sab).
  function renderPrayerCard(leader: CoreLeader) {
    const pts = monthPoints[leader.id] ?? [];
    const done =
      isCurrentMonthPrayers(monthlyPrayers, nowDate) &&
      monthlyPrayers.followedDayId[leader.id] === dayId;
    const canChat = !!leader.phone;
    const waText = `Shalom ${leader.name}! 🙏\n\nAku lagi mendoakan kamu bulan ini. Gimana kabar & perkembangan pergumulanmu?`;
    return (
      <PressableScale
        key={leader.id}
        style={[
          styles.card,
          canChat && !done && styles.cardChat,
          done && styles.cardDone,
        ]}
        onPress={
          canChat
            ? () => {
                openWhatsApp(leader.phone!, waText);
                if (!done) handlePrayerDone(leader.id);
              }
            : undefined
        }>
        <View style={styles.cardHeader}>
          <VixText heading="bold" additionalStyle={styles.leaderName}>
            {leader.heart} {leader.name}
          </VixText>
          <View style={styles.categoryBadge}>
            <VixText heading="label" additionalStyle={styles.categoryText}>
              📅 {pts.length} poin
            </VixText>
          </View>
        </View>
        {/* Daftar pokok doa bulan ini */}
        <View style={styles.prayerPointsBox}>
          {pts.map((p, i) => (
            <VixText
              key={i}
              heading="paragraph"
              additionalStyle={styles.prayerPointText}>
              🙏 {p}
            </VixText>
          ))}
        </View>
        {done ? (
          <VixText heading="label" additionalStyle={styles.doneText}>
            ✅ Sudah difollowup hari ini
          </VixText>
        ) : !leader.phone ? (
          <VixText heading="label" additionalStyle={styles.noPhoneText}>
            📱 Isi nomor HP di tab CORE Leader untuk chat WA.
          </VixText>
        ) : (
          <VixText heading="label" additionalStyle={styles.chatHint}>
            💬 Ketuk kartu untuk chat WA & tandai sudah difollowup
          </VixText>
        )}
        {!done && (
          <View style={styles.buttonRow}>
            <PressableScale
              style={styles.doneButton}
              onPress={() => handlePrayerDone(leader.id)}>
              <VixText heading="bold" additionalStyle={styles.doneButtonText}>
                ✅ Selesai difollowup
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

      {/* ===== Pokok Doa Bulanan: isi (awal bulan) / follow up (Sel/Kam/Sab) ===== */}
      {monthNeedsFill ? (
        <PressableScale
          style={styles.prayerFillCard}
          onPress={() => router.push('/monthly-prayers')}>
          <VixText heading="title" additionalStyle={styles.prayerFillTitle}>
            📅 Pokok Doa Bulanan — {monthTitle}
          </VixText>
          <VixText heading="label" additionalStyle={styles.prayerFillText}>
            Awal bulan! Tanyakan & isi pokok doa tiap CORE Leader dulu — ini yang
            jadi dasar follow up Selasa/Kamis/Sabtu 🙏
          </VixText>
          <View style={styles.prayerFillButton}>
            <VixText heading="bold" additionalStyle={styles.prayerFillButtonText}>
              Isi Sekarang →
            </VixText>
          </View>
        </PressableScale>
      ) : isPrayerDay && prayerLeadersToday.length > 0 ? (
        <>
          <View style={styles.prayerHeader}>
            <VixText heading="title">📅 Follow Up Pokok Doa</VixText>
            <PressableScale
              onPress={() => router.push('/monthly-prayers')}
              hitSlop={8}>
              <VixText heading="bold" additionalStyle={styles.prayerEditText}>
                Lihat semua
              </VixText>
            </PressableScale>
          </View>
          <VixText heading="label" additionalStyle={styles.prayerSub}>
            Bergilir — hari ini {prayerLeadersToday.length} CORE Leader. Doakan &
            tanya perkembangan pergumulan mereka 🙏
          </VixText>
          {prayerLeadersToday.map((l) => renderPrayerCard(l))}
        </>
      ) : null}

      {/* ===== Follow Up Mingguan: fokus 2 CORE Leader ===== */}
      <View style={styles.weekCard}>
        <VixText heading="title" additionalStyle={styles.weekTitle}>
          🔗  Doa Rantai
        </VixText>
        <VixText additionalStyle={styles.weekLeadersText}>
          {weekLeaders.length > 0
            ? weekLeaders.map((l) => `${l.heart} ${l.name}`).join('  &  ')
            : 'Belum ada CORE Leader — tambah dulu di tab Leaders.'}
        </VixText>
      </View>
      {weekLeaders.map((l) =>
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

      {/* ===== Idea For CORE (paling bawah) ===== */}
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
            <VixText heading="paragraph" additionalStyle={styles.ideaText}>
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
          </PressableScale>
        ))
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
        placeholder="Idenya apa?"
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
  weekCard: {
    backgroundColor: Color.MAIN_DARK,
    borderRadius: 16,
    padding: 16,
    gap: 6,
    marginTop: 6,
    marginBottom: 12,
  },
  weekTitle: { color: Color.TEXT_REVERSE },
  weekLeadersText: { color: Color.MAIN_LIGHT },
  // Pokok Doa Bulanan — kartu ajakan isi (awal bulan), tema spiritual (ungu).
  prayerFillCard: {
    backgroundColor: Color.SPIRITUAL,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Color.SPIRITUAL_DARK,
    padding: 16,
    gap: 8,
    marginTop: 6,
    marginBottom: 12,
  },
  prayerFillTitle: { color: Color.SPIRITUAL_DARK },
  prayerFillText: { color: Color.SPIRITUAL_DARK },
  prayerFillButton: {
    alignSelf: 'flex-start',
    backgroundColor: Color.SPIRITUAL_DARK,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  prayerFillButtonText: { color: Color.TEXT_REVERSE },
  prayerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 4,
  },
  prayerEditText: { color: Color.MAIN },
  prayerSub: { color: Color.TEXT_LABEL, marginBottom: 10 },
  prayerPointsBox: {
    backgroundColor: Color.BACKGROUND,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  prayerPointText: { color: Color.TEXT_TITLE },
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
    backgroundColor: Color.CONTAINER,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Color.ACCENT_DARK,
    padding: 12,
    gap: 8,
  },
  tipHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tipHeaderEmoji: { fontSize: 15, lineHeight: 20 },
  tipHeader: { color: Color.ACCENT_DARK, letterSpacing: 0.2 },
  tipChevron: { color: Color.ACCENT_DARK, marginLeft: 'auto' },
  tipRow: {
    backgroundColor: Color.ACCENT,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
  },
  tipBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Color.ACCENT_DARK,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  tipBadgeText: { color: Color.TEXT_REVERSE },
  tipText: { color: Color.TEXT_PARAGRAPH },
  waButton: {
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: Color.WHATSAPP,
  },
  waText: { color: Color.TEXT_REVERSE },
  noPhoneText: { color: Color.TEXT_PLACEHOLDER },
  chatHint: { color: Color.WHATSAPP },
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
  ideaInput: {
    marginBottom: 10,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  fieldLabel: { marginBottom: 6 },
  formGap: { marginBottom: 10 },
});
