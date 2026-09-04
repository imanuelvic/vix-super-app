import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { CARD } from '@/assets/style/card';
import { Color } from '@/assets/style/color';
import { DualButtons } from '@/components/common/DualButtons';
import { EditButton } from '@/components/common/EditButton';
import { FormError } from '@/components/common/FormError';
import { FormInput } from '@/components/common/FormInput';
import { InlineDelete } from '@/components/common/InlineDelete';
import { MiniButton } from '@/components/common/MiniButton';
import { Pagination } from '@/components/common/Pagination';
import { PressableScale } from '@/components/common/PressableScale';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { SectionRow } from '@/components/common/SectionRow';
import { SectionToggle } from '@/components/common/SectionToggle';
import { GangTabs } from '@/components/friends/GangTabs';
import { SelectField } from '@/components/common/SelectField';
import { SheetModal } from '@/components/common/SheetModal';
import { SummaryCard, summaryText } from '@/components/common/SummaryCard';
import { VixText } from '@/components/common/VixText';
import { FutsalSessionCard } from '@/components/friends/FutsalSessionCard';
import { FutsalSessionSheet } from '@/components/friends/FutsalSessionSheet';
import { useAuth } from '@/contexts/auth';
import { useFormSave } from '@/hooks/useFormSave';
import { usePagination } from '@/hooks/usePagination';
import { useFutsalSessionForm } from '@/hooks/useFutsalSessionForm';
import {
  dayIdToDate,
  formatDayDate,
  dayId as toDayId,
} from '@/lib/format';
import {
  gangMembers,
  gangMeta,
  lastSession,
  newFutsalId,
  nextSession,
  positionMeta,
  repeatDayId,
  saveFutsal,
  sessionTimeRange,
  FUTSAL_POSITIONS,
  upcomingSessions,
  type FutsalData,
  type FutsalGangKey,
  type FutsalMember,
  type FutsalPosition,
  type FutsalSession,
} from '@/lib/futsal';
import { localPhone } from '@/lib/phone';
import { formatRupiah } from '@/lib/transactions';

/**
 * Anak ScrollView yang DIPATOK di atas saat digulung: judul "👥 Anggota" (6).
 *
 * Urutan anaknya, dan semuanya SELALU ada (yang bersyarat dibungkus <View>
 * kosong): 0 kartu ringkas · 1 baris tombol (Jadwalkan + 🔁) · 2 FormError ·
 * 3 Akan Datang · 4 judul Anggota · 5 daftar Anggota. Menyisipkan anak baru DI
 * ATAS nomor 4 berarti angka di sini ikut digeser. Ditaruh di luar komponen
 * supaya bukan array baru tiap render.
 *
 * Tab gengnya sendiri TIDAK di sini: ia berdiri di luar gulungan (lihat di
 * bawah), jadi ia tak pernah hilang — bukan cuma menempel sampai judul
 * berikutnya mendorongnya pergi, yang justru yang terjadi kalau dua judul
 * sama-sama dipatok.
 */
const STICKY_HEADERS = [4];

