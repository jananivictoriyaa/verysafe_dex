import React, {createContext, useCallback, useContext, useEffect, useState, type PropsWithChildren} from 'react';
import {
  getSessionShopkeeper, hasShopkeeper, loginShopkeeper, logoutShopkeeper, registerShopkeeper,
} from '../db/authDb.js';
import {setShopName} from '../utils';

export type Shop = {id: number; owner_name: string; shop_name: string; phone: string};

type AuthState = {
  status: 'loading' | 'in' | 'out';
  hasAccount: boolean;
  shop: Shop | null;
  signUp: (owner: string, shop: string, phone: string, pin: string) => Promise<void>;
  logIn: (phone: string, pin: string) => Promise<void>;
  logOut: () => Promise<void>;
};

const Ctx = createContext<AuthState>(null as any);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({children}: PropsWithChildren) {
  const [status, setStatus] = useState<'loading' | 'in' | 'out'>('loading');
  const [hasAccount, setHasAccount] = useState(false);
  const [shop, setShop] = useState<Shop | null>(null);

  const apply = useCallback((s: Shop | null, has: boolean) => {
    setShop(s);
    setHasAccount(has);
    if (s) setShopName(s.shop_name);
    setStatus(s ? 'in' : 'out');
  }, []);

  // On every app start: restore the saved session (if any)
  useEffect(() => {
    (async () => {
      try {
        const [s, has] = await Promise.all([getSessionShopkeeper(), hasShopkeeper()]);
        apply(s, has);
      } catch {
        apply(null, false);
      }
    })();
  }, [apply]);

  const signUp = async (owner: string, shopName: string, phone: string, pin: string) => {
    const s = await registerShopkeeper(owner, shopName, phone, pin);
    apply(s, true);
  };
  const logIn = async (phone: string, pin: string) => {
    const s = await loginShopkeeper(phone, pin);
    apply(s, true);
  };
  const logOut = async () => {
    await logoutShopkeeper();
    apply(null, true);
  };

  return <Ctx.Provider value={{status, hasAccount, shop, signUp, logIn, logOut}}>{children}</Ctx.Provider>;
}