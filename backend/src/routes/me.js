// /api/me — 当前用户 + 更新 + logout

const router = require('express').Router();
const { z } = require('zod');

const { getClient: supabase } = require('../lib/supabase-client');
const sessionLib = require('../lib/session');
const { AppError } = require('../lib/errors');
const { asyncHandler } = require('../middleware/error-handler');
const { requireLogin } = require('../middleware/session');

router.get('/', requireLogin, asyncHandler(async (req, res) => {
  const db = supabase();
  const { data, error } = await db
    .from('users')
    .select('id, email_masked, display_name, role, status, created_at')
    .eq('id', req.user.id)
    .maybeSingle();
  if (error) throw error;
  res.json(data);
}));

router.patch('/', requireLogin, asyncHandler(async (req, res) => {
  const schema = z.object({
    display_name: z.string().trim().min(1).max(30).optional(),
  });
  const body = schema.parse(req.body);

  const db = supabase();
  const { data, error } = await db
    .from('users')
    .update(body)
    .eq('id', req.user.id)
    .select('id, email_masked, display_name, role, status, created_at')
    .single();
  if (error) throw error;
  res.json(data);
}));

router.post('/logout', asyncHandler(async (req, res) => {
  const token = req.cookies?.session_token;
  if (token) {
    await sessionLib.destroySession(token);
    res.clearCookie('session_token');
  }
  res.json({ ok: true });
}));

module.exports = router;
