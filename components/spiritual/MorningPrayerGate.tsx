import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { CheckCircle } from '@/components/common/CheckCircle';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { PressableScale } from '@/components/common/PressableScale';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { VixText } from '@/components/common/VixText';
import { isChainTopic, type IntercessionTopic } from '@/lib/intercession';

// Doa Bapa Kami (Matius 6:9–13).
const BAPA_KAMI = `Bapa kami yang di sorga,
Dikuduskanlah nama-Mu,
datanglah Kerajaan-Mu,
jadilah kehendak-Mu di bumi seperti di sorga.

Berikanlah kami pada hari ini makanan kami yang secukupnya, dan ampunilah kami akan kesalahan kami, seperti kami juga mengampuni orang yang bersalah kepada kami;

dan janganlah membawa kami ke dalam pencobaan, tetapi lepaskanlah kami dari pada yang jahat.

Karena Engkaulah yang empunya Kerajaan dan kuasa dan kemuliaan sampai selama-lamanya. Amin.`;

// Ayat pengiring langkah memuji & menyembah (Mazmur 95:1–2, TB).
const MAZMUR_95 = `Marilah kita bersorak-sorai untuk TUHAN, bersorak-sorak bagi gunung batu keselamatan kita.

Biarlah kita menghadap wajah-Nya dengan nyanyian syukur, bersorak-sorak bagi-Nya dengan nyanyian mazmur.`;

// Lock screen doa pagi — muncul sekali/hari (batas jam 4 pagi) DI MANA PUN
// posisi kamu di app. Tidak bisa dilewati; harus Revive + doa Bapa Kami, dan
// kalau hari ini jadwal Doa Rantai, follow up-nya jadi langkah ke-3.
/** Satu CORE Leader giliran Doa Rantai hari ini, lengkap dengan pokok doanya. */
export type ChainLeader = {
  id: string;
  heart: string;
  name: string;
  phone: string | null;
  points: string[];
  done: boolean;
};

