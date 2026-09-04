import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { CARD } from '@/assets/style/card';
import { Color } from '@/assets/style/color';
import { SECTION_SPACE } from '@/assets/style/section';
import { DualButtons } from '@/components/common/DualButtons';
import { EditButton } from '@/components/common/EditButton';
import { FormError } from '@/components/common/FormError';
import { FormInput } from '@/components/common/FormInput';
import { InlineDelete } from '@/components/common/InlineDelete';
import { Pagination } from '@/components/common/Pagination';
import { PressableScale } from '@/components/common/PressableScale';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { SectionToggle } from '@/components/common/SectionToggle';
import { GangTabs } from '@/components/friends/GangTabs';
import { SelectField } from '@/components/common/SelectField';
import { SheetModal } from '@/components/common/SheetModal';
import { SummaryCard, summaryText } from '@/components/common/SummaryCard';
import { VixText } from '@/components/common/VixText';
import { SportSessionCard } from '@/components/friends/SportSessionCard';
import { SportSessionSheet } from '@/components/friends/SportSessionSheet';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/contexts/auth';
import { useFormSave } from '@/hooks/useFormSave';
import { usePagination } from '@/hooks/usePagination';
import { useSportSessionForm } from '@/hooks/useSportSessionForm';
import {
  dayIdToDate,
  formatDayDate,
  dayId as toDayId,
} from '@/lib/format';
import {
  cashBalance,
  gangMembers,
  gangMeta,
  lastSession,
  newSportId,
  nextSession,
  positionMeta,
  repeatDayId,
  saveSport,
  SPORT_POSITIONS,
  upcomingSessions,
  type SportData,
  type SportGangKey,
  type SportMember,
  type SportPosition,
  type SportSession,
} from '@/lib/sport';
import { localPhone } from '@/lib/phone';
import { formatRupiah } from '@/lib/transactions';

/**
 * Anak ScrollView yang DIPATOK di atas saat digulung: judul "👥 Anggota" (6).
 *
 * Urutan anaknya, dan semuanya SELALU ada (yang bersyarat dibungkus <View>
 * kosong): 0 kartu ringkas · 1 tombol Jadwalkan · 2 tombol Ulangi · 3 FormError ·
 * 4 kartu Kas · 5 Akan Datang · 6 judul Anggota · 7 daftar Anggota. Menyisipkan
 * anak baru DI ATAS nomor 6 berarti angka di sini ikut digeser. Ditaruh di luar
 * komponen supaya bukan array baru tiap render.
 *
 * Tab gengnya sendiri TIDAK di sini: ia berdiri di luar gulungan (lihat di
 * bawah), jadi ia tak pernah hilang — bukan cuma menempel sampai judul
 * berikutnya mendorongnya pergi, yang justru yang terjadi kalau dua judul
 * sama-sama dipatok.
 */
const STICKY_HEADERS = [6];

