-- ============================================================
-- Seed: 11 地区 × 11 主题 = 121 行
-- 在 Supabase SQL Editor 执行 (schema.sql 之后)
-- ============================================================

-- Level 1: 地区 (11 条)
INSERT INTO categories (level, parent_id, name_en, name_zh, slug, icon) VALUES
  (1, NULL, 'Global', '全球', 'global', '🌍'),
  (1, NULL, 'China', '中国', 'china', '🇨🇳'),
  (1, NULL, 'United States', '美国', 'us', '🇺🇸'),
  (1, NULL, 'Japan', '日本', 'japan', '🇯🇵'),
  (1, NULL, 'United Kingdom', '英国', 'uk', '🇬🇧'),
  (1, NULL, 'Germany', '德国', 'germany', '🇩🇪'),
  (1, NULL, 'France', '法国', 'france', '🇫🇷'),
  (1, NULL, 'Brazil', '巴西', 'brazil', '🇧🇷'),
  (1, NULL, 'South Korea', '韩国', 'korea', '🇰🇷'),
  (1, NULL, 'India', '印度', 'india', '🇮🇳'),
  (1, NULL, 'Southeast Asia', '东南亚', 'sea', '🌏')
ON CONFLICT (slug) DO NOTHING;

-- Level 2: 主题 (每个地区下挂相同 11 条)
-- 先删已有的 level=2 数据, 重新插入
DELETE FROM categories WHERE level = 2;

WITH themes AS (
  SELECT r.id AS parent_id, t.name_en, t.name_zh,
         lower(r.slug || '-' || t.slug) AS slug,
         t.icon
  FROM categories r
  CROSS JOIN (VALUES
    ('Tech & Privacy', '科技与隐私', 'tech-privacy', '💻'),
    ('Business & Remote Work', '商业与远程办公', 'business', '💼'),
    ('Creative', '创意', 'creative', '🎨'),
    ('Education', '教育', 'education', '📚'),
    ('Gaming', '游戏', 'gaming', '🎮'),
    ('Music', '音乐', 'music', '🎵'),
    ('Food & Lifestyle', '美食与生活', 'food', '🍳'),
    ('Health & Wellness', '健康与养生', 'health', '🌱'),
    ('News & Media', '新闻与媒体', 'news', '📰'),
    ('Community', '社区', 'community', '🤝'),
    ('Language Exchange', '语言交换', 'language', '💬')
  ) AS t(name_en, name_zh, slug, icon)
  WHERE r.level = 1
)
INSERT INTO categories (level, parent_id, name_en, name_zh, slug, icon)
SELECT 2, parent_id, name_en, name_zh, slug, icon FROM themes;
