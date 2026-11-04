import React, {useEffect, useState} from 'react';
import {Alert, Linking, Pressable, ScrollView, Text, View} from 'react-native';
import {getCustomers} from '../db/database';
import {Avatar, Btn, Chip, Pill, S, Screen} from '../components/ui';
import {colors} from '../theme/colors';
import {useLang} from '../state/lang';
import {fmt, label, maskPhone, pendingDaysRemaining, reminderText, waNumber} from '../utils';
import {OVERDUE_DAYS} from '../config';

type Channel = 'sms' | 'whatsapp';

// Free, no sign-up: opens the phone's SMS app / WhatsApp with the message pre-filled.
async function openChannel(channel: Channel, c: any, text: string) {
  const num = waNumber(c.phone);
  const url = channel === 'sms'
    ? `sms:+${num}?body=${encodeURIComponent(text)}`
    : `https://wa.me/${num}?text=${encodeURIComponent(text)}`;
  await Linking.openURL(url);
}

export default function RemindersScreen({route, navigation}: any) {
  const {lang, t, localizedNames} = useLang();
  const [channel, setChannel] = useState<Channel>(route.params?.channel ?? 'sms');
  const [list, setList] = useState<any[]>([]);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [sent, setSent] = useState<Set<number>>(new Set());

  useEffect(() => {
    getCustomers().then(all => {
      const unpaid = all.filter((c: any) => c.balance > 0).sort((a: any, b: any) => (Number(b.pending_days) || 0) - (Number(a.pending_days) || 0));
      setList(unpaid);
      const focus = route.params?.focusId;
      setPicked(new Set(focus ? [focus] : unpaid.filter((c: any) => waNumber(c.phone).length >= 11).map((c: any) => c.id)));
    });
  }, [route.params?.focusId]);

  const toggle = (id: number) => setPicked(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const send = async (c: any) => {
    if (waNumber(c.phone).length < 11) return Alert.alert(t('No phone number'), t('Add a phone number for {name} in the Customers tab.', {name: label(c, lang.code, localizedNames)}));
    try {
      await openChannel(channel, c, reminderText(c, lang.code, localizedNames));
      setSent(s => new Set(s).add(c.id));
    } catch {
      Alert.alert(t(channel === 'whatsapp' ? 'WhatsApp not available' : 'SMS not available'), t('Could not open the app on this device.'));
    }
  };

  const queue = list.filter(c => picked.has(c.id) && !sent.has(c.id));

  return (
    <Screen bottom>
      <ScrollView contentContainerStyle={S.pad}>
        <View style={[S.row, {marginVertical: 12, gap: 16}]}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={12}><Text style={{fontSize: 28}}>‹</Text></Pressable>
          <View><Text style={[S.title, {fontSize: 22}]}>{t('Send reminders')}</Text><Text style={S.small}>{t('{count} customers have unpaid balance', {count: list.length})}</Text></View>
        </View>

        <View style={{flexDirection: 'row', gap: 8, marginBottom: 14}}>
          <Chip text="SMS" on={channel === 'sms'} onPress={() => setChannel('sms')} />
          <Chip text="WhatsApp" on={channel === 'whatsapp'} onPress={() => setChannel('whatsapp')} />
        </View>

        {list.length === 0 && <View style={S.card}><Text style={S.title}>{t('No unpaid customers 🎉')}</Text></View>}
        {list.map(c => {
          const hasPhone = waNumber(c.phone).length >= 11;
          return (
            <Pressable key={c.id} onPress={() => toggle(c.id)} style={[S.listCard, {borderColor: picked.has(c.id) ? colors.primary : colors.border, borderWidth: 2}]}>
              <Text style={{fontSize: 24}}>{picked.has(c.id) ? '☑' : '☐'}</Text>
              <Avatar name={label(c, lang.code, localizedNames)} />
              <View style={{flex: 1}}>
              <Text style={S.title}>{label(c, lang.code, localizedNames)}</Text>
                <Text style={S.small}>{hasPhone ? maskPhone(c.phone) : `⚠ ${t('No phone number')}`} · {t('{days} days pending', {days: pendingDaysRemaining(Number(c.pending_days) || 0)})}</Text>
              </View>
              <View style={{alignItems: 'flex-end'}}>
                <Text style={{color: colors.rust, fontWeight: '800', fontSize: 17}}>{fmt(c.balance)}</Text>
                {sent.has(c.id) ? <Pill text={t('Sent ✓')} tone="mint" /> : Number(c.pending_days) >= OVERDUE_DAYS ? <Pill text={t('Overdue')} /> : null}
              </View>
              <Pressable onPress={() => send(c)} hitSlop={8} style={{backgroundColor: channel === 'sms' ? colors.orange : colors.green, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8}}>
                <Text style={{fontWeight: '800', color: channel === 'sms' ? colors.text : '#fff'}}>{t('Send')}</Text>
              </Pressable>
            </Pressable>
          );
        })}
        {list[0] && <Text style={[S.small, {marginTop: 8}]}>{t('Message preview:')} {reminderText(list.find(c => picked.has(c.id)) ?? list[0], lang.code, localizedNames)}</Text>}
      </ScrollView>
      <View style={{paddingHorizontal: 18, paddingBottom: 10}}>
        <Btn title={queue.length ? t('Send next ({count} left)', {count: queue.length}) : t('All selected sent')} disabled={!queue.length} onPress={() => send(queue[0])} kind={channel === 'sms' ? 'orange' : 'green'} />
      </View>
    </Screen>
  );
}
