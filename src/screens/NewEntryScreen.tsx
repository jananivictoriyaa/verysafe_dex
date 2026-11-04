import React, {useCallback, useEffect, useRef, useState} from 'react';
import {ActivityIndicator, Animated, Pressable, ScrollView, Text, TextInput, View} from 'react-native';
import * as Speech from 'expo-speech';
import {ExpoSpeechRecognitionModule, useSpeechRecognitionEvent} from 'expo-speech-recognition';
import {useFocusEffect} from '@react-navigation/native';
import {getCustomers} from '../db/database';
import {localizeCustomerNames, parseEntry, parsePhoneNumber, type ParsedEntry} from '../services/llm';
import {Btn, Pill, S, Screen} from '../components/ui';
import {colors} from '../theme/colors';
import {useLang} from '../state/lang';
import {fmt, formatPhoneDigits, isPlausibleNameLocalization} from '../utils';
import LanguagePicker from '../components/LanguagePicker';

export const TYPE_LABEL = {credit: 'Credit', paid: 'Paid', half: 'Partial payment', received: 'Received', partial: 'Partial payment'} as const;

function Wave({active}: {active: boolean}) {
  const bars = useRef(Array.from({length: 13}, () => new Animated.Value(0.2))).current;
  useEffect(() => {
    const anims = bars.map((v, i) =>
      Animated.loop(Animated.sequence([
        Animated.timing(v, {toValue: 0.3 + ((i * 37) % 70) / 100, duration: 280 + (i % 5) * 90, useNativeDriver: true}),
        Animated.timing(v, {toValue: 0.15, duration: 280 + (i % 4) * 110, useNativeDriver: true}),
      ])),
    );
    if (active) anims.forEach(a => a.start());
    else bars.forEach(v => v.setValue(0.2));
    return () => anims.forEach(a => a.stop());
  }, [active, bars]);
  return (
    <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 90, gap: 6}}>
      {bars.map((v, i) => (
        <Animated.View key={i} style={{width: 6, height: 90, borderRadius: 3, backgroundColor: i >= 4 && i <= 8 ? colors.orange : colors.primary, transform: [{scaleY: v}]}} />
      ))}
    </View>
  );
}

