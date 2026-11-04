import React, {useState} from 'react';
import {Alert, ScrollView, Text, TextInput, View} from 'react-native';
import {Btn, S, Screen} from '../components/ui';
import {colors} from '../theme/colors';
import {useAuth} from '../state/auth';
import {toAsciiDigits} from '../utils';

export default function SignupScreen() {
  const {signUp} = useAuth();
  const [owner, setOwner] = useState('');
  const [shop, setShop] = useState('');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!owner.trim()) return Alert.alert('Name needed', 'Please enter your name.');
    if (!shop.trim()) return Alert.alert('Shop name needed', 'Please enter your shop name.');
    if (toAsciiDigits(phone).replace(/\D/g, '').length < 10) return Alert.alert('Phone needed', 'Enter a 10-digit mobile number.');
    if (!/^\d{4}$/.test(pin)) return Alert.alert('PIN needed', 'PIN must be exactly 4 digits.');
    if (pin !== pin2) return Alert.alert('PIN mismatch', 'The two PINs do not match.');
    setBusy(true);
    try {
      await signUp(owner, shop, phone, pin); // success -> app switches to Home automatically
    } catch (e: any) {
      Alert.alert('Could not register', String(e?.message ?? e));
      setBusy(false);
    }
  };

  return (
    <Screen bottom>
      <ScrollView contentContainerStyle={[S.pad, {paddingTop: 24}]} keyboardShouldPersistTaps="handled">
        <Text style={{fontSize: 30, fontWeight: '900', color: colors.primary}}>LedgerHear</Text>
        <Text style={[S.h1, {marginTop: 8}]}>Create your account</Text>
        <Text style={[S.small, {marginBottom: 18, marginTop: 4}]}>One-time setup for your shop</Text>

        <View style={S.card}>
          <TextInput style={S.input} placeholder="Your name" placeholderTextColor={colors.muted} value={owner} onChangeText={setOwner} />
          <TextInput style={S.input} placeholder="Shop name" placeholderTextColor={colors.muted} value={shop} onChangeText={setShop} />
          <TextInput style={S.input} placeholder="Mobile number (10 digits)" placeholderTextColor={colors.muted} value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={13} />
          <TextInput style={S.input} placeholder="Create 4-digit PIN" placeholderTextColor={colors.muted} value={pin} onChangeText={setPin} keyboardType="number-pad" secureTextEntry maxLength={4} />
          <TextInput style={S.input} placeholder="Confirm PIN" placeholderTextColor={colors.muted} value={pin2} onChangeText={setPin2} keyboardType="number-pad" secureTextEntry maxLength={4} />
          <Btn title={busy ? 'Please wait…' : 'Register'} onPress={submit} disabled={busy} />
        </View>
        <Text style={[S.small, {marginTop: 12, textAlign: 'center'}]}>Remember your PIN. You will need it after you log out.</Text>
      </ScrollView>
    </Screen>
  );
}