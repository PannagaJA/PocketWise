import { parseBankSms } from '../lib/sms/parser';
import { extractAmount } from '../lib/sms/parser/amountParser';
import { identifyBank } from '../lib/sms/parser/bankDetector';
import { classifyTransaction } from '../lib/sms/parser/transactionClassifier';
import { isDuplicateTransaction } from '../lib/sms/parser/duplicateDetector';
import { RawSMS, ParsedSmsTransaction } from '../lib/sms/types';

describe('Android Bank SMS Transaction Auto-Detection Parser Pipeline', () => {
  // Test 1: HDFC Bank Debit SMS
  test('1. Parses HDFC debit SMS correctly', () => {
    const sms: RawSMS = {
      sender: 'HDFCBK',
      body: 'HDFC Bank: Rs.450 debited from A/c XX1234 to UPI Ref 4281901829.',
      timestamp: Date.now(),
    };

    const parsed = parseBankSms(sms);
    expect(parsed).not.toBeNull();
    expect(parsed?.type).toBe('expense');
    expect(parsed?.amount).toBe(450);
    expect(parsed?.bankId).toBe('hdfc');
    expect(parsed?.maskedAccount).toBe('XX1234');
    expect(parsed?.paymentMethod).toBe('UPI');
  });

  // Test 2: SBI Bank Salary Credit SMS
  test('2. Parses SBI salary credit SMS correctly', () => {
    const sms: RawSMS = {
      sender: 'SBIBNK',
      body: 'SBI: INR 35000 credited to A/c XX9988 towards SALARY.',
      timestamp: Date.now(),
    };

    const parsed = parseBankSms(sms);
    expect(parsed).not.toBeNull();
    expect(parsed?.type).toBe('income');
    expect(parsed?.amount).toBe(35000);
    expect(parsed?.bankId).toBe('sbi');
    expect(parsed?.maskedAccount).toBe('XX9988');
    expect(parsed?.category).toBe('Salary');
    expect(parsed?.isSalary).toBe(true);
  });

  // Test 3: Refund SMS
  test('3. Parses refund SMS correctly', () => {
    const sms: RawSMS = {
      sender: 'ICICIB',
      body: 'Rs.450 credited as refund from SWIGGY to A/c XX5678',
      timestamp: Date.now(),
    };

    const parsed = parseBankSms(sms);
    expect(parsed).not.toBeNull();
    expect(parsed?.type).toBe('refund');
    expect(parsed?.amount).toBe(450);
    expect(parsed?.merchant).toBe('Swiggy');
    expect(parsed?.isRefund).toBe(true);
  });

  // Test 4: Transfer SMS
  test('4. Parses own-account transfer SMS correctly', () => {
    const sms: RawSMS = {
      sender: 'HDFCBK',
      body: 'Rs.10000 transferred from HDFC to SBI A/c XX7788',
      timestamp: Date.now(),
    };

    const parsed = parseBankSms(sms);
    expect(parsed).not.toBeNull();
    expect(parsed?.type).toBe('transfer');
    expect(parsed?.amount).toBe(10000);
    expect(parsed?.isTransfer).toBe(true);
  });

  // Test 5: OTP Messages (Not a transaction)
  test('5. Filters out OTP messages as false positives', () => {
    const sms: RawSMS = {
      sender: 'HDFCBK',
      body: '482910 is your secret OTP for transaction of Rs.450 at Swiggy. Do not share with anyone.',
      timestamp: Date.now(),
    };

    const parsed = parseBankSms(sms);
    expect(parsed).toBeNull();
  });

  // Test 6: Card Expiry Messages (Not a transaction)
  test('6. Filters out card expiry messages as false positives', () => {
    const sms: RawSMS = {
      sender: 'AXISBK',
      body: 'Your Axis Bank debit card XX1234 expires next month. Request a replacement in Axis Mobile App.',
      timestamp: Date.now(),
    };

    const parsed = parseBankSms(sms);
    expect(parsed).toBeNull();
  });

  // Test 7: Duplicate Transaction SMS
  test('7. Detects duplicate transaction with matching reference ID', () => {
    const tx1: ParsedSmsTransaction = {
      smsSender: 'HDFCBK',
      type: 'expense',
      amount: 450,
      amountMinor: 45000,
      currency: 'INR',
      bankId: 'hdfc',
      bankName: 'HDFC Bank',
      paymentMethod: 'UPI',
      category: 'Food & Dining',
      transactionDate: '2026-08-12T10:00:00.000Z',
      referenceNumber: 'REF12345678',
      confidenceScore: 95,
      isSalary: false,
      isRefund: false,
      isTransfer: false,
      isAutoDetected: true,
      needsReview: false,
    };

    const tx2: ParsedSmsTransaction = {
      ...tx1,
      sourceMessageId: 'sms_dup_2',
    };

    const isDup = isDuplicateTransaction(tx2, [tx1]);
    expect(isDup).toBe(true);
  });

  // Test 8: Unknown Bank + Known Account Mapping Resolution
  test('8. Resolves bank from account mapping when sender is generic', () => {
    const sms: RawSMS = {
      sender: 'GENERIC',
      body: 'Rs. 500 debited from A/c XX1234 for Swiggy',
      timestamp: Date.now(),
    };

    const accountMappings = [
      {
        maskedAccount: 'XX1234',
        bankId: 'hdfc',
        bankName: 'HDFC Bank',
        updatedAt: new Date().toISOString(),
      },
    ];

    const parsed = parseBankSms(sms, accountMappings);
    expect(parsed).not.toBeNull();
    expect(parsed?.bankId).toBe('hdfc');
    expect(parsed?.bankName).toBe('HDFC Bank');
  });

  // Test 9: Known Bank + Unknown Account Review Request
  test('9. Flags unknown account for user review', () => {
    const sms: RawSMS = {
      sender: 'UNKNOWN_SENDER',
      body: 'Rs. 500 debited from A/c XX0000 for Swiggy',
      timestamp: Date.now(),
    };

    const parsed = parseBankSms(sms);
    expect(parsed).not.toBeNull();
    expect(parsed?.needsReview).toBe(true);
  });

  // Test 10: Indian Currency Formatting Normalization (₹1,25,000)
  test('10. Normalizes Indian comma currency string ₹1,25,000.00 to 125000', () => {
    const extracted = extractAmount('Debited ₹1,25,000.00 from account');
    expect(extracted).not.toBeNull();
    expect(extracted?.amount).toBe(125000);
    expect(extracted?.amountMinor).toBe(12500000);
  });

  // Test 11: Bank of Baroda Dr. / Cr. shorthand format
  test('11. Parses Bank of Baroda shorthand Dr. SMS correctly', () => {
    const sms: RawSMS = {
      sender: 'BOBSMS',
      body: 'Rs.1.00 Dr. from A/C XXXXXX0572 and Cr. to 9538926581@naviaxis. Ref:659048390753. AvlBal:Rs52.84(2026:08:12 01:15:36). Not you? Call 18005700/5000-BOB',
      timestamp: Date.now(),
    };

    const parsed = parseBankSms(sms);
    expect(parsed).not.toBeNull();
    expect(parsed?.type).toBe('expense');
    expect(parsed?.amount).toBe(1.00);
    expect(parsed?.bankId).toBe('bob');
    expect(parsed?.maskedAccount).toBe('XX0572');
    expect(parsed?.referenceNumber).toBe('659048390753');
  });

  // Test 12: Bank of Baroda UPI Credit format (Dear BOB UPI User...)
  test('12. Parses Bank of Baroda UPI Credit SMS correctly', () => {
    const sms: RawSMS = {
      sender: 'JK-BOBSMS-S',
      body: 'Dear BOB UPI User: Your account is credited with INR 1.00 on 2026-08-12 03:45:22 PM by UPI Ref No 846395257524; AvlBal: Rs53.84 - BOB',
      timestamp: Date.now(),
    };

    const parsed = parseBankSms(sms);
    expect(parsed).not.toBeNull();
    expect(parsed?.type).toBe('income');
    expect(parsed?.amount).toBe(1.00);
    expect(parsed?.bankId).toBe('bob');
    expect(parsed?.upiReference).toBe('846395257524');
  });

  // Test 13: Canara Bank Debit SMS
  test('13. Parses Canara Bank debit SMS correctly', () => {
    const sms: RawSMS = {
      sender: 'AD-CANBNK-S',
      body: 'Your A/C XX4321 debited with INR 200.00 on 11-09-2026 via UPI Ref 523910482910. Avl Bal: INR 4500.00. - Canara Bank',
      timestamp: Date.now(),
    };

    const parsed = parseBankSms(sms);
    expect(parsed).not.toBeNull();
    expect(parsed?.type).toBe('expense');
    expect(parsed?.amount).toBe(200.00);
    expect(parsed?.bankId).toBe('canara');
    expect(parsed?.maskedAccount).toBe('XX4321');
  });

  // Test 14: Bank detection from UPI VPA handle (@barodampay, @cnrb, @oksbi)
  test('14. Identifies bank correctly from UPI VPA handles in message', () => {
    const bankBob = identifyBank('VM-ALERT', 'Paid Rs.150 to merchant@barodampay on 11-09-2026');
    expect(bankBob?.bank?.id).toBe('bob');

    const bankCanara = identifyBank('VK-ALERT', 'Received Rs.300 from friend@cnrb for dinner');
    expect(bankCanara?.bank?.id).toBe('canara');

    const bankSbi = identifyBank('JX-ALERT', 'Transferred Rs.500 to user@oksbi via GooglePay');
    expect(bankSbi?.bank?.id).toBe('sbi');
  });

  // Test 15: Deduplication with persistent reference numbers & fingerprints
  test('15. Deduplicates identical transaction with same fingerprint even with slight whitespace variation', () => {
    const existing = [
      {
        account_id: 'acc_bob',
        type: 'expense',
        amount_minor: 10000,
        currency: 'INR',
        date: '2026-09-11',
        description: 'Paid to merchant',
        notes: 'UPI Ref 123456789012',
      },
    ];

    const duplicateIncoming: ParsedSmsTransaction = {
      smsSender: 'BOBSMS',
      type: 'expense',
      amount: 100,
      amountMinor: 10000,
      currency: 'INR',
      bankId: 'bob',
      bankName: 'Bank of Baroda',
      paymentMethod: 'UPI',
      category: 'General',
      transactionDate: '2026-09-11T12:00:00.000Z',
      referenceNumber: '123456789012',
      confidenceScore: 95,
      isSalary: false,
      isRefund: false,
      isTransfer: false,
      isAutoDetected: true,
      needsReview: false,
    };

    expect(isDuplicateTransaction(duplicateIncoming, existing)).toBe(true);
  });
});
