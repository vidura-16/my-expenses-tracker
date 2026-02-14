// Mock firebase exports used in utils (db) to prevent actual Firestore calls during tests
jest.mock('../firebase', () => ({ db: {} }));

jest.mock('firebase/firestore', () => ({
  addDoc: jest.fn(),
  getDocs: jest.fn(),
  updateDoc: jest.fn(),
  collection: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  doc: jest.fn(),
  writeBatch: jest.fn(),
  serverTimestamp: jest.fn(() => 'SERVER_TS')
}));

const utils = require('./expenseUtils');
const { getDocs: mockGetDocs, addDoc: mockAddDoc, updateDoc: mockUpdateDoc } = require('firebase/firestore');

describe('expenseUtils (unit)', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('getMonthlyTotal excludes installment plan purchases', async () => {
    // Mock getExpensesDateRange to return one installment plan and one payment
    const plan = { id: 'p1', amount: 10000, category: 'other', type: 'other', creditData: { isInstallment: true } };
    const payment = { id: 'pay1', amount: 2000, category: 'installment', type: 'other' };

    // Mock getDocs to return snapshot docs for the date range query
    mockGetDocs.mockResolvedValue({ docs: [ { data: () => plan }, { data: () => payment } ] });

    const res = await utils.getMonthlyTotal('uid', 2026, 0); // January (0-based)

    expect(res.total).toBe(2000);
    expect(res.byCategory.installment).toBe(2000);
  });

  test('getTodayTotal excludes installment plan purchases', async () => {
    const plan = { id: 'p1', amount: 5000, type: 'daily', creditData: { isInstallment: true } };
    const daily = { id: 'd1', amount: 300, type: 'daily' };
    // Mock getDocs to return snapshot docs for the date query
    mockGetDocs.mockResolvedValue({ docs: [ { data: () => plan }, { data: () => daily } ] });

    const res = await utils.getTodayTotal('uid', '2026-01-01');

    expect(res.dailyTotal).toBe(300);
    expect(res.otherTotal).toBe(0);
  });

  test('payInstallment applies to specific installment number when provided', async () => {
    // Add Doc should return a ref-like object with id
    mockAddDoc.mockResolvedValue({ id: 'newExpenseId' });

    // Mock installments returned by getDocs
    const installments = [
      { id: 'i1', data: () => ({ installmentNumber: 1, isPaid: false, ref: { id: 'r1' } }), ref: { id: 'r1' } },
      { id: 'i2', data: () => ({ installmentNumber: 2, isPaid: false, ref: { id: 'r2' } }), ref: { id: 'r2' } }
    ];

    mockGetDocs.mockResolvedValue({ docs: installments });

    await utils.payInstallment('uid', 'planExpenseId', { amount: 2000, installmentNumber: 2 });

    // updateDoc should be called once for installment #2
    expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
    const [argRef, argData] = mockUpdateDoc.mock.calls[0];
    expect(argRef).toEqual({ id: 'r2' });
    expect(argData).toEqual(expect.objectContaining({ isPaid: true }));
  });
});
