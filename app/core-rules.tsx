import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { CardActionButton } from '@/components/common/CardActionButton';
import { DualButtons } from '@/components/common/DualButtons';
import { EditDelete } from '@/components/common/EditDelete';
import { FormError } from '@/components/common/FormError';
import { FormInput } from '@/components/common/FormInput';
import { LoadingCenter } from '@/components/common/LoadingCenter';
import { PressableScale } from '@/components/common/PressableScale';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { ScreenError } from '@/components/common/ScreenError';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { SelectField } from '@/components/common/SelectField';
import { SheetModal } from '@/components/common/SheetModal';
import { VixText } from '@/components/common/VixText';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { RuleBody } from '@/components/core/RuleBody';
import { useAuth } from '@/contexts/auth';
import { MEETING_KINDS } from '@/lib/core';
import {
  deleteCoreRule,
  emptyCoreRule,
  ruleFullTitle,
  saveCoreRule,
  seedCoreRules,
  sortCoreRules,
  subscribeCoreRules,
  type CoreRule,
} from '@/lib/coreRules';
import { shareRulePdf } from '@/lib/coreRulesPdf';
import { DELETE_ERROR, LOAD_ERROR, SAVE_ERROR } from '@/lib/messages';

// Rules & Suggestions 📜 — panduan resmi tiap jenis acara CORE.
// Ini dokumen yang kamu kirim ke setiap CORE Leader begitu ada reminder
// acaranya, jadi tiap dokumen bisa langsung dicetak jadi PDF & dibagikan.
export default function CoreRulesScreen() {
  const { user } = useAuth();

  const [rules, setRules] = useState<CoreRule[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openKind, setOpenKind] = useState<string | null>(null);
  const [sharingKind, setSharingKind] = useState<string | null>(null);

  // Form tambah/ubah dokumen.
  const [editing, setEditing] = useState<CoreRule | 'new' | null>(null);
  const [fKind, setFKind] = useState<string>('visitasi');
  const [fIcon, setFIcon] = useState('📜');
  const [fTitle, setFTitle] = useState('');
  const [fCredit, setFCredit] = useState('');
  const [fVersion, setFVersion] = useState('');
  const [fUpdated, setFUpdated] = useState('');
  const [fBody, setFBody] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    return subscribeCoreRules(
      user.uid,
      (next) => {
        setRules(sortCoreRules(next));
        setError(null);
      },
      () => setError(LOAD_ERROR),
    );
  }, [user]);

  // Tulis dokumen bawaan yang belum ada. Hanya menulis yang benar-benar
  // kurang, jadi hasil suntinganmu tidak pernah tertimpa — dan kalau semuanya
  // sudah ada, tidak ada tulisan ke Firestore sama sekali.
  useEffect(() => {
    if (!user || rules === null) return;
    seedCoreRules(user.uid, rules).catch(() => undefined);
  }, [user, rules]);

  function openAdd() {
    // Tawarkan jenis acara yang belum punya dokumen.
    const belum = MEETING_KINDS.find(
      (k) => !(rules ?? []).some((r) => r.kind === k.key),
    );
    const kind = belum?.key ?? 'visitasi';
    const kosong = emptyCoreRule(kind);
    setEditing('new');
    setFKind(kind);
    setFIcon(kosong.icon);
    setFTitle(kosong.title);
    setFCredit('');
    setFVersion(kosong.version);
    setFUpdated('');
    setFBody('');
    setFormError(null);
  }

  function openEdit(r: CoreRule) {
    setEditing(r);
    setFKind(r.kind);
    setFIcon(r.icon);
    setFTitle(r.title);
    setFCredit(r.credit);
    setFVersion(r.version);
    setFUpdated(r.updated);
    setFBody(r.body);
    setFormError(null);
  }

  /** Cetak panduan jadi PDF lalu buka share sheet (ada WhatsApp di dalamnya). */
  async function handleShare(r: CoreRule) {
    if (sharingKind) return;
    setSharingKind(r.kind);
    setError(null);
    try {
      await shareRulePdf(r);
    } catch {
      setError('Gagal membuat PDF panduan. Coba lagi.');
    } finally {
      setSharingKind(null);
    }
  }

  async function handleSave() {
    if (!user || !editing || busy) return;
    if (!fTitle.trim()) {
      setFormError('Judul panduan wajib diisi.');
      return;
    }
    // Satu jenis acara = satu dokumen (kind dipakai sebagai id Firestore),
    // jadi jenis yang sudah punya dokumen tidak boleh dipakai lagi.
    const bentrok = (rules ?? []).some(
      (r) => r.kind === fKind && (editing === 'new' || r.kind !== editing.kind),
    );
    if (bentrok) {
      setFormError('Jenis acara ini sudah punya panduan. Ubah yang itu saja.');
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      // Ganti jenis acara = pindah dokumen: tulis yang baru, buang yang lama.
      if (editing !== 'new' && editing.kind !== fKind) {
        await deleteCoreRule(user.uid, editing.kind);
      }
      await saveCoreRule(user.uid, {
        kind: fKind,
        icon: fIcon.trim() || '📜',
        title: fTitle.trim(),
        credit: fCredit.trim(),
        version: fVersion.trim(),
        updated: fUpdated.trim(),
        body: fBody.trim(),
      });
      setEditing(null);
    } catch {
      setFormError(SAVE_ERROR);
    } finally {
      setBusy(false);
    }
  }

  // Hapus PERMANEN dari Firestore. Catatan: dokumen BAWAAN (Visitasi &
  // Charity) akan ditulis ulang saat layar ini dibuka lagi — itu memang sifat
  // "bawaan"; kalau mau menghilangkannya, kosongkan isinya saja.
  async function handleDelete() {
    if (!user || !editing || editing === 'new' || busy) return;
    setBusy(true);
    try {
      await deleteCoreRule(user.uid, editing.kind);
      setEditing(null);
    } catch {
      setError(DELETE_ERROR);
    } finally {
      setBusy(false);
    }
  }

  // Pilihan topik = semua jenis pertemuan + topik lepas yang sudah punya
  // dokumen (mis. "fundraising", yang bukan acara terjadwal). Tanpa bagian
  // kedua, membuka panduan Fundraising lalu menyimpannya akan diam-diam
  // memindahkannya ke jenis lain.
  const kindOptions = [
    ...MEETING_KINDS.map((k) => ({
      key: k.key as string,
      label: `${k.icon} ${k.label}`,
    })),
    ...(rules ?? [])
      .filter((r) => !MEETING_KINDS.some((k) => k.key === r.kind))
      .map((r) => ({ key: r.kind, label: `${r.icon} ${r.title}` })),
  ];

  function renderCard(r: CoreRule) {
    const expanded = openKind === r.kind;
    return (
      <View key={r.kind} style={styles.card}>
        <PressableScale
          style={styles.cardHeader}
          onPress={() => setOpenKind(expanded ? null : r.kind)}>
          <View style={styles.cardMain}>
            <VixText heading="bold" additionalStyle={styles.cardTitle}>
              {ruleFullTitle(r)}
            </VixText>
            {r.credit ? (
              <VixText heading="label" additionalStyle={styles.cardSub}>
                {r.credit}
              </VixText>
            ) : null}
            {/* Dokumen baru belum bernomor versi — jangan sampai barisnya
                jadi diawali " · " menggantung. */}
            {r.version || r.updated ? (
              <VixText heading="label" additionalStyle={styles.cardSub}>
                {[r.version, r.updated ? `📅 ${r.updated}` : '']
                  .filter(Boolean)
                  .join(' · ')}
              </VixText>
            ) : null}
          </View>
          <IconSymbol
            name={expanded ? 'chevron.up' : 'chevron.down'}
            size={18}
            color={Color.TEXT_LABEL}
          />
        </PressableScale>

        {expanded && (
          <View style={styles.cardBody}>
            {r.body.trim() ? (
              <RuleBody body={r.body} />
            ) : (
              <VixText heading="label" additionalStyle={styles.empty}>
                Panduan ini belum ada isinya.
              </VixText>
            )}
            <View style={styles.actionRow}>
              <CardActionButton
                icon="pencil"
                label="Ubah panduan"
                onPress={() => openEdit(r)}
                additionalStyle={styles.actionButton}
              />
              {/* Cetak jadi PDF lalu buka share sheet — WhatsApp ada di situ */}
              <CardActionButton
                icon="square.and.arrow.up"
                label="Share PDF"
                variant="filled"
                onPress={() => handleShare(r)}
                busy={sharingKind === r.kind}
                disabled={sharingKind !== null}
                additionalStyle={styles.actionButton}
              />
            </View>
          </View>
        )}
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        backLabel="CORE"
        title="Rules & Suggestions 📜"
        subtitle={`${rules?.length ?? 0} panduan acara CORE`}
      />

      <ScreenError message={error} />

      {rules === null ? (
        <LoadingCenter />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled">
          <PrimaryButton
            label="Tambah Panduan"
            icon="plus"
            onPress={openAdd}
            additionalStyle={styles.addButton}
          />

          {rules.length === 0 ? (
            <VixText heading="label" additionalStyle={styles.empty}>
              Belum ada panduan. Tambahkan aturan untuk jenis acara CORE-mu 📜
            </VixText>
          ) : (
            rules.map(renderCard)
          )}
        </ScrollView>
      )}

      {/* Sheet tambah / ubah panduan */}
      <SheetModal
        visible={!!editing}
        title={editing === 'new' ? 'Tambah Panduan' : 'Ubah Panduan'}
        subtitle="Dokumen yang dikirim ke CORE Leader saat acaranya dijadwalkan"
        onClose={() => setEditing(null)}>
        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          Topik panduan
        </VixText>
        <View style={styles.formGap}>
          <SelectField
            value={fKind}
            options={kindOptions}
            onChange={(k) => k && setFKind(k)}
            placeholder="Pilih topik…"
          />
        </View>

        {/* Ikon & judul sebaris: ikonnya sempit, judulnya melebar. */}
        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          🏷️ Ikon & judul panduan
        </VixText>
        <View style={[styles.titleRow, styles.formGap]}>
          <FormInput
            style={styles.iconInput}
            placeholder="📜"
            value={fIcon}
            onChangeText={setFIcon}
            editable={!busy}
          />
          <FormInput
            style={styles.flexInput}
            placeholder="mis. CORE Fundraising"
            value={fTitle}
            onChangeText={setFTitle}
            editable={!busy}
          />
        </View>

        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          ✍️ Penyusun
        </VixText>
        <FormInput
          style={[styles.creditArea, styles.formGap]}
          placeholder="mis. ~ Arahan utama oleh Ps. Ery Pratignjo…"
          value={fCredit}
          onChangeText={setFCredit}
          editable={!busy}
          multiline
        />

        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          🔢 Versi
        </VixText>
        <FormInput
          style={styles.formGap}
          placeholder="mis. V.1.0.3"
          value={fVersion}
          onChangeText={setFVersion}
          editable={!busy}
        />

        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          📅 Terakhir diperbarui
        </VixText>
        <FormInput
          style={styles.formGap}
          placeholder="mis. Selasa, 26 Mei 2026"
          value={fUpdated}
          onChangeText={setFUpdated}
          editable={!busy}
        />

        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          📜 Isi panduan
        </VixText>
        <VixText heading="label" additionalStyle={styles.hint}>
          Catatan: Baris berawalan * atau - jadi butir, ⚠️ jadi kotak
          penting, dan baris ━━━ jadi garis pemisah.
        </VixText>
        <FormInput
          style={[styles.bodyArea, styles.formGap]}
          placeholder="Isi lengkap panduan…"
          value={fBody}
          onChangeText={setFBody}
          editable={!busy}
          multiline
        />

        <FormError message={formError} />
        {/* Pengenal dokumen ini adalah `kind` (sekaligus id Firestore-nya),
            jadi dipetakan ke bentuk {id} yang dipakai EditDelete untuk `key`. */}
        <EditDelete
          editing={
            editing === null || editing === 'new' ? editing : { id: editing.kind }
          }
          label="Hapus panduan ini"
          busy={busy}
          onDelete={handleDelete}
        />
        <DualButtons
          confirmLabel="Simpan"
          busy={busy}
          onCancel={() => setEditing(null)}
          onConfirm={handleSave}
        />
      </SheetModal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.BACKGROUND },
  content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 40 },
  addButton: { marginBottom: 12 },
  empty: { textAlign: 'center', marginTop: 10 },
  card: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Color.BORDER,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardMain: { flex: 1, gap: 2 },
  cardTitle: { color: Color.TEXT_TITLE },
  cardSub: { color: Color.TEXT_LABEL },
  cardBody: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Color.BORDER,
  },
  // Dua tombol sejajar di kaki kartu: ubah (garis putus) & share PDF (isi).
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  actionButton: { flex: 1 },
  // Ikon (sempit) + judul (melebar) sebaris.
  titleRow: { flexDirection: 'row', gap: 10 },
  iconInput: { width: 64, textAlign: 'center' },
  flexInput: { flex: 1 },
  fieldLabel: { marginBottom: 6 },
  hint: { color: Color.TEXT_PLACEHOLDER, marginBottom: 6 },
  formGap: { marginBottom: 10 },
  creditArea: { minHeight: 68, paddingTop: 12, textAlignVertical: 'top' },
  bodyArea: { minHeight: 220, paddingTop: 12, textAlignVertical: 'top' },
});
