// Express app 组装

require('dotenv').config();

const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const pinoHttp = require('pino-http');

const redis = require('./lib/redis-client');
const supabase = require('./lib/supabase-client');

const { requestId, errorHandler, notFound } = require('./middleware/error-handler');
const { sessionMiddleware } = require('./middleware/session');

const authRouter = require('./routes/auth');
const meRouter = require('./routes/me');
const categoriesRouter = require('./routes/categories');
const channelsRouter = require('./routes/channels');
const adminRouter = require('./routes/admin');

function createApp() {
  const app = express();

  // 安全头 (生产环境)
  app.use((req, res, next) => {
    if (process.env.NODE_ENV === 'production') {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
      res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
      res.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; connect-src 'self' https://*.supabase.co https://*.upstash.io https://api.resend.com; frame-ancestors 'none'"
      );
      // HSTS 留 2 个月后开启
      // res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
    }
    next();
  });

  // 基础中间件
  app.use(requestId);
  app.use(pinoHttp({
    level: process.env.NODE_ENV === 'production' ? 'warn' : 'info',
    redact: ['req.headers.authorization', 'req.cookies.session_token'],
  }));

  // CORS: 支持环境变量逗号分隔多域名 + 所有 CF Pages 预览子域名
  const corsOrigins = (process.env.CORS_ORIGIN || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  // 放行所有 *.sotto-admin.pages.dev（每次部署新子域名都不需要改 env）
  const pagesDevRegex = /\.sotto-admin\.pages\.dev$/;
  app.use(cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true);
      if (corsOrigins.includes(origin)) return cb(null, origin);
      if (pagesDevRegex.test(origin)) return cb(null, origin);
      return cb(null, true); // fallback 放行（开发/自建）
    },
    credentials: true,
  }));

  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  // 请求体大小保护
  app.use((req, res, next) => {
    const contentLength = parseInt(req.headers['content-length'], 10);
    if (contentLength > 1024 * 1024) {
      return res.status(413).json({ error: { code: 'PAYLOAD_TOO_LARGE' } });
    }
    next();
  });

  // Session 解析 (所有请求)
  app.use(sessionMiddleware);

  // --- 路由 ---

  app.get('/', (req, res) => res.json({ name: 'sotto-channel-api', version: '0.1.0', docs: '/healthz' }));

  // healthz / readyz (inline)
  app.get('/healthz', (req, res) => res.json({ ok: true }));

  app.get('/readyz', async (req, res) => {
    const result = { ok: true };

    if (redis.isAvailable()) {
      try { await redis.getClient().ping(); result.redis = true; }
      catch { result.redis = false; result.ok = false; }
    } else { result.redis = false; result.ok = false; }

    const dbResult = await supabase.verifyConnection();
    result.db = dbResult.ok;
    if (!dbResult.ok) { result.ok = false; result.dbError = dbResult.error; }

    result.email = !!process.env.RESEND_API_KEY;

    res.status(result.ok ? 200 : 503).json(result);
  });

  // API 路由
  app.use('/api/auth', authRouter);
  app.use('/api/me', meRouter);
  app.use('/api/categories', categoriesRouter);
  app.use('/api/channels', channelsRouter);
  app.use('/api/admin', adminRouter);

  // 404 + 全局错误 (必须最后)
  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
