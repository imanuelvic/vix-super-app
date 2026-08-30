import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { ActionStack } from '@/components/common/ActionStack';
import { BibleRefField } from '@/components/common/BibleRefField';
import { FormError } from '@/components/common/FormError';
import { FormInput } from '@/components/common/FormInput';
import { InlineDelete } from '@/components/common/InlineDelete';
import { LoadingCenter } from '@/components/common/LoadingCenter';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { ShareWhatsAppButton } from '@/components/common/ShareWhatsAppButton';
import { VixText } from '@/components/common/VixText';
import { ConnectCoreButton } from '@/components/spiritual/ConnectCoreButton';
import { SpiritualIntro } from '@/components/spiritual/SpiritualIntro';
import { useAuth } from '@/contexts/auth';
import { useDraft } from '@/hooks/useDraft';
import { type LoginStreak as DayStreak } from '@/lib/achievements';
import { formatFullDate } from '@/lib/format';
import { purgeNoteLinks } from '@/lib/coreNotes';
import { dayDocId } from '@/lib/health';
import { unsubscribeAll } from '@/lib/liveDoc';
import { LOAD_ERROR, SAVE_ERROR } from '@/lib/messages';
import {
  applicationPrompt,
  bumpReviveStreak,
  dailyReminder,
  deleteReviveEntry,
  rhemaPrompt,
  saveReviveEntry,
  subscribeReviveEntries,
  subscribeReviveStreak,
  type ReviveEntry,
} from '@/lib/spiritual';
import { shareTextToWhatsApp, WHATSAPP_ERROR } from '@/lib/whatsapp';

