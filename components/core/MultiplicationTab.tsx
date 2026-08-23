import { useRouter } from 'expo-router';
import { Timestamp } from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Color } from '@/assets/style/color';
import { Chip } from '@/components/common/Chip';
import { DateField } from '@/components/common/DateField';
import { EditButton } from '@/components/common/EditButton';
import { FormError } from '@/components/common/FormError';
import { FormInput } from '@/components/common/FormInput';
import { LoadingCenter } from '@/components/common/LoadingCenter';
import { PressableScale } from '@/components/common/PressableScale';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { ProgressBar } from '@/components/common/ProgressBar';
import { SheetModal } from '@/components/common/SheetModal';
import { SummaryCard } from '@/components/common/SummaryCard';
import { VixText } from '@/components/common/VixText';
import { useAuth } from '@/contexts/auth';
import { HEARTS } from '@/lib/core';
import { formatFullDate } from '@/lib/format';
import { LOAD_ERROR, SAVE_ERROR } from '@/lib/messages';
import {
  multiProgress,
  multiStatus,
  multiStatusLabel,
  newMultiplicationId,
  saveMultiplication,
  subscribeMultiplications,
  type Multiplication,
} from '@/lib/multiplication';
import { seedMultiplications } from '@/lib/multiplicationSeed';