// Sub-tab Sport ⚽ — pengurus futsal rutin, dari sisi MANAGER.
//
// Satu geng dilihat sekali jalan: kapan main lagi, siapa yang ikut, siapa yang
// belum setor, dan siapa yang paling tajam. Rinciannya (absen, setoran, score
// tiap game) ada di layar sesinya sendiri supaya daftar ini tetap enteng
// dibaca — lihat app/sport/[id].tsx.
export function SportTab({
  data,
  gang,
  onGangChange,
}: {
  data: SportData;
  /**
   * Geng yang sedang dibuka. Tinggal di LAYARNYA (app/friends.tsx), bukan di
   * sini, karena tombol 🏅 di pojok header harus tahu papan geng mana yang
   * dibukanya — dan header itu milik layar, bukan milik sub-tab ini.
   */
  gang: SportGangKey;
  onGangChange: (gang: SportGangKey) => void;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const now = new Date();
  const todayId = toDayId(now);

  const meta = gangMeta(gang);
  const { busy, formError, setFormError, save, remove } = useFormSave();

  // Formulir jadwal main — isinya di hooks/useSportSessionForm.ts, dipakai
  // bareng halaman Jadwal Main supaya menjadwalkan & mengubah terasa sama.
  const formSesi = useSportSessionForm(data, gang);

  // ----- Form anggota -----
  const [orangOpen, setOrangOpen] = useState(false);
  const [editOrang, setEditOrang] = useState<SportMember | null>(null);
  const [fNama, setFNama] = useState('');
  const [fHp, setFHp] = useState('');
  const [fPosisi, setFPosisi] = useState<SportPosition>('flank');
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
  const kas = cashBalance(data, gang);

  const bukaRincian = (s: SportSession) =>
    router.push({ pathname: '/sport/[id]', params: { id: s.id } });

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

  function bukaOrangUbah(m: SportMember) {
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
    const isi: SportMember = {
      id: editOrang?.id ?? newSportId(now),
      gang,
      name: fNama.trim(),
      phone: fHp.trim(),
      position: fPosisi,
      note: fCatatanOrang.trim(),
    };
    await save(async () => {
      await saveSport(user.uid, {
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
      await saveSport(user.uid, {
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
            benar-benar ditanya semua orang di grup. */}
        <SummaryCard style={styles.hero}>
          <VixText heading="label" additionalStyle={summaryText.label}>
            {meta.emoji} {meta.label} · {meta.desc}
          </VixText>
          {berikut ? (
            <>
              <VixText heading="subheader" additionalStyle={summaryText.value}>
                {formatDayDate(dayIdToDate(berikut.dayId))}
              </VixText>
              <VixText heading="label" additionalStyle={summaryText.label}>
                🕗 {berikut.time} · 📍 {berikut.venue || '—'}
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

        <PrimaryButton
          label="Jadwalkan Main"
          icon="plus"
          onPress={() => formSesi.bukaBaru()}
          additionalStyle={styles.addButton}
        />
        <View>
          {terakhir && (
            <PressableScale
              style={styles.ulangButton}
              onPress={() => formSesi.bukaBaru(repeatDayId(terakhir.dayId, gang))}>
              <VixText heading="bold" additionalStyle={styles.ulangText}>
                🔁 Repeat (2 weeks)
              </VixText>
            </PressableScale>
          )}
        </View>

        <FormError message={formSesi.formError ?? formError} gap="top" />

        {/* ===== Kas tim ===== */}
        {/* Uang bersama yang sedang kamu pegang. Ditaruh di atas, bukan di
            dalam menu: saldo yang tak pernah terlihat itu saldo yang tak
            pernah dicocokkan. Rincian & mutasinya di halaman sendiri. */}
        <PressableScale
          style={styles.kasCard}
          onPress={() => router.push('/sport-cash')}>
          <View style={styles.kasMain}>
            <VixText heading="label" additionalStyle={styles.kasLabel}>
              💰 Kas {meta.label}
            </VixText>
            <VixText
              heading="subheader"
              additionalStyle={kas < 0 ? styles.kasMinus : styles.kasNilai}>
              {formatRupiah(kas)}
            </VixText>
          </View>
          <IconSymbol name="chevron.right" size={20} color={Color.FRIENDS_DARK} />
        </PressableScale>

        {/* ===== Akan datang ===== */}
        <View>
          {berikut && (
            <>
              <View style={styles.sectionRow}>
                <VixText heading="title" additionalStyle={styles.sectionTitleFlat}>
                  📅 Jadwal Main Terdekat
                </VixText>
                <PressableScale
                  style={styles.miniButton}
                  onPress={() =>
                    router.push({
                      pathname: '/sport-schedule',
                      params: { gang },
                    })
                  }
                  hitSlop={8}>
                  <VixText heading="bold" additionalStyle={styles.miniButtonText}>
                    Lihat semua{akanDatang.length > 1 ? ` (${akanDatang.length})` : ''}
                  </VixText>
                </PressableScale>
              </View>
              <SportSessionCard
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
          right={
            <PressableScale
              style={styles.miniButton}
              onPress={bukaOrangBaru}
              hitSlop={8}>
              <VixText heading="bold" additionalStyle={styles.miniButtonText}>
                + Tambah
              </VixText>
            </PressableScale>
          }
        />

        <View>
          {anggotaOpen &&
            (anggota.length === 0 ? (
              <VixText heading="label" additionalStyle={styles.empty}>
                Tambah anggota {meta.label}.
              </VixText>
            ) : (
              <>
                {/* Urut abjad nama — lihat gangMembers di lib/sport.ts. */}
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
            sendiri — pintunya tombol 🏅 di pojok header (app/sport-board.tsx).
            Dulu ia menumpang di sini, terjepit antara daftar anggota & riwayat
            main, jadi baru terbaca sesudah menggulung melewati keduanya. */}

        {/* Riwayat main PINDAH ke halaman Jadwal Main ("Lihat semua"): satu
            tempat untuk seluruh daftar pertandingan, yang akan datang maupun
            yang sudah lewat. Di sini ia cuma mendorong anggota & kas jauh ke
            bawah, padahal yang dibuka tiap hari justru keduanya. */}
      </ScrollView>

      {/* ===== Sheet jadwal main ===== */}
      <SportSessionSheet form={formSesi} gang={gang} />

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
          options={SPORT_POSITIONS.map((p) => ({
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
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 28 },
  hero: { marginTop: 10 },
  addButton: { marginBottom: 8 },
  // Tombol ulangi: garis saja, bukan tombol penuh — ini jalan pintas, bukan
  // tindakan utamanya.
  ulangButton: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Color.FRIENDS_DARK,
    paddingVertical: 10,
    marginBottom: 4,
  },
  ulangText: { color: Color.FRIENDS_DARK },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    ...SECTION_SPACE,
  },
  sectionTitleFlat: { flex: 1, minWidth: 0 },
  miniButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Color.FRIENDS_DARK,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  miniButtonText: { color: Color.FRIENDS_DARK },
  empty: { textAlign: 'center', marginVertical: 10 },
  // Kas tim: pastel Friends bergaris tepi, jadi terbaca sebagai PINTU ke
  // halaman lain — beda dari kartu data biasa yang berlatar putih.
  // Bentuknya mengikuti CARD, tapi TIDAK menyebarnya: kartu ini sengaja
  // berwarna lain, dan menimpa warna milik CARD berarti bentuk baku kartu
  // daftar punya pengecualian diam-diam (lihat assets/style/card.ts).
  kasCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: Color.FRIENDS,
    borderColor: Color.FRIENDS_DARK,
  },
  kasMain: { flex: 1, minWidth: 0, gap: 1 },
  kasLabel: { color: Color.FRIENDS_DARK },
  kasNilai: { color: Color.TEXT_TITLE },
  kasMinus: { color: Color.DANGER },
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
