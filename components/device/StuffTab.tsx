import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { DateField } from '@/components/common/DateField';
import { DualButtons } from '@/components/common/DualButtons';
import { EditButton } from '@/components/common/EditButton';
import { FilterChips } from '@/components/common/FilterChips';
import { FormError } from '@/components/common/FormError';
import { FormInput } from '@/components/common/FormInput';
import { InlineDelete } from '@/components/common/InlineDelete';
import { MoneyInput } from '@/components/common/MoneyInput';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { SelectField, textOptions } from '@/components/common/SelectField';
import { SheetModal } from '@/components/common/SheetModal';
import { SummaryCard, summaryText } from '@/components/common/SummaryCard';
import { VixText } from '@/components/common/VixText';
import { useAuth } from '@/contexts/auth';
import {
  dayId,
  dayIdToDate,
  formatDate,
  groupDigits,
  parseAmount,
} from '@/lib/format';
import { DELETE_ERROR, SAVE_ERROR } from '@/lib/messages';
import {
  conditionMeta,
  EMPTY_STUFF,
  newStuffId,
  saveStuff,
  sortStuff,
  STUFF_CATEGORIES,
  STUFF_CONDITIONS,
  STUFF_LOCATIONS,
  stuffOwned,
  stuffTotalValue,
  stuffUseLabel,
  stuffWarrantyDays,
  type StuffCondition,
  type StuffItem,
} from '@/lib/stuff';
import { STUFF_SEED_COUNT, stuffSeed } from '@/lib/stuffSeed';
import { formatRupiah } from '@/lib/transactions';

