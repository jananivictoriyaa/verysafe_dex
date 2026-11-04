import React, {useState} from 'react';
import {Modal, Pressable, ScrollView, Text} from 'react-native';
import {colors} from '../theme/colors';
import {LANGS, useLang} from '../state/lang';

export default function LanguagePicker({onSelect}: {onSelect?: () => void}) {
  const {lang, setLang, t} = useLang();
  const [visible, setVisible] = useState(false);

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('Select language')}
        onPress={() => setVisible(true)}
        style={{backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border, borderRadius: 24, paddingHorizontal: 18, paddingVertical: 12}}>
        <Text style={{fontWeight: '800', fontSize: 16, color: colors.text}}>{lang.label} ▾</Text>
      </Pressable>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <Pressable onPress={() => setVisible(false)} style={{flex: 1, justifyContent: 'center', backgroundColor: '#0007', padding: 28}}>
          <Pressable onPress={event => event.stopPropagation()} style={{backgroundColor: '#fff', borderRadius: 24, padding: 18, maxHeight: '75%'}}>
            <Text style={{fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: 12}}>{t('Select language')}</Text>
            <ScrollView>
              {LANGS.map(item => (
                <Pressable
                  accessibilityRole="button"
                  key={item.code}
                  onPress={() => { setLang(item); setVisible(false); onSelect?.(); }}
                  style={{paddingVertical: 14, paddingHorizontal: 12, borderRadius: 14, backgroundColor: item.code === lang.code ? colors.mint : '#fff'}}>
                  <Text style={{fontSize: 18, fontWeight: item.code === lang.code ? '800' : '500', color: colors.text}}>{item.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
