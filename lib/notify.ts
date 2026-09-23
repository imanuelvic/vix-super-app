import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants, { ExecutionEnvironment } from 'expo-constants';

import type { AchievementHint } from './achievements';
import { PACE_EMOJI } from './financeInsight';
import {
  isi,
  pilihKalimat,
  KOLAM_ACHIEVEMENT,
  KOLAM_BIBLE_MALAM,
  KOLAM_BIBLE_PAGI,
  KOLAM_BIBLE_SIANG,
  KOLAM_CORE,
  KOLAM_FINANCE_MALAM,
  KOLAM_JOURNEY,
  KOLAM_LIFE,
  KOLAM_REFLEKSI,
  KOLAM_RESCUE,
  KOLAM_WORK,
} from './notifyCopy';
import { catatKebiasaan, semuaJamPengingat, type Jam } from './notifyTiming';
import type { FinanceStatusInput, TodayModel } from './today';

// ============================ 🔔 Pengingat di HP ============================
//
// Notifikasi LOKAL (expo-notifications): dijadwalkan di HP sendiri, tanpa
// server, tanpa push token, tanpa biaya. Isinya = apa yang sudah dihitung
// Today Engine, jadi yang muncul di lock screen persis yang menunggu di layar
// Today — bukan daftar kedua yang bisa beda pendapat.
//
// ── Kenapa teksnya "keadaan terakhir", dan itu disebut terus terang ────────
// Notifikasi terjadwal itu STATIS: teksnya ditulis saat dijadwalkan, bukan
// saat berbunyi. App ini tidak punya server & tidak memakai tugas latar, jadi
// penjadwal ulangnya adalah app-nya sendiri: tiap layar Today digambar,
// seluruh jadwal ditulis ulang dengan keadaan terbaru. Buka app sekali sehari
// = notifikasi besok sudah benar.
//
// ── Yang menjaga supaya tidak berisik ─────────────────────────────────────
//   • Satu kelompok = satu notifikasi per hari (bukan per baris).
//   • Kelompok yang hari itu TIDAK punya isi tidak dijadwalkan sama sekali.
//   • Tiap kelompok bisa dimatikan sendiri (layar 🔔 Pengingat).
//   • Nomor di ikon app = jumlah baris "hari ini" di Today.
//
// ── Yang membuatnya tidak membosankan (23 Sep 2026, ala Duolingo) ─────────
//   • Kalimatnya BERGANTI tiap hari, dipilih dari tanggalnya (lib/notifyCopy).
//   • Jamnya IKUT KEBIASAAN: kelompok yang biasa kamu selesaikan jam 10 tidak
//     diingatkan jam 8.30 (lib/notifyTiming, semuanya di HP sendiri).
//   • Ada penyelamat streak malam hari: streak Morning Journey yang masih
//     hidup tapi hari itu belum dijalani dapat satu pengingat jam 20.45.
//   • Ada pengingat 🏆 pencapaian yang tinggal sedikit lagi, dari angka yang
//     terakhir dilihat layar Achievement.
//
// Modulnya NATIVE → butuh build EAS. Di Expo Go / build lama ia di-require
// lazy (pola lib/healthkit.ts) supaya JS-nya tetap aman dikirim lewat
// `eas update`: fiturnya diam, app tidak crash.

type NotifModule = typeof import('expo-notifications');

let cached: NotifModule | null | undefined;

function getModule(): NotifModule | null {
  if (cached !== undefined) return cached;
  const inExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
  if (inExpoGo) {
    cached = null;
    return cached;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = require('expo-notifications') as NotifModule;
    // Saat app terbuka, notifikasinya tetap tampil sebagai banner (bukan
    // diam-diam), tanpa bunyi. Angka di ikon diurus sendiri (lihat setBadge).
    cached.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  } catch {
    cached = null;
  }
  return cached;
}

/** Bisa dipakai di build ini? (modul native ada) */
export function notifyAvailable(): boolean {
  return getModule() !== null;
}

export type NotifyStatus = 'ok' | 'needs-build' | 'denied';

