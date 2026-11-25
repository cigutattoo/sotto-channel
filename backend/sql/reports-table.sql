-- Supabase Dashboard SQL Editor 执行
-- 创建 reports 表 + 索引

CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  reporter_id UUID REFERENCES users(id) ON DELETE SET NULL,
  reason_code TEXT NOT NULL CHECK (reason_code IN ('CONTENT_VIOLATION','SPAM','INVALID_LINK','MISLEADING','COPYRIGHT','HARASSMENT','OTHER')),
  reason_text TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','reviewed','dismissed','action_taken')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reports_channel ON reports(channel_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);

-- RLS: service_role 可写，匿名可读 pending 状态（可选）
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reports service_role full" ON reports FOR ALL USING (true) WITH CHECK (true);
