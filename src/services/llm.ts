import {GEMINI_API_KEY, GEMINI_MODEL} from '../config';
import {isPlausibleNameLocalization, toAsciiDigits, transliterateName, type EntryType} from '../utils';

export type ParsedEntry = {
  name: string;
  localizedName: string;
  amount: number;
  type: EntryType;
  paidAmount: number;
  phone: string;
  phoneText: string;
  source: 'llm' | 'rules';
};

const TYPES: EntryType[] = ['credit', 'paid', 'half', 'received', 'partial'];
const NAME_LOCALIZATION_MODELS = [...new Set([GEMINI_MODEL, 'gemini-3.5-flash-lite'])];
const LANGUAGE_CODE_BY_NAME: Record<string, string> = {
  Tamil: 'ta', Hindi: 'hi', Telugu: 'te', Bengali: 'bn', Malayalam: 'ml', English: 'en',
};
const NAME_EXAMPLES: Record<string, {janani: string; nithya: string}> = {
  ta: {janani: 'ஜனனி', nithya: 'நித்யா'},
  hi: {janani: 'जननी', nithya: 'नित्या'},
  te: {janani: 'జనని', nithya: 'నిత్య'},
  bn: {janani: 'জননী', nithya: 'নিত্যা'},
  ml: {janani: 'ജനനി', nithya: 'നിത്യ'},
};
const SYSTEM = `You extract ONE shop-ledger entry from a spoken sentence. The speaker is a small shopkeeper in India.
Language may be Tamil, Hindi, Telugu, Bengali, Malayalam, English, or a Latin-script mix, written in Latin or native script.
Return JSON only.
- customer_name: canonical customer name for database matching. Remove respectful titles and filler words such as akka, anna, uncle, aunty, mam, madam, sir, ji, and pronouns/postpositions such as nee, neenga, ku, kitta. For "janani akka nee ku 100 rooba bakki iruku", the name is "Janani", amount is 100, and type is credit. If it clearly matches a name in KNOWN_CUSTOMERS (also across scripts, e.g. "ரமேஷ்" = "Ramesh"), return the exact matching known name. Never include honorifics. "" if none.
- localized_name: transliterate the same customer's personal name into the native script of LANGUAGE_HINT, preserving pronunciation and without adding titles. Do not translate the meaning. Use Tamil script for Tamil, Devanagari for Hindi, Telugu script for Telugu, Bengali script for Bengali, Malayalam script for Malayalam, and Latin script for English. "" if no name.
- amount: total rupees as a number. Convert spoken numbers ("ஐநூறு", "पाँच सौ", "aaiyiram" = 1000, "iravai" = 20).
- type:
  credit   = shopkeeper gave goods/money on credit, customer will pay later ("Ramesh enakku 500 rubaa tharanum", "Ramesh ko 500 udhaar", "Ramesh naaku 500 ivvali").
  paid     = customer bought and paid in full now; no dues.
  half     = part paid now, rest on credit. paid_amount = part paid now; amount = full bill.
  received = customer paid an existing balance in full.
  partial = customer paid part of an existing balance; amount is exactly the amount paid now, e.g. "Ramesh made a partial payment of 100" means 100 received, not half of 100. Includes partial-payment phrases in every supported language.
- In Tamil/Tanglish, "bakki iruku/irukku" or "baaki irukku" means an amount is due to the shopkeeper, so classify it as credit.
- paid_amount: half -> amount paid now; paid -> same as amount; otherwise 0.
- phone: Extract the customer's Indian mobile phone number only when spoken. Digits may be spoken one by one in any supported language. Return digits only and exclude country code +91. Return "" if no phone number was spoken. Never mistake the transaction amount for a phone number.`;

