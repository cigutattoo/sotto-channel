// /api/admin/* — 审计后台

const router = require('express').Router();
const { z } = require('zod');

const { getClient: supabase } = require('../lib/supabase-client');
const { AppError } = require('../lib/errors');
const { asyncHandler } = require('../middleware/error-handler');
const { requireAdmin } = require('../middleware/session');
const email = require('../lib/resend-client');

router.use(requireAdmin);

// GET /pending/channels
router.get('/pending/channels', asyncHandler(async (req, res) => {
  const db = supabase();
  const { data, error } = await db
    .from('channels')
    .select('*, owner:users(email_masked, display_name), categories!channels_category_id_fkey(name_zh, slug)')
    .eq('status', 'pending_audit')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  res.json(data || []);
}));

// GET /pending/ads — M4 再实现, 占位
router.get('/pending/ads', asyncHandler(async (req, res) => {
  res.json([]);
}));

// POST /channels/:id/approve
router.post('/channels/:id/approve', asyncHandler(async (req, res) => {
  const id = req.params.id;
  const db = supabase();

  const { data: ch, error: findErr } = await db.from('channels').select('*, owner:users!inner(email, display_name)').eq('id', id).maybeSingle();
  if (findErr) throw findErr;
  if (!ch) throw new AppError('CHANNEL_NOT_FOUND');
  if (ch.status !== 'pending_audit') throw new AppError('CHANNEL_STATE_LOCKED');

  const { data, error } = await db
    .from('channels')
    .update({ status: 'approved', approved_at: new Date().toISOString(), audit_notes: `approved by admin ${req.user.id}` })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;

  // 审计日志
  await db.from('audits').insert({
    target_type: 'channel', target_id: id, action: 'approve',
    auditor_id: req.user.id, created_at: new Date().toISOString(),
  });

  // 邮件通知
  try {
    const site = process.env.SITE_URL || 'https://sotto-admin.pages.dev';
    const tmpl = email.channelApprovedEmail(ch.name, `${site}/channels/${id}`);
    await email.sendEmail({ to: ch.owner.email, ...tmpl });
  } catch { /* 邮件失败不阻塞审核 */ }

  res.json(data);
}));

// POST /channels/:id/reject
router.post('/channels/:id/reject', asyncHandler(async (req, res) => {
  const schema = z.object({
    reason_code: z.enum(['CONTENT_VIOLATION', 'CATEGORY_MISMATCH', 'INVALID_LINK', 'DUPLICATE', 'PASSWORDED', 'SPAM', 'BOT']),
    reason_text: z.string().trim().max(200).optional(),
  });
  const { reason_code, reason_text } = schema.parse(req.body);
  const id = req.params.id;
  const db = supabase();

  const { data: ch, error: findErr } = await db.from('channels').select('*, owner:users!inner(email, display_name)').eq('id', id).maybeSingle();
  if (findErr) throw findErr;
  if (!ch) throw new AppError('CHANNEL_NOT_FOUND');
  if (ch.status !== 'pending_audit') throw new AppError('CHANNEL_STATE_LOCKED');

  const { data, error } = await db
    .from('channels')
    .update({ status: 'rejected', rejected_reason: reason_code, audit_notes: reason_text || reason_code })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;

  await db.from('audits').insert({
    target_type: 'channel', target_id: id, action: 'reject',
    reason_code, reason_text, auditor_id: req.user.id,
    created_at: new Date().toISOString(),
  });

  // 邮件通知
  try {
    const site = process.env.SITE_URL || 'https://sotto-admin.pages.dev';
    const reasonMap = {
      CONTENT_VIOLATION: '内容违规', CATEGORY_MISMATCH: '分类选择错误',
      INVALID_LINK: 'Sotto 邀请链接无效', DUPLICATE: '重复提交',
      PASSWORDED: '密令保护的频道不允许公开收录', SPAM: '疑似垃圾信息', BOT: '疑似机器人提交',
    };
    const tmpl = email.channelRejectedEmail(ch.name, reasonMap[reason_code] + (reason_text ? ` — ${reason_text}` : ''), `${site}/channels/submit?edit=${id}`);
    await email.sendEmail({ to: ch.owner.email, ...tmpl });
  } catch {}

  res.json(data);
}));

// POST /users/:id/role
router.post('/users/:id/role', asyncHandler(async (req, res) => {
  const role = z.enum(['user', 'channel_owner', 'advertiser', 'admin']).parse(req.body.role);
  const db = supabase();
  const { data, error } = await db.from('users').update({ role }).eq('id', req.params.id).select('id, role').single();
  if (error) throw error;

  await db.from('audits').insert({
    target_type: 'user', target_id: req.params.id, action: 'role_change',
    reason_text: `set role=${role}`, auditor_id: req.user.id,
  });
  res.json(data);
}));

// POST /users/:id/ban · /unban
router.post('/users/:id/:action', asyncHandler(async (req, res) => {
  const isBan = req.params.action === 'ban';
  const db = supabase();
  const { data, error } = await db.from('users').update({ status: isBan ? 'banned' : 'active' }).eq('id', req.params.id).select('id, status').single();
  if (error) throw error;

  await db.from('audits').insert({
    target_type: 'user', target_id: req.params.id, action: isBan ? 'ban' : 'unban',
    auditor_id: req.user.id,
  });
  res.json(data);
}));

// GET /stats
router.get('/stats', asyncHandler(async (req, res) => {
  const db = supabase();

  const todayStart = new Date(); todayStart.setUTCHours(0, 0, 0, 0);

  const [{ count: pending }, { count: total }, { count: approvedToday }, { count: rejectedToday }, { count: usersTotal }] =
    await Promise.all([
      db.from('channels').select('*', { count: 'exact', head: true }).eq('status', 'pending_audit'),
      db.from('channels').select('*', { count: 'exact', head: true }),
      db.from('channels').select('*', { count: 'exact', head: true }).eq('status', 'approved').gte('approved_at', todayStart.toISOString()),
      db.from('audits').select('*', { count: 'exact', head: true }).eq('action', 'reject').gte('created_at', todayStart.toISOString()),
      db.from('users').select('*', { count: 'exact', head: true }),
    ]);

  res.json({
    pending_count: pending || 0,
    total_channels: total || 0,
    approved_today: approvedToday || 0,
    rejected_today: rejectedToday || 0,
    total_users: usersTotal || 0,
  });
}));

module.exports = router;
