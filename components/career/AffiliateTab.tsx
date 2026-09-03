import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { CARD } from '@/assets/style/card';
import { Color } from '@/assets/style/color';
import { Chip } from '@/components/common/Chip';
import { EditFooter } from '@/components/common/EditFooter';
import { FilterChips } from '@/components/common/FilterChips';
import { FormError } from '@/components/common/FormError';
import { FormInput } from '@/components/common/FormInput';
import { Pagination } from '@/components/common/Pagination';
import { PressableScale } from '@/components/common/PressableScale';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { SheetModal } from '@/components/common/SheetModal';
import { SummaryCard } from '@/components/common/SummaryCard';
import { VixText } from '@/components/common/VixText';
import { useAuth } from '@/contexts/auth';
import { useFormSave } from '@/hooks/useFormSave';
import { usePagination } from '@/hooks/usePagination';
import { useScrollTop } from '@/hooks/useScrollTop';
import {
    AFFILIATE_PLATFORMS,
    IDEA_STAGES,
    newIdeaId,
    platformMeta,
    saveAffiliateIdeas,
    sortedIdeas,
    stageCounts,
    stageMeta,
    type AffiliatePlatform,
    type ContentIdea,
    type IdeaStage,
} from '@/lib/affiliate';
import { openExternalUrl } from '@/lib/linking';
import { DELETE_ERROR, SAVE_ERROR } from '@/lib/messages';
import { Timestamp } from 'firebase/firestore';

