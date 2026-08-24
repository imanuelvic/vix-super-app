import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  View,
  type KeyboardTypeOptions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { DualButtons } from '@/components/common/DualButtons';
import { FormError } from '@/components/common/FormError';
import { FormInput } from '@/components/common/FormInput';
import { LoadingCenter } from '@/components/common/LoadingCenter';
import { PressableScale } from '@/components/common/PressableScale';
import { SegmentTabs } from '@/components/common/SegmentTabs';
import { SheetModal } from '@/components/common/SheetModal';
import { useTabScroll } from '@/components/common/useTabScroll';
import { VixText } from '@/components/common/VixText';
import { BodyCard } from '@/components/health/BodyCard';
import { PersonalityTab } from '@/components/profile/PersonalityTab';
import { QuadrantTab, type Quadrant } from '@/components/profile/QuadrantTab';
import { useAuth } from '@/contexts/auth';
import { useScrollTop } from '@/hooks/useScrollTop';
import { pickCompressedPhoto } from '@/lib/family';
import { subscribeHealthProfile, type HealthProfile } from '@/lib/health';
import {
  EMPTY_SELF_KNOWLEDGE,
  subscribeSelfKnowledge,
  type SelfKnowledge,
} from '@/lib/selfKnowledge';
import { LOAD_ERROR, PHOTO_ERROR, SAVE_ERROR } from '@/lib/messages';
import {
  EMPTY_PROFILE,
  saveProfile,
  subscribeProfile,
  type Profile,
} from '@/lib/profile';

// Field teks profil (semua kecuali foto) — dipakai untuk form Edit & tampilan.
type FieldKey = Exclude<keyof Profile, 'photo'>;

const SECTIONS: {
  title: string;
  fields: {
    key: FieldKey;
    label: string;
    placeholder?: string;
    keyboard?: KeyboardTypeOptions;
    multiline?: boolean;
  }[];
}[] = [
  {
    title: '🙋 Data Diri',
    fields: [
      { key: 'fullName', label: 'Nama lengkap' },
      { key: 'nickname', label: 'Nama panggilan' },
      { key: 'birthPlace', label: 'Tempat lahir' },
      { key: 'birthDate', label: 'Tanggal lahir' },
      { key: 'gender', label: 'Jenis kelamin' },
      { key: 'religion', label: 'Agama' },
      { key: 'bloodType', label: 'Golongan darah' },
      { key: 'maritalStatus', label: 'Status perkawinan' },
      { key: 'nationality', label: 'Kewarganegaraan' },
    ],
  },
  {
    title: '📄 Identitas & Dokumen',
    fields: [
      { key: 'nik', label: 'NIK (KTP)', keyboard: 'number-pad' },
      { key: 'kk', label: 'No. Kartu Keluarga', keyboard: 'number-pad' },
      { key: 'npwp', label: 'NPWP', keyboard: 'number-pad' },
      { key: 'passport', label: 'No. Paspor' },
      { key: 'bpjs', label: 'No. BPJS Kesehatan', keyboard: 'number-pad' },
    ],
  },
  {
    title: '📞 Kontak',
    fields: [
      { key: 'address', label: 'Alamat', multiline: true },
      { key: 'phone', label: 'No. HP', keyboard: 'phone-pad' },
      { key: 'email', label: 'Email', keyboard: 'email-address' },
    ],
  },
  {
    title: '📝 Catatan',
    fields: [
      {
        key: 'notes',
        label: 'Catatan bebas',
        placeholder: 'Hal penting lain biar tidak lupa…',
        multiline: true,
      },
    ],
  },
];

// Field yang tampil di hero (nama/kewarganegaraan) → tidak diulang di daftar.
const HERO_KEYS = new Set<FieldKey>(['fullName', 'nickname', 'nationality']);

type Tab = 'profile' | 'body' | 'personality' | 'ikigai' | 'swot';

// Sub-tab EMOJI SAJA — lima tab tidak muat kalau pakai teks (dulu terpotong
// jadi "Prof…"). Nama panjangnya tetap muncul sebagai subjudul di bawah.
const TABS: { key: Tab; label: string }[] = [
  { key: 'profile', label: '🪪' },
  { key: 'body', label: '🧍' },
  { key: 'personality', label: '🧠' },
  { key: 'ikigai', label: '🎌' },
  { key: 'swot', label: '📊' },
];

