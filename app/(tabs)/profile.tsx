import { useRouter } from 'expo-router';
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
import { FormInput } from '@/components/common/FormInput';
import { LoadingCenter } from '@/components/common/LoadingCenter';
import { PressableScale } from '@/components/common/PressableScale';
import { SheetModal } from '@/components/common/SheetModal';
import { VixText } from '@/components/common/VixText';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/contexts/auth';
import { pickCompressedPhoto } from '@/lib/family';
import { LOAD_ERROR, SAVE_ERROR } from '@/lib/messages';
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

// Tab Profile 🪪 — data penting diri sendiri (view-only), diedit lewat modal.
// Plus tombol My Timeline (pindah dari Home). Data tersimpan di akun pribadi.
export default function ProfileScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form edit (salinan profil saat modal dibuka).
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState<Profile>(EMPTY_PROFILE);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    return subscribeProfile(
      user.uid,
      (p) => {
        setProfile(p);
        setError(null);
      },
      () => setError(LOAD_ERROR),
    );
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
      setFormError('Gagal mengambil foto. Coba lagi.');
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
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <VixText heading="header" additionalStyle={styles.title}>
            Profile
          </VixText>
          <PressableScale onPress={openEdit} hitSlop={10}>
            <VixText heading="bold" additionalStyle={styles.editText}>
              ✏️ Ubah
            </VixText>
          </PressableScale>
        </View>

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

        {/* My Timeline (pindah dari Home) — fungsi penting, jarang dipencet */}
        <PressableScale
          style={styles.timelineButton}
          onPress={() => router.push('/timeline')}>
          <VixText heading="bold" additionalStyle={styles.timelineText}>
            📍 My Timeline
          </VixText>
          <IconSymbol name="chevron.right" size={18} color={Color.ACCENT_DARK} />
        </PressableScale>

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
      </ScrollView>

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

        {formError && (
          <VixText heading="label" additionalStyle={styles.error}>
            {formError}
          </VixText>
        )}
        <DualButtons
          confirmLabel="Simpan"
          busy={saving}
          onCancel={() => setEditOpen(false)}
          onConfirm={handleSave}
        />
      </SheetModal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.BACKGROUND },
  content: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40 },
  error: { color: Color.DANGER, paddingHorizontal: 20, marginTop: 12 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  title: { color: Color.MAIN },
  editText: { color: Color.MAIN },
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
  timelineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Color.ACCENT,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 14,
  },
  timelineText: { color: Color.ACCENT_DARK },
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
