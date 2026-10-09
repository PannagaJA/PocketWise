-- Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT 'User',
  currency TEXT NOT NULL DEFAULT 'INR',
  timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create accounts table
CREATE TABLE IF NOT EXISTS public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('cash', 'bank', 'credit_card', 'wallet', 'investment', 'other')),
  balance BIGINT NOT NULL DEFAULT 0, -- Minor units e.g. paise
  currency TEXT NOT NULL DEFAULT 'INR',
  icon TEXT,
  color TEXT,
  is_archived BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create categories table
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  icon TEXT,
  color TEXT,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create transactions table
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
  amount_minor BIGINT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  transfer_group_id UUID,
  recurring_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Create subscriptions table
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount_minor BIGINT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('weekly', 'monthly', 'quarterly', 'half_yearly', 'yearly', 'custom')),
  next_billing_date DATE NOT NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Create bills table
CREATE TABLE IF NOT EXISTS public.bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  expected_amount_minor BIGINT NOT NULL,
  due_date DATE NOT NULL,
  frequency TEXT NOT NULL DEFAULT 'monthly',
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  is_paid BOOLEAN DEFAULT FALSE,
  paid_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Create budgets table
CREATE TABLE IF NOT EXISTS public.budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  amount_minor BIGINT NOT NULL,
  period TEXT NOT NULL DEFAULT 'monthly' CHECK (period IN ('monthly', 'yearly')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create goals table
CREATE TABLE IF NOT EXISTS public.goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  target_amount_minor BIGINT NOT NULL,
  current_amount_minor BIGINT NOT NULL DEFAULT 0,
  target_date DATE,
  icon TEXT,
  color TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create reminders table for Push Engine
CREATE TABLE IF NOT EXISTS public.reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('subscription', 'bill', 'budget', 'goal', 'custom')),
  reference_id UUID,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'cancelled', 'failed')),
  sent_at TIMESTAMPTZ,
  attempt_count INT DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create devices table for FCM Push tokens
CREATE TABLE IF NOT EXISTS public.devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  fcm_token TEXT NOT NULL UNIQUE,
  device_name TEXT,
  platform TEXT NOT NULL CHECK (platform IN ('android', 'ios')),
  app_version TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  last_used_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create lends table for HandCoins / Personal debt & loan tracking
CREATE TABLE IF NOT EXISTS public.lends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  person_name TEXT NOT NULL,
  amount_minor BIGINT NOT NULL,
  type TEXT NOT NULL DEFAULT 'lend' CHECK (type IN ('lend', 'borrow')),
  lent_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'collected', 'overdue')),
  notes TEXT,
  notification_id TEXT,
  collected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lends ENABLE ROW LEVEL SECURITY;

-- Helper policy definition (idempotent drops and creates)
DROP POLICY IF EXISTS "Users can manage their own profiles" ON public.profiles;
CREATE POLICY "Users can manage their own profiles" ON public.profiles FOR ALL USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can manage their own accounts" ON public.accounts;
CREATE POLICY "Users can manage their own accounts" ON public.accounts FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own categories" ON public.categories;
CREATE POLICY "Users can manage their own categories" ON public.categories FOR ALL USING (auth.uid() = user_id OR is_default = true);

DROP POLICY IF EXISTS "Users can manage their own transactions" ON public.transactions;
CREATE POLICY "Users can manage their own transactions" ON public.transactions FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own subscriptions" ON public.subscriptions;
CREATE POLICY "Users can manage their own subscriptions" ON public.subscriptions FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own bills" ON public.bills;
CREATE POLICY "Users can manage their own bills" ON public.bills FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own budgets" ON public.budgets;
CREATE POLICY "Users can manage their own budgets" ON public.budgets FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own goals" ON public.goals;
CREATE POLICY "Users can manage their own goals" ON public.goals FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own reminders" ON public.reminders;
CREATE POLICY "Users can manage their own reminders" ON public.reminders FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own devices" ON public.devices;
CREATE POLICY "Users can manage their own devices" ON public.devices FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own lends" ON public.lends;
CREATE POLICY "Users can manage their own lends" ON public.lends FOR ALL USING (auth.uid() = user_id);

