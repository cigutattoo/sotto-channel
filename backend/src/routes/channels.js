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

  // 分步查询 (避免复杂 JOIN 问题)
  const { data, error } = await db
    .from('channels')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new AppError('CHANNEL_NOT_FOUND');
  if (data.status !== 'approved') throw new AppError('CHANNEL_NOT_FOUND');

  // 补充 categories
  const { data: cat } = await db
    .from('categories')
    .select('name_zh, name_en, slug, icon')
    .eq('id', data.category_id)
    .maybeSingle();
  if (cat) data.categories = cat;

  // 补充 owner
  const { data: owner } = await db
    .from('users')
    .select('email_masked, display_name')
    .eq('id', data.owner_id)
    .maybeSingle();
  if (owner) data.owner = owner;

  // view_count +1 (RPC 可能不存在, 安全降级)
  try {
    await db.rpc('increment_view_count', { channel_id: id });
  } catch (rpcErr) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[channel-detail] view_count RPC failed:', rpcErr?.message);
    }
  }

  res.json(data);
}));

// POST /api/channels/:id/click — 记录加入按钮点击
router.post('/:id/click', asyncHandler(async (req, res) => {
  const db = supabase();
  try {
    await db.rpc('increment_click_count', { channel_id: req.params.id });
  } catch (rpcErr) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[channel-click] RPC failed:', rpcErr?.message);
    }
  }
  res.json({ ok: true });
}));

// POST /api/channels/:id/report — 举报频道（需登录）
const reportSchema = z.object({
  reason_code: z.enum(['CONTENT_VIOLATION', 'SPAM', 'INVALID_LINK', 'MISLEADING', 'COPYRIGHT', 'HARASSMENT', 'OTHER']),
  reason_text: z.string().trim().max(500).optional(),
});

router.post('/:id/report', requireLogin, asyncHandler(async (req, res) => {
  const { reason_code, reason_text } = reportSchema.parse(req.body);
  const db = supabase();
  const channelId = req.params.id;

  // 确认频道存在且已公开
  const { data: ch, error: findErr } = await db
    .from('channels').select('id, name').eq('id', channelId).maybeSingle();
  if (findErr) throw findErr;
  if (!ch) throw new AppError('CHANNEL_NOT_FOUND');

  // 防重复举报（同一用户 10 分钟内同一频道）
  const { data: dup } = await db
    .from('reports')
    .select('id')
    .eq('channel_id', channelId)
    .eq('reporter_id', req.user.id)
    .gte('created_at', new Date(Date.now() - 10 * 60 * 1000).toISOString())
    .maybeSingle();
  if (dup) throw new AppError('DUPLICATE_REPORT', { hint: '你最近已经举报过这个频道了' });

  const { error } = await db
    .from('reports')
    .insert({
      channel_id: channelId,
      reporter_id: req.user.id,
      reason_code,
      reason_text: reason_text || null,
      status: 'pending',
    });
  if (error) throw error;

  // 通知 Admin
  try {
    const email = require('../lib/resend-client');
    const adminTo = process.env.ADMIN_ALERT_EMAIL;
    if (adminTo) {
      const reasonMap = {
        CONTENT_VIOLATION: '内容违规', SPAM: '垃圾信息', INVALID_LINK: '无效链接',
        MISLEADING: '误导信息', COPYRIGHT: '侵权', HARASSMENT: '骚扰', OTHER: '其他',
      };
      await email.sendEmail({
        to: adminTo,
        subject: `[Sotto] 新举报: ${ch.name}`,
        html: `<p>频道 <b>${ch.name}</b> 被举报</p>
               <p>原因: <b>${reasonMap[reason_code]}</b>${reason_text ? `<br>详情: ${reason_text}` : ''}</p>
               <p>频道ID: ${channelId}</p>`,
      });
    }
  } catch { /* 通知失败不阻塞 */ }

  res.status(201).json({ ok: true });
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
