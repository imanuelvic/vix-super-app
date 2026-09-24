// Sheet Catatan Hari Ini (14 Sep 2026): 📋 salin seluruh catatan & ✨ lompat
// ke project ChatGPT pribadi. Clipboard-nya expo-clipboard yang dimuat MALAS
// (build lama tidak boleh gagal start), tautannya universal link chatgpt.com.
const AKAR = require('./akar');
const fs = require('fs');
const ROOT = AKAR + '/';

let gagal = 0;
function c(nama, ok) {
  console.log((ok ? '  ok  ' : '  GAGAL') + ' ' + nama);
  if (!ok) gagal++;
}
const baca = (f) => fs.readFileSync(ROOT + f, 'utf8');

console.log('lib/clipboard.ts');
const clip = baca('lib/clipboard.ts');
c('expo-clipboard di-require MALAS di dalam try/catch, bukan import statis',
  /try \{[\s\S]{0,200}require\('expo-clipboard'\)/.test(clip) && !/^import .* from 'expo-clipboard'/m.test(clip));
// 15 Sep 2026: di dev client lama, require() yang melempar tetap tercetak merah
// walau ditangkap → ketersediaan modul natifnya ditanyakan dulu tanpa melempar.
c('ketersediaan ExpoClipboard ditanyakan dulu (requireOptionalNativeModule) sebelum require',
  /requireOptionalNativeModule\('ExpoClipboard'\)\s*\n?\s*\?/.test(clip) &&
    clip.indexOf("requireOptionalNativeModule('ExpoClipboard')") < clip.lastIndexOf("require('expo-clipboard')") &&
    /import \{ requireOptionalNativeModule \} from 'expo';/.test(clip));
c('cadangannya Clipboard bawaan RN (build lama tetap bisa menyalin)',
  /import \{ Clipboard as \w+ \} from 'react-native'/.test(clip) && /\.setString\(text\)/.test(clip));
c('copyText tidak pernah melempar (false = gagal)',
  /export async function copyText\(text: string\): Promise<boolean>/.test(clip) && /catch \{\s*return false;/.test(clip));
c('expo-clipboard terpasang di package.json (versi SDK 57)',
  /"expo-clipboard": "~57\./.test(baca('package.json')));

console.log('lib/linking.ts');
const link = baca('lib/linking.ts');
// 14 Sep 2026: sudah diisi (alamat project, dibungkus ke baris berikutnya oleh Prettier).
c('ada CHATGPT_PROJECT_URL, terisi halaman /project (bukan obrolan /c/)', /export const CHATGPT_PROJECT_URL =\s*'https:\/\/chatgpt\.com\/g\/g-p-[0-9a-f]+\/project';/.test(link));
c('kosong → jatuh ke openChatGpt (app-nya saja)',
  /if \(!CHATGPT_PROJECT_URL\) return openChatGpt\(\);/.test(link));
c('terisi → universal link dengan cadangan web',
  /openExternalUrl\(CHATGPT_PROJECT_URL, \{ fallback: CHATGPT_WEB \}\)/.test(link));
c('cara mengisinya tertulis (chatgpt.com/g/g-p-…/project)', /chatgpt\.com\/g\/g-p-/.test(link));

console.log('NoteField');
const nf = baca('components/common/NoteField.tsx');
c('prop `tools` opsional, bawaan mati', /tools = false,/.test(nf) && /tools\?: boolean;/.test(nf));
c('headerRight cuma ada kalau tools', /headerRight=\{\s*tools \? \(/.test(nf));
c('📋 = EmojiButton ikon doc.on.doc → ✓ sebentar sesudah tersalin',
  /icon=\{tersalin \? 'checkmark' : 'doc\.on\.doc'\}/.test(nf) && /setTimeout\(\(\) => setTersalin\(false\), 1500\)/.test(nf));
c('📋 mati kalau drafnya kosong', /disabled=\{!draf\}/.test(nf));
// 14 Sep 2026: ikonnya 💬 (bubble.left.fill); ✨ kini khusus AI Reflection.
c('💬 = EmojiButton ikon bubble.left.fill → keChatGpt', /<EmojiButton icon="bubble\.left\.fill" onPress=\{keChatGpt\} \/>/.test(nf));
c('✨ menyalin draf dulu, baru membuka project',
  /async function keChatGpt\(\) \{\s*if \(draf\) await copyText\(draf\);\s*await openChatGptProject\(\);/.test(nf));
c('yang disalin DRAF yang sedang ditulis (poin digabung, paragraf di-trim)',
  /const draf = berpoin \? joinNoteLines\(poin\) : text\.trim\(\);/.test(nf) && /if \(!draf \|\| !\(await copyText\(draf\)\)\) return;/.test(nf));
c('simpan memakai draf yang sama', /if \(draf !== value\) onSave\(draf\);/.test(nf));
c('dua tombol sebaris', /tools: \{ flexDirection: 'row', gap: 8 \}/.test(nf));

console.log('pemakai');
c('Habits › Catatan Hari Ini menyalakan tools',
  // (jendela 900: sejak 14 Sep 2026 prop `below` (AI Reflection) duduk di
  // antara `tools` dan `onSave`)
  /<NoteField[\s\S]{0,600}?\n\s+tools\n[\s\S]{0,900}?onSave=\{\(t\) => handleNote\(habit, t\)\}/.test(baca('components/habits/HabitsTab.tsx')));
c('Learning › Rangkuman TIDAK (belum diminta)', !/tools/.test(baca('components/learning/WeekTab.tsx')));
const ikon = baca('components/ui/icon-symbol.tsx');
c('peta ikon Android/web punya doc.on.doc & bubble.left.fill',
  /'doc\.on\.doc': 'content-copy'/.test(ikon) && /'bubble\.left\.fill': 'chat'/.test(ikon));
c('tidak ada "—" di teks baru', !/—/.test(clip));

console.log(gagal === 0 ? 'CEK-CATATAN-TOOLS OK' : gagal + ' gagal');
process.exit(gagal === 0 ? 0 : 1);
