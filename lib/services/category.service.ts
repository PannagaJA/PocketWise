import { supabase } from '../supabase';

export interface Category {
  id: string;
  user_id?: string;
  name: string;
  type: 'income' | 'expense';
  icon?: string;
  color?: string;
  is_default: boolean;
}

const DEFAULT_CATEGORIES: Omit<Category, 'id'>[] = [
  { name: 'Food & Dining', type: 'expense', is_default: true, icon: 'utensils', color: '#EF4444' },
  { name: 'Groceries', type: 'expense', is_default: true, icon: 'shopping-bag', color: '#F59E0B' },
  { name: 'Subscriptions', type: 'expense', is_default: true, icon: 'credit-card', color: '#6366F1' },
  { name: 'Transport', type: 'expense', is_default: true, icon: 'car', color: '#3B82F6' },
  { name: 'Bills & Utilities', type: 'expense', is_default: true, icon: 'zap', color: '#EC4899' },
  { name: 'Rent & Housing', type: 'expense', is_default: true, icon: 'home', color: '#8B5CF6' },
  { name: 'Health & Fitness', type: 'expense', is_default: true, icon: 'heart', color: '#10B981' },
  { name: 'Entertainment', type: 'expense', is_default: true, icon: 'tv', color: '#6366F1' },
  { name: 'Personal', type: 'expense', is_default: true, icon: 'user', color: '#6B7280' },
  { name: 'Investment', type: 'expense', is_default: true, icon: 'trending-up', color: '#8B5CF6' },
  { name: 'Transfer', type: 'expense', is_default: true, icon: 'arrow-right-left', color: '#3B82F6' },
  { name: 'Salary', type: 'income', is_default: true, icon: 'briefcase', color: '#10B981' },
  { name: 'Freelance', type: 'income', is_default: true, icon: 'laptop', color: '#3B82F6' },
  { name: 'Investment', type: 'income', is_default: true, icon: 'trending-up', color: '#8B5CF6' },
  { name: 'Transfer', type: 'income', is_default: true, icon: 'arrow-right-left', color: '#3B82F6' },
  { name: 'Business', type: 'income', is_default: true, icon: 'building', color: '#F59E0B' },
  { name: 'Gift & Bonus', type: 'income', is_default: true, icon: 'gift', color: '#EC4899' },
];

export const categoryService = {
  async getCategories(userId: string): Promise<Category[]> {
    let { data, error } = await supabase
      .from('categories')
      .select('*')
      .or(`user_id.eq.${userId},is_default.eq.true`)
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching categories:', error);
      data = [];
    }

    const categoriesList: Category[] = [...(data || [])];

    // Auto-seed default categories into Supabase if DB table is currently empty
    if (categoriesList.length === 0) {
      const { data: seeded, error: seedErr } = await supabase
        .from('categories')
        .insert(DEFAULT_CATEGORIES)
        .select();

      if (!seedErr && seeded) {
        return seeded;
      }
    }

    // Ensure required default category tags (Investment & Transfer) exist for user/app
    const requiredTags: Omit<Category, 'id'>[] = [
      { name: 'Investment', type: 'expense', is_default: true, icon: 'trending-up', color: '#8B5CF6' },
      { name: 'Transfer', type: 'expense', is_default: true, icon: 'arrow-right-left', color: '#3B82F6' },
      { name: 'Investment', type: 'income', is_default: true, icon: 'trending-up', color: '#8B5CF6' },
      { name: 'Transfer', type: 'income', is_default: true, icon: 'arrow-right-left', color: '#3B82F6' },
    ];

    const missingTags = requiredTags.filter(
      (req) => !categoriesList.some((c) => c.name.toLowerCase() === req.name.toLowerCase() && c.type === req.type)
    );

    if (missingTags.length > 0) {
      if (userId) {
        try {
          const toInsert = missingTags.map((m) => ({
            name: m.name,
            type: m.type,
            icon: m.icon,
            color: m.color,
            user_id: userId,
            is_default: false,
          }));
          const { data: inserted } = await supabase.from('categories').insert(toInsert).select();
          if (inserted && inserted.length > 0) {
            categoriesList.push(...inserted);
          }
        } catch (e) {
          console.warn('Could not auto-insert missing category tags:', e);
        }
      }

      // If still missing (offline or guest), provide deterministic fallback UUIDs
      const stillMissing = requiredTags.filter(
        (req) => !categoriesList.some((c) => c.name.toLowerCase() === req.name.toLowerCase() && c.type === req.type)
      );
      for (const m of stillMissing) {
        const fallbackId = m.name === 'Investment'
          ? (m.type === 'expense' ? '00000000-0000-0000-0000-000000000001' : '00000000-0000-0000-0000-000000000002')
          : (m.type === 'expense' ? '00000000-0000-0000-0000-000000000003' : '00000000-0000-0000-0000-000000000004');
        categoriesList.push({
          id: fallbackId,
          name: m.name,
          type: m.type,
          icon: m.icon,
          color: m.color,
          is_default: true,
        });
      }
    }

    return categoriesList;
  },
};

