import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { FormInput } from '@/components/common/FormInput';
import { KeyboardAwareScrollView } from '@/components/common/KeyboardAwareScrollView';
import { PressableScale } from '@/components/common/PressableScale';
import { ScreenError } from '@/components/common/ScreenError';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { SelectField, type SelectOption } from '@/components/common/SelectField';
import { StickyTop } from '@/components/common/StickyTop';
import { VixText } from '@/components/common/VixText';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/contexts/auth';
import {
  CHAT_CATEGORIES,
  fillTemplate,
  hasPlaceholder,
  todayName,
  type ChatCategory,
  type ChatField,
} from '@/lib/chatTemplates';
import { subscribeCoreLeaders, type CoreLeader } from '@/lib/core';
import {
  openWhatsAppChat,
  shareTextToWhatsApp,
  WHATSAPP_ERROR,
} from '@/lib/whatsapp';

// Template Chat 💬 — kata-kata siap kirim untuk CORE Leader & grup CORE.
//
// Alurnya sengaja sependek mungkin: isi nama (atau click chip CL-nya) → buka
// kategorinya → baca ketiga pilihannya → tekan "Kirim". WhatsApp terbuka dengan
// teksnya sudah terisi, tinggal pilih mau ke chat siapa atau ke grup.
//
// Teksnya sendiri ada di lib/chatTemplates.ts — layar ini cuma menampilkan &
// mengisi penandanya. Tak ada satu pun pembacaan Firestore khusus di sini;
// daftar CL yang didengarkan memang sudah dipakai layar CORE.

// Dua pilihan yang BUKAN CORE Leader di dropdown nama. Diawali garis bawah
// supaya mustahil bentrok dengan id CL (id CL selalu "cr…").
const GRUP = '__grup__';
const MANUAL = '__manual__';

