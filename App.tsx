import React, {useEffect, useState} from 'react';
import {Alert, StatusBar, Text, View} from 'react-native';
import {NavigationContainer} from '@react-navigation/native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {SafeAreaProvider} from 'react-native-safe-area-context';

import {initDb} from './src/db/database';
import {colors} from './src/theme/colors';
import {LangProvider, useLang} from './src/state/lang';
import {AuthProvider, useAuth} from './src/state/auth';
import {translate} from './src/state/translations';
import HomeScreen from './src/screens/HomeScreen';
import JournalScreen from './src/screens/JournalScreen';
import LedgerScreen from './src/screens/LedgerScreen';
import CustomersScreen from './src/screens/CustomersScreen';
import NewEntryScreen from './src/screens/NewEntryScreen';
import CheckSaveScreen from './src/screens/CheckSaveScreen';
import CustomerDetailScreen from './src/screens/CustomerDetailScreen';
import RemindersScreen from './src/screens/RemindersScreen';
import SignupScreen from './src/screens/SignupScreen';
import LoginScreen from './src/screens/LoginScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const icon = (g: string) => ({color}: {color: string}) => <Text style={{fontSize: 20, color}}>{g}</Text>;

function Tabs() {
  const {t} = useLang();
  return (
    <Tab.Navigator screenOptions={{headerShown: false, tabBarActiveTintColor: colors.primary, tabBarInactiveTintColor: colors.muted, tabBarLabelStyle: {fontSize: 12, fontWeight: '700'}}}>
      <Tab.Screen name="Home" component={HomeScreen} options={{tabBarLabel: t('Home'), tabBarIcon: icon('⌂')}} />
      <Tab.Screen name="Journal" component={JournalScreen} options={{tabBarLabel: t('Journal'), tabBarIcon: icon('▤')}} />
      <Tab.Screen name="Ledger" component={LedgerScreen} options={{tabBarLabel: t('Ledger'), tabBarIcon: icon('☰')}} />
      <Tab.Screen name="Customers" component={CustomersScreen} options={{tabBarLabel: t('Customers'), tabBarIcon: icon('👥')}} />
    </Tab.Navigator>
  );
}

function RootNavigator() {
  const {status, hasAccount} = useAuth();

  if (status === 'loading') {
    return (
      <View style={{flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background}}>
        <Text style={{fontSize: 30, fontWeight: '900', color: colors.primary}}>LedgerHear</Text>
        <Text style={{color: colors.muted, marginTop: 8}}>உங்கள் கணக்கு தயாராகிறது…</Text>
      </View>
    );
  }

  if (status === 'out') {
    return (
      <Stack.Navigator key={hasAccount ? 'login' : 'signup'} screenOptions={{headerShown: false}}>
        {hasAccount
          ? <Stack.Screen name="Login" component={LoginScreen} />
          : <Stack.Screen name="Signup" component={SignupScreen} />}
      </Stack.Navigator>
    );
  }

  return (
    <Stack.Navigator key="app" screenOptions={{headerShown: false}}>
      <Stack.Screen name="Tabs" component={Tabs} />
      <Stack.Screen name="NewEntry" component={NewEntryScreen} options={{animation: 'slide_from_bottom'}} />
      <Stack.Screen name="CheckSave" component={CheckSaveScreen} />
      <Stack.Screen name="CustomerDetail" component={CustomerDetailScreen} />
      <Stack.Screen name="Reminders" component={RemindersScreen} />
    </Stack.Navigator>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    initDb().then(() => setReady(true)).catch((e: any) => Alert.alert(translate('ta', 'Database error'), String(e?.message ?? e)));
  }, []);

  if (!ready) {
    return (
      <View style={{flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background}}>
        <Text style={{fontSize: 30, fontWeight: '900', color: colors.primary}}>LedgerHear</Text>
        <Text style={{color: colors.muted, marginTop: 8}}>உங்கள் கணக்கு தயாராகிறது…</Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <LangProvider>
        <AuthProvider>
          <StatusBar barStyle="dark-content" />
          <NavigationContainer>
            <RootNavigator />
          </NavigationContainer>
        </AuthProvider>
      </LangProvider>
    </SafeAreaProvider>
  );
}
