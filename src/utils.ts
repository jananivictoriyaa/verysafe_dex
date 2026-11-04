import {translate} from './state/translations';
import {OVERDUE_DAYS} from './config';

let shopName = 'Selvam Stores';

export function setShopName(name: string) {
  shopName = name;
}

export type EntryType = 'credit' | 'paid' | 'half' | 'received' | 'partial';

export const fmt = (n: number | string) =>
  '₹' + (Number(n) || 0).toLocaleString('en-IN', {maximumFractionDigits: 2});

export const pendingDaysRemaining = (elapsedDays: number) =>
  Math.max(0, OVERDUE_DAYS - Math.max(0, elapsedDays) - 1);

const NAME_SCRIPTS: Record<string, RegExp> = {
  ta: /[\u0B80-\u0BFF]/,
  hi: /[\u0900-\u097F]/,
  te: /[\u0C00-\u0C7F]/,
  bn: /[\u0980-\u09FF]/,
  ml: /[\u0D00-\u0D7F]/,
};

const NAME_TRANSLITERATION: Record<string, {
  vowels: Record<string, string>;
  vowelSigns: Record<string, string>;
  consonants: Record<string, string>;
  virama: string;
  overrides: Record<string, string>;
}> = {
  ta: {
    vowels: {a: 'அ', aa: 'ஆ', i: 'இ', ii: 'ஈ', u: 'உ', uu: 'ஊ', e: 'எ', ee: 'ஏ', ai: 'ஐ', o: 'ஒ', oo: 'ஓ', au: 'ஔ'},
    vowelSigns: {a: '', aa: 'ா', i: 'ி', ii: 'ீ', u: 'ு', uu: 'ூ', e: 'ெ', ee: 'ே', ai: 'ை', o: 'ொ', oo: 'ோ', au: 'ௌ'},
    consonants: {kh: 'க', gh: 'க', chh: 'ச', ch: 'ச', sh: 'ஷ', zh: 'ழ', ng: 'ங', nj: 'ஞ', ny: 'ஞ', th: 'த', dh: 'த', ph: 'ப', bh: 'ப', k: 'க', g: 'க', c: 'ச', j: 'ஜ', t: 'ட', d: 'ட', n: 'ன', p: 'ப', b: 'ப', m: 'ம', y: 'ய', r: 'ர', l: 'ல', v: 'வ', w: 'வ', s: 'ஸ', h: 'ஹ', f: 'ஃப', q: 'க', x: 'க்ஸ'},
    virama: '்',
    overrides: {janani: 'ஜனனி', nithya: 'நித்யா', rakesh: 'ராகேஷ்', ramesh: 'ரமேஷ்'},
  },
  hi: {
    vowels: {a: 'अ', aa: 'आ', i: 'इ', ii: 'ई', u: 'उ', uu: 'ऊ', e: 'ए', ee: 'ए', ai: 'ऐ', o: 'ओ', oo: 'ओ', au: 'औ'},
    vowelSigns: {a: '', aa: 'ा', i: 'ि', ii: 'ी', u: 'ु', uu: 'ू', e: 'े', ee: 'े', ai: 'ै', o: 'ो', oo: 'ो', au: 'ौ'},
    consonants: {kh: 'ख', gh: 'घ', chh: 'छ', ch: 'च', sh: 'श', zh: 'झ', ng: 'ङ', nj: 'ञ', ny: 'ञ', th: 'थ', dh: 'ध', ph: 'फ', bh: 'भ', k: 'क', g: 'ग', c: 'च', j: 'ज', t: 'ट', d: 'ड', n: 'न', p: 'प', b: 'ब', m: 'म', y: 'य', r: 'र', l: 'ल', v: 'व', w: 'व', s: 'स', h: 'ह', f: 'फ़', q: 'क़', x: 'क्ष'},
    virama: '्',
    overrides: {janani: 'जननी', nithya: 'नित्या', rakesh: 'राकेश', ramesh: 'रमेश'},
  },
  te: {
    vowels: {a: 'అ', aa: 'ఆ', i: 'ఇ', ii: 'ఈ', u: 'ఉ', uu: 'ఊ', e: 'ఎ', ee: 'ఏ', ai: 'ఐ', o: 'ఒ', oo: 'ఓ', au: 'ఔ'},
    vowelSigns: {a: '', aa: 'ా', i: 'ి', ii: 'ీ', u: 'ు', uu: 'ూ', e: 'ె', ee: 'ే', ai: 'ై', o: 'ొ', oo: 'ో', au: 'ౌ'},
    consonants: {kh: 'ఖ', gh: 'ఘ', chh: 'ఛ', ch: 'చ', sh: 'శ', zh: 'ళ', ng: 'ఙ', nj: 'ఞ', ny: 'ఞ', th: 'థ', dh: 'ధ', ph: 'ఫ', bh: 'భ', k: 'క', g: 'గ', c: 'చ', j: 'జ', t: 'ట', d: 'డ', n: 'న', p: 'ప', b: 'బ', m: 'మ', y: 'య', r: 'ర', l: 'ల', v: 'వ', w: 'వ', s: 'స', h: 'హ', f: 'ఫ', q: 'క', x: 'క్ష'},
    virama: '్',
    overrides: {janani: 'జనని', nithya: 'నిత్య', rakesh: 'రాకేష్', ramesh: 'రమేష్'},
  },
  bn: {
    vowels: {a: 'অ', aa: 'আ', i: 'ই', ii: 'ঈ', u: 'উ', uu: 'ঊ', e: 'এ', ee: 'এ', ai: 'ঐ', o: 'ও', oo: 'ও', au: 'ঔ'},
    vowelSigns: {a: '', aa: 'া', i: 'ি', ii: 'ী', u: 'ু', uu: 'ূ', e: 'ে', ee: 'ে', ai: 'ৈ', o: 'ো', oo: 'ো', au: 'ৌ'},
    consonants: {kh: 'খ', gh: 'ঘ', chh: 'ছ', ch: 'চ', sh: 'শ', zh: 'ঝ', ng: 'ঙ', nj: 'ঞ', ny: 'ঞ', th: 'থ', dh: 'ধ', ph: 'ফ', bh: 'ভ', k: 'ক', g: 'গ', c: 'চ', j: 'জ', t: 'ট', d: 'ড', n: 'ন', p: 'প', b: 'ব', m: 'ম', y: 'য', r: 'র', l: 'ল', v: 'ভ', w: 'ও', s: 'স', h: 'হ', f: 'ফ', q: 'ক', x: 'ক্ষ'},
    virama: '্',
    overrides: {janani: 'জননী', nithya: 'নিত্যা', rakesh: 'রাকেশ', ramesh: 'রমেশ'},
  },
  ml: {
    vowels: {a: 'അ', aa: 'ആ', i: 'ഇ', ii: 'ഈ', u: 'ഉ', uu: 'ഊ', e: 'എ', ee: 'ഏ', ai: 'ഐ', o: 'ഒ', oo: 'ഓ', au: 'ഔ'},
    vowelSigns: {a: '', aa: 'ാ', i: 'ി', ii: 'ീ', u: 'ു', uu: 'ൂ', e: 'െ', ee: 'േ', ai: 'ൈ', o: 'ൊ', oo: 'ോ', au: 'ൗ'},
    consonants: {kh: 'ഖ', gh: 'ഘ', chh: 'ഛ', ch: 'ച', sh: 'ശ', zh: 'ഴ', ng: 'ങ', nj: 'ഞ', ny: 'ഞ', th: 'ഥ', dh: 'ധ', ph: 'ഫ', bh: 'ഭ', k: 'ക', g: 'ഗ', c: 'ച', j: 'ജ', t: 'ട', d: 'ഡ', n: 'ന', p: 'പ', b: 'ബ', m: 'മ', y: 'യ', r: 'ര', l: 'ല', v: 'വ', w: 'വ', s: 'സ', h: 'ഹ', f: 'ഫ', q: 'ക', x: 'ക്ഷ'},
    virama: '്',
    overrides: {janani: 'ജനനി', nithya: 'നിത്യ', rakesh: 'രാകേഷ്', ramesh: 'രമേഷ്'},
  },
};

