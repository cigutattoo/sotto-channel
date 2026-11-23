-- ============================================================
-- Sotto 频道目录站 · Supabase Schema
-- 在 Supabase SQL Editor 执行
-- ============================================================

-- 启用 pgcrypto (gen_random_uuid)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =================== categories (两级树) ===================
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level int NOT NULL CHECK (level IN (1, 2)),
  parent_id uuid REFERENCES categories(id) ON DELETE CASCADE,
  name_en text NOT NULL,
  name_zh text NOT NULL,
  slug text NOT NULL UNIQUE,
  icon text
);

-- =================== users ===================
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  email_hash text NOT NULL UNIQUE,
  email_masked text NOT NULL,
  email_verified boolean NOT NULL DEFAULT false,
  verification_code text,           -- 已废弃: 验证码只用 Redis, 保留列以便迁移
  verification_expires timestamptz, -- 已废弃
  display_name text,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'channel_owner', 'advertiser', 'admin')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'banned')),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_login timestamptz
);

-- =================== channels ===================
CREATE TABLE IF NOT EXISTS channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) <= 30),
  description text CHECK (char_length(description) <= 200),
  category_id uuid NOT NULL REFERENCES categories(id),
  region_id uuid NOT NULL REFERENCES categories(id),
  join_type text NOT NULL CHECK (join_type IN ('invite_link', 'password_protected')),
  invite_link text NOT NULL,
  has_separate_password boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending_audit'
    CHECK (status IN ('pending_audit', 'approved', 'rejected', 'suspended')),
  rejected_reason text,
  audit_notes text,
  approved_at timestamptz,
  view_count int NOT NULL DEFAULT 0,
  click_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_channels_status ON channels(status);
CREATE INDEX IF NOT EXISTS idx_channels_owner ON channels(owner_id);
CREATE INDEX IF NOT EXISTS idx_channels_region_cat ON channels(region_id, category_id);
CREATE INDEX IF NOT EXISTS idx_channels_created ON channels(created_at DESC);

-- =================== ads (推广) ===================
CREATE TABLE IF NOT EXISTS ads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) <= 50),
  body text CHECK (char_length(body) <= 500),
  image_url text,
  target_url text,
  category_id uuid REFERENCES categories(id),
  is_paid boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending_audit'
    CHECK (status IN ('pending_audit', 'approved', 'rejected', 'expired', 'pending_payment')),
  placement text NOT NULL DEFAULT 'banner' CHECK (placement IN ('banner', 'featured_slot', 'top_slot')),
  starts_at timestamptz,
  expires_at timestamptz,
  stripe_session_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =================== audits (审计日志) ===================
CREATE TABLE IF NOT EXISTS audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type text NOT NULL CHECK (target_type IN ('channel', 'ad', 'user')),
  target_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('approve', 'reject', 'suspend', 'restore', 'role_change', 'ban', 'unban')),
  reason_code text,
  reason_text text,
  auditor_id uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audits_target ON audits(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_audits_created ON audits(created_at DESC);

-- =================== sessions (登录态) ===================
CREATE TABLE IF NOT EXISTS sessions (
  token text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  user_agent text,
  ip inet
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- =================== RPC: 计数递增 ===================
CREATE OR REPLACE FUNCTION increment_view_count(channel_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE channels SET view_count = view_count + 1 WHERE id = channel_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION increment_click_count(channel_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE channels SET click_count = click_count + 1 WHERE id = channel_id;
END;
$$ LANGUAGE plpgsql;

-- =================== RLS ===================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE ads ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE audits ENABLE ROW LEVEL SECURITY;

-- categories: 公开读
CREATE POLICY "categories_read_all" ON categories FOR SELECT USING (true);
CREATE POLICY "categories_modify_admin" ON categories FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
) WITH CHECK (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
);

-- users: 只能读/改自己的
CREATE POLICY "users_read_self" ON users FOR SELECT USING (id = auth.uid());
CREATE POLICY "users_update_self" ON users FOR UPDATE USING (id = auth.uid());
-- admin 全权限
CREATE POLICY "users_admin_all" ON users FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
) WITH CHECK (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
);

-- channels: 公开只读 approved
CREATE POLICY "channels_read_approved" ON channels FOR SELECT USING (
  status = 'approved' AND join_type = 'invite_link'
);
-- 登录后可读自己的所有状态
CREATE POLICY "channels_read_own" ON channels FOR SELECT TO authenticated USING (owner_id = auth.uid());
-- 登录后可提交
CREATE POLICY "channels_insert" ON channels FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
-- owner 只能改 pending_audit 的自己的频道
CREATE POLICY "channels_update_own_pending" ON channels FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() AND status = 'pending_audit')
  WITH CHECK (owner_id = auth.uid() AND status = 'pending_audit');
-- admin 全权限
CREATE POLICY "channels_admin_all" ON channels FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
) WITH CHECK (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
);

-- ads: 公开只读 approved 且未过期
CREATE POLICY "ads_read_approved" ON ads FOR SELECT USING (
  status = 'approved' AND (expires_at IS NULL OR expires_at > now())
);
CREATE POLICY "ads_read_own" ON ads FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "ads_insert" ON ads FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "ads_admin_all" ON ads FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
) WITH CHECK (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
);

-- audits: 只有 admin 可读
CREATE POLICY "audits_read_admin" ON audits FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "audits_insert_admin" ON audits FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
);

-- sessions: 只自己能看见
CREATE POLICY "sessions_read_self" ON sessions FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "sessions_insert_self" ON sessions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "sessions_update_self" ON sessions FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- ============================================================
-- 注意: 我们用 service_role key 在后端绕过 RLS
-- 但 RLS 策略仍然是必要的 —— 如果以后有前端直连 Supabase 的场景
-- 这些策略保护数据不泄露
-- ============================================================
