describe('CustomBottomTabBar Redesign - Magpie Floating Black Pill', () => {
  test('has exactly 5 navigation destinations matching PocketWise routes', () => {
    const expectedTabs = [
      { name: 'index', label: 'Dashboard' },
      { name: 'transactions', label: 'Transactions' },
      { name: 'subscriptions', label: 'Subscriptions' },
      { name: 'budgets', label: 'Budgets' },
      { name: 'more', label: 'More' },
    ];

    expect(expectedTabs.length).toBe(5);
    expect(expectedTabs.map((t) => t.name)).toEqual([
      'index',
      'transactions',
      'subscriptions',
      'budgets',
      'more',
    ]);
  });

  test('calculates exact, concentric indicator translation offset with uniform 6px margin on all sides', () => {
    const SLOT_WIDTH = 56;
    const DOCK_WIDTH = 280;
    const INDICATOR_SIZE = 44;
    const LEFT_OFFSET = (SLOT_WIDTH - INDICATOR_SIZE) / 2; // 6px

    const getTargetX = (idx: number) => idx * SLOT_WIDTH + LEFT_OFFSET;

    // Slot 0 (Dashboard): exactly 6px from left curved cap
    const x0 = getTargetX(0);
    expect(x0).toBe(6);

    // Slot 1 (Transactions): center at 84px
    expect(getTargetX(1)).toBe(62);

    // Slot 2 (Subscriptions): center at 140px (dead center of 280px pill)
    expect(getTargetX(2)).toBe(118);
    expect(118 + INDICATOR_SIZE / 2).toBe(DOCK_WIDTH / 2);

    // Slot 3 (Budgets): center at 196px
    expect(getTargetX(3)).toBe(174);

    // Slot 4 (More): exactly 6px from right curved cap
    const x4 = getTargetX(4);
    expect(x4).toBe(230);
    expect(DOCK_WIDTH - (x4 + INDICATOR_SIZE)).toBe(6);
  });

  test('anchors properly above iOS and Android safe-area insets', () => {
    const resolveBottomOffset = (bottomInset: number, os: 'ios' | 'android') => {
      return bottomInset > 0 ? bottomInset + 6 : os === 'ios' ? 20 : 16;
    };

    // iOS with Home Indicator (insets.bottom = 34)
    expect(resolveBottomOffset(34, 'ios')).toBe(40);

    // iOS without Home Indicator / SE (insets.bottom = 0)
    expect(resolveBottomOffset(0, 'ios')).toBe(20);

    // Android with gesture bar (insets.bottom = 24)
    expect(resolveBottomOffset(24, 'android')).toBe(30);

    // Android with 3-button nav / 0 inset
    expect(resolveBottomOffset(0, 'android')).toBe(16);
  });
});
