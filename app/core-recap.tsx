import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CARD_GAP } from '@/assets/style/card';
import { Color } from '@/assets/style/color';
import { SCREEN_CONTENT } from '@/assets/style/layout';
import { CenterDialog } from '@/components/common/CenterDialog';
import { EmojiButton } from '@/components/common/EmojiButton';
import { EmptyText } from '@/components/common/EmptyText';
import { LoadingCenter } from '@/components/common/LoadingCenter';
import { PressableScale } from '@/components/common/PressableScale';
import { ScreenError } from '@/components/common/ScreenError';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { VixText } from '@/components/common/VixText';
import { PersonInfo } from '@/components/core/PersonInfo';
import { ShareToLeaderSheet } from '@/components/core/ShareToLeaderSheet';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useLiveAll } from '@/hooks/useLiveAll';
import {
  meetingKindMeta,
  subscribeCoreLeaders,
  subscribeVisitations,
  type CoreLeader,
  type Visitation,
} from '@/lib/core';
import { visitationRecap } from '@/lib/coreCalendar';
import { formatTinyDate } from '@/lib/format';
import { shareRecapPdf } from '@/lib/recapPdf';

const MIN_YEAR = 2026;

// ── Tinggi baris DIPATOK (28 Sep 2026) ──────────────────────────────────────
// Tabelnya sekarang DUA bagian yang digulung terpisah: kolom Jenis diam di
// kiri, sisanya bergeser mendatar. Dua bagian yang tingginya dihitung
// sendiri-sendiri akan berhenti sejajar begitu satu baris isinya lebih tinggi
// dari pasangannya — dan salah sejajar di tabel angka artinya angka terbaca di
// baris yang salah, kesalahan yang tidak kelihatan sampai sudah telanjur
// dipercaya.
//
// Angkanya bukan angka baru: persis tinggi baris yang sudah berlaku sekarang.
//   biasa : teks 'bold' 22,5 + padding 8×2 + garis bawah 1   = 39,5
//   tanggal: dua baris kecil (lineHeight 14) 28 + 16 + 1     = 45
//   Total : garis ATAS-nya 1,5 dan tidak punya garis bawah   = 40
const ROW_H = 39.5;
const ROW_DATE_H = 45;
const ROW_TOTAL_H = 40;

/** Isi dialog "lambang ini artinya apa" — jenis acara maupun baris 📅. */
type KindInfo = { icon: string; label: string; desc: string };

// Baris 📅 di kepala tabel bukan jenis acara, jadi keterangannya ditulis di
// sini, bukan di MEETING_KINDS.
const INFO_THANKSGIVING: KindInfo = {
  icon: '📅 🎉',
  label: 'Tanggal Thanksgiving',
  desc: 'Ulang tahun tiap CORE, diisi di data CORE Leader. Tahunnya ikut tercetak, jadi umur CORE-nya kelihatan. Titik berarti tanggalnya belum diisi.',
};

// Garis tegak di depan kolom Σ — jumlah per jenis terlihat terpisah dari
// angka per CL, seperti baris Total yang dipisah garis mendatar. Menembus
// padding barisnya (margin negatif) supaya garisnya bersambung antar-baris.
function SumLine() {
  return <View style={styles.sumLine} />;
}