async function viaGemini(
  text: string,
  langName: string,
  names: string[],
  phoneFromSpeech: string,
  phoneTextFromSpeech: string,
  rules: ParsedEntry,
): Promise<ParsedEntry> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 9000);
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: 'POST',
        signal: ctrl.signal,
        headers: {'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY},
        body: JSON.stringify({
          systemInstruction: {parts: [{text: SYSTEM}]},
          contents: [{role: 'user', parts: [{text: `LANGUAGE_HINT: ${langName}\nKNOWN_CUSTOMERS: ${JSON.stringify(names)}\nSPOKEN: ${text}`}]}],
          generationConfig: {
            temperature: 0,
            responseMimeType: 'application/json',
            responseSchema: {
              type: 'OBJECT',
              properties: {
                customer_name: {type: 'STRING'},
                localized_name: {type: 'STRING'},
                amount: {type: 'NUMBER'},
                type: {type: 'STRING', enum: TYPES},
                paid_amount: {type: 'NUMBER'},
                phone: {type: 'STRING'},
              },
              required: ['customer_name', 'localized_name', 'amount', 'type', 'paid_amount', 'phone'],
            },
          },
        }),
      },
    );
    if (!res.ok) throw new Error('LLM HTTP ' + res.status);
    const data = await res.json();
    const j = JSON.parse(data.candidates[0].content.parts[0].text);
    const type: EntryType = isPartialPaymentPhrase(text) || j.type === 'half'
      ? 'partial'
      : TYPES.includes(j.type) ? j.type : 'credit';
      const modelAmount = Number(j.amount);
      const amount = isPartialPaymentPhrase(text) || !Number.isFinite(modelAmount) || modelAmount <= 0
        ? rules.amount
        : modelAmount;
      let paid = Number(j.paid_amount) || 0;
      if (type === 'paid') paid = amount;
    if (type === 'credit' || type === 'received' || type === 'partial') paid = 0;
    const phone = phoneFromSpeech || cleanPhone(j.phone);
    const phoneText = phoneTextFromSpeech || phone;
    let name = cleanName(String(j.customer_name || ''), names);
    const ruleName = rules.name;
    const normalizedName = normalized(name);
    const normalizedRuleName = normalized(ruleName);
    const nameIsInitial = Array.from(name).length === 1;
    const nameIsTruncated = normalizedRuleName.length > normalizedName.length
      && normalizedRuleName.startsWith(normalizedName);
    if ((nameIsInitial || nameIsTruncated) && Array.from(ruleName).length > Array.from(name).length) name = ruleName;
    const localizedName = String(j.localized_name || '');
    return {
      name,
      localizedName: langName === 'English' || isPlausibleNameLocalization(localizedName, name, LANGUAGE_CODE_BY_NAME[langName] ?? langName) ? localizedName : '',
      amount,
      type,
      paidAmount: paid,
      phone,
      phoneText,
      source: 'llm',
    };
  } finally {
    clearTimeout(timer);
  }
}

export function parsePhoneNumber(text: string) {
  const {phone} = extractPhone(text);
  return phone;
}

async function requestNameLocalization(model: string, body: object): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 9000);
    try {
      return await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: 'POST',
          signal: controller.signal,
          headers: {'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY},
          body: JSON.stringify(body),
        },
      );
    } catch (error) {
      lastError = error;
      if (/cancel|abort/i.test(String(error))) break;
      if (attempt === 0) await new Promise<void>(resolve => setTimeout(() => resolve(), 700));
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(`Name localization request failed after retry: ${String(lastError)}`);
}