// Tab Affiliate 🤝 — topi kelima: Influencer / Content Creator.
//
// Satu daftar untuk dua hal yang memang satu alur: tampungan ide konten, dan
// catatan affiliate (produk + link) di TikTok / Instagram / Threads. Tiap ide
// jalan lewat tiga tahap: 💡 Ide → 🎬 Digarap → ✅ Tayang.
//
// Tahapnya bisa diubah LANGSUNG dari kartunya (tanpa buka modal) — memindahkan
// tahap itu hal yang paling sering dilakukan, dan yang paling sering dilakukan
// harus jadi yang paling sedikit klik-nya.
export function AffiliateTab({ ideas }: { ideas: ContentIdea[] }) {
  const { user } = useAuth();
  const { ref: scrollRef, toTop } = useScrollTop();

  const [stageFilter, setStageFilter] = useState<IdeaStage | null>(null);

  const [editing, setEditing] = useState<ContentIdea | 'new' | null>(null);
  const [fTitle, setFTitle] = useState('');
  const [fNote, setFNote] = useState('');
  const [fPlatforms, setFPlatforms] = useState<AffiliatePlatform[]>([]);
  const [fStage, setFStage] = useState<IdeaStage>('idea');
  const [fProduct, setFProduct] = useState('');
  const [fLink, setFLink] = useState('');
  const { busy, setBusy, formError, setFormError, save } = useFormSave();
  const [error, setError] = useState<string | null>(null);

  const counts = stageCounts(ideas);
  const shown = sortedIdeas(
    stageFilter ? ideas.filter((i) => i.stage === stageFilter) : ideas,
  );

  function openAdd() {
    setEditing('new');
    setFTitle('');
    setFNote('');
    setFPlatforms([]);
    setFStage('idea');
    setFProduct('');
    setFLink('');
    setFormError(null);
  }

  function openEdit(i: ContentIdea) {
    setEditing(i);
    setFTitle(i.title);
    setFNote(i.note);
    setFPlatforms(i.platforms);
    setFStage(i.stage);
    setFProduct(i.product);
    setFLink(i.link);
    setFormError(null);
  }

  function togglePlatform(key: AffiliatePlatform) {
    setFPlatforms((list) =>
      list.includes(key) ? list.filter((k) => k !== key) : [...list, key],
    );
  }

  async function handleSave() {
    if (!user || !editing || busy) return;
    if (!fTitle.trim()) {
      setFormError('Judul idenya diisi dulu ya.');
      return;
    }
    const data: ContentIdea = {
      id: editing === 'new' ? newIdeaId() : editing.id,
      title: fTitle.trim(),
      note: fNote.trim(),
      platforms: fPlatforms,
      stage: fStage,
      product: fProduct.trim(),
      link: fLink.trim(),
      // Waktu dibuat dipertahankan saat mengubah — itu yang menentukan urutan.
      createdAt: editing === 'new' ? Timestamp.now() : editing.createdAt,
    };
    await save(async () => {
      await saveAffiliateIdeas(
        user.uid,
        editing === 'new'
          ? [...ideas, data]
          : ideas.map((i) => (i.id === editing.id ? data : i)),
      );
      setEditing(null);
    });
  }

  /** Hapus permanen — daftarnya ditulis ulang tanpa ide ini. */
  async function handleDelete() {
    if (!user || !editing || editing === 'new' || busy) return;
    setBusy(true);
    try {
      await saveAffiliateIdeas(
        user.uid,
        ideas.filter((i) => i.id !== editing.id),
      );
      setEditing(null);
    } catch {
      setFormError(DELETE_ERROR);
    } finally {
      setBusy(false);
    }
  }

  /** Maju satu tahap: 💡 → 🎬 → ✅ → kembali ke 💡. */
  async function nextStage(i: ContentIdea) {
    if (!user || busy) return;
    const urut = IDEA_STAGES.map((s) => s.key);
    const stage = urut[(urut.indexOf(i.stage) + 1) % urut.length];
    setError(null);
    try {
      await saveAffiliateIdeas(
        user.uid,
        ideas.map((x) => (x.id === i.id ? { ...x, stage } : x)),
      );
    } catch {
      setError(SAVE_ERROR);
    }
  }

  // 10 ide per halaman — daftarnya menumpuk terus tiap kali menulis ide.
  const { currentPage, pageCount, pageItems, setPage } =
    usePagination(shown);

  return (
    <View style={styles.flex}>
      <ScrollView ref={scrollRef} contentContainerStyle={styles.content}>
        <SummaryCard
          label="Ide konten"
          value={
            ideas.length === 0
              ? 'Belum ada ide 💡'
              : `${counts.posted} tayang · ${counts.idea + counts.making} antre`
          }
          sub="Tulis dulu semua idenya — memilih mana yang digarap itu urusan nanti."
        />

        <PrimaryButton
          label="Tambah Ide"
          icon="plus"
          onPress={openAdd}
          additionalStyle={styles.addButton}
        />

        <FormError message={error} />

        <FilterChips
          options={IDEA_STAGES.map((s) => ({
            key: s.key,
            label: `${s.icon} ${s.label}`,
            count: counts[s.key],
          }))}
          value={stageFilter}
          onChange={setStageFilter}
          onRepress={toTop}
        />

        {shown.length === 0 && (
          <VixText heading="label" additionalStyle={styles.empty}>
            {stageFilter
              ? 'Tidak ada yang di tahap ini.'
              : 'Belum ada ide konten. Tulis satu yang barusan kepikiran 💡'}
          </VixText>
        )}

        {pageItems.map((i) => {
          const stage = stageMeta(i.stage);
          const tayang = i.stage === 'posted';
          return (
            // Kartu = area ubah; tombol tahap & tombol link jadi SAUDARA-nya,
            // bukan anaknya (Pressable bersarang tidak andal di iOS).
            <View key={i.id} style={[styles.card, tayang && styles.cardDone]}>
              <View style={styles.cardTop}>
                <PressableScale
                  style={styles.cardMain}
                  onPress={() => openEdit(i)}>
                  <VixText heading="bold" additionalStyle={styles.cardTitle}>
                    {i.title}
                  </VixText>
                  {i.platforms.length > 0 ? (
                    <VixText heading="label">
                      {i.platforms
                        .map((p) => `${platformMeta(p).icon} ${platformMeta(p).label}`)
                        .join(' · ')}
                    </VixText>
                  ) : (
                    <VixText heading="label" additionalStyle={styles.noPlatform}>
                      Belum dipilih mau tayang di mana
                    </VixText>
                  )}
                  {i.product ? (
                    <VixText heading="label" additionalStyle={styles.product}>
                      🛍️ {i.product}
                    </VixText>
                  ) : null}
                  {i.note ? (
                    <VixText heading="label" numberOfLines={3}>
                      {i.note}
                    </VixText>
                  ) : null}
                </PressableScale>

                {/* Tekan = maju satu tahap (💡 → 🎬 → ✅ → 💡 lagi) */}
                <PressableScale
                  style={[styles.stageChip, tayang && styles.stageChipDone]}
                  onPress={() => nextStage(i)}
                  haptic="success">
                  <VixText heading="label" additionalStyle={styles.stageText}>
                    {stage.icon} {stage.label}
                  </VixText>
                </PressableScale>
              </View>

              {i.link ? (
                <PressableScale
                  style={styles.linkChip}
                  onPress={() => openExternalUrl(i.link)}
                  hitSlop={6}>
                  <VixText heading="label" additionalStyle={styles.linkText}>
                    🔗 Buka link affiliate
                  </VixText>
                </PressableScale>
              ) : null}
            </View>
          );
        })}

        {/* Balik ke atas lewat REF (bukan `key={currentPage}`): ScrollView ini
            memegang ref bersama useScrollTop yang juga dipakai chip saringan —
            me-remount-nya akan memutus ref itu. */}
        <Pagination
          page={currentPage}
          pageCount={pageCount}
          onChange={(p) => {
            setPage(p);
            toTop();
          }}
        />
      </ScrollView>

      <SheetModal
        visible={!!editing}
        title={editing === 'new' ? 'Tambah Ide Konten' : 'Ubah Ide Konten'}
        subtitle="Ide, produk affiliate, & catatannya jadi satu"
        onClose={() => setEditing(null)}>
        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          💡 Judul ide
        </VixText>
        <FormInput
          style={styles.formGap}
          placeholder="Isi Judul Ide"
          value={fTitle}
          onChangeText={setFTitle}
          editable={!busy}
        />

        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          📱 Mau tayang di mana? (boleh lebih dari satu)
        </VixText>
        <View style={styles.chipWrap}>
          {AFFILIATE_PLATFORMS.map((p) => (
            <Chip
              key={p.key}
              label={`${p.icon} ${p.label}`}
              active={fPlatforms.includes(p.key)}
              onPress={() => togglePlatform(p.key)}
            />
          ))}
        </View>

        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          🚦 Tahap
        </VixText>
        <View style={styles.chipWrap}>
          {IDEA_STAGES.map((s) => (
            <Chip
              key={s.key}
              label={`${s.icon} ${s.label}`}
              active={fStage === s.key}
              onPress={() => setFStage(s.key)}
            />
          ))}
        </View>

        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          🛍️ Produk affiliate (kosongkan kalau bukan jualan)
        </VixText>
        <FormInput
          style={styles.formGap}
          placeholder="Nama produknya"
          value={fProduct}
          onChangeText={setFProduct}
          editable={!busy}
        />

        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          🔗 Link affiliate
        </VixText>
        <FormInput
          style={styles.formGap}
          placeholder="https://…"
          autoCapitalize="none"
          keyboardType="url"
          value={fLink}
          onChangeText={setFLink}
          editable={!busy}
        />

        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          📝 Catatan — hook, angle, caption
        </VixText>
        <FormInput
          style={[styles.textArea, styles.formGap]}
          placeholder="3 detik pertama ngomong apa? Endingnya gimana?"
          value={fNote}
          onChangeText={setFNote}
          editable={!busy}
          multiline
        />

        <FormError message={formError} />
        <EditFooter
          editing={editing}
          deleteLabel="Hapus ide ini"
          busy={busy}
          onDelete={handleDelete}
          onCancel={() => setEditing(null)}
          onConfirm={handleSave}
        />
      </SheetModal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 },
  addButton: { marginBottom: 12 },
  empty: { textAlign: 'center', marginVertical: 10 },
  card: {
    ...CARD,
    marginBottom: 10,
    gap: 8,
  },
  // Sudah tayang → kartunya diredupkan hijau, sama seperti baris selesai di
  // fitur lain. Ia tetap ada sebagai arsip, cuma tidak lagi menuntut.
  cardDone: {
    backgroundColor: Color.MAIN_TRANSPARENT,
    borderColor: Color.MAIN_LIGHT,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cardMain: { flex: 1, gap: 2 },
  cardTitle: { color: Color.TEXT_TITLE },
  noPlatform: { color: Color.TEXT_PLACEHOLDER },
  product: { color: Color.CAREER_DARK },
  stageChip: {
    backgroundColor: Color.CONTRAST_CONTAINER,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  stageChipDone: { backgroundColor: Color.MAIN_LIGHT },
  stageText: { color: Color.TEXT_TITLE },
  linkChip: {
    alignSelf: 'flex-start',
    backgroundColor: Color.CONTRAST_CONTAINER,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  linkText: { color: Color.ACCENT_DARK },
  fieldLabel: { marginBottom: 6 },
  formGap: { marginBottom: 10 },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  textArea: { minHeight: 88, paddingTop: 12, textAlignVertical: 'top' },
});
