import { StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { BibleRefField } from '@/components/common/BibleRefField';
import { FormError } from '@/components/common/FormError';
import { FormInput } from '@/components/common/FormInput';
import { VixText } from '@/components/common/VixText';
import { BibleRefList, type BibleRefTone } from '@/components/spiritual/BibleRefList';
import { useDraft } from '@/hooks/useDraft';
import { useFormSave } from '@/hooks/useFormSave';
import {
  BIBLE_CLOSING,
  BIBLE_GREETING,
  BIBLE_INVITATION,
  BIBLE_SHARE_QUESTION,
  bibleStepMeta,
} from '@/lib/bibleJourney';
import { formatMinutesLeft } from '@/lib/format';
import {
  bibleRefWithVersion,
  bibleSessionMeta,
  type BibleJourneyFields,
  type BibleReadingNote,
  type BibleSession,
} from '@/lib/spiritual';

import {
  JourneyAction,
  JourneyBox,
  JourneyCard,
  JourneyFieldLabel,
  JourneyNext,
  JourneyQuestion,
  journeyStyles as js,
  useJourneyTone,
} from './JourneyCard';

// Kelima langkah Bible Journey 📖. Bentuknya mengikuti JourneySteps.tsx
// (Morning Journey): tiap langkah satu kartu, isiannya TIDAK diwajibkan, dan
// "Lanjut" selalu bisa di-click.
//
// Yang disimpan kapan:
//   📖 Read    → acuan & terjemahan, begitu Lanjut di-click
//   ✨ Receive → catatan "apa yang aku dapat"
//   💛 Verse   → ayat yang memberkati + bunyinya
//   🕊️ Close   → TIDAK menulis apa-apa lagi; ia menaikkan streak 🔥 lalu pergi
//
// Jadi kalau perjalanannya ditinggal di tengah, yang sudah ditulis tetap ada.
// Streak-nya sendiri sengaja hanya naik di langkah terakhir: itulah satu
// clickan yang berarti "ya, aku memang membacanya hari ini".

/** Simpan isian satu langkah ke dokumen bacaan hari ini. */
export type SaveBibleJourney = (fields: BibleJourneyFields) => Promise<void>;

// ============================ 🌅 Open ============================
export function OpenStep({
  session,
  reminder,
  minutesLeft,
  onNext,
}: {
  session: BibleSession;
  /** Satu kalimat reminder yang diundi per hari (lib/spiritual). */
  reminder: string;
  /** Sisa menit sampai jendela sesi ini tutup; ≤ 0 = sudah lewat. */
  minutesLeft: number;
  onNext: () => void;
}) {
  const tone = useJourneyTone();
  const meta = bibleSessionMeta(session);
  return (
    <JourneyCard step={bibleStepMeta('open', session)}>
      <VixText heading="title" additionalStyle={{ color: tone.accent }}>
        {BIBLE_GREETING[session]}
      </VixText>
      <JourneyQuestion>{BIBLE_INVITATION[session]}</JourneyQuestion>

      <JourneyBox>
        <VixText heading="label" additionalStyle={{ color: tone.accent }}>
          🕊️ Reminder
        </VixText>
        <VixText heading="paragraph" additionalStyle={styles.reminderText}>
          {reminder}
        </VixText>
      </JourneyBox>

      {/* Sisa waktu disebut SEKALI, pelan, sebagai keterangan. Dulu ia kartu
          hitung mundur yang berubah merah di 30 menit terakhir, duduk paling
          atas layar — yang pertama terbaca tiap kali membuka bacaan adalah
          kejaran waktu. Jendelanya tetap nyata dan tetap disebut; yang
          dilepas cuma nada mendesaknya.

          Kalau jendelanya sudah lewat, akibatnya tetap disebut APA ADANYA.
          Menenangkan bukan berarti menyembunyikan: kalau streak-nya hilang
          hari ini, lebih baik tahu di sini daripada menyangka masih utuh. */}
      <VixText heading="label" additionalStyle={js.hint}>
        {minutesLeft > 0
          ? `⏳ Jendela ${meta.label} ${meta.emoji} masih ${formatMinutesLeft(minutesLeft)} lagi, sampai jam ${meta.toHour}.00.`
          : `⌛ Jam ${meta.fromHour}.00 sampai ${meta.toHour}.00 sudah habis. Otomatis ✗ di Habits, streak hilang. Bacanya tetap dicatat.`}
      </VixText>

      <JourneyNext label="Aku siap" onPress={onNext} />
    </JourneyCard>
  );
}

// ============================ 📖 Read ============================
// Kitab & pasal yang dibaca + terjemahannya, lalu tombol yang membuka pasal
// itu di YouVersion. Inilah membacanya sendiri; langkah berikutnya baru
// menanyakan hasilnya.
export function ReadStep({
  session,
  refs,
  onRefs,
  version,
  onVersion,
  hint,
  refTone,
  onOpenBible,
  onSave,
  onNext,
}: {
  session: BibleSession;
  refs: string[];
  onRefs: (refs: string[]) => void;
  version: string;
  onVersion: (version: string) => void;
  /** Baris saran "💡 Lanjutan dari Amsal 26"; null = belum ada riwayat. */
  hint: string | null;
  refTone: BibleRefTone;
  onOpenBible: () => void;
  /** Simpan acuan & terjemahannya. Streak 🔥 BELUM naik di sini. */
  onSave: (passage: string, version: string) => Promise<void>;
  onNext: () => void;
}) {
  // Penanda sibuk & pesan gagalnya milik langkah ini sendiri, sama seperti
  // ✨ Receive & 💛 Verse. Penting: `onNext` dipanggil DI DALAM save(), jadi
  // perjalanannya tidak maju kalau tulisannya gagal tersimpan. Kalau ia di
  // luar, bacaan yang gagal disimpan tetap melaju ke langkah berikutnya dan
  // kamu baru tahu di penutupnya, saat tulisannya sudah terlanjur hilang.
  const { busy, formError, save } = useFormSave();
  const filled = refs.map((r) => r.trim()).filter(Boolean);

  function lanjut() {
    return save(async () => {
      await onSave(filled.join(', '), version);
      onNext();
    });
  }

  return (
    <JourneyCard step={bibleStepMeta('read', session)}>
      <JourneyQuestion>
        Pilih kitab & pasalnya, lalu bacalah pelan-pelan. Tidak perlu banyak,
        cukup yang benar-benar kamu dengar.
      </JourneyQuestion>

      <View>
        <BibleRefList
          refs={refs}
          onChange={onRefs}
          editable={!busy}
          hint={hint}
          version={version}
          onVersionChange={onVersion}
          tone={refTone}
        />
      </View>

      {/* Tombolnya membuka PASAL ITU, bukan halaman depan YouVersion — acuan
          pertama yang dipakai, sisanya tinggal di-click dari riwayatnya. */}
      <JourneyAction
        label="📖 Buka YouVersion"
        detail={
          filled.length > 0
            ? `Langsung ke ${bibleRefWithVersion(filled[0], version)}`
            : 'Pilih kitabnya dulu untuk langsung ke pasalnya'
        }
        onPress={onOpenBible}
      />

      <FormError message={formError} gap="none" />
      <JourneyNext
        label="Sudah aku baca"
        onPress={lanjut}
        busy={busy}
        disabled={filled.length === 0}
      />
    </JourneyCard>
  );
}

// ============================ ✨ Receive ============================
export function ReceiveStep({
  session,
  note,
  onSave,
  onNext,
}: {
  session: BibleSession;
  note: BibleReadingNote;
  onSave: SaveBibleJourney;
  onNext: () => void;
}) {
  const { busy, formError, save } = useFormSave();
  const [text, setText] = useDraft(note.note);

  function lanjut() {
    return save(async () => {
      await onSave({ note: text });
      onNext();
    });
  }

  return (
    <JourneyCard step={bibleStepMeta('receive', session)}>
      <JourneyQuestion>
        Bukan ringkasan pasalnya, tapi apa yang Tuhan tinggalkan untukmu. Satu
        kalimat yang kamu bawa pulang sudah cukup.
      </JourneyQuestion>
      <FormInput
        style={js.bigInput}
        placeholder="Yang Tuhan tunjukkan, tegur, atau kuatkan hari ini…"
        value={text}
        onChangeText={setText}
        multiline
        editable={!busy}
      />
      <FormError message={formError} gap="none" />
      <JourneyNext label="Lanjut" onPress={lanjut} busy={busy} />
    </JourneyCard>
  );
}

// ============================ 💛 Verse ============================
// Acuan ayatnya memakai pemilih yang sama dengan seluruh app, tapi LENGKAP
// dengan nomor ayat (langkah 📖 Read cuma sampai pasal). Bunyinya disalin
// sendiri: app ini tidak menyimpan teks Alkitab, dan menariknya dari internet
// berarti menambah layanan luar beserta risikonya.
export function VerseStep({
  session,
  note,
  onSave,
  onNext,
}: {
  session: BibleSession;
  note: BibleReadingNote;
  onSave: SaveBibleJourney;
  onNext: () => void;
}) {
  const { busy, formError, save } = useFormSave();
  const [verse, setVerse] = useDraft(note.verse);
  const [verseText, setVerseText] = useDraft(note.verseText);

  function lanjut() {
    return save(async () => {
      await onSave({ verse, verseText });
      onNext();
    });
  }

  return (
    <JourneyCard step={bibleStepMeta('verse', session)}>
      <JourneyQuestion>
        Satu ayat yang tinggal di hatimu. Kosongkan saja kalau hari ini tidak
        ada yang menonjol, itu juga jujur.
      </JourneyQuestion>

      <View>
        <JourneyFieldLabel>📖 Ayatnya</JourneyFieldLabel>
        <View style={js.gap}>
          <BibleRefField value={verse} onChange={setVerse} editable={!busy} />
        </View>
        <JourneyFieldLabel>✍️ Bunyinya (kalau mau disalin)</JourneyFieldLabel>
        <FormInput
          style={js.mediumInput}
          placeholder="mis. TUHAN adalah gembalaku, takkan kekurangan aku."
          value={verseText}
          onChangeText={setVerseText}
          multiline
          editable={!busy}
        />
      </View>

      <FormError message={formError} gap="none" />
      <JourneyNext label="Lanjut" onPress={lanjut} busy={busy} />
    </JourneyCard>
  );
}

// ============================ 🕊️ Close ============================
// Penutupnya menanyakan satu hal saja: ada hati untuk membagikannya? Lalu
// "✅ Sudah baca" yang menaikkan streak 🔥 & membawa ke arsipnya.
export function CloseStep({
  session,
  passage,
  version,
  verse,
  canShare,
  onShare,
  onDone,
  ready,
  busy,
  error,
}: {
  session: BibleSession;
  /** Acuan yang akan tersimpan, sudah digabung: "Amsal 27, Mazmur 1". */
  passage: string;
  version: string;
  /** Ayat yang memberkati (boleh kosong). */
  verse: string;
  /**
   * Ada acuan yang terisi → Story-nya bisa dibuat. Syaratnya sengaja tetap
   * acuannya, bukan ayatnya: tanpa acuan memang tak ada yang bisa dipajang,
   * sedangkan ayat yang dikosongkan di langkah 💛 Verse masih boleh diketik
   * di layar Story-nya sendiri, seperti sebelum perjalanan ini ada.
   */
  canShare: boolean;
  onShare: () => void;
  onDone: () => void;
  /** Dokumen hari ini sudah terbaca dari Firestore; sebelum itu jangan simpan. */
  ready: boolean;
  busy: boolean;
  error: string | null;
}) {
  const tone = useJourneyTone();
  return (
    <JourneyCard step={bibleStepMeta('close', session)}>
      <JourneyQuestion>{BIBLE_SHARE_QUESTION}</JourneyQuestion>

      {/* Apa yang akan tersimpan — supaya "Sudah baca" tidak pernah jadi
          clickan buta. */}
      <JourneyBox>
        <VixText heading="label" additionalStyle={{ color: tone.accent }}>
          Akan tersimpan sebagai
        </VixText>
        <VixText heading="bold" additionalStyle={js.boxText}>
          {bibleRefWithVersion(passage, version)}
        </VixText>
        {verse.trim() ? (
          <VixText heading="paragraph" additionalStyle={styles.summaryVerse}>
            💛 {verse.trim()}
          </VixText>
        ) : null}
      </JourneyBox>

      {canShare ? (
        <JourneyAction
          label="📸 Bagikan ayatnya ke Instagram Story"
          detail={
            verse.trim()
              ? `Ayatnya sudah siap: ${verse.trim()}`
              : 'Ayatnya tinggal diketik di layar berikutnya'
          }
          onPress={onShare}
          busy={busy}
        />
      ) : (
        <VixText heading="label" additionalStyle={js.hint}>
          Belum ada kitab & pasal yang diisi, jadi belum ada yang bisa
          dipajang. Tidak apa-apa, hari ini memang cukup untuk kamu sendiri.
        </VixText>
      )}

      <VixText heading="title" additionalStyle={styles.closing}>
        {BIBLE_CLOSING[session]}
      </VixText>

      <FormError message={error} gap="none" />
      <JourneyNext
        label="✅ Sudah baca"
        onPress={onDone}
        busy={busy}
        disabled={!ready}
      />
    </JourneyCard>
  );
}

const styles = StyleSheet.create({
  reminderText: { color: Color.TEXT_TITLE, marginTop: 4 },
  summaryVerse: { color: Color.TEXT_PARAGRAPH, marginTop: 6 },
  closing: { color: Color.TEXT_TITLE, textAlign: 'center' },
});
