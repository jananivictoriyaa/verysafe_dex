import React, {useCallback, useMemo, useState} from 'react';
import {ScrollView, Share, Text, View} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {getEntries} from '../db/database';
import {Btn, Chip, S, Screen} from '../components/ui';
import {colors} from '../theme/colors';
import {customerName, dayLabel, fmt, isWithinJournalPeriod, type JournalPeriod} from '../utils';
import {useLang} from '../state/lang';
import LanguagePicker from '../components/LanguagePicker';

const FILTERS = [['credit', 'Credit'], ['paid', 'Paid'], ['partial', 'Partial payment'], ['received', 'Received']] as const;
const PERIODS: [JournalPeriod, string][] = [
  ['today', 'Today'], ['week', 'This week'], ['month', 'This month'], ['year', 'This year'], ['all', 'All time'],
];
const WIDTHS = {date: 76, account: 210, ref: 54, amount: 92};

type Posting = {entry: any; account: string; debit: number; credit: number; detail?: string};

function postingsFor(entry: any, name: string, t: (key: string) => string): Posting[] {
  const posting = (account: string, debit: number, credit: number, detail?: string): Posting => ({entry, account, debit, credit, detail});
  const receivable = `${t('Accounts receivable')} — ${name}`;
  if (entry.type === 'credit') {
    return [posting(receivable, entry.amount, 0), posting(t('Sales'), 0, entry.amount, t('Credit sale'))];
  }
  if (entry.type === 'half') {
    return [
      posting(t('Cash'), entry.paid_amount, 0, t('Partial payment')),
      posting(receivable, entry.amount - entry.paid_amount, 0),
      posting(t('Sales'), 0, entry.amount, t('Partial payment and credit')),
    ];
  }
  if (entry.type === 'received') {
    return [
      posting(t('Cash'), entry.amount, 0, t('Received payment from customer')),
      posting(receivable, 0, entry.amount),
    ];
  }
  if (entry.type === 'partial') {
    return [
      posting(t('Cash'), entry.amount, 0, t('Partial payment')),
      posting(receivable, 0, entry.amount),
    ];
  }
  return [posting(t('Cash'), entry.amount, 0, t('Sale paid in cash')), posting(t('Sales'), 0, entry.amount)];
}

