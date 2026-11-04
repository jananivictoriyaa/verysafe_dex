import React, {useCallback, useState} from 'react';
import {Pressable, ScrollView, Text} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {getCustomers} from '../db/database';
import {Avatar, S, Screen} from '../components/ui';
import {label} from '../utils';
import {useLang} from '../state/lang';

export default function LedgerScreen({navigation}: any) {
  const {lang, t, localizedNames} = useLang();
  const [list, setList] = useState<any[]>([]);
  useFocusEffect(useCallback(() => { getCustomers().then(setList).catch(() => {}); }, []));
  const rows = list.slice().sort((a, b) => b.balance - a.balance);
  return (
    <Screen>
      <ScrollView contentContainerStyle={[S.pad, {paddingTop: 12}]}>
        <Text style={[S.h1, {marginBottom: 4}]}>{t('Ledger')}</Text>
        <Text style={[S.small, {marginBottom: 14}]}>{t("Every customer's running balance")}</Text>
        {rows.length === 0 && <Text style={S.small}>{t('No balances yet.')}</Text>}
        {rows.map(c => (
          <Pressable key={c.id} style={S.listCard} onPress={() => navigation.navigate('CustomerDetail', {id: c.id})}>
            <Avatar name={label(c, lang.code, localizedNames)} />
            <Text style={[S.title, {flex: 1}]}>{label(c, lang.code, localizedNames)}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </Screen>
  );
}
