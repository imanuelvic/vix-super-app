import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { Chip } from '@/components/common/Chip';
import { DateField } from '@/components/common/DateField';
import { DualButtons } from '@/components/common/DualButtons';
import { EditButton } from '@/components/common/EditButton';
import { EditDelete } from '@/components/common/EditDelete';
import { EmojiButton } from '@/components/common/EmojiButton';
import { FormError } from '@/components/common/FormError';
import { FormInput } from '@/components/common/FormInput';
import { PressableScale } from '@/components/common/PressableScale';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { SelectField } from '@/components/common/SelectField';
import { SheetModal } from '@/components/common/SheetModal';
import { StickyTop } from '@/components/common/StickyTop';
import { VixText } from '@/components/common/VixText';
import { LeaderBodyDialog } from '@/components/core/LeaderBodyDialog';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/contexts/auth';
import { useFormSave } from '@/hooks/useFormSave';
import {
    archiveCoreLeader,
    currentAge,
    DISC_OPTIONS,
    EMPTY_LEADER_BODY,
    EMPTY_STUDY_WORK,
    GENDER_OPTIONS,
    HEARTS,
    leaderBodyOf,
    leaderBodyPayload,
    LOVE_LANG_OPTIONS,
    loveLangLabel,
    MBTI_TYPES,
    newCoreLeaderId,
    newMainTeamId,
    nextBirthday,
    normalizePhone,
    saveCoreLeaders,
    saveMainTeam,
    studyLine,
    studyWorkOf,
    studyWorkPayload,
    workLine,
    type CoreLeader,
    type Gender,
    type LeaderBody,
    type MainTeamMember,
    type StudyWork,
} from '@/lib/core';
import { MONTH_NAMES } from '@/lib/format';
import { dayDocId } from '@/lib/health';
import { DELETE_ERROR, SAVE_ERROR } from '@/lib/messages';

/**
 * Yang sedang DILIHAT (bukan diubah) di modal baca-saja.
 *
 * Dulu menekan barisnya langsung membuka form edit — sekali salah pencet saat
 * cuma ingin mengintip nomor WA-nya, satu klik lagi sudah bisa mengubah
 * data. Sekarang klik baris = lihat saja; mengubah harus lewat tombol ✏️.
 */
type Viewing = {
  emoji: string;
  kind: string;
  /** Baris kecil di bawah judul — Main Team menyebut CL yang dibantunya. */
  sub: string | null;
  person: CoreLeader | MainTeamMember;
};

/**
 * Anak ScrollView yang DIPATOK di atas saat digulung: judul "🫶 CORE Leader"
 * (1) & "👥 Main Team" (3).
 *
 * Urutan anaknya: 0 FormError · 1 judul CL · 2 daftar CL · 3 judul MT ·
 * 4 daftar MT. Kelima-limanya SELALU dirender (daftarnya dibungkus <View>
 * yang isinya saja yang kosong saat tertutup), jadi nomornya tidak pernah
 * bergeser. Ditaruh di luar komponen supaya bukan array baru tiap render.
 */
const STICKY_HEADERS = [1, 3];

