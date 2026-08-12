import { useRouter } from 'expo-router';
import { Timestamp } from 'firebase/firestore';
import { useMemo, useState } from 'react';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { CenterDialog } from '@/components/common/CenterDialog';
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
  // Modal tengah: pokok doa 1 CL (follow up), dan ide pendekatan 1 CL.
  const [prayerModal, setPrayerModal] = useState<CoreLeader | null>(null);
  // Modal follow up mingguan (mirip Doa Rantai): ketuk kartu CL → lihat
  // pertanyaan + ide pendekatan, ganti pertanyaan di dalamnya. Menandai
  // "selesai" lewat tombol kecil di kartu (di luar modal).
  const [followupModal, setFollowupModal] = useState<{
    id: string;
    title: string;
    phone: string | null;
    person: {
      disc?: string | null;
      mbti?: string | null;
      loveLanguage?: string | null;
    };
  } | null>(null);

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
      setError(SAVE_ERROR);
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
      setError(SAVE_ERROR);
    }
  }

  // ===== Doa Rantai (pokok doa bergilir) =====
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
    // Bulan baru → reset penanda follow-up, TAPI poin & tanggal update pokok doa
    // tidak dihapus (tetap tersimpan; saveMonthlyPrayers menulis ulang dokumen).
    const base = isCurrentMonthPrayers(monthlyPrayers, nowDate)
      ? monthlyPrayers
      : {
          points: monthlyPrayers.points,
          followedDayId: {} as Record<string, string>,
          updatedAt: monthlyPrayers.updatedAt,
        };
    try {
      await saveMonthlyPrayers(user.uid, {
        monthId,
        points: base.points,
        followedDayId: { ...base.followedDayId, [leaderId]: dayId },
        updatedAt: base.updatedAt,
      });
    } catch {
      setError(SAVE_ERROR);
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

  // Kartu follow up mingguan — RINGKAS seperti Doa Rantai: ketuk untuk buka
  // modal (pertanyaan + ide pendekatan). Tombol "Selesai" kecil di kartu (di
  // luar modal) untuk menandai sudah follow up hari ini.
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
    // Tombol "Selesai" (PressableScale bersarang) menangkap sentuhannya sendiri
    // → menandai selesai TANPA ikut membuka modal.
    return (
      <PressableScale
        key={id}
        style={[styles.prayerRow, done && styles.prayerRowDone]}
        onPress={() => setFollowupModal({ id, title, phone, person })}>
        <View style={styles.followMain}>
          <VixText heading="bold" additionalStyle={styles.leaderName}>
            {title}
          </VixText>
          {sub && <VixText heading="label">{sub}</VixText>}
          <VixText heading="label" additionalStyle={styles.followHint}>
            {topic.icon} {topic.label} · ketuk untuk lihat ›
          </VixText>
        </View>
        {done ? (
          <VixText heading="label" additionalStyle={styles.doneText}>
            ✅ Selesai
          </VixText>
        ) : (
          <PressableScale style={styles.smallDoneButton} onPress={onDone}>
            <VixText heading="label" additionalStyle={styles.smallDoneText}>
              ✅ Selesai
            </VixText>
          </PressableScale>
        )}
      </PressableScale>
    );
  }

  // Baris ringkas 1 CL untuk follow up pokok doa (Sel/Kam/Sab). Diketuk →
  // modal tengah berisi seluruh pokok doa + tombol WA.
  function renderPrayerCard(leader: CoreLeader) {
    const pts = monthPoints[leader.id] ?? [];
    const done =
      isCurrentMonthPrayers(monthlyPrayers, nowDate) &&
      monthlyPrayers.followedDayId[leader.id] === dayId;
    return (
      <PressableScale
        key={leader.id}
        style={[styles.prayerRow, done && styles.prayerRowDone]}
        onPress={() => setPrayerModal(leader)}>
        <VixText heading="bold" additionalStyle={styles.prayerRowName}>
          {leader.heart} {leader.name}
        </VixText>
        <VixText heading="label" additionalStyle={styles.prayerRowMeta}>
          {done ? '✅ Selesai' : `${pts.length} poin ›`}
        </VixText>
      </PressableScale>
    );
  }

  // Nilai untuk modal pokok doa (tergantung CL yang sedang dipilih).
  const pmPts = prayerModal ? monthPoints[prayerModal.id] ?? [] : [];
  const pmDone =
    prayerModal != null &&
    isCurrentMonthPrayers(monthlyPrayers, nowDate) &&
    monthlyPrayers.followedDayId[prayerModal.id] === dayId;

  // Nilai untuk modal follow up mingguan (dihitung live → tombol "Ganti
  // pertanyaan" langsung memperbarui pertanyaan di modal).
  const fmTopic = followupModal
    ? weeklyFollowupTopic(
        followupModal.person,
        followupModal.id,
        dayId,
        topicOverride[followupModal.id],
      )
    : null;
  const fmTips = followupModal ? personalityTips(followupModal.person) : [];

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

      {/* ===== Doa Rantai: isi pokok doa (awal bulan) / follow up (Sel/Kam/Sab) ===== */}
      {monthNeedsFill ? (
        <PressableScale
          style={styles.prayerFillCard}
          onPress={() => router.push('/monthly-prayers')}>
          <VixText heading="title" additionalStyle={styles.prayerFillTitle}>
            🔗 Doa Rantai — {monthTitle}
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
          <View style={styles.doaRantaiCard}>
            <View style={styles.doaRantaiTop}>
              <VixText heading="title" additionalStyle={styles.doaRantaiTitle}>
                🔗  Doa Rantai
              </VixText>
            </View>
          </View>
          {prayerLeadersToday.map((l) => renderPrayerCard(l))}
        </>
      ) : null}

      {/* ===== Follow Up Mingguan: fokus 2 CORE Leader ===== */}
      <View style={styles.weekCard}>
        <VixText heading="title" additionalStyle={styles.weekTitle}>
          🎯  Follow Up Mingguan
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

    {/* Modal tengah: seluruh pokok doa 1 CL + tombol WA */}
    <CenterDialog visible={!!prayerModal} onClose={() => setPrayerModal(null)}>
      {prayerModal && (
        <>
          <VixText heading="title" additionalStyle={styles.modalTitle}>
            {prayerModal.heart} {prayerModal.name}
          </VixText>
          <VixText heading="label" additionalStyle={styles.modalSub}>
            🙏 Pokok doa bulan ini
          </VixText>
          <ScrollView style={styles.modalScroll}>
            {pmPts.length > 0 ? (
              pmPts.map((p, i) => (
                <View key={i} style={styles.modalPointBox}>
                  <VixText
                    heading="paragraph"
                    additionalStyle={styles.modalPointText}>
                    🙏 {p}
                  </VixText>
                </View>
              ))
            ) : (
              <VixText heading="label" additionalStyle={styles.noPhoneText}>
                Belum ada pokok doa bulan ini.
              </VixText>
            )}
          </ScrollView>
          {pmDone ? (
            <VixText heading="label" additionalStyle={styles.doneText}>
              ✅ Sudah difollowup hari ini
            </VixText>
          ) : !prayerModal.phone ? (
            <VixText heading="label" additionalStyle={styles.noPhoneText}>
              📱 Isi nomor HP di tab CORE Leader untuk chat WA.
            </VixText>
          ) : (
            <PressableScale
              style={styles.modalWaButton}
              onPress={() => {
                openWhatsApp(
                  prayerModal.phone!,
                  `Shalom ${prayerModal.name}! 🙏\n\nAku lagi mendoakan kamu bulan ini. Gimana kabar & perkembangan pergumulanmu?`,
                );
                if (!pmDone) handlePrayerDone(prayerModal.id);
                setPrayerModal(null);
              }}>
              <VixText heading="bold" additionalStyle={styles.modalWaText}>
                💬 Doakan Pokok Doa
              </VixText>
            </PressableScale>
          )}
          <PressableScale
            style={styles.modalClose}
            onPress={() => setPrayerModal(null)}>
            <VixText heading="label" additionalStyle={styles.modalCloseText}>
              Tutup
            </VixText>
          </PressableScale>
        </>
      )}
    </CenterDialog>

    {/* Modal follow up mingguan: pertanyaan + ganti pertanyaan + ide pendekatan
        + chat WA (mirip modal Doa Rantai). "Selesai" ada di kartu, bukan sini. */}
    <CenterDialog
      visible={!!followupModal}
      onClose={() => setFollowupModal(null)}>
      {followupModal && fmTopic && (
        <>
          <VixText heading="title" additionalStyle={styles.modalTitle}>
            {followupModal.title}
          </VixText>
          <VixText heading="label" additionalStyle={styles.modalSub}>
            {fmTopic.icon} {fmTopic.label}
          </VixText>
          <ScrollView style={styles.modalScroll}>
            {/* Pertanyaan follow up */}
            <View style={styles.questionBox}>
              <VixText heading="paragraph" additionalStyle={styles.questionText}>
                “{fmTopic.question}”
              </VixText>
            </View>
            {/* Ganti pertanyaan — tombol kecil di dalam modal */}
            <PressableScale
              style={styles.modalShuffleButton}
              onPress={() => shuffleTopic(followupModal.id)}>
              <VixText heading="label" additionalStyle={styles.modalShuffleText}>
                🔀 Ganti pertanyaan
              </VixText>
            </PressableScale>
            {/* Ide pendekatan sesuai kepribadian */}
            {fmTips.length > 0 && (
              <>
                <VixText
                  heading="label"
                  additionalStyle={styles.modalTipsLabel}>
                  💡 Ide Pendekatan
                </VixText>
                {fmTips.map((t) => (
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
              </>
            )}
          </ScrollView>
          {followupModal.phone ? (
            <PressableScale
              style={styles.modalWaButton}
              onPress={() => {
                openWhatsApp(
                  followupModal.phone!,
                  `Shalom! 🙏\n\n${fmTopic.question}`,
                );
                setFollowupModal(null);
              }}>
              <VixText heading="bold" additionalStyle={styles.modalWaText}>
                💬 Chat WA
              </VixText>
            </PressableScale>
          ) : (
            <VixText heading="label" additionalStyle={styles.noPhoneText}>
              📱 Isi nomor HP di tab CORE Leader untuk chat WA.
            </VixText>
          )}
          <PressableScale
            style={styles.modalClose}
            onPress={() => setFollowupModal(null)}>
            <VixText heading="label" additionalStyle={styles.modalCloseText}>
              Tutup
            </VixText>
          </PressableScale>
        </>
      )}
    </CenterDialog>
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
  // Doa Rantai — kartu ajakan isi pokok doa (awal bulan), tema spiritual (ungu).
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
  // Kartu header "Doa Rantai" (follow up pokok doa bergilir Sel/Kam/Sab) —
  // gaya kartu hijau tua yang menonjol, senada dengan kartu Follow Up Mingguan.
  doaRantaiCard: {
    backgroundColor: Color.MAIN_DARK,
    borderRadius: 16,
    padding: 16,
    gap: 8,
    marginTop: 6,
    marginBottom: 12,
  },
  doaRantaiTop: {
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    gap: 8,
  },
  doaRantaiTitle: { color: Color.TEXT_REVERSE },
  leaderName: { color: Color.TEXT_TITLE },
  questionBox: {
    backgroundColor: Color.BACKGROUND,
    borderLeftWidth: 3,
    borderLeftColor: Color.MAIN,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  questionText: { color: Color.TEXT_TITLE, fontStyle: 'italic' },
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
  // Baris ringkas CL untuk follow up pokok doa (daftar nama)
  prayerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    backgroundColor: Color.CONTAINER,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Color.WHATSAPP,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 10,
  },
  prayerRowDone: {
    backgroundColor: Color.MAIN_TRANSPARENT,
    borderColor: Color.MAIN_LIGHT,
  },
  prayerRowName: { flex: 1, color: Color.TEXT_TITLE },
  prayerRowMeta: { color: Color.TEXT_LABEL },
  // Kartu follow up mingguan memakai gaya prayerRow (ringkas, ketuk → modal).
  followMain: { flex: 1, gap: 1 },
  followHint: { color: Color.TEXT_LABEL },
  // Tombol "Selesai" kecil di kartu (di luar modal).
  smallDoneButton: {
    backgroundColor: Color.MAIN,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  smallDoneText: { color: Color.TEXT_REVERSE },
  // Tombol "Ganti pertanyaan" kecil di dalam modal follow up.
  modalShuffleButton: {
    alignSelf: 'flex-start',
    backgroundColor: Color.CONTAINER,
    borderWidth: 1,
    borderColor: Color.BORDER,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 8,
    marginBottom: 4,
  },
  modalShuffleText: { color: Color.TEXT_LABEL },
  modalTipsLabel: { color: Color.TEXT_LABEL, marginTop: 8, marginBottom: 6 },
  // Modal tengah (pokok doa & ide pendekatan)
  modalTitle: { color: Color.TEXT_TITLE, marginBottom: 2 },
  modalSub: { color: Color.TEXT_LABEL, marginBottom: 10 },
  modalScroll: { maxHeight: 320, marginBottom: 12 },
  modalPointBox: {
    backgroundColor: Color.CONTAINER,
    borderLeftWidth: 3,
    borderLeftColor: Color.MAIN,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  modalPointText: { color: Color.TEXT_TITLE },
  modalWaButton: {
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Color.WHATSAPP,
  },
  modalWaText: { color: Color.TEXT_REVERSE },
  modalClose: { alignItems: 'center', paddingVertical: 10, marginTop: 4 },
  modalCloseText: { color: Color.TEXT_LABEL },
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
