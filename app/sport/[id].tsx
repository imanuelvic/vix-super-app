import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CARD } from '@/assets/style/card';
import { Color } from '@/assets/style/color';
import { SECTION_SPACE } from '@/assets/style/section';
import { CheckCircle } from '@/components/common/CheckCircle';
import { DualButtons } from '@/components/common/DualButtons';
import { FormError } from '@/components/common/FormError';
import { FormInput } from '@/components/common/FormInput';
import { InlineDelete } from '@/components/common/InlineDelete';
import { LoadingCenter } from '@/components/common/LoadingCenter';
import { PressableScale } from '@/components/common/PressableScale';
import { SectionToggle } from '@/components/common/SectionToggle';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { ScreenError } from '@/components/common/ScreenError';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { SheetModal } from '@/components/common/SheetModal';
import { SummaryCard, summaryText } from '@/components/common/SummaryCard';
import { VixText } from '@/components/common/VixText';
import { useAuth } from '@/contexts/auth';
import { useFormSave } from '@/hooks/useFormSave';
import { useSportData } from '@/hooks/useSportData';
import { dayIdToDate, formatDayDate, formatShortDayDate } from '@/lib/format';
import { SAVE_ERROR } from '@/lib/messages';
import {
    gangMembers,
    gangMeta,
    newSportId,
    positionMeta,
    saveSport,
    sessionCashIn,
    sessionDueTotal,
    sessionPaidTotal,
    sessionTotal,
    sessionUnpaidCount,
    squadOrder,
    type SportCashEntry,
    type SportGame,
    type SportMember,
    type SportSession,
} from '@/lib/sport';
import { formatRupiah } from '@/lib/transactions';
import { openWhatsAppChat, WHATSAPP_ERROR } from '@/lib/whatsapp';

// Nomor anak ScrollView yang DIPATOK: judul "Squad & Setoran".
// Menghitung ANAK LANGSUNG — karena itu tiap bagian di bawah dibungkus satu
// View, termasuk yang isinya bersyarat: `{cond && …}` yang bernilai false
// menghilang dari daftar anak dan menggeser semua nomor sesudahnya.
const STICKY_HEADERS = [1];

