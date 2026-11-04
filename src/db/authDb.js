import {initDb} from './database';

let ready;
async function db() {
  const d = await initDb();
  if (!ready) {
    ready = d.executeSql(`CREATE TABLE IF NOT EXISTS shopkeeper (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_name TEXT NOT NULL,
      shop_name TEXT NOT NULL,
      phone TEXT NOT NULL UNIQUE,
      pin_hash TEXT NOT NULL,
      logged_in INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );`);
  }
  await ready;
  return d;
}

// Simple salted hash so the PIN is not stored as plain text.
// NOTE: this is local device protection only, not server-grade security.
function hashPin(pin, salt) {
  const s = `${salt}:${pin}`;
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return h.toString(16);
}

const first = res => (res.rows.length ? res.rows.item(0) : null);

export async function hasShopkeeper() {
  const d = await db();
  const [r] = await d.executeSql('SELECT COUNT(*) AS n FROM shopkeeper');
  return r.rows.item(0).n > 0;
}

export async function getSessionShopkeeper() {
  const d = await db();
  const [r] = await d.executeSql('SELECT * FROM shopkeeper WHERE logged_in = 1 LIMIT 1');
  return first(r);
}

export async function registerShopkeeper(ownerName, shopName, phone, pin) {
  const d = await db();
  if (await hasShopkeeper()) throw new Error('An account already exists on this phone. Please log in.');
  const p = normalizePhoneDigits(phone).slice(-10);
  await d.executeSql(
    'INSERT INTO shopkeeper (owner_name, shop_name, phone, pin_hash, logged_in) VALUES (?, ?, ?, ?, 1)',
    [ownerName.trim(), shopName.trim(), p, hashPin(pin, p)],
  );
  return getSessionShopkeeper();
}

export async function loginShopkeeper(phone, pin) {
  const d = await db();
  const p = normalizePhoneDigits(phone).slice(-10);
  const [r] = await d.executeSql('SELECT * FROM shopkeeper WHERE phone = ?', [p]);
  const u = first(r);
  if (!u || u.pin_hash !== hashPin(pin, p)) throw new Error('Wrong phone number or PIN.');
  await d.executeSql('UPDATE shopkeeper SET logged_in = 1 WHERE id = ?', [u.id]);
  return {...u, logged_in: 1};
}

function normalizePhoneDigits(value) {
  return String(value || '').replace(/[\u0BE6-\u0BEF\u0966-\u096F\u0C66-\u0C6F\u09E6-\u09EF\u0D66-\u0D6F\u0CE6-\u0CEF]/g, ch => {
    const code = ch.charCodeAt(0);
    const base = code >= 0x0d66 ? 0x0d66
      : code >= 0x0ce6 ? 0x0ce6
        : code >= 0x0c66 ? 0x0c66
          : code >= 0x0be6 ? 0x0be6
            : code >= 0x09e6 ? 0x09e6
              : 0x0966;
    return String(code - base);
  }).replace(/\D/g, '');
}

export async function logoutShopkeeper() {
  const d = await db();
  await d.executeSql('UPDATE shopkeeper SET logged_in = 0');
}