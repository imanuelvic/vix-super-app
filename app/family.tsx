import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { CheckCircle } from '@/components/common/CheckCircle';
import { Chip } from '@/components/common/Chip';
import { DateField } from '@/components/common/DateField';
import { DualButtons } from '@/components/common/DualButtons';
import { FormInput } from '@/components/common/FormInput';
import { InlineDelete } from '@/components/common/InlineDelete';
import { PressableScale } from '@/components/common/PressableScale';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { SheetModal } from '@/components/common/SheetModal';
import { VixText } from '@/components/common/VixText';
import { useAuth } from '@/contexts/auth';
import { currentAge } from '@/lib/core';
import {
  childrenOf,
  deleteFamilyMember,
  newFamilyId,
  parentsOf,
  partnersOf,
  pickCompressedPhoto,
  saveFamilyMember,
  subscribeFamily,
  type FamilyMember,
} from '@/lib/family';

// ================= Avatar (module-scope, identitas stabil) =================
// PENTING: komponen ini WAJIB di luar FamilyScreen. Kalau didefinisikan di
// dalam, tiap render membuat tipe komponen baru → semua node Reanimated di
// PressableScale ikut unmount/remount, dan di iOS itu bisa crash (force quit).
function Avatar({
  m,
  size,
  today,
  onSelect,
  highlighted = false,
}: {
  m: FamilyMember;
  size: number;
  today: Date;
  onSelect: (id: string) => void;
  highlighted?: boolean;
}) {
  const hasPhoto = !!m.photo && m.photo.length > 0;
  return (
    <PressableScale style={styles.avatarWrap} onPress={() => onSelect(m.id)}>
      <View
        style={[
          styles.avatarBox,
          { width: size, height: size, borderRadius: size * 0.28 },
          highlighted && styles.avatarSelected,
          m.deceased && styles.avatarDeceased,
        ]}>
        {hasPhoto ? (
          <Image
            source={{ uri: `data:image/jpeg;base64,${m.photo}` }}
            style={[styles.avatarPhoto, m.deceased && styles.photoDeceased]}
          />
        ) : (
          <VixText
            additionalStyle={{ fontSize: size * 0.46, lineHeight: size * 0.6 }}>
            {m.deceased ? '🕊️' : '👤'}
          </VixText>
        )}
        {m.deceased && (
          <View style={styles.crossBadge}>
            <VixText heading="label" additionalStyle={styles.crossText}>
              ✝
            </VixText>
          </View>
        )}
      </View>
      <VixText
        heading="label"
        numberOfLines={1}
        additionalStyle={[
          styles.avatarName,
          { maxWidth: size + 24 },
          m.deceased && styles.nameDeceased,
        ]}>
        {m.name}
      </VixText>
      <VixText heading="label" additionalStyle={styles.avatarAge}>
        {m.deceased ? `✝ ${m.birthYear}` : `${currentAge(m, today)} th`}
      </VixText>
    </PressableScale>
  );
}

const VConnector = () => <View style={styles.vConnector} />;