// ---------- offline fallback (no key / no internet) ----------
const W = {
  partialPayment: [
    'partial payment', 'part payment', 'partial repayment', 'installment paid',
    'பகுதி செலுத்தல்', 'பகுதி கட்டணம்', 'பகுதி பணம்', 'கொஞ்சம் கட்டினார்', 'கொஞ்சம் பணம் கொடுத்தார்',
    'சில தொகை கொடுத்தார்', 'konjam kattinar', 'konjam kuduthaar', 'sila rooba kuduthaar',
    'आंशिक भुगतान', 'कुछ पैसे दिए', 'थोड़ा भुगतान', 'किस्त दी',
    'anshik bhugtan', 'thoda paisa diya', 'kist di',
    'పాక్షిక చెల్లింపు', 'కొంత చెల్లించాడు', 'కొంత డబ్బు ఇచ్చాడు', 'వాయిదా చెల్లించాడు',
    'paakshika chellimpu', 'konchem kattadu',
    'আংশিক পরিশোধ', 'আংশিক পেমেন্ট', 'কিছু টাকা দিল', 'কিস্তি দিল',
    'angshik porishodh', 'kichu taka dilo',
    'ഭാഗിക പേയ്‌മെന്റ്', 'ഭാഗിക അടവ്', 'കുറച്ച് പണം നൽകി', 'തവണ അടച്ചു',
    'bhagika payment', 'kurachu panam nalki',
  ],
  half: ['half', 'paadhi', 'pathi', 'aadha', 'aadhe', 'சரிபாதி', 'సగం', 'பாதி', 'आधा', 'आधे', 'অর্ধেক', 'പകുതി'],
  received: ['received', 'got back', 'returned', 'kuduthaar', 'koduthaar', 'thanthaar', 'thandhaar', 'vaangiten', 'vangiten', 'wapas', 'vaapas', 'ichadu', 'वापस', 'जमा', 'கொடுத்தார்', 'தந்தார்', 'வாங்கினேன்', 'ఇచ్చాడు', 'తిరిగి', 'জমা', 'দিয়েছে', 'കൊടുത്തു', 'തിരികെ'],
  credit: ['tharanum', 'tharavendum', 'udhaar', 'udhar', 'kadan', 'credit', 'baaki', 'bakki', 'ivvali', 'owes', 'owe', 'pending', 'उधार', 'बाकी', 'देना', 'கடன்', 'தரணும்', 'தர வேண்டும்', 'பாக்கி', 'బాకీ', 'ఇవ్వాలి', 'బాకీ ఉంది', 'বাকি', 'দেনা', 'കടം', 'ബാക്കി'],
  paid: ['paid', 'cash', 'kaasu', 'காசு', 'பணம்', 'நகது', 'नकद', 'కాష్', 'నగదు', 'নগদ', 'নগদে', 'പണം', 'പണമായി'],
};

function isPartialPaymentPhrase(text: string) {
  const lower = normalized(text);
  return W.partialPayment.some(phrase => lower.includes(normalized(phrase)));
}

