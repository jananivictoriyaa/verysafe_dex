import {calculateTrustMetrics} from './trustScore';

const now = Date.parse('2025-02-01T12:00:00Z');

function daysAgo(days: number) {
  return new Date(now - days * 86400000).toISOString().replace('T', ' ').replace('Z', '');
}

function entry(id: number, type: string, amount: number, days: number, paid_amount = 0) {
  return {id, type, amount, paid_amount, created_at: daysAgo(days)};
}

describe('calculateTrustMetrics', () => {
  it('returns a zero score before any credit history exists', () => {
    expect(calculateTrustMetrics([], now)).toEqual({
      score: null, onTime: 0, repaid: 0, history: 0, months: 0,
    });
  });

  it('counts a timely receipt against the original credit and includes upfront half-payments', () => {
    const result = calculateTrustMetrics([
      entry(1, 'credit', 100, 20),
      entry(2, 'received', 80, 18),
      entry(3, 'half', 100, 10, 20),
    ], now);

    expect(result).toEqual({score: 43, onTime: 50, repaid: 50, history: 17, months: 1});
  });

  it('does not count a late repayment as an on-time payment', () => {
    const result = calculateTrustMetrics([
      entry(1, 'credit', 100, 30),
      entry(2, 'received', 100, 10),
    ], now);

    expect(result).toEqual({score: 43, onTime: 0, repaid: 100, history: 17, months: 1});
  });

  it('leaves receipts before a credit unallocated', () => {
    const result = calculateTrustMetrics([
      entry(1, 'received', 100, 30),
      entry(2, 'credit', 100, 20),
    ], now);

    expect(result).toEqual({score: 3, onTime: 0, repaid: 0, history: 17, months: 1});
  });

  it('treats an unpaid balance within the overdue window as currently on time', () => {
    const result = calculateTrustMetrics([entry(1, 'credit', 100, 5)], now);

    expect(result).toEqual({score: 43, onTime: 100, repaid: 0, history: 17, months: 1});
  });

  it('uses the same 7-day overdue boundary as the rest of the app', () => {
    const result = calculateTrustMetrics([entry(1, 'credit', 100, 7)], now);

    expect(result).toEqual({score: 3, onTime: 0, repaid: 0, history: 17, months: 1});
  });
});
