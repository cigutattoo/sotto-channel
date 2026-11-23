// 统一错误码定义 — spec Section 4.2

const ERRORS = {
  EMAIL_INVALID:              { code: 'EMAIL_INVALID',              http: 400, message: '邮箱格式不合法' },
  EMAIL_ALREADY_REGISTERED:   { code: 'EMAIL_ALREADY_REGISTERED',   http: 409, message: '该邮箱已注册', hint: '请尝试使用登录功能' },
  EMAIL_NOT_FOUND:            { code: 'EMAIL_NOT_FOUND',            http: 404, message: '该邮箱未注册', hint: '请先注册' },
  CODE_INVALID:               { code: 'CODE_INVALID',               http: 400, message: '验证码错误' },
  CODE_EXPIRED:               { code: 'CODE_EXPIRED',               http: 410, message: '验证码已过期,请重新获取' },
  CODE_TOO_MANY_ATTEMPTS:     { code: 'CODE_TOO_MANY_ATTEMPTS',     http: 429, message: '验证码输错次数过多,请 15 分钟后重试' },
  RATE_LIMITED:               { code: 'RATE_LIMITED',               http: 429, message: '请求过于频繁,请稍后再试' },

  SESSION_INVALID:            { code: 'SESSION_INVALID',            http: 401, message: '登录已失效,请重新登录' },
  SESSION_EXPIRED:            { code: 'SESSION_EXPIRED',            http: 401, message: '登录已过期,请重新登录' },
  UNAUTHORIZED:               { code: 'UNAUTHORIZED',               http: 401, message: '请先登录' },
  FORBIDDEN:                  { code: 'FORBIDDEN',                  http: 403, message: '没有权限执行此操作' },

  CHANNEL_NOT_FOUND:          { code: 'CHANNEL_NOT_FOUND',          http: 404, message: '频道不存在' },
  CHANNEL_PASSWORD_PROTECTED: { code: 'CHANNEL_PASSWORD_PROTECTED', http: 400, message: '密令保护的频道不允许公开收录', hint: 'Sotto 频道目录只收录公开邀请链接的频道' },
  CHANNEL_DUPLICATE_LINK:     { code: 'CHANNEL_DUPLICATE_LINK',     http: 409, message: '相同的邀请链接已存在待审或已通过的频道' },
  CHANNEL_OWNER_MISMATCH:     { code: 'CHANNEL_OWNER_MISMATCH',     http: 403, message: '您不是该频道的提交者' },
  CHANNEL_STATE_LOCKED:       { code: 'CHANNEL_STATE_LOCKED',       http: 409, message: '频道已通过审核,不能直接修改', hint: '如需修改请联系审计员' },

  AD_SUBMIT_LIMIT:            { code: 'AD_SUBMIT_LIMIT',            http: 429, message: '免费推广每天最多提交 5 条' },

  SUPABASE_DOWN:              { code: 'SUPABASE_DOWN',              http: 503, message: '数据库暂时不可用' },
  REDIS_DOWN_FATAL:           { code: 'REDIS_DOWN_FATAL',           http: 503, message: '验证码服务暂时不可用' },

  VALIDATION_FAILED:          { code: 'VALIDATION_FAILED',          http: 400, message: '参数校验失败' },
  INTERNAL_ERROR:             { code: 'INTERNAL_ERROR',             http: 500, message: '服务器内部错误' },
};

class AppError extends Error {
  constructor(code, extra = {}) {
    const def = ERRORS[code] || ERRORS.INTERNAL_ERROR;
    super(def.message);
    this.code = code;
    this.http = def.http;
    this.hint = extra.hint ?? def.hint;
    this.details = extra.details;
  }
}

function createErrorResponse(err, req) {
  const def = ERRORS[err.code] || ERRORS.INTERNAL_ERROR;
  return {
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message: err.message || def.message,
      hint: err.hint || def.hint,
      ...(err.details ? { details: err.details } : {}),
    },
    request_id: req.id,
    timestamp: new Date().toISOString(),
  };
}

module.exports = { ERRORS, AppError, createErrorResponse };
