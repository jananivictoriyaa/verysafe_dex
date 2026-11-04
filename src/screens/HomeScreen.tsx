import React, {useCallback, useState} from 'react';
import {Alert, Pressable, ScrollView, Text, TextInput, View} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {getCustomers} from '../db/database';
import {colors} from '../theme/colors';
import {Avatar, Pill, S, Screen} from '../components/ui';
import {useLang} from '../state/lang';
import LanguagePicker from '../components/LanguagePicker';
import {fmt, label, pendingDaysRemaining} from '../utils';
import {OVERDUE_DAYS, SHOP_NAME} from '../config';
import {useAuth} from '../state/auth';

export default function HomeScreen({navigation}: any) {
  const {lang, t, localizedNames} = useLang();
  const {shop, logOut} = useAuth();
  const [all, setAll] = useState<any[]>([]);
  const [q, setQ] = useState('');

  const confirmLogout = () => {
    Alert.alert('Log out?', 'You will need your phone number and PIN to log in again.', [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Log out',
        style: 'destructive',
        onPress: () => {
          logOut().catch((e: any) => Alert.alert('Could not log out', String(e?.message ?? e)));
        },
      },
    ]);
  };

  useFocusEffect(
    useCallback(() => {
      getCustomers().then(setAll).catch((e: any) => Alert.alert(t('Database error'), String(e?.message ?? e)));
    }, [t]),
  );

  const owing = all.filter(c => c.balance > 0);
  const overdue = (c: any) => c.balance > 0 && Number(c.pending_days) >= OVERDUE_DAYS;
  const total = owing.reduce((t, c) => t + c.balance, 0);
  const needle = q.trim().toLowerCase();
  const list = (needle ? all.filter(c => (label(c, lang.code, localizedNames) + ' ' + c.area).toLowerCase().includes(needle)) : owing)
    .slice()
    .sort((a, b) => Number(overdue(b)) - Number(overdue(a)) || b.balance - a.balance);

  return (
    <Screen>
      <ScrollView contentContainerStyle={[S.pad, {paddingTop: 12}]}>
        <View style={[S.row, {justifyContent: 'space-between', marginBottom: 16}]}>
          <View>
            <Text style={S.small}>{lang.hello}</Text>
            <Text style={S.h1}>{shop?.shop_name || SHOP_NAME}</Text>
          </View>
          <View style={[S.row, {gap: 8}]}>
            <LanguagePicker />
            <Pressable onPress={confirmLogout} accessibilityRole="button">
              <Text style={{color: colors.primary, fontWeight: '800'}}>Log out</Text>
            </Pressable>
          </View>
        </View>

        <View style={{backgroundColor: colors.primary, borderRadius: 30, padding: 24, marginBottom: 14}}>
          <Text style={{color: '#fff', fontSize: 16}}>{t('Total to collect')}</Text>
          <Text style={{color: '#fff', fontSize: 46, fontWeight: '800', marginVertical: 2}}>{fmt(total)}</Text>
          <Text style={{color: '#fff', fontSize: 15}}>{t('{count} customers · {overdue} overdue', {count: owing.length, overdue: owing.filter(overdue).length})}</Text>
        </View>

        <TextInput style={[S.input, {borderRadius: 26, paddingVertical: 14, fontSize: 17}]} placeholder={`🔍  ${t('Search customer')}`} placeholderTextColor={colors.muted} value={q} onChangeText={setQ} />

        {list.length === 0 && (
          <View style={S.card}><Text style={S.title}>{t('Nothing to show')}</Text><Text style={S.small}>{t('Tap the mic and say an entry to get started.')}</Text></View>
        )}
        {list.map(c => (
          <Pressable key={c.id} style={S.listCard} onPress={() => navigation.navigate('CustomerDetail', {id: c.id, showTrust: true})}>
            <Avatar name={label(c, lang.code, localizedNames)} />
            <View style={{flex: 1}}>
              <Text style={S.title}>{label(c, lang.code, localizedNames)}</Text>
              <Text style={S.small}>{c.area ? c.area + ' · ' : ''}{t('{days} days pending', {days: pendingDaysRemaining(Number(c.pending_days) || 0)})}</Text>
            </View>
            <View>
              <Text style={{color: colors.rust, fontWeight: '800', fontSize: 19, textAlign: 'right'}}>{fmt(c.balance)}</Text>
              {overdue(c) && <Pill text={t('Overdue')} />}
            </View>
          </Pressable>
        ))}
      </ScrollView>

      <View style={{backgroundColor: '#fff', alignItems: 'center', paddingVertical: 14, borderTopWidth: 1, borderColor: colors.border}}>
        <Pressable onPress={() => navigation.navigate('NewEntry')} style={{width: 74, height: 74, borderRadius: 22, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center'}}>
          <Text style={{fontSize: 30}}>🎤</Text>
        </Pressable>
        <Text style={{fontSize: 20, fontWeight: '800', color: colors.text, marginTop: 8}}>{t('Tap and speak')}</Text>
        <Text style={S.small}>{t('Try: “{hint}”', {hint: lang.hint})}</Text>
      </View>
    </Screen>
  );
}
