import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { EmojiButton } from '@/components/common/EmojiButton';
import { LoadingCenter } from '@/components/common/LoadingCenter';
import { SheetModal } from '@/components/common/SheetModal';
import { VixText } from '@/components/common/VixText';
import { useAuth } from '@/contexts/auth';
import {
  NOTE_KIND_META,
  noteLinksOf,
  type CoreNoteLinks,
} from '@/lib/coreNotes';
import { dayIdToDate, formatFullDate } from '@/lib/format';
import { unsubscribeAll } from '@/lib/liveDoc';
import { subscribeSermons, type SermonNote } from '@/lib/sermon';
import { subscribeReviveEntries, type ReviveEntry } from '@/lib/spiritual';

// Tombol 🔗 di kartu acara CORE (Visitation & Monthly).
//
// MUNCUL HANYA kalau acara itu memang punya catatan tersambung — kalau tidak,
// komponennya tidak menggambar apa-apa. Jadi kartunya tetap bersih seperti
// sekarang, dan 🔗 benar-benar berarti "ada bahan di dalam sini".
//
// Isinya dibaca dari catatan ASLINYA (bukan salinan yang ikut disimpan saat
// disambungkan), jadi kalau catatannya kamu perbaiki, yang tampil di sini ikut
// terbaru. Dilanggan cuma selagi modalnya terbuka.
export function LinkedNotesButton({
  links,
  coreId,
}: {
  links: CoreNoteLinks;
  /** id acara CORE-nya (visitasi / rapat bulanan). */
  coreId: string;
}) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [revives, setRevives] = useState<ReviveEntry[] | null>(null);
  const [sermons, setSermons] = useState<SermonNote[] | null>(null);

  const tersambung = noteLinksOf(links, coreId);

  useEffect(() => {
    if (!user || !open) return;
    return unsubscribeAll([
      subscribeReviveEntries(user.uid, setRevives),
      subscribeSermons(user.uid, setSermons),
    ]);
  }, [user, open]);

  if (tersambung.length === 0) return null;

  const memuat = revives === null || sermons === null;

  return (
    <>
      <EmojiButton
        emoji="🔗"
        badge={tersambung.length > 1 ? tersambung.length : 0}
        onPress={() => setOpen(true)}
      />

      <SheetModal
        visible={open}
        title="🔗 Bahan Tersambung"
        subtitle="Dari Catatan Revive & Catatan Khotbah"
        onClose={() => setOpen(false)}>
        {memuat ? (
          <LoadingCenter />
        ) : (
          <ScrollView style={styles.scroll}>
            {tersambung.map((l) => {
              const meta = NOTE_KIND_META[l.kind];
              const revive =
                l.kind === 'revive'
                  ? revives?.find((r) => r.id === l.noteId)
                  : undefined;
              const sermon =
                l.kind === 'sermon'
                  ? sermons?.find((s) => s.id === l.noteId)
                  : undefined;
              // Catatannya sudah dihapus sesudah disambungkan → yang tersisa
              // cuma judul saat itu. Dikatakan apa adanya, bukan kartu kosong.
              const hilang = !revive && !sermon;
              return (
                <View key={`${l.kind}-${l.noteId}`} style={styles.card}>
                  <View style={styles.cardTop}>
                    <VixText heading="label" additionalStyle={styles.kindChip}>
                      {meta.emoji} {meta.label}
                    </VixText>
                    <VixText heading="label" additionalStyle={styles.date}>
                      {formatFullDate(dayIdToDate(l.noteId))}
                    </VixText>
                  </View>
                  <VixText heading="title" additionalStyle={styles.title}>
                    {revive?.title || sermon?.title || l.title}
                  </VixText>

                  {hilang && (
                    <VixText heading="label" additionalStyle={styles.gone}>
                      Catatannya sudah dihapus — tinggal judulnya yang tercatat
                      di sini.
                    </VixText>
                  )}

                  {revive && (
                    <>
                      {revive.passage ? (
                        <VixText heading="label" additionalStyle={styles.meta}>
                          📖 {revive.passage}
                        </VixText>
                      ) : null}
                      <Blok label="✨ Rhema" text={revive.rhema} />
                      <Blok label="🏃🏻‍➡️ Aplikasi" text={revive.reflection} />
                    </>
                  )}

                  {sermon && (
                    <>
                      {sermon.preacher ? (
                        <VixText heading="label" additionalStyle={styles.meta}>
                          🎤 {sermon.preacher}
                        </VixText>
                      ) : null}
                      {sermon.quote ? (
                        <View style={styles.quote}>
                          <VixText
                            heading="paragraph"
                            additionalStyle={styles.quoteText}>
                            “{sermon.quote}”
                          </VixText>
                        </View>
                      ) : null}
                      <Blok label="📝 Catatan Khotbah" text={sermon.note ?? ''} />
                      <Blok label="🏃🏻‍➡️ Aplikasi" text={sermon.reflection} />
                    </>
                  )}
                </View>
              );
            })}
          </ScrollView>
        )}
      </SheetModal>
    </>
  );
}

/** Satu blok isi — dilewati kalau memang kosong. */
function Blok({ label, text }: { label: string; text: string }) {
  if (!text.trim()) return null;
  return (
    <View style={styles.blok}>
      <VixText heading="label" additionalStyle={styles.blokLabel}>
        {label}
      </VixText>
      <VixText heading="paragraph" additionalStyle={styles.blokText}>
        {text}
      </VixText>
    </View>
  );
}

const styles = StyleSheet.create({
  // Dibatasi tingginya supaya sheet-nya tidak tumbuh melewati layar saat ada
  // beberapa catatan panjang sekaligus.
  scroll: { maxHeight: 460 },
  card: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Color.BORDER,
    borderLeftWidth: 3,
    borderLeftColor: Color.SPIRITUAL_DARK,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
    gap: 4,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  kindChip: { color: Color.SPIRITUAL_DARK },
  date: { color: Color.TEXT_LABEL },
  title: { color: Color.TEXT_TITLE },
  meta: { color: Color.SPIRITUAL_DARK },
  gone: { color: Color.TEXT_LABEL },
  quote: {
    backgroundColor: Color.BACKGROUND,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 4,
  },
  quoteText: { color: Color.TEXT_TITLE },
  blok: { marginTop: 6, gap: 2 },
  blokLabel: { color: Color.TEXT_LABEL },
  blokText: { color: Color.TEXT_PARAGRAPH },
});
