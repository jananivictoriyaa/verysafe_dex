import React, {useState} from 'react';
import {Alert, ScrollView, StyleSheet, Text, TextInput, View} from 'react-native';
import {Btn, S, Screen} from '../components/ui';
import {colors} from '../theme/colors';
import {useAuth} from '../state/auth';
import {toAsciiDigits} from '../utils';

export default function LoginScreen() {
  const {logIn} = useAuth();
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (toAsciiDigits(phone).replace(/\D/g, '').length < 10) return Alert.alert('Phone needed', 'Enter your 10-digit mobile number.');
    if (!/^\d{4}$/.test(pin)) return Alert.alert('PIN needed', 'Enter your 4-digit PIN.');
    setBusy(true);
    try {
      await logIn(phone, pin); // success -> app switches to Home automatically
    } catch (e: any) {
      Alert.alert('Login failed', String(e?.message ?? e));
      setBusy(false);
    }
  };

  return (
    <Screen bottom>
      <ScrollView contentContainerStyle={[S.pad, styles.content]} keyboardShouldPersistTaps="handled">
        <Text style={styles.brand}>LedgerHear</Text>
        <Text style={[S.h1, styles.heading]}>Welcome back</Text>
        <Text style={[S.small, styles.description]}>Log in to open your ledger</Text>

        <View style={S.card}>
          <TextInput style={S.input} placeholder="Mobile number" placeholderTextColor={colors.muted} value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={13} />
          <TextInput style={S.input} placeholder="4-digit PIN" placeholderTextColor={colors.muted} value={pin} onChangeText={setPin} keyboardType="number-pad" secureTextEntry maxLength={4} onSubmitEditing={submit} />
          <Btn title={busy ? 'Please wait…' : 'Log in'} onPress={submit} disabled={busy} />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {paddingTop: 48},
  brand: {fontSize: 30, fontWeight: '900', color: colors.primary},
  heading: {marginTop: 8},
  description: {marginBottom: 18, marginTop: 4},
});