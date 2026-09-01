import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { CenterDialog } from '@/components/common/CenterDialog';
import { EmojiButton } from '@/components/common/EmojiButton';
import { FormError } from '@/components/common/FormError';
import { GreetingHeader } from '@/components/common/Greeting';
import { PressableScale } from '@/components/common/PressableScale';
import { VixText } from '@/components/common/VixText';
import { useAuth } from '@/contexts/auth';
import {
  birthdayGroupText,
  birthdayPersonalText,
  canDrawWeeklyFocus,
  drawWeeklyFocus,
  focusLeaders,
  followupMessage,
  isCurrentMonthPrayers,
  isPrayerFollowupDay,
  markBirthdayGreeted,
  markPrayerFollowed,
  monthlyPointsFor,
  monthlyPrayersFilled,
  nextBirthday,
  personalityTips,
  prayerChainMessage,
  prayerFollowupLeaders,
  saveCoreLeaders,
  saveWeeklyFocus,
  subscribeBirthdayGreets,
  WEEKLY_FOCUS_COUNT,
  weeklyFollowupTopic,
  type BirthdayGreets,
  type CoreLeader,
  type MainTeamMember,
  type MonthlyPrayers,
  type WeeklyFocus,
} from '@/lib/core';
import { MONTH_NAMES } from '@/lib/format';
import { todayName } from '@/lib/chatTemplates';
import { SAVE_ERROR } from '@/lib/messages';
import {
  openWhatsAppChat,
  shareTextToWhatsApp,
  WHATSAPP_ERROR,
} from '@/lib/whatsapp';