export default function CoreRecapScreen() {
  const [visitations, setVisitations] = useState<Visitation[] | null>(null);
  const [leaders, setLeaders] = useState<CoreLeader[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Sheet "Bagikan ke CORE Leader": PDF rekap tahun ini untuk SATU CORE
  // (warna hatinya), dikirim ke CL-nya lewat WhatsApp.
  const [shareOpen, setShareOpen] = useState(false);
  // Dua dialog tengah layar (27 Sep 2026) — tabel ini seluruhnya lambang, dan
  // lambang tanpa nama cuma terbaca kalau sudah hafal:
  //   • kolom kiri (🔥 👥 1️⃣ …) → jenis acaranya apa,
  //   • kepala kolom (💛 💜 💚 …) → hati itu CORE-nya siapa.
  const [kindInfo, setKindInfo] = useState<KindInfo | null>(null);
  const [leaderInfo, setLeaderInfo] = useState<CoreLeader | null>(null);

  useLiveAll(
    (uid, fail) => [
      subscribeVisitations(uid, setVisitations, fail),
      subscribeCoreLeaders(uid, setLeaders, fail),
    ],
    { onError: setError },
  );

  const tahunIni = new Date().getFullYear();
  const [year, setYear] = useState(tahunIni);

  const rekap = useMemo(
    () => visitationRecap(visitations ?? [], leaders ?? [], year),
    [visitations, leaders, year],
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        backLabel="CORE"
        title="Visitation Recap 📊"
        subtitle="Rekap visitasi setiap CORE"
        right={
          leaders && leaders.length > 0 ? (
            <EmojiButton
              icon="square.and.arrow.up"
              onPress={() => setShareOpen(true)}
            />
          ) : undefined
        }
      />
      <ScreenError message={error} />

      {visitations === null || leaders === null ? (
        <LoadingCenter />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.yearRow}>
            <PressableScale
              onPress={() => setYear((y) => y - 1)}
              hitSlop={10}
              disabled={year <= MIN_YEAR}>
              <IconSymbol
                name="chevron.left"
                size={22}
                color={year <= MIN_YEAR ? Color.BORDER : Color.CORE_DARK}
              />
            </PressableScale>
            <VixText heading="title" additionalStyle={styles.yearText}>
              {year}
            </VixText>
            <PressableScale
              onPress={() => setYear((y) => y + 1)}
              hitSlop={10}
              disabled={year >= tahunIni}>
              <IconSymbol
                name="chevron.right"
                size={22}
                color={year >= tahunIni ? Color.BORDER : Color.CORE_DARK}
              />
            </PressableScale>
          </View>

          {leaders.length === 0 ? (
            <EmptyText>Belum ada CORE Leader untuk direkap.</EmptyText>
          ) : (
            // Dua bagian bersebelahan: kolom Jenis yang DIAM, lalu sisanya di
            // dalam ScrollView mendatar. Dulu keduanya satu tabel, jadi begitu
            // digeser ke kanan untuk melihat CORE ke-7, kolom jenisnya ikut
            // hilang dan angkanya jadi deretan tanpa nama.
            <View style={styles.tableWrap}>
              <View style={styles.freezeCol}>
                <View style={[styles.row, styles.freezeRow, styles.headRow]}>
                  <VixText heading="label" additionalStyle={[styles.labelCol, styles.labelText]}>
                    Jenis
                  </VixText>
                </View>

                {/* 📅 Tanggal Thanksgiving — bukan jenis acara, tapi tetap
                    punya keterangannya sendiri. */}
                <View style={[styles.row, styles.freezeRow, styles.dateRow]}>
                  <PressableScale
                    style={styles.labelBtn}
                    onPress={() => setKindInfo(INFO_THANKSGIVING)}>
                    <VixText heading="label" additionalStyle={styles.labelText} numberOfLines={1}>
                      📅 🎉
                    </VixText>
                  </PressableScale>
                </View>

                {rekap.rows.map((r) => {
                  const meta = meetingKindMeta(r.kind);
                  return (
                    // Lambang jenisnya berlatar pil CORE supaya terbaca sebagai
                    // TOMBOL, bukan sekadar lambang: click → nama & penjelasan
                    // acaranya (lihat `desc` di MEETING_KINDS).
                    <View key={r.kind} style={[styles.row, styles.freezeRow]}>
                      <PressableScale
                        style={styles.labelBtn}
                        onPress={() =>
                          setKindInfo({
                            icon: meta.icon,
                            label: meta.label,
                            desc: meta.desc,
                          })
                        }>
                        <VixText heading="label" additionalStyle={styles.labelText} numberOfLines={1}>
                          {meta.icon}
                        </VixText>
                      </PressableScale>
                    </View>
                  );
                })}

                <View style={[styles.row, styles.freezeRow, styles.totalRow]}>
                  <VixText heading="bold" additionalStyle={[styles.labelCol, styles.labelText]}>
                    Total
                  </VixText>
                </View>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.scroller}
                contentContainerStyle={styles.tableScroll}>
                <View style={styles.table}>
                  <View style={[styles.row, styles.dataRow, styles.headRow]}>
                    {leaders.map((l) => (
                      // Hati CORE-nya bisa di-click → data umum CL-nya (nama,
                      // umur, ulang tahun, nomor, pendidikan & pekerjaan).
                      <PressableScale
                        key={l.id}
                        style={styles.cellTap}
                        onPress={() => setLeaderInfo(l)}>
                        <VixText heading="bold" additionalStyle={styles.cellText}>
                          {l.heart}
                        </VixText>
                      </PressableScale>
                    ))}
                    <SumLine />
                    <VixText heading="bold" additionalStyle={[styles.cell, styles.sumCol]}>
                      Σ
                    </VixText>
                  </View>

                  {/* Tanggal Thanksgiving tiap CL ("d mmm yy", dua baris) — dari
                      data CL-nya (tahun apa pun; tahunnya ikut tercetak), visitasi
                      ber-penanda 🎉 jadi cadangan. Labelnya 📅, bukan 🎉: baris
                      jenis Thanksgiving di bawahnya sudah memakai 🎉. */}
                  <View style={[styles.row, styles.dataRow, styles.dateRow]}>
                    {rekap.thanksgiving.map((d, i) => (
                      <VixText
                        key={leaders[i].id}
                        heading="label"
                        additionalStyle={[styles.cell, d ? styles.cellDate : styles.cellZero]}>
                        {d ? formatTinyDate(d).replace(/ (\d+)$/, '\n$1') : '·'}
                      </VixText>
                    ))}
                    <SumLine />
                    <VixText heading="label" additionalStyle={[styles.cell, styles.sumCol]}>
                      {rekap.thanksgiving.filter(Boolean).length}
                    </VixText>
                  </View>

                  {rekap.rows.map((r) => {
                    return (
                      <View key={r.kind} style={[styles.row, styles.dataRow]}>
                        {r.counts.map((n, i) => (
                          <VixText
                            key={leaders[i].id}
                            heading={n > 0 ? 'bold' : 'label'}
                            additionalStyle={[styles.cell, n === 0 && styles.cellZero]}>
                            {n > 0 ? n : '·'}
                          </VixText>
                        ))}
                        <SumLine />
                        <VixText
                          heading={r.total > 0 ? 'bold' : 'label'}
                          additionalStyle={[styles.cell, styles.sumCol, r.total === 0 && styles.cellZero]}>
                          {r.total > 0 ? r.total : '·'}
                        </VixText>
                      </View>
                    );
                  })}

                  <View style={[styles.row, styles.dataRow, styles.totalRow]}>
                    {rekap.totals.map((n, i) => (
                      <VixText key={leaders[i].id} heading="bold" additionalStyle={[styles.cell, styles.totalText]}>
                        {n}
                      </VixText>
                    ))}
                    <SumLine />
                    <VixText heading="bold" additionalStyle={[styles.cell, styles.sumCol, styles.totalText]}>
                      {rekap.grand}
                    </VixText>
                  </View>
                </View>
              </ScrollView>
            </View>
          )}
        </ScrollView>
      )}

      <ShareToLeaderSheet
        visible={shareOpen}
        onClose={() => setShareOpen(false)}
        kind="recap"
        doc={`Rekap Visitasi ${year}`}
        share={(l, lastShared) =>
          shareRecapPdf(l, visitations ?? [], year, lastShared)
        }
      />

      {/* Lambang jenis acara → artinya apa */}
      <CenterDialog visible={kindInfo !== null} onClose={() => setKindInfo(null)}>
        {kindInfo && (
          <>
            <VixText heading="title" additionalStyle={styles.dialogTitle}>
              {kindInfo.icon} {kindInfo.label}
            </VixText>
            <VixText heading="paragraph" additionalStyle={styles.dialogBody}>
              {kindInfo.desc}
            </VixText>
            <PressableScale style={styles.dialogClose} onPress={() => setKindInfo(null)}>
              <VixText heading="label" additionalStyle={styles.dialogCloseText}>
                Tutup
              </VixText>
            </PressableScale>
          </>
        )}
      </CenterDialog>

      {/* Hati CORE → CL-nya siapa, beserta data umumnya. Isinya komponen yang
          SAMA dengan modal baca-saja di tab CORE Leader, jadi tak ada dua
          daftar kolom yang bisa berbeda pendapat. */}
      <CenterDialog visible={leaderInfo !== null} onClose={() => setLeaderInfo(null)}>
        {leaderInfo && (
          <>
            <VixText heading="title" additionalStyle={styles.dialogTitle}>
              {leaderInfo.heart} {leaderInfo.name}
            </VixText>
            <PersonInfo person={leaderInfo} today={new Date()} />
            <PressableScale style={styles.dialogClose} onPress={() => setLeaderInfo(null)}>
              <VixText heading="label" additionalStyle={styles.dialogCloseText}>
                Tutup
              </VixText>
            </PressableScale>
          </>
        )}
      </CenterDialog>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.BACKGROUND },
  content: { ...SCREEN_CONTENT, paddingBottom: 32 },
  yearRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: CARD_GAP,
  },
  yearText: { color: Color.CORE_DARK },
  // Bingkai kartunya pindah ke pembungkus DUA bagian (kolom diam + kolom
  // geser), supaya sudut & garis tepinya tetap satu kartu utuh.
  tableWrap: {
    flexDirection: 'row',
    backgroundColor: Color.CONTAINER,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Color.BORDER,
    overflow: 'hidden',
  },
  // Kolom Jenis yang DIAM. Garis kanannya bukan hiasan: ia yang memberi tahu
  // bahwa isi di sebelahnya lewat DI BELAKANG kolom ini saat digeser.
  freezeCol: { borderRightWidth: 1, borderRightColor: Color.BORDER },
  // ⚠️ `flex: 1` WAJIB: tanpa itu ScrollView mendatar di dalam baris ini
  // melebar mengikuti isinya, jadi begitu CORE-nya banyak tabelnya melewati
  // tepi layar dan yang di kanan terpotong `overflow: hidden` — bukan bisa
  // digeser. Dengan ini lebarnya dipatok sisa layar, dan kelebihannya digulung.
  scroller: { flex: 1 },
  // Tabel selebar sisa layar; melebihi itu baru bisa digeser.
  tableScroll: { minWidth: '100%' },
  table: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    // gap 6: hati & tanggalnya punya jarak, tidak lagi berdempetan.
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Color.BORDER,
    // Dipatok supaya kedua bagian tabel tetap sebaris. Lihat ROW_H di atas.
    height: ROW_H,
  },
  // Baris di kolom yang diam: napas kanannya 6, sama dengan jarak antar-kolom
  // di sebelahnya, jadi kolom pertama CL jatuh persis di tempat semula.
  freezeRow: { paddingRight: 6 },
  // Baris di bagian yang bergeser: napas kirinya sudah dipegang kolom diam.
  dataRow: { paddingLeft: 0 },
  // Baris tanggal Thanksgiving lebih tinggi (tanggalnya dua baris kecil).
  dateRow: { height: ROW_DATE_H },
  headRow: { backgroundColor: Color.CORE },
  totalRow: {
    borderBottomWidth: 0,
    borderTopWidth: 1.5,
    borderTopColor: Color.CORE_DARK,
    height: ROW_TOTAL_H,
  },
  // Kolom kiri cuma memuat satu lambang jenis (dan "Jenis" di kepalanya),
  // jadi lebarnya dipangkas 96 → 46: sisanya diberikan ke kolom CL.
  // Lebarnya saja di sini, warnanya di `labelText`: kolom ini sekarang bisa
  // berupa tulisan (Jenis · Total) MAUPUN tombol, dan `color` bukan gaya View.
  labelCol: { width: 46 },
  labelText: { color: Color.TEXT_TITLE },
  // Lambang jenis acara sebagai TOMBOL (28 Sep 2026). Sebelumnya ia memang
  // sudah bisa di-click, tapi tidak ada satu pun tanda bahwa ia bisa — jadi
  // penjelasan tiap jenis acara praktis tidak pernah ditemukan.
  //
  // `alignSelf: 'stretch'` dipilih daripada padding tegak: pilnya jadi setinggi
  // isi barisnya sendiri, jadi tombolnya terlihat jelas TANPA membuat satu
  // baris pun bertambah tinggi.
  labelBtn: {
    width: 46,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: Color.CORE,
  },
  // Tiap CL satu kolom. minWidth 48 (dari 28) supaya tanggal Thanksgiving
  // ("15 Nov" di baris atas, "24" di bawahnya) tidak lagi berdesakan dan
  // hatinya punya ruang. Lebih lebar dari layar = tabelnya digeser mendatar,
  // dan itu memang sudah disiapkan (ScrollView horizontal di atas).
  //
  // ⚠️ SEMUA baris wajib memakai minWidth yang SAMA. Kalau satu baris saja
  // boleh lebih sempit, kolomnya berhenti sejajar dan garis tegak Σ di ujung
  // kanan jadi bertangga, bukan satu garis lurus dari atas ke bawah.
  cell: { flex: 1, minWidth: 48, textAlign: 'center', color: Color.TEXT_TITLE },
  // Bentuk kolom yang SAMA, tapi sebagai tombol (hati CL di kepala tabel).
  cellTap: { flex: 1, minWidth: 48, alignItems: 'center' },
  cellText: { textAlign: 'center', color: Color.TEXT_TITLE },
  sumCol: { color: Color.CORE_DARK },
  // Garis tegak pemisah kolom Σ — setebal & sewarna garis di atas baris Total.
  sumLine: {
    width: 1.5,
    alignSelf: 'stretch',
    marginVertical: -8,
    marginLeft: 4,
    backgroundColor: Color.CORE_DARK,
  },
  cellZero: { color: Color.TEXT_PLACEHOLDER },
  // "7 Agu" di atas, "26" di bawah. Cuma ukuran hurufnya yang dikecilkan —
  // lebarnya SENGAJA tidak ditimpa (dulu minWidth 40, dan itulah yang membuat
  // baris tanggal lebih sempit daripada baris lain di iPhone 15, sehingga
  // garis Σ-nya meleset ke kiri sendiri).
  cellDate: { fontSize: 11, lineHeight: 14 },
  totalText: { color: Color.CORE_DARK },
  // Dialog tengah: judul, isi, lalu tombol tutup — sebentuk dengan dialog
  // Data Tubuh CL 🧍.
  dialogTitle: { color: Color.TEXT_TITLE, marginBottom: 8 },
  dialogBody: { color: Color.TEXT_PARAGRAPH },
  dialogClose: { alignItems: 'center', paddingVertical: 10, marginTop: 6 },
  dialogCloseText: { color: Color.TEXT_LABEL },
});
