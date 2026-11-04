import {customerName, formatPhoneDigits, isNameInLanguage, isPlausibleNameLocalization, isWithinJournalPeriod, label, pendingDaysRemaining, transliterateName} from '../src/utils';

describe('customer name localization', () => {
  test('uses the selected language name for all customer records', () => {
    const customer = {id: 7, name: 'Janani', name_ta: 'ஜனனி', name_hi: 'जननी'};

    expect(customerName(customer, 'ta')).toBe('ஜனனி');
    expect(customerName(customer, 'hi')).toBe('जननी');
    expect(customerName(customer, 'en')).toBe('Janani');
  });

  describe('payment due countdown', () => {
    test('shows six days remaining on the day a new credit is recorded', () => {
      expect(pendingDaysRemaining(0)).toBe(6);
    });

    describe('journal date periods', () => {
      const timestamp = (date: Date) => date.toISOString().replace('T', ' ').replace('Z', '');
      const now = new Date(2025, 0, 8, 15);

      test('filters to today by the device local date', () => {
        expect(isWithinJournalPeriod(timestamp(new Date(2025, 0, 8, 9)), 'today', now)).toBe(true);
        expect(isWithinJournalPeriod(timestamp(new Date(2025, 0, 7, 23)), 'today', now)).toBe(false);
      });

      test('filters weeks from Monday and excludes earlier dates', () => {
        expect(isWithinJournalPeriod(timestamp(new Date(2025, 0, 6, 9)), 'week', now)).toBe(true);
        expect(isWithinJournalPeriod(timestamp(new Date(2025, 0, 5, 23)), 'week', now)).toBe(false);
      });

      test('filters month and year boundaries', () => {
        expect(isWithinJournalPeriod(timestamp(new Date(2025, 0, 1, 9)), 'month', now)).toBe(true);
        expect(isWithinJournalPeriod(timestamp(new Date(2024, 11, 31, 23)), 'month', now)).toBe(false);
        expect(isWithinJournalPeriod(timestamp(new Date(2025, 0, 1, 9)), 'year', now)).toBe(true);
        expect(isWithinJournalPeriod(timestamp(new Date(2024, 11, 31, 23)), 'year', now)).toBe(false);
      });

      test('includes any entry in all-time view and ignores invalid dates otherwise', () => {
        expect(isWithinJournalPeriod('not a date', 'all', now)).toBe(true);
        expect(isWithinJournalPeriod('not a date', 'today', now)).toBe(false);
      });
    });

    test('counts down to zero during the seven-day payment window', () => {
      expect(pendingDaysRemaining(1)).toBe(5);
      expect(pendingDaysRemaining(6)).toBe(0);
      expect(pendingDaysRemaining(7)).toBe(0);
    });
  });

  test('locally transliterates an English name when its selected-language version is missing', () => {
    expect(customerName({id: 8, name: 'Janani'}, 'ta')).toBe('ஜனனி');
  });

  test('preserves a customer name already written in the selected script', () => {
    expect(customerName({name: 'ஜனனி'}, 'ta')).toBe('ஜனனி');
  });

  test('rejects a localized value that is still in the wrong script', () => {
    expect(isNameInLanguage('Janani', 'ta')).toBe(false);
    expect(customerName({id: 8, name: 'Janani', name_ta: 'Janani'}, 'ta')).toBe('ஜனனி');
  });

  test('uses the English localized name and never displays an Indic-script name in English', () => {
    expect(customerName({id: 10, name: 'ஜனனி', name_en: 'Janani'}, 'en')).toBe('Janani');
    expect(customerName({id: 10, name: 'ஜனனி'}, 'en')).toBe('');
    expect(customerName({id: 10, name: 'ஜனனி'}, 'en', {10: 'Janani'})).toBe('Janani');
    expect(isNameInLanguage('ஜனனி', 'en')).toBe(false);
  });

  test('rejects a one-letter localized value for a longer customer name', () => {
    expect(isPlausibleNameLocalization('ர', 'Rakesh', 'ta')).toBe(false);
    expect(customerName({id: 9, name: 'Rakesh', name_ta: 'ர'}, 'ta')).toBe('ராகேஷ்');
  });

  test.each([
    ['ta', 'ராகேஷ்'],
    ['hi', 'राकेश'],
    ['te', 'రాకేష్'],
    ['bn', 'রাকেশ'],
    ['ml', 'രാകേഷ്'],
  ])('transliterates Rakesh into the %s script without truncating the name', (lang, expected) => {
    expect(transliterateName('Rakesh', lang)).toBe(expected);
    expect(customerName({name: 'Rakesh'}, lang)).toBe(expected);
  });

  test('renders phone numbers with English digits in every language', () => {
    expect(formatPhoneDigits('9876543210')).toBe('9876543210');
    expect(formatPhoneDigits('௯௮௭௬௫௪௩௨௧௦')).toBe('9876543210');
  });

  test('uses localized names for entry records keyed by customer id', () => {
    expect(customerName({customer_id: 7, customer_name: 'Janani'}, 'ta', {7: 'ஜனனி'})).toBe('ஜனனி');
    expect(label({customer_id: 7, customer_name: 'Janani', trade: 'Tailor'}, 'ta', {7: 'ஜனனி'})).toBe('ஜனனி · Tailor');
  });
});
