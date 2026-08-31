import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { Chip } from '@/components/common/Chip';
import { EditFooter } from '@/components/common/EditFooter';
import { FilterChips } from '@/components/common/FilterChips';
import { FormError } from '@/components/common/FormError';
import { FormInput } from '@/components/common/FormInput';
import { MoneyInput } from '@/components/common/MoneyInput';
import { PressableScale } from '@/components/common/PressableScale';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { SheetModal } from '@/components/common/SheetModal';
import { SummaryCard } from '@/components/common/SummaryCard';
import { VixText } from '@/components/common/VixText';
import { useAuth } from '@/contexts/auth';
import { useFormSave } from '@/hooks/useFormSave';
import { useScrollTop } from '@/hooks/useScrollTop';
import { groupDigits, parseAmount } from '@/lib/format';
import { SAVE_ERROR } from '@/lib/messages';
import {
  newPlaceId,
  placeKindMeta,
  PLACE_KINDS,
  savePlaces,
  sortedPlaces,
  type Place,
} from '@/lib/social';
import { formatRupiah } from '@/lib/transactions';

type Filter = 'wish' | 'been';

// Sub-tab Places 🍜 — daftar tempat nongkrong.
//
// Dua keadaan saja: MAU COBA & SUDAH PERNAH. Itu yang benar-benar menentukan
// jawaban "besok ngumpul di mana?" — sisanya (harga, daerah, bintang) cuma
// membantu memilih di antara keduanya.
export function PlacesTab({ places }: { places: Place[] }) {
  const { user } = useAuth();
  const { ref: scrollRef, toTop } = useScrollTop();

  const [filter, setFilter] = useState<Filter | null>(null);

  const [editing, setEditing] = useState<Place | 'new' | null>(null);
  const [fName, setFName] = useState('');
  const [fKind, setFKind] = useState(PLACE_KINDS[0].key);
  const [fArea, setFArea] = useState('');
  const [fPrice, setFPrice] = useState('');
  const [fVisited, setFVisited] = useState(false);
  const [fRating, setFRating] = useState(0);
  const [fNote, setFNote] = useState('');
  const { busy, setBusy, formError, setFormError, save } = useFormSave();

  const belum = places.filter((p) => !p.visited).length;
  const sudah = places.length - belum;
  const shown = sortedPlaces(
    filter === null
      ? places
      : places.filter((p) => (filter === 'been' ? p.visited : !p.visited)),
  );

  function openAdd() {
    setEditing('new');
    setFName('');
    setFKind(PLACE_KINDS[0].key);
    setFArea('');
    setFPrice('');
    setFVisited(false);
    setFRating(0);
    setFNote('');
    setFormError(null);
  }

  function openEdit(p: Place) {
    setEditing(p);
    setFName(p.name);
    setFKind(p.kind);
    setFArea(p.area);
    setFPrice(p.pricePerPerson > 0 ? groupDigits(String(p.pricePerPerson)) : '');
    setFVisited(p.visited);
    setFRating(p.rating);
    setFNote(p.note);
    setFormError(null);
  }

  async function handleSave() {
    if (!user || !editing || busy) return;
    if (!fName.trim()) {
      setFormError('Nama tempatnya diisi dulu ya.');
      return;
    }
    const data: Place = {
      id: editing === 'new' ? newPlaceId() : editing.id,
      name: fName.trim(),
      kind: fKind,
      area: fArea.trim(),
      pricePerPerson: parseAmount(fPrice),
      visited: fVisited,
      // Bintang cuma berlaku untuk yang sudah pernah didatangi.
      rating: fVisited ? fRating : 0,
      note: fNote.trim(),
    };
    await save(async () => {
      await savePlaces(
        user.uid,
        editing === 'new'
          ? [...places, data]
          : places.map((p) => (p.id === editing.id ? data : p)),
      );
      setEditing(null);
    });
  }

  /** Hapus permanen — daftarnya ditulis ulang tanpa tempat ini. */
  async function handleDelete() {
    if (!user || !editing || editing === 'new' || busy) return;
    setBusy(true);
    try {
      await savePlaces(user.uid, places.filter((p) => p.id !== editing.id));
      setEditing(null);
    } catch {
      setFormError(SAVE_ERROR);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.flex}>
      <ScrollView ref={scrollRef} contentContainerStyle={styles.content}>
        <SummaryCard
          label="Tempat nongkrong"
          value={`${belum} mau coba · ${sudah} sudah pernah`}
          sub="Simpan sekarang, biar tidak bingung waktu ditanya mau ke mana."
        />

        <PrimaryButton
          label="Tambah Tempat"
          icon="plus"
          onPress={openAdd}
          additionalStyle={styles.addButton}
        />

        <FilterChips
          options={[
            { key: 'wish' as Filter, label: '🔖 Mau coba', count: belum },
            { key: 'been' as Filter, label: '✅ Sudah pernah', count: sudah },
          ]}
          value={filter}
          onChange={setFilter}
          onRepress={toTop}
        />

        {shown.length === 0 && (
          <VixText heading="label" additionalStyle={styles.empty}>
            {places.length === 0
              ? 'Belum ada tempat.'
              : 'Tidak ada yang cocok dengan saringan ini.'}
          </VixText>
        )}

        {shown.map((p) => {
          const meta = placeKindMeta(p.kind);
          return (
            <PressableScale
              key={p.id}
              style={[styles.card, p.visited && styles.cardVisited]}
              onPress={() => openEdit(p)}>
              <VixText additionalStyle={styles.cardIcon}>{meta.icon}</VixText>
              <View style={styles.cardMain}>
                <VixText heading="bold" additionalStyle={styles.cardTitle}>
                  {p.name}
                </VixText>
                <VixText heading="label">
                  {meta.label}
                  {p.area ? ` · 📍 ${p.area}` : ''}
                  {p.pricePerPerson > 0
                    ? ` · ${formatRupiah(p.pricePerPerson)}/orang`
                    : ''}
                </VixText>
                {p.note ? (
                  <VixText heading="label" numberOfLines={2}>
                    {p.note}
                  </VixText>
                ) : null}
              </View>
              <VixText heading="label" additionalStyle={styles.cardRight}>
                {p.visited
                  ? p.rating > 0
                    ? '⭐'.repeat(p.rating)
                    : '✅'
                  : '🔖'}
              </VixText>
            </PressableScale>
          );
        })}
      </ScrollView>

      <SheetModal
        visible={!!editing}
        title={editing === 'new' ? 'Tambah Tempat' : 'Ubah Tempat'}
        onClose={() => setEditing(null)}>
        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          🏷️ Nama tempat
        </VixText>
        <FormInput
          style={styles.formGap}
          placeholder="mis. Kopi Janji Jiwa Pakuwon"
          value={fName}
          onChangeText={setFName}
          editable={!busy}
        />

        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          Jenis
        </VixText>
        <View style={styles.chipWrap}>
          {PLACE_KINDS.map((k) => (
            <Chip
              key={k.key}
              label={`${k.icon} ${k.label}`}
              active={fKind === k.key}
              onPress={() => setFKind(k.key)}
            />
          ))}
        </View>

        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          📍 Daerah
        </VixText>
        <FormInput
          style={styles.formGap}
          placeholder="mis. Pakuwon / Galaxy / Darmo"
          value={fArea}
          onChangeText={setFArea}
          editable={!busy}
        />

        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          💰 Perkiraan habis per orang
        </VixText>
        <MoneyInput
          style={styles.formGap}
          placeholder="Nominal"
          value={fPrice}
          onChangeText={(t) => setFPrice(groupDigits(t))}
          editable={!busy}
        />

        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          Sudah pernah ke sini?
        </VixText>
        <View style={styles.chipWrap}>
          <Chip
            label="🔖 Mau coba"
            active={!fVisited}
            onPress={() => setFVisited(false)}
          />
          <Chip
            label="✅ Sudah pernah"
            active={fVisited}
            onPress={() => setFVisited(true)}
          />
        </View>

        {/* Bintang hanya untuk yang sudah pernah — menilai tempat yang belum
            didatangi itu tidak ada artinya. */}
        {fVisited && (
          <>
            <VixText heading="label" additionalStyle={styles.fieldLabel}>
              ⭐ Seberapa suka?
            </VixText>
            <View style={styles.chipWrap}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Chip
                  key={n}
                  label={'⭐'.repeat(n)}
                  active={fRating === n}
                  // Tekan bintang yang sama = batalkan penilaiannya.
                  onPress={() => setFRating(fRating === n ? 0 : n)}
                />
              ))}
            </View>
          </>
        )}

        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          📝 Catatan
        </VixText>
        <FormInput
          style={[styles.textArea, styles.formGap]}
          placeholder="Menu andalannya apa? Ramai jam berapa? Cocok buat ramean?"
          value={fNote}
          onChangeText={setFNote}
          editable={!busy}
          multiline
        />

        <FormError message={formError} />
        <EditFooter
          editing={editing}
          deleteLabel="Hapus tempat ini"
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Color.CONTAINER,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Color.BORDER,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
  },
  // Sudah pernah didatangi → diredupkan, karena yang perlu diputuskan itu
  // justru yang belum.
  cardVisited: {
    backgroundColor: Color.MAIN_TRANSPARENT,
    borderColor: Color.MAIN_LIGHT,
  },
  cardIcon: { fontSize: 26, lineHeight: 32 },
  cardMain: { flex: 1, gap: 2 },
  cardTitle: { color: Color.TEXT_TITLE },
  cardRight: { color: Color.ACCENT_DARK },
  fieldLabel: { marginBottom: 6 },
  formGap: { marginBottom: 10 },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  textArea: { minHeight: 80, paddingTop: 12, textAlignVertical: 'top' },
});
