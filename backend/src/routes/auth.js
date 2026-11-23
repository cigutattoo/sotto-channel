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
  try {
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
  } catch (err) {
    req.log?.error({ err }, 'send-code FAILED');
    // 临时调试: 透出真实错误
    if (err instanceof AppError) throw err;
    throw new AppError('INTERNAL_ERROR', { hint: err.message || String(err) });
  }
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
