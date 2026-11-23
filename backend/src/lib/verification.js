// 验证码: 只存 Redis, 不写 DB

const crypto = require('crypto');
const redis = require('./redis-client');
const { AppError } = require('./errors');

const CODE_TTL_SECONDS = 15 * 60; // 15 分钟
const MAX_ATTEMPTS = 5;           // 输错 5 次锁 15 分钟
const ATTEMPT_LOCK_SECONDS = 15 * 60;

function generateCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

function _keyVerif(emailHash) { return `verification:${emailHash}`; }
function _keyAttempts(emailHash) { return `verification:${emailHash}:attempts`; }

async function storeCode(emailHash, code) {
  if (!redis.isAvailable()) throw new AppError('REDIS_DOWN_FATAL');
  const r = redis.getClient();
  await r.setex(_keyVerif(emailHash), CODE_TTL_SECONDS, code);
}

async function verifyCode(emailHash, code) {
  if (!redis.isAvailable()) throw new AppError('REDIS_DOWN_FATAL');
  const r = redis.getClient();

  // 1) 检查是否被锁
  const attempts = parseInt(await r.get(_keyAttempts(emailHash)) || '0', 10);
  if (attempts >= MAX_ATTEMPTS) {
    throw new AppError('CODE_TOO_MANY_ATTEMPTS');
  }

  // 2) 对比
  const expected = await r.get(_keyVerif(emailHash));
  if (!expected) throw new AppError('CODE_EXPIRED');
  if (expected !== code) {
    // 输错 → 增加计数
    await r.setex(_keyAttempts(emailHash), ATTEMPT_LOCK_SECONDS, attempts + 1);
    throw new AppError('CODE_INVALID');
  }

  // 3) 成功 → 删验证码 + 清 attempts
  await Promise.all([r.del(_keyVerif(emailHash)), r.del(_keyAttempts(emailHash))]);
  return true;
}

async function getCooldown(emailHash) {
  if (!redis.isAvailable()) return 0;
  const r = redis.getClient();
  const ttl = await r.ttl(_keyAttempts(emailHash));
  return ttl > 0 ? ttl : 0;
}

module.exports = { generateCode, storeCode, verifyCode, getCooldown, CODE_TTL_SECONDS };