export default function NewEntryScreen({navigation}: any) {
  const {lang, t} = useLang();
  const langRef = useRef(lang);
  const activeLangCode = useRef(lang.code);
  const tRef = useRef(t);
  tRef.current = t;
  const captureMode = useRef<'entry' | 'phone'>('entry');
  const processedEntryText = useRef('');
  const promptedEntryText = useRef('');
  const screenFocused = useRef(false);
  const phoneRecognitionStarted = useRef(false);
  const [listening, setListening] = useState(false);
  const [text, setText] = useState('');
  const [phoneTranscript, setPhoneTranscript] = useState('');
  const [phoneCapture, setPhoneCapture] = useState<'idle' | 'prompting' | 'listening' | 'error' | 'done'>('idle');
  const [typed, setTyped] = useState('');
  const [parsed, setParsed] = useState<ParsedEntry | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [names, setNames] = useState<string[]>([]);

  // ---- speech events (expo-speech-recognition) ----
  useSpeechRecognitionEvent('start', () => {
    if (captureMode.current === 'phone') phoneRecognitionStarted.current = true;
    setListening(true);
  });
  useSpeechRecognitionEvent('end', () => setListening(false));
  useSpeechRecognitionEvent('result', (e: any) => {
    const transcripts: string[] = (Array.isArray(e?.results) ? e.results : [])
      .map((result: any) => String(result?.transcript ?? '').trim())
      .filter((transcript: string) => Boolean(transcript));
    if (captureMode.current === 'phone') {
      const validPhoneTranscript = transcripts.find((transcript: string) => parsePhoneNumber(transcript).length === 10);
      setPhoneTranscript(current => {
        if (parsePhoneNumber(current).length === 10) return current;
        return validPhoneTranscript ?? transcripts[0] ?? current;
      });
    } else if (transcripts[0]) {
      setText(transcripts[0]);
    }
  });
  useSpeechRecognitionEvent('error', (e: any) => {
    setListening(false);
    if (captureMode.current === 'phone') {
      captureMode.current = 'entry';
      setPhoneCapture('error');
      if (e?.error !== 'aborted') setErr(tRef.current('Could not understand the 10-digit phone number. Tap the mic and try again.'));
    } else if (e?.error !== 'aborted') {
      setErr(tRef.current('Could not hear clearly. Tap the mic and try again.'));
    }
  });

  const start = useCallback(async () => {
    setErr('');
    try {
      const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!perm.granted) {
        setErr(tRef.current('Microphone permission is needed. You can type instead.'));
        return;
      }
      ExpoSpeechRecognitionModule.start({
        lang: langRef.current.locale,
        interimResults: true,
        continuous: false,
      });
    } catch (e: any) {
      setErr(tRef.current('Voice not available: {error}. You can type instead.', {error: String(e?.message ?? e)}));
    }
  }, []);

  const startPhoneCapture = useCallback(async () => {
    try {
      const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!perm.granted) {
        setPhoneCapture('error');
        setErr(tRef.current('Microphone permission is needed. You can type instead.'));
        return;
      }
      setPhoneTranscript('');
      phoneRecognitionStarted.current = false;
      captureMode.current = 'phone';
      setPhoneCapture('listening');
      ExpoSpeechRecognitionModule.start({
        lang: langRef.current.locale,
        interimResults: true,
        maxAlternatives: 5,
        continuous: false,
        contextualStrings: langRef.current.code === 'ta'
          ? [
            'பூஜ்ஜியம்', 'சுழியம்', 'ஜீரோ', 'ஒன்று', 'ஒன்னு', 'ஒண்ணு', 'ஒரு',
            'இரண்டு', 'ரெண்டு', 'மூன்று', 'மூணு', 'நான்கு', 'நாலு',
            'ஐந்து', 'அஞ்சு', 'ஆறு', 'ஏழு', 'எட்டு', 'ஒன்பது', 'ஒம்பது',
          ]
          : undefined,
        androidIntentOptions: {EXTRA_LANGUAGE_MODEL: 'web_search'},
      });
    } catch (error: any) {
      captureMode.current = 'entry';
      setPhoneCapture('error');
      setErr(tRef.current('Voice not available: {error}. You can type instead.', {error: String(error?.message ?? error)}));
    }
  }, []);

  const requestPhone = useCallback((entry: ParsedEntry) => {
    if (screenFocused.current === false) return;
    const displayName = langRef.current.code === 'en'
      ? isPlausibleNameLocalization(entry.localizedName, entry.name, 'en') ? entry.localizedName : entry.name
      : isPlausibleNameLocalization(entry.localizedName, entry.name, langRef.current.code)
        ? entry.localizedName
        : entry.name || tRef.current('Customer');
    const prompt = tRef.current('Please say the 10-digit phone number for {name}.', {name: displayName});
    setPhoneCapture('prompting');
    setErr('');
    Speech.stop();
    Speech.speak(prompt, {
      language: langRef.current.locale,
      onDone: () => {
        if (screenFocused.current) void startPhoneCapture();
      },
      onError: error => {
        if (!screenFocused.current) return;
        setPhoneCapture('error');
        setErr(String(error.message));
      },
    });
  }, [startPhoneCapture]);

  useEffect(() => {
    langRef.current = lang;
    if (activeLangCode.current === lang.code) return;
    activeLangCode.current = lang.code;
    try { ExpoSpeechRecognitionModule.abort(); } catch {}
    Speech.stop();
    captureMode.current = 'entry';
    processedEntryText.current = '';
    promptedEntryText.current = '';
    setPhoneTranscript('');
    phoneRecognitionStarted.current = false;
    setPhoneCapture('idle');
    setText('');
    setParsed(null);
    void start();
  }, [lang, start]);

  useFocusEffect(
    useCallback(() => {
      screenFocused.current = true;
      captureMode.current = 'entry';
      processedEntryText.current = '';
      promptedEntryText.current = '';
      setPhoneTranscript('');
      phoneRecognitionStarted.current = false;
      setPhoneCapture('idle');
      setText(''); setTyped(''); setParsed(null);
      getCustomers().then(l => setNames(Array.from(new Set(l.map((c: any) => c.name))))).catch(() => {});
      start();
      return () => {
        screenFocused.current = false;
        captureMode.current = 'entry';
        Speech.stop();
        try { ExpoSpeechRecognitionModule.abort(); } catch {}
        setListening(false);
      };
    }, [start]),
  );

  // when speech stops (or typed text submitted) -> understand it
  useEffect(() => {
    if (listening || captureMode.current === 'phone' || !text.trim() || processedEntryText.current === text) return;
    processedEntryText.current = text;
    let live = true;
    setBusy(true);
    const shouldRequestPhone = (entry: ParsedEntry) =>
      !entry.phone && !names.some(savedName =>
        savedName.trim().toLocaleLowerCase() === entry.name.trim().toLocaleLowerCase(),
      );
    parseEntry(text, langRef.current.name, names)
      .then(async p => {
        const needsLocalization = langRef.current.code === 'en'
          ? !isPlausibleNameLocalization(p.name, p.name, 'en')
          : !isPlausibleNameLocalization(p.localizedName, p.name, langRef.current.code);
        if (p.name && needsLocalization) {
          try {
            const [localizedName] = await localizeCustomerNames([p.name], langRef.current.code);
            if (live) {
              const result = {...p, localizedName};
              setParsed(result);
              if (shouldRequestPhone(result) && promptedEntryText.current !== text) {
                promptedEntryText.current = text;
                requestPhone(result);
              }
            }
          } catch (error) {
            if (live) {
              setParsed(p);
              setErr(`${tRef.current('Customer name localization unavailable')}: ${String(error)}`);
              if (shouldRequestPhone(p) && promptedEntryText.current !== text) {
                promptedEntryText.current = text;
                requestPhone(p);
              }
            }
          }
        } else if (live) {
          setParsed(p);
          if (shouldRequestPhone(p) && promptedEntryText.current !== text) {
            promptedEntryText.current = text;
            requestPhone(p);
          }
        }
      })
      .finally(() => live && setBusy(false));
    return () => { live = false; };
  }, [listening, text, names, requestPhone]);

  useEffect(() => {
    if (listening || captureMode.current !== 'phone' || phoneCapture !== 'listening' || !phoneRecognitionStarted.current) return;
    const phone = parsePhoneNumber(phoneTranscript);
    phoneRecognitionStarted.current = false;
    if (phone.length !== 10) {
      captureMode.current = 'entry';
      setPhoneCapture('error');
      setErr(t('Could not understand the 10-digit phone number. Tap the mic and try again.'));
      return;
    }
    captureMode.current = 'entry';
    setParsed(current => current ? {...current, phone, phoneText: formatPhoneDigits(phone)} : current);
    setPhoneCapture('done');
    setErr('');
  }, [lang.code, listening, phoneCapture, phoneTranscript, t]);

  const toggleMic = async () => {
    if (listening) {
      try { ExpoSpeechRecognitionModule.stop(); } catch {}
    } else if (parsed && !parsed.phone && phoneCapture !== 'idle') {
      requestPhone(parsed);
    } else {
      captureMode.current = 'entry';
      processedEntryText.current = '';
      promptedEntryText.current = '';
      setText(''); setParsed(null);
      setPhoneCapture('idle');
      await start();
    }
  };

  const next = () => {
    if (!parsed || !parsed.amount) { setErr(t('I could not find an amount. Speak again or type it.')); return; }
    navigation.navigate('CheckSave', {parsed, transcript: text});
  };

  return (
    <Screen bottom>
      <ScrollView contentContainerStyle={S.pad} keyboardShouldPersistTaps="handled">
        <View style={[S.row, {marginVertical: 14}]}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={12}><Text style={{fontSize: 26, color: colors.text}}>✕</Text></Pressable>
          <Text style={[S.title, {flex: 1, textAlign: 'center', fontSize: 20, marginRight: 26}]}>{t('New entry')}</Text>
        </View>

        <View style={{alignItems: 'flex-end', marginBottom: 14}}><LanguagePicker /></View>

        <View style={S.card}>
          <Text style={[S.small, {fontWeight: '700', fontSize: 15}]}>{t('You said')}</Text>
          <Text style={{fontSize: 28, fontWeight: '800', color: colors.text, marginVertical: 8, minHeight: 40}}>
            {phoneCapture === 'prompting'
              ? parsed && t('Please say the 10-digit phone number for {name}.', {
                name: lang.code === 'en' ? parsed.name : parsed.localizedName || parsed.name,
              })
              : phoneCapture === 'listening'
                ? t('Listening for phone number…')
                : text || (listening ? '…' : t('Tap the mic and speak'))}
          </Text>
          {(parsed || busy) && <Text style={[S.small, {fontSize: 15, marginBottom: 6}]}>{t('I understood')}</Text>}
          {busy && <ActivityIndicator color={colors.primary} />}
          {parsed && !busy && (
            <View style={{flexDirection: 'row', gap: 8, flexWrap: 'wrap'}}>
              <Pill text={(isPlausibleNameLocalization(parsed.localizedName, parsed.name, lang.code) ? parsed.localizedName : lang.code === 'en' && isPlausibleNameLocalization(parsed.name, parsed.name, 'en') ? parsed.name : '') || t('Name?')} tone="primary" />
              <Pill text={fmt(parsed.amount)} tone="primary" />
              <Pill text={t(TYPE_LABEL[parsed.type]) + (parsed.type === 'half' ? ` · ${t('Paid')} ${fmt(parsed.paidAmount)}` : '')} tone={parsed.type === 'credit' || parsed.type === 'half' ? 'rust' : 'mint'} />
              {!!parsed.phone && <Pill text={`${t('Phone number')}: ${formatPhoneDigits(parsed.phone)}`} tone="primary" />}
            </View>
          )}
        </View>

        <View style={{marginVertical: 18}}><Wave active={listening} /></View>

        <Pressable onPress={toggleMic} style={{alignSelf: 'center', width: 150, height: 150, borderRadius: 75, backgroundColor: colors.halo, alignItems: 'center', justifyContent: 'center'}}>
          <View style={{width: 100, height: 100, borderRadius: 50, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center'}}>
            <Text style={{fontSize: 40}}>{listening ? '⏹' : '🎤'}</Text>
          </View>
        </Pressable>
        <Text style={{textAlign: 'center', fontSize: 20, fontWeight: '800', color: colors.text, marginTop: 10}}>
          {phoneCapture === 'listening' ? t('Listening for phone number…') : listening ? t('Listening…') : phoneCapture === 'error' ? t('Say phone number again') : t('Tap to speak')}
        </Text>
        {!!err && <Text style={{textAlign: 'center', color: colors.rust, marginTop: 6}}>{err}</Text>}

        <TextInput
          style={[S.input, {marginTop: 18}]}
          placeholder={t('Or type here and press Done')}
          placeholderTextColor={colors.muted}
          value={typed}
          onChangeText={setTyped}
          returnKeyType="done"
          onSubmitEditing={() => {
            captureMode.current = 'entry';
            processedEntryText.current = '';
            promptedEntryText.current = '';
            setPhoneCapture('idle');
            setParsed(null);
            setText(typed.trim());
          }}
        />
      </ScrollView>
      <View style={{flexDirection: 'row', gap: 12, paddingHorizontal: 18, paddingBottom: 10}}>
        <Btn kind="outline" title={t('Cancel')} onPress={() => navigation.goBack()} style={{flex: 1}} />
        <Btn title={t('Continue')} onPress={next} style={{flex: 1.4}} disabled={busy || !parsed || phoneCapture === 'prompting' || phoneCapture === 'listening'} />
      </View>
    </Screen>
  );
}