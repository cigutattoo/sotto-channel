// /api/auth/send-code, /api/auth/verify-code, /api/auth/resend-code

const router = require('express').Router();
const crypto = require('crypto');
const { z } = require('zod');

const { getClient: supabase } = require('../lib/supabase-client');
const { generateCode, storeCode, verifyCode } = require('../lib/verification');
const sessionLib = require('../lib/session');
const emailLib = require('../lib/resend-client');
const { AppError } = require('../lib/errors');
const { asyncHandler } = require('../middleware/error-handler');
const { rateLimit } = require('../middleware/rate-limit');

const emailSchema = z.object({ email: z.string().email('邮箱格式不正确').transform(s => s.toLowerCase().trim()) });

const emailRateLimit = rateLimit({ limit: 5, windowSec: 3600, keyFn: req => `send:${req.body?.email || req.ip}` });

router.post('/send-code', emailRateLimit, asyncHandler(async (req, res) => {
  const { email } = emailSchema.parse(req.body);
  const emailHash = crypto.createHash('sha256').update(email).digest('hex');

  const db = supabase();
  const { data: user } = await db.from('users').select('id, email_verified').eq('email_hash', emailHash).maybeSingle();

  const code = generateCode();
  await storeCode(emailHash, code);

  try {
    const tmpl = emailLib.verificationEmail(code);
    await emailLib.sendEmail({ to: email, ...tmpl });
  } catch (sendErr) {
    req.log?.error({ err: sendErr }, 'resend send failed');
    throw new AppError('INTERNAL_ERROR', { hint: '验证码生成成功但邮件发送失败, 请稍后重试' });
  }

  res.json({ ok: true, sent_to: `${email.slice(0, 2)}***@${email.split('@')[1]}` });
}));