// Tulis/edit Revive ✍️ — halaman sendiri (bukan mode di dalam
// layar Spiritual) dengan KeyboardAvoidingView supaya kolom Application
// tidak ketutupan keyboard iPhone.
export default function ReviveEditorScreen() {
  const router = useRouter();
  const { user } = useAuth();
  // ?day=YYYY-MM-DD dari riwayat; tanpa param = Revive hari ini.
  const { day } = useLocalSearchParams<{ day?: string }>();

  const todayId = dayDocId(new Date());
  const targetDay = typeof day === 'string' && day ? day : todayId;
  // Reminder harian (dipindah dari halaman Spiritual) — dibaca dulu sebelum
  // menulis renungan. Deterministik per hari, ganti otomatis tiap hari.
  const reminder = dailyReminder(targetDay);

  const [entries, setEntries] = useState<ReviveEntry[] | null>(null);
  const [streak, setStreak] = useState<DayStreak | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Revive hari itu — null selama datanya belum sampai, atau kalau memang
  // belum pernah ditulis.
  const entry = entries?.find((e) => e.id === targetDay) ?? null;
  const exists = entry !== null;

  // Revive hari LAIN yang sudah tertulis = ARSIP: dibuka jadi bacaan, bukan
  // form. Aturannya sama dengan Catatan Khotbah yang terkunci mulai Selasa —
  // yang sudah masuk riwayat memang tidak ditulis ulang, dan membiarkannya
  // bisa diubah cuma bikin catatan lama pelan-pelan bergeser dari aslinya.
  // Revive HARI INI tetap bisa diisi & diperbaiki sepuasnya.
  const arsip = exists && targetDay !== todayId;

  // Isian form: ikut Revive tersimpan SELAMA belum diketik; sekali diketik,
  // ketikan itu yang menang (snapshot berikutnya tidak menimpanya). Hook
  // bersama useDraft; dulu satu bendera `loaded` + satu efek yang mengisi
  // keenam kolom sekaligus begitu data pertama datang.
  const [fTitle, setFTitle] = useDraft(entry?.title ?? '');
  const [fPassage, setFPassage] = useDraft(entry?.passage ?? '');
  const [fRhema, setFRhema] = useDraft(entry?.rhema ?? '');
  const [fReflection, setFReflection] = useDraft(entry?.reflection ?? '');

  // Dua nilai ini memang TIDAK bisa diubah dari layar ini, jadi cukup
  // diturunkan — tak perlu jadi isian yang bisa diketik:
  //   • tanggal Revive: ikut yang tersimpan, atau jam layar ini dibuka;
  //   • `verse`: kolom lama yang tetap ikut disimpan supaya catatan lama utuh,
  //     tapi tidak ditampilkan di mana pun.
  const [openedAt] = useState(() => new Date());
  const editingDate = entry ? entry.date.toDate() : openedAt;
  const fVerse = entry?.verse ?? '';

  useEffect(() => {
    if (!user) return;
    const fail = () => setFormError(LOAD_ERROR);
    return unsubscribeAll([
      subscribeReviveEntries(user.uid, setEntries, fail),
      subscribeReviveStreak(user.uid, setStreak, fail),
    ]);
  }, [user]);

  async function handleSave() {
    if (!user || busy) return;
    if (!fTitle.trim()) {
      setFormError('Judul renungannya diisi dulu ya.');
      return;
    }
    if (!fPassage.trim()) {
      setFormError('Isi bacaan Alkitabnya dulu ya.');
      return;
    }
    if (!fRhema.trim()) {
      setFormError('Tulis rhema-nya — firman apa yang ngena di hatimu?');
      return;
    }
    if (!fReflection.trim()) {
      setFormError('Isi bagian Aplikasi — mau lakukan apa menanggapi firman ini?');
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      await saveReviveEntry(user.uid, targetDay, {
        title: fTitle.trim(),
        passage: fPassage.trim(),
        verse: fVerse.trim(),
        rhema: fRhema.trim(),
        reflection: fReflection.trim(),
        date: editingDate,
      });
      // Revive HARI INI pertama kali → streak naik 🔥
      if (targetDay === todayId) {
        await bumpReviveStreak(user.uid, streak, todayId);
      }
      router.back();
    } catch {
      setFormError(SAVE_ERROR);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!user || busy) return;
    setBusy(true);
    try {
      await deleteReviveEntry(user.uid, targetDay);
      // Acara CORE yang menyambung ke catatan ini ikut dilepas, supaya tidak
      // ada tombol 🔗 yang menunjuk catatan yang sudah tiada. Gagal pun tidak
      // membatalkan penghapusannya — penampilnya sudah tahan sambungan yatim.
      purgeNoteLinks(user.uid, 'revive', targetDay).catch(() => {});
      router.back();
    } finally {
      setBusy(false);
    }
  }

  // Keempat bagian wajib terisi sebelum bisa dibagikan.
  const allFilled =
    !!fTitle.trim() &&
    !!fPassage.trim() &&
    !!fRhema.trim() &&
    !!fReflection.trim();

  // Template pesan untuk dibagikan ke WhatsApp (isi placeholder dari form).
  function buildShareText(): string {
    return (
      `${fTitle.trim()}\n` +
      `- ${formatFullDate(editingDate)}\n\n` +
      `Revive hari ini aku belajar ${fRhema.trim()}\n\n` +
      `yuk semangat ${fReflection.trim()}\n\n` +
      `God bless all, have a nice day!`
    );
  }

  // Buka WhatsApp dengan teks siap kirim — user tinggal pilih chat tujuannya.
  function shareToWhatsApp() {
    shareTextToWhatsApp(buildShareText(), () => setFormError(WHATSAPP_ERROR));
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        backLabel="Spiritual"
        title={arsip ? 'Catatan Revive 📖' : 'Tulis Revive ✍️'}
        subtitle={`📖 ${formatFullDate(editingDate)}`}
      />

      {entries === null ? (
        <LoadingCenter />
      ) : arsip && entry ? (
        /* ===================== ARSIP — baca saja ===================== */
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.arsipTop}>
            <VixText heading="label" additionalStyle={styles.lockChip}>
              🔒 Arsip
            </VixText>
            {entry.passage ? (
              <VixText heading="label" additionalStyle={styles.arsipPassage}>
                📖 {entry.passage}
              </VixText>
            ) : null}
          </View>
          <VixText heading="subheader" additionalStyle={styles.arsipTitle}>
            {entry.title}
          </VixText>

          {/* Teksnya utuh — tidak dipotong, enter yang kamu ketik ikut
              terbaca sebagai ganti baris. Inilah gunanya layar penuh. */}
          <BacaBlok label="✨ Rhema" text={entry.rhema} />
          <BacaBlok label="🏃🏻‍➡️ Aplikasi" text={entry.reflection} />

          <ActionStack>
            <ShareWhatsAppButton onPress={shareToWhatsApp} />
            {/* Sambungkan bahan ini ke acara CORE yang akan datang. */}
            <ConnectCoreButton
              kind="revive"
              noteId={targetDay}
              title={entry.title}
            />
          </ActionStack>

          <VixText heading="label" additionalStyle={styles.lockNote}>
            🔒 Catatan ini sudah jadi arsip — bisa dibaca, dibagikan, &
            disambungkan ke acara CORE, tapi tidak bisa diubah lagi.
          </VixText>
        </ScrollView>
      ) : (
        /* Keyboard iOS tidak lagi menutupi kolom Application */
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled">
            {/* Reminder hari ini + pintasan NDC Ministry — dibaca dulu, baru
                menulis renungan. Bentuknya dipakai bersama layar Baca Alkitab. */}
            <SpiritualIntro reminder={reminder} />
            {/* Judulnya diketik apa adanya. Dulu `autoCapitalize="characters"`
                → keyboard iOS mengunci Caps Lock, jadi tiap huruf jadi besar
                dan mengetik judul biasa terasa dipaksa. Judul yang sudah
                tersimpan besar semua tidak berubah — yang diubah cuma cara
                mengetiknya. (Beda dengan kolom Terjemahan di Baca Alkitab:
                "TB"/"TSI" memang singkatan, huruf besar di situ benar.) */}
            <FormInput
              style={styles.formGap}
              placeholder="Judul Revive"
              value={fTitle}
              onChangeText={setFTitle}
              editable={!busy}
            />
            <VixText heading="label" additionalStyle={styles.fieldLabel}>
              📖 Bacaan Alkitab
            </VixText>
            <View style={styles.formGap}>
              <BibleRefField
                value={fPassage}
                onChange={setFPassage}
                editable={!busy}
              />
            </View>
            <VixText heading="label" additionalStyle={styles.fieldLabel}>
              ✨ Rhema
            </VixText>
            <FormInput
              style={styles.bigInput}
              placeholder={rhemaPrompt(targetDay)}
              value={fRhema}
              onChangeText={setFRhema}
              multiline
              editable={!busy}
            />
            <VixText heading="label" additionalStyle={styles.fieldLabel}>
              🏃🏻‍➡️ Aplikasi
            </VixText>
            <FormInput
              style={styles.mediumInput}
              placeholder={applicationPrompt(targetDay)}
              value={fReflection}
              onChangeText={setFReflection}
              multiline
              editable={!busy}
            />
            <ActionStack>
              {/* Setelah keempat bagian terisi → langsung tombol share (tanpa
                  preview isi pesan; teksnya tetap dibuat di shareToWhatsApp). */}
              {allFilled && <ShareWhatsAppButton onPress={shareToWhatsApp} />}
              {/* gap="none" — jaraknya sudah dipegang ActionStack. */}
              <FormError message={formError} gap="none" />
              <PrimaryButton label="Simpan" busy={busy} onPress={handleSave} />
              {/* Sudah tersimpan → boleh disambungkan ke acara CORE yang akan
                  datang, tanpa menunggu jadi arsip besok. */}
              {exists && entry && (
                <ConnectCoreButton
                  kind="revive"
                  noteId={targetDay}
                  title={entry.title}
                />
              )}
            </ActionStack>
            {exists && (
              <InlineDelete
                key={targetDay}
                label="Hapus Revive ini"
                busy={busy}
                onDelete={handleDelete}
              />
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

/** Satu blok bacaan di mode arsip — dilewati kalau memang kosong. */
function BacaBlok({ label, text }: { label: string; text: string }) {
  if (!text.trim()) return null;
  return (
    <View style={styles.bacaBlok}>
      <VixText heading="label" additionalStyle={styles.bacaLabel}>
        {label}
      </VixText>
      <VixText heading="paragraph" additionalStyle={styles.bacaText}>
        {text}
      </VixText>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.BACKGROUND },
  // ---- Mode arsip (baca saja) ----
  arsipTop: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 6,
  },
  lockChip: {
    backgroundColor: Color.ACCENT,
    color: Color.ACCENT_DARK,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  arsipPassage: { color: Color.SPIRITUAL_DARK },
  arsipTitle: { color: Color.TEXT_TITLE, marginBottom: 4 },
  bacaBlok: { marginTop: 12, gap: 2 },
  bacaLabel: { color: Color.TEXT_LABEL },
  bacaText: { color: Color.TEXT_PARAGRAPH },
  lockNote: { color: Color.TEXT_LABEL, textAlign: 'center', marginTop: 14 },
  flex: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 40 },
  formGap: { marginBottom: 10 },
  fieldLabel: { marginBottom: 6 },
  bigInput: {
    minHeight: 140,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  // Tanpa marginBottom: jarak ke tombol di bawahnya dipegang ActionStack,
  // supaya sama persis dengan mode arsip (dan dengan layar Spiritual lain).
  mediumInput: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
});