export default function JournalScreen() {
  const {lang, t, localizedNames} = useLang();
  const [entries, setEntries] = useState<any[]>([]);
  const [period, setPeriod] = useState<JournalPeriod>('today');
  const [type, setType] = useState<string | null>(null);

  useFocusEffect(useCallback(() => { getEntries().then(setEntries).catch(() => {}); }, []));

  const now = new Date();
  const filtered = useMemo(() => entries.filter(entry =>
    isWithinJournalPeriod(entry.created_at, period, now),
  ), [entries, period, now.getDate(), now.getMonth(), now.getFullYear()]); // eslint-disable-line react-hooks/exhaustive-deps

  const udhaar = filtered.reduce((t, e) => t + (e.type === 'credit' ? e.amount : e.type === 'half' ? e.amount - e.paid_amount : 0), 0);
  const cashIn = filtered.reduce((t, e) => t + (e.type === 'received' || e.type === 'partial' ? e.amount : e.type === 'paid' ? e.amount : e.type === 'half' ? e.paid_amount : 0), 0);
  const shown = type ? filtered.filter(e => e.type === type) : filtered;
  const rows = shown.flatMap(entry => postingsFor(entry, customerName(entry, lang.code, localizedNames), t));
  const totalDebit = rows.reduce((sum, row) => sum + row.debit, 0);
  const totalCredit = rows.reduce((sum, row) => sum + row.credit, 0);

  const shareReport = () => {
    const lines = rows.map(row => `${dayLabel(row.entry.created_at, lang.code)}  ${row.account}  ${row.debit ? fmt(row.debit) : ''}  ${row.credit ? fmt(row.credit) : ''}`);
    const periodLabel = PERIODS.find(([key]) => key === period)?.[1] ?? 'Today';
    Share.share({message: `${t('Journal')} – ${t(periodLabel)}\n${t('Credit')}: ${fmt(udhaar)}\n${t('Cash in')}: ${fmt(cashIn)}\n\n${lines.join('\n')}`});
  };

  const tableHeader = (
    <View style={{flexDirection: 'row', backgroundColor: colors.primary}}>
      {[
        [t('Date'), WIDTHS.date, 'left'],
        [t('Account title and explanation'), WIDTHS.account, 'left'],
        [t('Ref'), WIDTHS.ref, 'center'],
        [t('Debit'), WIDTHS.amount, 'right'],
        [t('Credit'), WIDTHS.amount, 'right'],
      ].map(([title, width, align]) => (
        <Text key={String(title)} style={{width: Number(width), paddingHorizontal: 7, paddingVertical: 10, color: '#fff', fontWeight: '800', fontSize: 12, textAlign: align as 'left' | 'center' | 'right'}}>{title}</Text>
      ))}
    </View>
  );

  return (
    <Screen>
      <ScrollView contentContainerStyle={[S.pad, {paddingTop: 12}]}>
        <View style={[S.row, {justifyContent: 'space-between', marginBottom: 14}]}>
          <Text style={S.h1}>{t('Journal')}</Text>
          <LanguagePicker />
        </View>
        <View style={{flexDirection: 'row', gap: 8, marginBottom: 8, flexWrap: 'wrap'}}>
          {PERIODS.map(([key, label]) =>
            <Chip key={key} text={t(label)} on={period === key} onPress={() => setPeriod(key)} />,
          )}
        </View>
        <View style={{flexDirection: 'row', gap: 8, marginBottom: 14, flexWrap: 'wrap'}}>
          {FILTERS.map(([k, l]) => <Chip key={k} text={t(l)} on={type === k} onPress={() => setType(type === k ? null : k)} />)}
        </View>
        <View style={{flexDirection: 'row', gap: 12, marginBottom: 14}}>
          <View style={[S.card, {flex: 1}]}><Text style={S.small}>{t('Credit')}</Text><Text style={{fontSize: 26, fontWeight: '800', color: colors.rust}}>{fmt(udhaar)}</Text></View>
          <View style={[S.card, {flex: 1}]}><Text style={S.small}>{t('Cash in')}</Text><Text style={{fontSize: 26, fontWeight: '800', color: colors.green}}>{fmt(cashIn)}</Text></View>
        </View>

        {shown.length === 0
          ? <View style={S.card}><Text style={S.title}>{t('No entries')}</Text></View>
          : <ScrollView horizontal showsHorizontalScrollIndicator>
              <View style={{borderWidth: 1, borderColor: colors.border}}>
                {tableHeader}
                {rows.map((row, index) => {
                  const firstForEntry = index === 0 || rows[index - 1].entry.id !== row.entry.id;
                  const lastForEntry = index === rows.length - 1 || rows[index + 1].entry.id !== row.entry.id;
                  return (
                    <View key={`${row.entry.id}-${index}`} style={{flexDirection: 'row', minHeight: 48, backgroundColor: index % 2 ? '#fff' : colors.surface, borderBottomWidth: lastForEntry ? 1 : 0.5, borderColor: colors.border}}>
                      <Text style={{width: WIDTHS.date, padding: 7, color: colors.text, fontSize: 12, textAlign: 'left'}}>{firstForEntry ? dayLabel(row.entry.created_at, lang.code) : ''}</Text>
                      <View style={{width: WIDTHS.account, paddingVertical: 7, paddingHorizontal: 9, justifyContent: 'center'}}>
                        <Text style={{fontSize: 13, fontWeight: row.account.includes(' — ') ? '700' : '500', color: colors.text}}>{row.account}</Text>
                        {!!row.detail && <Text style={{fontSize: 11, color: colors.muted, marginTop: 2}}>({row.detail})</Text>}
                      </View>
                      <Text style={{width: WIDTHS.ref, padding: 7, color: colors.muted, fontSize: 12, textAlign: 'center'}}>{firstForEntry ? `#${row.entry.id}` : ''}</Text>
                      <Text style={{width: WIDTHS.amount, padding: 7, color: colors.text, fontSize: 13, textAlign: 'right'}}>{row.debit ? fmt(row.debit) : ''}</Text>
                      <Text style={{width: WIDTHS.amount, padding: 7, color: colors.text, fontSize: 13, textAlign: 'right'}}>{row.credit ? fmt(row.credit) : ''}</Text>
                    </View>
                  );
                })}
                <View style={{flexDirection: 'row', backgroundColor: colors.mint}}>
                  <Text style={{width: WIDTHS.date + WIDTHS.account + WIDTHS.ref, padding: 9, fontWeight: '800', color: colors.text}}>{t('Total')}</Text>
                  <Text style={{width: WIDTHS.amount, padding: 9, fontWeight: '800', color: colors.text, textAlign: 'right'}}>{fmt(totalDebit)}</Text>
                  <Text style={{width: WIDTHS.amount, padding: 9, fontWeight: '800', color: colors.text, textAlign: 'right'}}>{fmt(totalCredit)}</Text>
                </View>
              </View>
            </ScrollView>
        }
      </ScrollView>
      <View style={{paddingHorizontal: 18, paddingBottom: 10}}><Btn title={`⬇  ${t('Share report')}`} onPress={shareReport} /></View>
    </Screen>
  );
}
