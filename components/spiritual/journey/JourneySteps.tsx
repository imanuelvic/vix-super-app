import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { BibleRefField } from '@/components/common/BibleRefField';
import { Chip } from '@/components/common/Chip';
import { FormError } from '@/components/common/FormError';
import { FormInput } from '@/components/common/FormInput';
import { PressableScale } from '@/components/common/PressableScale';
import { VixText } from '@/components/common/VixText';
import { SpiritualIntro } from '@/components/spiritual/SpiritualIntro';
import { useDraft } from '@/hooks/useDraft';
import { useFormSave } from '@/hooks/useFormSave';
import { type IntercessionTopic } from '@/lib/intercession';
import {
  BAPA_KAMI,
  JOURNEY_CLOSING,
  JOURNEY_NAME,
  openWorshipSong,
  RESPONSE_OPTIONS,
  WORSHIP_SONG_ERROR,
  type WorshipSong,
} from '@/lib/journey';
import { type JourneyFields, type ReviveEntry, type WorshipPassage } from '@/lib/spiritual';

import {
  JourneyBox,
  JourneyCard,
  JourneyFieldLabel,
  JourneyLink,
  JourneyNext,
  JourneyQuestion,
  journeyStyles as js,
} from './JourneyCard';

// Ketujuh langkah Morning Journey 🌅. Tiap langkah kartu sendiri; isiannya
// TIDAK diwajibkan — "Lanjut" selalu bisa di-click, dan yang kosong dibiarkan
// kosong. Yang ditulis disimpan begitu Lanjut di-click (lihat lib/journey.ts
// untuk ke mana tiap isian menumpang).

/** Simpan isian Revive-hari-ini sebagian (judul/bacaan/rhema/aplikasi/…). */
export type SaveJourney = (fields: JourneyFields) => Promise<void>;

// ============================ 🌅 Arrive ============================
export function ArriveStep({ onNext }: { onNext: () => void }) {
  return (
    <JourneyCard step="arrive">
      <VixText heading="title" additionalStyle={styles.greeting}>
        Selamat pagi, {JOURNEY_NAME}.
      </VixText>
      <JourneyQuestion>
        Sebelum memulai harimu, mari tenangkan hati sejenak. Tarik napas,
        dan sadari: hari yang baru sudah dimulai, dan Tuhan ada di sini.
      </JourneyQuestion>
      <JourneyNext label="Aku siap" onPress={onNext} />
    </JourneyCard>
  );
}

// ============================ 📖 Receive ============================
// Renungan Revive hari ini: dibaca di app NDC Ministry (tombolnya di
// SpiritualIntro), lalu yang berbicara ditulis di sini. Judul & bacaan ikut
// diisi supaya Revive-nya utuh (kolom yang sama dengan editor Revive).
export function ReceiveStep({
  entry,
  ready,
  reminder,
  onSave,
  onNext,
}: {
  entry: ReviveEntry | null;
  /** false = Revive hari ini belum terbaca; jangan menyimpan dulu. */
  ready: boolean;
  reminder: string;
  onSave: SaveJourney;
  onNext: () => void;
}) {
  const { busy, formError, save } = useFormSave();
  const [title, setTitle] = useDraft(entry?.title ?? '');
  const [passage, setPassage] = useDraft(entry?.passage ?? '');
  const [rhema, setRhema] = useDraft(entry?.rhema ?? '');

  function lanjut() {
    return save(async () => {
      await onSave({ title: title.trim(), passage: passage.trim(), rhema: rhema.trim() });
      onNext();
    });
  }

  return (
    <JourneyCard step="receive">
      <JourneyQuestion>
        Baca renungan Revive hari ini pelan-pelan. Bukan untuk menyelesaikannya,
        tapi untuk mendengar.
      </JourneyQuestion>
      <SpiritualIntro reminder={reminder} />

      <View>
        <JourneyFieldLabel>Judul Revive</JourneyFieldLabel>
        <FormInput
          style={js.gap}
          placeholder="Judul renungan hari ini"
          value={title}
          onChangeText={setTitle}
          editable={!busy}
        />
        <JourneyFieldLabel>📖 Bacaan Alkitab</JourneyFieldLabel>
        <View style={js.gap}>
          <BibleRefField value={passage} onChange={setPassage} editable={!busy} />
        </View>
        <JourneyFieldLabel>✨ Apa yang paling berbicara kepadamu pagi ini?</JourneyFieldLabel>
        <FormInput
          style={js.bigInput}
          placeholder="Firman, kalimat, atau kesan yang tinggal di hatimu…"
          value={rhema}
          onChangeText={setRhema}
          multiline
          editable={!busy}
        />
      </View>

      <FormError message={formError} gap="none" />
      <JourneyNext label="Lanjut" onPress={lanjut} busy={busy} disabled={!ready} />
    </JourneyCard>
  );
}

