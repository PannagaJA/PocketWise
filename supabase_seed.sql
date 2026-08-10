-- Seed default global expense categories
INSERT INTO public.categories (name, type, is_default, icon, color) VALUES
  ('Food & Dining', 'expense', true, 'utensils', '#EF4444'),
  ('Groceries', 'expense', true, 'shopping-bag', '#F59E0B'),
  ('Subscriptions', 'expense', true, 'credit-card', '#6366F1'),
  ('Transport', 'expense', true, 'car', '#3B82F6'),
  ('Bills & Utilities', 'expense', true, 'zap', '#EC4899'),
  ('Rent & Housing', 'expense', true, 'home', '#8B5CF6'),
  ('Health & Fitness', 'expense', true, 'heart', '#10B981'),
  ('Entertainment', 'expense', true, 'tv', '#6366F1'),
  ('Personal', 'expense', true, 'user', '#6B7280')
ON CONFLICT DO NOTHING;

-- Seed default global income categories
INSERT INTO public.categories (name, type, is_default, icon, color) VALUES
  ('Salary', 'income', true, 'briefcase', '#10B981'),
  ('Freelance', 'income', true, 'laptop', '#3B82F6'),
  ('Investment', 'income', true, 'trending-up', '#8B5CF6'),
  ('Business', 'income', true, 'building', '#F59E0B'),
  ('Gift & Bonus', 'income', true, 'gift', '#EC4899')
ON CONFLICT DO NOTHING;
