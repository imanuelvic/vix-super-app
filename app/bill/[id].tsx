import { useLocalSearchParams, useRouter } from 'expo-router';
import { Timestamp } from 'firebase/firestore';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CARD } from '@/assets/style/card';
import { Color } from '@/assets/style/color';
import { CheckCircle } from '@/components/common/CheckCircle';
import { Chip } from '@/components/common/Chip';
import { DateField } from '@/components/common/DateField';
import { DualButtons } from '@/components/common/DualButtons';
import { FormInput } from '@/components/common/FormInput';
import { InlineDelete } from '@/components/common/InlineDelete';
import { LoadingCenter } from '@/components/common/LoadingCenter';
import { MoneyInput } from '@/components/common/MoneyInput';
import { PressableScale } from '@/components/common/PressableScale';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { ScreenError } from '@/components/common/ScreenError';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { SheetModal } from '@/components/common/SheetModal';
import { VixText } from '@/components/common/VixText';
import { useAuth } from '@/contexts/auth';
import { formatCompactDate, groupDigits, parseAmount } from '@/lib/format';
import { unsubscribeAll } from '@/lib/liveDoc';
import { DELETE_ERROR, LOAD_ERROR, PHOTO_ERROR, SAVE_ERROR } from '@/lib/messages';
import { photoUri, pickPhotoToRead } from '@/lib/photo';
import { canScanReceipt, scanReceipt } from '@/lib/receiptOcr';
import {
  billShares,
  billSubtotal,
  billTotal,
  deleteBill,
  newItemId,
  newPersonId,
  saveBill,
  saveBillPhoto,
  subscribeBill,
  subscribeBillPhoto,
  unsharedItems,
  type Bill,
  type BillItem,
} from '@/lib/social';
import { formatRupiah } from '@/lib/transactions';

