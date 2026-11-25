// /api/channels — 公开列表 + 登录后 CRUD
// 密令硬拦截: join_type='password_protected' 一律拒绝

const router = require('express').Router();
const { z } = require('zod');
const { getClient: supabase } = require('../lib/supabase-client');
const { AppError } = require('../lib/errors');
const { asyncHandler } = require('../middleware/error-handler');
const { requireLogin } = require('../middleware/session');
const { rateLimit } = require('../middleware/rate-limit');

// --- 公开路由 ---

// GET /api/channels?region=X&category=Y&q=keyword&page=1
router.get('/', asyncHandler(async (req, res) => {
  const region = req.query.region;  // slug 或 UUID
  const category = req.query.category;
  const q = (req.query.q || '').trim();
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const perPage = Math.min(50, parseInt(req.query.per_page, 10) || 20);

  const db = supabase();

  let query = db.from('channels').select('*, categories!channels_category_id_fkey(name_zh, name_en, slug)', { count: 'exact' })
    .eq('status', 'approved')
    .eq('join_type', 'invite_link'); // 只返回公开邀请链接的 (密令过滤)

  if (region) {
    const { data: cat } = await db.from('categories').select('id').eq('slug', region).maybeSingle();
    if (cat) query = query.eq('region_id', cat.id);
  }
  if (category) {
    const { data: cat } = await db.from('categories').select('id').eq('slug', category).maybeSingle();
    if (cat) query = query.eq('category_id', cat.id);
  }
  if (q) {
    query = query.or(`name.ilike.%${q}%,description.ilike.%${q}%`);
  }

  const { data, count, error } = await query
    .order('created_at', { ascending: false })
    .range((page - 1) * perPage, page * perPage - 1);

  if (error) throw error;
  res.json({ items: data || [], total: count || 0, page, per_page: perPage });
}));

// GET /api/channels/hot — 热门 Top 50
router.get('/hot', asyncHandler(async (req, res) => {
  const db = supabase();
  const { data, error } = await db
    .from('channels')
    .select('id, name, description, invite_link, view_count, click_count, categories!channels_category_id_fkey(name_zh, slug), region_id')
    .eq('status', 'approved')
    .eq('join_type', 'invite_link')
    .order('view_count', { ascending: false })
    .limit(50);
  if (error) throw error;
  res.json(data || []);
}));

// GET /api/channels/mine — 登录后我提交的所有状态
router.get('/mine', requireLogin, asyncHandler(async (req, res) => {
  const db = supabase();
  const { data, error } = await db
    .from('channels')
    .select('*, categories!channels_category_id_fkey(name_zh, slug)')
    .eq('owner_id', req.user.id)
    .order('created_at', { ascending: false });
  if (error) throw error;
  res.json(data || []);
}));

// GET /api/channels/:id — 详情
router.get('/:id', asyncHandler(async (req, res) => {
  const db = supabase();
  const id = req.params.id;

  console.error('[DEBUG] entering detail, id=', id);

  // STEP 1: 先查 channels 表
  const { data, error } = await db
    .from('channels')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new AppError('CHANNEL_NOT_FOUND');
  if (data.status !== 'approved') throw new AppError('CHANNEL_NOT_FOUND');

  console.error('[DEBUG] step1 ok, category_id=', data.category_id);

  // STEP 2: 补充 categories
  const { data: cat, error: catErr } = await db
    .from('categories')
    .select('name_zh, name_en, slug, icon')
    .eq('id', data.category_id)
    .maybeSingle();

  console.error('[DEBUG] step2 error:', catErr ? JSON.stringify(catErr) : 'none');
  console.error('[DEBUG] step2 cat:', cat ? JSON.stringify(cat) : 'null');
  if (catErr) { console.error('[DEBUG] step2 throws'); throw catErr; }

  res.json({ step: 2, ok: true, name: data.name, cat: cat });
  return;
}));

// POST /api/channels/:id/click — 记录加入按钮点击
router.post('/:id/click', asyncHandler(async (req, res) => {
  const db = supabase();
  await db.rpc('increment_click_count', { channel_id: req.params.id }).catch(() => {});
  res.json({ ok: true });
}));

// --- 登录后路由 ---

const submitSchema = z.object({
  name: z.string().trim().min(1).max(30),
  description: z.string().trim().max(200).optional(),
  category_id: z.string().uuid(),
  region_id: z.string().uuid(),
  invite_link: z.string().trim().min(10),
  join_type: z.enum(['invite_link', 'password_protected']),
});

// POST /api/channels — 提交
router.post('/', requireLogin, rateLimit({ limit: 3, windowSec: 86400, keyFn: req => `submit:${req.user.id}` }), asyncHandler(async (req, res) => {
  const body = submitSchema.parse(req.body);

  // 密令硬拦截 (D2)
  if (body.join_type === 'password_protected') {
    throw new AppError('CHANNEL_PASSWORD_PROTECTED');
  }

  // 检查重复
  const db = supabase();
  const { data: dup, error: dupErr } = await db
    .from('channels')
    .select('id')
    .eq('invite_link', body.invite_link)
    .in('status', ['pending_audit', 'approved'])
    .maybeSingle();
  if (dupErr) throw dupErr;
  if (dup) throw new AppError('CHANNEL_DUPLICATE_LINK');

  const { data, error } = await db
    .from('channels')
    .insert({
      ...body,
      owner_id: req.user.id,
      has_separate_password: false, // invite_link 类型
      status: 'pending_audit',
    })
    .select()
    .single();
  if (error) throw error;

  res.status(201).json(data);
}));

// PATCH /api/channels/:id
router.patch('/:id', requireLogin, asyncHandler(async (req, res) => {
  const db = supabase();
  const id = req.params.id;

  const { data: channel, error: findErr } = await db.from('channels').select('*').eq('id', id).maybeSingle();
  if (findErr) throw findErr;
  if (!channel) throw new AppError('CHANNEL_NOT_FOUND');
  if (channel.owner_id !== req.user.id) throw new AppError('CHANNEL_OWNER_MISMATCH');
  if (channel.status !== 'pending_audit') throw new AppError('CHANNEL_STATE_LOCKED');

  const patchable = ['name', 'description', 'invite_link', 'category_id', 'region_id'];
  const updates = {};
  for (const k of patchable) if (req.body[k] !== undefined) updates[k] = req.body[k];
  if (Object.keys(updates).length === 0) return res.json(channel);

  const { data, error } = await db.from('channels').update(updates).eq('id', id).select().single();
  if (error) throw error;
  res.json(data);
}));

// DELETE /api/channels/:id — 撤销提交
router.delete('/:id', requireLogin, asyncHandler(async (req, res) => {
  const db = supabase();
  const id = req.params.id;

  const { data: channel } = await db.from('channels').select('*').eq('id', id).maybeSingle();
  if (!channel) throw new AppError('CHANNEL_NOT_FOUND');
  if (channel.owner_id !== req.user.id) throw new AppError('CHANNEL_OWNER_MISMATCH');
  if (channel.status !== 'pending_audit') throw new AppError('CHANNEL_STATE_LOCKED');

  await db.from('channels').delete().eq('id', id);
  res.json({ ok: true });
}));

module.exports = router;
