// Mocks must be declared before imports
jest.mock('react-native', () => ({
  BackHandler: {
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  },
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    back: jest.fn(),
    replace: jest.fn(),
    canGoBack: jest.fn(() => true),
  }),
  useLocalSearchParams: () => ({}),
}));

import { resolveModuleBackTab } from '../lib/navigation/moduleBack';

describe('Stage 7 Module Back Navigation Resolution', () => {
  test('returns 0 (Dashboard tab) when from param is "dashboard"', () => {
    const tab = resolveModuleBackTab({ from: 'dashboard' }, 4, 4);
    expect(tab).toBe(0);
  });

  test('returns 0 when from param is an array ["dashboard"]', () => {
    const tab = resolveModuleBackTab({ from: ['dashboard'] }, 4, 4);
    expect(tab).toBe(0);
  });

  test('returns 4 (More tab) when from param is "more"', () => {
    const tab = resolveModuleBackTab({ from: 'more' }, 0, 0);
    expect(tab).toBe(4);
  });

  test('returns 4 when from param is an array ["more"]', () => {
    const tab = resolveModuleBackTab({ from: ['more'] }, 0, 0);
    expect(tab).toBe(4);
  });

  test('returns explicit numeric fromTab if provided', () => {
    const tab1 = resolveModuleBackTab({ fromTab: '1' }, 0, 4);
    expect(tab1).toBe(1);

    const tab2 = resolveModuleBackTab({ fromTab: '2' }, 0, 4);
    expect(tab2).toBe(2);

    const tab3 = resolveModuleBackTab({ fromTab: '3' }, 0, 4);
    expect(tab3).toBe(3);
  });

  test('falls back to activeTabIndex when params are empty', () => {
    expect(resolveModuleBackTab({}, 0, 4)).toBe(0); // If dashboard was active, return 0
    expect(resolveModuleBackTab({}, 4, 0)).toBe(4); // If more was active, return 4
    expect(resolveModuleBackTab(undefined, 2, 4)).toBe(2); // If budgets was active, return 2
  });

  test('falls back to fallbackTabIndex when params and activeTabIndex are absent or invalid', () => {
    expect(resolveModuleBackTab(undefined, undefined, 4)).toBe(4);
    expect(resolveModuleBackTab({}, -1, 0)).toBe(0);
    expect(resolveModuleBackTab({}, 99, 4)).toBe(4);
  });
});