export function MorningPrayerGate({
  streakCount,
  reviveDone,
  chainDue,
  chainLeft,
  chainQuota,
  chainDoneCount,
  chainLeaders,
  topic,
  minutesLeft,
  onConfirm,
  onOpenRevive,
  onPrayLeader,
  onSkip,
}: {
  streakCount: number;
  // True kalau Revive hari ini sudah diisi → langkah Revive auto-centang.
  reviveDone: boolean;
  // True kalau HARI INI jadwal Doa Rantai (Selasa & Kamis) & ada CL-nya.
  chainDue: boolean;
  // Berapa CORE Leader LAGI yang perlu didoakan pagi ini (0 = kuota beres).
  chainLeft: number;
  // Berapa yang wajib pagi ini (sisanya sengaja ditinggal untuk malam).
  chainQuota: number;
  // Berapa yang sudah didoakan hari ini.
  chainDoneCount: number;
  // Pokok doa tiap CL giliran hari ini — ditampilkan LANGSUNG di sini.
  chainLeaders: ChainLeader[];
  // Pokok doa syafaat hari ini (Senin Keluarga·Kesehatan, dst).
  topic: IntercessionTopic;
  // Sisa menit sampai jendela doa pagi tutup (jam 09.00). Dipakai untuk
  // hitung mundur peringatan & untuk menyembunyikan tombol lewati saat habis.
  minutesLeft: number;
  onConfirm: () => Promise<void>;
  onOpenRevive: () => void;
  // Buka WhatsApp berisi pokok doa CL itu, lalu tandai sudah didoakan.
  onPrayLeader: (leader: ChainLeader) => void;
  // Lewati doa pagi (keadaan mendesak): relakan streak hangus, langsung ke Home.
  onSkip: () => void;
}) {
  const [prayed, setPrayed] = useState(false);
  const [interceded, setInterceded] = useState(false);
  const [worshiped, setWorshiped] = useState(false);
  // CL mana yang pokok doanya sedang dibuka (null = semua tertutup). Satu saja
  // pada satu waktu — supaya gerbangnya tetap pendek & fokus.
  const [openChain, setOpenChain] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [skipConfirm, setSkipConfirm] = useState(false);
  // Langkah Revive & Doa Rantai HANYA tercentang otomatis dari datanya.
  const chainDone = !chainDue || chainLeft === 0;

  // Selasa & Kamis syafaatnya MEMANG Doa Rantai → tidak dibuat langkah
  // terpisah, cukup langkah Doa Rantai yang sudah ada (biar tidak dobel).
  // Kecuali kalau langkah itu tidak muncul (belum ada CL yang punya pokok doa
  // bulan ini) — supaya syafaat hari itu tidak hilang sama sekali.
  const chainIsToday = isChainTopic(topic);
  const showIntercession = !chainIsToday || !chainDue;

  // Nomor langkah dihitung dari langkah mana saja yang muncul hari ini.
  // Urutannya tetap: Revive → (Doa Rantai) → (Doa Syafaat) → Memuji &
  // Menyembah → Bapa Kami. Dua di tengah bisa absen tergantung hari; memuji &
  // menyembah dan Bapa Kami SELALU ada.
  const nChain = 2;
  const nIntercession = chainDue ? 3 : 2;
  const nWorship = 2 + (chainDue ? 1 : 0) + (showIntercession ? 1 : 0);
  const stepCount = nWorship + 1; // + Bapa Kami sebagai penutup
  const nPrayer = stepCount;

  const ready =
    prayed &&
    worshiped &&
    reviveDone &&
    chainDone &&
    (!showIntercession || interceded);

  // Peringatan mulai muncul 1 jam sebelum tutup. Lewat jam 09.00 doa pagi
  // hari ini terlewat sendiri — gerbangnya menghilang & streak 🔥 hangus.
  const closingSoon = minutesLeft > 0 && minutesLeft <= 60;
  const stillOpen = minutesLeft > 0;

  async function handleConfirm() {
    if (!ready || busy) return;
    setBusy(true);
    await onConfirm(); // gate hilang sendiri saat streak ter-update
    setBusy(false);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Animated.View entering={FadeIn.duration(400)} style={styles.header}>
          <VixText additionalStyle={styles.sun}>🌅</VixText>
          <VixText heading="header" additionalStyle={styles.title}>
            Selamat pagi!
          </VixText>
          <VixText heading="paragraph" additionalStyle={styles.subtitle}>
            Sebelum memulai hari, luangkan waktu bersama Bapa dulu 🙏
          </VixText>
          {streakCount > 0 && (
            <View style={styles.streakPill}>
              <VixText heading="bold" additionalStyle={styles.streakText}>
                🔥 {streakCount} hari berdoa
              </VixText>
            </View>
          )}
        </Animated.View>

        {/* Hitung mundur — muncul 1 jam terakhir sebelum jendelanya tutup. */}
        {closingSoon && (
          <Animated.View entering={FadeIn.duration(300)} style={styles.warnCard}>
            <VixText heading="bold" additionalStyle={styles.warnText}>
              ⏰ Tinggal {minutesLeft} menit lagi
            </VixText>
            <VixText heading="label" additionalStyle={styles.warnSub}>
              Lewat jam 09.00 doa pagi hari ini otomatis terlewat — gerbang ini
              menghilang sendiri & streak 🔥 hangus.
            </VixText>
          </Animated.View>
        )}

        {/* Langkah 1: Revive */}
        <Animated.View
          entering={FadeInDown.delay(220).duration(350)}
          style={styles.stepCard}>
          <VixText heading="title" additionalStyle={styles.stepTitle}>
            1. Revive
          </VixText>
          <PressableScale style={styles.openRevive} onPress={onOpenRevive}>
            <VixText heading="bold" additionalStyle={styles.openReviveText}>
              📖 Buka Revive →
            </VixText>
          </PressableScale>
          {/* Centang otomatis — TIDAK bisa ditekan manual; tercentang sendiri
              begitu Revive hari ini tersimpan. `locked` bikin cincinnya abu-abu
              supaya beda jelas dari langkah yang memang dicentang sendiri. */}
          <View style={styles.checkRow}>
            <CheckCircle checked={reviveDone} locked />
            <VixText heading="bold" additionalStyle={styles.checkText}>
              {reviveDone
                ? 'Sudah Revive hari ini'
                : '✅ otomatis setelah Tulis Revive'}
            </VixText>
          </View>
        </Animated.View>

        {/* Langkah 2: Doa Rantai — hanya di hari jadwalnya (Selasa & Kamis) */}
        {chainDue && (
          <Animated.View
            entering={FadeInDown.delay(270).duration(350)}
            style={styles.stepCard}>
            <VixText heading="title" additionalStyle={styles.stepTitle}>
              {nChain}. Doa Rantai
              {chainIsToday ? ` — syafaat hari ini ${topic.emoji}` : ''}
            </VixText>

            {chainLeaders.map((l) => {
              const open = openChain === l.id;
              return (
                <View key={l.id} style={styles.chainCard}>
                  <PressableScale
                    style={styles.chainTop}
                    onPress={() => setOpenChain(open ? null : l.id)}>
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
                          <VixText
                            key={`${i}-${p}`}
                            heading="paragraph"
                            additionalStyle={styles.pointText}>
                            🙏 {p}
                          </VixText>
                        ))
                      ) : (
                        <VixText
                          heading="label"
                          additionalStyle={styles.chainHint}>
                          Belum ada pokok doa bulan ini.
                        </VixText>
                      )}
                      {l.done ? (
                        <VixText
                          heading="label"
                          additionalStyle={styles.chainDone}>
                          ✅ Sudah didoakan hari ini
                        </VixText>
                      ) : l.phone ? (
                        <PressableScale
                          style={styles.waButton}
                          onPress={() => onPrayLeader(l)}>
                          <VixText heading="bold" additionalStyle={styles.waText}>
                            💬 Doakan lewat WhatsApp
                          </VixText>
                        </PressableScale>
                      ) : (
                        <VixText
                          heading="label"
                          additionalStyle={styles.chainHint}>
                          📱 Isi nomor HP-nya dulu di CORE → Leaders.
                        </VixText>
                      )}
                    </>
                  )}
                </View>
              );
            })}

            {/* Centang otomatis begitu semua CL giliran hari ini ditandai selesai. */}
            <View style={styles.checkRow}>
              <CheckCircle checked={chainLeft === 0} locked />
              <VixText heading="bold" additionalStyle={styles.checkText}>
                {chainLeft === 0
                  ? `Kuota pagi beres — ${chainDoneCount}/${chainLeaders.length} CORE Leader sudah didoakan`
                  : `Doakan ${chainLeft} CORE Leader lagi pagi ini (${chainDoneCount}/${chainQuota})`}
              </VixText>
            </View>
          </Animated.View>
        )}

        {/* Langkah Doa Syafaat — pokok doanya berganti tiap hari (Senin
            Keluarga·Kesehatan, Rabu Ekonomi, Sabtu Gereja, Minggu Negara).
            Selasa & Kamis dilewati karena sudah jadi langkah Doa Rantai. */}
        {showIntercession && (
          <Animated.View
            entering={FadeInDown.delay(290).duration(350)}
            style={styles.stepCard}>
            <VixText heading="title" additionalStyle={styles.stepTitle}>
              {nIntercession}. Doa Syafaat — {topic.emoji} {topic.label}
            </VixText>
            <View style={styles.prayerBox}>
              {topic.points.map((p) => (
                <VixText
                  key={p}
                  heading="paragraph"
                  additionalStyle={styles.pointText}>
                  • {p}
                </VixText>
              ))}
            </View>
            <PressableScale
              style={styles.checkRow}
              onPress={() => setInterceded((v) => !v)}>
              <CheckCircle checked={interceded} />
              <VixText heading="bold" additionalStyle={styles.checkText}>
                Sudah mendoakan syafaat hari ini
              </VixText>
            </PressableScale>
          </Animated.View>
        )}

        {/* Memuji & menyembah — tepat sebelum Bapa Kami. Ditaruh di sini
            dengan sengaja: sesudah membawa beban orang lain (syafaat), hati
            diangkat kepada Dia sendiri dulu, baru menutup dengan doa yang
            diajarkan Tuhan Yesus. Tiap hari, tanpa kecuali. */}
        <Animated.View
          entering={FadeInDown.delay(300).duration(350)}
          style={styles.stepCard}>
          <VixText heading="title" additionalStyle={styles.stepTitle}>
            {nWorship}. Memuji & Menyembah 🎶
          </VixText>
          <View style={styles.prayerBox}>
            <VixText heading="paragraph" additionalStyle={styles.prayerText}>
              {MAZMUR_95}
            </VixText>
            <VixText heading="label" additionalStyle={styles.verseRef}>
              — Mazmur 95:1–2
            </VixText>
          </View>
          <PressableScale
            style={styles.checkRow}
            onPress={() => setWorshiped((v) => !v)}>
            <CheckCircle checked={worshiped} />
            <VixText heading="bold" additionalStyle={styles.checkText}>
              Sudah memuji & menyembah Tuhan
            </VixText>
          </PressableScale>
        </Animated.View>

        {/* Langkah terakhir: Bapa Kami */}
        <Animated.View
          entering={FadeInDown.delay(120).duration(350)}
          style={styles.stepCard}>
          <VixText heading="title" additionalStyle={styles.stepTitle}>
            {nPrayer}. Doa Bapa Kami
          </VixText>
          <View style={styles.prayerBox}>
            <VixText heading="paragraph" additionalStyle={styles.prayerText}>
              {BAPA_KAMI}
            </VixText>
          </View>
          <PressableScale
            style={styles.checkRow}
            onPress={() => setPrayed((v) => !v)}>
            <CheckCircle checked={prayed} />
            <VixText heading="bold" additionalStyle={styles.checkText}>
              Sudah berdoa Bapa Kami
            </VixText>
          </PressableScale>
        </Animated.View>

        {/* Konfirmasi — aktif setelah semua langkah selesai */}
        <Animated.View entering={FadeInDown.delay(320).duration(350)}>
          {ready ? (
            <PrimaryButton
              label="✅ Konfirmasi & Mulai Hari"
              busy={busy}
              onPress={handleConfirm}
              additionalStyle={styles.confirm}
            />
          ) : (
            <View style={[styles.confirm, styles.confirmDisabled]}>
              <VixText
                heading="bold"
                additionalStyle={styles.confirmDisabledText}>
                Selesaikan {stepCount} langkah di atas 🙏
              </VixText>
            </View>
          )}
        </Animated.View>

        {/* Escape hatch: keadaan mendesak → relakan streak & langsung ke Home.
            Hanya selama jendelanya masih terbuka; lewat jam 09.00 tidak ada
            lagi yang perlu dilewati (hari ini sudah terlewat sendiri). */}
        {stillOpen && (
          <PressableScale
            style={styles.skipButton}
            onPress={() => setSkipConfirm(true)}>
            <VixText heading="label" additionalStyle={styles.skipText}>
              Keadaan mendesak? Lewati doa pagi hari ini — streak 🔥 hangus
            </VixText>
          </PressableScale>
        )}
      </ScrollView>

      {/* Konfirmasi sebelum melewatkan (streak hilang) */}
      <ConfirmDialog
        visible={skipConfirm}
        title="Lewati doa pagi?"
        detail="Streak 🔥 kamu akan hangus jadi 0. Yakin mau lewati dan langsung ke Home?"
        confirmLabel="Ya, lewati"
        onCancel={() => setSkipConfirm(false)}
        onConfirm={() => {
          setSkipConfirm(false);
          onSkip();
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.SPIRITUAL_DARK },
  content: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 32 },
  header: { alignItems: 'center', gap: 6, marginBottom: 18 },
  sun: { fontSize: 56, lineHeight: 68 },
  title: { color: Color.TEXT_REVERSE },
  subtitle: { color: Color.TEXT_ON_DARK_MUTED, textAlign: 'center' },
  streakPill: {
    backgroundColor: Color.SPIRITUAL,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 5,
    marginTop: 4,
  },
  streakText: { color: Color.SPIRITUAL_DARK },
  // Hitung mundur menuju jam 09.00 — krem, supaya menonjol di latar ungu
  // tanpa terasa seperti pesan kesalahan.
  warnCard: {
    backgroundColor: Color.ACCENT,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Color.ACCENT_DARK,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 2,
    marginBottom: 14,
  },
  warnText: { color: Color.ACCENT_DARK },
  warnSub: { color: Color.ACCENT_DARK },
  stepCard: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 20,
    padding: 18,
    gap: 12,
    marginBottom: 14,
  },
  stepTitle: { color: Color.TEXT_TITLE },
  prayerBox: {
    backgroundColor: Color.SPIRITUAL,
    borderRadius: 14,
    padding: 14,
  },
  prayerText: { color: Color.TEXT_TITLE, lineHeight: 24 },
  // Sumber ayat — sewarna judul fitur Spiritual, rata kanan seperti kutipan.
  verseRef: { color: Color.SPIRITUAL_DARK, textAlign: 'right', marginTop: 8 },
  // Butir pokok doa syafaat — sedikit lebih rapat dari teks Bapa Kami.
  pointText: { color: Color.TEXT_TITLE, lineHeight: 22 },
  // Kartu pokok doa 1 CORE Leader di dalam langkah Doa Rantai.
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
    gap: 8,
  },
  chainName: { color: Color.SPIRITUAL_DARK, flex: 1 },
  chainMeta: { color: Color.SPIRITUAL_DARK },
  chainHint: { color: Color.TEXT_LABEL },
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
  openRevive: {
    alignSelf: 'flex-start',
    backgroundColor: Color.SPIRITUAL,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  openReviveText: { color: Color.SPIRITUAL_DARK },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },
  checkText: { color: Color.TEXT_TITLE, flexShrink: 1 },
  confirm: { marginTop: 4 },
  skipButton: { alignItems: 'center', paddingVertical: 14, marginTop: 8 },
  skipText: { color: Color.TEXT_ON_DARK_MUTED, textAlign: 'center' },
  confirmDisabled: {
    backgroundColor: Color.SPIRITUAL,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    opacity: 0.85,
  },
  confirmDisabledText: { color: Color.SPIRITUAL_DARK },
});