/** Kelompok pengingat — tiap kelompok bisa dimatikan sendiri. */
export type NotifyGroup =
  | 'journey'
  | 'bible'
  | 'core'
  | 'work'
  | 'life'
  | 'finance'
  | 'reflection'
  | 'achievement';

export type NotifyGroupMeta = {
  key: NotifyGroup;
  emoji: string;
  label: string;
  /** Kapan kelompok ini berbunyi (untuk keterangan di layar pengaturan). */
  when: string;
};

export const NOTIFY_GROUPS: NotifyGroupMeta[] = [
  { key: 'journey', emoji: '🌅', label: 'Morning Journey', when: 'Tiap pagi 06.00 · penyelamat streak 20.45' },
  { key: 'bible', emoji: '📖', label: 'Bacaan Alkitab', when: 'Pagi 07.00 · siang 12.30 · malam 21.15' },
  { key: 'core', emoji: '👥', label: 'CORE hari ini', when: 'Tiap pagi 08.30, kalau ada yang menunggu' },
  { key: 'work', emoji: '💼', label: 'Work hari ini', when: 'Tiap pagi 09.30, kalau ada tenggat' },
  { key: 'life', emoji: '🌿', label: 'Life hari ini', when: 'Tiap sore 17.30, kalau ada yang belum' },
  { key: 'finance', emoji: '💰', label: 'Finance', when: 'Pagi 07.30 status · malam 20.30 catat pengeluaran' },
  { key: 'achievement', emoji: '🏆', label: 'Pencapaian', when: 'Tiap malam 19.00, kalau ada yang hampir kebuka' },
  { key: 'reflection', emoji: '📝', label: 'Refleksi malam', when: 'Tiap malam 21.30' },
];

const MASTER_KEY = 'notify:on'; // "1" = seluruh pengingat aktif
const GROUP_KEY = (g: NotifyGroup) => `notify:group:${g}`; // "0" = kelompok dimatikan
const IDS_KEY = 'notify:ids'; // id notifikasi yang KITA jadwalkan
// Kunci lama (22 Sep 2026, hanya Finance) — dibaca sekali supaya sakelar yang
// dulu sudah dinyalakan tidak mati diam-diam saat pindah ke mesin ini.
const LEGACY_FINANCE_KEY = 'finance:notify';
const LEGACY_IDS_KEY = 'finance:notify:ids';

export async function notifyEnabled(): Promise<boolean> {
  try {
    const nilai = await AsyncStorage.getItem(MASTER_KEY);
    if (nilai !== null) return nilai === '1';
    return (await AsyncStorage.getItem(LEGACY_FINANCE_KEY)) === '1';
  } catch {
    return false;
  }
}

/** Kelompok ini aktif? (bawaannya AKTIF selama tidak dimatikan sendiri) */
export async function groupEnabled(group: NotifyGroup): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(GROUP_KEY(group))) !== '0';
  } catch {
    return true;
  }
}

export async function setGroupEnabled(group: NotifyGroup, on: boolean): Promise<void> {
  await AsyncStorage.setItem(GROUP_KEY(group), on ? '1' : '0').catch(() => {});
  terakhir = ''; // paksa jadwal ditulis ulang di sinkron berikutnya
}

/**
 * Sakelar utama: nyalakan (minta izin dulu) / matikan (batalkan semua jadwal
 * & nolkan angka di ikon). Mengembalikan statusnya supaya layarnya bisa jujur
 * bilang "butuh build baru" atau "izin ditolak".
 */
export async function setNotifyEnabled(on: boolean): Promise<NotifyStatus> {
  const mod = getModule();
  if (!mod) return 'needs-build';
  if (!on) {
    await batalkanJadwal(mod);
    await mod.setBadgeCountAsync(0).catch(() => false);
    await AsyncStorage.setItem(MASTER_KEY, '0').catch(() => {});
    return 'ok';
  }
  let izin = await mod.getPermissionsAsync();
  if (!izin.granted) {
    izin = await mod.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: true, allowSound: false },
    });
  }
  if (!izin.granted) return 'denied';
  await AsyncStorage.setItem(MASTER_KEY, '1').catch(() => {});
  terakhir = '';
  return 'ok';
}