// Tab CORE Leader: data semua CL + Main Team yang membantu mereka —
// nama, warna hati CORE, tanggal lahir, umur, nomor WA, dan hitung
// mundur ulang tahun.
export function LeadersTab({
  leaders,
  mainTeam,
}: {
  leaders: CoreLeader[];
  mainTeam: MainTeamMember[];
}) {
  const { user } = useAuth();
  const router = useRouter();

  // Modal baca-saja (dibuka dengan menekan barisnya).
  const [viewing, setViewing] = useState<Viewing | null>(null);

  const [error, setError] = useState<string | null>(null);
  const { busy, setBusy, formError, setFormError, save } = useFormSave();

  // Dropdown daftar — default TERTUTUP biar layar tidak langsung penuh list.
  const [clOpen, setClOpen] = useState(false);
  const [mtOpen, setMtOpen] = useState(false);

  // Form CORE Leader. 'new' = sedang menambah baru.
  const [editing, setEditing] = useState<CoreLeader | 'new' | null>(null);
  const [fName, setFName] = useState('');
  const [fHeart, setFHeart] = useState('❤️');
  const [fBirthday, setFBirthday] = useState(new Date(2000, 0, 1));
  const [fPhone, setFPhone] = useState('');
  const [fGender, setFGender] = useState<Gender | null>(null);
  const [fDisc, setFDisc] = useState<string | null>(null);
  const [fMbti, setFMbti] = useState<string | null>(null);
  const [fLove, setFLove] = useState<string | null>(null);
  // Pendidikan & pekerjaan — satu objek, bukan 4 state terpisah.
  const [fStudy, setFStudy] = useState<StudyWork>(EMPTY_STUDY_WORK);
  // Data tubuh — sama polanya: satu objek berisi tiga isian teks.
  const [fBody, setFBody] = useState<LeaderBody>(EMPTY_LEADER_BODY);
  // Mode "lepas CL": ganti isi modal edit jadi form alasan sebelum diarsipkan.
  const [archiving, setArchiving] = useState(false);
  const [archiveReason, setArchiveReason] = useState('');

  // CL yang data tubuhnya sedang dilihat (null = dialognya tertutup).
  const [bodyOf, setBodyOf] = useState<CoreLeader | null>(null);

  // Form Main Team (terpisah karena field-nya beda: pilih CL, tanpa hati).
  const [editingMT, setEditingMT] = useState<MainTeamMember | 'new' | null>(null);
  const [mtName, setMtName] = useState('');
  const [mtLeaderId, setMtLeaderId] = useState('');
  const [mtBirthday, setMtBirthday] = useState(new Date(2000, 0, 1));
  const [mtPhone, setMtPhone] = useState('');
  const [mtGender, setMtGender] = useState<Gender | null>(null);
  const [mtDisc, setMtDisc] = useState<string | null>(null);
  const [mtMbti, setMtMbti] = useState<string | null>(null);
  const [mtLove, setMtLove] = useState<string | null>(null);
  const [mtStudy, setMtStudy] = useState<StudyWork>(EMPTY_STUDY_WORK);
  const [mtFormError, setMtFormError] = useState<string | null>(null);

  const today = new Date();

  // Main Team diurutkan mengikuti urutan CL-nya biar kelompoknya terlihat.
  const sortedMT = [...mainTeam].sort((a, b) => {
    const ia = leaders.findIndex((l) => l.id === a.leaderId);
    const ib = leaders.findIndex((l) => l.id === b.leaderId);
    if (ia !== ib) return ia - ib;
    return a.name.localeCompare(b.name);
  });

  function leaderOf(m: MainTeamMember): CoreLeader | undefined {
    return leaders.find((l) => l.id === m.leaderId);
  }

  // ===== CORE Leader =====

  function openAdd() {
    setEditing('new');
    setFName('');
    setFHeart('💚');
    setFBirthday(new Date(2000, 0, 1));
    setFPhone('');
    setFGender(null);
    setFDisc(null);
    setFMbti(null);
    setFLove(null);
    setFStudy(EMPTY_STUDY_WORK);
    setFBody(EMPTY_LEADER_BODY);
    setFormError(null);
    setArchiving(false);
    setArchiveReason('');
  }

  function openEdit(l: CoreLeader) {
    setEditing(l);
    setFName(l.name);
    setFHeart(l.heart);
    setFBirthday(new Date(l.birthYear, l.birthMonth, l.birthDay));
    setFPhone(l.phone ?? '');
    setFGender(l.gender ?? null);
    setFDisc(l.disc ?? null);
    setFMbti(l.mbti ?? null);
    setFLove(l.loveLanguage ?? null);
    setFStudy(studyWorkOf(l));
    setFBody(leaderBodyOf(l));
    setFormError(null);
    setArchiving(false);
    setArchiveReason('');
  }

  async function handleSave() {
    if (!user || !editing || busy) return;
    if (!fName.trim()) {
      setFormError('Nama wajib diisi.');
      return;
    }
    const data: CoreLeader = {
      id: editing === 'new' ? newCoreLeaderId() : editing.id,
      name: fName.trim(),
      heart: fHeart,
      birthYear: fBirthday.getFullYear(),
      birthMonth: fBirthday.getMonth(),
      birthDay: fBirthday.getDate(),
      phone: normalizePhone(fPhone), // "08…" / "+62…" / "62…" semua dirapikan
      lastFollowupDayId: editing === 'new' ? null : editing.lastFollowupDayId,
      gender: fGender,
      disc: fDisc,
      mbti: fMbti,
      loveLanguage: fLove,
      ...studyWorkPayload(fStudy),
      // Tanggalnya cuma bergerak kalau ANGKANYA berubah — lihat
      // leaderBodyPayload di lib/core.ts.
      ...leaderBodyPayload(
        fBody,
        editing === 'new' ? {} : editing,
        dayDocId(today),
      ),
    };
    const next =
      editing === 'new'
        ? [...leaders, data]
        : leaders.map((l) => (l.id === editing.id ? data : l));
    await save(async () => {
      await saveCoreLeaders(user.uid, next);
      setEditing(null);
    });
  }

  async function handleDelete() {
    if (!user || !editing || editing === 'new' || busy) return;
    setBusy(true);
    try {
      await saveCoreLeaders(user.uid, leaders.filter((l) => l.id !== editing.id));
    } catch {
      setError(DELETE_ERROR);
    } finally {
      setEditing(null);
      setBusy(false);
    }
  }

  // Lepas CL: pindahkan ke arsip Ex CORE Leader beserta alasannya.
  async function handleArchive() {
    if (!user || !editing || editing === 'new' || busy) return;
    if (!archiveReason.trim()) {
      setFormError('Isi dulu alasannya.');
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      await archiveCoreLeader(
        user.uid,
        leaders,
        editing,
        archiveReason.trim(),
        dayDocId(new Date()),
      );
      setEditing(null);
      setArchiving(false);
    } catch {
      setFormError(SAVE_ERROR);
    } finally {
      setBusy(false);
    }
  }

  // ===== Main Team =====

  function openAddMT() {
    setEditingMT('new');
    setMtName('');
    setMtLeaderId(leaders[0]?.id ?? '');
    setMtBirthday(new Date(2000, 0, 1));
    setMtPhone('');
    setMtGender(null);
    setMtDisc(null);
    setMtMbti(null);
    setMtLove(null);
    setMtStudy(EMPTY_STUDY_WORK);
    setMtFormError(null);
  }

  function openEditMT(m: MainTeamMember) {
    setEditingMT(m);
    setMtName(m.name);
    setMtLeaderId(m.leaderId);
    setMtBirthday(new Date(m.birthYear, m.birthMonth, m.birthDay));
    setMtPhone(m.phone ?? '');
    setMtGender(m.gender ?? null);
    setMtDisc(m.disc ?? null);
    setMtMbti(m.mbti ?? null);
    setMtLove(m.loveLanguage ?? null);
    setMtStudy(studyWorkOf(m));
    setMtFormError(null);
  }

  async function handleSaveMT() {
    if (!user || !editingMT || busy) return;
    if (!mtName.trim()) {
      setMtFormError('Nama wajib diisi.');
      return;
    }
    if (!mtLeaderId) {
      setMtFormError('Pilih CORE Leader-nya dulu.');
      return;
    }
    setBusy(true);
    setMtFormError(null);
    const data: MainTeamMember = {
      id: editingMT === 'new' ? newMainTeamId() : editingMT.id,
      name: mtName.trim(),
      leaderId: mtLeaderId,
      birthYear: mtBirthday.getFullYear(),
      birthMonth: mtBirthday.getMonth(),
      birthDay: mtBirthday.getDate(),
      phone: normalizePhone(mtPhone),
      lastFollowupDayId: editingMT === 'new' ? null : editingMT.lastFollowupDayId,
      gender: mtGender,
      disc: mtDisc,
      mbti: mtMbti,
      loveLanguage: mtLove,
      ...studyWorkPayload(mtStudy),
    };
    const next =
      editingMT === 'new'
        ? [...mainTeam, data]
        : mainTeam.map((m) => (m.id === editingMT.id ? data : m));
    try {
      await saveMainTeam(user.uid, next);
      setEditingMT(null);
    } catch {
      setMtFormError(SAVE_ERROR);
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteMT() {
    if (!user || !editingMT || editingMT === 'new' || busy) return;
    setBusy(true);
    try {
      await saveMainTeam(
        user.uid,
        mainTeam.filter((m) => m.id !== editingMT.id),
      );
    } catch {
      setError(DELETE_ERROR);
    } finally {
      setEditingMT(null);
      setBusy(false);
    }
  }

  return (
    <View style={styles.flex}>
      {/* Dua tombol tambah sebelahan: CL (warna utama) & MT (accent). Dipatok
          di atas supaya tetap terjangkau walau daftar orangnya dibuka semua. */}
      <StickyTop>
        <View style={styles.addRow}>
          <PrimaryButton
            label="CORE Leader"
            icon="plus"
            onPress={openAdd}
            additionalStyle={styles.addFlex}
          />
          <PrimaryButton
            label="Main Team"
            icon="plus"
            background={Color.ACCENT}
            textColor={Color.ACCENT_DARK}
            onPress={openAddMT}
            additionalStyle={styles.addFlex}
          />
        </View>
      </StickyTop>

      {/* Judul "🫶 CORE Leader" & "👥 Main Team" DIPATOK di atas selama
          daftarnya digulung — jadi tombol tutupnya selalu terjangkau, tak perlu
          menggulung balik ke atas melewati sembilan kartu dulu.

          `stickyHeaderIndices` menghitung ANAK LANGSUNG ScrollView, jadi
          jumlahnya tidak boleh berubah-ubah. Karena itu kedua daftarnya
          dibungkus <View> yang SELALU ada (isinya yang kosong saat tertutup) —
          kalau ditulis `{clOpen && …}` telanjang, saat tertutup anaknya hilang
          dan nomor patokannya meleset ke elemen lain. */}
      <ScrollView
        contentContainerStyle={styles.content}
        stickyHeaderIndices={STICKY_HEADERS}>
        <FormError message={error} />
        {/* Dropdown CORE Leader (default tertutup) */}
        <PressableScale
          style={styles.toggleHeader}
          onPress={() => setClOpen((o) => !o)}>
          <View style={styles.toggleRow}>
            <VixText
              heading="title"
              numberOfLines={1}
              additionalStyle={styles.toggleTitle}>
              🫶 CORE Leader
            </VixText>
            <View style={styles.toggleRight}>
              <VixText heading="label">
                {clOpen ? 'Tutup' : `${leaders.length} orang`}
              </VixText>
              <IconSymbol
                name={clOpen ? 'chevron.up' : 'chevron.down'}
                size={18}
                color={Color.TEXT_LABEL}
              />
            </View>
          </View>
        </PressableScale>

        <View>
        {clOpen && leaders.map((l) => {
          const { daysUntil } = nextBirthday(l, today);
          const soon = daysUntil <= 30;
          return (
            // Tombol 🎡 & ✏️ jadi SAUDARA area klik, bukan anaknya —
            // Pressable bersarang di iOS bikin klik tombolnya ikut
            // membuka modal barisnya.
            <View key={l.id} style={styles.card}>
              {/* Klik baris = LIHAT data CL (baca-saja), bukan mengubahnya. */}
              <PressableScale
                style={styles.cardLeft}
                onPress={() =>
                  setViewing({
                    emoji: l.heart,
                    kind: 'CORE Leader',
                    sub: null,
                    person: l,
                  })
                }>
                <VixText additionalStyle={styles.heart}>{l.heart}</VixText>
                <View style={styles.cardInfo}>
                  <VixText heading="bold" additionalStyle={styles.name}>
                    {l.name}
                  </VixText>
                  <VixText heading="label">
                    {l.birthDay} {MONTH_NAMES[l.birthMonth]} {l.birthYear} ·{' '}
                    {currentAge(l, today)} th
                  </VixText>
                  <VixText heading="label" additionalStyle={styles.followupLine}>
                    📱 {l.phone ? `+62${l.phone}` : 'belum ada nomor'}
                  </VixText>
                  <PersonalityBadges person={l} />
                </View>
              </PressableScale>
              <View style={styles.cardRight}>
                {/* Tombol kartu, dua baris — DULU bertiga berjajar di satu
                    baris atas, dan di iPhone 15 barisnya jadi sepadat itu
                    sampai nama CL-nya ikut terhimpit.
                      baris 1 · 🎡 Wheel of Life CL ini (layar yang sama persis
                                dengan roda milikku, cuma datanya per CL) +
                                ✏️ ubah datanya
                      baris 2 · 🧍 data tubuhnya (BACA saja — diubah lewat ✏️)
                    Yang turun ke bawah sengaja yang 🧍: ia paling jarang
                    ditekan, dan ruang di bawah ✏️ memang menganggur. */}
                <View style={styles.cardActions}>
                  <EmojiButton
                    emoji="🎡"
                    onPress={() =>
                      router.push({
                        pathname: '/wheel',
                        params: { leaderId: l.id, name: l.name, heart: l.heart },
                      })
                    }
                  />
                  <EditButton onPress={() => openEdit(l)} />
                </View>
                {/* baris 2 · 📍 Timeline CL ini + 🧍 data tubuhnya.
                    Timeline-nya LAYAR YANG SAMA dengan My Timeline di Profile,
                    cuma datanya per CL — sama seperti 🎡 Wheel di atasnya.
                    Tahun lahirnya ikut dioper supaya chip umurnya menghitung
                    umur DIA, bukan umurku. */}
                <View style={styles.cardActions}>
                  <EmojiButton
                    emoji="📍"
                    onPress={() =>
                      router.push({
                        pathname: '/timeline',
                        params: {
                          leaderId: l.id,
                          name: l.name,
                          heart: l.heart,
                          birthYear: String(l.birthYear),
                        },
                      })
                    }
                  />
                  <EmojiButton emoji="🧍" onPress={() => setBodyOf(l)} />
                </View>
                {soon && (
                  <View style={styles.birthdayChip}>
                    <VixText heading="label" additionalStyle={styles.birthdayChipText}>
                      🎂 {daysUntil === 0 ? 'Hari ini!' : `${daysUntil} hr lagi`}
                    </VixText>
                  </View>
                )}
              </View>
            </View>
          );
        })}
        </View>

        {/* ===== Main Team (dropdown, default tertutup) ===== */}
        <PressableScale
          style={styles.toggleHeader}
          onPress={() => setMtOpen((o) => !o)}>
          <View style={styles.toggleRow}>
            <VixText
              heading="title"
              numberOfLines={1}
              additionalStyle={styles.toggleTitle}>
              👥 Main Team
            </VixText>
            <View style={styles.toggleRight}>
              <VixText heading="label">
                {mtOpen ? 'Tutup' : `${mainTeam.length} orang`}
              </VixText>
              <IconSymbol
                name={mtOpen ? 'chevron.up' : 'chevron.down'}
                size={18}
                color={Color.TEXT_LABEL}
              />
            </View>
          </View>
        </PressableScale>
        <View>
        {mtOpen && (
          <>
        {sortedMT.length === 0 && (
          <VixText heading="label" additionalStyle={styles.emptyText}>
            Belum ada Main Team. Tiap CL biasanya punya 2–4 orang.
          </VixText>
        )}

        {sortedMT.map((m) => {
          const cl = leaderOf(m);
          const { daysUntil } = nextBirthday(m, today);
          const soon = daysUntil <= 30;
          return (
            // Sama seperti kartu CL: klik baris = lihat, ✏️ = ubah.
            <View key={m.id} style={styles.card}>
              <PressableScale
                style={styles.cardLeft}
                onPress={() =>
                  setViewing({
                    emoji: '👤',
                    kind: 'Main Team',
                    sub: cl ? `Membantu ${cl.heart} ${cl.name}` : null,
                    person: m,
                  })
                }>
                <VixText additionalStyle={styles.heart}>👤</VixText>
                <View style={styles.cardInfo}>
                  <VixText heading="bold" additionalStyle={styles.name}>
                    {m.name}
                  </VixText>
                  <VixText heading="label">
                    MT {cl ? `${cl.name} ${cl.heart}` : '(CL tidak ditemukan)'}
                  </VixText>
                  <VixText heading="label">
                    {m.birthDay} {MONTH_NAMES[m.birthMonth]} {m.birthYear} ·{' '}
                    {currentAge(m, today)} th
                  </VixText>
                  <VixText heading="label" additionalStyle={styles.followupLine}>
                    📱 {m.phone ? `+62${m.phone}` : 'belum ada nomor'}
                  </VixText>
                  <PersonalityBadges person={m} />
                </View>
              </PressableScale>
              <View style={styles.cardRight}>
                <View style={styles.cardActions}>
                  <EditButton onPress={() => openEditMT(m)} />
                </View>
                {soon && (
                  <View style={styles.birthdayChip}>
                    <VixText heading="label" additionalStyle={styles.birthdayChipText}>
                      🎂 {daysUntil === 0 ? 'Hari ini!' : `${daysUntil} hr lagi`}
                    </VixText>
                  </View>
                )}
              </View>
            </View>
          );
        })}
          </>
        )}
        </View>
      </ScrollView>

      {/* Data tubuh CL 🧍 — juga BACA-SAJA, aturan yang sama. */}
      <LeaderBodyDialog leader={bodyOf} onClose={() => setBodyOf(null)} />

      {/* Modal BACA-SAJA — muncul saat barisnya di-klik. Tidak ada satu pun
          kolom yang bisa diubah di sini; mengubah lewat tombol ✏️ di kartunya. */}
      <SheetModal
        visible={viewing !== null}
        title={viewing ? `${viewing.emoji} ${viewing.person.name}` : ''}
        subtitle={
          viewing
            ? viewing.sub
              ? `${viewing.kind} · ${viewing.sub}`
              : viewing.kind
            : undefined
        }
        onClose={() => setViewing(null)}
        footer={
          <PressableScale
            style={styles.closeButton}
            onPress={() => setViewing(null)}>
            <VixText heading="bold" additionalStyle={styles.closeButtonText}>
              Tutup
            </VixText>
          </PressableScale>
        }>
        {viewing ? <PersonView person={viewing.person} today={today} /> : null}
      </SheetModal>

      {/* Bottom sheet tambah/edit CL */}
      <SheetModal
        visible={!!editing}
        title={
          editing === 'new'
            ? 'Tambah CORE Leader'
            : archiving
              ? 'Lepas CORE Leader'
              : 'Edit CORE Leader'
        }
        scroll={false}
        onClose={() => {
          setEditing(null);
          setArchiving(false);
        }}
        footer={
          archiving && editing !== 'new' && editing !== null ? (
            <DualButtons
              confirmLabel="Lanjutkan"
              busy={busy}
              onCancel={() => setArchiving(false)}
              onConfirm={handleArchive}
            />
          ) : (
            <DualButtons
              confirmLabel="Simpan"
              busy={busy}
              onCancel={() => setEditing(null)}
              onConfirm={handleSave}
            />
          )
        }>
        <ScrollView
          style={styles.formScroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {archiving && editing !== 'new' && editing !== null ? (
            <>
              <VixText heading="label" additionalStyle={styles.fieldLabel}>
                Alasan sudah tidak dipegang
              </VixText>
              <FormInput
                style={styles.archiveInput}
                placeholder="mis. Mundur jadi CL · Naik jadi MCL"
                value={archiveReason}
                onChangeText={setArchiveReason}
                editable={!busy}
                multiline
              />
              <FormError message={formError} />
            </>
          ) : (
            // ===== Form edit/tambah CL =====
            <>
              <FormInput
                style={styles.formGap}
                placeholder="Nama"
                value={fName}
                onChangeText={setFName}
                editable={!busy}
              />

              <VixText heading="label" additionalStyle={styles.fieldLabel}>
                Warna CORE
              </VixText>
              <View style={styles.heartWrap}>
                {HEARTS.map((h) => (
                  <PressableScale
                    key={h}
                    style={[styles.heartChip, fHeart === h && styles.heartActive]}
                    onPress={() => setFHeart(h)}>
                    <VixText additionalStyle={styles.heartOption}>{h}</VixText>
                  </PressableScale>
                ))}
              </View>

              <VixText heading="label" additionalStyle={styles.fieldLabel}>
                Tanggal Lahir
              </VixText>
              <View style={styles.formGap}>
                {/* key = id supaya state picker internal reset tiap ganti CL */}
                <DateField
                  key={editing === 'new' ? 'new' : editing?.id}
                  value={fBirthday}
                  onChange={setFBirthday}
                />
              </View>

              <VixText heading="label" additionalStyle={styles.fieldLabel}>
                No. HP
              </VixText>
              <View style={styles.phoneRow}>
                <View style={styles.phonePrefix}>
                  <VixText
                    heading="bold"
                    additionalStyle={styles.phonePrefixText}>
                    +62
                  </VixText>
                </View>
                <FormInput
                  style={styles.phoneInput}
                  placeholder="81234567890"
                  keyboardType="phone-pad"
                  value={fPhone}
                  onChangeText={(t) => setFPhone(t.replace(/\D/g, ''))}
                  editable={!busy}
                />
              </View>

              <GenderField value={fGender} onChange={setFGender} />

              {/* Pendidikan & pekerjaan — bahan obrolan visitasi & doa */}
              <StudyWorkFields
                value={fStudy}
                onChange={setFStudy}
                busy={busy}
              />

              {/* Kepribadian — bantu cara pendekatan & ide chat */}
              <PersonalityFields
                disc={fDisc}
                setDisc={setFDisc}
                mbti={fMbti}
                setMbti={setFMbti}
                love={fLove}
                setLove={setFLove}
              />

              {/* Data tubuh 🧍 — SATU-SATUNYA tempat mengubahnya. Tombol 🧍 di
                  kartu cuma menampilkannya. */}
              <VixText heading="bold" additionalStyle={styles.bodyHeading}>
                🧍 Data Tubuh
              </VixText>
              <View style={styles.bodyRow}>
                {(
                  [
                    ['height', 'Tinggi (cm)', '169'],
                    ['weight', 'Berat (kg)', '58'],
                    ['waist', 'Lingkar perut (cm)', '72'],
                  ] as const
                ).map(([key, label, contoh]) => (
                  <View key={key} style={styles.bodyField}>
                    <VixText heading="label" additionalStyle={styles.bodyLabel}>
                      {label}
                    </VixText>
                    <FormInput
                      placeholder={contoh}
                      keyboardType="decimal-pad"
                      value={fBody[key]}
                      onChangeText={(t) => setFBody((b) => ({ ...b, [key]: t }))}
                      editable={!busy}
                    />
                  </View>
                ))}
              </View>

              <FormError message={formError} />
              <EditDelete
                editing={editing}
                label="Hapus CORE Leader ini"
                busy={busy}
                onDelete={handleDelete}
              />
              {editing !== 'new' && editing !== null && (
                <PressableScale
                  style={styles.archiveButton}
                  disabled={busy}
                  onPress={() => {
                    setArchiving(true);
                    setFormError(null);
                  }}>
                  <VixText
                    heading="bold"
                    additionalStyle={styles.archiveButtonText}>
                    👋 CORE Leader ini sudah tidak saya pegang
                  </VixText>
                </PressableScale>
              )}
            </>
          )}
        </ScrollView>
      </SheetModal>

      {/* Bottom sheet tambah/edit Main Team */}
      <SheetModal
        visible={!!editingMT}
        title={editingMT === 'new' ? 'Tambah Main Team' : 'Edit Main Team'}
        scroll={false}
        onClose={() => setEditingMT(null)}>
        <ScrollView
          style={styles.formScroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
        <FormInput
          style={styles.formGap}
          placeholder="Nama"
          value={mtName}
          onChangeText={setMtName}
          editable={!busy}
        />

        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          Membantu CORE Leader
        </VixText>
        <View style={styles.leaderWrap}>
          {leaders.map((l) => (
            <Chip
              key={l.id}
              label={`${l.heart} ${l.name}`}
              active={mtLeaderId === l.id}
              onPress={() => setMtLeaderId(l.id)}
            />
          ))}
        </View>

        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          Tanggal Lahir
        </VixText>
        <View style={styles.formGap}>
          {/* key = id supaya state picker internal reset tiap ganti orang */}
          <DateField
            key={editingMT === 'new' ? 'new-mt' : editingMT?.id}
            value={mtBirthday}
            onChange={setMtBirthday}
          />
        </View>

        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          No. HP
        </VixText>
        <View style={styles.phoneRow}>
          <View style={styles.phonePrefix}>
            <VixText heading="bold" additionalStyle={styles.phonePrefixText}>
              +62
            </VixText>
          </View>
          <FormInput
            style={styles.phoneInput}
            placeholder="81234567890"
            keyboardType="phone-pad"
            value={mtPhone}
            onChangeText={(t) => setMtPhone(t.replace(/\D/g, ''))}
            editable={!busy}
          />
        </View>

        <GenderField value={mtGender} onChange={setMtGender} />

        {/* Pendidikan & pekerjaan Main Team — kolom yang sama persis dengan CL */}
        <StudyWorkFields value={mtStudy} onChange={setMtStudy} busy={busy} />

        {/* Kepribadian Main Team */}
        <PersonalityFields
          disc={mtDisc}
          setDisc={setMtDisc}
          mbti={mtMbti}
          setMbti={setMtMbti}
          love={mtLove}
          setLove={setMtLove}
        />

        <FormError message={mtFormError} />
        <EditDelete
          editing={editingMT}
          label="Hapus Main Team ini"
          busy={busy}
          onDelete={handleDeleteMT}
        />
        </ScrollView>
        {/* DualButtons di luar ScrollView → otomatis dipin di footer SheetModal */}
        <DualButtons
          confirmLabel="Simpan"
          busy={busy}
          onCancel={() => setEditingMT(null)}
          onConfirm={handleSaveMT}
        />
      </SheetModal>

    </View>
  );
}

// Cowok / cewek — penentu ucapan ulang tahun mana yang dikirim. Tekan pilihan
// yang sedang aktif untuk mengosongkannya lagi (sama seperti chip lain).
function GenderField({
  value,
  onChange,
}: {
  value: Gender | null;
  onChange: (v: Gender | null) => void;
}) {
  return (
    <>
      <VixText heading="label" additionalStyle={styles.fieldLabel}>
        🚻 Cowok / Cewek
      </VixText>
      <View style={styles.genderRow}>
        {GENDER_OPTIONS.map((g) => (
          <Chip
            key={g.key}
            label={g.label}
            active={value === g.key}
            onPress={() => onChange(value === g.key ? null : g.key)}
            additionalStyle={styles.genderChip}
          />
        ))}
      </View>
    </>
  );
}

// Input kepribadian: pilih 1 tiap kategori, klik lagi untuk mengosongkan.
function PersonalityFields({
  disc,
  setDisc,
  mbti,
  setMbti,
  love,
  setLove,
}: {
  disc: string | null;
  setDisc: (v: string | null) => void;
  mbti: string | null;
  setMbti: (v: string | null) => void;
  love: string | null;
  setLove: (v: string | null) => void;
}) {
  // DISC urut prioritas (maks 2). Tekan = tambah ke urutan; tekan lagi =
  // buang. Huruf pertama = prioritas #1, kedua = #2. Disimpan gabungan "CS".
  const discOrder = disc ? disc.split('') : [];
  const toggleDisc = (key: string) => {
    if (discOrder.includes(key)) {
      setDisc(discOrder.filter((k) => k !== key).join('') || null);
    } else if (discOrder.length < 2) {
      setDisc([...discOrder, key].join(''));
    }
    // Sudah 2 & huruf baru → diabaikan (buang salah satu dulu).
  };

  return (
    <>
      <VixText heading="label" additionalStyle={styles.fieldLabel}>
        🎨 DISC
      </VixText>
      <View style={styles.pWrap}>
        {DISC_OPTIONS.map((d) => {
          const order = discOrder.indexOf(d.key); // -1 / 0 / 1
          return (
            <View key={d.key} style={styles.discHolder}>
              <Chip
                label={d.key}
                active={order >= 0}
                onPress={() => toggleDisc(d.key)}
              />
              {order >= 0 && (
                <View style={styles.discBadge}>
                  <VixText heading="label" additionalStyle={styles.discBadgeText}>
                    {order + 1}
                  </VixText>
                </View>
              )}
            </View>
          );
        })}
      </View>
      {/* Picker — daftar 5 love language & 16 MBTI baru muncul saat ditekan,
          jadi modal tidak langsung penuh oleh semua pilihan.
          Pembungkusnya WAJIB kolom (bukan `pWrap` yang baris): SelectField
          menaruh kolom & daftarnya sebagai dua elemen berurutan, jadi di dalam
          pembungkus baris daftarnya melipir ke samping, bukan turun. */}
      <VixText heading="label" additionalStyle={styles.fieldLabel}>
        💞 Love Language
      </VixText>
      <View style={styles.formGap}>
        <SelectField
          value={love}
          options={LOVE_LANG_OPTIONS.map((l) => ({ key: l.key, label: l.label }))}
          onChange={setLove}
          placeholder="Pilih love language…"
          clearable
        />
      </View>
      <VixText heading="label" additionalStyle={styles.fieldLabel}>
        🧩 MBTI
      </VixText>
      <View style={styles.formGap}>
        <SelectField
          value={mbti}
          options={MBTI_TYPES.map((m) => ({ key: m, label: m }))}
          onChange={setMbti}
          placeholder="Pilih tipe MBTI…"
          clearable
        />
      </View>
    </>
  );
}

// Isian pendidikan & pekerjaan — dipakai form CL DAN form Main Team, jadi
// keduanya mustahil berbeda. Semuanya opsional: yang belum tahu ya dikosongkan
// dulu, tidak ada yang wajib diisi.
function StudyWorkFields({
  value,
  onChange,
  busy,
}: {
  value: StudyWork;
  onChange: (next: StudyWork) => void;
  busy: boolean;
}) {
  const set = (k: keyof StudyWork) => (t: string) => onChange({ ...value, [k]: t });
  return (
    <>
      <VixText heading="label" additionalStyle={styles.fieldLabel}>
        🎓 Pendidikan
      </VixText>
      <FormInput
        style={styles.formGap}
        placeholder="Kuliah / sekolah di mana"
        value={value.school}
        onChangeText={set('school')}
        editable={!busy}
      />
      <FormInput
        style={styles.formGap}
        placeholder="Jurusan"
        value={value.major}
        onChangeText={set('major')}
        editable={!busy}
      />

      <VixText heading="label" additionalStyle={styles.fieldLabel}>
        💼 Pekerjaan sekarang
      </VixText>
      <FormInput
        style={styles.formGap}
        placeholder="Profesi, mis. Guru / Barista / Mahasiswa"
        value={value.job}
        onChangeText={set('job')}
        editable={!busy}
      />
      <FormInput
        style={styles.formGap}
        placeholder="Tempat kerja"
        value={value.workplace}
        onChangeText={set('workplace')}
        editable={!busy}
      />
    </>
  );
}

/**
 * Isi modal baca-saja: seluruh data satu orang, tanpa satu pun kolom isian.
 *
 * Dipakai CL maupun Main Team — kolomnya memang sama persis (lihat CoreLeader &
 * MainTeamMember di lib/core), jadi tidak ada gunanya dua tampilan berbeda.
 * Baris yang datanya belum diisi sengaja TIDAK ditampilkan: lebih baik pendek
 * daripada penuh baris "—".
 */
function PersonView({
  person,
  today,
}: {
  person: CoreLeader | MainTeamMember;
  today: Date;
}) {
  const { daysUntil, turningAge } = nextBirthday(person, today);
  const belajar = studyLine(person);
  const kerja = workLine(person);
  const jenis = GENDER_OPTIONS.find((g) => g.key === person.gender)?.label;
  const disc = person.disc
    ? person.disc
        .split('')
        .map((k) => DISC_OPTIONS.find((d) => d.key === k)?.label ?? k)
        .join(' · ')
    : null;
  const love = loveLangLabel(person.loveLanguage);

  return (
    <View style={styles.viewList}>
      {/* Garis pemisah judul & isi — memisahkan "siapa"-nya (nama + peran di
          kepala modal) dari "datanya". Dipakai CL maupun Main Team, karena
          modalnya memang satu. */}
      <View style={styles.viewDivider} />
      <InfoRow
        label="🎂 Tanggal lahir"
        value={`${person.birthDay} ${MONTH_NAMES[person.birthMonth]} ${person.birthYear} · ${currentAge(person, today)} th`}
      />
      <InfoRow
        label="🎈 Ulang tahun"
        value={
          daysUntil === 0
            ? `Hari ini! 🎉 genap ${turningAge} th`
            : `${daysUntil} hari lagi · genap ${turningAge} th`
        }
      />
      <InfoRow
        label="📱 No. HP"
        value={person.phone ? `+62${person.phone}` : 'Belum ada nomor'}
      />
      {jenis ? <InfoRow label="🚻 Cowok / Cewek" value={jenis} /> : null}
      {belajar ? <InfoRow label="🎓 Pendidikan" value={belajar.slice(2)} /> : null}
      {kerja ? <InfoRow label="💼 Pekerjaan" value={kerja.slice(2)} /> : null}
      {disc ? <InfoRow label="🎨 DISC" value={disc} /> : null}
      {person.mbti ? <InfoRow label="🧩 MBTI" value={person.mbti} /> : null}
      {love ? <InfoRow label="💞 Love Language" value={love} /> : null}
    </View>
  );
}

// Satu baris data di modal baca-saja: keterangan kecil di atas, isinya di bawah.
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.viewRow}>
      <VixText heading="label">{label}</VixText>
      <VixText heading="paragraph" additionalStyle={styles.viewValue}>
        {value}
      </VixText>
    </View>
  );
}

// Badge kecil kepribadian di kartu daftar & follow up.
function PersonalityBadges({
  person,
}: {
  person: {
    disc?: string | null;
    mbti?: string | null;
    loveLanguage?: string | null;
  };
}) {
  const love = loveLangLabel(person.loveLanguage);
  if (!person.disc && !person.mbti && !love) return null;
  return (
    <View style={styles.badgeRow}>
      {person.disc ? (
        <View style={styles.pBadge}>
          <VixText heading="label" additionalStyle={styles.pBadgeText}>
            🎨 {person.disc}
          </VixText>
        </View>
      ) : null}
      {person.mbti ? (
        <View style={styles.pBadge}>
          <VixText heading="label" additionalStyle={styles.pBadgeText}>
            🧩 {person.mbti}
          </VixText>
        </View>
      ) : null}
      {love ? (
        <View style={styles.pBadge}>
          <VixText heading="label" additionalStyle={styles.pBadgeText}>
            {love}
          </VixText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  formScroll: { flexShrink: 1 },
  pWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  // Chip DISC + badge nomor prioritas di pojok.
  discHolder: { position: 'relative' },
  discBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: Color.MAIN,
    borderWidth: 1.5,
    borderColor: Color.BACKGROUND,
    alignItems: 'center',
    justifyContent: 'center',
  },
  discBadgeText: { color: Color.TEXT_REVERSE },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  pBadge: {
    backgroundColor: Color.MAIN_TRANSPARENT,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  pBadgeText: { color: Color.MAIN_DARK },
  // paddingTop 0 — jarak atasnya sudah dipegang StickyTop (tombol tambah).
  content: { paddingHorizontal: 20, paddingTop: 0, paddingBottom: 24 },
  addRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  addFlex: { flex: 1 },
  // Judul ini dipatok (sticky) di ScrollView. PENTING: ScrollView memindahkan
  // style anak sticky-nya ke pembungkus buatannya sendiri, lalu memberi anaknya
  // `{ flex: 1 }` polos (lihat ScrollViewStickyHeader.js — "We transfer the
  // child style to the wrapper"). Jadi `flexDirection: 'row'` di sini TIDAK
  // akan sampai ke PressableScale-nya, dan judul & "10 orang ⌄" jatuh
  // atas-bawah. Karena itu barisnya dipegang <View> di DALAM (toggleRow) —
  // style itu miliknya sendiri, tak ikut dipindahkan ke mana-mana.
  toggleHeader: {
    paddingTop: 4,
    paddingBottom: 10,
    backgroundColor: Color.BACKGROUND,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  // Judul mengalah (menyusut/dipotong) & jumlah orang + panahnya TIDAK PERNAH
  // menyusut — jadi "10 orang ⌄" pasti tetap sebaris di kanan judul, tak
  // pernah jatuh ke baris bawah walau nama seksinya memanjang.
  toggleTitle: { flexShrink: 1 },
  toggleRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  emptyText: { textAlign: 'center', marginBottom: 12 },
  card: {
    flexDirection: 'row',
    // 'flex-start': tombol 🎡 & ✏️ menempel di pojok kanan ATAS kartu, tidak
    // ikut turun ke tengah saat datanya panjang (pendidikan + pekerjaan +
    // badge kepribadian bisa membuat kartunya tinggi).
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
    backgroundColor: Color.CONTAINER,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Color.BORDER,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
  },
  cardLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  heart: { fontSize: 28, lineHeight: 34 },
  cardInfo: { flex: 1, gap: 1 },
  name: { color: Color.TEXT_TITLE },
  followupLine: { color: Color.TEXT_PLACEHOLDER },
  cardRight: { alignItems: 'flex-end', gap: 6 },
  cardActions: { flexDirection: 'row', gap: 8 },
  // Modal baca-saja
  viewList: { gap: 12, paddingBottom: 4 },
  // Garis rambut pemisah kepala modal dari daftar datanya. Lebarnya ditarik
  // keluar padding sheet (-20 kiri-kanan) supaya membentang penuh seperti
  // garis footer modal, bukan mengambang di tengah.
  viewDivider: {
    height: 1,
    backgroundColor: Color.BORDER,
    marginHorizontal: -20,
    marginBottom: 2,
  },
  viewRow: { gap: 2 },
  viewValue: { color: Color.TEXT_TITLE },
  closeButton: {
    marginTop: 16,
    marginBottom: 4,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: Color.MAIN,
  },
  closeButtonText: { color: Color.TEXT_REVERSE },
  birthdayChip: {
    backgroundColor: Color.ACCENT,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  birthdayChipText: { color: Color.ACCENT_DARK },
  formGap: { marginBottom: 10 },
  fieldLabel: { marginBottom: 6 },
  phoneRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  phonePrefix: {
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Color.BORDER,
    backgroundColor: Color.CONTRAST_CONTAINER,
  },
  phonePrefixText: { color: Color.TEXT_PARAGRAPH },
  phoneInput: { flex: 1 },
  // Cowok / cewek — dua chip selebar setengah baris. marginBottom 10 = jarak
  // yang sama dengan `formGap` di semua kolom lain; tanpa itu label berikutnya
  // ("🎓 Pendidikan") menempel ke chip-nya, sendirian beda dari yang lain.
  genderRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  genderChip: { flex: 1 },
  heartWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  heartChip: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Color.BORDER,
    backgroundColor: Color.CONTAINER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heartActive: {
    backgroundColor: Color.MAIN_TRANSPARENT,
    borderColor: Color.MAIN,
  },
  heartOption: { fontSize: 22, lineHeight: 28 },
  leaderWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  archiveInput: { minHeight: 100, textAlignVertical: 'top', marginBottom: 10 },
  bodyHeading: { color: Color.TEXT_TITLE, marginTop: 14 },
  bodyRow: { flexDirection: 'row', gap: 8, marginBottom: 6,  },
  bodyField: { flex: 1, gap: 4 },
  bodyLabel: { color: Color.TEXT_LABEL },
  archiveButton: {
    marginTop: 8,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Color.CONTRAST_CONTAINER,
    borderWidth: 1,
    borderColor: Color.BORDER,
  },
  archiveButtonText: { color: Color.ACCENT_DARK },
});
