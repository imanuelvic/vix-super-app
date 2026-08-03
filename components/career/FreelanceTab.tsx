import { Timestamp } from 'firebase/firestore';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { CheckCircle } from '@/components/common/CheckCircle';
import { DateField } from '@/components/common/DateField';
import { DualButtons } from '@/components/common/DualButtons';
import { FormInput } from '@/components/common/FormInput';
import { InlineDelete } from '@/components/common/InlineDelete';
import { PressableScale } from '@/components/common/PressableScale';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { SheetModal } from '@/components/common/SheetModal';
import { VixText } from '@/components/common/VixText';
import { useAuth } from '@/contexts/auth';
import {
  deadlineDaysUntil,
  newCareerId,
  saveFreelance,
  type FreelanceProject,
} from '@/lib/career';
import { formatDate, groupDigits, parseAmount } from '@/lib/format';
import { formatRupiah } from '@/lib/transactions';

// Tab Freelance 🌐: proyek website & aplikasi — siapa client-nya,
// deadline kapan, requirement apa, dan fee-nya berapa.
export function FreelanceTab({
  projects,
  editId,
}: {
  projects: FreelanceProject[];
  // Kalau di-set (dari reminder Home), langsung buka modal edit proyek ini.
  editId?: string;
}) {
  const { user } = useAuth();

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Form tambah/edit. 'new' = sedang menambah baru.
  const [editing, setEditing] = useState<FreelanceProject | 'new' | null>(null);
  const [fName, setFName] = useState('');
  const [fClient, setFClient] = useState('');
  const [fRequirement, setFRequirement] = useState('');
  const [fFee, setFFee] = useState('');
  const [fDeadline, setFDeadline] = useState(new Date());
  const [fDone, setFDone] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const today = new Date();
  // Aktif urut deadline terdekat; yang selesai di bawah.
  const sorted = [...projects].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    return a.deadline.toMillis() - b.deadline.toMillis();
  });
  const active = projects.filter((p) => !p.done);
  const activeFee = active.reduce((sum, p) => sum + p.fee, 0);

  function openAdd() {
    setEditing('new');
    setFName('');
    setFClient('');
    setFRequirement('');
    setFFee('');
    setFDeadline(new Date());
    setFDone(false);
    setFormError(null);
  }

  const openEdit = useCallback((p: FreelanceProject) => {
    setEditing(p);
    setFName(p.name);
    setFClient(p.client);
    setFRequirement(p.requirement);
    setFFee(p.fee > 0 ? groupDigits(String(p.fee)) : '');
    setFDeadline(p.deadline.toDate());
    setFDone(p.done);
    setFormError(null);
  }, []);

  // Auto-buka modal edit saat dibuka dari reminder Home (?edit=<id>).
  // consumedRef mencegah modal terbuka lagi setelah ditutup; tap ulang dari
  // Home men-mount tab ini fresh, jadi ref-nya reset & modal terbuka lagi.
  const consumedRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!editId || consumedRef.current === editId) return;
    const proj = projects.find((p) => p.id === editId);
    if (proj) {
      consumedRef.current = editId;
      openEdit(proj);
    }
  }, [editId, projects, openEdit]);

  async function handleSave() {
    if (!user || !editing || busy) return;
    if (!fName.trim()) {
      setFormError('Nama proyeknya diisi dulu.');
      return;
    }
    if (!fClient.trim()) {
      setFormError('Siapa client-nya?');
      return;
    }
    setBusy(true);
    setFormError(null);
    const data: FreelanceProject = {
      id: editing === 'new' ? newCareerId() : editing.id,
      name: fName.trim(),
      client: fClient.trim(),
      requirement: fRequirement.trim(),
      fee: parseAmount(fFee),
      deadline: Timestamp.fromDate(fDeadline),
      done: fDone,
    };
    const next =
      editing === 'new'
        ? [...projects, data]
        : projects.map((p) => (p.id === editing.id ? data : p));
    try {
      await saveFreelance(user.uid, next);
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
      await saveFreelance(user.uid, projects.filter((p) => p.id !== editing.id));
    } catch {
      setError('Gagal menghapus. Coba lagi.');
    } finally {
      setEditing(null);
      setBusy(false);
    }
  }

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Ringkasan usaha freelance */}
        <View style={styles.heroCard}>
          <VixText heading="label" additionalStyle={styles.heroLabel}>
            🌐 Website & App Developer — Freelance
          </VixText>
          <VixText heading="subheader" additionalStyle={styles.heroValue}>
            {active.length}{' '}
            <VixText heading="label" additionalStyle={styles.heroLabel}>
              proyek aktif · nilai {formatRupiah(activeFee)}
            </VixText>
          </VixText>
        </View>

        <PrimaryButton
          label="Tambah Proyek"
          icon="plus"
          onPress={openAdd}
          additionalStyle={styles.addButton}
        />

        {error && (
          <VixText heading="label" additionalStyle={styles.error}>
            {error}
          </VixText>
        )}

        {sorted.length === 0 && (
          <VixText heading="label" additionalStyle={styles.empty}>
            Belum ada proyek — catat proyek client pertamamu di sini 🚀
          </VixText>
        )}

        {sorted.map((p) => {
          const days = deadlineDaysUntil(p, today);
          const status = p.done
            ? '✅ Selesai'
            : days === 0
              ? '⏰ DEADLINE HARI INI!'
              : days > 0
                ? `⏳ ${days} hari lagi`
                : `⚠️ Lewat ${-days} hari`;
          const urgent = !p.done && days <= 3;
          return (
            // Tekan untuk edit / tandai selesai.
            <PressableScale
              key={p.id}
              style={[styles.card, urgent && styles.cardUrgent]}
              onPress={() => openEdit(p)}>
              <View style={styles.cardTop}>
                <VixText
                  heading="bold"
                  numberOfLines={1}
                  additionalStyle={styles.cardTitle}>
                  {p.name}
                </VixText>
                {p.fee > 0 && (
                  <VixText heading="bold" additionalStyle={styles.feeText}>
                    {formatRupiah(p.fee)}
                  </VixText>
                )}
              </View>
              <VixText heading="label">
                👤 {p.client} · 📆 {formatDate(p.deadline.toDate())}
              </VixText>
              {p.requirement ? (
                <VixText heading="label" numberOfLines={2}>
                  📋 {p.requirement}
                </VixText>
              ) : null}
              <VixText
                heading="label"
                additionalStyle={
                  p.done
                    ? styles.statusDone
                    : days < 0 || days === 0
                      ? styles.statusLate
                      : urgent
                        ? styles.statusWarn
                        : undefined
                }>
                {status}
              </VixText>
            </PressableScale>
          );
        })}
      </ScrollView>

      {/* Sheet tambah/edit proyek */}
      <SheetModal
        visible={!!editing}
        title={editing === 'new' ? 'Tambah Proyek' : 'Edit Proyek'}
        scroll={false}
        onClose={() => setEditing(null)}>
        <ScrollView
          style={styles.formScroll}
          keyboardShouldPersistTaps="handled">
          <FormInput
            style={styles.formGap}
            placeholder="Nama proyek"
            value={fName}
            onChangeText={setFName}
            editable={!busy}
          />
          <FormInput
            style={styles.formGap}
            placeholder="Client — siapa pemesannya"
            value={fClient}
            onChangeText={setFClient}
            editable={!busy}
          />
          <FormInput
            style={styles.reqInput}
            placeholder="Requirement — fitur/halaman yang diminta"
            value={fRequirement}
            onChangeText={setFRequirement}
            multiline
            editable={!busy}
          />
          <FormInput
            style={styles.formGap}
            placeholder="Fee (Rp, opsional)"
            keyboardType="number-pad"
            value={fFee}
            onChangeText={(t) => setFFee(groupDigits(t))}
            editable={!busy}
          />
          <VixText heading="label" additionalStyle={styles.fieldLabel}>
            Deadline
          </VixText>
          <View style={styles.formGap}>
            {/* key = id supaya state picker internal reset tiap ganti proyek */}
            <DateField
              key={editing === 'new' ? 'new' : editing?.id}
              value={fDeadline}
              onChange={setFDeadline}
            />
          </View>
          {/* Tandai selesai */}
          <PressableScale style={styles.doneRow} onPress={() => setFDone((d) => !d)}>
            <CheckCircle checked={fDone} />
            <VixText heading="paragraph" additionalStyle={styles.doneText}>
              Proyek selesai ✅
            </VixText>
          </PressableScale>
          {formError && (
            <VixText heading="label" additionalStyle={styles.error}>
              {formError}
            </VixText>
          )}
          {/* Konfirmasi hapus inline — iOS tidak bisa modal di atas modal */}
          {editing !== 'new' && editing !== null && (
            <InlineDelete
              key={editing.id}
              label="Hapus proyek ini"
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
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 },
  heroCard: {
    backgroundColor: Color.MAIN_DARK,
    borderRadius: 20,
    padding: 18,
    gap: 4,
    marginBottom: 10,
  },
  heroLabel: { color: Color.TEXT_ON_DARK_MUTED },
  heroValue: { color: Color.TEXT_REVERSE },
  addButton: { marginBottom: 12 },
  error: { color: Color.DANGER, marginBottom: 8 },
  empty: { textAlign: 'center', marginTop: 8 },
  card: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Color.BORDER,
    padding: 14,
    marginBottom: 10,
    gap: 4,
  },
  cardUrgent: {
    backgroundColor: Color.WARNING_TRANSPARENT,
    borderColor: Color.WARNING,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: { flex: 1, color: Color.TEXT_TITLE },
  feeText: { color: Color.MAIN_DARK },
  statusDone: { color: Color.SUCCESS },
  statusLate: { color: Color.DANGER },
  statusWarn: { color: Color.WARNING },
  formScroll: { flexShrink: 1 },
  formGap: { marginBottom: 10 },
  reqInput: {
    minHeight: 90,
    textAlignVertical: 'top',
    marginBottom: 10,
  },
  fieldLabel: { marginBottom: 6 },
  doneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 6,
    marginBottom: 4,
  },
  doneText: { color: Color.TEXT_TITLE },
});