export function transliterateName(name: string, lang: string) {
  if (isNameInLanguage(name, lang)) return name;
  const table = NAME_TRANSLITERATION[lang];
  if (!table) return name;
  return name.split(/(\s+)/).map(word => {
    if (!word.trim()) return word;
    return word.replace(/[a-z]+/gi, part => {
      const cleanWord = part.toLowerCase();
      const override = table.overrides[cleanWord];
      if (override) return override;

      const tokens = cleanWord.match(/chh|kh|gh|sh|zh|ng|nj|ny|th|dh|ph|bh|aa|ii|ee|uu|oo|ai|au|[a-z]/g) ?? [];
      let result = '';
      for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        if (table.consonants[token]) {
          result += table.consonants[token];
          const next = tokens[i + 1];
          if (next && table.vowelSigns[next] !== undefined) {
            result += table.vowelSigns[next];
            i++;
          } else if (next && table.consonants[next]) {
            result += table.virama;
          }
        } else if (table.vowels[token]) {
          result += table.vowels[token];
        }
      }
      return result || part;
    });
  }).join('');
}

export function isNameInLanguage(name: string, lang: string) {
  if (lang === 'en') {
    const letters = name.match(/\p{L}/gu) ?? [];
    return letters.length > 0 && letters.every(letter => /\p{Script=Latin}/u.test(letter));
  }
  return Boolean(NAME_SCRIPTS[lang]?.test(name));
}

