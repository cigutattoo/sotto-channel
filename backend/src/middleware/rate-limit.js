// 限流中间件 — Redis 优先, 不可用时降级到进程内内存

const { AppError } = require('../lib/errors');
const redis = require('../lib/redis-client');

// 简单固定窗口限流
async function _checkAndIncr(key, limit, windowSec) {
  if (redis.isAvailable()) {
    const r = redis.getClient();
    const current = await r.incr(key);
    if (current === 1) await r.expire(key, windowSec);
    return current <= limit;
  }

  // 降级: 进程内内存 Map
  const fb = redis.memoryFallback;
  const now = Date.now();
  let entry = fb.get(key);
  if (!entry || now - entry.startedAt > windowSec * 1000) {
    entry = { count: 1, startedAt: now };
    fb.set(key, entry);
    return true;
  }
  entry.count++;
  return entry.count <= limit;
}

function rateLimit({ limit = 60, windowSec = 60, keyFn }) {
  return async (req, res, next) => {
    const rawKey = keyFn ? keyFn(req) : `${req.ip}:${req.originalUrl}`;
    const ok = await _checkAndIncr(`rl:${rawKey}`, limit, windowSec);
    if (!ok) {
      res.setHeader('Retry-After', windowSec);
      return next(new AppError('RATE_LIMITED'));
    }
    next();
  };
}

module.exports = { rateLimit };