/**
 * Intelligent category resolver: matches raw/parsed category strings against user's categories.
 */
export function matchCategoryToUserCategories(
  parsedCategoryName: string | undefined,
  categories: Category[],
  type: 'income' | 'expense' = 'expense'
): Category | undefined {
  if (!parsedCategoryName) return undefined;
  const target = parsedCategoryName.trim().toLowerCase();

  // Filter to matching type if available
  const typedCategories = categories.filter((c) => c.type === type);
  const pool = typedCategories.length > 0 ? typedCategories : categories;

  // 1. Direct exact match (e.g. "Food & Dining" === "Food & Dining")
  const exact = pool.find((c) => c.name.toLowerCase() === target);
  if (exact) return exact;

  // 2. Canonical synonyms map
  const SYNONYMS: Record<string, string[]> = {
    'Food & Dining': ['food', 'dining', 'restaurant', 'cafe', 'eats', 'food & dining', 'swiggy', 'zomato'],
    'Groceries': ['grocery', 'groceries', 'supermarket', 'mart', 'kirana', 'blinkit', 'zepto', 'instamart'],
    'Transport': ['transportation', 'transport', 'cab', 'taxi', 'fuel', 'petrol', 'diesel', 'auto', 'metro', 'commute', 'uber', 'ola', 'rapido'],
    'Bills & Utilities': ['bills', 'utilities', 'utility', 'recharge', 'electricity', 'water', 'gas', 'broadband', 'wifi', 'bescom', 'airtel', 'jio'],
    'Subscriptions': ['subscription', 'subscriptions', 'ott', 'streaming', 'membership', 'netflix', 'spotify', 'prime'],
    'Health & Fitness': ['healthcare', 'health', 'fitness', 'medical', 'medicine', 'pharmacy', 'hospital', 'gym', 'apollo', 'pharmeasy'],
    'Entertainment': ['entertainment', 'movies', 'cinema', 'games', 'gaming', 'events', 'pvr', 'inox', 'bookmyshow'],
    'Rent & Housing': ['rent', 'housing', 'home', 'maintenance', 'pg'],
    'Personal': ['personal', 'shopping', 'clothing', 'apparel', 'lifestyle', 'electronics', 'amazon', 'flipkart', 'myntra'],
    'Salary': ['salary', 'wages', 'paycheck'],
    'Freelance': ['freelance', 'contract', 'consulting'],
    'Investment': ['investment', 'investments', 'dividend', 'interest', 'mutual fund', 'stocks', 'equity', 'sip', 'zerodha', 'groww', 'upstox', 'kite', 'indmoney', 'coin', 'nps', 'ppf', 'etf'],
    'Transfer': ['transfer', 'transferred', 'neft', 'imps', 'rtgs', 'sent to', 'self', 'p2p', 'fund transfer', 'account transfer', 'credit card payment'],
  };

  for (const [canonicalName, aliases] of Object.entries(SYNONYMS)) {
    if (aliases.some((a) => target === a || target.includes(a))) {
      const match = pool.find((c) => c.name.toLowerCase() === canonicalName.toLowerCase());
      if (match) return match;
    }
  }

  // 3. Substring match
  const subMatch = pool.find(
    (c) => c.name.toLowerCase().includes(target) || target.includes(c.name.toLowerCase())
  );
  if (subMatch) return subMatch;

  return undefined;
}
