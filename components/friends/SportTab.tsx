import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { CARD } from '@/assets/style/card';
import { Color } from '@/assets/style/color';
import { DateField } from '@/components/common/DateField';
import { DualButtons } from '@/components/common/DualButtons';
import { EditButton } from '@/components/common/EditButton';
import { FormError } from '@/components/common/FormError';
import { FormInput } from '@/components/common/FormInput';
import { InlineDelete } from '@/components/common/InlineDelete';
import { MoneyInput } from '@/components/common/MoneyInput';
import { Pagination } from '@/components/common/Pagination';
import { PressableScale } from '@/components/common/PressableScale';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { SectionToggle } from '@/components/common/SectionToggle';
import { SegmentTabs } from '@/components/common/SegmentTabs';
import { SelectField } from '@/components/common/SelectField';
import { SheetModal } from '@/components/common/SheetModal';
import { SummaryCard, summaryText } from '@/components/common/SummaryCard';
import { TimeField } from '@/components/common/TimeField';
import { VixText } from '@/components/common/VixText';
import { SportSessionCard } from '@/components/friends/SportSessionCard';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/contexts/auth';
import { useFormSave } from '@/hooks/useFormSave';
import { usePagination } from '@/hooks/usePagination';
import {
  dayId as toDayId,
  dayIdToDate,
  formatDayDate,
  groupDigits,
  parseAmount,
} from '@/lib/format';
import {
  cashBalance,
  gangMembers,
  gangMeta,
  lastSession,
  nextSession,
  newSportId,
  pastSessions,
  positionMeta,
  repeatDayId,
  saveSport,
  SPORT_GANGS,
  SPORT_POSITIONS,
  topScorers,
  upcomingSessions,
  type SportData,
  type SportGangKey,
  type SportMember,
  type SportPosition,
  type SportSession,
} from '@/lib/sport';
import { formatRupiah } from '@/lib/transactions';