// Sub-tab Fun Futsal ⚽ — pengurus futsal rutin, dari sisi MANAGER.
//
// Satu geng dilihat sekali jalan: kapan main lagi, siapa yang ikut, siapa yang
// belum setor, dan siapa yang paling tajam. Rinciannya (absen, setoran, score
// tiap game) ada di layar sesinya sendiri supaya daftar ini tetap enteng
// dibaca — lihat app/futsal/[id].tsx.
export function FutsalTab({
  data,
  gang,
  onGangChange,
}: {
  data: FutsalData;
  /**
   * Geng yang sedang dibuka. Tinggal di LAYARNYA (app/friends.tsx), bukan di
   * sini, karena tombol 🏅 di pojok header harus tahu papan geng mana yang
   * dibukanya — dan header itu milik layar, bukan milik sub-tab ini.
   */
  gang: FutsalGangKey;
  onGangChange: (gang: FutsalGangKey) => void;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const now = new Date();
  const todayId = toDayId(now);

  const meta = gangMeta(gang);
  const { busy, formError, setFormError, save, remove } = useFormSave();

  // Formulir jadwal main — isinya di hooks/useFutsalSessionForm.ts, dipakai
  // bareng halaman Jadwal Main supaya menjadwalkan & mengubah terasa sama.
  const formSesi = useFutsalSessionForm(data, gang);

  // ----- Form anggota -----
  const [orangOpen, setOrangOpen] = useState(false);
  const [editOrang, setEditOrang] = useState<FutsalMember | null>(null);
  const [fNama, setFNama] = useState('');
  const [fHp, setFHp] = useState('');
  const [fPosisi, setFPosisi] = useState<FutsalPosition>('flank');
  const [fCatatanOrang, setFCatatanOrang] = useState('');

  // Daftar anggota TERTUTUP saat sub-tab ini dibuka. Isinya jarang berubah
  // (geng yang sama main berbulan-bulan), sedangkan yang dicari tiap kali masuk
  // ke sini justru yang di bawahnya: kas & riwayat main. Membiarkannya terbuka
  // berarti 15 baris nama mendorong keduanya jauh ke bawah setiap saat.
  const [anggotaOpen, setAnggotaOpen] = useState(false);

  const anggota = gangMembers(data, gang);
  const berikut = nextSession(data.sessions, gang, todayId);
  const akanDatang = upcomingSessions(data.sessions, gang, todayId);
  const terakhir = lastSession(data.sessions, gang);

  const bukaRincian = (s: FutsalSession) =>
    router.push({ pathname: '/futsal/[id]', params: { id: s.id } });

  // Anggota punya paginasinya sendiri, dan sengaja tidak ikut ke dalam `key`
  // ScrollView-nya: ganti halaman anggota tidak boleh melempar layar ke atas,
  // karena daftar yang sedang kamu baca ada di tengah halaman.
  const orang = usePagination(anggota);

  // ===================== Anggota =====================

  function bukaOrangBaru() {
    setEditOrang(null);
    setFNama('');
    setFHp('');
    setFPosisi('flank');
    setFCatatanOrang('');
    setFormError(null);
    setOrangOpen(true);
  }

  function bukaOrangUbah(m: FutsalMember) {
    setEditOrang(m);
    setFNama(m.name);
    setFHp(m.phone);
    setFPosisi(m.position);
    setFCatatanOrang(m.note);
    setFormError(null);
    setOrangOpen(true);
  }

  async function simpanOrang() {
    if (!user || busy) return;
    if (!fNama.trim()) {
      setFormError('Namanya diisi dulu ya.');
      return;
    }
    const isi: FutsalMember = {
      id: editOrang?.id ?? newFutsalId(now),
      gang,
      name: fNama.trim(),
      phone: fHp.trim(),
      position: fPosisi,
      note: fCatatanOrang.trim(),
    };
    await save(async () => {
      await saveFutsal(user.uid, {
        ...data,
        members: editOrang
          ? data.members.map((m) => (m.id === editOrang.id ? isi : m))
          : [...data.members, isi],
      });
      setOrangOpen(false);
    });
  }

  /**
   * Hapus anggota PERMANEN — sekaligus dicabut dari squad & daftar setoran
   * tiap sesi. Kalau tidak, id-nya menggantung: sesi lama akan menghitung
   * orang yang sudah tidak ada sebagai "belum setor" selamanya.
   */
  async function hapusOrang() {
    if (!user || !editOrang || busy) return;
    await remove(async () => {
      await saveFutsal(user.uid, {
        ...data,
        members: data.members.filter((m) => m.id !== editOrang.id),
        sessions: data.sessions.map((s) => ({
          ...s,
          squad: s.squad.filter((id) => id !== editOrang.id),
          paid: s.paid.filter((id) => id !== editOrang.id),
          games: s.games.map((g) => ({
            ...g,
            scorers: g.scorers.filter((id) => id !== editOrang.id),
          })),
        })),
      });
      setOrangOpen(false);
    });
  }

  return (
    <View style={styles.flex}>
      {/* Judul "👥 Anggota" DIPATOK di atas selama daftarnya digulung — jadi
          tombol tutupnya tetap terjangkau tanpa menggulung balik melewati
          selusin kartu nama dulu. Pola & alasannya sama dengan tab Leaders di
          CORE.

          `stickyHeaderIndices` menghitung ANAK LANGSUNG ScrollView, jadi
          jumlahnya tidak boleh berubah-ubah. Karena itu tiap bagian bersyarat
          di bawah dibungkus <View> yang SELALU ada (isinya saja yang kosong) —
          ditulis `{syarat && …}` telanjang, anaknya lenyap saat syaratnya
          salah dan nomor patokannya meleset ke elemen lain. */}
      {/* Tab geng berdiri DI LUAR gulungan: ia tak ikut bergerak sama sekali,
          jadi berpindah geng selalu satu klik dari mana pun kamu berhenti
          membaca. Keterangan kecil di bawah namanya dibuang — yang dicari di
          deretan ini cuma "aku sedang di geng mana". */}
      <GangTabs value={gang} onChange={onGangChange} gap={8} />

      <ScrollView
        key={gang}
        contentContainerStyle={styles.content}
        stickyHeaderIndices={STICKY_HEADERS}>
        {/* Kartu utama: pertandingan berikutnya. Inilah satu-satunya hal yang
            benar-benar ditanya semua orang di grup — dan diklik, ia membuka
            rincian sesinya, sama seperti kartu di daftar bawah. Kartu besar
            berisi jadwal yang tidak bisa diklik itu justru yang bikin orang
            menggulung ke bawah mencari kartu kecilnya. */}
        <PressableScale
          disabled={!berikut}
          onPress={() => berikut && bukaRincian(berikut)}>
          <SummaryCard>
          <VixText heading="label" additionalStyle={summaryText.label}>
            {meta.emoji} {meta.label} · {meta.desc}
          </VixText>
          {berikut ? (
            <>
              <VixText heading="subheader" additionalStyle={summaryText.value}>
                {formatDayDate(dayIdToDate(berikut.dayId))}
              </VixText>
              <VixText heading="label" additionalStyle={summaryText.label}>
                🕗 {sessionTimeRange(berikut)} · 📍 {berikut.venue || '—'}
              </VixText>
              <VixText heading="label" additionalStyle={summaryText.label}>
                👥 {berikut.squad.length} pemain ·{' '}
                {berikut.fee > 0
                  ? `💵 ${formatRupiah(berikut.fee)}/orang`
                  : 'iuran belum ditentukan'}
              </VixText>
            </>
          ) : (
            <>
              <VixText heading="subheader" additionalStyle={summaryText.value}>
                Belum ada jadwal
              </VixText>
              <VixText heading="label" additionalStyle={summaryText.label}>
                Tentukan jadwal sekarang ⚽
              </VixText>
            </>
          )}
          </SummaryCard>
        </PressableScale>

        {/* Satu baris: tindakan utamanya melebar, jalan pintas 🔁 cuma petak
            kecil di sebelahnya. Ia memang cuma menyalin jadwal terakhir ke
            tanggal berikutnya — tanggalnya masih bisa digeser sebelum disimpan,
            jadi ia tak pantas sebesar tombol utamanya. */}
        <View style={styles.aksiRow}>
          <PrimaryButton
            label="Jadwalkan Main"
            icon="plus"
            onPress={() => formSesi.bukaBaru()}
            additionalStyle={styles.addButton}
          />
          {terakhir && (
            <PressableScale
              style={styles.ulangButton}
              onPress={() => formSesi.bukaBaru(repeatDayId(terakhir.dayId, gang))}
              hitSlop={6}>
              <VixText heading="bold" additionalStyle={styles.ulangText}>
                🔁
              </VixText>
            </PressableScale>
          )}
        </View>

        <FormError message={formSesi.formError ?? formError} gap="top" />

        {/* ===== Akan datang ===== */}
        <View>
          {berikut && (
            <>
              <SectionRow
                title="📅 Jadwal Main Terdekat"
                right={
                  <MiniButton
                    label={`Lihat semua${akanDatang.length > 1 ? ` (${akanDatang.length})` : ''}`}
                    onPress={() => router.push('/futsal-schedule')}
                  />
                }
              />
              <FutsalSessionCard
                s={berikut}
                now={now}
                onOpen={bukaRincian}
                onEdit={formSesi.bukaUbah}
              />
            </>
          )}
        </View>

        {/* ===== Anggota ===== (judulnya DIPATOK — lihat STICKY_HEADERS) */}
        <SectionToggle
          title={`👥 Anggota (${anggota.length})`}
          open={anggotaOpen}
          onToggle={() => setAnggotaOpen((v) => !v)}
          right={<MiniButton label="+ Tambah" onPress={bukaOrangBaru} />}
        />

        <View>
          {anggotaOpen &&
            (anggota.length === 0 ? (
              <VixText heading="label" additionalStyle={styles.empty}>
                Tambah anggota {meta.label}.
              </VixText>
            ) : (
              <>
                {/* Urut abjad nama — lihat gangMembers di lib/futsal.ts. */}
                {orang.pageItems.map((m) => {
                  const pos = positionMeta(m.position);
                  return (
                    <View key={m.id} style={styles.orangRow}>
                      <View style={styles.orangMain}>
                        <VixText heading="bold" additionalStyle={styles.orangNama}>
                          {pos.emoji} {m.name}
                        </VixText>
                        <VixText heading="label">
                          {pos.label}
                          {m.phone ? ` · ${m.phone}` : ' · nomor belum diisi'}
                        </VixText>
                        {m.note ? (
                          <VixText heading="label" additionalStyle={styles.orangNote}>
                            {m.note}
                          </VixText>
                        ) : null}
                      </View>
                      <EditButton onPress={() => bukaOrangUbah(m)} />
                    </View>
                  );
                })}
                <Pagination
                  page={orang.currentPage}
                  pageCount={orang.pageCount}
                  onChange={orang.setPage}
                />
              </>
            ))}
        </View>

        {/* Papan top score & papan paling rajin datang PINDAH ke halaman
            sendiri — pintunya tombol 🏅 di pojok header (app/futsal-board.tsx).
            Dulu ia menumpang di sini, terjepit antara daftar anggota & riwayat
            main, jadi baru terbaca sesudah menggulung melewati keduanya. */}

        {/* Riwayat main PINDAH ke halaman Jadwal Main ("Lihat semua"): satu
            tempat untuk seluruh daftar pertandingan, yang akan datang maupun
            yang sudah lewat. Di sini ia cuma mendorong anggota & kas jauh ke
            bawah, padahal yang dibuka tiap hari justru keduanya. */}
      </ScrollView>

      {/* ===== Sheet jadwal main ===== */}
      <FutsalSessionSheet form={formSesi} gang={gang} />

      {/* ===== Sheet anggota ===== */}
      <SheetModal
        visible={orangOpen}
        title={editOrang ? 'Ubah Anggota' : 'Tambah Anggota'}
        subtitle={`${meta.emoji} ${meta.label}`}
        onClose={() => setOrangOpen(false)}
        footer={
          <DualButtons
            confirmLabel="Simpan"
            busy={busy}
            onCancel={() => setOrangOpen(false)}
            onConfirm={simpanOrang}
          />
        }>
        <FormInput
          placeholder="Nama"
          value={fNama}
          onChangeText={setFNama}
          editable={!busy}
          autoFocus
        />
        <FormInput
          style={styles.formGap}
          placeholder="Nomor HP (mis. 081234567890)"
          keyboardType="phone-pad"
          value={fHp}
          onChangeText={(t) => setFHp(localPhone(t))}
          editable={!busy}
        />

        <VixText heading="label" additionalStyle={[styles.fieldLabel, styles.formGap]}>
          Posisi
        </VixText>
        <SelectField
          value={fPosisi}
          options={FUTSAL_POSITIONS.map((p) => ({
            key: p.key,
            label: `${p.emoji} ${p.label}`,
            sub: p.tugas,
          }))}
          onChange={(key) => key && setFPosisi(key)}
        />

        <FormInput
          style={styles.formGap}
          placeholder="Catatan orang tersebut"
          value={fCatatanOrang}
          onChangeText={setFCatatanOrang}
          editable={!busy}
        />

        <FormError message={formError} gap="top" />
        {editOrang && (
          <InlineDelete
            key={editOrang.id}
            label="Hapus anggota ini"
            busy={busy}
            onDelete={hapusOrang}
          />
        )}
      </SheetModal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 28 },
  aksiRow: { flexDirection: 'row', alignItems: 'stretch', gap: 8, marginBottom: 8 },
  addButton: { flex: 1 },
  // Tombol ulangi: petak bergaris di ujung baris — jalan pintas, bukan
  // tindakan utamanya.
  ulangButton: {
    width: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Color.FRIENDS_DARK,
  },
  ulangText: { color: Color.FRIENDS_DARK },
  empty: { textAlign: 'center', marginVertical: 10 },
  // Baris anggota.
  orangRow: {
    ...CARD,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  orangMain: { flex: 1, minWidth: 0, gap: 1 },
  orangNama: { color: Color.TEXT_TITLE },
  orangNote: { color: Color.TEXT_PLACEHOLDER },
  fieldLabel: { marginBottom: 6 },
  formGap: { marginTop: 10 },
});
