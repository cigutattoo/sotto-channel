// Session 中间件 — 从 Cookie 或 Authorization header 取 token 并加载用户

const { getUserByToken } = require('../lib/session');
const { AppError } = require('../lib/errors');

async function sessionMiddleware(req, res, next) {
  const token = req.cookies?.session_token
    || (req.headers.authorization || '').replace(/^Bearer\s+/i, '');

  if (!token) {
    // 没有 token → 当作未登录 (由具体路由决定是否需要)
    req.user = null;
    return next();
  }

  try {
    const user = await getUserByToken(token);
    if (user === 'EXPIRED') {
      // 清掉 Cookie 让前端知道
      res.clearCookie('session_token');
      return next(new AppError('SESSION_EXPIRED'));
    }
    if (!user) {
      return next(new AppError('SESSION_INVALID'));
    }
    if (user.status === 'banned') {
      return next(new AppError('FORBIDDEN'));
    }
    req.user = user;
    req.sessionToken = token;
    next();
  } catch (err) {
    next(err);
  }
}

function requireLogin(req, res, next) {
  if (!req.user) return next(new AppError('UNAUTHORIZED'));
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user) return next(new AppError('UNAUTHORIZED'));
  if (req.user.role !== 'admin') return next(new AppError('FORBIDDEN'));
  next();
}

module.exports = { sessionMiddleware, requireLogin, requireAdmin };
