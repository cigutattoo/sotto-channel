// 全局错误处理中间件 + request_id 注入

const crypto = require('crypto');
const { AppError, createErrorResponse } = require('../lib/errors');

// 在 app.js 最前面挂载, 给每个请求注入 req.id
function requestId(req, res, next) {
  req.id = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  res.setHeader('X-Request-Id', req.id);
  next();
}

// zod 参数校验 → AppError 转换
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Express 4 参数错误处理器 (必须最后一个挂载)
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  // ZodError → VALIDATION_FAILED
  if (err.name === 'ZodError' || (err.issues && Array.isArray(err.issues))) {
    res.status(400).json(createErrorResponse(
      new AppError('VALIDATION_FAILED', { details: err.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ') }),
      req,
    ));
    return;
  }

  // Supabase auth/RLS 错误
  if (err.code === 'PGRST116') {
    // no rows returned — 不算严重, 交给业务层
  }

  if (err instanceof AppError) {
    res.status(err.http).json(createErrorResponse(err, req));
    return;
  }

  // 未知错误: 500 — 完整 dump Supabase 错误字段
  const dump = {
    err_code: err?.code,
    err_message: err?.message,
    err_details: err?.details,
    err_hint: err?.hint,
    err_status: err?.status,
    err_statusCode: err?.statusCode,
    err_name: err?.name,
    err_stack: err?.stack?.substring(0, 600),
    req_method: req.method,
    req_url: req.url,
  };
  req.log?.error(dump, 'unhandled error');
  console.error('[500 ERROR]', JSON.stringify(dump, null, 2));
  res.status(500).json(createErrorResponse(new AppError('INTERNAL_ERROR', { hint: err?.details || err?.message || err?.hint }), req));
}

// 404 兜底
function notFound(req, res) {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: '请求的资源不存在' },
    request_id: req.id,
    timestamp: new Date().toISOString(),
  });
}

module.exports = { requestId, asyncHandler, errorHandler, notFound };