const TAB_TITLE: Record<Tab, string> = {
  profile: 'Data Diri & Dokumen',
  body: 'Data Tubuh',
  personality: 'Personality',
  ikigai: 'Ikigai',
  swot: 'SWOT',
};

// Empat lingkaran Ikigai — warna pastel berbeda biar gampang dibedakan.
const IKIGAI: Quadrant<'love' | 'goodAt' | 'worldNeeds' | 'paidFor'>[] = [
  { key: 'love', emoji: '❤️', title: 'Yang Kamu CINTAI', hint: 'Apa yang bikin kamu lupa waktu saat mengerjakannya?', bg: Color.FINANCE_EXPENSE, fg: Color.FINANCE_EXPENSE_DARK },
  { key: 'goodAt', emoji: '💪', title: 'Yang Kamu KUASAI', hint: 'Apa yang orang sering minta tolong ke kamu?', bg: Color.FUN, fg: Color.FUN_DARK },
  { key: 'worldNeeds', emoji: '🌍', title: 'Yang DIBUTUHKAN Dunia', hint: 'Masalah apa di sekitarmu yang bikin kamu gelisah?', bg: Color.FINANCE_INVESTMENT, fg: Color.FINANCE_INVESTMENT_DARK },
  { key: 'paidFor', emoji: '💰', title: 'Yang Bisa DIBAYAR', hint: 'Keahlian apa yang orang mau bayar untuk itu?', bg: Color.ACCENT, fg: Color.ACCENT_DARK },
];

// Empat kotak SWOT — dua ke dalam (S/W), dua ke luar (O/T).
const SWOT: Quadrant<'strengths' | 'weaknesses' | 'opportunities' | 'threats'>[] = [
  { key: 'strengths', emoji: '💚', title: 'Strengths — Kekuatan', hint: 'Apa keunggulanmu dibanding orang lain?', bg: Color.FUN, fg: Color.FUN_DARK },
  { key: 'weaknesses', emoji: '🧡', title: 'Weaknesses — Kelemahan', hint: 'Apa yang masih jadi PR-mu, jujur saja.', bg: Color.CAREER, fg: Color.ACCENT_DARK },
  { key: 'opportunities', emoji: '💙', title: 'Opportunities — Peluang', hint: 'Peluang apa yang terbuka buatmu tahun ini?', bg: Color.FINANCE_INVESTMENT, fg: Color.FINANCE_INVESTMENT_DARK },
  { key: 'threats', emoji: '❤️', title: 'Threats — Ancaman', hint: 'Apa yang bisa menggagalkan rencanamu?', bg: Color.FINANCE_EXPENSE, fg: Color.FINANCE_EXPENSE_DARK },
];

