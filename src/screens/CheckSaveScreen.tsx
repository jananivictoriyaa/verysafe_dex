import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Alert, Modal, Pressable, ScrollView, Text, TextInput, View} from 'react-native';
import * as Speech from 'expo-speech';
import {addCustomer, addEntry, getCustomers, updateCustomerLocalizedName, updateCustomerPhone} from '../db/database';
import {Avatar, Btn, S, Screen} from '../components/ui';
import {colors} from '../theme/colors';
import {delta, fmt, isPlausibleNameLocalization, label, matchCustomers, normalizePhoneNumber, type EntryType} from '../utils';
import {useLang} from '../state/lang';

const TYPES: [EntryType, string][] = [['credit', 'Credit'], ['paid', 'Paid'], ['partial', 'Partial payment'], ['received', 'Received']];

export default function CheckSaveScreen({route, navigation}: any) {
  const {lang, t, localizedNames, refreshLocalizedNames} = useLang();
  const {parsed} = route.params;
  const [customers, setCustomers] = useState<any[]>([]);
  const [sel, setSel] = useState<number | 'new' | null>(null);
  const [type, setType] = useState<EntryType>(parsed.type);
  const [amount, setAmount] = useState(String(parsed.amount || ''));
  const [paid, setPaid] = useState(String(parsed.paidAmount || ''));
  const [name, setName] = useState<string>(
    lang.code === 'en' && isPlausibleNameLocalization(parsed.localizedName, parsed.name, 'en')
      ? parsed.localizedName
      : parsed.name || '',
  );
  const [localizedName, setLocalizedName] = useState<string>(parsed.localizedName || '');
  const [phone, setPhone] = useState<string>(parsed.phone || parsed.phoneText || '');
  const [edit, setEdit] = useState(false);
  const [remind, setRemind] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [ambiguousMatches, setAmbiguousMatches] = useState<any[]>([]);
  const [duplicatePhoneCustomer, setDuplicatePhoneCustomer] = useState<any>(null);
  const promptedName = useRef('');

  const matches = useMemo(() => matchCustomers(customers, parsed.name || ''), [customers, parsed.name]);
  const candidates = matches.length ? matches : parsed.name ? [] : customers;
  const parsedDisplayName = isPlausibleNameLocalization(parsed.localizedName, parsed.name, lang.code)
    ? parsed.localizedName
    : lang.code === 'en' && isPlausibleNameLocalization(parsed.name, parsed.name, 'en')
      ? parsed.name
      : t('Customer');

  useEffect(() => {
    const promptKey = `${lang.code}:${parsed.name || ''}:${parsed.phone || parsed.phoneText || ''}`;
    if (promptedName.current === promptKey) return;
    promptedName.current = promptKey;
    getCustomers().then(list => {
      setCustomers(list);
      const heardPhone = normalizePhoneNumber(parsed.phone || parsed.phoneText || '');
      const phoneMatch = heardPhone
        ? list.find(customer => normalizePhoneNumber(customer.phone || '') === heardPhone)
        : null;
      if (phoneMatch) {
        setSel(phoneMatch.id);
        setPhone(heardPhone);
        setAmbiguousMatches([]);
        return;
      }
      const m = matchCustomers(list, parsed.name || '');
      if (m.length > 1) {
        setSel(null);
        setAmbiguousMatches(m);
        const question = t('Several customers named {name} already exist. Which one?', {name: parsedDisplayName});
        const options = m.map((customer: any, index: number) => {
          const digits = String(normalizePhoneNumber(String(customer.phone || '')) || customer.phone || '').replace(/\D/g, '').slice(-4);
          const phoneEnding = digits
            ? t('Option {number}: {name}, phone ending {digits}.', {
              number: index + 1,
              name: label(customer, lang.code, localizedNames) || t('Customer'),
              digits,
            })
            : t('Option {number}: {name}. No phone number on file.', {
              number: index + 1,
              name: label(customer, lang.code, localizedNames) || t('Customer'),
            });
          return phoneEnding;
        }).join(' ');
        Speech.stop();
        Speech.speak(`${question} ${options}`, {
          language: lang.locale,
          onError: error => Alert.alert(t('Speech unavailable'), error.message),
        });
        return;
      }
      if (m.length === 0) {
        setSel('new');
        return;
      }
      const best = m[0];
      setSel(null);
      const customerName = label(best, lang.code, localizedNames) || t('Customer');
      const message = t('A customer named {name} already exists.', {name: customerName});
      Speech.stop();
      Speech.speak(`${t('Customer already exists with this name')}. ${message}`, {
        language: lang.locale,
        onError: error => Alert.alert(t('Speech unavailable'), error.message),
      });
      Alert.alert(
        t('Customer already exists with this name'),
        `${message} ${t('Is this {name} or a new customer?', {name: customerName})}`,
        [
          {text: t('Existing customer'), onPress: () => setSel(best.id)},
          {text: t('New customer'), onPress: () => { setSel('new'); setEdit(true); }},
        ],
      );
    }).catch(error => Alert.alert(t('Database error'), String(error?.message ?? error)));
  }, [lang.code, lang.locale, localizedNames, parsed.name, parsed.phone, parsed.phoneText, parsedDisplayName, t]);

  useEffect(() => () => { Speech.stop(); }, []);

  const amt = Number(amount) || 0;
  const paidAmt = type === 'paid' ? amt : type === 'half' ? Number(paid) || 0 : 0;
  const current = customers.find(c => c.id === sel);
  const oldBal = current ? current.balance : 0;
  const newBal = oldBal + delta(type, amt, paidAmt);
  const localizedNameForSave = isPlausibleNameLocalization(localizedName, name || parsed.name, lang.code) ? localizedName : '';
  const newCustomerDisplayName = lang.code === 'en'
    ? localizedNameForSave || (isPlausibleNameLocalization(name, name, 'en') ? name : t('Customer'))
    : localizedNameForSave || t('Customer');
  const customerDisplayName = current
    ? label(current, lang.code, localizedNames)
    : newCustomerDisplayName;
  const first = customerDisplayName.split(' ')[0];
  const headline = type === 'received' || type === 'partial' ? `${first} ${t('paid you')}` : type === 'paid' ? `${first} ${t('paid cash')}` : `${first} ${t('owes you')}`;

  const changePhone = (value: string) => {
    const normalized = normalizePhoneNumber(value);
    const duplicate = normalized && customers.find(customer =>
      customer.id !== sel && normalizePhoneNumber(customer.phone || '') === normalized,
    );
    if (duplicate) {
      setDuplicatePhoneCustomer(duplicate);
      return;
    }
    setPhone(value);
  };

  const selectDuplicatePhoneCustomer = () => {
    if (!duplicatePhoneCustomer) return;
    setSel(duplicatePhoneCustomer.id);
    setPhone(normalizePhoneNumber(duplicatePhoneCustomer.phone || ''));
    setDuplicatePhoneCustomer(null);
  };

  const confirmSave = async () => {
    try {
      if (sel === null) return;
      const transactionPhone = normalizePhoneNumber(phone) || normalizePhoneNumber(current?.phone ?? '');
      const canonicalName = name.trim() || (lang.code === 'en' ? '' : localizedNameForSave.trim());
      let id: number = sel === 'new'
        ? await addCustomer(
          canonicalName,
          transactionPhone,
          '',
          '',
          lang.code,
          lang.code !== 'en' ? localizedNameForSave : '',
        )
        : sel;
      if (sel !== 'new' && lang.code !== 'en' && localizedNameForSave) {
        await updateCustomerLocalizedName(id, lang.code, localizedNameForSave);
      }
      if (sel !== 'new' && transactionPhone && transactionPhone !== normalizePhoneNumber(current?.phone ?? '')) {
        await updateCustomerPhone(id, transactionPhone);
      }
      await addEntry(id, type, amt, paidAmt, '');
      navigation.popToTop();
      void refreshLocalizedNames();
      if (remind) navigation.navigate('Reminders', {channel: 'whatsapp', focusId: id});
    } catch (e: any) {
      if (e?.code === 'PHONE_ALREADY_IN_USE') {
        const duplicate = customers.find(customer => customer.id === e.customerId);
        setDuplicatePhoneCustomer(duplicate ?? {id: e.customerId, name: t('another customer')});
        return;
      }
      Alert.alert(t('Could not save'), String(e?.message ?? e));
    }
  };

  const save = () => {
    if (!amt || amt <= 0) return Alert.alert(t('Amount needed'), t('Enter an amount greater than zero.'));
    if (type === 'half' && (paidAmt <= 0 || paidAmt >= amt)) return Alert.alert(t('Partial payment'), t('Paid part must be more than 0 and less than the total.'));
    if (sel === 'new' && !(name.trim() || (lang.code !== 'en' && localizedNameForSave.trim()))) {
      return Alert.alert(t('Name needed'), t('Enter the customer name.'));
    }
    if (sel === null) return;
    const transactionPhone = phone.trim()
      ? normalizePhoneNumber(phone)
      : normalizePhoneNumber(current?.phone ?? '');
    if (!transactionPhone) {
      return Alert.alert(t('Invalid phone number'), t('Enter a valid 10-digit phone number.'));
    }
    const duplicate = customers.find(customer =>
      customer.id !== sel && normalizePhoneNumber(customer.phone || '') === transactionPhone,
    );
    if (duplicate) {
      setDuplicatePhoneCustomer(duplicate);
      return;
    }
    const summary = t('Confirm {type} of {amount} for {name}?', {
      type: t(type === 'half' || type === 'partial' ? 'Partial payment' : type[0].toUpperCase() + type.slice(1)),
      amount: fmt(amt),
      name: customerDisplayName,
    }) + `\n${t('Phone number')}: ${transactionPhone}`;
    setConfirmation(summary);
    setConfirmVisible(true);
  };

  return (
    <Screen bottom>
      <ScrollView contentContainerStyle={S.pad} keyboardShouldPersistTaps="handled">
        <View style={[S.row, {marginVertical: 14, gap: 18}]}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={12}><Text style={{fontSize: 28}}>‹</Text></Pressable>
          <Text style={[S.title, {fontSize: 22}]}>{t('Check and save')}</Text>
        </View>

        <View style={[S.card, {alignItems: 'center', paddingVertical: 24}]}>
          <Text style={S.small}>{headline}</Text>
          <Text style={{fontSize: 56, fontWeight: '800', color: colors.text}}>{fmt(amt)}</Text>
          <Text style={S.small}>{t('Old balance {amount} → New balance', {amount: fmt(oldBal)})} <Text style={{color: colors.rust, fontWeight: '800'}}>{fmt(newBal)}</Text></Text>
        </View>

        <Text style={[S.label, {marginTop: 16}]}>{t('Type')}</Text>
        <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 10}}>
          {TYPES.map(([entryType, l]) => (
            <Pressable key={entryType} onPress={() => setType(entryType)} style={{width: '48%', minHeight: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10, borderWidth: 2, borderColor: type === entryType ? colors.primary : colors.border, backgroundColor: type === entryType ? colors.primary : '#fff'}}>
              <Text style={{fontWeight: '800', fontSize: 15, textAlign: 'center', color: type === entryType ? '#fff' : colors.text}}>{t(l)}</Text>
            </Pressable>
          ))}
        </View>

        {type === 'half' && (
          <View style={{marginTop: 12}}>
            <Text style={S.label}>{t('Paid now (₹)')}</Text>
            <TextInput style={S.input} keyboardType="decimal-pad" value={paid} onChangeText={setPaid} />
          </View>
        )}
        <View style={{marginTop: 12}}>
          <Text style={S.label}>{parsed.phone ? t('Phone number was heard') : t('Phone number')}</Text>
          <TextInput
            style={S.input}
            keyboardType="phone-pad"
            value={phone || current?.phone || ''}
            onChangeText={changePhone}
            placeholder={t('No phone number heard')}
          />
        </View>
        {edit && (
          <View style={{marginTop: 12}}>
            <Text style={S.label}>{t('Total amount (₹)')}</Text>
            <TextInput style={S.input} keyboardType="decimal-pad" value={amount} onChangeText={setAmount} />
            {sel === 'new' && (
              <>
                <Text style={S.label}>{t('New customer name')}</Text>
                <TextInput
                  style={S.input}
                  value={lang.code === 'en' ? name : isPlausibleNameLocalization(localizedName, name || parsed.name, lang.code) ? localizedName : ''}
                  onChangeText={lang.code === 'en' ? setName : setLocalizedName}
                  placeholder={t('Name?')}
                />
              </>
            )}
          </View>
        )}

        <Text style={[S.label, {marginTop: 16}]}>
          {ambiguousMatches.length > 1
            ? t('Several customers named {name} already exist. Which one?', {name: parsedDisplayName})
            : t('Choose a customer')}
        </Text>
        {ambiguousMatches.length > 1 && (
          <Text style={[S.small, {marginBottom: 8}]}>{t('Choose the correct customer before saving.')}</Text>
        )}
        {candidates.map((c: any) => {
          const customerName = label(c, lang.code, localizedNames) || t('Customer');
          const phoneEnding = String(normalizePhoneNumber(String(c.phone || '')) || c.phone || '').replace(/\D/g, '').slice(-4);
          return (
            <Pressable key={c.id} onPress={() => { Speech.stop(); setSel(c.id); }} style={[S.listCard, {borderWidth: 2, borderColor: sel === c.id ? colors.primary : colors.border}]}>
              <Avatar name={customerName} />
              <View style={{flex: 1}}>
                <Text style={S.title}>{customerName}</Text>
                {ambiguousMatches.length > 1 && (
                  <Text style={S.small}>{t('Option {number}', {number: ambiguousMatches.findIndex(customer => customer.id === c.id) + 1})} · {
                    phoneEnding ? t('Phone ending {digits}', {digits: phoneEnding}) : t('No phone number on file')
                  }</Text>
                )}
                <Text style={S.small}>{c.area ? c.area + ' · ' : ''}{t('owes {amount}', {amount: fmt(c.balance)})}</Text>
              </View>
              <View style={{width: 26, height: 26, borderRadius: 13, borderWidth: 3, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center'}}>
                {sel === c.id && <View style={{width: 12, height: 12, borderRadius: 6, backgroundColor: colors.primary}} />}
              </View>
            </Pressable>
          );
        })}
        <Pressable onPress={() => { Speech.stop(); setSel('new'); setEdit(true); }} style={[S.listCard, {borderWidth: 2, borderColor: sel === 'new' ? colors.primary : colors.border}]}>
          <Avatar name="+" />
          <View style={{flex: 1}}>
            <Text style={S.title}>{`${t('New customer')}: ${newCustomerDisplayName}`}</Text>
            <Text style={S.small}>{t('Create and save this entry under a new name')}</Text>
          </View>
        </Pressable>

        <Pressable onPress={() => setRemind(r => !r)} style={[S.card, {marginTop: 4, flexDirection: 'row', alignItems: 'center'}]}>
          <View style={{flex: 1}}>
            <Text style={S.title}>{t('Remind after saving')}</Text>
            <Text style={S.small}>{t('Opens SMS or WhatsApp with the text ready')}</Text>
          </View>
          <Text style={{fontSize: 24}}>{remind ? '☑' : '☐'}</Text>
        </Pressable>
      </ScrollView>

      <View style={{paddingHorizontal: 18, gap: 10, paddingBottom: 10}}>
        <Btn title={`✓  ${t('Save entry')}`} onPress={save} disabled={sel === null} />
        <View style={{flexDirection: 'row', gap: 10}}>
          <Btn kind="outline" title={t('Speak again')} onPress={() => navigation.goBack()} style={{flex: 1}} />
          <Btn kind="outline" title={t(edit ? 'Done editing' : 'Edit details')} onPress={() => setEdit(e => !e)} style={{flex: 1}} />
        </View>
      </View>
      <Modal
        visible={confirmVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmVisible(false)}>
        <View style={{flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 24}}>
          <View style={{backgroundColor: '#fff', borderRadius: 20, padding: 22, elevation: 8}}>
            <Text style={{fontSize: 20, fontWeight: '800', color: '#000', marginBottom: 12}}>{t('Confirm transaction')}</Text>
            <Text style={{fontSize: 16, lineHeight: 24, color: '#000'}}>{confirmation}</Text>
            <View style={{flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 22}}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setConfirmVisible(false)}
                style={{paddingVertical: 11, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, borderColor: '#000'}}>
                <Text style={{fontWeight: '700', color: '#000'}}>{t('Cancel')}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setConfirmVisible(false);
                  confirmSave();
                }}
                style={{paddingVertical: 11, paddingHorizontal: 16, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#000'}}>
                <Text style={{fontWeight: '700', color: '#000'}}>{t('Confirm')}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      <Modal
        visible={Boolean(duplicatePhoneCustomer)}
        transparent
        animationType="fade"
        onRequestClose={() => setDuplicatePhoneCustomer(null)}>
        <View style={{flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 24}}>
          <View style={{backgroundColor: '#fff', borderRadius: 20, padding: 22, elevation: 8}}>
            <Text style={{fontSize: 20, fontWeight: '800', color: '#000', marginBottom: 12}}>{t('Phone number already used')}</Text>
            <Text style={{fontSize: 16, lineHeight: 24, color: '#000'}}>
              {t('This phone number is already saved under {name}.', {
                name: duplicatePhoneCustomer ? label(duplicatePhoneCustomer, lang.code, localizedNames) : '',
              })}
            </Text>
            <View style={{flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 22}}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setDuplicatePhoneCustomer(null)}
                style={{paddingVertical: 11, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, borderColor: colors.primary}}>
                <Text style={{fontWeight: '700', color: colors.text}}>{t('Cancel')}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={selectDuplicatePhoneCustomer}
                style={{paddingVertical: 11, paddingHorizontal: 16, borderRadius: 12, backgroundColor: colors.primary}}>
                <Text style={{fontWeight: '700', color: '#fff'}}>{t('Existing customer')}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
