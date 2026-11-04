import React, {type PropsWithChildren} from 'react';
import {Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {colors} from '../theme/colors';

export function Screen({children, bottom = false}: PropsWithChildren<{bottom?: boolean}>) {
  return (
    <SafeAreaView style={{flex: 1, backgroundColor: colors.background}} edges={bottom ? ['top', 'bottom'] : ['top']}>
      {children}
    </SafeAreaView>
  );
}

type BtnProps = {title: string; onPress: () => void; kind?: 'primary' | 'outline' | 'orange' | 'green'; style?: StyleProp<ViewStyle>; disabled?: boolean};
export function Btn({title, onPress, kind = 'primary', style, disabled}: BtnProps) {
  const bg = kind === 'primary' ? colors.primary : kind === 'orange' ? colors.orange : kind === 'green' ? colors.green : colors.surface;
  const fg = kind === 'outline' ? colors.primary : kind === 'orange' ? colors.text : '#fff';
  return (
    <Pressable onPress={onPress} disabled={disabled}
      style={[S.btn, {backgroundColor: bg, opacity: disabled ? 0.5 : 1}, kind === 'outline' && {borderWidth: 2, borderColor: colors.primary}, style]}>
      <Text style={[S.btnText, {color: fg}]}>{title}</Text>
    </Pressable>
  );
}

export function Pill({text, tone = 'rust'}: {text: string; tone?: 'rust' | 'mint' | 'orange' | 'primary'}) {
  const map = {
    rust: [colors.rustLight, colors.rust],
    mint: [colors.mint, colors.primary],
    orange: [colors.orange, colors.text],
    primary: [colors.primary, '#fff'],
  } as const;
  const [bg, fg] = map[tone];
  return (
    <View style={[S.pill, {backgroundColor: bg}]}>
      <Text style={{color: fg, fontWeight: '800', fontSize: 12}}>{text}</Text>
    </View>
  );
}

export function Avatar({name}: {name: string}) {
  return (
    <View style={S.avatar}>
      <Text style={{color: colors.primary, fontWeight: '800', fontSize: 18}}>{(name || '?').charAt(0).toUpperCase()}</Text>
    </View>
  );
}

export function Chip({text, on, onPress}: {text: string; on: boolean; onPress: () => void}) {
  return (
    <Pressable onPress={onPress} style={[S.chip, on && {backgroundColor: colors.primary, borderColor: colors.primary}]}>
      <Text style={{color: on ? '#fff' : colors.text, fontWeight: '800', fontSize: 15}}>{text}</Text>
    </Pressable>
  );
}

export const S = StyleSheet.create({
  pad: {paddingHorizontal: 18, paddingBottom: 24},
  h1: {fontSize: 30, fontWeight: '800', color: colors.text},
  small: {fontSize: 13, color: colors.muted},
  card: {backgroundColor: colors.surface, borderRadius: 22, borderWidth: 1, borderColor: colors.border, padding: 16},
  row: {flexDirection: 'row', alignItems: 'center'},
  listCard: {flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 22, borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 10, gap: 12},
  title: {fontSize: 17, fontWeight: '800', color: colors.text},
  btn: {minHeight: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18},
  btnText: {fontSize: 16, fontWeight: '800'},
  pill: {alignSelf: 'flex-end', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 14, marginTop: 4},
  avatar: {width: 46, height: 46, borderRadius: 23, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center'},
  chip: {paddingHorizontal: 18, paddingVertical: 11, borderRadius: 24, borderWidth: 2, borderColor: colors.border, backgroundColor: '#fff'},
  input: {borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, color: colors.text, backgroundColor: '#fff', marginBottom: 10},
  label: {fontSize: 14, fontWeight: '800', color: colors.muted, marginBottom: 8, marginTop: 6},
});