// Rincian satu sesi futsal ⚽ — ruang kerja managernya.
//
// Tiga hal yang cuma bisa diurus di sini, dan sengaja TIDAK ditaruh di daftar
// sub-tab Sport supaya daftarnya tetap enteng dibaca:
//   1. Squad & setoran — siapa jadi ikut, siapa yang sudah bayar.
//   2. Uang — total, yang masuk, dan sisa yang masih nyangkut di orang.
//   3. Score tiap game + siapa yang mencetak golnya (dasar papan top score).
export default function SportSessionScreen() {
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data, error, setError } = useSportData();
  const { busy, formError, setFormError, save, remove } = useFormSave();

  // Form game.
  const [gameOpen, setGameOpen] = useState(false);
  const [editGame, setEditGame] = useState<SportGame | null>(null);
  const [fTimA, setFTimA] = useState('Rompi');
  const [fTimB, setFTimB] = useState('Non-Rompi');
  const [fSkorA, setFSkorA] = useState('0');
  const [fSkorB, setFSkorB] = useState('0');
  const [fPencetak, setFPencetak] = useState<string[]>([]);

  // Form catatan.
  const [catatanOpen, setCatatanOpen] = useState(false);

  // Daftar squad terbuka? Bawaannya TERBUKA — beda dengan bagian buka-tutup
  // lain di app ini, dan itu disengaja: halaman ini dibuka justru UNTUK daftar
  // ini (mencentang setoran & menagih). Kalau tertutup, yang tersaji cuma dua
  // baris ringkasan dan tiap kali harus dibuka dulu.
  const [squadOpen, setSquadOpen] = useState(true);
  const [fCatatan, setFCatatan] = useState('');

  const sesi = data?.sessions.find((s) => s.id === id) ?? null;

  if (data === null) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader backLabel="Friends" title="Futsal ⚽" />
        <LoadingCenter />
      </SafeAreaView>
    );
  }

  if (!sesi) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader backLabel="Friends" title="Futsal ⚽" />
        <ScreenError message={error} />
        <VixText heading="label" additionalStyle={styles.empty}>
          Jadwal ini sudah tidak ada.
        </VixText>
      </SafeAreaView>
    );
  }

  const meta = gangMeta(sesi.gang);
  // Bawaannya urut abjad nama (lewat `gangMembers`) — urutan tambahnya sendiri
  // tak berarti apa-apa buat siapa pun. Baris "Squad & Setoran" memakai urutan
  // itu lagi, cuma dikelompokkan ulang menurut status setorannya.
  const anggota = gangMembers(data, sesi.gang);
  const barisSquad = squadOrder(anggota, sesi);
  // Baris kecil di bawah judulnya — ia MERINGKAS yang sedang disembunyikan,
  // jadi menutup daftarnya tidak berarti kehilangan kabar terpentingnya.
  const belumSetor = sessionUnpaidCount(sesi);
  const ringkasSquad = `${sesi.squad.length} main${
    belumSetor > 0 ? ` · ${belumSetor} belum setor` : sesi.squad.length > 0 ? ' · lunas semua ✅' : ''
  }`;
  const total = sessionTotal(sesi);
  const masuk = sessionPaidTotal(sesi);
  const kurang = sessionDueTotal(sesi);
  // Berapa dari uang yang sudah terkumpul itu SUDAH tercatat di kas geng, dan
  // berapa yang belum. Tombol setornya cuma menawarkan selisihnya — jadi yang
  // telat bayar tetap bisa disusulkan, tanpa satu rupiah pun terhitung dua kali.
  const keKas = sessionCashIn(data, sesi.id);
  const belumKeKas = masuk - keKas;

  /**
   * Tulis ulang sesi ini di dalam dokumen bersamanya.
   *
   * Penjagaan `!data || !sesi` diulang di sini walau di atas sudah dijaga:
   * TypeScript tidak membawa penyempitan itu masuk ke dalam fungsi, dan
   * memaksanya dengan `!` berarti membuang jaring pengaman yang sesungguhnya
   * (dokumennya bisa terhapus dari perangkat lain selagi layar ini terbuka).
   */
  async function simpanSesi(ubah: (s: SportSession) => SportSession) {
    if (!user || !data || !sesi) return;
    const berikutnya = ubah(sesi);
    await saveSport(user.uid, {
      ...data,
      sessions: data.sessions.map((s) =>
        s.id === berikutnya.id ? berikutnya : s,
      ),
    });
  }

  /**
   * Ikut / tidak ikut main.
   *
   * Setorannya TIDAK ikut dicabut: batal main bukan berarti uangnya ditarik
   * kembali. Kalau memang belum menyetor, centang setorannya toh sudah kosong;
   * kalau sudah, mencabutnya diam-diam berarti kas kehilangan uang yang
   * sebenarnya ada di tanganmu.
   */
  async function toggleIkut(m: SportMember) {
    if (!sesi) return;
    const ikut = sesi.squad.includes(m.id);
    try {
      await simpanSesi((s) => ({
        ...s,
        squad: ikut ? s.squad.filter((x) => x !== m.id) : [...s.squad, m.id],
      }));
    } catch {
      setError(SAVE_ERROR);
    }
  }

  /** Sudah setor / belum — boleh dicentang walau ia tidak ikut main. */
  async function toggleLunas(m: SportMember) {
    if (!sesi) return;
    const lunas = sesi.paid.includes(m.id);
    try {
      await simpanSesi((s) => ({
        ...s,
        paid: lunas ? s.paid.filter((x) => x !== m.id) : [...s.paid, m.id],
      }));
    } catch {
      setError(SAVE_ERROR);
    }
  }

  function tagih(m: SportMember) {
    if (!sesi) return;
    if (!m.phone) {
      setError('Nomor HP-nya belum diisi — isi dulu di daftar anggota.');
      return;
    }
    const pesan =
      `Halo ${m.name} 👋 Iuran futsal ${meta.label} ` +
      `${formatDayDate(dayIdToDate(sesi.dayId))} di ${sesi.venue} ` +
      `sebesar ${formatRupiah(sesi.fee)} belum masuk ya. Makasih! ⚽`;
    openWhatsAppChat(m.phone, pesan, () => setError(WHATSAPP_ERROR));
  }

  // ===================== Game =====================

  function bukaGameBaru() {
    setEditGame(null);
    setFTimA('Rompi');
    setFTimB('Non-Rompi');
    setFSkorA('0');
    setFSkorB('0');
    setFPencetak([]);
    setFormError(null);
    setGameOpen(true);
  }

  function bukaGameUbah(g: SportGame) {
    setEditGame(g);
    setFTimA(g.teamA);
    setFTimB(g.teamB);
    setFSkorA(String(g.scoreA));
    setFSkorB(String(g.scoreB));
    setFPencetak(g.scorers);
    setFormError(null);
    setGameOpen(true);
  }

  /** Satu click = satu gol. Click lagi = gol berikutnya untuk orang yang sama. */
  function tambahGol(m: SportMember) {
    setFPencetak((list) => [...list, m.id]);
  }

  function kurangiGol(m: SportMember) {
    setFPencetak((list) => {
      const i = list.lastIndexOf(m.id);
      return i === -1 ? list : [...list.slice(0, i), ...list.slice(i + 1)];
    });
  }

  async function simpanGame() {
    if (!user || busy) return;
    const isi: SportGame = {
      id: editGame?.id ?? newSportId(new Date()),
      teamA: fTimA.trim() || 'Tim A',
      teamB: fTimB.trim() || 'Tim B',
      scoreA: Math.max(0, parseInt(fSkorA, 10) || 0),
      scoreB: Math.max(0, parseInt(fSkorB, 10) || 0),
      scorers: fPencetak,
    };
    await save(async () => {
      await simpanSesi((s) => ({
        ...s,
        games: editGame
          ? s.games.map((g) => (g.id === editGame.id ? isi : g))
          : [...s.games, isi],
      }));
      setGameOpen(false);
    });
  }

  async function hapusGame() {
    if (!user || !editGame || busy) return;
    await remove(async () => {
      await simpanSesi((s) => ({
        ...s,
        games: s.games.filter((g) => g.id !== editGame.id),
      }));
      setGameOpen(false);
    });
  }

  /**
   * Pindahkan iuran yang sudah terkumpul ke kas geng.
   *
   * Barisnya ditandai `sessionId`, dan yang ditulis cuma SELISIH terhadap yang
   * sudah pernah disetor — dua penjagaan untuk satu masalah yang sama: uang
   * yang sama tidak boleh masuk kas dua kali, sekalipun tombolnya ditekan lagi
   * setelah ada yang telat bayar.
   */
  async function setorKeKas() {
    if (!user || !data || !sesi || busy || belumKeKas <= 0) return;
    const baris: SportCashEntry = {
      id: newSportId(new Date()),
      gang: sesi.gang,
      dayId: sesi.dayId,
      title: `Iuran main ${formatShortDayDate(dayIdToDate(sesi.dayId))}`,
      direction: 'in',
      amount: belumKeKas,
      note: sesi.venue,
      sessionId: sesi.id,
    };
    await save(async () => {
      await saveSport(user.uid, { ...data, cash: [...data.cash, baris] });
    });
  }

  async function simpanCatatan() {
    if (!user || busy) return;
    await save(async () => {
      await simpanSesi((s) => ({ ...s, note: fCatatan.trim() }));
      setCatatanOpen(false);
    });
  }

  // Berapa gol orang ini di game yang sedang diisi.
  const golDi = (id: string) => fPencetak.filter((x) => x === id).length;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        backLabel="Friends"
        title={`${meta.emoji} ${meta.label}`}
        subtitle={`${formatDayDate(dayIdToDate(sesi.dayId))} · ${sesi.time}`}
      />

      <ScreenError message={error} />

      <ScrollView
        contentContainerStyle={styles.content}
        stickyHeaderIndices={STICKY_HEADERS}>
        {/* 0 — uang: ringkasan + tombol setor ke kas. Dibungkus SATU View
            supaya nomor patokan di bawah tidak bergeser saat tombol kasnya
            muncul/menghilang. */}
        <View>
          {/* ===== Uang ===== */}
          <SummaryCard>
            <VixText heading="label" additionalStyle={summaryText.label}>
              📍 {sesi.venue || 'Lapangan belum ditentukan'}
            </VixText>
            <VixText heading="subheader" additionalStyle={summaryText.value}>
              {formatRupiah(masuk)} / {formatRupiah(total)}
            </VixText>
            <VixText heading="label" additionalStyle={summaryText.label}>
              {kurang > 0
                ? `Kurang ${formatRupiah(kurang)} dari ${belumSetor} orang`
                : sesi.squad.length > 0
                  ? 'Semua sudah setor ✅'
                  : 'Belum ada yang ikut main'}
            </VixText>
          </SummaryCard>

          {/* Uang yang sudah terkumpul masih ada di tanganmu sampai dipindahkan
              ke kas geng. Tanpa tombol ini kamu harus mengetik ulang angkanya di
              halaman Kas — dan angka yang diketik ulang itulah yang biasanya
              meleset. */}
          {masuk > 0 && (
            <>
              {belumKeKas > 0 ? (
                <PressableScale
                  style={styles.kasButton}
                  onPress={setorKeKas}
                  disabled={busy}>
                  <VixText heading="bold" additionalStyle={styles.kasButtonText}>
                    💰 Setor {formatRupiah(belumKeKas)} ke Kas {meta.label}
                  </VixText>
                </PressableScale>
              ) : (
                <VixText heading="label" additionalStyle={styles.kasDone}>
                  ✅ {formatRupiah(keKas)} dari sesi ini sudah masuk kas {meta.label}.
                </VixText>
              )}
              <FormError message={formError} gap="top" />
            </>
          )}

        </View>

        {/* 1 — judul Squad & Setoran, DIPATOK di atas (lihat STICKY_HEADERS).
            Daftarnya panjang (sampai 19 orang), jadi setelah menggulung
            beberapa layar judulnya sudah lama hilang — dan bersamanya tombol
            tutupnya. Dipatok, ia tetap terjangkau di mana pun kamu berhenti. */}
        <SectionToggle
          title="👥 Squad & Setoran"
          sub={ringkasSquad}
          open={squadOpen}
          onToggle={() => setSquadOpen((v) => !v)}
        />

        {/* 2 — isinya. */}
        <View>
          {squadOpen &&
            (anggota.length === 0 ? (
              <VixText heading="label" additionalStyle={styles.empty}>
                Belum ada anggota {meta.label} — tambahkan dulu di sub-tab Sport.
              </VixText>
            ) : (
              barisSquad.map((m) => {
                const ikut = sesi.squad.includes(m.id);
                const lunas = sesi.paid.includes(m.id);
                const pos = positionMeta(m.position);
                return (
                  <View
                    key={m.id}
                    style={[styles.row, !ikut && styles.rowOff, lunas && styles.rowPaid]}>
                    <PressableScale
                      onPress={() => toggleIkut(m)}
                      hitSlop={6}
                      haptic={ikut ? 'light' : 'success'}>
                      <CheckCircle checked={ikut} />
                    </PressableScale>

                    <View style={styles.rowMain}>
                      <VixText heading="bold" additionalStyle={styles.rowName}>
                        {pos.emoji} {m.name}
                      </VixText>
                      <VixText heading="label">
                        {lunas
                          ? `✅ Sudah setor ${formatRupiah(sesi.fee)}${
                              ikut ? '' : ' — walau tidak ikut main'
                            }`
                          : ikut
                            ? `💸 Belum setor ${formatRupiah(sesi.fee)}`
                            : 'Tidak ikut main kali ini'}
                      </VixText>
                    </View>

                    {/* Tombol tagih cuma untuk yang IKUT MAIN & belum setor —
                        menagih orang yang tidak jadi main itu salah alamat. */}
                    {ikut && !lunas && (
                      <PressableScale
                        style={styles.tagih}
                        onPress={() => tagih(m)}
                        hitSlop={6}>
                        <VixText heading="label" additionalStyle={styles.tagihText}>
                          💬
                        </VixText>
                      </PressableScale>
                    )}
                    {/* Centang setoran SELALU ada: yang berhalangan datang pun
                        boleh tetap patungan, dan uangnya harus bisa dicatat. */}
                    <PressableScale
                      onPress={() => toggleLunas(m)}
                      hitSlop={6}
                      haptic={lunas ? 'light' : 'success'}>
                      <CheckCircle checked={lunas} />
                    </PressableScale>
                  </View>
                );
              })
            ))}
        </View>

        {/* 3 — sisa layarnya, satu anak juga. */}
        <View>
          {/* ===== Game & score ===== */}
          <VixText heading="title" additionalStyle={styles.sectionTitle}>
            ⚽ Game & Score
          </VixText>
          {sesi.games.length === 0 ? (
            <VixText heading="label" additionalStyle={styles.empty}>
              Belum ada game tercatat.
            </VixText>
          ) : (
            sesi.games.map((g, i) => (
              <PressableScale
                key={g.id}
                style={styles.gameCard}
                onPress={() => bukaGameUbah(g)}>
                <VixText heading="label" additionalStyle={styles.gameNo}>
                  Game {i + 1}
                </VixText>
                <View style={styles.gameRow}>
                  <VixText heading="bold" additionalStyle={styles.gameTim}>
                    {g.teamA}
                  </VixText>
                  <VixText heading="subheader" additionalStyle={styles.gameSkor}>
                    {g.scoreA} – {g.scoreB}
                  </VixText>
                  <VixText heading="bold" additionalStyle={styles.gameTimKanan}>
                    {g.teamB}
                  </VixText>
                </View>
                {g.scorers.length > 0 && (
                  <VixText heading="label" additionalStyle={styles.gamePencetak}>
                    ⚽{' '}
                    {[...new Set(g.scorers)]
                      .map((sid) => {
                        const orang = anggota.find((m) => m.id === sid);
                        const n = g.scorers.filter((x) => x === sid).length;
                        return orang
                          ? `${orang.name}${n > 1 ? ` ×${n}` : ''}`
                          : null;
                      })
                      .filter(Boolean)
                      .join(' · ')}
                  </VixText>
                )}
              </PressableScale>
            ))
          )}
          <PrimaryButton
            label="Catat Game"
            icon="plus"
            onPress={bukaGameBaru}
            additionalStyle={styles.addButton}
          />

          {/* ===== Catatan ===== */}
          <VixText heading="title" additionalStyle={styles.sectionTitle}>
            📝 Catatan
          </VixText>
          <PressableScale
            style={styles.noteCard}
            onPress={() => {
              setFCatatan(sesi.note);
              setFormError(null);
              setCatatanOpen(true);
            }}>
            <VixText
              heading="label"
              additionalStyle={sesi.note ? styles.noteText : styles.notePlaceholder}>
              {sesi.note || 'Belum ada catatan.'}
            </VixText>
          </PressableScale>
        </View>
      </ScrollView>

      {/* ===== Sheet game ===== */}
      <SheetModal
        visible={gameOpen}
        title={editGame ? 'Ubah Game' : 'Catat Game'}
        subtitle="Score & pencetak golnya"
        onClose={() => setGameOpen(false)}
        footer={
          <DualButtons
            confirmLabel="Simpan"
            busy={busy}
            onCancel={() => setGameOpen(false)}
            onConfirm={simpanGame}
          />
        }>
        <View style={styles.timRow}>
          <View style={styles.timKolom}>
            <VixText heading="label" additionalStyle={styles.fieldLabel}>
              Tim kiri
            </VixText>
            <FormInput value={fTimA} onChangeText={setFTimA} editable={!busy} />
            <FormInput
              style={styles.formGap}
              keyboardType="number-pad"
              value={fSkorA}
              onChangeText={(t) => setFSkorA(t.replace(/[^0-9]/g, ''))}
              editable={!busy}
            />
          </View>
          <View style={styles.timKolom}>
            <VixText heading="label" additionalStyle={styles.fieldLabel}>
              Tim kanan
            </VixText>
            <FormInput value={fTimB} onChangeText={setFTimB} editable={!busy} />
            <FormInput
              style={styles.formGap}
              keyboardType="number-pad"
              value={fSkorB}
              onChangeText={(t) => setFSkorB(t.replace(/[^0-9]/g, ''))}
              editable={!busy}
            />
          </View>
        </View>

        <VixText heading="label" additionalStyle={[styles.fieldLabel, styles.formGap]}>
          Pencetak gol
        </VixText>
        <View style={styles.pencetakRow}>
          {anggota
            .filter((m) => sesi.squad.includes(m.id))
            .map((m) => {
              const n = golDi(m.id);
              return (
                <PressableScale
                  key={m.id}
                  style={[styles.pencetak, n > 0 && styles.pencetakOn]}
                  onPress={() => tambahGol(m)}
                  onLongPress={() => kurangiGol(m)}>
                  <VixText
                    heading="label"
                    additionalStyle={n > 0 ? styles.pencetakOnText : styles.pencetakText}>
                    {m.name}
                    {n > 0 ? ` ⚽${n}` : ''}
                  </VixText>
                </PressableScale>
              );
            })}
        </View>

        <FormError message={formError} gap="top" />
        {editGame && (
          <InlineDelete
            key={editGame.id}
            label="Hapus game ini"
            busy={busy}
            onDelete={hapusGame}
          />
        )}
      </SheetModal>

      {/* ===== Sheet catatan ===== */}
      <SheetModal
        visible={catatanOpen}
        title="Catatan"
        onClose={() => setCatatanOpen(false)}
        footer={
          <DualButtons
            confirmLabel="Simpan"
            busy={busy}
            onCancel={() => setCatatanOpen(false)}
            onConfirm={simpanCatatan}
          />
        }>
        <FormInput
          placeholder="Isi catatan yang terjadi saat itu"
          value={fCatatan}
          onChangeText={setFCatatan}
          editable={!busy}
          multiline
          style={styles.noteInput}
        />
        <FormError message={formError} gap="top" />
      </SheetModal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.BACKGROUND },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 },
  sectionTitle: { ...SECTION_SPACE },
  empty: { textAlign: 'center', marginVertical: 10 },
  // Setor ke kas: garis saja, bukan tombol penuh — memindahkan uang ke kas itu
  // langkah lanjutan, bukan tindakan utama layar ini.
  kasButton: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Color.FRIENDS_DARK,
    paddingVertical: 11,
  },
  kasButtonText: { color: Color.FRIENDS_DARK },
  kasDone: { color: Color.SUCCESS, textAlign: 'center' },
  addButton: { marginTop: 8 },
  row: {
    ...CARD,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  rowOff: { opacity: 0.5 },
  rowPaid: { backgroundColor: Color.MAIN_TRANSPARENT, borderColor: Color.MAIN_LIGHT },
  rowMain: { flex: 1, minWidth: 0, gap: 1 },
  rowName: { color: Color.TEXT_TITLE },
  // Tombol tagih: garis tepi hijau WhatsApp — sudah ada di palet, jadi tak
  // perlu warna baru untuk satu tombol.
  tagih: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Color.WHATSAPP,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  tagihText: { color: Color.WHATSAPP },
  // Kartu satu game.
  gameCard: { ...CARD, marginBottom: 8, gap: 4 },
  gameNo: { color: Color.TEXT_PLACEHOLDER },
  gameRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  gameTim: { flex: 1, minWidth: 0, color: Color.TEXT_TITLE },
  gameTimKanan: { flex: 1, minWidth: 0, color: Color.TEXT_TITLE, textAlign: 'right' },
  gameSkor: { color: Color.FRIENDS_DARK },
  gamePencetak: { color: Color.TEXT_LABEL },
  // Catatan.
  noteCard: { ...CARD },
  noteText: { color: Color.TEXT_TITLE },
  notePlaceholder: { color: Color.TEXT_PLACEHOLDER },
  noteInput: { minHeight: 100, textAlignVertical: 'top' },
  // Form game.
  timRow: { flexDirection: 'row', gap: 10 },
  timKolom: { flex: 1, minWidth: 0 },
  fieldLabel: { marginBottom: 6 },
  formGap: { marginTop: 10 },
  pencetakRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pencetak: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Color.BORDER,
    backgroundColor: Color.CONTAINER,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  pencetakOn: { backgroundColor: Color.FRIENDS, borderColor: Color.FRIENDS_DARK },
  pencetakText: { color: Color.TEXT_TITLE },
  pencetakOnText: { color: Color.FRIENDS_DARK },
});
