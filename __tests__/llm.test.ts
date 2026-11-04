jest.mock('../src/config', () => ({
  GEMINI_API_KEY: 'test-api-key',
  GEMINI_MODEL: 'gemini-2.5-flash',
  OVERDUE_DAYS: 7,
  SHOP_NAME: 'Selvam Stores',
}));

import {localizeCustomerNames, parseEntry, parsePhoneNumber} from '../src/services/llm';
import {delta, normalizePhoneNumber} from '../src/utils';

describe('parseEntry offline fallback', () => {
  beforeEach(() => {
    jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('retries name localization with the fallback model when the configured model is unavailable', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({error: {message: 'model not found'}}), {status: 404}))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        candidates: [{content: {parts: [{text: JSON.stringify({names: ['ஜனனி']})}]}}],
      }), {status: 200}));

    await expect(localizeCustomerNames(['Janani'], 'ta')).resolves.toEqual(['ஜனனி']);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1][0])).toContain('gemini-3.5-flash-lite:generateContent');
  });

  test('retries name localization when the first model returns only an initial', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({
        candidates: [{content: {parts: [{text: JSON.stringify({names: ['ர']})}]}}],
      }), {status: 200}))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        candidates: [{content: {parts: [{text: JSON.stringify({names: ['ராக்கேஷ்']})}]}}],
      }), {status: 200}));

    await expect(localizeCustomerNames(['Rakesh'], 'ta')).resolves.toEqual(['ராக்கேஷ்']);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test('uses offline transliteration immediately when the localization request is canceled', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('Fetch request has been canceled'));

    await expect(localizeCustomerNames(['Rakesh'], 'ta')).resolves.toEqual(['ராகேஷ்']);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test.each([
    ['ta', 'ராகேஷ்'],
    ['hi', 'राकेश'],
    ['te', 'రాకేష్'],
    ['bn', 'রাকেশ'],
    ['ml', 'രാകേഷ്'],
  ])('uses local transliteration when offline in %s', async (langCode, expected) => {
    jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
    await expect(localizeCustomerNames(['Rakesh'], langCode)).resolves.toEqual([expected]);
  });

  test.each([
    ['ta', 'ஜனனி'],
    ['hi', 'जननी'],
    ['te', 'జనని'],
    ['bn', 'জননী'],
    ['ml', 'ജനനി'],
  ])('accepts phonetic name output in the %s script', async (langCode, localizedName) => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({
      candidates: [{content: {parts: [{text: JSON.stringify({names: [localizedName]})}]}}],
    }), {status: 200}));

    await expect(localizeCustomerNames(['Janani'], langCode)).resolves.toEqual([localizedName]);
  });

  test('transliterates a Tamil customer name into English script', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({
      candidates: [{content: {parts: [{text: JSON.stringify({names: ['Janani']})}]}}],
    }), {status: 200}));

    await expect(localizeCustomerNames(['ஜனனி'], 'en')).resolves.toEqual(['Janani']);
  });

  test.each([
    ['English', 'Ramesh made a partial payment of Rs 100'],
    ['Tamil', 'Ramesh 100 பகுதி செலுத்தல்'],
    ['Hindi', 'Ramesh 100 आंशिक भुगतान'],
    ['Telugu', 'Ramesh 100 పాక్షిక చెల్లింపు'],
    ['Bengali', 'Ramesh 100 আংশিক পরিশোধ'],
    ['Malayalam', 'Ramesh 100 ഭാഗിക അടവ്'],
    ['Tanglish', 'Ramesh 100 konjam kuduthaar'],
    ['Hindi spoken in Latin script', 'Ramesh 100 anshik bhugtan'],
    ['Telugu spoken in Latin script', 'Ramesh 100 paakshika chellimpu'],
    ['Bengali spoken in Latin script', 'Ramesh 100 angshik porishodh'],
    ['Malayalam spoken in Latin script', 'Ramesh 100 bhagika payment'],
  ])('records a %s partial payment as the full amount received', async (_language, phrase) => {
    const parsed = await parseEntry(phrase, 'English', ['Ramesh']);
    expect(parsed).toMatchObject({
      name: 'Ramesh',
      amount: 100,
      type: 'partial',
      paidAmount: 0,
      source: 'rules',
    });
    expect(200 + delta(parsed.type, parsed.amount, parsed.paidAmount)).toBe(100);
  });

  test('treats a half-payment phrase as a partial payment, not a separate half type', async () => {
    await expect(parseEntry('Ramesh paid half 100', 'English', ['Ramesh'])).resolves.toMatchObject({
      amount: 100,
      type: 'partial',
      paidAmount: 0,
    });
  });

  test('keeps an explicit existing-balance partial payment distinct if the model says half', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({
      candidates: [{content: {parts: [{text: JSON.stringify({
        customer_name: 'Ramesh',
        localized_name: '',
        amount: 100,
        type: 'half',
        paid_amount: 50,
        phone: '',
      })}]}}],
    }), {status: 200}));

    await expect(parseEntry('Ramesh made a partial payment of 100', 'English', ['Ramesh'])).resolves.toMatchObject({
      amount: 100,
      type: 'partial',
      paidAmount: 0,
    });
  });

  test('recovers the spoken partial-payment amount when the model returns zero', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({
      candidates: [{content: {parts: [{text: JSON.stringify({
        customer_name: 'Janani',
        localized_name: '',
        amount: 0,
        type: 'received',
        paid_amount: 0,
        phone: '',
      })}]}}],
    }), {status: 200}));

    await expect(parseEntry('Janani made a partial payment of 100', 'English', ['Janani'])).resolves.toMatchObject({
      name: 'Janani',
      amount: 100,
      type: 'partial',
      paidAmount: 0,
    });
  });

  test('recovers a complete spoken customer name when the model returns only its initial', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({
      candidates: [{content: {parts: [{text: JSON.stringify({
        customer_name: 'R',
        localized_name: 'ர',
        amount: 200,
        type: 'credit',
        paid_amount: 0,
        phone: '',
      })}]}}],
    }), {status: 200}));

    await expect(parseEntry('Rakesh owes me 200 rupees', 'Tamil', [])).resolves.toMatchObject({
      name: 'Rakesh',
      localizedName: '',
      amount: 200,
      type: 'credit',
    });
  });

  test('recovers a complete spoken customer name when the model returns only a prefix', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({
      candidates: [{content: {parts: [{text: JSON.stringify({
        customer_name: 'Ram',
        localized_name: '',
        amount: 200,
        type: 'credit',
        paid_amount: 0,
        phone: '',
      })}]}}],
    }), {status: 200}));

    await expect(parseEntry('Ramesh owes me 200 rupees', 'Tamil', [])).resolves.toMatchObject({
      name: 'Ramesh',
      amount: 200,
      type: 'credit',
    });
  });

  test.each([
    ['numeric digits', '9876543210', '9876543210'],
    ['English digit words', 'nine eight seven six five four three two one zero', '9876543210'],
    ['Tamil digit words', 'onnu rendu moonu naalu anju aaru ezhu ettu onbadhu poojyam', '1234567890'],
    ['colloquial Tamil digit words', 'ஒன்னு ரெண்டு மூணு நாலு அஞ்சு ஆறு ஏழு எட்டு ஒன்பது பூஜ்ஜியம்', '1234567890'],
    ['common Tamil spoken digits', 'ஒண்ணு ரெண்டு மூனு நாலு அஞ்சு ஆறு ஏழு எட்டு ஒம்பது ஜீரோ', '1234567890'],
    ['colloquial Tamil phone marker and digit words', 'போன் எண் ஒன்னு ரெண்டு மூணு நாலு அஞ்சு ஆறு ஏழு எட்டு ஒன்பது பூஜ்ஜியம்', '1234567890'],
    ['Hindi digit words', 'ek do teen chaar paanch cheh saat aath nau shunya', '1234567890'],
    ['native Tamil digits', '௯௮௭௬௫௪௩௨௧௦', '9876543210'],
    ['native Hindi digits', '९८७६५४३२१०', '9876543210'],
    ['Tamil phone marker and native digits', 'தொலைபேசி ௯௮௭௬௫௪௩௨௧௦', '9876543210'],
    ['Hindi phone marker and native digits', 'फोन ९८७६५४३२१०', '9876543210'],
    ['Hindi spoken digit variants', 'ek do teen char panch chhe sat aath nau shunya', '1234567890'],
    ['Tamil spoken digit variants', 'onnu irandu moonu naalu anju aaru yelu ettu onbadhu poojyam', '1234567890'],
    ['number groups', '98765 43210', '9876543210'],
  ])('parses a 10-digit phone number spoken as %s', (_description, transcript, expected) => {
    expect(parsePhoneNumber(transcript)).toBe(expected);
  });

  test.each([
    ['Tamil numerals', '௯௮௭௬௫௪௩௨௧௦', '9876543210'],
    ['Hindi numerals', '९८७६५४३२१०', '9876543210'],
    ['Hindi numerals with country code', '९१ ९८७६५४३२१०', '9876543210'],
  ])('normalizes %s for saved phone numbers', (_description, input, expected) => {
    expect(normalizePhoneNumber(input)).toBe(expected);
  });

  test('removes honorifics and identifies a Tanglish balance due', async () => {
    await expect(parseEntry('janani akka nee ku 100 rooba bakki iruku', 'Tamil', [])).resolves.toMatchObject({
      name: 'Janani',
      amount: 100,
      type: 'credit',
      source: 'rules',
    });
  });

  test('preserves Tamil-script customer names in the offline parser', async () => {
    await expect(parseEntry('ரமேஷ் 200 ரூபாய் பாக்கி', 'Tamil', [])).resolves.toMatchObject({
      name: 'ரமேஷ்',
      amount: 200,
      type: 'credit',
      source: 'rules',
    });
  });

  test('matches the saved customer name without retaining its honorific', async () => {
    await expect(parseEntry('janani akka ku nooru rooba baaki', 'Tamil', ['Janani Akka'])).resolves.toMatchObject({
      name: 'Janani',
      amount: 100,
      type: 'credit',
      source: 'rules',
    });
  });

  test('extracts a spoken phone number without using it as the transaction amount', async () => {
    await expect(parseEntry('janani akka 100 rooba baaki iruku phone number nine eight seven six five four three two one zero', 'Tamil', [])).resolves.toMatchObject({
      name: 'Janani',
      amount: 100,
      type: 'credit',
      phone: '9876543210',
      source: 'rules',
    });
  });

  test('normalizes Bengali phone digits and excludes the Indian country code', async () => {
    await expect(parseEntry('রহিমের কাছে ৫০০ টাকা বাকি আছে ফোন ৯১ ৯৮৭৬৫৪৩২১০', 'Bengali', [])).resolves.toMatchObject({
      amount: 500,
      type: 'credit',
      phone: '9876543210',
      source: 'rules',
    });
  });
});
