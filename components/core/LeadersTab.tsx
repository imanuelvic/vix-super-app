import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { Chip } from '@/components/common/Chip';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { DateField } from '@/components/common/DateField';
import { DualButtons } from '@/components/common/DualButtons';
import { FormInput } from '@/components/common/FormInput';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { SheetModal } from '@/components/common/SheetModal';
import { VixText } from '@/components/common/VixText';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/contexts/auth';
import {
  currentAge,
  HEARTS,
  newCoreLeaderId,
  newMainTeamId,
  nextBirthday,
  normalizePhone,
  saveCoreLeaders,
  saveMainTeam,
  type CoreLeader,
  type MainTeamMember,
} from '@/lib/core';
import { MONTH_NAMES } from '@/lib/format';

// Tab CORE Leader: data semua CL + Main Team yang membantu mereka —
// nama, warna hati CORE, tanggal lahir, umur, nomor WA, hitung mundur
// ulang tahun, dan kapan terakhir di-follow-up.
export function LeadersTab({
  leaders,
  mainTeam,
}: {
  leaders: CoreLeader[];
  mainTeam: MainTeamMember[];
}) {
  const { user } = useAuth();

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Form CORE Leader. 'new' = sedang menambah baru.
  const [editing, setEditing] = useState<CoreLeader | 'new' | null>(null);
  const [fName, setFName] = useState('');
  const [fHeart, setFHeart] = useState('❤️');
  const [fBirthday, setFBirthday] = useState(new Date(2000, 0, 1));
  const [fPhone, setFPhone] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Form Main Team (terpisah karena field-nya beda: pilih CL, tanpa hati).
  const [editingMT, setEditingMT] = useState<MainTeamMember | 'new' | null>(null);
  const [mtName, setMtName] = useState('');
  const [mtLeaderId, setMtLeaderId] = useState('');
  const [mtBirthday, setMtBirthday] = useState(new Date(2000, 0, 1));
  const [mtPhone, setMtPhone] = useState('');
  const [mtFormError, setMtFormError] = useState<string | null>(null);
  const [confirmDeleteMT, setConfirmDeleteMT] = useState(false);

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
    setFormError(null);
  }

  function openEdit(l: CoreLeader) {
    setEditing(l);
    setFName(l.name);
    setFHeart(l.heart);
    setFBirthday(new Date(l.birthYear, l.birthMonth, l.birthDay));
    setFPhone(l.phone ?? '');
    setFormError(null);
  }

  async function handleSave() {
    if (!user || !editing || busy) return;
    if (!fName.trim()) {
      setFormError('Nama wajib diisi.');
      return;
    }
    setBusy(true);
    setFormError(null);
    const data: CoreLeader = {
      id: editing === 'new' ? newCoreLeaderId() : editing.id,
      name: fName.trim(),
      heart: fHeart,
      birthYear: fBirthday.getFullYear(),
      birthMonth: fBirthday.getMonth(),
      birthDay: fBirthday.getDate(),
      phone: normalizePhone(fPhone), // "08…" / "+62…" / "62…" semua dirapikan
      lastFollowupDayId: editing === 'new' ? null : editing.lastFollowupDayId,
    };
    const next =
      editing === 'new'
        ? [...leaders, data]
        : leaders.map((l) => (l.id === editing.id ? data : l));
    try {
      await saveCoreLeaders(user.uid, next);
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
      await saveCoreLeaders(user.uid, leaders.filter((l) => l.id !== editing.id));
    } catch {
      setError('Gagal menghapus. Coba lagi.');
    } finally {
      setConfirmDelete(false);
      setEditing(null);
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
    setMtFormError(null);
  }

  function openEditMT(m: MainTeamMember) {
    setEditingMT(m);
    setMtName(m.name);
    setMtLeaderId(m.leaderId);
    setMtBirthday(new Date(m.birthYear, m.birthMonth, m.birthDay));
    setMtPhone(m.phone ?? '');
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
      lastFollowupDayId:
        editingMT === 'new' ? null : editingMT.lastFollowupDayId,
    };
    const next =
      editingMT === 'new'
        ? [...mainTeam, data]
        : mainTeam.map((m) => (m.id === editingMT.id ? data : m));
    try {
      await saveMainTeam(user.uid, next);
      setEditingMT(null);
    } catch {
      setMtFormError('Gagal menyimpan. Cek koneksi internet.');
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
      setError('Gagal menghapus. Coba lagi.');
    } finally {
      setConfirmDeleteMT(false);
      setEditingMT(null);
      setBusy(false);
    }
  }

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={styles.content}>
        <PrimaryButton
          label="Tambah CORE Leader"
          icon="plus"
          onPress={openAdd}
          additionalStyle={styles.addButton}
        />

        <VixText heading="label" additionalStyle={styles.countLine}>
          {leaders.length} CORE Leader · {mainTeam.length} Main Team 🙏
        </VixText>

        {error && (
          <VixText heading="label" additionalStyle={styles.error}>
            {error}
          </VixText>
        )}

        {leaders.map((l) => {
          const { daysUntil } = nextBirthday(l, today);
          const soon = daysUntil <= 30;
          return (
            // Tekan untuk edit data CL.
            <Pressable key={l.id} style={styles.card} onPress={() => openEdit(l)}>
              <View style={styles.cardLeft}>
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
                    📱 {l.phone ? `+62${l.phone}` : 'belum ada nomor'} ·
                    FU terakhir: {l.lastFollowupDayId ?? 'belum'}
                  </VixText>
                </View>
              </View>
              <View style={styles.cardRight}>
                {soon && (
                  <View style={styles.birthdayChip}>
                    <VixText heading="label" additionalStyle={styles.birthdayChipText}>
                      🎂 {daysUntil === 0 ? 'Hari ini!' : `${daysUntil} hr lagi`}
                    </VixText>
                  </View>
                )}
                <IconSymbol
                  name="pencil"
                  size={16}
                  color={Color.TEXT_PLACEHOLDER}
                />
              </View>
            </Pressable>
          );
        })}

        {/* ===== Main Team ===== */}
        <VixText heading="title" additionalStyle={styles.sectionTitle}>
          👥 Main Team
        </VixText>
        <PrimaryButton
          label="Tambah Main Team"
          icon="plus"
          background={Color.ACCENT}
          textColor={Color.ACCENT_DARK}
          onPress={openAddMT}
          additionalStyle={styles.addButton}
        />

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
            // Tekan untuk edit data Main Team.
            <Pressable
              key={m.id}
              style={styles.card}
              onPress={() => openEditMT(m)}>
              <View style={styles.cardLeft}>
                <VixText additionalStyle={styles.heart}>👤</VixText>
                <View style={styles.cardInfo}>
                  <VixText heading="bold" additionalStyle={styles.name}>
                    {m.name}
                  </VixText>
                  <VixText heading="label">
                    Bantu: {cl ? `${cl.heart} ${cl.name}` : '(CL tidak ditemukan)'}
                  </VixText>
                  <VixText heading="label">
                    {m.birthDay} {MONTH_NAMES[m.birthMonth]} {m.birthYear} ·{' '}
                    {currentAge(m, today)} th
                  </VixText>
                  <VixText heading="label" additionalStyle={styles.followupLine}>
                    📱 {m.phone ? `+62${m.phone}` : 'belum ada nomor'} ·
                    FU terakhir: {m.lastFollowupDayId ?? 'belum'}
                  </VixText>
                </View>
              </View>
              <View style={styles.cardRight}>
                {soon && (
                  <View style={styles.birthdayChip}>
                    <VixText heading="label" additionalStyle={styles.birthdayChipText}>
                      🎂 {daysUntil === 0 ? 'Hari ini!' : `${daysUntil} hr lagi`}
                    </VixText>
                  </View>
                )}
                <IconSymbol
                  name="pencil"
                  size={16}
                  color={Color.TEXT_PLACEHOLDER}
                />
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Bottom sheet tambah/edit CL */}
      <SheetModal
        visible={!!editing}
        title={editing === 'new' ? 'Tambah CORE Leader' : 'Edit CORE Leader'}
        onClose={() => setEditing(null)}>
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
            <Pressable
              key={h}
              style={[styles.heartChip, fHeart === h && styles.heartActive]}
              onPress={() => setFHeart(h)}>
              <VixText additionalStyle={styles.heartOption}>{h}</VixText>
            </Pressable>
          ))}
        </View>

        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          Tanggal lahir
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
          No. HP (untuk tombol chat WhatsApp)
        </VixText>
        <View style={styles.phoneRow}>
          <View style={styles.phonePrefix}>
            <VixText heading="bold" additionalStyle={styles.phonePrefixText}>
              +62
            </VixText>
          </View>
          <FormInput
            style={styles.phoneInput}
            placeholder="81234567890 (tanpa 0 di depan)"
            keyboardType="phone-pad"
            value={fPhone}
            onChangeText={(t) => setFPhone(t.replace(/\D/g, ''))}
            editable={!busy}
          />
        </View>

        {formError && (
          <VixText heading="label" additionalStyle={styles.error}>
            {formError}
          </VixText>
        )}
        {editing !== 'new' && editing !== null && (
          <Pressable onPress={() => setConfirmDelete(true)} disabled={busy}>
            <VixText heading="bold" additionalStyle={styles.deleteText}>
              Hapus CORE Leader ini
            </VixText>
          </Pressable>
        )}
        <DualButtons
          confirmLabel="Simpan"
          busy={busy}
          onCancel={() => setEditing(null)}
          onConfirm={handleSave}
        />
      </SheetModal>

      {/* Bottom sheet tambah/edit Main Team */}
      <SheetModal
        visible={!!editingMT}
        title={editingMT === 'new' ? 'Tambah Main Team' : 'Edit Main Team'}
        onClose={() => setEditingMT(null)}>
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
          Tanggal lahir
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
          No. HP (untuk tombol chat WhatsApp)
        </VixText>
        <View style={styles.phoneRow}>
          <View style={styles.phonePrefix}>
            <VixText heading="bold" additionalStyle={styles.phonePrefixText}>
              +62
            </VixText>
          </View>
          <FormInput
            style={styles.phoneInput}
            placeholder="81234567890 (tanpa 0 di depan)"
            keyboardType="phone-pad"
            value={mtPhone}
            onChangeText={(t) => setMtPhone(t.replace(/\D/g, ''))}
            editable={!busy}
          />
        </View>

        {mtFormError && (
          <VixText heading="label" additionalStyle={styles.error}>
            {mtFormError}
          </VixText>
        )}
        {editingMT !== 'new' && editingMT !== null && (
          <Pressable onPress={() => setConfirmDeleteMT(true)} disabled={busy}>
            <VixText heading="bold" additionalStyle={styles.deleteText}>
              Hapus Main Team ini
            </VixText>
          </Pressable>
        )}
        <DualButtons
          confirmLabel="Simpan"
          busy={busy}
          onCancel={() => setEditingMT(null)}
          onConfirm={handleSaveMT}
        />
      </SheetModal>

      {/* Konfirmasi hapus CL */}
      <ConfirmDialog
        visible={confirmDelete}
        title="Hapus CORE Leader?"
        detail="Data CL ini akan dihapus permanen."
        busy={busy}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
      />

      {/* Konfirmasi hapus Main Team */}
      <ConfirmDialog
        visible={confirmDeleteMT}
        title="Hapus Main Team?"
        detail="Data Main Team ini akan dihapus permanen."
        busy={busy}
        onCancel={() => setConfirmDeleteMT(false)}
        onConfirm={handleDeleteMT}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 },
  addButton: { marginBottom: 10 },
  countLine: { textAlign: 'center', marginBottom: 12 },
  error: { color: Color.DANGER, marginBottom: 8 },
  sectionTitle: { marginTop: 12, marginBottom: 10 },
  emptyText: { textAlign: 'center', marginBottom: 12 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
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
  deleteText: { color: Color.DANGER, textAlign: 'center', marginTop: 4 },
});