const TITLES = new Set([
  'akka', 'akaa', 'anna', 'annan', 'uncle', 'aunty', 'auntie', 'mam', 'maam',
  'madam', 'madame', 'sir', 'ji', 'thambi', 'thangachi', 'avargale',
  'அக்கா', 'அண்ணா', 'மாமா', 'மாமி', 'அம்மா', 'ஐயா',
  'అక్క', 'అన్న', 'గారు', 'మేడమ్', 'సర్',
  'जी', 'भाई', 'दीदी', 'अंकल', 'आंटी', 'मैडम', 'सर',
  'అక్కా', 'అన్నయ్య', 'అంకుల్', 'ఆంటీ', 'గారూ', 'দাদা', 'দিদি', 'কাকা', 'কাকু', 'ম্যাডাম', 'স্যার',
  'ചേച്ചി', 'ചേട്ടൻ', 'ചേട്ടാ', 'അങ്കിൾ', 'ആന്റി', 'മാഡം', 'സാർ',
]);
const FILLERS = new Set([
  'nee', 'ne', 'neenga', 'neengal', 'ku', 'kku', 'kitta', 'kitte',
  'enakku', 'unakku', 'unga', 'ungalukku', 'ennaku', 'naku',
  'rooba', 'roobaa', 'ruva', 'rupai', 'rupaya', 'rupees', 'rupee', 'rs',
  'க்கு', 'கிட்ட', 'உனக்கு', 'எனக்கு', 'ரூபா', 'ரூபாய்',
  'కు', 'కి', 'మీకు', 'నాకు', 'রুপি', 'টাকা', 'রুপায়', 'രൂപ', 'രൂപയ്ക്ക്',
]);
const NUMBER_WORDS: Record<string, number> = {
  onnu: 1, ondru: 1, oru: 1, ஒன்று: 1, ஒரு: 1,
  rendu: 2, irandu: 2, இரண்டு: 2,
  moonu: 3, moondru: 3, மூன்று: 3,
  naalu: 4, naanku: 4, நான்கு: 4,
  anju: 5, ainthu: 5, ஐந்து: 5,
  aaru: 6, ஆறு: 6, ezhu: 7, ஏழு: 7,
  ettu: 8, எட்டு: 8, onbadhu: 9, ஒன்பது: 9,
  pathu: 10, பத்து: 10,
  irupathu: 20, iruvathu: 20, இருபது: 20,
  muppathu: 30, முப்பது: 30, nalpathu: 40, நாற்பது: 40,
  aimbathu: 50, ஐம்பது: 50, arubathu: 60, அறுபது: 60,
  ezhubathu: 70, எழுபது: 70, enbathu: 80, எண்பது: 80,
  thonnooru: 90, தொண்ணூறு: 90,
  nooru: 100, nuru: 100, நூறு: 100,
  irunooru: 200, இருநூறு: 200, munnooru: 300, முந்நூறு: 300,
  naanooru: 400, naanuru: 400, நானூறு: 400, anjunoouru: 500,
  ainooru: 500, ஐநூறு: 500,
  aayiram: 1000, ayiram: 1000, ஆயிரம்: 1000,
  hazaar: 1000, हजार: 1000, sau: 100, सौ: 100,
};

const PHONE_MARKERS = new Set([
  'phone', 'ph', 'mobile', 'number', 'contact', 'telephone', 'phoneno', 'mobile number',
  'தொலைபேசி', 'போன்', 'மொபைல்', 'நம்பர்', 'எண்', 'ఫోన్', 'మొబైల్', 'నంబర్', 'నెంబర్',
  'फोन', 'मोबाइल', 'नंबर', 'नम्बर', 'মোবাইল', 'ফোন', 'নম্বর', 'നമ്പർ', 'ഫോൺ', 'മൊബൈൽ',
]);

const PHONE_DIGIT_WORDS: Record<string, string> = {
  zero: '0', oh: '0', one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9',
  shunya: '0', ek: '1', ikk: '1', do: '2', teen: '3', tin: '3', chaar: '4', char: '4', paanch: '5', panch: '5', che: '6', chhe: '6', cheh: '6', chhah: '6', छ: '6', saat: '7', sat: '7', aath: '8', nau: '9', nav: '9',
  sunna: '0', okati: '1', rendu: '2', moodu: '3', naalugu: '4', aidu: '5', aaru: '6', edu: '7', enimidi: '8', tommidi: '9',
  onnu: '1', ondru: '1', irandu: '2', moonu: '3', moondru: '3', naalu: '4', anju: '5', ainthu: '5', ezhu: '7', yelu: '7', ettu: '8', onbadhu: '9', onbathu: '9', poojiyam: '0', jero: '0',
  shunno: '0', dui: '2', pach: '5', chhoy: '6', choy: '6', shat: '7', aat: '8', noy: '9',
  poojyam: '0', randu: '2', moonnu: '3', anchu: '5', onpathu: '9',
  பூஜ்ஜியம்: '0', பூஜ்யம்: '0', சுழியம்: '0', ஜீரோ: '0', ஒன்று: '1', ஒன்னு: '1', ஒண்ணு: '1', ஒரு: '1', இரண்டு: '2', ரெண்டு: '2', ரெண்ட: '2', மூன்று: '3', மூணு: '3', மூனு: '3', நான்கு: '4', நாலு: '4', ஐந்து: '5', அஞ்சு: '5', ஆறு: '6', ஏழு: '7', யேழு: '7', எட்டு: '8', ஒன்பது: '9', ஒம்பது: '9',
  సున్నా: '0', ఒకటి: '1', రెండు: '2', మూడు: '3', నాలుగు: '4', ఐదు: '5', ఆరు: '6', ఏడు: '7', ఎనిమిది: '8', తొమ్మిది: '9',
  शून्य: '0', एक: '1', दो: '2', तीन: '3', चार: '4', पांच: '5', पाँच: '5', छह: '6', सात: '7', आठ: '8', नौ: '9',
  শূন্য: '0', এক: '1', দুই: '2', তিন: '3', চার: '4', পাঁচ: '5', ছয়: '6', ছয়: '6', সাত: '7', আট: '8', নয়: '9', নয়: '9',
  പൂജ്യം: '0', ഒന്ന്: '1', രണ്ട്: '2', മൂന്ന്: '3', നാല്: '4', അഞ്ച്: '5', ആറ്: '6', ഏഴ്: '7', എട്ട്: '8', ഒൻപത്: '9', ഒമ്പത്: '9',
};

