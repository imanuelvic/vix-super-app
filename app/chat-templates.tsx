import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { Chip } from '@/components/common/Chip';
import { FormInput } from '@/components/common/FormInput';
import { KeyboardAwareScrollView } from '@/components/common/KeyboardAwareScrollView';
import { PressableScale } from '@/components/common/PressableScale';
import { ScreenError } from '@/components/common/ScreenError';
import { ScreenHeader } from '@/components/common/ScreenHeader';
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
import { shareTextToWhatsApp, WHATSAPP_ERROR } from '@/lib/whatsapp';

// Template Chat 💬 — kata-kata siap kirim untuk CORE Leader & grup CORE.
//
// Alurnya sengaja sependek mungkin: isi nama (atau ketuk chip CL-nya) → buka
// kategorinya → baca ketiga pilihannya → tekan "Kirim". WhatsApp terbuka dengan
// teksnya sudah terisi, tinggal pilih mau ke chat siapa atau ke grup.
//
// Teksnya sendiri ada di lib/chatTemplates.ts — layar ini cuma menampilkan &
// mengisi penandanya. Tak ada satu pun pembacaan Firestore khusus di sini;
// daftar CL yang didengarkan memang sudah dipakai layar CORE.
export default function ChatTemplatesScreen() {
  const { user } = useAuth();

  const [leaders, setLeaders] = useState<CoreLeader[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Isian penanda. Dipakai bersama SEMUA kategori — ganti nama sekali,
  // seluruh pilihan di layar ikut berubah.
  const [nama, setNama] = useState('');
  const [gelar, setGelar] = useState('');

  // Kategori yang sedang dibuka. Default: Motivational Words — itu yang
  // dikirim tiap pagi, jadi paling sering dicari.
  const [openKey, setOpenKey] = useState<string | null>('motivational');

  const hariIni = todayName();

  useEffect(() => {
    if (!user) return;
    return subscribeCoreLeaders(user.uid, setLeaders, () => undefined);
  }, [user]);

  function handleSend(text: string) {
    setError(null);
    shareTextToWhatsApp(text, () => setError(WHATSAPP_ERROR));
  }

  // Kolom isian yang perlu ditampilkan = gabungan kebutuhan kategori yang
  // sedang dibuka. Tertutup semua → cukup kolom nama.
  const open = CHAT_CATEGORIES.find((c) => c.key === openKey) ?? null;
  const fields: ChatField[] = open ? open.fields : ['nama'];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        backLabel="CORE"
        title="Template Chat 💬"
        subtitle="Pilih kata-katanya, langsung kirim ke WhatsApp"
      />

      <ScreenError message={error} />

      <KeyboardAwareScrollView contentContainerStyle={styles.content}>
        {/* ===== Isian penanda ===== */}
        {fields.includes('nama') && (
          <>
            <VixText heading="label" additionalStyle={styles.fieldLabel}>
              🙋 Nama yang dituju
            </VixText>
            <FormInput
              style={styles.formGap}
              placeholder="Kosongkan kalau untuk grup"
              value={nama}
              onChangeText={setNama}
            />
            {/* Pintasan nama CL — supaya tidak perlu mengetik & tidak salah
                tulis. Ketuk lagi yang sedang aktif untuk mengosongkannya. */}
            {leaders.length > 0 && (
              <View style={styles.chipWrap}>
                {leaders.map((l) => (
                  <Chip
                    key={l.id}
                    label={`${l.heart} ${l.name}`}
                    active={nama === l.name}
                    onPress={() => setNama(nama === l.name ? '' : l.name)}
                  />
                ))}
              </View>
            )}
          </>
        )}

        {fields.includes('gelar') && (
          <>
            <VixText heading="label" additionalStyle={styles.fieldLabel}>
              🎓 Gelarnya
            </VixText>
            <FormInput
              style={styles.formGap}
              placeholder="mis. S.Kom"
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

        <VixText heading="label" additionalStyle={styles.footNote}>
          💡 Ucapan ulang tahun tidak ada di sini — tempatnya di kartu ulang
          tahun sub-tab Follow Up, lengkap dengan doa & undangannya.
        </VixText>
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
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
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
  footNote: { color: Color.TEXT_LABEL, marginTop: 6 },
});