export function isPlausibleNameLocalization(name: string, original: string, lang: string) {
  if (!isNameInLanguage(name, lang)) return false;
  const sourceLetters = original.match(/\p{L}/gu)?.length ?? 0;
  const localizedLetters = name.replace(/\p{M}/gu, '').match(/\p{L}/gu)?.length ?? 0;
  return sourceLetters < 3 || localizedLetters > 1;
}

export function customerName(c: any, lang = 'en', localizedNames: Record<number, string> = {}) {
  const id = c.id ?? c.customer_id;
  const original = c.name || c.customer_name || '';
  if (lang === 'en') {
    return [localizedNames[id], c.name_en, original]
      .find(name => name && isPlausibleNameLocalization(name, original, 'en')) ?? '';
  }
  const legacyLocalized = c.customer_name_localized;
  const localized = [localizedNames[id], c[`name_${lang}`], legacyLocalized]
    .find(name => name && isPlausibleNameLocalization(name, original, lang));
  if (localized) return localized;
  return transliterateName(original, lang);
}

export const label = (c: any, lang = 'en', localizedNames: Record<number, string> = {}) => {
  const name = customerName(c, lang, localizedNames);
  return name && c.trade ? `${name} · ${c.trade}` : name;
};

export function toAsciiDigits(value: string) {
  return value.replace(/[\u0BE6-\u0BEF\u0966-\u096F\u0C66-\u0C6F\u09E6-\u09EF\u0D66-\u0D6F\u0CE6-\u0CEF]/g, ch => {
    const code = ch.charCodeAt(0);
    const base = code >= 0x0d66 ? 0x0d66
      : code >= 0x0ce6 ? 0x0ce6
        : code >= 0x0c66 ? 0x0c66
          : code >= 0x0be6 ? 0x0be6
            : code >= 0x09e6 ? 0x09e6
              : 0x0966;
    return String(code - base);
  });
}

export function normalizePhoneNumber(value: string) {
  let phone = toAsciiDigits(value).replace(/\D/g, '');
  if (phone.startsWith('91') && phone.length === 12) phone = phone.slice(2);
  if (phone.startsWith('0') && phone.length === 11) phone = phone.slice(1);
  return phone.length === 10 ? phone : '';
}