// ============================ 💭 Reflect ============================
// Tulisannya = 📓 Daily Reflection Journal di Habits (kartu "Refleksi Hari
// Ini" di Home, feed, & AI Reflection membaca tempat yang sama).
export function ReflectStep({
  prompt,
  journal,
  onSave,
  onNext,
}: {
  prompt: string;
  /** null = daftar kebiasaan belum terbaca. `available` = barisnya ada. */
  journal: { text: string; available: boolean } | null;
  onSave: (text: string) => Promise<void>;
  onNext: () => void;
}) {
  const { busy, formError, save } = useFormSave();
  const [text, setText] = useDraft(journal?.text ?? '');
  const bisaTulis = journal === null || journal.available;

  function lanjut() {
    if (!bisaTulis) return onNext();
    return save(async () => {
      await onSave(text.trim());
      onNext();
    });
  }

  return (
    <JourneyCard step="reflect">
      <JourneyQuestion>{prompt}</JourneyQuestion>
      {bisaTulis ? (
        <FormInput
          style={js.bigInput}
          placeholder="Tulis apa adanya. Tidak ada jawaban yang salah."
          value={text}
          onChangeText={setText}
          multiline
          editable={!busy}
        />
      ) : (
        // Barisnya belum ada di Habits: renungkan saja dulu dalam hati.
        <VixText heading="label" additionalStyle={js.hint}>
          Renungkan sejenak dalam hati. Kalau ingin menuliskannya, tambahkan
          baris 📓 Daily Reflection Journal di Habits.
        </VixText>
      )}
      <FormError message={formError} gap="none" />
      <JourneyNext label="Lanjut" onPress={lanjut} busy={busy} disabled={journal === null} />
    </JourneyCard>
  );
}

// ============================ ❤️ Respond ============================
// Chip respons hati (boleh lebih dari satu) + satu hal yang dibawa hari ini
// (= kolom 🏃 Aplikasi Revive).
export function RespondStep({
  entry,
  ready,
  onSave,
  onNext,
}: {
  entry: ReviveEntry | null;
  ready: boolean;
  onSave: SaveJourney;
  onNext: () => void;
}) {
  const { busy, formError, save } = useFormSave();
  const [responses, setResponses] = useDraft<string[]>(entry?.responses ?? []);
  const [carry, setCarry] = useDraft(entry?.reflection ?? '');

  function toggle(key: string) {
    setResponses((cur) =>
      cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key],
    );
  }

  function lanjut() {
    return save(async () => {
      await onSave({ responses, reflection: carry.trim() });
      onNext();
    });
  }

  return (
    <JourneyCard step="respond">
      <JourneyQuestion>
        Setelah membaca dan berefleksi, apa respons hatimu pagi ini?
      </JourneyQuestion>
      <View style={styles.chips}>
        {RESPONSE_OPTIONS.map((o) => (
          <Chip
            key={o.key}
            label={`${o.emoji} ${o.label}`}
            active={responses.includes(o.key)}
            onPress={() => toggle(o.key)}
          />
        ))}
      </View>
      <View>
        <JourneyFieldLabel>
          Dari apa yang kamu baca hari ini, apa satu hal yang ingin kamu bawa ke
          dalam harimu?
        </JourneyFieldLabel>
        <FormInput
          style={js.mediumInput}
          placeholder="Satu hal saja, yang nyata untuk hari ini"
          value={carry}
          onChangeText={setCarry}
          multiline
          editable={!busy}
        />
      </View>
      <FormError message={formError} gap="none" />
      <JourneyNext label="Lanjut" onPress={lanjut} busy={busy} disabled={!ready} />
    </JourneyCard>
  );
}

