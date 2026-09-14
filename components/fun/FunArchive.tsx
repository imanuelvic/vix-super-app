import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Image,
    StyleSheet,
    View,
} from 'react-native';

import { Color } from '@/assets/style/color';
import { FormError } from '@/components/common/FormError';
import { PressableScale } from '@/components/common/PressableScale';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { VixText } from '@/components/common/VixText';
import { useAuth } from '@/contexts/auth';
import { useKeyedData } from '@/hooks/useKeyedData';
import { formatDecimal, formatShortDayDate } from '@/lib/format';
import {
    EMPTY_FUN,
    formatFinish,
    formatPace,
    funCategoryMeta,
    raceFinishSec,
    racePace,
    subscribeFun,
    summitTotal,
    type FunCategory,
    type FunData,
} from '@/lib/fun';
import { LOAD_ERROR } from '@/lib/messages';
import { photoUri } from '@/lib/photo';
import { formatRupiah } from '@/lib/transactions';

// Arsip satu kategori Fun — DAFTARNYA saja. Tambah/edit/hapus ada di layar
// sendiri (components/fun/FunEntryScreen.tsx): click "Tambah" atau click
// kartunya → pindah ke sana. Dulu semuanya sheet di sini; isian Race yang
// panjang (plus foto medali) berdesakan dengan keyboard di dalam sheet.
//
// DIPAKAI DUA LAYAR, dan itu sebabnya ia berdiri sendiri di sini:
//   • Fun & Recreation 🎉 → Summit, Creators & Rekreasi
//   • Health 🍎           → Race (pindah ke sana 30 Agu 2026, karena race itu
//                           soal tubuh & latihan, bukan rekreasi)
// Datanya TETAP satu dokumen yang sama (users/{uid}/fun/data), jadi entri Race
// lamamu tidak berpindah ke mana-mana — cuma tempat membacanya yang berubah.
export function FunArchive({
  category,
  accent,
}: {
  category: FunCategory;
  /**
   * Warna tombol & garis tepi kartu. Kosong = warna milik kategorinya sendiri.
   *
   * Ada karena Race sekarang tinggal di dalam Health 🍎: warna merahnya dulu
   * milik daftar kategori Fun, dan di layar Health ia jadi satu-satunya sub-tab
   * yang warnanya beda sendiri dari Steps/Check-up. Yang menentukan warna
   * itu LAYAR tempatnya dipajang, bukan kategorinya — jadi layar yang memberi
   * tahu, bukan tabel kategori yang ditulis ulang (Fun tidak ikut berubah).
   */
  accent?: string;
}) {
  const { user } = useAuth();
  const router = useRouter();

  // Arsipnya dikunci ke pemiliknya: ganti akun → kosong lagi (loading), tak ada
  // sekejap pun data pemilik lama yang ikut terlihat.
  const { data: loaded, set: setData } = useKeyedData<
    string | undefined,
    FunData
  >(user?.uid);
  const data = loaded ?? EMPTY_FUN;
  const loading = loaded === null;
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    return subscribeFun(
      user.uid,
      (next) => {
        setData(next);
        setError(null);
      },
      () => {
        // Gagal memuat → berhenti loading dengan arsip kosong + pesan galat.
        setData(EMPTY_FUN);
        setError(LOAD_ERROR);
      },
    );
  }, [user, setData]);

  const meta = funCategoryMeta(category);
  // Satu warna untuk tombol, garis tepi kartu, & baris rinciannya.
  const warna = accent ?? meta.fg;

  // Entri kategori terpilih, terbaru di atas.
  //
  // Sub-tab "Refleksi" dibuang 30 Agu 2026, tapi entri lamanya TIDAK dihapus
  // dan TIDAK dibiarkan yatim: keduanya sama-sama soal TEMPAT yang pernah
  // dikunjungi (kolom formnya pun sama — "Nama tempat"), jadi yang lama ikut
  // tampil di Rekreasi. Datanya tidak ditulis ulang sama sekali; kalau nanti
  // kamu mau memindahkannya betulan, tinggal buka & simpan ulang satu per satu.
  const entries = useMemo(
    () =>
      data.entries
        .filter(
          (e) =>
            e.category === category ||
            (category === 'recreation' && e.category === 'reflection'),
        )
        .sort((a, b) => (b.date?.toMillis() ?? 0) - (a.date?.toMillis() ?? 0)),
    [data.entries, category],
  );

  // Satu layar isian untuk semua kategori; yang beda cuma PINTUNYA. Race
  // lewat /race (pitanya Health), sisanya lewat /fun — warna pita mengikuti
  // nama rute, lihat lib/featureTheme.ts.
  function bukaIsian(id: string) {
    if (category === 'race') {
      router.push({ pathname: '/race/[id]', params: { id } });
    } else {
      router.push({ pathname: '/fun/[id]', params: { id, category } });
    }
  }

  return (
    <>
      <View style={styles.content}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={Color.MAIN} />
          </View>
        ) : (
          <FlatList
            data={entries}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator
            persistentScrollbar
            indicatorStyle="black"
            ListHeaderComponent={
              <View style={styles.listHeader}>
                <PrimaryButton
                  label={`Tambah ${meta.label}`}
                  icon="plus"
                  background={warna}
                  onPress={() => bukaIsian('new')}
                />
                <FormError message={error} gap="top" />
              </View>
            }
            ListEmptyComponent={
              <View style={styles.center}>
                <VixText heading="label" additionalStyle={styles.emptyText}>
                  Belum ada {meta.label} yang tercatat.
                </VixText>
              </View>
            }
            renderItem={({ item }) => {
              // Race berfoto medali → isinya jadi DUA KOLOM: keterangan di kiri
              // (2 bagian), fotonya di kanan (1 bagian, sepertiga lebar kartu).
              // Dulu fotonya melintang penuh setinggi 170 di bawah tulisan, jadi
              // satu kartu memakan hampir satu layar dan daftar race-nya tidak
              // bisa dibandingkan sekilas.
              const medali =
                item.category === 'race' && item.medalPhoto
                  ? photoUri(item.medalPhoto)
                  : null;
              const keterangan = (
                <>
                <View style={styles.cardTop}>
                  {/* Emoji milik entri ITU SENDIRI, bukan milik tab — supaya
                      entri Refleksi 🧘 lama yang menumpang di Rekreasi tetap
                      dikenali dari lambangnya. */}
                  <VixText heading="title">
                    {funCategoryMeta(item.category).emoji}
                  </VixText>
                  <View style={styles.cardMain}>
                    <VixText
                      heading="bold"
                      numberOfLines={1}
                      additionalStyle={styles.cardTitle}>
                      {item.title}
                    </VixText>
                    <VixText heading="label" numberOfLines={1}>
                      {[
                        item.place,
                        item.date
                          ? formatShortDayDate(item.date.toDate())
                          : '',
                      ]
                        .filter(Boolean)
                        .join(' · ') || '-'}
                    </VixText>
                  </View>
                </View>
                {item.detail ? (
                  <VixText
                    heading="label"
                    additionalStyle={[styles.cardDetail, { color: warna }]}>
                    {item.detail}
                  </VixText>
                ) : null}
                {item.note ? (
                  <VixText heading="label" additionalStyle={styles.cardNote}>
                    {item.note}
                  </VixText>
                ) : null}
                {/* Rincian anggaran Summit + total (akumulasi otomatis) */}
                {item.category === 'summit' && summitTotal(item) > 0 ? (
                  <View style={styles.budgetBox}>
                    {[
                      { label: '🧭 Jasa OT', val: item.costOT },
                      { label: '🎒 Sewa barang', val: item.costRent },
                      { label: '🚗 Transportasi', val: item.costTransport },
                      { label: '🎫 SIMAKSI', val: item.costPermit },
                      { label: '🧾 Lain-lain', val: item.costOther },
                    ].map((row) =>
                      row.val ? (
                        <View key={row.label} style={styles.budgetRow}>
                          <VixText
                            heading="label"
                            additionalStyle={styles.budgetLabel}>
                            {row.label}
                          </VixText>
                          <VixText
                            heading="label"
                            additionalStyle={styles.budgetValue}>
                            {formatRupiah(row.val)}
                          </VixText>
                        </View>
                      ) : null,
                    )}
                    <View style={styles.budgetTotalRow}>
                      <VixText
                        heading="label"
                        additionalStyle={styles.budgetTotalLabel}>
                        💰 Total
                      </VixText>
                      <VixText
                        heading="bold"
                        additionalStyle={styles.budgetTotalValue}>
                        {formatRupiah(summitTotal(item))}
                      </VixText>
                    </View>
                  </View>
                ) : null}
                {/* Info khusus Race: harga, jarak, waktu tempuh, & pace (dihitung
                    dari dua yang terakhir — tidak pernah diketik). */}
                {item.category === 'race' &&
                (item.price || item.distanceKm || raceFinishSec(item) > 0) ? (
                  <VixText heading="label" additionalStyle={styles.raceStats}>
                    {(() => {
                      const detikTempuh = raceFinishSec(item);
                      const paceItem = racePace(detikTempuh, item.distanceKm ?? 0);
                      return [
                        item.price ? `💵 ${formatRupiah(item.price)}` : '',
                        item.distanceKm ? `📏 ${formatDecimal(item.distanceKm)} km` : '',
                        detikTempuh > 0 ? `⏱️ ${formatFinish(detikTempuh)}` : '',
                        paceItem !== null ? `🏃 ${formatPace(paceItem)}` : '',
                      ]
                        .filter(Boolean)
                        .join('   ·   ');
                    })()}
                  </VixText>
                ) : null}
                </>
              );
              // Click kartu → layar isiannya. Border mengikuti warna kategori.
              return (
                <PressableScale
                  style={[styles.card, { borderColor: warna }]}
                  onPress={() => bukaIsian(item.id)}>
                  {medali ? (
                    <View style={styles.medalRow}>
                      <View style={styles.medalMain}>{keterangan}</View>
                      <Image
                        source={{ uri: medali }}
                        style={styles.medalThumb}
                        resizeMode="cover"
                      />
                    </View>
                  ) : (
                    keterangan
                  )}
                </PressableScale>
              );
            }}
          />
        )}
      </View>

    </>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center', paddingTop: 40 },
  emptyText: { textAlign: 'center', paddingHorizontal: 20 },
  listContent: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 },
  listHeader: { marginBottom: 6 },
  card: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 10,
    gap: 6,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardMain: { flex: 1 },
  cardTitle: { color: Color.TEXT_TITLE },
  cardDetail: { fontWeight: '600' },
  cardNote: { color: Color.TEXT_LABEL },
  // Info Race di kartu: harga + waktu tempuh.
  raceStats: { color: Color.TEXT_TITLE, fontWeight: '600' },
  // Kotak rincian anggaran Summit di kartu.
  budgetBox: {
    marginTop: 4,
    backgroundColor: Color.BACKGROUND,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Color.BORDER,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 2,
  },
  budgetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  budgetLabel: { color: Color.TEXT_LABEL },
  budgetValue: { color: Color.TEXT_TITLE },
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
  // Kartu race berfoto: keterangan 2 bagian di kiri, foto 1 bagian di kanan.
  medalRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  // minWidth 0 supaya judul panjang membungkus, bukan memaksa kolomnya melebar
  // sampai fotonya terdesak keluar kartu.
  medalMain: { flex: 2, minWidth: 0, gap: 6 },
  // Persegi: tinggi ikut lebarnya sendiri, jadi tidak ada angka tinggi tetap
  // yang meleset saat lebar layarnya berbeda.
  medalThumb: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 10,
    backgroundColor: Color.BORDER,
  },
});