function cleanPhone(value: unknown) {
  let phone = toAsciiDigits(String(value ?? '')).replace(/\D/g, '');
  if (phone.startsWith('91') && phone.length === 12) phone = phone.slice(2);
  if (phone.startsWith('0') && phone.length === 11) phone = phone.slice(1);
  return phone.length === 10 ? phone : '';
}

function phoneDigits(value: string) {
  let phone = toAsciiDigits(value).replace(/\D/g, '');
  if (phone.startsWith('91') && phone.length >= 12) phone = phone.slice(2);
  if (phone.startsWith('0') && phone.length === 11) phone = phone.slice(1);
  return phone;
}

function extractPhone(text: string) {
  const words = normalized(text).split(/\s+/);
  const markerIndex = words.findIndex(word => PHONE_MARKERS.has(word));
  if (markerIndex < 0) {
    const match = digits(text).match(/(?<!\d)\d{10}(?!\d)/);
    if (match) {
      const phoneIndex = words.findIndex(word => word === match[0]);
      const phoneText = cleanPhone(match[0]);
      return {phone: phoneText, phoneText, remaining: words.filter((_, i) => i !== phoneIndex).join(' ')};
    }
    for (let i = 0; i < words.length; i++) {
      if (!/^\d{1,6}$/.test(words[i])) continue;
      const sequence: string[] = [];
      let end = i;
      while (end < words.length && /^\d{1,6}$/.test(words[end]) && sequence.join('').length < 12) {
        sequence.push(words[end]);
        end++;
      }
      const phoneText = cleanPhone(sequence.join(''));
      if (phoneText) {
        return {
          phone: phoneText,
          phoneText,
          remaining: words.filter((_, index) => index < i || index >= end).join(' '),
        };
      }
    }
    let run: string[] = [];
    let runStart = -1;
    for (let i = 0; i < words.length; i++) {
      const digit = PHONE_DIGIT_WORDS[words[i]] ?? (/^\d$/.test(words[i]) ? words[i] : undefined);
      if (digit === undefined) {
        run = [];
        runStart = -1;
        continue;
      }
      if (runStart < 0) runStart = i;
      run.push(digit);
      if (run.length === 10) {
        const remaining = [...words.slice(0, runStart), ...words.slice(i + 1)].join(' ');
        const phoneText = cleanPhone(run.join(''));
        return {phone: phoneText, phoneText, remaining};
      }
    }
    return {phone: '', phoneText: '', remaining: text};
  }

  const afterMarker = words.slice(markerIndex + 1);
  let spoken = '';
  let consumed = 0;
  const numericIndex = afterMarker.findIndex(word => /^\d+$/.test(word));
  const numericPhone = numericIndex >= 0 ? afterMarker[numericIndex] : '';
  if (numericPhone === '91' && /^\d{10}$/.test(afterMarker[numericIndex + 1] ?? '')) {
    spoken = numericPhone + afterMarker[numericIndex + 1];
    consumed = numericIndex + 2;
  } else if (numericPhone.length === 10 || numericPhone.length === 11 || numericPhone.length === 12) {
    spoken = numericPhone;
    consumed = numericIndex + 1;
  } else if (numericIndex >= 0) {
    const sequence: string[] = [];
    for (let i = numericIndex; i < afterMarker.length; i++) {
      const token = afterMarker[i];
      if (!/^\d{1,6}$/.test(token)) break;
      sequence.push(token);
      consumed = i + 1;
      if (sequence.join('').length >= 10) break;
    }
    spoken = sequence.join('');
  } else {
    const sequence: string[] = [];
    let started = false;
    for (const word of afterMarker) {
      const digit = PHONE_DIGIT_WORDS[word];
      if (digit !== undefined) {
        sequence.push(digit);
        started = true;
        consumed++;
      } else if (!started && ['is', 'number', 'enn', 'vandhu', 'இது', 'எண்', 'है', 'है:', 'है।', 'है,', 'है'].includes(word)) {
        consumed++;
      } else if (started) {
        break;
      } else {
        consumed++;
      }
      if (sequence.length === 10) break;
    }
    spoken = sequence.join('');
  }

  const remainingWords = [...words.slice(0, markerIndex), ...afterMarker.slice(consumed)];
  const phoneText = phoneDigits(spoken);
  return {phone: cleanPhone(spoken), phoneText, remaining: remainingWords.join(' ')};
}