export default function ChatTemplatesScreen() {
  const { user } = useAuth();
  const router = useRouter();

  const [leaders, setLeaders] = useState<CoreLeader[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Isian penanda. Dipakai bersama SEMUA kategori — ganti nama sekali,
  // seluruh pilihan di layar ikut berubah.
  //
  // Yang disimpan cuma PILIHAN di dropdown (+ nama ketikan kalau "nama lain").
  // Nama jadinya diturunkan dari situ, bukan disalin ke state kedua — kalau
  // disalin, mengganti nama CL di layar CORE tidak akan ikut terbarui di sini.
  const [pilihan, setPilihan] = useState<string>(GRUP);
  const [namaLain, setNamaLain] = useState('');
  const [gelar, setGelar] = useState('');

  // Kategori yang sedang dibuka. null = SEMUANYA tertutup, dan itu keadaan
  // awalnya: satu kategori yang terbuka sendiri mendorong kategori lain jauh ke
  // bawah layar, jadi yang lain seolah tidak ada. Tertutup semua = seluruh
  // daftarnya kelihatan sekali pandang, tinggal pilih.
  const [openKey, setOpenKey] = useState<string | null>(null);

  const hariIni = todayName();

  useEffect(() => {
    if (!user) return;
    return subscribeCoreLeaders(user.uid, setLeaders, () => undefined);
  }, [user]);

  /**
   * Kirim ke WhatsApp. Dua jalan, dan yang menentukan siapa yang dituju:
   *
   *   • CL tertentu YANG NOMORNYA SUDAH ADA → chat orang itu dibuka LANGSUNG.
   *     Templat ini memang ditulis untuk satu orang (namanya sudah disisipkan
   *     ke dalam kalimatnya), jadi masih disuruh memilih chat lagi di WhatsApp
   *     itu satu langkah yang tidak perlu — dan satu peluang salah kirim.
   *   • Grup CORE, nama ketikan sendiri, atau CL yang nomornya belum diisi →
   *     seperti dulu: WhatsApp terbuka dengan teksnya siap, tujuannya kamu
   *     pilih sendiri. Ini BUKAN kegagalan, jadi tidak ada pesan galat —
   *     keterangannya sudah tertulis di bawah kolom nama.
   */
  function handleSend(text: string) {
    setError(null);
    if (cl?.phone) {
      openWhatsAppChat(cl.phone, text, () => setError(WHATSAPP_ERROR));
      return;
    }
    shareTextToWhatsApp(text, () => setError(WHATSAPP_ERROR));
  }

  // Kolom isian yang perlu ditampilkan = gabungan kebutuhan kategori yang
  // sedang dibuka. Tertutup semua → cukup kolom nama.
  const open = CHAT_CATEGORIES.find((c) => c.key === openKey) ?? null;
  const fields: ChatField[] = open ? open.fields : ['nama'];

  // Isi dropdown: grup dulu (paling sering — Motivational Words tiap pagi),
  // lalu para CL, dan "ketik sendiri" paling bawah untuk orang di luar daftar.
  const pilihanNama: SelectOption<string>[] = [
    { key: GRUP, label: '👥 Grup CORE', sub: 'Tanpa nama — untuk kirim ke grup' },
    ...leaders.map((l) => ({ key: l.id, label: `${l.heart} ${l.name}` })),
    { key: MANUAL, label: '✍️ Ketik nama lain…', sub: 'Untuk orang di luar daftar CL' },
  ];

  // Nama yang benar-benar dipakai mengisi penanda {nama}. Grup (atau CL yang
  // sudah dihapus) → kosong, persis seperti kolom yang dikosongkan dulu.
  // CORE Leader yang sedang dituju — null kalau tujuannya Grup CORE atau nama
  // yang diketik sendiri. Dari sinilah nomor WA-nya diambil.
  const cl =
    pilihan === GRUP || pilihan === MANUAL
      ? null
      : (leaders.find((l) => l.id === pilihan) ?? null);

  const nama = pilihan === MANUAL ? namaLain.trim() : (cl?.name ?? '');

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        backLabel="CORE"
        title="Template Chat 💬"
        subtitle="Pilih kata-katanya, langsung kirim ke WhatsApp"
      />

      <ScreenError message={error} />

      {/* Kolom nama DIPATOK di atas — tidak ikut tergulung. Nama yang dituju
          menempel ke SEMUA kategori, jadi saat menggulir ke bawah membandingkan
          pilihan kata-katanya, kolom ini tetap terlihat & bisa langsung
          diganti. Dipatok sebagai SAUDARA daftar (bukan posisi absolute), jadi
          isinya mulai persis di bawahnya — tidak ada yang tertutupi. */}
      {fields.includes('nama') && (
        <StickyTop>
          <VixText heading="label" additionalStyle={styles.fieldLabel}>
            🙋 Nama yang dituju
          </VixText>
          {/* Dulu di sini ada kolom ketik + sepuluh chip nama CL yang memakan
              setengah layar. Sekarang satu dropdown: daftarnya baru terbuka
              saat ditekan, jadi kata-kata templatnya langsung kelihatan. */}
          <SelectField
            value={pilihan}
            options={pilihanNama}
            onChange={(key) => key && setPilihan(key)}
          />
          {/* Kolom ketik hanya muncul kalau memang "nama lain" — orang di luar
              daftar CL tetap bisa dituju, tidak ada yang hilang. */}
          {pilihan === MANUAL && (
            <FormInput
              style={styles.manualInput}
              placeholder="Nama orangnya"
              value={namaLain}
              onChangeText={setNamaLain}
              autoFocus
            />
          )}
          {/* Ke mana tombol "Kirim" akan bermuara — ditulis SEBELUM ditekan.
              Tanpa ini, dua perilaku yang berbeda (langsung ke chat orangnya
              vs. memilih chat sendiri) cuma bisa diketahui dengan mencobanya,
              dan yang nomornya belum diisi terasa seperti fitur yang rusak. */}
          {cl && (
            <PressableScale
              style={styles.tujuan}
              disabled={!!cl.phone}
              onPress={() =>
                router.push({ pathname: '/core', params: { tab: 'leaders' } })
              }>
              <VixText
                heading="label"
                additionalStyle={cl.phone ? styles.tujuanOn : styles.tujuanOff}>
                {cl.phone
                  ? `💬 Langsung ke chat ${cl.name} · +62${cl.phone}`
                  : `⚠️ Nomor WA ${cl.name} belum diisi — nanti masih pilih chat sendiri. Isi di CORE › Leaders ›`}
              </VixText>
            </PressableScale>
          )}
          <View style={styles.stickyGap} />
        </StickyTop>
      )}

      <KeyboardAwareScrollView contentContainerStyle={styles.content}>
        {fields.includes('gelar') && (
          <>
            <VixText heading="label" additionalStyle={styles.fieldLabel}>
              🎓 Gelarnya
            </VixText>
            <FormInput
              style={styles.formGap}
              placeholder="Mis. S.Kom"
              value={gelar}
              onChangeText={setGelar}
            />
          </>
        )}

        {/* ===== Daftar kategori ===== */}
        {CHAT_CATEGORIES.map((cat) => (
          <CategoryCard
            key={cat.key}
            category={cat}
            expanded={openKey === cat.key}
            today={hariIni}
            values={{ nama, gelar }}
            onToggle={() => setOpenKey(openKey === cat.key ? null : cat.key)}
            onSend={handleSend}
          />
        ))}
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

// Satu kategori: judul + penjelas, lalu pilihan kata-katanya saat dibuka.
function CategoryCard({
  category,
  expanded,
  today,
  values,
  onToggle,
  onSend,
}: {
  category: ChatCategory;
  expanded: boolean;
  /** Nama hari ini — menyorot pilihan Motivational Words yang pas. */
  today: string;
  values: Partial<Record<ChatField, string>>;
  onToggle: () => void;
  onSend: (text: string) => void;
}) {
  return (
    <View style={styles.card}>
      <PressableScale style={styles.cardHeader} onPress={onToggle} scaleTo={0.99}>
        <View style={styles.cardHeadMain}>
          <VixText heading="bold" additionalStyle={styles.cardTitle}>
            {category.title}
          </VixText>
          <VixText heading="label">{category.hint}</VixText>
        </View>
        <IconSymbol
          name={expanded ? 'chevron.up' : 'chevron.down'}
          size={18}
          color={Color.TEXT_LABEL}
        />
      </PressableScale>

      {expanded && (
        <Animated.View entering={FadeIn.duration(220)} style={styles.variantList}>
          {category.variants.map((v) => {
            const text = fillTemplate(v.text, values);
            // Motivational Words: yang cocok dengan hari ini diberi tanda,
            // supaya tiap pagi tak perlu mencari sendiri.
            const isToday = category.byDay === true && v.key === today;
            return (
              <View
                key={v.key}
                style={[styles.variant, isToday && styles.variantToday]}>
                <View style={styles.variantTop}>
                  <View style={[styles.keyPill, isToday && styles.keyPillToday]}>
                    <VixText
                      heading="label"
                      additionalStyle={
                        isToday ? styles.keyPillTodayText : styles.keyPillText
                      }>
                      {v.key}
                    </VixText>
                  </View>
                  {isToday && (
                    <VixText heading="label" additionalStyle={styles.todayTag}>
                      hari ini
                    </VixText>
                  )}
                  <PressableScale
                    style={styles.sendButton}
                    onPress={() => onSend(text)}>
                    <VixText heading="bold" additionalStyle={styles.sendText}>
                      Kirim 💬
                    </VixText>
                  </PressableScale>
                </View>
                <VixText heading="paragraph" additionalStyle={styles.variantText}>
                  {text}
                </VixText>
                {hasPlaceholder(text) && (
                  <VixText heading="label" additionalStyle={styles.warnText}>
                    ⚠️ Masih ada penanda yang belum diisi — isi di atas, atau
                    ketik langsung di WhatsApp.
                  </VixText>
                )}
              </View>
            );
          })}
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.BACKGROUND },
  content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 40 },
  fieldLabel: { marginBottom: 6 },
  formGap: { marginBottom: 10 },
  manualInput: { marginTop: 8 },
  // Keterangan tujuan kirim, tepat di bawah kolom nama.
  tujuan: { marginTop: 8 },
  tujuanOn: { color: Color.MAIN_DARK },
  tujuanOff: { color: Color.WARNING },
  // Jarak dropdown ke kartu kategori pertama. Ditaruh sebagai elemen sendiri,
  // bukan margin bawah SelectField — daftar pilihannya terbuka INLINE di bawah
  // kolom, jadi margin di kolomnya akan menyisipkan celah di tengah.
  stickyGap: { height: 10 },
  card: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Color.BORDER,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardHeadMain: { flex: 1, gap: 1 },
  cardTitle: { color: Color.TEXT_TITLE },
  variantList: { gap: 10, marginTop: 12 },
  variant: {
    backgroundColor: Color.BACKGROUND,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Color.BORDER,
    padding: 12,
    gap: 8,
  },
  // Pilihan yang cocok dengan hari ini — dibingkai warna utama.
  variantToday: { borderColor: Color.MAIN, backgroundColor: Color.MAIN_TRANSPARENT },
  variantTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  keyPill: {
    minWidth: 30,
    alignItems: 'center',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
    backgroundColor: Color.CONTRAST_CONTAINER,
  },
  keyPillText: { color: Color.TEXT_PARAGRAPH },
  keyPillToday: { backgroundColor: Color.MAIN },
  keyPillTodayText: { color: Color.TEXT_REVERSE },
  todayTag: { color: Color.MAIN_DARK },
  sendButton: {
    marginLeft: 'auto',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: Color.MAIN,
  },
  sendText: { color: Color.TEXT_REVERSE },
  variantText: { color: Color.TEXT_PARAGRAPH },
  warnText: { color: Color.WARNING },
});