// Tab Follow Up Mingguan: tiap minggu (Sen–Min) fokus ke 2 CORE Leader untuk
// membangun hubungan — Senin pertanyaan doa wajib, hari lain pertanyaan acak
// (8 aspek hidup / diskusi ringan / penggali kepribadian). Plus pengingat
// ulang tahun.
//
// 💡 Idea For CORE pindah ke layarnya sendiri (app/core-ideas.tsx, tombol 💡
// di pojok kanan atas) — dulu ia menumpang di ujung bawah tab ini dan selalu
// kalah: harus digulung jauh dulu tiap mau menambah satu baris.
export function FollowupTab({
  leaders,
  mainTeam,
  dayId,
  monthlyPrayers,
  weeklyFocus,
}: {
  leaders: CoreLeader[];
  mainTeam: MainTeamMember[];
  dayId: string;
  monthlyPrayers: MonthlyPrayers;
  /** Undian ulang fokus minggu ini (kalau tombol 🎲 pernah ditekan Senin ini). */
  weeklyFocus: WeeklyFocus;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const [error, setError] = useState<string | null>(null);
  // Siapa yang sudah dikirimi ucapan ulang tahun hari ini → kartunya hilang.
  const [greets, setGreets] = useState<BirthdayGreets>({});
  useEffect(() => {
    if (!user) return;
    return subscribeBirthdayGreets(user.uid, setGreets);
  }, [user]);
  // "Ganti pertanyaan" → seed acak per orang untuk memilih pertanyaan lain.
  const [topicOverride, setTopicOverride] = useState<Record<string, number>>({});
  // Modal tengah: pokok doa 1 CL (follow up), dan ide pendekatan 1 CL.
  const [prayerModal, setPrayerModal] = useState<CoreLeader | null>(null);
  // Modal follow up mingguan (mirip Doa Rantai): click kartu CL → lihat
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
        gender: l.gender ?? null,
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
          gender: m.gender ?? null,
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

  // 2 CORE Leader fokus minggu ini: hasil undian 🎲 Senin ini kalau ada,
  // kalau tidak rotasi bawaan (bergilir tiap minggu).
  const weekLeaders = useMemo(
    () => focusLeaders(leaders, new Date(), weeklyFocus),
    // dayId sebagai dependency: pindah hari/minggu → hitung ulang.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [leaders, dayId, weeklyFocus],
  );

  // Tombol undi ulang hanya muncul SENIN, dan hanya kalau memang ada CL lain
  // yang bisa terpilih — kalau CL-nya pas dua orang, mengundi tidak mengubah
  // apa pun.
  const bisaUndi =
    canDrawWeeklyFocus(new Date()) && leaders.length > WEEKLY_FOCUS_COUNT;
  const [drawing, setDrawing] = useState(false);

  async function handleDrawWeekly() {
    if (!user || drawing) return;
    setDrawing(true);
    setError(null);
    try {
      await saveWeeklyFocus(
        user.uid,
        drawWeeklyFocus(leaders, weekLeaders, new Date()),
      );
    } catch {
      setError(SAVE_ERROR);
    } finally {
      setDrawing(false);
    }
  }

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
  // Selasa & Kamis → follow up pokok doa (bergilir beberapa CL per sesi).
  const isPrayerDay = isPrayerFollowupDay(nowDate);
  const prayerLeadersToday = prayerFollowupLeaders(leaders, monthPoints, nowDate);

  // Tandai satu CL sudah difollowup pokok doanya pada sesi hari ini.
  // Aturannya (termasuk reset saat ganti bulan) ada di lib/core.ts, dipakai
  // bersama dengan gerbang doa pagi.
  async function handlePrayerDone(leaderId: string) {
    if (!user) return;
    setError(null);
    try {
      await markPrayerFollowed(
        user.uid,
        monthlyPrayers,
        leaderId,
        nowDate,
        dayId,
      );
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
    openWhatsAppChat(phone, text, () => setError('Gagal membuka WhatsApp.'));
  }

  /** Tandai sudah diucapkan hari ini → kartunya hilang dari daftar. */
  function markGreeted(personId: string) {
    if (!user) return;
    markBirthdayGreeted(user.uid, personId, dayId).catch(() => {});
  }

  // Kartu follow up mingguan — RINGKAS seperti Doa Rantai: click untuk buka
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
    // Pertanyaannya tidak ditampilkan di kartu — muncul di dalam modal saat
    // kartu ditekan (lihat `modalTopic` di bawah).
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

  // Kartu ringkas 1 CL untuk follow up pokok doa (Selasa & Kamis). Di-click →
  // modal tengah berisi seluruh pokok doa + tombol WA.
  //
  // Bentuknya DUA KOLOM (lihat `prayerGrid`): satu baris per CL bikin blok Doa
  // Rantai memanjang ke bawah dan mendorong Follow Up Mingguan keluar layar.
  // Isinya cuma nama + jumlah poin, jadi separuh lebar sudah lega.
  function renderPrayerCard(leader: CoreLeader) {
    const pts = monthPoints[leader.id] ?? [];
    const done =
      isCurrentMonthPrayers(monthlyPrayers, nowDate) &&
      monthlyPrayers.followedDayId[leader.id] === dayId;
    return (
      <PressableScale
        key={leader.id}
        style={[styles.prayerCell, done && styles.prayerRowDone]}
        onPress={() => setPrayerModal(leader)}>
        <VixText
          heading="bold"
          numberOfLines={1}
          additionalStyle={styles.prayerRowName}>
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

      <FormError message={error} />

      {/* ===== Ulang tahun hari ini (CL + Main Team) =====
          Yang sudah dikirimi ucapan hari ini tidak ditampilkan lagi. */}
      {birthdays.today
        .filter((b) => greets[b.key] !== dayId)
        .map((b) => (
          <View key={b.key} style={styles.birthdayCard}>
            <VixText heading="title" additionalStyle={styles.birthdayTitle}>
              🎂 {b.label} ulang tahun HARI INI!
            </VixText>
            <VixText heading="paragraph" additionalStyle={styles.birthdayText}>
              {b.sub ? `${b.sub} — ` : ''}Genap {b.turningAge} tahun. Jangan
              lupa kirim ucapan & doa 🥳
            </VixText>
            {/* Dua ucapan, dua templat berbeda:
                • Grup     → dibuka tanpa nomor, nama grupnya dipilih di WhatsApp
                • Personal → langsung ke nomornya, isinya menyesuaikan cowok/cewek
                Keduanya sama-sama menandai "sudah diucapkan hari ini". */}
            <View style={styles.waRow}>
              <PressableScale
                style={[styles.waButton, styles.waFlex]}
                onPress={() => {
                  shareTextToWhatsApp(birthdayGroupText(b.name), () =>
                    setError(WHATSAPP_ERROR),
                  );
                  markGreeted(b.key);
                }}>
                <VixText heading="bold" additionalStyle={styles.waText}>
                  👥 Grup
                </VixText>
              </PressableScale>
              {b.phone && (
                <PressableScale
                  style={[styles.waButton, styles.waFlex]}
                  onPress={() => {
                    openWhatsApp(
                      b.phone!,
                      birthdayPersonalText(b.name, b.gender),
                    );
                    markGreeted(b.key);
                  }}>
                  <VixText heading="bold" additionalStyle={styles.waText}>
                    💬 Personal
                  </VixText>
                </PressableScale>
              )}
            </View>
            {!b.phone && (
              <VixText heading="label" additionalStyle={styles.birthdayHint}>
                ℹ️ Nomor WA-nya belum diisi — chat pribadi belum bisa langsung.
              </VixText>
            )}
            {!b.gender && (
              <VixText heading="label" additionalStyle={styles.birthdayHint}>
                ℹ️ Cowok/cewek belum diisi di tab Leaders — ucapan pribadinya
                pakai versi umum dulu.
              </VixText>
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

      {/* ===== Doa Rantai: isi pokok doa (awal bulan) / follow up (Selasa & Kamis) ===== */}
      {monthNeedsFill ? (
        <PressableScale
          style={styles.prayerFillCard}
          onPress={() => router.push('/monthly-prayers')}>
          <VixText heading="title" additionalStyle={styles.prayerFillTitle}>
            🔗 Doa Rantai — {monthTitle}
          </VixText>
          <VixText heading="label" additionalStyle={styles.prayerFillText}>
            Awal bulan! Tanyakan & isi pokok doa tiap CORE Leader dulu — ini yang
            jadi dasar follow up Selasa & Kamis 🙏
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
          <View style={styles.prayerGrid}>
            {prayerLeadersToday.map((l) => renderPrayerCard(l))}
          </View>
        </>
      ) : null}

      {/* ===== Follow Up Mingguan: fokus 2 CORE Leader ===== */}
      <View style={styles.weekCard}>
        <View style={styles.weekTop}>
          <VixText heading="title" additionalStyle={styles.weekTitle}>
            🎯  Follow Up Mingguan
          </VixText>
          {/* 🎲 undi ulang — SENIN saja (lihat canDrawWeeklyFocus). */}
          {bisaUndi && (
            <EmojiButton
              emoji="🎲"
              busy={drawing}
              onPress={handleDrawWeekly}
            />
          )}
        </View>
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

    </ScrollView>

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
          <ScrollView
            style={styles.modalScroll}
            showsVerticalScrollIndicator={false}>
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
                  prayerChainMessage(prayerModal.name, pmPts),
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
          <ScrollView
            style={styles.modalScroll}
            showsVerticalScrollIndicator={false}>
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
          {/* Pengingat Motivational Word 🔥 — ditaruh persis di atas tombol
              Chat WA, karena di sinilah WhatsApp dibuka. Follow up itu urusan
              satu orang; Motivational Word urusan GRUP dan gampang terlewat
              justru pada pagi yang sibuk mengejar follow up. Click-nya
              membawa ke Template Chat, yang memang sudah membuka kategori
              Motivational Words dengan pilihan hari ini tersorot. */}
          <PressableScale
            style={styles.motivasiRow}
            onPress={() => {
              setFollowupModal(null);
              router.push('/chat-templates');
            }}>
            <VixText heading="label" additionalStyle={styles.motivasiText}>
              🔥 Sudah kirim Motivational Word {todayName()} ke grup CORE?
            </VixText>
            <VixText heading="label" additionalStyle={styles.motivasiLink}>
              Buka Template Chat ›
            </VixText>
          </PressableScale>
          {followupModal.phone ? (
            <PressableScale
              style={styles.modalWaButton}
              onPress={() => {
                openWhatsApp(followupModal.phone!, followupMessage(fmTopic));
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
  birthdayCard: {
    backgroundColor: Color.ACCENT,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    gap: 6,
  },
  birthdayTitle: { color: Color.ACCENT_DARK },
  birthdayText: { color: Color.ACCENT_DARK },
  birthdayHint: { color: Color.ACCENT_DARK },
  // Dua tombol ucapan bersebelahan, lebarnya dibagi rata.
  waRow: { flexDirection: 'row', gap: 10 },
  waFlex: { flex: 1 },
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
  // Judul di kiri, tombol 🎲 di kanan — judulnya yang mengalah kalau sempit.
  weekTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
  },
  weekTitle: { color: Color.TEXT_REVERSE, flexShrink: 1 },
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
  // Kartu header "Doa Rantai" (follow up pokok doa bergilir Selasa & Kamis) —
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
  // Doa Rantai → dua kolom. `flexBasis` 47% + `flexGrow` bikin sisa satu kartu
  // (jumlah CL ganjil) melebar penuh, bukan menggantung setengah kosong.
  prayerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 10,
  },
  prayerCell: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: Color.CONTAINER,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Color.WHATSAPP,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 2,
  },
  // Tanpa flex: di dalam kartu 2 kolom (arah kolom) flex justru memanjangkan
  // barisnya ke bawah, bukan melebarkannya.
  prayerRowName: { color: Color.TEXT_TITLE },
  prayerRowMeta: { color: Color.TEXT_LABEL },
  followMain: { flex: 1, gap: 1 },
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
  // Pengingat Motivational Word 🔥 — sengaja TIDAK sekuat tombol Chat WA:
  // ia mengingatkan, bukan menggantikan yang sedang dikerjakan.
  motivasiRow: {
    backgroundColor: Color.MAIN_TRANSPARENT,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    gap: 2,
  },
  motivasiText: { color: Color.MAIN_DARK },
  motivasiLink: { color: Color.MAIN },
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
});
