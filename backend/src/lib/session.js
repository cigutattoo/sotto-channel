// Session 生成 + 验证 + Redis 缓存

const crypto = require('crypto');
const { getClient: supabase } = require('./supabase-client');
const redis = require('./redis-client');
const { AppError } = require('./errors');

const SESSION_TTL_SECONDS = 7 * 24 * 3600; // 7 天

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function generateToken(userId) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    console.error('[session] SESSION_SECRET not set');
    process.exit(1);
  }
  const sessionId = crypto.randomUUID();
  const raw = `${userId}:${sessionId}:${secret}:${Date.now()}`;
  return crypto.createHash('sha256').update(raw).digest('hex');
}

async function createSession(userId, ip, ua) {
  const token = generateToken(userId);
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);

  // Postgres inet 类型只接受单个 IP —— X-Forwarded-For 可能逗号分隔多个
  const singleIp = ip
    ? String(ip).split(',')[0].trim()
    : null;

  const db = supabase();
  const { error } = await db
    .from('sessions')
    .insert({
      token: hashToken(token),
      user_id: userId,
      created_at: new Date().toISOString(),
      expires_at: expiresAt.toISOString(),
      user_agent: ua,
      ip: singleIp,
    });

  if (error) throw error;

  // Redis 缓存 (token → user_id), 方便快速查询
  if (redis.isAvailable()) {
    const r = redis.getClient();
    await r.setex(`session:${hashToken(token)}`, SESSION_TTL_SECONDS, userId);
  }

  return { token, expiresAt };
}

async function getUserByToken(token) {
  if (!token) return null;
  const hashed = hashToken(token);

  // 1) Redis 缓存命中
  if (redis.isAvailable()) {
    const r = redis.getClient();
    const cached = await r.get(`session:${hashed}`);
    if (cached) {
      return _loadUser(cached);
    }
  }

  // 2) 降级查 DB
  const db = supabase();
  const { data: session, error } = await db
    .from('sessions')
    .select('user_id, expires_at')
    .eq('token', hashed)
    .maybeSingle();

  if (error) throw error;
  if (!session) return null;

  if (new Date(session.expires_at) < new Date()) {
    return 'EXPIRED';
  }

  // 回写 Redis
  if (redis.isAvailable()) {
    const r = redis.getClient();
    const remaining = Math.max(1, Math.floor((new Date(session.expires_at) - Date.now()) / 1000));
    await r.setex(`session:${hashed}`, remaining, session.user_id);
  }

  return _loadUser(session.user_id);
}

async function _loadUser(userId) {
  const db = supabase();
  const { data, error } = await db
    .from('users')
    .select('id, email_masked, display_name, role, status, created_at')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function destroySession(token) {
  const hashed = hashToken(token);
  const db = supabase();
  await db.from('sessions').update({ expires_at: new Date().toISOString() }).eq('token', hashed);

  if (redis.isAvailable()) {
    const r = redis.getClient();
    await r.del(`session:${hashed}`);
  }
}

module.exports = { createSession, getUserByToken, destroySession, hashToken, SESSION_TTL_SECONDS };