export const maskPhone = (p?: string) => {
  const d = toAsciiDigits(p || '').replace(/\D/g, '').slice(-10);
  return d.length === 10 ? d.slice(0, 2) + 'xxxxxx' + d.slice(-2) : 'No phone';
};

export function waNumber(p?: string) {
  const d = toAsciiDigits(p || '').replace(/\D/g, '');
  if (d.length === 10) return '91' + d;
  if (d.length === 11 && d.startsWith('0')) return '91' + d.slice(1);
  return d;
}

export function formatPhoneDigits(value: string) {
  return toAsciiDigits(value);
}

export const delta = (type: EntryType, amount: number, paid: number) =>
  type === 'credit' ? amount : type === 'half' ? amount - paid : type === 'received' || type === 'partial' ? -amount : 0;

export function matchCustomers(list: any[], name: string) {
  const t = name.trim().toLowerCase().split(/\s+/)[0];
  if (!t) return [];
  return list.filter(c => {
    const n = String(c.name).toLowerCase().split(/\s+/)[0];
    return n.includes(t) || t.includes(n);
  });
}

export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const parseDate = (s: string) => new Date(s.replace(' ', 'T') + 'Z');

export type JournalPeriod = 'today' | 'week' | 'month' | 'year' | 'all';

export function isWithinJournalPeriod(value: string, period: JournalPeriod, now = new Date()) {
  if (period === 'all') return true;
  const date = parseDate(value);
  if (!Number.isFinite(date.getTime())) return false;
  const sameDay = date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate();
  if (period === 'today') return sameDay;

  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === 'week') {
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  } else if (period === 'month') {
    start.setDate(1);
  } else {
    start.setMonth(0, 1);
  }
  return date >= start && date <= now;
}

export function dayLabel(s: string, lang = 'en') {
  const d = parseDate(s);
  const t = new Date();
  const today = d.toDateString() === t.toDateString();
  const locale = ({ta: 'ta-IN', hi: 'hi-IN', te: 'te-IN', bn: 'bn-IN', ml: 'ml-IN'} as Record<string, string>)[lang] ?? 'en-IN';
  const date = d.toLocaleDateString(locale, {day: 'numeric', month: 'short'});
  return `${date}${today ? ` · ${translate(lang, 'Today')}` : ''}`;
}

export function reminderText(c: any, lang: string, localizedNames: Record<number, string> = {}) {
  const n = customerName(c, lang, localizedNames);
  const a = Math.round(c.balance).toLocaleString('en-IN');
  switch (lang) {
    case 'ta': return `வணக்கம் ${n}, ${shopName} கடையிலிருந்து நினைவூட்டல்: ₹${a} நிலுவையில் உள்ளது. வசதிப்படி செலுத்தவும். நன்றி.`;
    case 'hi': return `नमस्ते ${n}, ${shopName} की ओर से याद दिलाना: ₹${a} बकाया है। कृपया सुविधा से चुका दें। धन्यवाद।`;
    case 'te': return `నమస్కారం ${n}, ${shopName} నుండి గుర్తుచేత: ₹${a} బాకీ ఉంది. వీలైనప్పుడు చెల్లించండి. ధన్యవాదాలు.`;
    case 'bn': return `নমস্কার ${n}, ${shopName} থেকে মনে করিয়ে দিচ্ছি: ₹${a} বাকি আছে। সুবিধামতো পরিশোধ করুন। ধন্যবাদ।`;
    case 'ml': return `നമസ്കാരം ${n}, ${shopName} ഓർമ്മിപ്പിക്കുന്നു: ₹${a} കുടിശ്ശികയുണ്ട്. സൗകര്യമുള്ളപ്പോൾ അടയ്ക്കുക. നന്ദി.`;
    default: return `Hello ${n}, a gentle reminder from ${shopName}: ₹${a} is pending. Please pay when you can. Thank you.`;
  }
}
