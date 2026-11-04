import SQLite from 'react-native-sqlite-storage';

SQLite.enablePromise(true);

let dbInstance;
let initPromise;

const BAL = `CASE
  WHEN e.type IN ('credit','half') THEN e.amount - e.paid_amount
  WHEN e.type IN ('received','partial') THEN -e.amount
  ELSE 0 END`;

async function addColumnIfMissing(db, table, column, ddl) {
  const [res] = await db.executeSql(`PRAGMA table_info(${table});`);
  for (let i = 0; i < res.rows.length; i++) {
    if (res.rows.item(i).name === column) return;
  }
  await db.executeSql(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl};`);
}

export function initDb() {
  if (dbInstance) return Promise.resolve(dbInstance);
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const db = await SQLite.openDatabase({name: 'ledgerhear.db', location: 'default'});
    await db.executeSql('PRAGMA foreign_keys = ON;');
    await db.executeSql(`CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT DEFAULT '',
      area TEXT DEFAULT '',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );`);
    await db.executeSql(`CREATE TABLE IF NOT EXISTS entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      paid_amount REAL DEFAULT 0,
      note TEXT DEFAULT '',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    );`);
    // migrations for existing installs
    await addColumnIfMissing(db, 'customers', 'trade', "TEXT DEFAULT ''");
    await addColumnIfMissing(db, 'customers', 'share_consent', 'INTEGER DEFAULT 0');
    await addColumnIfMissing(db, 'customers', 'name_ta', "TEXT DEFAULT ''");
    await addColumnIfMissing(db, 'customers', 'name_hi', "TEXT DEFAULT ''");
    await addColumnIfMissing(db, 'customers', 'name_te', "TEXT DEFAULT ''");
    await addColumnIfMissing(db, 'customers', 'name_bn', "TEXT DEFAULT ''");
    await addColumnIfMissing(db, 'customers', 'name_ml', "TEXT DEFAULT ''");
    await addColumnIfMissing(db, 'customers', 'name_en', "TEXT DEFAULT ''");
    await db.executeSql(`CREATE TABLE IF NOT EXISTS app_metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );`);
    const [localizationVersionResult] = await db.executeSql(
      "SELECT value FROM app_metadata WHERE key = 'customer_name_localization_version';",
    );
    const localizationVersion = localizationVersionResult.rows.length
      ? localizationVersionResult.rows.item(0).value
      : null;
    if (localizationVersion !== '5') {
      await db.executeSql(
        `UPDATE customers SET name_ta = '', name_hi = '', name_te = '', name_bn = '', name_ml = '';`,
      );
      await db.executeSql(
        "INSERT OR REPLACE INTO app_metadata (key, value) VALUES ('customer_name_localization_version', '5');",
      );
    }
    dbInstance = db;
    return db;
  })();
  return initPromise;
}

function rows(result) {
  const out = [];
  for (let i = 0; i < result.rows.length; i++) out.push(result.rows.item(i));
  return out;
}

function normalizedPhone(value) {
  let digits = String(value || '').replace(/[\u0BE6-\u0BEF\u0966-\u096F\u0C66-\u0C6F\u09E6-\u09EF\u0D66-\u0D6F\u0CE6-\u0CEF]/g, ch => {
    const code = ch.charCodeAt(0);
    const base = code >= 0x0d66 ? 0x0d66
      : code >= 0x0ce6 ? 0x0ce6
        : code >= 0x0c66 ? 0x0c66
          : code >= 0x0be6 ? 0x0be6
            : code >= 0x09e6 ? 0x09e6
              : 0x0966;
    return String(code - base);
  }).replace(/\D/g, '');
  if (digits.startsWith('91') && digits.length === 12) digits = digits.slice(2);
  if (digits.startsWith('0') && digits.length === 11) digits = digits.slice(1);
  return digits.length === 10 ? digits : '';
}

export async function findCustomerByPhone(phone, excludeId = null) {
  const normalized = normalizedPhone(phone);
  if (!normalized) return null;
  const db = await initDb();
  const [result] = await db.executeSql(
    `SELECT id, name, phone, name_ta, name_hi, name_te, name_bn, name_ml, name_en
     FROM customers WHERE phone IS NOT NULL AND phone != ''`,
  );
  return rows(result).find(customer =>
    customer.id !== excludeId && normalizedPhone(customer.phone) === normalized,
  ) ?? null;
}

async function ensurePhoneAvailable(phone, excludeId = null) {
  const existing = await findCustomerByPhone(phone, excludeId);
  if (existing) {
    const error = new Error('PHONE_ALREADY_IN_USE');
    error.code = 'PHONE_ALREADY_IN_USE';
    error.customerId = existing.id;
    throw error;
  }
}

export async function addCustomer(name, phone = '', area = '', trade = '', langCode = 'en', localizedName = '') {
  const db = await initDb();
  await ensurePhoneAvailable(phone);
  const localizedColumn = {ta: 'name_ta', hi: 'name_hi', te: 'name_te', bn: 'name_bn', ml: 'name_ml', en: 'name_en'}[langCode];
  const columns = ['name', 'phone', 'area', 'trade'];
  const values = [name.trim(), normalizedPhone(phone) || phone.trim(), area.trim(), trade.trim()];
  if (localizedColumn && localizedName.trim()) {
    columns.push(localizedColumn);
    values.push(localizedName.trim());
  }
  const placeholders = columns.map(() => '?').join(', ');
  const [r] = await db.executeSql(
    `INSERT INTO customers (${columns.join(', ')}) VALUES (${placeholders})`,
    values,
  );
  return r.insertId;
}

export async function updateCustomerLocalizedName(customerId, langCode, localizedName) {
  const column = {ta: 'name_ta', hi: 'name_hi', te: 'name_te', bn: 'name_bn', ml: 'name_ml', en: 'name_en'}[langCode];
  if (!column || !localizedName.trim()) return;
  const db = await initDb();
  await db.executeSql(`UPDATE customers SET ${column} = ? WHERE id = ?`, [localizedName.trim(), customerId]);
}

export async function updateCustomerPhone(customerId, phone) {
  const db = await initDb();
  await ensurePhoneAvailable(phone, customerId);
  await db.executeSql('UPDATE customers SET phone = ? WHERE id = ?', [normalizedPhone(phone) || phone.trim(), customerId]);
}

export async function getCustomers() {
  const db = await initDb();
  const [result] = await db.executeSql(`
    SELECT c.*,
      COALESCE((SELECT SUM(${BAL}) FROM entries e WHERE e.customer_id = c.id), 0) AS balance,
      (SELECT COUNT(*) FROM entries e WHERE e.customer_id = c.id) AS entry_count,
      (SELECT CAST(julianday('now') - julianday(COALESCE(
         (SELECT MIN(x.created_at) FROM entries x
            WHERE x.customer_id = c.id AND x.type IN ('credit','half')
              AND x.created_at > COALESCE((SELECT MAX(r.created_at) FROM entries r
                                           WHERE r.customer_id = c.id AND r.type = 'received'), '0')),
         (SELECT MAX(r.created_at) FROM entries r WHERE r.customer_id = c.id AND r.type = 'received')
       )) AS INTEGER)) AS pending_days
    FROM customers c
    ORDER BY c.name COLLATE NOCASE;
  `);
  return rows(result);
}

export async function addEntry(customerId, type, amount, paidAmount = 0, note = '') {
  const db = await initDb();
  await db.executeSql(
    `INSERT INTO entries (customer_id, type, amount, paid_amount, note) VALUES (?, ?, ?, ?, ?)`,
    [customerId, type, amount, paidAmount, note.trim()],
  );
}

export async function getEntries() {
  const db = await initDb();
  const [result] = await db.executeSql(`
    SELECT e.*, c.name AS customer_name, c.trade AS customer_trade,
      c.name_ta, c.name_hi, c.name_te, c.name_bn, c.name_ml, c.name_en
    FROM entries e JOIN customers c ON c.id = e.customer_id
    ORDER BY e.id DESC;`);
  return rows(result);
}

export async function getEntriesByCustomer(customerId) {
  const db = await initDb();
  const [result] = await db.executeSql(
    'SELECT * FROM entries WHERE customer_id = ? ORDER BY id DESC', [customerId]);
  return rows(result);
}

export async function setShareConsent(customerId, on) {
  const db = await initDb();
  await db.executeSql('UPDATE customers SET share_consent = ? WHERE id = ?', [on ? 1 : 0, customerId]);
}

export async function getTotalBalance() {
  const customers = await getCustomers();
  return customers.reduce((t, c) => t + Number(c.balance || 0), 0);
}
