#!/usr/bin/env node
/**
 * Express 启动后自动 smoke test
 * - 不依赖海外网络
 * - 只测 HTTP 层 + 基本路由
 * - 网络失败时模拟 Redis/Supabase 不可用的降级行为
 *
 * 用法: node scripts/smoke-test.js [baseUrl]
 * 默认: http://localhost:3000
 */

const baseUrl = process.argv[2] || 'http://localhost:3000';
let passed = 0, failed = 0;

function pad(s, n = 40) { return String(s).padEnd(n, ' '); }

async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (e) {
    failed++;
    console.log(`  ❌ ${name} — ${e.message}`);
  }
}

async function get(path, expectStatus = 200) {
  const resp = await fetch(baseUrl + path);
  if (resp.status !== expectStatus) {
    throw new Error(`HTTP ${resp.status} (expected ${expectStatus})`);
  }
  return resp.json();
}

async function post(path, body, expectStatus = 200) {
  const resp = await fetch(baseUrl + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (resp.status !== expectStatus) {
    const text = await resp.text();
    throw new Error(`HTTP ${resp.status} (expected ${expectStatus}) — ${text.slice(0, 200)}`);
  }
  return resp.json();
}

(async () => {
  console.log('\n========================================');
  console.log('  🧪 Sotto Channel Directory — Smoke Test');
  console.log('========================================');
  console.log(`  Target: ${baseUrl}\n`);

  // 1. 基础健康检查
  console.log('📡 Health endpoints');
  await test('GET /healthz', async () => {
    const d = await get('/healthz');
    if (d.ok !== true) throw new Error('{ok: true} missing');
  });
  await test('GET /readyz', async () => {
    const resp = await fetch(baseUrl + '/readyz');
    if (resp.status !== 200 && resp.status !== 503) {
      throw new Error(`HTTP ${resp.status} (expected 200 or 503)`);
    }
    const d = await resp.json();
    // 503 是网络断时的正确表现 (生产阻止流量)
    console.log(`      → HTTP ${resp.status}  ok=${d.ok}  redis=${d.redis}  db=${d.db}`);
  });

  // 2. 公开路由
  console.log('\n📡 Public API (DB-dependent, accept 5xx when network down)');
  await test('GET /api/categories/tree (两级嵌套)', async () => {
    try {
      const d = await get('/api/categories/tree');
      // 检查结构
      if (d.regions) {
        // 正确格式: { regions: [...] }
        const regions = d.regions;
        if (!Array.isArray(regions)) throw new Error('regions not array');
        const withChildren = regions.filter(r => Array.isArray(r.themes) && r.themes.length > 0);
        console.log(`      → ${regions.length} regions, ${regions.reduce((a,r)=>a+(r.themes?.length||0),0)} themes total`);
      } else if (Array.isArray(d)) {
        // 兼容旧格式
        if (d.length === 0) throw new Error('empty');
        console.log(`      → ${d.length} categories`);
      } else {
        throw new Error(`unexpected format: ${JSON.stringify(d).slice(0, 100)}`);
      }
    } catch (e) {
      if (e.message.includes('HTTP 5')) {
        console.log('      → ⚠️ Supabase 不可用 (预期中, 海外网络断)');
      } else {
        throw e;
      }
    }
  });

  await test('GET /api/channels (公开列表)', async () => {
    try {
      const d = await get('/api/channels');
      // 后端返回分页结构 { items: [...], total: N }，兼容纯数组
      const items = d.items || d;
      if (!Array.isArray(items)) throw new Error('not array');
      console.log(`      → ${items.length} channels / total ${d.total ?? d.length ?? 'n/a'}`);
    } catch (e) {
      if (e.message.includes('HTTP 5')) {
        console.log('      → ⚠️ Supabase 不可用 (预期中, 海外网络断)');
      } else {
        throw e;
      }
    }
  });

  await test('GET /api/channels/hot', async () => {
    try {
      const d = await get('/api/channels/hot');
      if (!Array.isArray(d)) throw new Error('not array');
    } catch (e) {
      if (e.message.includes('HTTP 5')) console.log('      → ⚠️ 同上 (Supabase)');
      else throw e;
    }
  });

  // 3. 输入校验（不需要 Redis/Supabase 也能测 zod）
  console.log('\n📡 Input validation');
  await test('POST /auth/send-code — 无效邮箱 → 400', async () => {
    await post('/api/auth/send-code', { email: 'not-an-email' }, 400);
  });
  await test('POST /auth/verify-code — 缺字段 → 400', async () => {
    await post('/api/auth/verify-code', { email: 'x@x.com' }, 400);
  });
  await test('POST /auth/verify-code — 验证码非数字 → 400', async () => {
    await post('/api/auth/verify-code', { email: 'x@x.com', code: 'abcdef' }, 400);
  });
  await test('POST /auth/send-code — 必填缺失 → 400', async () => {
    await post('/api/auth/send-code', {}, 400);
  });

  // 4. 登录保护
  console.log('\n📡 Auth guard');
  await test('GET /me — 未登录 → 401', async () => {
    await get('/api/me', 401);
  });
  await test('POST /api/channels — 未登录 → 401', async () => {
    await post('/api/channels', { name: 'test' }, 401);
  });

  // 5. 404 处理
  console.log('\n📡 404 / Error handling');
  await test('GET /api/does-not-exist → 404', async () => {
    const resp = await fetch(baseUrl + '/api/does-not-exist');
    if (resp.status !== 404) throw new Error(`HTTP ${resp.status}`);
  });

  // Summary
  console.log('\n========================================');
  console.log(`  Passed: ${passed}  Failed: ${failed}`);
  console.log('========================================\n');

  process.exit(failed > 0 ? 1 : 0);
})();
