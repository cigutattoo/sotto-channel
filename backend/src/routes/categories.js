// /api/categories/tree

const router = require('express').Router();
const { getClient: supabase } = require('../lib/supabase-client');
const { asyncHandler } = require('../middleware/error-handler');

router.get('/tree', asyncHandler(async (req, res) => {
  const db = supabase();

  const { data, error } = await db
    .from('categories')
    .select('id, level, parent_id, name_en, name_zh, slug, icon')
    .order('level')
    .order('name_en');

  if (error) throw error;

  const regions = (data || []).filter(c => c.level === 1);
  const themes = (data || []).filter(c => c.level === 2);

  // 给每个 region 附加其 children
  const tree = regions.map(r => ({
    ...r,
    children: themes.filter(t => t.parent_id === r.id),
  }));

  res.json({ regions: tree });
}));

module.exports = router;