function normalized(s: string) {
  return digits(s)
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanName(candidate: string, names: string[]) {
  const parts = normalized(candidate).split(/\s+/).filter(word => word && !TITLES.has(word) && !FILLERS.has(word));
  if (!parts.length) return '';
  const cleaned = parts.join(' ');
  const known = names.find(name => {
    const knownParts = normalized(name).split(/\s+/).filter(word => !TITLES.has(word));
    return knownParts.join(' ') === cleaned || knownParts[0] === parts[0];
  });
  if (known) {
    const knownParts = known.split(/\s+/).filter(word => !TITLES.has(normalized(word)));
    return knownParts.join(' ');
  }
  return parts.map(word => word[0].toLocaleUpperCase() + word.slice(1)).join(' ');
}

function spokenAmount(text: string) {
  const words = normalized(text).split(/\s+/);
  let total = 0;
  let current = 0;
  let found = false;
  for (const word of words) {
    const value = NUMBER_WORDS[word];
    if (value === undefined) continue;
    found = true;
    if (value >= 1000) {
      total += (current || 1) * value;
      current = 0;
    } else if (value >= 100) {
      current = (current || 1) * value;
    } else if (value >= 20) {
      current += value;
    } else {
      current += value;
    }
  }
  return found ? total + current : 0;
}

function digits(s: string) {
  return toAsciiDigits(s);
}

function viaRules(text: string, names: string[], phone: string, phoneText: string): ParsedEntry {
  const lower = normalized(text);
  const m = digits(text).match(/\d[\d,]*(?:\.\d+)?/);
  const amount = m ? Number(m[0].replace(/,/g, '')) : 0;
  const resolvedAmount = amount || spokenAmount(text);
  const has = (ws: string[]) => ws.some(w => lower.includes(w));
  let type: EntryType = 'credit';
  if (isPartialPaymentPhrase(text) || has(W.half)) type = 'partial';
  else if (has(W.received)) type = 'received';
  else if (has(W.credit)) type = 'credit';
  else if (has(W.paid)) type = 'paid';
  const normalizedNames = names
    .map(name => ({name, normalized: normalized(name)}))
    .filter(item => item.normalized)
    .sort((a, b) => b.normalized.length - a.normalized.length);
  let name = normalizedNames.find(item =>
    lower === item.normalized ||
    lower.startsWith(item.normalized + ' ') ||
    lower.includes(' ' + item.normalized + ' ') ||
    lower.endsWith(' ' + item.normalized),
  )?.name ?? '';
  if (!name) {
    const amountTokenIndex = lower.split(/\s+/).findIndex(word => /\d/.test(word));
    const beforeAmount = amountTokenIndex >= 0 ? lower.split(/\s+/).slice(0, amountTokenIndex).join(' ') : lower;
    const words = beforeAmount.split(/\s+/).filter(word => word && !TITLES.has(word) && !FILLERS.has(word));
    const first = words[0] ?? '';
    name = first ? first[0].toLocaleUpperCase() + first.slice(1) : '';
  }
  name = cleanName(name, names);
  const paidAmount = type === 'paid' ? resolvedAmount : 0;
  return {name, localizedName: '', amount: resolvedAmount, type, paidAmount, phone, phoneText, source: 'rules'};
}

export async function localizeCustomerNames(names: string[], langCode: string): Promise<string[]> {
  if (!names.length) return names;
  const languageNames: Record<string, string> = {
    ta: 'Tamil', hi: 'Hindi', te: 'Telugu', bn: 'Bengali', ml: 'Malayalam', en: 'English',
  };
  const languageName = languageNames[langCode];
  if (!languageName) throw new Error(`Unsupported name language: ${langCode}`);
  const examples = NAME_EXAMPLES[langCode];
  const localFallback = () => langCode === 'en'
    ? names.map(name => isPlausibleNameLocalization(name, name, 'en') ? name : '')
    : names.map(name => transliterateName(name, langCode));
  if (!GEMINI_API_KEY) return localFallback();

  const body = {
    systemInstruction: {parts: [{text: langCode === 'en'
      ? 'Phonetically transliterate each person’s name into the English/Latin alphabet. Never translate a name’s meaning. Preserve pronunciation and every name part; do not add titles or rearrange words. Return one result per input in the same order. Examples: ஜனனி -> Janani; ரமேஷ் -> Ramesh.'
      : `Phonetically transliterate each person's name into ${languageName} script. Never translate a name's meaning. Preserve the name's pronunciation and every name part; do not add titles or rearrange words. Return one result per input in the same order. Examples: Janani -> ${examples.janani}; Nithya -> ${examples.nithya}.`}]},
    contents: [{role: 'user', parts: [{text: JSON.stringify(names)}]}],
    generationConfig: {
      temperature: 0,
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {names: {type: 'ARRAY', items: {type: 'STRING'}}},
        required: ['names'],
      },
    },
  };
  for (const model of NAME_LOCALIZATION_MODELS) {
    let res: Response;
    try {
      res = await requestNameLocalization(model, body);
    } catch (error) {
      if (/cancel|abort/i.test(String(error))) return localFallback();
      continue;
    }
    if (!res.ok) {
      if (res.status !== 404) return localFallback();
      continue;
    }
    let localized: unknown;
    try {
      const data = await res.json();
      localized = JSON.parse(data.candidates[0].content.parts[0].text).names;
    } catch {
      return localFallback();
    }
    if (!Array.isArray(localized) || localized.length !== names.length || localized.some((name: unknown, index: number) =>
      typeof name !== 'string' || !isPlausibleNameLocalization(name.trim(), names[index], langCode),
    )) {
      continue;
    }
    return localized.map((name: string) => name.trim());
  }
  return localFallback();
}

export async function parseEntry(text: string, langName: string, names: string[]): Promise<ParsedEntry> {
  const phone = extractPhone(text);
  const rules = viaRules(phone.remaining, names, phone.phone, phone.phoneText);
  if (GEMINI_API_KEY) {
    try {
      return await viaGemini(text, langName, names, phone.phone, phone.phoneText, rules);
    } catch {
      /* fall through to rules */
    }
  }
  return rules;
}