// Tab Profile 🪪 — data penting diri sendiri (view-only), diedit lewat modal.
// Plus tombol My Timeline (pindah dari Home). Data tersimpan di akun pribadi.
export default function ProfileScreen() {
  const router = useRouter();
  const { user } = useAuth();

  // Tekan tab Profile lagi saat halamannya sedang dibuka → balik ke atas.
  // Dua sub-tab punya daftar sendiri di file ini (Profile & Data Tubuh), jadi
  // masing-masing dapat ref-nya sendiri; sub-tab lain mengurus punyanya sendiri.
  const { ref: mainScroll } = useScrollTop();
  const { ref: bodyScroll } = useScrollTop();

  const [profile, setProfile] = useState<Profile | null>(null);
  // Data tubuh 🧍 — dipindah ke sini dari Health (data diri, bukan aktivitas).
  const [body, setBody] = useState<HealthProfile | null>(null);
  // Mengenal diri: Personality / Ikigai / SWOT — satu dokumen kecil.
  const [self, setSelf] = useState<SelfKnowledge>(EMPTY_SELF_KNOWLEDGE);

  // Layar lain bisa membuka sub-tab tertentu langsung lewat ?tab=… — mis.
  // kartu Data Tubuh di Fitness → Progress yang mengarah ke ?tab=body.
  const { tab: tabParam } = useLocalSearchParams<{ tab?: string }>();
  const isProfileTab = (t?: string): t is Tab =>
    TABS.some((x) => x.key === t);

  const { tab, setTab, scrollKey, onTabPress } = useTabScroll<Tab>(
    isProfileTab(tabParam) ? tabParam : 'profile',
  );
  // Param dibersihkan setelah dipakai. Profile itu tab (layarnya tetap hidup),
  // jadi kalau param dibiarkan menempel, kunjungan berikutnya lewat tombol tab
  // bawah akan terus dipaksa balik ke sub-tab yang sama.
  useEffect(() => {
    if (!isProfileTab(tabParam)) return;
    setTab(tabParam);
    router.setParams({ tab: '' });
  }, [tabParam, setTab, router]);

  const [error, setError] = useState<string | null>(null);

  // Form edit (salinan profil saat modal dibuka).
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState<Profile>(EMPTY_PROFILE);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const unsubs = [
      subscribeProfile(
        user.uid,
        (p) => {
          setProfile(p);
          setError(null);
        },
        () => setError(LOAD_ERROR),
      ),
      subscribeHealthProfile(user.uid, setBody, () => setError(LOAD_ERROR)),
      subscribeSelfKnowledge(user.uid, setSelf, () => setError(LOAD_ERROR)),
    ];
    return () => unsubs.forEach((unsub) => unsub());
  }, [user]);

  function openEdit() {
    if (!profile) return;
    setForm(profile);
    setFormError(null);
    setEditOpen(true);
  }

  async function handlePickPhoto() {
    if (photoBusy) return;
    setPhotoBusy(true);
    try {
      const photo = await pickCompressedPhoto();
      if (photo) setForm((prev) => ({ ...prev, photo }));
    } catch {
      setFormError(PHOTO_ERROR);
    } finally {
      setPhotoBusy(false);
    }
  }

  async function handleSave() {
    if (!user || saving) return;
    setSaving(true);
    setFormError(null);
    try {
      await saveProfile(user.uid, {
        ...form,
        fullName: form.fullName.trim() || 'Belum diisi',
      });
      setEditOpen(false);
    } catch {
      setFormError(SAVE_ERROR);
    } finally {
      setSaving(false);
    }
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        {error ? (
          <VixText heading="label" additionalStyle={styles.error}>
            {error}
          </VixText>
        ) : (
          <LoadingCenter />
        )}
      </SafeAreaView>
    );
  }

  const hasPhoto = !!profile.photo && profile.photo.length > 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Judul + subtab: Profile · Personality · Ikigai · SWOT */}
      <View style={styles.headerWrap}>
        <View style={styles.headerRow}>
          <VixText heading="header" additionalStyle={styles.title}>
            Profile 👤
          </VixText>
          {tab === 'profile' && (
            <PressableScale onPress={openEdit} hitSlop={10}>
              <VixText heading="bold" additionalStyle={styles.editText}>
                ✏️ Ubah
              </VixText>
            </PressableScale>
          )}
        </View>
        <SegmentTabs tabs={TABS} value={tab} onChange={onTabPress} />
        {/* Nama tab yang sedang dibuka — pengganti label di dalam chip */}
        <VixText heading="label" additionalStyle={styles.tabTitle}>
          {TAB_TITLE[tab]}
        </VixText>
      </View>

      {/* key={scrollKey} → tab ditekan ulang = balik ke atas (pola app ini) */}
      <View style={styles.body} key={scrollKey}>
        {tab === 'body' ? (
          // Data Tubuh punya sub-tab sendiri 🧍 — dulu menumpang di Profile.
          <ScrollView ref={bodyScroll} contentContainerStyle={styles.content}>
            {body ? <BodyCard profile={body} /> : <LoadingCenter />}
          </ScrollView>
        ) : tab === 'personality' ? (
          <PersonalityTab data={self.personality} />
        ) : tab === 'ikigai' ? (
          <QuadrantTab
            part="ikigai"
            values={self.ikigai}
            quadrants={IKIGAI}
            intro="Ikigai = titik temu empat hal ini — alasanmu bangun pagi. Isi pelan-pelan, tidak harus sekali jadi 🎌"
            footerKey="statement"
            footerTitle="🎯 Kalimat Ikigai-ku"
            footerHint="Rangkum jadi satu kalimat: aku ada untuk…"
          />
        ) : tab === 'swot' ? (
          <QuadrantTab
            part="swot"
            values={self.swot}
            quadrants={SWOT}
            intro="SWOT dirimu sendiri: dua dari dalam (kekuatan & kelemahan), dua dari luar (peluang & ancaman). Tinjau ulang tiap kuartal 📊"
          />
        ) : (
          renderProfileContent()
        )}
      </View>
    </SafeAreaView>
  );

  // Isi subtab Profile — dipisah jadi fungsi biar bagian atas tetap terbaca.
  //
  // PENTING: dipanggil sebagai FUNGSI (`renderProfileContent()`), BUKAN dipasang
  // sebagai komponen (`<ProfileContent />`). Fungsi ini dibuat ulang tiap kali
  // layarnya render, jadi kalau dipasang sebagai komponen React menganggapnya
  // jenis yang berbeda tiap render → seluruh isinya (termasuk modal "Ubah
  // Profil") DIBONGKAR lalu DIPASANG LAGI. Itulah sebab modalnya dulu terlihat
  // menutup & membuka sendiri tiap satu huruf diketik: kolom isiannya kehilangan
  // fokus, keyboard ikut turun-naik. Dipanggil sebagai fungsi, JSX-nya menyatu
  // ke induknya — tidak ada pemasangan ulang sama sekali.
  function renderProfileContent() {
    if (!profile) return null; // sudah dijaga di atas; ini untuk TypeScript
    return (
      <ScrollView ref={mainScroll} contentContainerStyle={styles.content}>
        {/* Hero: foto + nama + kewarganegaraan */}
        <View style={styles.hero}>
          <View style={styles.avatar}>
            {hasPhoto ? (
              <Image
                source={{ uri: `data:image/jpeg;base64,${profile.photo}` }}
                style={styles.avatarImg}
              />
            ) : (
              <VixText additionalStyle={styles.avatarEmoji}>🪪</VixText>
            )}
          </View>
          <VixText heading="subheader" additionalStyle={styles.heroName}>
            {profile.fullName}
          </VixText>
          {profile.nickname ? (
            <VixText heading="label" additionalStyle={styles.heroSub}>
              “{profile.nickname}”
            </VixText>
          ) : null}
          <View style={styles.heroBadge}>
            <VixText heading="bold" additionalStyle={styles.heroBadgeText}>
              🇮🇩 {profile.nationality || 'Kewarganegaraan?'}
            </VixText>
          </View>
        </View>

        {/* Sepasang catatan hidup — sengaja DI SINI, bukan di grid Home:
            isinya paling pribadi (pertobatan, relasi, gaji) jadi tidak ikut
            terpampang saat app dibuka atau ditunjukkan ke orang lain, tapi
            tetap cuma 2 click untuk dipantau rutin.
              📜 History  = masa lalu, biar ingat dari mana kamu datang
              📍 Timeline = masa depan, biar tahu mau ke mana */}
        <View style={styles.lifeRow}>
          <PressableScale
            style={styles.lifeButton}
            onPress={() => router.push('/history')}>
            <VixText heading="bold" additionalStyle={styles.lifeText}>
              📜 My History
            </VixText>
          </PressableScale>
          <PressableScale
            style={styles.lifeButton}
            onPress={() => router.push('/timeline')}>
            <VixText heading="bold" additionalStyle={styles.lifeText}>
              📍 My Timeline
            </VixText>
          </PressableScale>
        </View>

        {/* Kartu per bagian data */}
        {SECTIONS.map((section) => {
          const rows = section.fields.filter((f) => !HERO_KEYS.has(f.key));
          if (rows.length === 0) return null;
          return (
            <View key={section.title} style={styles.card}>
              <VixText heading="title" additionalStyle={styles.cardTitle}>
                {section.title}
              </VixText>
              {rows.map((f) => {
                const value = profile[f.key];
                return (
                  <View key={f.key} style={styles.infoRow}>
                    <VixText heading="label" additionalStyle={styles.infoLabel}>
                      {f.label}
                    </VixText>
                    <VixText
                      heading="paragraph"
                      additionalStyle={value ? styles.infoValue : styles.infoEmpty}>
                      {value || 'belum diisi'}
                    </VixText>
                  </View>
                );
              })}
            </View>
          );
        })}

        <VixText heading="label" additionalStyle={styles.privacyNote}>
          🔒 Data ini cuma tersimpan di akun pribadimu. Isi lewat “Ubah”.
        </VixText>

      {/* Modal edit profil (semua field + foto) */}
      <SheetModal
        visible={editOpen}
        title="Ubah Profil"
        subtitle="Data hanya tersimpan di akunmu 🔒"
        onClose={() => setEditOpen(false)}>
        <PressableScale
          style={styles.photoPicker}
          onPress={handlePickPhoto}
          disabled={photoBusy || saving}>
          {photoBusy ? (
            <ActivityIndicator color={Color.MAIN} />
          ) : form.photo ? (
            <Image
              source={{ uri: `data:image/jpeg;base64,${form.photo}` }}
              style={styles.photoPreview}
            />
          ) : (
            <VixText heading="label" additionalStyle={styles.photoHint}>
              📷{'\n'}Foto
            </VixText>
          )}
        </PressableScale>

        {SECTIONS.map((section) => (
          <View key={section.title}>
            <VixText heading="bold" additionalStyle={styles.editSection}>
              {section.title}
            </VixText>
            {section.fields.map((f) => (
              <View key={f.key}>
                <VixText heading="label" additionalStyle={styles.fieldLabel}>
                  {f.label}
                </VixText>
                <FormInput
                  style={[styles.input, f.multiline && styles.inputMultiline]}
                  placeholder={f.placeholder}
                  value={form[f.key]}
                  onChangeText={(t) => setForm((prev) => ({ ...prev, [f.key]: t }))}
                  keyboardType={f.keyboard}
                  multiline={f.multiline}
                  editable={!saving}
                />
              </View>
            ))}
          </View>
        ))}

        <FormError message={formError} gap="none" additionalStyle={styles.error} />
        <DualButtons
          confirmLabel="Simpan"
          busy={saving}
          onCancel={() => setEditOpen(false)}
          onConfirm={handleSave}
        />
      </SheetModal>
      </ScrollView>
    );
  }
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.BACKGROUND },
  body: { flex: 1 },
  headerWrap: { paddingHorizontal: 20, paddingTop: 12 },
  content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 40 },
  error: { paddingHorizontal: 20, marginTop: 12 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  title: { color: Color.MAIN },
  editText: { color: Color.MAIN },
  tabTitle: { color: Color.TEXT_LABEL, marginTop: -6, marginBottom: 8 },
  hero: {
    backgroundColor: Color.MAIN_DARK,
    borderRadius: 20,
    padding: 22,
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Color.CONTAINER,
    borderWidth: 2,
    borderColor: Color.MAIN_LIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: 4,
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarEmoji: { fontSize: 44, lineHeight: 56 },
  heroName: { color: Color.TEXT_REVERSE, textAlign: 'center' },
  heroSub: { color: Color.TEXT_ON_DARK_MUTED },
  heroBadge: {
    backgroundColor: Color.MAIN_LIGHT,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 5,
    marginTop: 2,
  },
  heroBadgeText: { color: Color.MAIN_DARK },
  // Sepasang tombol catatan hidup: History (masa lalu) & Timeline (masa depan).
  lifeRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  lifeButton: {
    flex: 1,
    gap: 1,
    backgroundColor: Color.ACCENT,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  lifeText: { color: Color.ACCENT_DARK },
  card: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Color.BORDER,
    padding: 16,
    marginBottom: 12,
    gap: 10,
  },
  cardTitle: { marginBottom: 2 },
  infoRow: { gap: 2 },
  infoLabel: { color: Color.TEXT_LABEL },
  infoValue: { color: Color.TEXT_TITLE },
  infoEmpty: { color: Color.TEXT_PLACEHOLDER },
  privacyNote: { color: Color.TEXT_LABEL, textAlign: 'center', marginTop: 4 },
  // Modal edit
  photoPicker: {
    alignSelf: 'center',
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Color.CONTRAST_CONTAINER,
    borderWidth: 1,
    borderColor: Color.BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: 14,
  },
  photoPreview: { width: '100%', height: '100%' },
  photoHint: { textAlign: 'center' },
  editSection: { color: Color.MAIN_DARK, marginTop: 10, marginBottom: 8 },
  fieldLabel: { marginBottom: 6 },
  input: { marginBottom: 10 },
  inputMultiline: { minHeight: 80, textAlignVertical: 'top' },
});