// Sub-tab Sport ⚽ — pengurus futsal rutin, dari sisi MANAGER.
//
// Satu geng dilihat sekali jalan: kapan main lagi, siapa yang ikut, siapa yang
// belum setor, dan siapa yang paling tajam. Rinciannya (absen, setoran, skor
// tiap game) ada di layar sesinya sendiri supaya daftar ini tetap enteng
// dibaca — lihat app/sport/[id].tsx.
export function SportTab({ data }: { data: SportData }) {
  const router = useRouter();
  const { user } = useAuth();
  const now = new Date();
  const todayId = toDayId(now);

  const [gang, setGang] = useState<SportGangKey>('f3');
  const meta = gangMeta(gang);
  const { busy, formError, setFormError, save, remove } = useFormSave();

  // ----- Form sesi -----
  const [sesiOpen, setSesiOpen] = useState(false);
  const [editSesi, setEditSesi] = useState<SportSession | null>(null);
  const [fTanggal, setFTanggal] = useState(now);
  const [fJam, setFJam] = useState(now);
  const [fVenue, setFVenue] = useState('');
  const [fFee, setFFee] = useState('');
  const [fCatatan, setFCatatan] = useState('');

  // ----- Form anggota -----
  const [orangOpen, setOrangOpen] = useState(false);
  const [editOrang, setEditOrang] = useState<SportMember | null>(null);
  const [fNama, setFNama] = useState('');
  const [fHp, setFHp] = useState('');
  const [fPosisi, setFPosisi] = useState<SportPosition>('flank');
  const [fCatatanOrang, setFCatatanOrang] = useState('');

  // Daftar anggota bisa ditutup — kalau tidak, geng 15 orang mendorong papan
  // skor & riwayat jauh ke bawah tiap kali sub-tab ini dibuka. Terbuka saat
  // pertama kali karena inilah yang paling sering dilihat.
  const [anggotaOpen, setAnggotaOpen] = useState(true);

  const anggota = gangMembers(data, gang);
  const berikut = nextSession(data.sessions, gang, todayId);
  const akanDatang = upcomingSessions(data.sessions, gang, todayId);
  const riwayat = pastSessions(data.sessions, gang, todayId);
  const terakhir = lastSession(data.sessions, gang);
  const papan = topScorers(data, gang).filter((r) => r.goals > 0 || r.caps > 0);
  const kas = cashBalance(data, gang);

  const bukaRincian = (s: SportSession) =>
    router.push({ pathname: '/sport/[id]', params: { id: s.id } });

  // 10 riwayat per halaman — sesi menumpuk terus tiap dua minggu.
  const { currentPage, pageCount, pageItems, setPage } = usePagination(riwayat);
  // Anggota punya paginasinya SENDIRI, dan sengaja tidak ikut ke dalam `key`
  // ScrollView-nya: ganti halaman anggota tidak boleh melempar layar ke atas,
  // karena daftar yang sedang kamu baca ada di tengah halaman.
  const orang = usePagination(anggota);

  // ===================== Sesi =====================

  function bukaSesiBaru(dariTanggal?: string) {
    setEditSesi(null);
    setFTanggal(dariTanggal ? dayIdToDate(dariTanggal) : now);
    // Jam & lapangan & iuran diwarisi dari sesi terakhir: futsal rutin hampir
    // selalu di jam & lapangan yang sama, jadi mengetik ulang tiap dua minggu
    // itu pekerjaan yang tidak perlu ada.
    const j = terakhir?.time ?? '20.00';
    const [jam, menit] = j.split('.').map((n) => Number(n) || 0);
    const t = new Date(now);
    t.setHours(jam, menit, 0, 0);
    setFJam(t);
    setFVenue(terakhir?.venue ?? '');
    setFFee(terakhir?.fee ? groupDigits(String(terakhir.fee)) : '');
    setFCatatan('');
    setFormError(null);
    setSesiOpen(true);
  }

  function bukaSesiUbah(s: SportSession) {
    setEditSesi(s);
    setFTanggal(dayIdToDate(s.dayId));
    const [jam, menit] = s.time.split('.').map((n) => Number(n) || 0);
    const t = new Date(now);
    t.setHours(jam, menit, 0, 0);
    setFJam(t);
    setFVenue(s.venue);
    setFFee(s.fee ? groupDigits(String(s.fee)) : '');
    setFCatatan(s.note);
    setFormError(null);
    setSesiOpen(true);
  }

  async function simpanSesi() {
    if (!user || busy) return;
    if (!fVenue.trim()) {
      setFormError('Lapangannya diisi dulu — itu yang paling sering ditanya di grup.');
      return;
    }
    const jam = `${String(fJam.getHours()).padStart(2, '0')}.${String(
      fJam.getMinutes(),
    ).padStart(2, '0')}`;
    const isi: SportSession = {
      id: editSesi?.id ?? newSportId(now),
      gang,
      dayId: toDayId(fTanggal),
      time: jam,
      venue: fVenue.trim(),
      fee: parseAmount(fFee),
      // Sesi baru: SEMUA anggota geng langsung masuk skuad. Menghapus yang
      // berhalangan jauh lebih cepat daripada mencentang satu per satu, dan
      // absen kosong bikin sesinya terlihat batal padahal belum.
      squad: editSesi?.squad ?? anggota.map((m) => m.id),
      paid: editSesi?.paid ?? [],
      games: editSesi?.games ?? [],
      note: fCatatan.trim(),
    };
    await save(async () => {
      await saveSport(user.uid, {
        ...data,
        sessions: editSesi
          ? data.sessions.map((s) => (s.id === editSesi.id ? isi : s))
          : [...data.sessions, isi],
      });
      setSesiOpen(false);
    });
  }

  async function hapusSesi() {
    if (!user || !editSesi || busy) return;
    await remove(async () => {
      await saveSport(user.uid, {
        ...data,
        sessions: data.sessions.filter((s) => s.id !== editSesi.id),
      });
      setSesiOpen(false);
    });
  }

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
   * Hapus anggota PERMANEN — sekaligus dicabut dari skuad & daftar setoran
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
      <ScrollView key={`${gang}-${currentPage}`} contentContainerStyle={styles.content}>
        <SegmentTabs
          tabs={SPORT_GANGS.map((g) => ({
            key: g.key,
            label: `${g.emoji} ${g.label}`,
            sub: `${data.members.filter((m) => m.gang === g.key).length} orang`,
          }))}
          value={gang}
          onChange={setGang}
        />

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
          onPress={() => bukaSesiBaru()}
          additionalStyle={styles.addButton}
        />
        {terakhir && (
          <PressableScale
            style={styles.ulangButton}
            onPress={() => bukaSesiBaru(repeatDayId(terakhir.dayId, gang))}>
            <VixText heading="bold" additionalStyle={styles.ulangText}>
              🔁 Repeat (2 weeks)
            </VixText>
          </PressableScale>
        )}

        <FormError message={formError} gap="top" />

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
        {berikut && (
          <>
            <View style={styles.sectionRow}>
              <VixText heading="title" additionalStyle={styles.sectionTitleFlat}>
                📅 Akan Datang
              </VixText>
              {/* Yang dipajang di sini cuma yang PALING DEKAT — sisanya di
                  halaman jadwalnya sendiri, supaya anggota & papan skor tidak
                  terdorong jauh ke bawah. */}
              <PressableScale
                style={styles.miniButton}
                onPress={() => router.push('/sport-schedule')}
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
              onEdit={bukaSesiUbah}
            />
          </>
        )}

        {/* ===== Anggota ===== */}
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
          }>
          {anggota.length === 0 ? (
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
          )}
        </SectionToggle>

        {/* ===== Papan top skor ===== */}
        {papan.length > 0 && (
          <>
            <VixText heading="title" additionalStyle={styles.sectionTitle}>
              🥇 Top Skor {meta.label}
            </VixText>
            <View style={styles.papan}>
              {papan.slice(0, 8).map((r, i) => (
                <View key={r.member.id} style={styles.papanRow}>
                  <VixText heading="bold" additionalStyle={styles.papanRank}>
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`}
                  </VixText>
                  <VixText heading="bold" additionalStyle={styles.papanNama}>
                    {r.member.name}
                  </VixText>
                  <VixText heading="label" additionalStyle={styles.papanCaps}>
                    {r.caps}× main
                  </VixText>
                  <VixText heading="bold" additionalStyle={styles.papanGol}>
                    {r.goals} gol
                  </VixText>
                </View>
              ))}
            </View>
          </>
        )}

        {/* ===== Riwayat ===== */}
        {riwayat.length > 0 && (
          <>
            <VixText heading="title" additionalStyle={styles.sectionTitle}>
              🧾 Riwayat Main
            </VixText>
            {pageItems.map((s) => (
              <SportSessionCard
                key={s.id}
                s={s}
                now={now}
                onOpen={bukaRincian}
                onEdit={bukaSesiUbah}
              />
            ))}
            <Pagination
              page={currentPage}
              pageCount={pageCount}
              onChange={setPage}
            />
          </>
        )}
      </ScrollView>

      {/* ===== Sheet sesi ===== */}
      <SheetModal
        visible={sesiOpen}
        title={editSesi ? 'Ubah Jadwal Main' : 'Jadwalkan Main'}
        subtitle={`${meta.emoji} ${meta.label}`}
        onClose={() => setSesiOpen(false)}
        footer={
          <DualButtons
            confirmLabel="Simpan"
            busy={busy}
            onCancel={() => setSesiOpen(false)}
            onConfirm={simpanSesi}
          />
        }>
        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          🗓️ Tanggal main
        </VixText>
        <DateField
          key={editSesi?.id ?? 'baru'}
          value={fTanggal}
          onChange={setFTanggal}
        />

        <View style={styles.formGap}>
          <VixText heading="label" additionalStyle={styles.fieldLabel}>
            🕗 Jam main
          </VixText>
          <TimeField value={fJam} onChange={setFJam} />
        </View>

        <VixText heading="label" additionalStyle={[styles.fieldLabel, styles.formGap]}>
          📍 Lapangan
        </VixText>
        <FormInput
          placeholder="mis. Sunter Futsal — Lapangan 2"
          value={fVenue}
          onChangeText={setFVenue}
          editable={!busy}
        />

        <VixText heading="label" additionalStyle={[styles.fieldLabel, styles.formGap]}>
          💵 Iuran per orang
        </VixText>
        <MoneyInput
          placeholder="mis. 35.000"
          value={fFee}
          onChangeText={(t) => setFFee(groupDigits(t))}
          editable={!busy}
        />

        <FormInput
          style={styles.formGap}
          placeholder="Catatan (bawa rompi, parkir, dll)"
          value={fCatatan}
          onChangeText={setFCatatan}
          editable={!busy}
          multiline
        />

        <FormError message={formError} gap="top" />
        {editSesi && (
          <InlineDelete
            key={editSesi.id}
            label="Hapus jadwal ini"
            busy={busy}
            onDelete={hapusSesi}
          />
        )}
      </SheetModal>

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
          placeholder="Nomor HP (mis. 08123456789)"
          keyboardType="phone-pad"
          value={fHp}
          onChangeText={setFHp}
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
          placeholder="Catatan (kaki kidal, sering telat, dll)"
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
  sectionTitle: { marginTop: 14, marginBottom: 8 },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 14,
    marginBottom: 8,
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
  // Papan top skor.
  papan: { ...CARD, paddingVertical: 4 },
  papanRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  papanRank: { color: Color.FRIENDS_DARK, width: 26, textAlign: 'center' },
  papanNama: { flex: 1, minWidth: 0, color: Color.TEXT_TITLE },
  papanCaps: { color: Color.TEXT_PLACEHOLDER },
  papanGol: { color: Color.FRIENDS_DARK },
  fieldLabel: { marginBottom: 6 },
  formGap: { marginTop: 10 },
});
