import React, {createContext, useCallback, useContext, useRef, useState, type PropsWithChildren} from 'react';
import {Alert} from 'react-native';
import {getCustomers, updateCustomerLocalizedName} from '../db/database';
import {localizeCustomerNames} from '../services/llm';
import {isPlausibleNameLocalization} from '../utils';
import {translate} from './translations';

export type Lang = {code: 'ta' | 'hi' | 'te' | 'bn' | 'ml' | 'en'; label: string; locale: string; name: string; hello: string; hint: string};
type Translator = (key: string, values?: Record<string, string | number>) => string;

export const LANGS: Lang[] = [
  {code: 'ta', label: 'தமிழ்', locale: 'ta-IN', name: 'Tamil', hello: 'வணக்கம்', hint: 'ஜனனி அக்கா, உங்களுக்கு 100 ரூபாய் பாக்கி இருக்கு'},
  {code: 'hi', label: 'हिन्दी', locale: 'hi-IN', name: 'Hindi', hello: 'Namaste', hint: 'Ramesh ko 500 rupaye udhaar diye'},
  {code: 'en', label: 'English', locale: 'en-IN', name: 'English', hello: 'Hello', hint: 'Ramesh owes me 500 rupees'},
  {code: 'te', label: 'తెలుగు', locale: 'te-IN', name: 'Telugu', hello: 'Namaskaram', hint: 'Ramesh naaku 500 rupayalu ivvali'},
  {code: 'bn', label: 'বাংলা', locale: 'bn-IN', name: 'Bengali', hello: 'নমস্কার', hint: 'রহিমের কাছে ৫০০ টাকা বাকি আছে'},
  {code: 'ml', label: 'മലയാളം', locale: 'ml-IN', name: 'Malayalam', hello: 'നമസ്കാരം', hint: 'രമേശിന് 500 രൂപ കടം കൊടുത്തു'},
];

const Ctx = createContext<{
  lang: Lang;
  setLang: (l: Lang) => void;
  t: Translator;
  localizedNames: Record<number, string>;
  refreshLocalizedNames: () => Promise<void>;
}>({
  lang: LANGS[0],
  setLang: () => {},
  t: key => key,
  localizedNames: {},
  refreshLocalizedNames: async () => {},
});
export const useLang = () => useContext(Ctx);

export function LangProvider({children}: PropsWithChildren) {
  const [lang, setLang] = useState(LANGS[0]);
  const [localizedNames, setLocalizedNames] = useState<Record<number, string>>({});
  const activeLanguage = useRef(lang.code);
  activeLanguage.current = lang.code;
  const t = useCallback<Translator>((key, values) => translate(lang.code, key, values), [lang.code]);
  const refreshLocalizedNames = useCallback(async () => {
    try {
      const customers = await getCustomers();
      const column = `name_${lang.code}`;
      const initial: Record<number, string> = {};
      const missing: typeof customers = [];
      for (const customer of customers) {
        if (customer[column] && isPlausibleNameLocalization(customer[column], customer.name, lang.code)) initial[customer.id] = customer[column];
        else missing.push(customer);
      }
      if (activeLanguage.current === lang.code) setLocalizedNames(initial);
      for (let i = 0; i < missing.length; i += 30) {
        const batch = missing.slice(i, i + 30);
        const names = await localizeCustomerNames(batch.map(customer => customer.name), lang.code);
        const invalidName = names.findIndex((name, index) =>
          !isPlausibleNameLocalization(name, batch[index].name, lang.code),
        );
        if (names.length !== batch.length || invalidName !== -1) {
          throw new Error('Could not localize every customer name into the selected language.');
        }
        await Promise.all(batch.map((customer, index) =>
          updateCustomerLocalizedName(customer.id, lang.code, names[index]),
        ));
        batch.forEach((customer, index) => { initial[customer.id] = names[index]; });
        if (activeLanguage.current === lang.code) setLocalizedNames({...initial});
      }
    } catch (error) {
      if (activeLanguage.current === lang.code) {
        Alert.alert(
          translate(lang.code, 'Customer name localization unavailable'),
          `${translate(lang.code, 'Could not display customer names in the selected language.')}\n${String(error)}`,
        );
      }
    }
  }, [lang.code]);

  React.useEffect(() => {
    void refreshLocalizedNames();
  }, [refreshLocalizedNames]);

  return <Ctx.Provider value={{lang, setLang, t, localizedNames, refreshLocalizedNames}}>{children}</Ctx.Provider>;
}
