import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { DualButtons } from '@/components/common/DualButtons';
import { FormError } from '@/components/common/FormError';
import { FormInput } from '@/components/common/FormInput';
import { PressableScale } from '@/components/common/PressableScale';
import { SheetModal } from '@/components/common/SheetModal';
import { VixText } from '@/components/common/VixText';
import { useAuth } from '@/contexts/auth';
import { SAVE_ERROR } from '@/lib/messages';
import { saveSelfKnowledge, type SelfKnowledge } from '@/lib/selfKnowledge';

// Tab berbentuk KUADRAN — dipakai bersama oleh Ikigai (4 lingkaran) dan SWOT
// (4 kotak). Bentuknya sama persis: satu kartu berwarna per kuadran, ketuk
// untuk mengisi. Satu komponen, dua fitur — biar tidak ada kode kembar.
export type Quadrant<K extends string> = {
  key: K;
  emoji: string;
  title: string;
  hint: string; // pertanyaan pemancing saat masih kosong
  bg: string;
  fg: string;
};

export function QuadrantTab<K extends string>({
  part,
  values,
  quadrants,
  intro,
  footerKey,
  footerTitle,
  footerHint,
}: {
  /** Bagian dokumen yang disimpan: 'ikigai' atau 'swot'. */
  part: 'ikigai' | 'swot';
  values: Record<string, string>;
  quadrants: Quadrant<K>[];
  intro: string;
  /** Kolom kesimpulan di bawah (mis. kalimat Ikigai). Kosongkan bila tak ada. */
  footerKey?: string;
  footerTitle?: string;
  footerHint?: string;
}) {
  const { user } = useAuth();

  // Kolom yang sedang diedit (null = modal tertutup).
  const [editing, setEditing] = useState<{ key: string; title: string; hint: string } | null>(null);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openEdit(key: string, title: string, hint: string) {
    setEditing({ key, title, hint });
    setText(values[key] ?? '');
    setError(null);
  }

  async function handleSave() {
    if (!user || !editing || saving) return;
    setSaving(true);
    setError(null);
    try {
      // merge → kuadran lain (dan bagian lain dokumen) tidak tersentuh.
      await saveSelfKnowledge(user.uid, {
        [part]: { [editing.key]: text.trim() },
      } as Partial<SelfKnowledge>);
      setEditing(null);
    } catch {
      setError(SAVE_ERROR);
    } finally {
      setSaving(false);
    }
  }

  const filled = quadrants.filter((q) => (values[q.key] ?? '').trim()).length;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.introCard}>
        <VixText heading="label" additionalStyle={styles.introText}>
          {intro}
        </VixText>
        <VixText heading="bold" additionalStyle={styles.introCount}>
          {filled}/{quadrants.length} kolom terisi
        </VixText>
      </View>

      {quadrants.map((q) => {
        const value = (values[q.key] ?? '').trim();
        return (
          <PressableScale
            key={q.key}
            style={[styles.card, { backgroundColor: q.bg, borderColor: q.fg }]}
            onPress={() => openEdit(q.key, `${q.emoji} ${q.title}`, q.hint)}>
            <VixText heading="bold" additionalStyle={{ color: q.fg }}>
              {q.emoji} {q.title}
            </VixText>
            <VixText
              heading="paragraph"
              additionalStyle={value ? styles.value : styles.empty}>
              {value || q.hint}
            </VixText>
          </PressableScale>
        );
      })}

      {footerKey && footerTitle && (
        <PressableScale
          style={styles.footerCard}
          onPress={() => openEdit(footerKey, footerTitle, footerHint ?? '')}>
          <VixText heading="label" additionalStyle={styles.footerLabel}>
            {footerTitle}
          </VixText>
          <VixText heading="title" additionalStyle={styles.footerText}>
            {(values[footerKey] ?? '').trim() || footerHint || 'Ketuk untuk isi'}
          </VixText>
        </PressableScale>
      )}

      <SheetModal
        visible={!!editing}
        title={editing?.title ?? ''}
        subtitle={editing?.hint}
        onClose={() => setEditing(null)}
        footer={
          <DualButtons
            confirmLabel="Simpan"
            busy={saving}
            onCancel={() => setEditing(null)}
            onConfirm={handleSave}
          />
        }>
        <FormInput
          style={styles.textArea}
          placeholder="Tulis sejujurnya…"
          value={text}
          onChangeText={setText}
          editable={!saving}
          multiline
          autoFocus
        />
        <FormError message={error} gap="top" />
      </SheetModal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 32 },
  introCard: {
    backgroundColor: Color.CONTRAST_CONTAINER,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 4,
    marginBottom: 12,
  },
  introText: { color: Color.TEXT_PARAGRAPH },
  introCount: { color: Color.MAIN_DARK },
  card: {
    borderRadius: 18,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 4,
    marginBottom: 10,
  },
  value: { color: Color.TEXT_TITLE },
  empty: { color: Color.TEXT_PLACEHOLDER, fontStyle: 'italic' },
  footerCard: {
    backgroundColor: Color.MAIN_DARK,
    borderRadius: 20,
    padding: 18,
    gap: 3,
    marginTop: 4,
  },
  footerLabel: { color: Color.TEXT_ON_DARK_MUTED },
  footerText: { color: Color.TEXT_REVERSE },
  textArea: { minHeight: 140, textAlignVertical: 'top' },
});