// Sub-tab 🌱 Multiplication — daftar pemekaran CORE.
//
// Kartunya sengaja RINGKAS (pasangan CORE, kemajuan, tanggal CORE Perdana):
// timeline & pembagian anggotanya panjang, jadi tempatnya di layar sendiri
// (app/multiplication/[id].tsx) yang dibuka dengan menekan kartunya.
export function MultiplicationTab() {
  const router = useRouter();
  const { user } = useAuth();

  const [list, setList] = useState<Multiplication[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form buat/ubah keterangan satu multiplikasi.
  const [editing, setEditing] = useState<Multiplication | 'new' | null>(null);
  const [fFrom, setFFrom] = useState('');
  const [fFromHeart, setFFromHeart] = useState(HEARTS[0]);
  const [fTo, setFTo] = useState('');
  const [fToHeart, setFToHeart] = useState(HEARTS[1]);
  const [fMeeting, setFMeeting] = useState(new Date());
  const [fFirst, setFFirst] = useState(new Date());
  const [fDay, setFDay] = useState('');
  const [fPlace, setFPlace] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    return subscribeMultiplications(user.uid, setList, () =>
      setError(LOAD_ERROR),
    );
  }, [user]);

  // Isi awal SEKALI: catatan multiplikasi lamamu (timeline + pembagian
  // anggota) dipindahkan dari spreadsheet ke sini saat daftarnya masih benar-
  // benar kosong. Sesudah itu datanya milik Firestore — dihapus pun tidak akan
  // ditulis ulang, karena syaratnya "kosong" tidak lagi terpenuhi setelah kamu
  // menyentuhnya. Ref = penjaga supaya tidak menulis dua kali dalam satu sesi.
  const seeded = useRef(false);
  useEffect(() => {
    if (!user || list === null || list.length > 0 || seeded.current) return;
    seeded.current = true;
    Promise.all(
      seedMultiplications(new Date()).map((m) => saveMultiplication(user.uid, m)),
    ).catch(() => {
      seeded.current = false; // gagal (offline) → boleh dicoba lagi nanti
    });
  }, [user, list]);

  function openAdd() {
    setEditing('new');
    setFFrom('');
    setFFromHeart(HEARTS[0]);
    setFTo('');
    setFToHeart(HEARTS[1]);
    setFMeeting(new Date());
    setFFirst(new Date());
    setFDay('');
    setFPlace('');
    setFormError(null);
  }

  function openEdit(m: Multiplication) {
    setEditing(m);
    setFFrom(m.fromName);
    setFFromHeart(m.fromHeart || HEARTS[0]);
    setFTo(m.toName);
    setFToHeart(m.toHeart || HEARTS[1]);
    setFMeeting(m.meetingDate?.toDate() ?? new Date());
    setFFirst(m.firstCoreDate?.toDate() ?? new Date());
    setFDay(m.day);
    setFPlace(m.place);
    setFormError(null);
  }

  async function handleSave() {
    if (!user || !editing || busy) return;
    if (!fFrom.trim() || !fTo.trim()) {
      setFormError('Isi nama CORE asal & CORE barunya dulu.');
      return;
    }
    setBusy(true);
    setFormError(null);
    const base =
      editing === 'new'
        ? {
            id: newMultiplicationId(),
            steps: [],
            members: [],
            createdAt: Date.now(),
          }
        : { id: editing.id, steps: editing.steps, members: editing.members, createdAt: editing.createdAt };
    try {
      await saveMultiplication(user.uid, {
        ...base,
        fromName: fFrom.trim(),
        fromHeart: fFromHeart,
        toName: fTo.trim(),
        toHeart: fToHeart,
        meetingDate: Timestamp.fromDate(fMeeting),
        firstCoreDate: Timestamp.fromDate(fFirst),
        day: fDay.trim(),
        place: fPlace.trim(),
      });
      setEditing(null);
    } catch {
      setFormError(SAVE_ERROR);
    } finally {
      setBusy(false);
    }
  }

  const running = (list ?? []).filter((m) => multiStatus(m) === 'running');
  const done = (list ?? []).filter((m) => multiStatus(m) === 'done');

  return (
    <View style={styles.flex}>
      {list === null ? (
        <LoadingCenter />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <SummaryCard
            label="🌱 Multiplikasi CORE"
            value={
              list.length === 0 ? 'Belum ada' : `${list.length} multiplikasi`
            }
            sub={`${done.length} selesai · ${running.length} sedang berjalan`}
          />

          <PrimaryButton
            label="Buat Multiplikasi"
            icon="plus"
            onPress={openAdd}
            additionalStyle={styles.addButton}
          />

          <FormError message={error} />

          {list.length === 0 ? (
            <VixText heading="label" additionalStyle={styles.empty}>
              Belum ada catatan pemekaran. Tekan “Buat Multiplikasi” untuk mulai
              menyusun timeline & pembagian anggotanya 🌱
            </VixText>
          ) : (
            list.map((m, i) => {
              const { done: sDone, total } = multiProgress(m);
              const status = multiStatus(m);
              return (
                <Animated.View
                  key={m.id}
                  entering={FadeInDown.delay(i * 50).duration(280)}>
                  {/* Tekan kartu → layar timeline & anggotanya. Tombol ✏️
                      jadi SAUDARA area ketuk, bukan anaknya — Pressable
                      bersarang di iOS bikin ketukannya ikut membuka layar. */}
                  <View style={styles.card}>
                    <View style={styles.cardRow}>
                      <PressableScale
                        style={styles.cardMain}
                        onPress={() =>
                          router.push({
                            pathname: '/multiplication/[id]',
                            params: { id: m.id },
                          })
                        }>
                        <VixText heading="bold" additionalStyle={styles.pair}>
                          {m.fromHeart} CORE {m.fromName} → {m.toHeart} CORE{' '}
                          {m.toName}
                        </VixText>
                        {m.firstCoreDate && (
                          <VixText heading="label">
                            🎉 CORE Perdana:{' '}
                            {formatFullDate(m.firstCoreDate.toDate())}
                          </VixText>
                        )}
                        <VixText heading="label" additionalStyle={styles.meta}>
                          📆 {sDone}/{total} langkah · 👥 {m.members.length}{' '}
                          anggota
                        </VixText>
                        <View style={styles.bar}>
                          <ProgressBar
                            value={sDone}
                            total={total}
                            color={
                              status === 'done' ? Color.MAIN : Color.MAIN_LIGHT
                            }
                          />
                        </View>
                        <VixText
                          heading="bold"
                          additionalStyle={
                            status === 'done' ? styles.statusDone : styles.status
                          }>
                          {multiStatusLabel(status)}
                        </VixText>
                      </PressableScale>
                      <EditButton onPress={() => openEdit(m)} />
                    </View>
                  </View>
                </Animated.View>
              );
            })
          )}
        </ScrollView>
      )}

      {/* Sheet buat / ubah keterangan multiplikasi. Timeline & anggotanya
          diurus di layar detailnya, bukan di sini. */}
      <SheetModal
        visible={!!editing}
        title={editing === 'new' ? 'Buat Multiplikasi' : 'Ubah Multiplikasi'}
        subtitle="Timeline & anggotanya diisi di dalam"
        onClose={() => setEditing(null)}>
        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          🏠 CORE asal
        </VixText>
        <FormInput
          style={styles.formGap}
          placeholder="Nama CORE Leader-nya"
          value={fFrom}
          onChangeText={setFFrom}
          editable={!busy}
        />
        <HeartRow value={fFromHeart} onChange={setFFromHeart} />

        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          🌱 CORE baru
        </VixText>
        <FormInput
          style={styles.formGap}
          placeholder="Nama CORE Leader barunya"
          value={fTo}
          onChangeText={setFTo}
          editable={!busy}
        />
        <HeartRow value={fToHeart} onChange={setFToHeart} />

        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          🗓️ Multiplication Meeting
        </VixText>
        <View style={styles.formGap}>
          <DateField
            key={`meet-${editing === 'new' ? 'new' : (editing?.id ?? '')}`}
            value={fMeeting}
            onChange={setFMeeting}
          />
        </View>

        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          🎉 CORE Perdana
        </VixText>
        <View style={styles.formGap}>
          <DateField
            key={`first-${editing === 'new' ? 'new' : (editing?.id ?? '')}`}
            value={fFirst}
            onChange={setFFirst}
          />
        </View>

        <FormInput
          style={styles.formGap}
          placeholder="Hari CORE barunya (mis. Rabu)"
          value={fDay}
          onChangeText={setFDay}
          editable={!busy}
        />
        <FormInput
          style={styles.formGap}
          placeholder="Tempat (mis. NDC Soho Capital)"
          value={fPlace}
          onChangeText={setFPlace}
          editable={!busy}
        />

        <FormError message={formError} />
        <PrimaryButton label="Simpan" onPress={handleSave} busy={busy} />
      </SheetModal>
    </View>
  );
}

/** Deretan pilihan emoji hati — sama isinya dengan pemilih hati CORE Leader. */
function HeartRow({
  value,
  onChange,
}: {
  value: string;
  onChange: (heart: string) => void;
}) {
  return (
    <View style={styles.heartRow}>
      {HEARTS.map((h) => (
        <Chip
          key={h}
          label={h}
          active={value === h}
          onPress={() => onChange(h)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 },
  addButton: { marginBottom: 14 },
  empty: { textAlign: 'center', marginTop: 10 },
  card: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: Color.BORDER,
    padding: 16,
    marginBottom: 12,
  },
  cardRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  cardMain: { flex: 1, gap: 4 },
  pair: { color: Color.TEXT_TITLE },
  meta: { color: Color.TEXT_LABEL },
  bar: { marginTop: 4, marginBottom: 2 },
  status: { color: Color.TEXT_LABEL },
  statusDone: { color: Color.SUCCESS },
  // Form
  fieldLabel: { marginBottom: 6 },
  formGap: { marginBottom: 10 },
  heartRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
});