async function batalkanJadwal(mod: NotifModule): Promise<void> {
  try {
    const kunci = [IDS_KEY, LEGACY_IDS_KEY];
    for (const k of kunci) {
      const raw = await AsyncStorage.getItem(k);
      const ids: string[] = raw ? JSON.parse(raw) : [];
      for (const id of ids) await mod.cancelScheduledNotificationAsync(id).catch(() => {});
      await AsyncStorage.removeItem(k).catch(() => {});
    }
  } catch {
    // Jadwal lama tak terbaca = paling buruk ada notifikasi ganda sekali.
  }
}

// ============================ Isi tiap pengingat ============================

export type NotifySlot = {
  id: string;
  group: NotifyGroup;
  hour: number;
  minute: number;
  title: string;
  /** Kalimatnya; null = hari itu memang tidak ada yang perlu dibunyikan. */
  body: string | null;
};

/** Satu baris ringkas: "🔥 Visitasi CORE 💜 Novia" (tanpa keterangan panjang). */
function ringkas(judul: string, emoji: string): string {
  return `${emoji} ${judul}`;
}

function gabung(baris: string[], maks = 3): string {
  return baris.slice(0, maks).join(' · ').slice(0, 220);
}

/** Angka pencapaian yang terakhir dilihat layar Achievement 🏆. */
export type AchievementSnapshot = {
  /** Yang tinggal sedikit lagi (paling dekat selesai duluan). */
  hints: AchievementHint[];
  unlocked: number;
  total: number;
};

export type NotifyOptions = {
  /** Tanggal hari ini — penentu kalimat mana yang dipakai hari ini. */
  dayId: string;
  /** Jam yang sudah belajar dari kebiasaan (lib/notifyTiming.ts). */
  jam?: Partial<Record<NotifyGroup, Jam>>;
  /** Pencapaian terakhir yang tercatat; null = layar Achievement belum dibuka. */
  achv?: AchievementSnapshot | null;
};

/**
 * Susun seluruh pengingat hari ini dari model Today (+ status Finance yang
 * memang tidak boleh menyebut nominal). MURNI: tidak menyentuh sistem, jadi
 * bisa diuji apa adanya. Kalimat & jamnya ikut `opts` supaya tetap murni.
 */