// Stuff 📦 — daftar barang milik sendiri (lihat lib/stuff.ts).
//
// Tampilnya sengaja RINGKAS: satu kartu = satu barang, dengan tiga hal yang
// paling sering dicari — sudah dipakai berapa lama, di mana taruhnya, dan
// harganya berapa. Sisa kolom spreadsheet (merek, toko, catatan, garansi) baru
// muncul di modal ubahnya, supaya daftar 68 barang tetap bisa disapu mata.
export function StuffTab({ items }: { items: StuffItem[] }) {
  const { user } = useAuth();
  const now = new Date();

  const [filter, setFilter] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<StuffItem | null>(null);
  const [form, setForm] = useState<Omit<StuffItem, 'id'>>(EMPTY_STUFF);
  const [priceText, setPriceText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seedBusy, setSeedBusy] = useState(false);

  const dimiliki = stuffOwned(items);
  const total = stuffTotalValue(items);

  // Kategori yang BENAR-BENAR dipakai saja yang jadi chip — daftar 14 kategori
  // penuh membuat separuhnya selalu kosong dan barisnya jadi panjang percuma.
  const kategoriDipakai = useMemo(() => {
    const ada = new Set(items.map((i) => i.category).filter(Boolean));
    return STUFF_CATEGORIES.filter((c) => ada.has(c)).map((c) => ({
      key: c,
      label: c,
    }));
  }, [items]);

  const tampil = useMemo(
    () => sortStuff(filter ? items.filter((i) => i.category === filter) : items),
    [items, filter],
  );

  function openNew() {
    setEditing(null);
    setForm(EMPTY_STUFF);
    setPriceText('');
    setError(null);
  }

  function openEdit(item: StuffItem) {
    const { id: _id, ...rest } = item;
    setEditing(item);
    setForm(rest);
    setPriceText(item.price ? groupDigits(String(item.price)) : '');
    setError(null);
  }

  function closeModal() {
    setOpen(false);
    setEditing(null);
  }

  async function handleSave() {
    if (!user || busy) return;
    if (!form.name.trim()) {
      setError('Nama barangnya diisi dulu ya.');
      return;
    }
    setBusy(true);
    setError(null);
    const isi: StuffItem = {
      ...form,
      id: editing?.id ?? newStuffId(now),
      name: form.name.trim(),
      price: parseAmount(priceText),
    };
    const berikutnya = editing
      ? items.map((i) => (i.id === editing.id ? isi : i))
      : [isi, ...items];
    try {
      await saveStuff(user.uid, berikutnya);
      closeModal();
    } catch {
      setError(SAVE_ERROR);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!user || !editing || busy) return;
    setBusy(true);
    try {
      // Hapus PERMANEN — daftar ditulis ulang tanpa barang ini.
      await saveStuff(
        user.uid,
        items.filter((i) => i.id !== editing.id),
      );
      closeModal();
    } catch {
      setError(DELETE_ERROR);
    } finally {
      setBusy(false);
    }
  }

  async function handleSeed() {
    if (!user || seedBusy) return;
    setSeedBusy(true);
    try {
      await saveStuff(user.uid, stuffSeed(now));
    } catch {
      setError(SAVE_ERROR);
    } finally {
      setSeedBusy(false);
    }
  }

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={styles.content}>
        <SummaryCard>
          <VixText heading="label" additionalStyle={summaryText.label}>
            📦 Barang dimiliki
          </VixText>
          <VixText heading="subheader" additionalStyle={summaryText.value}>
            {dimiliki.length} barang
          </VixText>
          <VixText heading="label" additionalStyle={summaryText.label}>
            Nilai beli: {formatRupiah(total)}
            {items.length > dimiliki.length
              ? ` · ${items.length - dimiliki.length} sudah dibuang`
              : ''}
          </VixText>
        </SummaryCard>

        <PrimaryButton
          label="+ Catat Barang"
          onPress={() => {
            openNew();
            setOpen(true);
          }}
          additionalStyle={styles.addButton}
        />

        {items.length === 0 ? (
          <View style={styles.emptyBox}>
            <VixText heading="label" additionalStyle={styles.empty}>
              Belum ada barang tercatat. Bisa mulai dari nol, atau tarik dulu
              daftar dari spreadsheet “My Stuff” lalu rapikan dari sini 📦
            </VixText>
            {/* Sekali pakai: tombolnya hilang begitu daftarnya terisi, jadi
                tidak mungkin ditekan dua kali & menimpa catatan yang sudah ada. */}
            <PrimaryButton
              label={`📥 Impor ${STUFF_SEED_COUNT} barang dari spreadsheet`}
              busy={seedBusy}
              onPress={handleSeed}
            />
          </View>
        ) : (
          <>
            {kategoriDipakai.length > 1 && (
              <FilterChips
                options={kategoriDipakai}
                value={filter}
                onChange={setFilter}
                allLabel="Semua"
              />
            )}

            {tampil.map((item) => {
              const kondisi = conditionMeta(item.condition);
              const lama = stuffUseLabel(item, now);
              const garansi = stuffWarrantyDays(item, now);
              return (
                // Tombol ✏️ jadi SAUDARA barisnya, bukan anaknya — Pressable
                // bersarang di iOS bikin tombolnya ikut memicu pembungkusnya.
                <View
                  key={item.id}
                  style={[styles.card, !!item.goneDay && styles.cardGone]}>
                  <View style={styles.cardMain}>
                    <View style={styles.titleRow}>
                      <VixText
                        heading="bold"
                        additionalStyle={styles.cardTitle}>
                        {kondisi.emoji} {item.name}
                      </VixText>
                      <VixText heading="bold" additionalStyle={styles.price}>
                        {formatRupiah(item.price)}
                      </VixText>
                    </View>
                    <VixText heading="label">
                      {item.category}
                      {item.brand ? ` · ${item.brand}` : ''} · 📍{item.location}
                    </VixText>
                    {item.note ? (
                      <VixText heading="label" additionalStyle={styles.note}>
                        {item.note}
                      </VixText>
                    ) : null}
                    <VixText heading="label" additionalStyle={styles.meta}>
                      {item.goneDay
                        ? `⚫ dilepas ${formatDate(dayIdToDate(item.goneDay))}${lama ? ` · terpakai ${lama}` : ''}`
                        : lama
                          ? `⏳ dipakai ${lama}`
                          : 'tanggal belinya belum dicatat'}
                      {garansi !== null && !item.goneDay
                        ? garansi >= 0
                          ? ` · 🛡️ garansi ${garansi} hari lagi`
                          : ' · 🛡️ garansi habis'
                        : ''}
                    </VixText>
                  </View>
                  <EditButton
                    onPress={() => {
                      openEdit(item);
                      setOpen(true);
                    }}
                  />
                </View>
              );
            })}

            {tampil.length === 0 && (
              <VixText heading="label" additionalStyle={styles.empty}>
                Tidak ada barang di kategori itu.
              </VixText>
            )}
          </>
        )}
      </ScrollView>

      <SheetModal
        visible={open}
        title={editing ? 'Ubah Barang' : 'Catat Barang'}
        subtitle="Sama isinya dengan spreadsheet My Stuff"
        onClose={closeModal}>
        <VixText heading="label" additionalStyle={styles.label}>
          Nama barang
        </VixText>
        <FormInput
          placeholder="mis. Wireless Router"
          value={form.name}
          onChangeText={(t) => setForm((p) => ({ ...p, name: t }))}
          editable={!busy}
          style={styles.field}
        />

        <VixText heading="label" additionalStyle={styles.label}>
          Kategori
        </VixText>
        <View style={styles.field}>
          <SelectField
            value={form.category || null}
            options={textOptions(STUFF_CATEGORIES, form.category)}
            onChange={(v) => setForm((p) => ({ ...p, category: v ?? '' }))}
            disabled={busy}
          />
        </View>

        <VixText heading="label" additionalStyle={styles.label}>
          Merek
        </VixText>
        <FormInput
          placeholder="kosongkan kalau tanpa merek"
          value={form.brand}
          onChangeText={(t) => setForm((p) => ({ ...p, brand: t }))}
          editable={!busy}
          style={styles.field}
        />

        <VixText heading="label" additionalStyle={styles.label}>
          Tempat
        </VixText>
        <View style={styles.field}>
          <SelectField
            value={form.location || null}
            options={textOptions(STUFF_LOCATIONS, form.location)}
            onChange={(v) => setForm((p) => ({ ...p, location: v ?? '' }))}
            disabled={busy}
          />
        </View>

        <VixText heading="label" additionalStyle={styles.label}>
          Tanggal beli
        </VixText>
        <View style={styles.field}>
          <DateField
            value={form.buyDay ? dayIdToDate(form.buyDay) : null}
            placeholder="Pilih tanggal beli"
            maximumDate={now}
            onChange={(d) => setForm((p) => ({ ...p, buyDay: dayId(d) }))}
          />
        </View>

        <VixText heading="label" additionalStyle={styles.label}>
          Harga beli
        </VixText>
        <MoneyInput
          placeholder="0"
          value={priceText}
          onChangeText={(t) => setPriceText(groupDigits(t))}
          editable={!busy}
          style={styles.field}
        />

        <VixText heading="label" additionalStyle={styles.label}>
          Beli di
        </VixText>
        <FormInput
          placeholder="Shopee / Tokopedia / nama toko"
          value={form.store}
          onChangeText={(t) => setForm((p) => ({ ...p, store: t }))}
          editable={!busy}
          style={styles.field}
        />

        <VixText heading="label" additionalStyle={styles.label}>
          Catatan (warna, ukuran, tipe)
        </VixText>
        <FormInput
          placeholder="mis. Green Mint, 128GB"
          value={form.note}
          onChangeText={(t) => setForm((p) => ({ ...p, note: t }))}
          editable={!busy}
          style={styles.field}
        />

        <VixText heading="label" additionalStyle={styles.label}>
          Kondisi
        </VixText>
        <View style={styles.field}>
          <SelectField
            value={form.condition}
            options={STUFF_CONDITIONS.map((c) => ({
              key: c.key,
              label: `${c.emoji} ${c.label}`,
            }))}
            onChange={(v) =>
              setForm((p) => ({ ...p, condition: (v ?? 'good') as StuffCondition }))
            }
            disabled={busy}
          />
        </View>

        <VixText heading="label" additionalStyle={styles.label}>
          Garansi sampai
        </VixText>
        <View style={styles.field}>
          <DateField
            value={form.warrantyDay ? dayIdToDate(form.warrantyDay) : null}
            placeholder="Kosongkan kalau tidak ada garansi"
            onChange={(d) => setForm((p) => ({ ...p, warrantyDay: dayId(d) }))}
          />
        </View>

        <VixText heading="label" additionalStyle={styles.label}>
          Tanggal dilepas / dibuang
        </VixText>
        <View style={styles.field}>
          <DateField
            value={form.goneDay ? dayIdToDate(form.goneDay) : null}
            placeholder="Kosongkan kalau masih dimiliki"
            maximumDate={now}
            onChange={(d) => setForm((p) => ({ ...p, goneDay: dayId(d) }))}
          />
        </View>

        <FormError message={error} gap="none" additionalStyle={styles.field} />

        {editing && (
          <View style={styles.deleteRow}>
            <InlineDelete
              label="🗑️ Hapus barang ini"
              busy={busy}
              onDelete={handleDelete}
            />
          </View>
        )}

        <DualButtons
          confirmLabel="Simpan"
          busy={busy}
          onCancel={closeModal}
          onConfirm={handleSave}
        />
      </SheetModal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 28 },
  addButton: { marginBottom: 12 },
  emptyBox: { gap: 12, marginTop: 8 },
  empty: { textAlign: 'center', marginVertical: 10 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Color.CONTAINER,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Color.BORDER,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
  },
  // Barang yang sudah dilepas tetap ada di daftar tapi diredupkan — riwayatnya
  // berguna, tapi ia tidak boleh bersaing perhatian dengan yang masih dipakai.
  cardGone: { opacity: 0.55 },
  cardMain: { flex: 1, gap: 2 },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: 6,
  },
  cardTitle: { color: Color.TEXT_TITLE, flexShrink: 1 },
  price: { color: Color.DEVICE_DARK },
  note: { color: Color.TEXT_LABEL },
  meta: { color: Color.TEXT_PLACEHOLDER },
  label: { marginBottom: 6 },
  field: { marginBottom: 10 },
  deleteRow: { alignItems: 'center', marginBottom: 10 },
});