-- PostgreSQL Function & Trigger for Atomic Account Balance Sync
CREATE OR REPLACE FUNCTION public.sync_account_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Handle DELETION of a transaction
  IF TG_OP = 'DELETE' THEN
    IF OLD.type = 'income' THEN
      UPDATE public.accounts SET balance = balance - OLD.amount_minor, updated_at = NOW() WHERE id = OLD.account_id AND user_id = OLD.user_id;
    ELSIF OLD.type = 'expense' THEN
      UPDATE public.accounts SET balance = balance + OLD.amount_minor, updated_at = NOW() WHERE id = OLD.account_id AND user_id = OLD.user_id;
    ELSIF OLD.type = 'transfer' THEN
      UPDATE public.accounts SET balance = balance + OLD.amount_minor, updated_at = NOW() WHERE id = OLD.account_id AND user_id = OLD.user_id;
    END IF;
    RETURN OLD;
  END IF;

  -- Handle INSERT of a transaction
  IF TG_OP = 'INSERT' THEN
    IF NEW.deleted_at IS NULL THEN
      IF NEW.type = 'income' THEN
        UPDATE public.accounts SET balance = balance + NEW.amount_minor, updated_at = NOW() WHERE id = NEW.account_id AND user_id = NEW.user_id;
      ELSIF NEW.type = 'expense' THEN
        UPDATE public.accounts SET balance = balance - NEW.amount_minor, updated_at = NOW() WHERE id = NEW.account_id AND user_id = NEW.user_id;
      ELSIF NEW.type = 'transfer' THEN
        UPDATE public.accounts SET balance = balance - NEW.amount_minor, updated_at = NOW() WHERE id = NEW.account_id AND user_id = NEW.user_id;
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  -- Handle UPDATE of a transaction (including soft-delete via deleted_at)
  IF TG_OP = 'UPDATE' THEN
    -- If transaction was previously active, revert OLD impact
    IF OLD.deleted_at IS NULL THEN
      IF OLD.type = 'income' THEN
        UPDATE public.accounts SET balance = balance - OLD.amount_minor, updated_at = NOW() WHERE id = OLD.account_id AND user_id = OLD.user_id;
      ELSIF OLD.type = 'expense' THEN
        UPDATE public.accounts SET balance = balance + OLD.amount_minor, updated_at = NOW() WHERE id = OLD.account_id AND user_id = OLD.user_id;
      ELSIF OLD.type = 'transfer' THEN
        UPDATE public.accounts SET balance = balance + OLD.amount_minor, updated_at = NOW() WHERE id = OLD.account_id AND user_id = OLD.user_id;
      END IF;
    END IF;

    -- If transaction is currently active, apply NEW impact
    IF NEW.deleted_at IS NULL THEN
      IF NEW.type = 'income' THEN
        UPDATE public.accounts SET balance = balance + NEW.amount_minor, updated_at = NOW() WHERE id = NEW.account_id AND user_id = NEW.user_id;
      ELSIF NEW.type = 'expense' THEN
        UPDATE public.accounts SET balance = balance - NEW.amount_minor, updated_at = NOW() WHERE id = NEW.account_id AND user_id = NEW.user_id;
      ELSIF NEW.type = 'transfer' THEN
        UPDATE public.accounts SET balance = balance - NEW.amount_minor, updated_at = NOW() WHERE id = NEW.account_id AND user_id = NEW.user_id;
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_account_balance ON public.transactions;
CREATE TRIGGER trg_sync_account_balance
AFTER INSERT OR UPDATE OR DELETE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.sync_account_balance();

-- Optional: Supabase pg_cron + pg_net Scheduled Reminder Dispatcher
-- Run the following in your Supabase SQL Editor with vault secrets configured:
--
-- CREATE EXTENSION IF NOT EXISTS pg_cron;
-- CREATE EXTENSION IF NOT EXISTS pg_net;
--
-- SELECT cron.schedule(
--   'dispatch-reminders-every-minute',
--   '* * * * *',
--   $$
--   SELECT net.http_post(
--     url := 'https://<project-ref>.supabase.co/functions/v1/process-reminders',
--     headers := jsonb_build_object(
--       'Content-Type', 'application/json',
--       'Authorization', 'Bearer <service-role-key>'
--     ),
--     body := '{}'::jsonb
--   );
--   $$
-- );