export function buildSlots(
  model: TodayModel,
  finance: FinanceStatusInput | null,
  opts: NotifyOptions,
): NotifySlot[] {
  const semua = [...model.today, ...model.upNext];
  const baris = (section: 'core' | 'work' | 'life') =>
    model.today.filter((i) => i.section === section).map((i) => ringkas(i.title, i.emoji));

  const core = baris('core');
  const work = baris('work');
  const life = baris('life');
  const bacaan = model.god.lines.filter((l) => l.id.startsWith('bible-') && !l.done);
  const puasa = model.god.lines.find((l) => l.id === 'fasting' && !l.done);

  const { dayId } = opts;
  /** Jam kelompok ini: hasil belajar kebiasaan, atau jam bawaannya. */
  const jam = (group: NotifyGroup, hour: number, minute: number): Jam =>
    opts.jam?.[group] ?? { hour, minute };
  const pagi = pilihKalimat(KOLAM_JOURNEY, dayId, 'journey');
  const streakHidup = model.god.streak > 1 && model.god.state !== 'done';
  const rescue = pilihKalimat(KOLAM_RESCUE, dayId, 'rescue');
  const bacaPagi = pilihKalimat(KOLAM_BIBLE_PAGI, dayId, 'pagi');
  const bacaSiang = pilihKalimat(KOLAM_BIBLE_SIANG, dayId, 'siang');
  const bacaMalam = pilihKalimat(KOLAM_BIBLE_MALAM, dayId, 'malam');
  const uangMalam = pilihKalimat(KOLAM_FINANCE_MALAM, dayId, 'uang');
  const renung = pilihKalimat(KOLAM_REFLEKSI, dayId, 'renung');
  const achv = opts.achv ?? null;
  const hampir = achv?.hints ?? [];

  const slots: NotifySlot[] = [
    {
      id: 'journey',
      group: 'journey',
      ...jam('journey', 6, 0),
      title: pagi.title,
      body:
        pagi.body +
        (model.god.streak > 1 ? ` Streak ${model.god.streak} hari 🔥` : ''),
    },
    {
      // Penyelamat streak: cuma berbunyi kalau streaknya masih hidup DAN hari
      // ini belum dijalani. Journey dijalani di dalam app, jadi kalau ia sudah
      // selesai app pasti sempat terbuka dan jadwal ini sudah dibatalkan.
      id: 'journey-rescue',
      group: 'journey',
      hour: 20,
      minute: 45,
      title: isi(rescue.title, { streak: String(model.god.streak) }),
      body: streakHidup ? isi(rescue.body, { streak: String(model.god.streak) }) : null,
    },
    {
      id: 'bible-morning',
      group: 'bible',
      hour: 7,
      minute: 0,
      title: bacaPagi.title,
      body: bacaPagi.body,
    },
    {
      id: 'bible-midday',
      group: 'bible',
      hour: 12,
      minute: 30,
      title: bacaSiang.title,
      body: bacaSiang.body,
    },
    {
      id: 'bible-night',
      group: 'bible',
      hour: 21,
      minute: 15,
      title: bacaMalam.title,
      body: puasa ? `${bacaMalam.body} ${puasa.title}: sudah dijalani?` : bacaMalam.body,
    },
    {
      id: 'core',
      group: 'core',
      ...jam('core', 8, 30),
      title: pilihKalimat(KOLAM_CORE, dayId, 'core'),
      body: core.length > 0 ? gabung(core) : null,
    },
    {
      id: 'work',
      group: 'work',
      ...jam('work', 9, 30),
      title: pilihKalimat(KOLAM_WORK, dayId, 'work'),
      body: work.length > 0 ? gabung(work) : null,
    },
    {
      id: 'life',
      group: 'life',
      ...jam('life', 17, 30),
      title: pilihKalimat(KOLAM_LIFE, dayId, 'life'),
      body: life.length > 0 ? gabung(life) : null,
    },
    {
      id: 'finance-morning',
      group: 'finance',
      hour: 7,
      minute: 30,
      title: `💰 Finance hari ini ${finance?.emoji ?? PACE_EMOJI['on-track']}`,
      body: finance
        ? gabung(finance.lines, 2)
        : 'Cek Safe to Spend sebelum pengeluaran yang tidak direncanakan.',
    },
    {
      id: 'finance-evening',
      group: 'finance',
      hour: 20,
      minute: 30,
      title: uangMalam.title,
      body: uangMalam.body,
    },
    {
      // 🏆 Godaan pencapaian: "tinggal 1 sesi lagi" cuma menarik kalau angkanya
      // memang sudah jalan, jadi tanpa data ia diam.
      id: 'achievement',
      group: 'achievement',
      hour: 19,
      minute: 0,
      title: pilihKalimat(KOLAM_ACHIEVEMENT, dayId, 'achv'),
      body:
        hampir.length > 0
          ? gabung(
              [
                ...hampir.map((h) => `${h.icon} ${h.title} ${h.now}/${h.target}`),
                achv ? `🏆 ${achv.unlocked} dari ${achv.total} kebuka` : '',
              ].filter(Boolean),
              3,
            )
          : null,
    },
    {
      id: 'reflection',
      group: 'reflection',
      ...jam('reflection', 21, 30),
      title: renung.title,
      body: renung.body,
    },
  ];

  // Bacaan yang jendelanya sedang terbuka & belum diisi disebut lebih tegas.
  for (const b of bacaan) {
    const slot = slots.find((s) => s.id === `bible-${b.id.replace('bible-', '')}`);
    if (slot) slot.title = `${b.emoji} ${b.title}`;
  }
  // Tidak ada satu pun yang menunggu hari ini → pengingat kelompok diam.
  if (semua.length === 0) {
    for (const s of slots) if (s.group === 'core' || s.group === 'work' || s.group === 'life') s.body = null;
  }
  return slots;
}

