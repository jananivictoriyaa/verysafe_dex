import React, {useCallback, useState} from 'react';
import {Alert, Pressable, ScrollView, Text, TextInput, View} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {addCustomer, findCustomerByPhone, getCustomers} from '../db/database';
import {Avatar, Btn, S, Screen} from '../components/ui';
import {colors} from '../theme/colors';
import {fmt, label, maskPhone} from '../utils';
import {useLang} from '../state/lang';

export default function CustomersScreen({navigation}: any) {
  const {lang, t, localizedNames, refreshLocalizedNames} = useLang();
  const [list, setList] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [trade, setTrade] = useState('');
  const [phone, setPhone] = useState('');
  const [area, setArea] = useState('');

  const load = useCallback(() => { getCustomers().then(setList).catch(() => {}); }, []);
  useFocusEffect(load);

  const save = async () => {
    if (!name.trim()) return Alert.alert(t('Name required'), t('Please enter the customer name.'));
    try {
      const duplicate = await findCustomerByPhone(phone);
      if (duplicate) {
        Alert.alert(
          t('Phone number already used'),
          t('This phone number is already saved under {name}.', {name: label(duplicate, lang.code, localizedNames)}),
        );
        return;
      }
      await addCustomer(name, phone, area, trade);
      setName(''); setTrade(''); setPhone(''); setArea('');
      load();
      await refreshLocalizedNames();
    } catch (e: any) {
      if (e?.code === 'PHONE_ALREADY_IN_USE') {
        const duplicate = list.find(customer => customer.id === e.customerId);
        Alert.alert(
          t('Phone number already used'),
          t('This phone number is already saved under {name}.', {
            name: duplicate ? label(duplicate, lang.code, localizedNames) : t('another customer'),
          }),
        );
        return;
      }
      Alert.alert(t('Could not add customer'), String(e?.message ?? e));
    }
  };

  const ph = (v: string, set: (s: string) => void, p: string, kb: any = 'default') =>
    <TextInput style={S.input} placeholder={p} placeholderTextColor={colors.muted} value={v} onChangeText={set} keyboardType={kb} />;

  return (
    <Screen>
      <ScrollView contentContainerStyle={[S.pad, {paddingTop: 12}]} keyboardShouldPersistTaps="handled">
        <Text style={[S.h1, {marginBottom: 14}]}>{t('Customers')}</Text>
        <View style={[S.card, {marginBottom: 16}]}>
          {ph(name, setName, t('Name'))}
          {ph(trade, setTrade, t('Trade, e.g. Tailor (optional)'))}
          {ph(phone, setPhone, t('Phone, 10 digits (needed for reminders)'), 'phone-pad')}
          {ph(area, setArea, t('Area, e.g. Anna Nagar (optional)'))}
          <Btn title={t('Save customer')} onPress={save} />
        </View>
        <Text style={S.label}>{t('Saved customers ({count})', {count: list.length})}</Text>
        {list.map(c => (
          <Pressable key={c.id} style={S.listCard} onPress={() => navigation.navigate('CustomerDetail', {id: c.id})}>
            <Avatar name={label(c, lang.code, localizedNames)} />
            <View style={{flex: 1}}>
              <Text style={S.title}>{label(c, lang.code, localizedNames)}</Text>
              <Text style={S.small}>{c.area ? c.area + ' · ' : ''}{c.phone ? maskPhone(c.phone) : t('No phone')}</Text>
            </View>
            <Text style={{fontWeight: '800', color: c.balance > 0 ? colors.rust : colors.muted}}>{fmt(c.balance)}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </Screen>
  );
}
