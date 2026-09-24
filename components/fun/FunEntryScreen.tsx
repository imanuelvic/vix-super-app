import { useLocalSearchParams, useRouter } from 'expo-router';
import { Timestamp } from 'firebase/firestore';
import { useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { DateField } from '@/components/common/DateField';
import { DualButtons } from '@/components/common/DualButtons';
import { FormError } from '@/components/common/FormError';
import { FormInput } from '@/components/common/FormInput';
import { InlineDelete } from '@/components/common/InlineDelete';
import { KeyboardAwareScrollView } from '@/components/common/KeyboardAwareScrollView';
import { LoadingCenter } from '@/components/common/LoadingCenter';
import { MoneyInput } from '@/components/common/MoneyInput';
import { PressableScale } from '@/components/common/PressableScale';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { SelectField, type SelectOption } from '@/components/common/SelectField';
import { VixText } from '@/components/common/VixText';
import { useAuth } from '@/contexts/auth';
import { useBusyTask } from '@/hooks/useBusyTask';
import { useDraft } from '@/hooks/useDraft';
import { useLive } from '@/hooks/useLive';
import { groupDigits, parseAmount, parseDecimal } from '@/lib/format';
import {
    formatPace,
    funCategoryMeta,
    newFunId,
    pickCompressedMedal,
    raceFinishSec,
    racePace,
    saveFun,
    splitFinishSec,
    subscribeFun,
    toFinishSec,
    type FunCategory,
    type FunData,
    type FunEntry,
} from '@/lib/fun';
import {
    DELETE_ERROR,
    PHOTO_ERROR,
    SAVE_ERROR,
} from '@/lib/messages';
import {
    elevationLabel,
    MOUNTAIN_PROVINCES,
    mountainOf,
    mountainOfEntry,
    mountainsOf,
    mountainTitle,
    provinceLabel,
    type MountainProvince,
} from '@/lib/mountains';
import { photoUri } from '@/lib/photo';
import { formatRupiah } from '@/lib/transactions';

const KATEGORI: FunCategory[] = ['summit', 'race', 'reflection', 'recreation'];

/** Pilihan provinsi di isian Summit: tiga provinsi Jawa + "Lainnya" (ketik bebas). */
type ProvinsiPilihan = MountainProvince | 'other';
const PROVINSI_OPTIONS: SelectOption<ProvinsiPilihan>[] = [
  ...MOUNTAIN_PROVINCES.map((p) => ({ key: p.key, label: p.label })),
  { key: 'other', label: 'Lainnya', sub: 'di luar daftar / luar Jawa, nama diketik sendiri' },
];

/** Angka tersimpan → teks kolom uang ("" kalau nol). */
const rupiahDraft = (n?: number) => (n ? groupDigits(String(n)) : '');

// Layar isian SATU entri arsip Fun — Race 🏃 (di Health), Summit ⛰️, Rekreasi
// 🏝️. `id` = 'new' berarti sedang menambah.
//
// Kenapa layar sendiri, bukan sheet seperti dulu (14 Sep 2026): isian Race
// itu panjang — nama, lokasi, jarak, harga, waktu tempuh, tanggal, catatan,
// plus foto medali setinggi 150 — dan Summit membawa lima kolom anggaran. Di
// dalam sheet semuanya berdesakan dengan keyboard; kolom di bagian bawah harus
// dikejar sambil menggulung. Di layar penuh, KeyboardAwareScrollView yang
// mengangkat kolom yang sedang diketik ke atas keyboard.
//
// Dua pintu masuk untuk satu layar ini (app/race/[id] & app/fun/[id]) —
// bukan dua layar. Bedanya cuma WARNA pitanya: Race tinggal di Health, jadi ia
// harus berpita Health, bukan Fun. Warna itu ditentukan nama rutenya
// (lib/featureTheme.ts), bukan prop — maka pintunya yang dua.
export function FunEntryScreen({
  category: kategoriTetap,
}: {
  /** Diisi oleh rute yang kategorinya sudah pasti (race). Kosong = dari param. */
  category?: FunCategory;
}) {
  const router = useRouter();
  const { user } = useAuth();
  // Footer dipatok di dasar layar; SafeAreaView layar ini cuma menjaga sisi
  // atas (seperti Family), jadi ruang aman bawahnya ditambahkan ke footernya
  // sendiri — pola yang sama dengan app/wheel.tsx.
  const insets = useSafeAreaInsets();
  const { id, category: kategoriParam, mountain: mountainParam } =
    useLocalSearchParams<{
      id: string;
      category?: string;
      /** Summit baru dari halaman Gunung di Jawa: gunungnya sudah terpilih. */
      mountain?: string;
    }>();
  const isNew = id === 'new';
  const category: FunCategory =
    kategoriTetap ??
    (KATEGORI.find((k) => k === kategoriParam) ?? 'recreation');
  const meta = funCategoryMeta(category);

  const [error, setError] = useState<string | null>(null);
  const [data] = useLive<FunData>(subscribeFun, { onError: setError });
  const [busy, setBusy] = useState(false);
  const foto = useBusyTask<'foto'>();
  const photoBusy = foto.busy !== null;

  const entry = isNew ? null : (data?.entries.find((e) => e.id === id) ?? null);

  // Khusus Summit — gunung dari daftar lib/mountains.ts (16 Sep 2026): pilih
  // provinsi → nama gunung, lalu nama, lokasi & ketinggiannya terisi sendiri
  // (tetap boleh diubah). Entri lama tanpa `mountainId` dicocokkan dari
  // namanya ("Gunung Semeru (Ranu Kumbolo)" → Semeru); yang tak ada di
  // daftar jatuh ke "Lainnya" dan namanya tetap ketikan bebas seperti dulu.
  const awalGunung = isNew
    ? mountainOf(mountainParam)
    : entry
      ? mountainOfEntry(entry)
      : null;
  const [mountainId, setMountainId] = useDraft<string | null>(awalGunung?.id ?? null);
  const [province, setProvince] = useDraft<ProvinsiPilihan | null>(
    awalGunung ? awalGunung.province : entry ? 'other' : null,
  );

  // Isian form. `useDraft` menyimpan HANYA yang kamu ketik — sebelum itu
  // nilainya ikut data Firestore yang datang belakangan, tanpa useEffect yang
  // mengisi state (dilarang React Compiler).
  const [today] = useState(() => new Date());
  const [title, setTitle] = useDraft(
    entry?.title ?? (awalGunung ? mountainTitle(awalGunung) : ''),
  );
  const [place, setPlace] = useDraft(
    entry?.place ?? (awalGunung ? provinceLabel(awalGunung.province) : ''),
  );
  const [detail, setDetail] = useDraft(
    entry?.detail ?? (awalGunung ? elevationLabel(awalGunung.elevation) : ''),
  );
  const [note, setNote] = useDraft(entry?.note ?? '');
  const [date, setDate] = useDraft(entry?.date ? entry.date.toDate() : today);
  // Khusus Race.
  const [price, setPrice] = useDraft(rupiahDraft(entry?.price));
  // Ditampilkan apa adanya (21,0975 tetap 21,0975), bukan dibulatkan
  // formatDecimal: membuka lalu menyimpan ulang tidak boleh mengubah angkanya.
  const [distance, setDistance] = useDraft(
    entry?.distanceKm ? String(entry.distanceKm).replace('.', ',') : '',
  );
  // Waktu tempuh: tiga kolom (jam · menit · detik), disimpan sebagai detik utuh.
  // Data lama yang cuma menit tetap terisi benar lewat raceFinishSec().
  const waktuLama = splitFinishSec(entry ? raceFinishSec(entry) : 0);
  const [jam, setJam] = useDraft(waktuLama.h ? String(waktuLama.h) : '');
  const [menit, setMenit] = useDraft(waktuLama.m ? String(waktuLama.m) : '');
  const [detik, setDetik] = useDraft(waktuLama.s ? String(waktuLama.s) : '');
  // Pace dihitung app, bukan diketik: jarak & waktu sudah cukup untuk itu, dan
  // angka yang dihitung tak pernah salah ketik.
  const finishSec = toFinishSec(Number(jam), Number(menit), Number(detik));
  const pace = racePace(finishSec, parseDecimal(distance));
  const [medalPhoto, setMedalPhoto] = useDraft<string | null>(
    entry?.medalPhoto ?? null,
  );
  // Khusus Summit — rincian anggaran pendakian.
  const [costOT, setCostOT] = useDraft(rupiahDraft(entry?.costOT));
  const [costRent, setCostRent] = useDraft(rupiahDraft(entry?.costRent));
  const [costTransport, setCostTransport] = useDraft(
    rupiahDraft(entry?.costTransport),
  );
  const [costPermit, setCostPermit] = useDraft(rupiahDraft(entry?.costPermit));
  const [costOther, setCostOther] = useDraft(rupiahDraft(entry?.costOther));

  // Total anggaran Summit yang sedang diketik — pratinjau live.
  const summitBudgetLive =
    parseAmount(costOT) +
    parseAmount(costRent) +
    parseAmount(costTransport) +
    parseAmount(costPermit) +
    parseAmount(costOther);

  function pilihProvinsi(p: ProvinsiPilihan | null) {
    setProvince(p);
    setMountainId(null);
  }

  function pilihGunung(idGunung: string | null) {
    setMountainId(idGunung);
    const m = mountainOf(idGunung);
    if (!m) return;
    setTitle(mountainTitle(m));
    setPlace(provinceLabel(m.province));
    setDetail(elevationLabel(m.elevation));
  }
  function handlePickMedal() {
    if (busy) return;
    return foto.run({
      key: 'foto',
      task: async () => {
        const photo = await pickCompressedMedal();
        if (photo) setMedalPhoto(photo);
      },
      fail: () => setError(PHOTO_ERROR),
    });
  }

  async function handleSave() {
    if (!user || busy) return;
    const trimmed = title.trim();
    if (!trimmed) {
      setError(`Isi ${meta.titleLabel.toLowerCase()} dulu.`);
      return;
    }
    setError(null);
    setBusy(true);
    const list = data?.entries ?? [];
    const next: FunEntry = {
      id: isNew ? newFunId() : id,
      category,
      title: trimmed,
      place: place.trim(),
      detail: detail.trim(),
      note: note.trim(),
      date: Timestamp.fromDate(date),
    };
    // Field khusus tiap kategori HANYA ditulis untuk kategorinya, supaya tidak
    // ada key undefined yang dikirim ke Firestore pada kategori lain.
    if (category === 'race') {
      next.price = parseAmount(price);
      next.distanceKm = parseDecimal(distance);
      next.finishSec = finishSec;
      next.medalPhoto = medalPhoto;
    }
    if (category === 'summit') {
      next.mountainId = province === 'other' ? null : mountainId;
      next.costOT = parseAmount(costOT);
      next.costRent = parseAmount(costRent);
      next.costTransport = parseAmount(costTransport);
      next.costPermit = parseAmount(costPermit);
      next.costOther = parseAmount(costOther);
    }
    try {
      await saveFun(user.uid, {
        entries: isNew
          ? [...list, next]
          : list.map((e) => (e.id === id ? next : e)),
      });
      router.back();
    } catch {
      setError(SAVE_ERROR);
      setBusy(false);
    }
  }

  // Hapus PERMANEN — daftarnya ditulis ulang tanpa entri ini.
  async function handleDelete() {
    if (!user || isNew || busy) return;
    setBusy(true);
    try {
      await saveFun(user.uid, {
        entries: (data?.entries ?? []).filter((e) => e.id !== id),
      });
      router.back();
    } catch {
      setError(DELETE_ERROR);
      setBusy(false);
    }
  }

  // Entri lama: tunggu datanya dulu, kalau tidak isiannya sempat kosong.
  const loading = !isNew && data === null;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        // Race tinggal di Health sejak 30 Agu 2026; yang lain di Fun.
        backLabel={category === 'race' ? 'Health' : 'Fun'}
        title={`${isNew ? 'Tambah' : 'Edit'} ${meta.label}`}
        subtitle={`${meta.emoji} ${meta.label}`}
      />

      {loading ? (
        <LoadingCenter />
      ) : (
        <>
          <KeyboardAwareScrollView contentContainerStyle={styles.content}>
            {category === 'summit' ? (
              <>
                {/* Provinsi → gunung dari daftar; nama di bawahnya terisi
                    sendiri tapi tetap bisa ditambahi, mis. "(Ranu Kumbolo)". */}
                <VixText heading="label" additionalStyle={styles.fieldLabelFirst}>
                  🗺️ Provinsi
                </VixText>
                <SelectField
                  value={province}
                  options={PROVINSI_OPTIONS}
                  onChange={pilihProvinsi}
                  placeholder="Pilih provinsi"
                  disabled={busy}
                />
                {province && province !== 'other' ? (
                  <>
                    <VixText heading="label" additionalStyle={styles.fieldLabel}>
                      ⛰️ Gunung
                    </VixText>
                    <SelectField
                      value={mountainId}
                      options={mountainsOf(province).map((m) => ({
                        key: m.id,
                        label: mountainTitle(m),
                        sub: `${elevationLabel(m.elevation)} · ${m.note}`,
                      }))}
                      onChange={pilihGunung}
                      placeholder="Pilih gunung yang didaki"
                      disabled={busy}
                    />
                  </>
                ) : null}
                <FormInput
                  style={styles.inputGap}
                  placeholder={meta.titleLabel}
                  value={title}
                  onChangeText={setTitle}
                  editable={!busy}
                />
              </>
            ) : (
              <FormInput
                placeholder={meta.titleLabel}
                value={title}
                onChangeText={setTitle}
                editable={!busy}
                autoFocus={isNew}
              />
            )}
            <FormInput
              style={styles.inputGap}
              placeholder="Lokasi (opsional)"
              value={place}
              onChangeText={setPlace}
              editable={!busy}
            />
            <FormInput
              style={styles.inputGap}
              placeholder={meta.detailLabel}
              value={detail}
              onChangeText={setDetail}
              editable={!busy}
            />

            {category === 'race' && (
              <>
                <MoneyInput
                  style={styles.inputGap}
                  placeholder="Harga pendaftaran"
                  value={price}
                  onChangeText={(t) => setPrice(groupDigits(t))}
                  editable={!busy}
                />
                <FormInput
                  style={styles.inputGap}
                  placeholder="Jarak (km), mis. 10 atau 21,1"
                  keyboardType="decimal-pad"
                  value={distance}
                  onChangeText={setDistance}
                  editable={!busy}
                />
                {/* Waktu tempuh — jam · menit · detik berdampingan. Detiknya
                    ikut karena pace di bawah butuh detik; "1j 25m" saja
                    meleset sampai setengah menit per km. */}
                <VixText heading="label" additionalStyle={styles.fieldLabel}>
                  ⏱️ Waktu Tempuh
                </VixText>
                <View style={styles.timeRow}>
                  {(
                    [
                      ['Jam', jam, setJam],
                      ['Menit', menit, setMenit],
                      ['Detik', detik, setDetik],
                    ] as const
                  ).map(([label, nilai, ubah]) => (
                    <FormInput
                      key={label}
                      style={styles.timeInput}
                      placeholder={label}
                      keyboardType="number-pad"
                      value={nilai}
                      onChangeText={(t) => ubah(t.replace(/[^0-9]/g, '').slice(0, 2))}
                      editable={!busy}
                    />
                  ))}
                </View>
                {/* Pace — terisi sendiri begitu jarak & waktunya ada. */}
                <VixText heading="label" additionalStyle={styles.paceText}>
                  {pace !== null
                    ? `🏃 Pace ${formatPace(pace)}`
                    : '🏃 Pace terhitung otomatis dari jarak & waktu'}
                </VixText>
              </>
            )}

            {/* Rincian anggaran khusus Summit — total dihitung otomatis */}
            {category === 'summit' && (
              <>
                <View style={styles.inputGap}>
                  <VixText heading="label" additionalStyle={styles.fieldLabel}>
                    💰 Rincian Anggaran Pendakian (Rp)
                  </VixText>
                </View>
                <MoneyInput
                  style={styles.inputGap}
                  placeholder="Jasa OT (open trip / guide)"
                  value={costOT}
                  onChangeText={(t) => setCostOT(groupDigits(t))}
                  editable={!busy}
                />
                <MoneyInput
                  style={styles.inputGap}
                  placeholder="Sewa barang / alat"
                  value={costRent}
                  onChangeText={(t) => setCostRent(groupDigits(t))}
                  editable={!busy}
                />
                <MoneyInput
                  style={styles.inputGap}
                  placeholder="Transportasi"
                  value={costTransport}
                  onChangeText={(t) => setCostTransport(groupDigits(t))}
                  editable={!busy}
                />
                <MoneyInput
                  style={styles.inputGap}
                  placeholder="SIMAKSI / tiket masuk"
                  value={costPermit}
                  onChangeText={(t) => setCostPermit(groupDigits(t))}
                  editable={!busy}
                />
                <MoneyInput
                  style={styles.inputGap}
                  placeholder="Lain-lain"
                  value={costOther}
                  onChangeText={(t) => setCostOther(groupDigits(t))}
                  editable={!busy}
                />
                <View style={styles.budgetTotalRow}>
                  <VixText heading="label" additionalStyle={styles.budgetTotalLabel}>
                    💰 Total anggaran
                  </VixText>
                  <VixText heading="bold" additionalStyle={styles.budgetTotalValue}>
                    {formatRupiah(summitBudgetLive)}
                  </VixText>
                </View>
              </>
            )}

            <View style={styles.inputGap}>
              <DateField value={date} onChange={setDate} />
            </View>
            <FormInput
              style={styles.inputGap}
              placeholder="Catatan (opsional)"
              value={note}
              onChangeText={setNote}
              editable={!busy}
            />

            {category === 'race' && (
              <View style={styles.inputGap}>
                <VixText heading="label" additionalStyle={styles.fieldLabel}>
                  📸 Foto Medali (opsional)
                </VixText>
                <PressableScale
                  style={styles.medalPicker}
                  onPress={handlePickMedal}
                  disabled={photoBusy || busy}>
                  {photoBusy ? (
                    <ActivityIndicator color={Color.MAIN} />
                  ) : medalPhoto ? (
                    <Image
                      source={{ uri: photoUri(medalPhoto) }}
                      style={styles.medalPreview}
                      resizeMode="cover"
                    />
                  ) : (
                    <VixText heading="label" additionalStyle={styles.medalHint}>
                      🏅{'\n'}Tambah Foto Medali
                    </VixText>
                  )}
                </PressableScale>
                {medalPhoto && (
                  <PressableScale onPress={() => setMedalPhoto(null)} hitSlop={8}>
                    <VixText heading="label" additionalStyle={styles.medalRemove}>
                      Hapus foto
                    </VixText>
                  </PressableScale>
                )}
              </View>
            )}

            <FormError message={error} gap="top" />

            {!isNew && (
              <InlineDelete
                label={`Hapus ${meta.label.toLowerCase()} ini`}
                busy={busy}
                onDelete={handleDelete}
              />
            )}
          </KeyboardAwareScrollView>

          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            <DualButtons
              confirmLabel="Simpan"
              busy={busy}
              onCancel={() => router.back()}
              onConfirm={handleSave}
            />
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.BACKGROUND },
  content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 24 },
  inputGap: { marginTop: 8 },
  fieldLabel: { marginTop: 10, marginBottom: 6 },
  fieldLabelFirst: { marginBottom: 6 },
  // Jam · menit · detik: tiga kolom selebar sama.
  timeRow: { flexDirection: 'row', gap: 8 },
  timeInput: { flex: 1 },
  paceText: { color: Color.TEXT_LABEL, marginTop: 8 },
  budgetTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: Color.BORDER,
  },
  budgetTotalLabel: { color: Color.TEXT_TITLE },
  budgetTotalValue: { color: Color.MAIN_DARK },
  // Kotak pemilih foto medali.
  medalPicker: {
    height: 150,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Color.BORDER,
    backgroundColor: Color.BACKGROUND,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  medalPreview: { width: '100%', height: '100%' },
  medalHint: { textAlign: 'center', color: Color.TEXT_LABEL },
  medalRemove: { color: Color.DANGER, textAlign: 'center', marginTop: 6 },
  // Tombol Batal/Simpan dipatok di bawah layar — sama seperti footer
  // SheetModal, jadi rasanya tidak berubah dari sheet yang dulu.
  footer: {
    paddingHorizontal: 20,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Color.BORDER,
    backgroundColor: Color.BACKGROUND,
  },
});
