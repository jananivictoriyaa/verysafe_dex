import {translate} from '../src/state/translations';

describe('supported app language translations', () => {
  test.each([
    ['ta', 'கடன்'],
    ['hi', 'उधार'],
    ['te', 'అప్పు'],
    ['bn', 'বাকি'],
    ['ml', 'കടം'],
  ])('translates journal credit entries in %s', (language, expected) => {
    expect(translate(language, 'Credit')).toBe(expected);
  });

  test('keeps English labels in English', () => {
    expect(translate('en', 'Credit')).toBe('Credit');
  });

  test.each(['ta', 'hi', 'te', 'bn', 'ml'])('translates journal table labels and postings in %s', language => {
    for (const key of [
      'Date',
      'Account title and explanation',
      'Ref',
      'Debit',
      'Total',
      'Accounts receivable',
      'Sales',
      'Cash',
      'Credit sale',
      'Partial payment',
      'Partial payment and credit',
      'This week',
      'This month',
      'This year',
      'Received payment from customer',
      'Sale paid in cash',
    ]) {
      expect(translate(language, key)).not.toBe(key);
    }
  });

  test('substitutes values in translated confirmation prompts', () => {
    expect(translate('ta', 'Confirm {type} of {amount} for {name}?', {
      type: 'கடன்',
      amount: '₹100',
      name: 'Janani',
    })).toContain('Janani');
  });
});