// Rincian satu patungan 💸 — di sinilah pekerjaan Split Bill yang sebenarnya.
//
// Alurnya: foto nota → item terisi (bisa dibetulkan) → tulis siapa saja yang
// ikut → centang siapa makan apa → tiap orang muncul jumlah setorannya.
//
// Aturan pembagiannya ada di lib/social.ts: tiap orang bayar APA YANG DIA
// MAKAN, lalu pajak & service dibagi PROPORSIONAL — bukan dibagi rata. Yang
// cuma pesan es teh tidak ikut menanggung pajak steak orang lain.
export default function BillScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [bill, setBill] = useState<Bill | null | undefined>(undefined);
  // Foto nota dibaca dari dokumennya sendiri — hanya di layar ini, bukan ikut
  // terbawa tiap kali daftar tagihan atau Home dibuka.
  const [photo, setPhoto] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);

  // Sheet keterangan bill (judul, tempat, tanggal, pajak, service, diskon).
  const [infoOpen, setInfoOpen] = useState(false);
  const [fTitle, setFTitle] = useState('');
  const [fPlace, setFPlace] = useState('');
  const [fDate, setFDate] = useState(new Date());
  const [fTax, setFTax] = useState('');
  const [fService, setFService] = useState('');
  const [fDiscount, setFDiscount] = useState('');
  const [fNote, setFNote] = useState('');

  // Sheet satu item (nama, jumlah, harga, siapa yang makan).
  const [itemEdit, setItemEdit] = useState<BillItem | 'new' | null>(null);
  const [iName, setIName] = useState('');
  const [iQty, setIQty] = useState('1');
  const [iPrice, setIPrice] = useState('');
  const [iShared, setIShared] = useState<string[]>([]);

  // Sheet tambah orang.
  const [personOpen, setPersonOpen] = useState(false);
  const [pName, setPName] = useState('');

  useEffect(() => {
    if (!user || !id) return;
    return unsubscribeAll([
      subscribeBill(user.uid, id, setBill, () => setError(LOAD_ERROR)),
      subscribeBillPhoto(user.uid, id, setPhoto),
    ]);
  }, [user, id]);

  /** Simpan seluruh tagihan. Semua perubahan di layar ini lewat sini. */
  const simpan = useCallback(
    async (next: Bill) => {
      if (!user) return;
      setError(null);
      try {
        await saveBill(user.uid, next);
      } catch {
        setError(SAVE_ERROR);
      }
    },
    [user],
  );

  if (bill === undefined) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader backLabel="Social" title="Split Bill 💸" />
        <LoadingCenter />
      </SafeAreaView>
    );
  }

  if (bill === null) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader backLabel="Social" title="Split Bill 💸" />
        <VixText heading="label" additionalStyle={styles.empty}>
          Tagihan ini sudah tidak ada.
        </VixText>
      </SafeAreaView>
    );
  }

  const b = bill;
  const shares = billShares(b);
  const belumDibagi = unsharedItems(b);
  const subtotal = billSubtotal(b);

  // ===== Keterangan bill =====

  function openInfo() {
    setFTitle(b.title);
    setFPlace(b.place);
    setFDate(b.date.toDate());
    setFTax(b.taxPercent ? String(b.taxPercent) : '');
    setFService(b.servicePercent ? String(b.servicePercent) : '');
    setFDiscount(b.discount ? groupDigits(String(b.discount)) : '');
    setFNote(b.note);
    setInfoOpen(true);
  }

  async function saveInfo() {
    if (busy) return;
    setBusy(true);
    await simpan({
      ...b,
      title: fTitle.trim(),
      place: fPlace.trim(),
      date: Timestamp.fromDate(fDate),
      // Persen dibatasi 0–100 supaya salah ketik tidak melipatgandakan tagihan.
      taxPercent: Math.min(100, Math.max(0, parseAmount(fTax))),
      servicePercent: Math.min(100, Math.max(0, parseAmount(fService))),
      discount: Math.max(0, parseAmount(fDiscount)),
      note: fNote.trim(),
    });
    setBusy(false);
    setInfoOpen(false);
  }

  // ===== Foto nota & pemindaiannya =====

  async function ambilNota(fromCamera: boolean) {
    if (scanning || busy) return;
    setScanning(true);
    setError(null);
    try {
      const foto = await pickPhotoToRead({ fromCamera });
      if (!foto) return;
      const hasil = await scanReceipt(foto.scanUri);
      // Fotonya disimpan di dokumen TERPISAH (lihat lib/social) supaya daftar
      // tagihan & badge Home tidak ikut mengunduhnya tiap kali.
      if (foto.base64) await saveBillPhoto(user!.uid, b.id, foto.base64);
      const next: Bill = { ...b, hasPhoto: !!foto.base64 };
      if (hasil.ok && hasil.items.length > 0) {
        // Item hasil pindai DITAMBAHKAN, tidak menimpa — supaya yang sudah
        // telanjur diketik tidak hilang begitu saja.
        next.items = [
          ...b.items,
          ...hasil.items.map((it) => ({
            id: newItemId(),
            name: it.name,
            qty: it.qty,
            price: it.price,
            sharedBy: [],
          })),
        ];
      } else if (!hasil.ok) {
        setError(
          hasil.reason === 'no-module'
            ? 'Pemindai nota belum ada di versi app ini. Fotonya tetap tersimpan — itemnya ketik manual dulu ya.'
            : 'Notanya tidak terbaca. Fotonya tetap tersimpan — coba foto ulang lebih terang, atau ketik manual.',
        );
      } else {
        setError(
          'Tidak ada baris yang terbaca sebagai item. Coba foto ulang lebih dekat & terang, atau ketik manual.',
        );
      }
      await simpan(next);
    } catch {
      setError(PHOTO_ERROR);
    } finally {
      setScanning(false);
    }
  }

  // ===== Orang =====

  async function addPerson() {
    if (!pName.trim() || busy) return;
    setBusy(true);
    await simpan({
      ...b,
      people: [
        ...b.people,
        { id: newPersonId(), name: pName.trim(), paid: false },
      ],
    });
    setBusy(false);
    setPName('');
    setPersonOpen(false);
  }

  function togglePaid(personId: string) {
    simpan({
      ...b,
      people: b.people.map((p) =>
        p.id === personId ? { ...p, paid: !p.paid } : p,
      ),
    });
  }

  /** Hapus orang — sekalian dicabut dari semua item yang dia ikuti. */
  function removePerson(personId: string) {
    simpan({
      ...b,
      people: b.people.filter((p) => p.id !== personId),
      items: b.items.map((i) => ({
        ...i,
        sharedBy: i.sharedBy.filter((x) => x !== personId),
      })),
    });
  }

  // ===== Item =====

  function openItem(item: BillItem | 'new') {
    setItemEdit(item);
    if (item === 'new') {
      setIName('');
      setIQty('1');
      setIPrice('');
      // Item baru default dibagi ke SEMUA — itu yang paling sering benar.
      setIShared(b.people.map((p) => p.id));
    } else {
      setIName(item.name);
      setIQty(String(item.qty));
      setIPrice(item.price > 0 ? groupDigits(String(item.price)) : '');
      setIShared(item.sharedBy);
    }
  }

  async function saveItem() {
    if (!itemEdit || busy) return;
    if (!iName.trim()) return;
    setBusy(true);
    const data: BillItem = {
      id: itemEdit === 'new' ? newItemId() : itemEdit.id,
      name: iName.trim(),
      qty: Math.max(1, parseAmount(iQty) || 1),
      price: parseAmount(iPrice),
      sharedBy: iShared,
    };
    await simpan({
      ...b,
      items:
        itemEdit === 'new'
          ? [...b.items, data]
          : b.items.map((i) => (i.id === itemEdit.id ? data : i)),
    });
    setBusy(false);
    setItemEdit(null);
  }

  async function deleteItem() {
    if (!itemEdit || itemEdit === 'new' || busy) return;
    setBusy(true);
    await simpan({ ...b, items: b.items.filter((i) => i.id !== itemEdit.id) });
    setBusy(false);
    setItemEdit(null);
  }

  async function handleDeleteBill() {
    if (!user || busy) return;
    setBusy(true);
    try {
      await deleteBill(user.uid, b.id);
      router.back();
    } catch {
      setError(DELETE_ERROR);
      setBusy(false);
    }
  }

  const namaOrang = (ids: string[]) =>
    ids
      .map((x) => b.people.find((p) => p.id === x)?.name)
      .filter(Boolean)
      .join(', ');

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        backLabel="Social"
        title="Split Bill 💸"
        subtitle={b.title.trim() || 'Tanpa judul'}
      />

      <ScreenError message={error} />

      <ScrollView contentContainerStyle={styles.content}>
        <PressableScale style={styles.hero} onPress={openInfo}>
          <VixText heading="label" additionalStyle={styles.heroLabel}>
            📆 {formatCompactDate(b.date.toDate())}
            {b.place ? ` · 📍 ${b.place}` : ''}
          </VixText>
          <VixText heading="subheader" additionalStyle={styles.heroValue}>
            {formatRupiah(billTotal(b))}
          </VixText>
          <VixText heading="label" additionalStyle={styles.heroLabel}>
            {formatRupiah(subtotal)} + pajak {b.taxPercent}% + service{' '}
            {b.servicePercent}%
            {b.discount > 0 ? ` − diskon ${formatRupiah(b.discount)}` : ''}
          </VixText>
          <VixText heading="label" additionalStyle={styles.heroHint}>
            Ubah keterangan ✏️
          </VixText>
        </PressableScale>

        {/* ===== Nota ===== */}
        <VixText heading="title" additionalStyle={styles.sectionTitle}>
          🧾 Nota
        </VixText>
        {photo ? (
          <Image
            source={{ uri: photoUri(photo) }}
            style={styles.photo}
            resizeMode="contain"
          />
        ) : null}
        <View style={styles.scanRow}>
          <PressableScale
            style={styles.scanButton}
            disabled={scanning}
            onPress={() => ambilNota(true)}>
            {scanning ? (
              <ActivityIndicator color={Color.TEXT_REVERSE} />
            ) : (
              <VixText heading="bold" additionalStyle={styles.scanText}>
                📸 Foto & Baca Nota
              </VixText>
            )}
          </PressableScale>
          <PressableScale
            style={styles.scanAlt}
            disabled={scanning}
            onPress={() => ambilNota(false)}>
            <VixText heading="bold" additionalStyle={styles.scanAltText}>
              🖼️ Galeri
            </VixText>
          </PressableScale>
        </View>
        <VixText heading="label" additionalStyle={styles.scanHint}>
          {canScanReceipt()
            ? 'Dibaca langsung di HP — fotonya tidak dikirim ke mana pun. Struk kasir sering salah terbaca, jadi periksa & betulkan itemnya ya.'
            : '⚠️ Pemindai nota belum ada di versi app yang terpasang. Fotonya tetap bisa disimpan, itemnya ketik manual dulu.'}
        </VixText>

        {/* ===== Orang ===== */}
        <VixText heading="title" additionalStyle={styles.sectionTitle}>
          👥 Siapa saja
        </VixText>
        <View style={styles.chipWrap}>
          {b.people.map((p) => (
            <Chip
              key={p.id}
              label={p.name}
              active={false}
              onPress={() => removePerson(p.id)}
            />
          ))}
          <Chip
            label="+ Orang"
            active
            onPress={() => {
              setPName('');
              setPersonOpen(true);
            }}
          />
        </View>
        {b.people.length > 0 && (
          <VixText heading="label" additionalStyle={styles.hint}>
            Hapus dari patungan ini.
          </VixText>
        )}

        {/* ===== Item ===== */}
        <VixText heading="title" additionalStyle={styles.sectionTitle}>
          🍽️ Item ({b.items.length})
        </VixText>
        {belumDibagi.length > 0 && (
          <VixText heading="label" additionalStyle={styles.warnLine}>
            ⚠️ {belumDibagi.length} item belum ditandai siapa yang makan —
            harganya belum masuk hitungan siapa pun.
          </VixText>
        )}
        {b.items.map((item) => {
          const kosong = item.sharedBy.length === 0;
          return (
            <PressableScale
              key={item.id}
              style={[styles.itemRow, kosong && styles.itemRowWarn]}
              onPress={() => openItem(item)}>
              <View style={styles.itemMain}>
                <VixText heading="bold" additionalStyle={styles.itemName}>
                  {item.qty > 1 ? `${item.qty}× ` : ''}
                  {item.name}
                </VixText>
                <VixText
                  heading="label"
                  additionalStyle={kosong ? styles.warnLine : undefined}>
                  {kosong ? 'Belum dibagi' : `Dimakan: ${namaOrang(item.sharedBy)}`}
                </VixText>
              </View>
              <VixText heading="bold" additionalStyle={styles.itemPrice}>
                {formatRupiah(item.price)}
              </VixText>
            </PressableScale>
          );
        })}
        <PrimaryButton
          label="Tambah Item"
          icon="plus"
          onPress={() => openItem('new')}
          additionalStyle={styles.addButton}
        />

        {/* ===== Siapa bayar berapa ===== */}
        <VixText heading="title" additionalStyle={styles.sectionTitle}>
          💰 Siapa bayar berapa
        </VixText>
        {shares.length === 0 ? (
          <VixText heading="label" additionalStyle={styles.hint}>
            Tambahkan orangnya dulu di atas.
          </VixText>
        ) : (
          shares.map((s) => (
            <View
              key={s.person.id}
              style={[styles.shareRow, s.person.paid && styles.shareRowPaid]}>
              <PressableScale
                onPress={() => togglePaid(s.person.id)}
                hitSlop={8}
                haptic={s.person.paid ? 'light' : 'success'}>
                <CheckCircle checked={s.person.paid} />
              </PressableScale>
              <View style={styles.shareMain}>
                <VixText
                  heading="bold"
                  additionalStyle={
                    s.person.paid ? styles.sharePaidName : styles.itemName
                  }>
                  {s.person.name}
                </VixText>
                <VixText heading="label">
                  item {formatRupiah(s.items)}
                  {s.extra !== 0
                    ? ` ${s.extra > 0 ? '+' : '−'} ${formatRupiah(Math.abs(s.extra))} pajak/service`
                    : ''}
                </VixText>
              </View>
              <VixText heading="bold" additionalStyle={styles.shareTotal}>
                {formatRupiah(s.total)}
              </VixText>
            </View>
          ))
        )}
        {shares.length > 0 && (
          <VixText heading="label" additionalStyle={styles.hint}>
            Jumlah tiap orang
            dibulatkan ke rupiah, jadi totalnya bisa meleset satu-dua rupiah dari
            nota — itu memang tak terhindarkan saat satu angka dibagi beberapa.
          </VixText>
        )}

        <View style={styles.deleteWrap}>
          <InlineDelete
            label="Hapus patungan ini"
            busy={busy}
            onDelete={handleDeleteBill}
          />
        </View>
      </ScrollView>

      {/* ===== Sheet keterangan bill ===== */}
      <SheetModal
        visible={infoOpen}
        title="Keterangan Bill"
        onClose={() => setInfoOpen(false)}>
        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          🏷️ Acara / Kegiatan
        </VixText>
        <FormInput
          style={styles.formGap}
          placeholder="Nama acaranya"
          value={fTitle}
          onChangeText={setFTitle}
          editable={!busy}
        />

        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          📍 Tempat
        </VixText>
        <FormInput
          style={styles.formGap}
          placeholder="Nama tempatnya"
          value={fPlace}
          onChangeText={setFPlace}
          editable={!busy}
        />

        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          📆 Tanggal
        </VixText>
        <View style={styles.formGap}>
          <DateField key={b.id} value={fDate} onChange={setFDate} />
        </View>

        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          🧾 Pajak (%) — PB1 biasanya 10–11
        </VixText>
        <FormInput
          style={styles.formGap}
          placeholder="0"
          keyboardType="number-pad"
          value={fTax}
          onChangeText={setFTax}
          editable={!busy}
        />

        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          🛎️ Service charge (%) — biasanya 5–10
        </VixText>
        <FormInput
          style={styles.formGap}
          placeholder="0"
          keyboardType="number-pad"
          value={fService}
          onChangeText={setFService}
          editable={!busy}
        />

        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          🎟️ Diskon (Rp)
        </VixText>
        <MoneyInput
          style={styles.formGap}
          placeholder="0"
          value={fDiscount}
          onChangeText={(t) => setFDiscount(groupDigits(t))}
          editable={!busy}
        />

        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          📝 Catatan
        </VixText>
        <FormInput
          style={[styles.textArea, styles.formGap]}
          placeholder="Catatan bebas"
          value={fNote}
          onChangeText={setFNote}
          editable={!busy}
          multiline
        />

        <DualButtons
          confirmLabel="Simpan"
          busy={busy}
          onCancel={() => setInfoOpen(false)}
          onConfirm={saveInfo}
        />
      </SheetModal>

      {/* ===== Sheet item ===== */}
      <SheetModal
        visible={!!itemEdit}
        title={itemEdit === 'new' ? 'Tambah Item' : 'Ubah Item'}
        subtitle="Centang siapa saja yang ikut makan item ini"
        onClose={() => setItemEdit(null)}>
        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          🍽️ Nama item
        </VixText>
        <FormInput
          style={styles.formGap}
          placeholder="mis. Nasi Goreng"
          value={iName}
          onChangeText={setIName}
          editable={!busy}
        />

        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          🔢 Jumlah
        </VixText>
        <FormInput
          style={styles.formGap}
          placeholder="1"
          keyboardType="number-pad"
          value={iQty}
          onChangeText={setIQty}
          editable={!busy}
        />

        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          💰 Harga total baris ini (bukan harga satuan)
        </VixText>
        <MoneyInput
          style={styles.formGap}
          placeholder="Nominal"
          value={iPrice}
          onChangeText={(t) => setIPrice(groupDigits(t))}
          editable={!busy}
        />

        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          👥 Siapa yang makan
        </VixText>
        {b.people.length === 0 ? (
          <VixText heading="label" additionalStyle={styles.hint}>
            Belum ada orangnya — tambahkan dulu di layar sebelumnya.
          </VixText>
        ) : (
          <>
            <View style={styles.chipWrap}>
              {b.people.map((p) => (
                <Chip
                  key={p.id}
                  label={p.name}
                  active={iShared.includes(p.id)}
                  onPress={() =>
                    setIShared((list) =>
                      list.includes(p.id)
                        ? list.filter((x) => x !== p.id)
                        : [...list, p.id],
                    )
                  }
                />
              ))}
            </View>
            <View style={styles.chipWrap}>
              <Chip
                label="👥 Semua ikut"
                active={iShared.length === b.people.length}
                onPress={() => setIShared(b.people.map((p) => p.id))}
              />
              <Chip
                label="🚫 Kosongkan"
                active={iShared.length === 0}
                onPress={() => setIShared([])}
              />
            </View>
            <VixText heading="label" additionalStyle={styles.hint}>
              Kalau lebih dari satu orang, harganya dibagi rata di antara mereka.
            </VixText>
          </>
        )}

        {itemEdit !== 'new' && itemEdit !== null && (
          <InlineDelete
            key={itemEdit.id}
            label="Hapus item ini"
            busy={busy}
            onDelete={deleteItem}
          />
        )}
        <DualButtons
          confirmLabel="Simpan"
          busy={busy}
          onCancel={() => setItemEdit(null)}
          onConfirm={saveItem}
        />
      </SheetModal>

      {/* ===== Sheet tambah orang ===== */}
      <SheetModal
        visible={personOpen}
        title="Tambah Orang"
        onClose={() => setPersonOpen(false)}>
        <FormInput
          style={styles.formGap}
          placeholder="Namanya"
          value={pName}
          onChangeText={setPName}
          editable={!busy}
          autoFocus
        />
        <DualButtons
          confirmLabel="Tambah"
          busy={busy}
          onCancel={() => setPersonOpen(false)}
          onConfirm={addPerson}
        />
      </SheetModal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.BACKGROUND },
  content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 32 },
  empty: { textAlign: 'center', marginTop: 20 },
  hero: {
    backgroundColor: Color.MAIN_DARK,
    borderRadius: 20,
    padding: 18,
    gap: 2,
  },
  heroLabel: { color: Color.TEXT_ON_DARK_MUTED },
  heroValue: { color: Color.TEXT_REVERSE },
  heroHint: { color: Color.MAIN_LIGHT, marginTop: 4 },
  sectionTitle: { marginTop: 16, marginBottom: 8 },
  photo: {
    width: '100%',
    height: 220,
    borderRadius: 14,
    backgroundColor: Color.CONTRAST_CONTAINER,
    marginBottom: 10,
  },
  scanRow: { flexDirection: 'row', gap: 8 },
  scanButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Color.MAIN,
    borderRadius: 12,
    paddingVertical: 13,
  },
  scanText: { color: Color.TEXT_REVERSE },
  scanAlt: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Color.CONTRAST_CONTAINER,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  scanAltText: { color: Color.ACCENT_DARK },
  scanHint: { color: Color.TEXT_LABEL, marginTop: 8 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  hint: { color: Color.TEXT_LABEL, marginTop: 8 },
  warnLine: { color: Color.DANGER },
  itemRow: {
    ...CARD,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  // Belum ditandai siapa yang makan → garis tepi merah, karena harganya
  // memang belum masuk hitungan siapa pun.
  itemRowWarn: { borderColor: Color.DANGER },
  itemMain: { flex: 1, gap: 2 },
  itemName: { color: Color.TEXT_TITLE },
  itemPrice: { color: Color.MAIN_DARK },
  addButton: { marginTop: 2 },
  shareRow: {
    ...CARD,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  shareRowPaid: {
    backgroundColor: Color.MAIN_TRANSPARENT,
    borderColor: Color.MAIN_LIGHT,
  },
  shareMain: { flex: 1, gap: 2 },
  sharePaidName: {
    color: Color.TEXT_PLACEHOLDER,
    textDecorationLine: 'line-through',
  },
  shareTotal: { color: Color.MAIN_DARK },
  deleteWrap: { marginTop: 18 },
  fieldLabel: { marginBottom: 6 },
  formGap: { marginBottom: 10 },
  textArea: { minHeight: 76, paddingTop: 12, textAlignVertical: 'top' },
});