router.post('/verify-code', rateLimit({ limit: 10, windowSec: 60, keyFn: req => `verify:${req.body?.email || req.ip}` }), asyncHandler(async (req, res) => {
  const bodySchema = z.object({
    email: z.string().email().transform(s => s.toLowerCase().trim()),
    code: z.string().length(6, '验证码必须是 6 位').regex(/^\d+$/, '验证码必须是数字'),
  });
  const { email, code } = bodySchema.parse(req.body);
  const emailHash = crypto.createHash('sha256').update(email).digest('hex');

  await verifyCode(emailHash, code);

  const db = supabase();
  const emailMasked = email.replace(/^(.).*@(.*)$/, '$1***@$2');

  const { data: existing, error: selectErr } = await db
    .from('users')
    .select('id, email_verified')
    .eq('email_hash', emailHash)
    .maybeSingle();
  if (selectErr) throw selectErr;

  let userId;
  if (!existing) {
    const { data: newUser, error: insertErr } = await db
      .from('users')
      .insert({
        email,
        email_hash: emailHash,
        email_masked: emailMasked,
        email_verified: true,
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single();
    if (insertErr) throw insertErr;
    userId = newUser.id;
  } else if (!existing.email_verified) {
    await db.from('users').update({ email_verified: true }).eq('id', existing.id);
    userId = existing.id;
  } else {
    userId = existing.id;
  }

  const ip = req.headers['x-forwarded-for'] || req.ip;
  const ua = req.headers['user-agent'];
  const { token, expiresAt } = await sessionLib.createSession(userId, ip, ua);

  res.cookie('session_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    ...(process.env.COOKIE_DOMAIN ? { domain: process.env.COOKIE_DOMAIN } : {}),
    maxAge: sessionLib.SESSION_TTL_SECONDS * 1000,
  });

  res.json({ ok: true, user_id: userId, expires_at: expiresAt });
}));

router.post('/resend-code', rateLimit({ limit: 3, windowSec: 60, keyFn: req => `resend:${req.body?.email || req.ip}` }), asyncHandler(async (req, res) => {
  const { email } = emailSchema.parse(req.body);
  const code = generateCode();
  const emailHash = crypto.createHash('sha256').update(email).digest('hex');
  await storeCode(emailHash, code);
  const tmpl = emailLib.verificationEmail(code);
  try {
    await emailLib.sendEmail({ to: email, ...tmpl });
  } catch {
    throw new AppError('INTERNAL_ERROR', { hint: '邮件发送失败' });
  }
  res.json({ ok: true, sent_to: `${email.slice(0, 2)}***@${email.split('@')[1]}` });
}));

module.exports = router;

// --- TEMP DEBUG: 清 rate limit locks ---
// 部署完后立刻删除!
router.delete('/debug-clear-locks', asyncHandler(async (req, res) => {
  const authHeader = req.headers['x-debug-key'];
  if (authHeader !== 'sotto-debug-2026') {
    return res.status(403).json({ error: 'forbidden' });
  }
  const redis = require('../lib/redis-client');
  const r = redis.getClient();
  const email = (req.query.email || 'cigutattoo@163.com').toLowerCase();
  const emailHash = crypto.createHash('sha256').update(email).digest('hex');
  const deleted = [];
  for (const key of [
    `rl:send:${email}`,
    `rl:verify:${email}`,
    `rl:resend:${email}`,
    `verification:${emailHash}`,
    `verification:${emailHash}:attempts`,
  ]) {
    const n = await r.del(key);
    if (n > 0) deleted.push(key);
  }
  res.json({ ok: true, deleted });
}));

// --- TEMP DEBUG: SET + verify ATOMICALLY in one request ---
router.post('/debug-atomic-verify', asyncHandler(async (req, res) => {
  const authHeader = req.headers['x-debug-key'];
  if (authHeader !== 'sotto-debug-2026') return res.status(403).json({ error: 'forbidden' });
  const redis = require('../lib/redis-client');
  const verification = require('../lib/verification');
  const r = redis.getClient();
  const email = (req.query.email || 'cigutattoo@163.com').toLowerCase();
  const code = req.query.code || '123456';
  const emailHash = crypto.createHash('sha256').update(email).digest('hex');
  const key = `verification:${emailHash}`;
  
  await r.setex(key, 900, code);
  const stored = await r.get(key);
  
  let verifyResult;
  try {
    await verification.verifyCode(emailHash, code);
    verifyResult = { ok: true };
  } catch (e) {
    verifyResult = { ok: false, code: e.code, message: e.message };
  }
  
  res.json({ ok: true, emailHash, key, code, stored, match: stored === code, verify: verifyResult });
}));

// --- TEMP DEBUG: send-code REAL route → GET key → verifyCode all in ONE request ---
router.post('/debug-send-then-verify', asyncHandler(async (req, res) => {
  const authHeader = req.headers['x-debug-key'];
  if (authHeader !== 'sotto-debug-2026') return res.status(403).json({ error: 'forbidden' });

  const redis = require('../lib/redis-client');
  const verification = require('../lib/verification');
  const r = redis.getClient();
  const email = (req.query.email || 'cigutattoo@163.com').toLowerCase();
  const emailHash = crypto.createHash('sha256').update(email).digest('hex');
  const key = `verification:${emailHash}`;

  // Step 1: 清所有锁
  for (const k of [`rl:send:${email}`, `rl:verify:${email}`, `rl:resend:${email}`, key, `${key}:attempts`]) {
    await r.del(k);
  }

  // Step 2: generateCode + storeCode (跟 send-code 完全一样的逻辑, 跳过 rateLimit 和 sendEmail)
  const code = verification.generateCode();
  await verification.storeCode(emailHash, code);

  // Step 3: 立刻 GET 验证 key 里确实有值
  const stored = await r.get(key);

  // Step 4: verifyCode
  let verifyResult;
  try {
    await verification.verifyCode(emailHash, code);
    verifyResult = { ok: true };
  } catch (e) {
    verifyResult = { ok: false, code: e.code, message: e.message };
  }

  res.json({
    ok: true,
    email, emailHash, key, code,
    stored, storedMatch: stored === code,
    verify: verifyResult,
    // 关键: 跟 send-code 走完全相同的 storeCode 逻辑, 所以如果这个过了
    // 那说明 send-code 的 storeCode 也过了, 问题在跨请求
  });
}));
