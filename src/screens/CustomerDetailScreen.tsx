import React, {useCallback, useState} from 'react';
import {Alert, Pressable, ScrollView, Text, TextInput, View} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {getCustomers, getEntriesByCustomer, updateCustomerPhone} from '../db/database';
import {Avatar, Btn, Pill, S, Screen} from '../components/ui';
import {colors} from '../theme/colors';
import {dayLabel, fmt, label, maskPhone, normalizePhoneNumber, pendingDaysRemaining} from '../utils';
import {calculateTrustMetrics} from '../trustScore';
import {useLang} from '../state/lang';

function PhoneEditor({customer, localizedNames, onSaved}: {
  customer: any;
  localizedNames: Record<number, string>;
  onSaved: (phone: string) => void;
}) {
  const {lang, t} = useLang();
  const [editing, setEditing] = useState(false);
  const [phone, setPhone] = useState(customer.phone || '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const value = phone.trim();
    const normalized = normalizePhoneNumber(value);
    if (value && !normalized) {
      Alert.alert(t('Invalid phone number'), t('Enter a valid 10-digit phone number.'));
      return;
    }
    setSaving(true);
    try {
      await updateCustomerPhone(customer.id, normalized);
      onSaved(normalized);
      setPhone(normalized);
      setEditing(false);
    } catch (error: any) {
      if (error?.code === 'PHONE_ALREADY_IN_USE') {
        try {
          const customers = await getCustomers();
          const duplicate = customers.find(item => item.id === error.customerId);
          Alert.alert(
            t('Phone number already used'),
            t('This phone number is already saved under {name}.', {
              name: duplicate ? label(duplicate, lang.code, localizedNames) : t('another customer'),
            }),
          );
        } catch (lookupError: any) {
          Alert.alert(t('Could not update phone number'), String(lookupError?.message ?? lookupError));
        }
      } else {
        Alert.alert(t('Could not update phone number'), String(error?.message ?? error));
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <View>
      <Text style={S.label}>{t('Phone number')}</Text>
      {editing ? (
        <>
          <TextInput
            style={S.input}
            value={phone}
            onChangeText={setPhone}
            placeholder={t('Phone, 10 digits (needed for reminders)')}
            placeholderTextColor={colors.muted}
            keyboardType="phone-pad"
            maxLength={13}
            editable={!saving}
          />
          <View style={[S.row, {gap: 10}]}>
            <Btn title={t('Save phone number')} onPress={save} disabled={saving} style={{flex: 1}} />
            <Btn kind="outline" title={t('Cancel')} onPress={() => {
              setPhone(customer.phone || '');
              setEditing(false);
            }} disabled={saving} style={{flex: 1}} />
          </View>
        </>
      ) : (
        <View style={[S.row, {justifyContent: 'space-between', gap: 10}]}>
          <Text style={[S.title, {flex: 1, marginBottom: 8}]}>{customer.phone || t('No phone')}</Text>
          <Btn kind="outline" title={t('Edit phone number')} onPress={() => {
            setPhone(customer.phone || '');
            setEditing(true);
          }} />
        </View>
      )}
    </View>
  );
}

function Bar({title, value, text}: {title: string; value: number; text: string}) {
  return (
    <View style={{marginTop: 14}}>
      <View style={[S.row, {justifyContent: 'space-between'}]}>
        <Text style={{fontSize: 16, color: colors.text}}>{title}</Text>
        <Text style={{fontSize: 16, fontWeight: '800', color: colors.text}}>{text}</Text>
      </View>
      <View style={{height: 10, borderRadius: 5, backgroundColor: colors.mint, marginTop: 6}}>
        <View style={{height: 10, borderRadius: 5, backgroundColor: colors.primary, width: `${Math.max(2, Math.min(100, value))}%`}} />
      </View>
    </View>
  );
}

export default function CustomerDetailScreen({route, navigation}: any) {
  const {lang, t, localizedNames} = useLang();
  const {id, showTrust = false} = route.params;
  const [c, setC] = useState<any>(null);
  const [entries, setEntries] = useState<any[]>([]);

  useFocusEffect(useCallback(() => {
    getCustomers().then(l => setC(l.find((x: any) => x.id === id) ?? null));
    getEntriesByCustomer(id).then(setEntries);
  }, [id]));

  if (!c) return   <Screen><Text style={{padding: 20}}>{t('Loading…')}</Text></Screen>;

  if (showTrust) {
    const {score, onTime, repaid, history, months} = calculateTrustMetrics(entries);
    const days = pendingDaysRemaining(Number(c.pending_days) || 0);
    const tag = t(score === null ? 'No credit history' : score >= 75 ? 'Good repayer' : score >= 50 ? 'Average' : 'Needs follow-up');

    return (
      <Screen>
        <ScrollView contentContainerStyle={S.pad}>
          <View style={[S.row, {marginVertical: 12, gap: 16}]}>
            <Pressable onPress={() => navigation.goBack()} hitSlop={12}><Text style={{fontSize: 28}}>‹</Text></Pressable>
            <View>
              <Text style={[S.title, {fontSize: 22}]}>{label(c, lang.code, localizedNames)}</Text>
              <Text style={S.small}>{c.area ? c.area + ' · ' : ''}{c.phone ? maskPhone(c.phone) : t('No phone')}</Text>
            </View>
          </View>

          <View style={{backgroundColor: colors.primary, borderRadius: 28, padding: 22, marginBottom: 14}}>
            <View style={[S.row, {justifyContent: 'space-between'}]}>
              <Text style={{color: '#fff', fontSize: 16}}>{t('Owes you')}</Text>
              {c.balance > 0 && <Pill text={t('{days} days pending', {days})} />}
            </View>
            <Text style={{color: '#fff', fontSize: 44, fontWeight: '800'}}>{fmt(c.balance)}</Text>
          </View>

          <View style={[S.card, {marginBottom: 14}]}>
            <PhoneEditor customer={c} localizedNames={localizedNames} onSaved={phone => setC({...c, phone})} />
          </View>

          <View style={[S.card, {marginBottom: 14}]}>
            <View style={[S.row, {gap: 18}]}>
              <View style={{width: 104, height: 104, borderRadius: 52, borderWidth: 12, borderColor: score === null || score >= 50 ? colors.primary : colors.orange, alignItems: 'center', justifyContent: 'center'}}>
                <Text style={{fontSize: 34, fontWeight: '800', color: colors.text}}>{score ?? '—'}</Text>
              </View>
              <View><Text style={[S.title, {fontSize: 22}]}>{t('Trust score')}</Text><View style={{alignSelf: 'flex-start', marginTop: 4}}><Pill text={tag} tone="mint" /></View></View>
            </View>
            <Bar title={t('Paid on time')} value={onTime} text={onTime + '%'} />
            <Bar title={t('Repaid share')} value={repaid} text={repaid + '%'} />
            <Bar title={t('Length of history')} value={history} text={months + t(months === 1 ? ' month' : ' months')} />
          </View>

          <View style={{flexDirection: 'row', gap: 12, marginBottom: 14}}>
            <Btn kind="orange" title={`💬  ${t('SMS')}`} style={{flex: 1}} onPress={() => navigation.navigate('Reminders', {channel: 'sms', focusId: c.id})} />
            <Btn kind="green" title={`💬  ${t('WhatsApp')}`} style={{flex: 1}} onPress={() => navigation.navigate('Reminders', {channel: 'whatsapp', focusId: c.id})} />
          </View>

          <Text style={S.label}>{t('Recent entries')}</Text>
          {entries.slice(0, 8).map(entry => (
            <View key={entry.id} style={S.listCard}>
              <View style={{flex: 1}}>
                <Text style={S.title}>{t(entry.type === 'half' || entry.type === 'partial' ? 'Partial payment' : entry.type[0].toUpperCase() + entry.type.slice(1))}</Text>
                <Text style={S.small}>{dayLabel(entry.created_at, lang.code)}</Text>
              </View>
              <Text style={{fontWeight: '800', fontSize: 17, color: entry.type === 'received' || entry.type === 'partial' ? colors.green : colors.text}}>{fmt(entry.amount)}</Text>
            </View>
          ))}
        </ScrollView>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={S.pad}>
        <View style={[S.row, {marginVertical: 12, gap: 16}]}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={12}><Text style={{fontSize: 28}}>‹</Text></Pressable>
          <Text style={[S.title, {fontSize: 22}]}>{t('Customer details')}</Text>
        </View>

        <View style={[S.card, {marginBottom: 16}]}>
          <View style={[S.row, {gap: 14, marginBottom: 16}]}>
            <Avatar name={label(c, lang.code, localizedNames)} />
            <View style={{flex: 1}}>
              <Text style={[S.title, {fontSize: 22}]}>{label(c, lang.code, localizedNames)}</Text>
              {!!c.area && <Text style={S.small}>{c.area}</Text>}
            </View>
          </View>
          <PhoneEditor customer={c} localizedNames={localizedNames} onSaved={phone => setC({...c, phone})} />
          <Text style={S.label}>{t('Current balance')}</Text>
          <Text style={{fontSize: 32, fontWeight: '800', color: c.balance > 0 ? colors.rust : colors.primary}}>{fmt(c.balance)}</Text>
        </View>

        <Text style={[S.label, {marginBottom: 8}]}>{t('Credit history')}</Text>
        {entries.length === 0 && <View style={S.card}><Text style={S.small}>{t('No entries')}</Text></View>}
        {entries.map(e => (
          <View key={e.id} style={S.listCard}>
            <View style={{flex: 1}}>
              <Text style={S.title}>{t(e.type === 'half' || e.type === 'partial' ? 'Partial payment' : e.type[0].toUpperCase() + e.type.slice(1))}</Text>
              <Text style={S.small}>{dayLabel(e.created_at, lang.code)}</Text>
              {e.type === 'half' && <Text style={S.small}>{t('Paid now (₹)')}: {fmt(e.paid_amount)}</Text>}
            </View>
            <Text style={{fontWeight: '800', fontSize: 17, color: e.type === 'received' || e.type === 'partial' ? colors.green : colors.text}}>{fmt(e.amount)}</Text>
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}