// ============================ 🎵 Worship ============================
// Satu lagu per hari (YouTube) + ayat penyembahan hari ini. Sepenuhnya
// pilihan: "Skip untuk sekarang" sama sahnya dengan "Mulai Worship".
export function WorshipStep({
  song,
  passage,
  onNext,
}: {
  song: WorshipSong;
  passage: WorshipPassage;
  onNext: () => void;
}) {
  const [error, setError] = useState<string | null>(null);

  function mulai() {
    setError(null);
    void openWorshipSong(song, () => setError(WORSHIP_SONG_ERROR));
    onNext();
  }

  return (
    <JourneyCard step="worship">
      <JourneyQuestion>
        Sebelum melangkah, tinggal sebentar. Satu lagu untuk pagi ini:
      </JourneyQuestion>
      <View style={styles.song}>
        <VixText additionalStyle={styles.songNote}>🎵</VixText>
        <View style={styles.songMain}>
          <VixText heading="title" additionalStyle={styles.songTitle}>
            {song.title}
          </VixText>
          <VixText heading="label" additionalStyle={styles.songArtist}>
            {song.artist}
          </VixText>
        </View>
      </View>
      <JourneyBox>
        <VixText heading="paragraph" additionalStyle={js.boxText}>
          {passage.text}
        </VixText>
        <VixText heading="label" additionalStyle={js.boxRef}>
          - {passage.ref}
        </VixText>
      </JourneyBox>
      <FormError message={error} gap="none" />
      <JourneyNext label="Mulai Worship" onPress={mulai} />
      <JourneyLink label="Skip untuk sekarang" onPress={onNext} />
    </JourneyCard>
  );
}

// ============================ 🙏 Pray ============================
/** Satu CORE Leader giliran Doa Rantai hari ini, lengkap dengan pokok doanya. */
export type ChainLeader = {
  id: string;
  heart: string;
  name: string;
  phone: string | null;
  points: string[];
  done: boolean;
};

export function PrayStep({
  entry,
  ready,
  topic,
  showIntercession,
  chainDue,
  chainLeft,
  chainLeaders,
  onPrayLeader,
  onSave,
  onNext,
}: {
  entry: ReviveEntry | null;
  ready: boolean;
  /** Pokok doa syafaat hari ini (Senin Keluarga·Kesehatan, dst). */
  topic: IntercessionTopic;
  /** false di Selasa/Kamis saat Doa Rantai-nya tampil (biar tidak dobel). */
  showIntercession: boolean;
  /** HARI INI jadwal Doa Rantai (Selasa & Kamis) & ada CL gilirannya. */
  chainDue: boolean;
  /** Berapa CORE Leader lagi yang belum didoakan pagi ini. */
  chainLeft: number;
  chainLeaders: ChainLeader[];
  /** Buka WhatsApp berisi pokok doa CL itu, lalu tandai sudah didoakan. */
  onPrayLeader: (leader: ChainLeader) => void;
  onSave: SaveJourney;
  onNext: () => void;
}) {
  const { busy, formError, save } = useFormSave();
  const [prayer, setPrayer] = useDraft(entry?.prayer ?? '');
  // CL mana yang pokok doanya sedang dibuka (null = semua tertutup). Satu saja
  // pada satu waktu — supaya kartunya tetap pendek & fokus.
  const [openChain, setOpenChain] = useState<string | null>(null);

  function berdoa() {
    return save(async () => {
      await onSave({ prayer: prayer.trim() });
      onNext();
    });
  }

  return (
    <JourneyCard step="pray">
      {/* Doa Syafaat — pokok doanya berganti tiap hari (jadwal tetap di
          lib/intercession.ts). Selasa & Kamis diganti Doa Rantai di bawah. */}
      {showIntercession && (
        <View>
          <JourneyFieldLabel>
            Doa Syafaat · {topic.emoji} {topic.label}
          </JourneyFieldLabel>
          <JourneyBox>
            {topic.points.map((p) => (
              <VixText key={p} heading="paragraph" additionalStyle={js.pointText}>
                • {p}
              </VixText>
            ))}
          </JourneyBox>
        </View>
      )}

      {chainDue && (
        <View>
          <JourneyFieldLabel>🔗 Doa Rantai CORE Leader hari ini</JourneyFieldLabel>
          <View style={styles.chainList}>
            {chainLeaders.map((l) => {
              const open = openChain === l.id;
              return (
                <ChainPrayerCard
                  key={l.id}
                  leader={l}
                  open={open}
                  onToggle={() => setOpenChain(open ? null : l.id)}
                  onPray={onPrayLeader}
                />
              );
            })}
          </View>
          <VixText heading="label" additionalStyle={[js.hint, styles.chainNote]}>
            {chainLeft > 0
              ? `Masih ada ${chainLeft} CORE Leader yang menunggu didoakan pagi ini.`
              : 'Semua CORE Leader giliran pagi ini sudah didoakan 🙏'}
          </VixText>
        </View>
      )}

      <View>
        <JourneyFieldLabel>
          Hal apa yang ingin kamu serahkan kepada Tuhan pagi ini?
        </JourneyFieldLabel>
        <FormInput
          style={js.bigInput}
          placeholder="Tuliskan doamu sendiri, sesederhana apa pun"
          value={prayer}
          onChangeText={setPrayer}
          multiline
          editable={!busy}
        />
      </View>
      <FormError message={formError} gap="none" />
      <JourneyNext label="Berdoa" onPress={berdoa} busy={busy} disabled={!ready} />
    </JourneyCard>
  );
}