// ==================== Angka pencapaian untuk pengingat 🏆 ====================
// Layar Achievement yang punya angkanya (9 langganan kecil). Menyalakan
// langganan itu juga di layar Today cuma demi satu notifikasi jelas rugi, jadi
// layar Achievement MENITIPKAN angkanya di sini tiap kali dibuka, dan penjadwal
// harian membacanya. Belum pernah dibuka = kelompok 🏆 diam.

const ACHV_KEY = 'notify:achievement';

export async function saveAchievementSnapshot(snap: AchievementSnapshot): Promise<void> {
  await AsyncStorage.setItem(ACHV_KEY, JSON.stringify(snap)).catch(() => {});
  terakhir = ''; // isinya berubah → jadwal ditulis ulang di sinkron berikutnya
}

export async function loadAchievementSnapshot(): Promise<AchievementSnapshot | null> {
  try {
    const raw = await AsyncStorage.getItem(ACHV_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<AchievementSnapshot>;
    if (!Array.isArray(v.hints)) return null;
    return {
      hints: v.hints.slice(0, 3),
      unlocked: typeof v.unlocked === 'number' ? v.unlocked : 0,
      total: typeof v.total === 'number' ? v.total : 0,
    };
  } catch {
    return null;
  }
}

let terakhir = '';

/**
 * Tulis ulang seluruh jadwal dengan keadaan terbaru. Tidak melakukan apa-apa
 * kalau sakelarnya mati, modulnya tak ada, atau isinya sama dengan yang
 * terakhir dijadwalkan (hemat tulisan ke sistem).
 *
 * Angka di ikon app ikut disetel = jumlah baris "hari ini" di Today.
 */
export async function syncNotifications(
  model: TodayModel,
  finance: FinanceStatusInput | null,
  todayId: string,
): Promise<void> {
  const mod = getModule();
  if (!mod) return;
  if (!(await notifyEnabled())) return;

  // Kelompok yang hari ini masih punya isi → bahan belajar jam kebiasaan.
  // Dicatat lebih dulu supaya jam yang dipakai di bawah sudah yang terbaru.
  const terisi: NotifyGroup[] = [];
  if (model.god.state !== 'done') terisi.push('journey');
  for (const g of ['core', 'work', 'life'] as const) {
    if (model.today.some((i) => i.section === g)) terisi.push(g);
  }
  if (model.reflection.available && !model.reflection.written) terisi.push('reflection');
  await catatKebiasaan(terisi, todayId, new Date());

  const opts: NotifyOptions = {
    dayId: todayId,
    jam: await semuaJamPengingat(),
    achv: await loadAchievementSnapshot(),
  };

  const slots: NotifySlot[] = [];
  for (const s of buildSlots(model, finance, opts)) {
    if (s.body === null) continue;
    if (!(await groupEnabled(s.group))) continue;
    slots.push(s);
  }
  const jumlahHariIni = model.today.length;
  const sidik = `${jumlahHariIni}|${slots
    .map((s) => `${s.id}@${s.hour}:${s.minute}|${s.title}|${s.body}`)
    .join('\n')}`;
  if (sidik === terakhir) return;
  terakhir = sidik;

  try {
    await batalkanJadwal(mod);
    const DAILY = mod.SchedulableTriggerInputTypes.DAILY;
    const ids: string[] = [];
    for (const s of slots) {
      ids.push(
        await mod.scheduleNotificationAsync({
          content: { title: s.title, body: s.body ?? '' },
          trigger: { type: DAILY, hour: s.hour, minute: s.minute },
        }),
      );
    }
    await AsyncStorage.setItem(IDS_KEY, JSON.stringify(ids));
    await mod.setBadgeCountAsync(jumlahHariIni).catch(() => false);
  } catch {
    terakhir = '';
  }
}
