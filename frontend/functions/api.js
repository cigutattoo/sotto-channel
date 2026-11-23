// Cloudflare Pages Function — /api/* → Railway 后端代理
// 路径: frontend/functions/api.js
//
// 把所有 /api/* 请求转发到 Railway 后端
// 支持 cookie session (credentials: include)
// 注入 Internal Service Token 防止第三方调用后端

const RAILWAY_API = 'https://sotto-channel-backend.up.railway.app' // TODO: 部署后改真实域名

export async function onRequest(context) {
  const { request, next, env } = context
  const url = new URL(request.url)

  // 如果是构建产物里的静态文件，走正常流程
  if (!url.pathname.startsWith('/api/')) {
    return next()
  }

  // 代理到 Railway
  const railwayUrl = RAILWAY_API + url.pathname + url.search

  // 构造 headers
  const headers = new Headers(request.headers)
  headers.set('host', new URL(RAILWAY_API).host)

  // 可选: 注入内部服务 token (Railway 那边验证)
  // if (env.INTERNAL_SERVICE_TOKEN) {
  //   headers.set('x-internal-token', env.INTERNAL_SERVICE_TOKEN)
  // }

  // 转发请求
  const upstream = await fetch(railwayUrl, {
    method: request.method,
    headers,
    body: request.body,
    credentials: 'include',
    cf: {
      // 不缓存 API 响应
      cacheEverything: false,
      cacheTtl: 0,
    },
  })

  // 透传响应 (包含 Set-Cookie)
  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: upstream.headers,
  })
}