/** Kartu pokok doa SATU CORE Leader — buka/tutup, lalu 💬 doakan lewat WhatsApp. */
function ChainPrayerCard({
  leader: l,
  open,
  onToggle,
  onPray,
}: {
  leader: ChainLeader;
  open: boolean;
  onToggle: () => void;
  onPray: (leader: ChainLeader) => void;
}) {
  return (
    <View style={styles.chainCard}>
      <PressableScale style={styles.chainTop} onPress={onToggle}>
        <VixText heading="bold" additionalStyle={styles.chainName}>
          {l.heart} {l.name}
        </VixText>
        <VixText heading="label" additionalStyle={styles.chainMeta}>
          {l.done ? '✅ ' : ''}
          {l.points.length} poin {open ? '▴' : '▾'}
        </VixText>
      </PressableScale>

      {open && (
        <>
          {l.points.length > 0 ? (
            l.points.map((p, i) => (
              <VixText key={`${i}-${p}`} heading="paragraph" additionalStyle={js.pointText}>
                🙏 {p}
              </VixText>
            ))
          ) : (
            <VixText heading="label" additionalStyle={js.hint}>
              Belum ada pokok doa bulan ini.
            </VixText>
          )}
          {l.done ? (
            <VixText heading="label" additionalStyle={styles.chainDone}>
              ✅ Sudah didoakan hari ini
            </VixText>
          ) : l.phone ? (
            <PressableScale style={styles.waButton} onPress={() => onPray(l)}>
              <VixText heading="bold" additionalStyle={styles.waText}>
                💬 Doakan lewat WhatsApp
              </VixText>
            </PressableScale>
          ) : (
            <VixText heading="label" additionalStyle={js.hint}>
              📱 Isi nomor HP-nya dulu di CORE → Leaders.
            </VixText>
          )}
        </>
      )}
    </View>
  );
}

// ============================ 🌤️ Close ============================
export function CloseStep({
  onConfirm,
  busy,
}: {
  onConfirm: () => void;
  busy: boolean;
}) {
  return (
    <JourneyCard step="close">
      <JourneyQuestion>Tutup pagi ini dengan doa yang Tuhan Yesus ajarkan.</JourneyQuestion>
      <JourneyBox>
        <VixText heading="paragraph" additionalStyle={js.boxText}>
          {BAPA_KAMI}
        </VixText>
      </JourneyBox>
      <VixText heading="title" additionalStyle={styles.closing}>
        {JOURNEY_CLOSING}
      </VixText>
      <JourneyNext label="Mulai Hariku" onPress={onConfirm} busy={busy} />
    </JourneyCard>
  );
}

const styles = StyleSheet.create({
  greeting: { color: Color.SPIRITUAL_DARK, marginTop: -4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  // Kartu lagu: nada besar di kiri, judul & penyanyi di kanan.
  song: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: Color.SPIRITUAL,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  songNote: { fontSize: 30, lineHeight: 38 },
  songMain: { flex: 1, gap: 1 },
  songTitle: { color: Color.SPIRITUAL_DEEP },
  songArtist: { color: Color.SPIRITUAL_DARK },
  chainList: { gap: 8 },
  chainNote: { marginTop: 8 },
  // Kartu pokok doa 1 CORE Leader di dalam langkah Pray.
  chainCard: {
    backgroundColor: Color.SPIRITUAL,
    borderRadius: 14,
    padding: 14,
    gap: 6,
  },
  // Baris kepala kartu CL = sakelar buka/tutup pokok doanya.
  chainTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  chainName: { color: Color.SPIRITUAL_DARK, flex: 1 },
  chainMeta: { color: Color.SPIRITUAL_DARK },
  chainDone: { color: Color.SUCCESS },
  waButton: {
    alignSelf: 'flex-start',
    backgroundColor: Color.WHATSAPP,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginTop: 2,
  },
  waText: { color: Color.TEXT_REVERSE },
  closing: { color: Color.SPIRITUAL_DARK, textAlign: 'center' },
});