// Family Tree 👨‍👩‍👧‍👦 — silsilah ala The Sims: pohon 3 generasi yang
// berpusat pada orang yang dipilih; tap siapa pun → pohon pindah ke dia.
export default function FamilyScreen() {
  const { user } = useAuth();

  const [members, setMembers] = useState<FamilyMember[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form tambah/edit. 'new' = sedang menambah baru.
  const [editing, setEditing] = useState<FamilyMember | 'new' | null>(null);
  const [fName, setFName] = useState('');
  const [fBirthday, setFBirthday] = useState(new Date(1990, 0, 1));
  const [fDeceased, setFDeceased] = useState(false);
  const [fParents, setFParents] = useState<string[]>([]);
  const [fPartners, setFPartners] = useState<string[]>([]);
  const [fPhoto, setFPhoto] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = subscribeFamily(
      user.uid,
      (next) => {
        setMembers(next);
        setError(null);
      },
      () => setError('Gagal memuat data. Cek koneksi internet.'),
    );
    return unsubscribe;
  }, [user]);

  const today = new Date();
  const all = members ?? [];
  // Pusat pohon: pilihan user, atau leluhur tertua sebagai awal.
  const selected =
    all.find((m) => m.id === selectedId) ??
    all.find((m) => m.parentIds.length === 0) ??
    all[0] ??
    null;

  const parents = selected ? parentsOf(selected, all) : [];
  const partners = selected ? partnersOf(selected.id, all) : [];
  const children = selected ? childrenOf(selected.id, all) : [];

  function openAdd() {
    setEditing('new');
    setFName('');
    setFBirthday(new Date(1990, 0, 1));
    setFDeceased(false);
    setFParents([]);
    setFPartners([]);
    setFPhoto(null);
    setFormError(null);
  }

  function openEdit(m: FamilyMember) {
    setEditing(m);
    setFName(m.name);
    setFBirthday(new Date(m.birthYear, m.birthMonth, m.birthDay));
    setFDeceased(m.deceased);
    setFParents(m.parentIds);
    // Tampilkan pasangan 2 arah supaya lengkap saat diedit.
    setFPartners(partnersOf(m.id, all).map((p) => p.id));
    setFPhoto(m.photo);
    setFormError(null);
  }

  function toggleParent(id: string) {
    setFParents((prev) => {
      if (prev.includes(id)) return prev.filter((p) => p !== id);
      if (prev.length >= 2) return prev; // maksimal 2 orang tua
      return [...prev, id];
    });
  }

  function togglePartner(id: string) {
    setFPartners((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  }

  async function handlePickPhoto() {
    if (photoBusy) return;
    setPhotoBusy(true);
    try {
      const photo = await pickCompressedPhoto();
      if (photo) setFPhoto(photo);
    } catch {
      setFormError('Gagal mengambil foto. Coba lagi.');
    } finally {
      setPhotoBusy(false);
    }
  }

  async function handleSave() {
    if (!user || !editing || busy) return;
    if (!fName.trim()) {
      setFormError('Nama wajib diisi.');
      return;
    }
    setBusy(true);
    setFormError(null);
    const data: FamilyMember = {
      id: editing === 'new' ? newFamilyId() : editing.id,
      name: fName.trim(),
      birthYear: fBirthday.getFullYear(),
      birthMonth: fBirthday.getMonth(),
      birthDay: fBirthday.getDate(),
      deceased: fDeceased,
      parentIds: fParents,
      // Simpan pasangan di dokumen ini; partnersOf membacanya 2 arah.
      partnerIds: fPartners,
      photo: fPhoto,
    };
    try {
      await saveFamilyMember(user.uid, data);
      setSelectedId(data.id); // pohon langsung berpusat ke dia
      setEditing(null);
    } catch {
      setFormError('Gagal menyimpan. Cek koneksi internet.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!user || !editing || editing === 'new' || busy) return;
    setBusy(true);
    try {
      await deleteFamilyMember(user.uid, editing.id, all);
      if (selectedId === editing.id) setSelectedId(null);
    } finally {
      setEditing(null);
      setBusy(false);
    }
  }

  const editingId = editing && editing !== 'new' ? editing.id : null;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        backLabel="Home"
        title="Family 👨‍👩‍👧‍👦"
        subtitle={
          all.length > 0
            ? `${all.length} anggota · ${all.filter((m) => m.deceased).length} telah tiada ✝`
            : 'Silsilah keluarga besarmu'
        }
      />

      {error && (
        <VixText heading="label" additionalStyle={styles.error}>
          {error}
        </VixText>
      )}

      {members === null ? (
        <View style={styles.center}>
          <ActivityIndicator color={Color.MAIN} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <PrimaryButton
            label="Tambah Anggota Keluarga"
            icon="plus"
            onPress={openAdd}
            additionalStyle={styles.addButton}
          />

          {selected === null ? (
            <View style={styles.emptyCard}>
              <VixText additionalStyle={styles.emptyEmoji}>🌳</VixText>
              <VixText heading="title" additionalStyle={styles.emptyTitle}>
                Mulai tanam pohon keluargamu
              </VixText>
              <VixText heading="label" additionalStyle={styles.emptyText}>
                Tambahkan dirimu dulu, lalu orang tua, pasangan, anak, dan
                seterusnya. Tap siapa pun di pohon untuk berpindah seperti di
                The Sims 🎮
              </VixText>
            </View>
          ) : (
            <>
              {/* ===== Pohon 3 generasi (berpusat di yang dipilih) ===== */}
              <View style={styles.treeCard}>
                {/* Generasi atas: orang tua (dengan garis nikah bila 2) */}
                {parents.length > 0 && (
                  <>
                    <View style={styles.coupleRow}>
                      {parents.map((p, i) => (
                        <View key={p.id} style={styles.coupleItem}>
                          {i > 0 && <View style={styles.marryLink} />}
                          <Avatar
                            m={p}
                            size={60}
                            today={today}
                            onSelect={setSelectedId}
                          />
                        </View>
                      ))}
                    </View>
                    <VConnector />
                  </>
                )}

                {/* Generasi tengah: yang dipilih + pasangan (💍) */}
                <View style={styles.coupleRow}>
                  <Avatar
                    m={selected}
                    size={92}
                    today={today}
                    onSelect={setSelectedId}
                    highlighted
                  />
                  {partners.map((p) => (
                    <View key={p.id} style={styles.coupleItem}>
                      <View style={styles.marryLink}>
                        <VixText additionalStyle={styles.marryHeart}>💍</VixText>
                      </View>
                      <Avatar
                        m={p}
                        size={72}
                        today={today}
                        onSelect={setSelectedId}
                      />
                    </View>
                  ))}
                </View>

                {/* Generasi bawah: anak-anak */}
                {children.length > 0 && (
                  <>
                    <VConnector />
                    <VixText heading="label" additionalStyle={styles.genLabel}>
                      {children.length} anak
                    </VixText>
                    <View style={styles.childrenRow}>
                      {children.map((c) => (
                        <Avatar
                          key={c.id}
                          m={c}
                          size={58}
                          today={today}
                          onSelect={setSelectedId}
                        />
                      ))}
                    </View>
                  </>
                )}

                {/* Edit orang yang sedang dipilih */}
                <PressableScale
                  style={styles.editButton}
                  onPress={() => openEdit(selected)}>
                  <VixText heading="bold" additionalStyle={styles.editButtonText}>
                    ✏️ Edit {selected.name}
                  </VixText>
                </PressableScale>
              </View>

              {/* ===== Semua anggota ===== */}
              <VixText heading="title" additionalStyle={styles.sectionTitle}>
                🌳 Semua Anggota
              </VixText>
              <View style={styles.allGrid}>
                {all.map((m) => (
                  <Avatar
                    key={m.id}
                    m={m}
                    size={58}
                    today={today}
                    onSelect={setSelectedId}
                    highlighted={m.id === selected.id}
                  />
                ))}
              </View>
            </>
          )}
        </ScrollView>
      )}

      {/* Sheet tambah/edit anggota */}
      <SheetModal
        visible={!!editing}
        title={editing === 'new' ? 'Tambah Anggota' : 'Edit Anggota'}
        onClose={() => setEditing(null)}>
        <ScrollView
          style={styles.formScroll}
          keyboardShouldPersistTaps="handled">
          {/* Foto — dikompres sangat kecil tapi tetap jelas */}
          <PressableScale
            style={styles.photoPicker}
            onPress={handlePickPhoto}
            disabled={photoBusy || busy}>
            {photoBusy ? (
              <ActivityIndicator color={Color.MAIN} />
            ) : fPhoto ? (
              <Image
                source={{ uri: `data:image/jpeg;base64,${fPhoto}` }}
                style={styles.photoPreview}
              />
            ) : (
              <VixText heading="label" additionalStyle={styles.photoHint}>
                📷{'\n'}Foto
              </VixText>
            )}
          </PressableScale>

          <FormInput
            style={styles.formGap}
            placeholder="Nama"
            value={fName}
            onChangeText={setFName}
            editable={!busy}
          />

          <VixText heading="label" additionalStyle={styles.fieldLabel}>
            Tanggal lahir
          </VixText>
          <View style={styles.formGap}>
            {/* key = id supaya state picker internal reset tiap ganti orang */}
            <DateField
              key={editing === 'new' ? 'new' : editing?.id}
              value={fBirthday}
              onChange={setFBirthday}
            />
          </View>

          {/* Status meninggal ✝ */}
          <PressableScale
            style={styles.deceasedRow}
            onPress={() => setFDeceased((d) => !d)}>
            <CheckCircle checked={fDeceased} />
            <VixText heading="paragraph" additionalStyle={styles.deceasedText}>
              Sudah meninggal ✝ (tampil hitam-putih di pohon)
            </VixText>
          </PressableScale>

          {/* Orang tua (maks 2) */}
          <VixText heading="label" additionalStyle={styles.fieldLabel}>
            👪 Orang tuanya siapa? (maks 2 — anak otomatis terhubung)
          </VixText>
          <View style={styles.chipWrap}>
            {all
              .filter((m) => m.id !== editingId)
              .map((m) => (
                <Chip
                  key={m.id}
                  label={`${m.deceased ? '✝ ' : ''}${m.name}`}
                  active={fParents.includes(m.id)}
                  onPress={() => toggleParent(m.id)}
                />
              ))}
            {all.length === 0 && (
              <VixText heading="label">
                Belum ada anggota lain — tambah dulu, hubungkan belakangan.
              </VixText>
            )}
          </View>

          {/* Pasangan (suami/istri) */}
          <VixText heading="label" additionalStyle={styles.fieldLabel}>
            💍 Pasangannya siapa? (suami / istri)
          </VixText>
          <View style={styles.chipWrap}>
            {all
              .filter((m) => m.id !== editingId)
              .map((m) => (
                <Chip
                  key={m.id}
                  label={`${m.deceased ? '✝ ' : ''}${m.name}`}
                  active={fPartners.includes(m.id)}
                  onPress={() => togglePartner(m.id)}
                />
              ))}
            {all.length === 0 && (
              <VixText heading="label">
                Tambah dulu calon pasangannya sebagai anggota.
              </VixText>
            )}
          </View>

          {formError && (
            <VixText heading="label" additionalStyle={styles.sheetError}>
              {formError}
            </VixText>
          )}
          {/* Konfirmasi hapus inline — iOS tidak bisa modal di atas modal */}
          {editing !== 'new' && editing !== null && (
            <InlineDelete
              key={editing.id}
              label="Hapus anggota ini"
              busy={busy}
              onDelete={handleDelete}
            />
          )}
          <DualButtons
            confirmLabel="Simpan"
            busy={busy}
            onCancel={() => setEditing(null)}
            onConfirm={handleSave}
          />
        </ScrollView>
      </SheetModal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.BACKGROUND },
  error: { color: Color.DANGER, paddingHorizontal: 20, marginBottom: 6 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 40 },
  addButton: { marginBottom: 12 },
  emptyCard: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Color.BORDER,
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  emptyEmoji: { fontSize: 52, lineHeight: 64 },
  emptyTitle: { textAlign: 'center' },
  emptyText: { textAlign: 'center' },
  // Pohon — latar gelap biar terasa "layar game"
  treeCard: {
    backgroundColor: Color.MAIN_DARK,
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 12,
    alignItems: 'center',
    marginBottom: 14,
  },
  // Baris pasangan: avatar + garis nikah horizontal di antaranya.
  coupleRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  coupleItem: { flexDirection: 'row', alignItems: 'flex-start' },
  marryLink: {
    width: 26,
    height: 3,
    borderRadius: 2,
    backgroundColor: Color.MAIN_LIGHT,
    marginTop: 30,
    marginHorizontal: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  marryHeart: { fontSize: 14, lineHeight: 16, marginTop: -8 },
  childrenRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
  },
  vConnector: {
    width: 3,
    height: 18,
    backgroundColor: Color.MAIN_LIGHT,
    borderRadius: 2,
    marginVertical: 4,
  },
  genLabel: { color: Color.TEXT_ON_DARK_MUTED, marginBottom: 8 },
  avatarWrap: { alignItems: 'center', marginHorizontal: 6 },
  avatarBox: {
    backgroundColor: Color.CONTAINER,
    borderWidth: 2,
    borderColor: Color.MAIN,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarSelected: {
    borderWidth: 3,
    borderColor: Color.MAIN_LIGHT,
  },
  avatarDeceased: {
    backgroundColor: Color.TEXT_TITLE,
    borderColor: Color.TEXT_LABEL,
  },
  avatarPhoto: { width: '100%', height: '100%' },
  photoDeceased: { opacity: 0.35 }, // efek pudar hitam-putih
  crossBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: Color.TEXT_TITLE,
    borderRadius: 8,
    paddingHorizontal: 4,
  },
  crossText: { color: Color.TEXT_REVERSE },
  avatarName: { color: Color.TEXT_REVERSE, marginTop: 4 },
  nameDeceased: { color: Color.TEXT_ON_DARK_MUTED },
  avatarAge: { color: Color.TEXT_ON_DARK_MUTED },
  editButton: {
    marginTop: 16,
    backgroundColor: Color.MAIN,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  editButtonText: { color: Color.TEXT_REVERSE },
  sectionTitle: { marginBottom: 10 },
  allGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    backgroundColor: Color.CONTAINER,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Color.BORDER,
    padding: 16,
  },
  // Form
  formScroll: { maxHeight: 520 },
  photoPicker: {
    alignSelf: 'center',
    width: 84,
    height: 84,
    borderRadius: 18,
    backgroundColor: Color.CONTRAST_CONTAINER,
    borderWidth: 1,
    borderColor: Color.BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: 12,
  },
  photoPreview: { width: '100%', height: '100%' },
  photoHint: { textAlign: 'center' },
  formGap: { marginBottom: 10 },
  fieldLabel: { marginBottom: 6 },
  deceasedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    marginBottom: 4,
  },
  deceasedText: { color: Color.TEXT_TITLE, flexShrink: 1 },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  sheetError: { color: Color.DANGER, marginBottom: 8 },
});
