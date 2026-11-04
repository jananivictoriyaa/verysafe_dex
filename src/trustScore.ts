import {OVERDUE_DAYS} from './config';
import {parseDate} from './utils';

type TrustEntry = {
  id?: number;
  type: string;
  amount: number | string;
  paid_amount?: number | string;
  created_at: string;
};

export type TrustMetrics = {
  score: number | null;
  onTime: number;
  repaid: number;
  history: number;
  months: number;
};

const DAY_MS = 86400000;

function amount(value: number | string | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

export function calculateTrustMetrics(entries: TrustEntry[], now = Date.now()): TrustMetrics {
  const orderedEntries = entries
    .map(entry => ({entry, timestamp: parseDate(entry.created_at).getTime()}))
    .sort((a, b) => {
      if (Number.isFinite(a.timestamp) && Number.isFinite(b.timestamp) && a.timestamp !== b.timestamp) {
        return a.timestamp - b.timestamp;
      }
      return Number(a.entry.id || 0) - Number(b.entry.id || 0);
    });

  const credits = orderedEntries.filter(({entry}) => entry.type === 'credit' || entry.type === 'half');
  const totalCredit = credits.reduce((total, item) => total + amount(item.entry.amount), 0);
  if (totalCredit <= 0) return {score: null, onTime: 0, repaid: 0, history: 0, months: 0};

  const outstanding: {amount: number; timestamp: number}[] = [];
  let repaidAmount = 0;
  let onTimeAmount = 0;

  for (const {entry, timestamp} of orderedEntries) {
    if (entry.type === 'credit' || entry.type === 'half') {
      const principal = amount(entry.amount);
      const paidUpfront = entry.type === 'half' ? Math.min(principal, amount(entry.paid_amount)) : 0;
      repaidAmount += paidUpfront;
      onTimeAmount += paidUpfront;
      if (principal > paidUpfront) outstanding.push({amount: principal - paidUpfront, timestamp});
    } else if (entry.type === 'received' || entry.type === 'partial') {
      let remaining = amount(entry.amount);
      for (const loan of outstanding) {
        if (remaining <= 0) break;
        const paid = Math.min(remaining, loan.amount);
        loan.amount -= paid;
        remaining -= paid;
        repaidAmount += paid;
        if (Number.isFinite(timestamp) && Number.isFinite(loan.timestamp)
          && timestamp - loan.timestamp < OVERDUE_DAYS * DAY_MS) {
          onTimeAmount += paid;
        }
      }
    }
  }

  for (const loan of outstanding) {
    if (loan.amount > 0 && Number.isFinite(loan.timestamp)
      && now - loan.timestamp < OVERDUE_DAYS * DAY_MS) {
      onTimeAmount += loan.amount;
    }
  }

  const oldestCredit = credits.find(item => Number.isFinite(item.timestamp));
  const months = oldestCredit
    ? Math.max(1, Math.ceil((now - oldestCredit.timestamp) / (30 * DAY_MS)))
    : 0;
  const history = Math.min(100, Math.round((months / 6) * 100));
  const onTime = Math.min(100, Math.round((onTimeAmount / totalCredit) * 100));
  const repaid = Math.min(100, Math.round((repaidAmount / totalCredit) * 100));
  const score = Math.round(onTime * 0.4 + repaid * 0.4 + history * 0.2);

  return {score, onTime, repaid, history, months};
}
