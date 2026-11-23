// Cloudflare Pages Function — /api/* → Railway 后端代理
// 路径: frontend/functions/api/[[path]].js
//
// 把所有 /api/* 请求转发到 Railway 后端
// 支持 cookie session (credentials: include)

const RAILWAY_API = 'https://sotto-backend-production-7df19a3f.up.railway.app'

export async function onRequest(context) {
  const { request } = context
  const url = new URL(request.url)

  // 代理到 Railway
  const railwayUrl = RAILWAY_API + url.pathname + url.search

  // 构造 headers
  const headers = new Headers(request.headers)
  headers.set('host', new URL(RAILWAY_API).host)

  // 转发请求
  const upstream = await fetch(railwayUrl, {
    method: request.method,
    headers,
    body: request.body,
    credentials: 'include',
    cf: {
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
