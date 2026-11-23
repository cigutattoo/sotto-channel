// 入口: 启动前验证 Redis (D9 硬边界) + Supabase

require('dotenv').config();

// 本地开发环境: 用 PowerShell Invoke-WebRequest monkey-patch globalThis.fetch
// 解决中国大陆 Node.js 直连海外 HTTPS 全部 ECONNRESET 的问题
require('./lib/fetch-patch');

const { connect: redisConnect } = require('./lib/redis-client');
const { verifyConnection: supabaseVerify } = require('./lib/supabase-client');
const { createApp } = require('./app');

async function main() {
  console.log('========================================');
  console.log('  Sotto Channel Directory — Backend');
  console.log('========================================');

  // D9: 启动前必须 Redis ping 成功 (生产严格, 本地开发 warn 即可)
  if (process.env.NODE_ENV === 'production') {
    await redisConnect();
  } else {
    try {
      await redisConnect();
    } catch {
      console.warn('[redis] 本地开发模式: Redis 未连, 验证码/限流功能不可用');
    }
  }

  // Supabase (失败不阻塞启动, 但 readyz 会 false)
  const dbOk = await supabaseVerify();
  if (!dbOk) {
    console.warn('[supabase] 连接失败, 服务启动但 readyz 会返回 db:false');
  }

  const app = createApp();
  const port = parseInt(process.env.PORT, 10) || 3000;

  app.listen(port, () => {
    console.log(`\n✅ 监听 http://localhost:${port}`);
    console.log(`   /healthz →  ${dbOk ? 'db ok' : 'db fail (非致命)'}`);
    console.log(`   /readyz  →  全联通检查`);
  });
}

main().catch(err => {
  console.error('[FATAL] 启动失败:', err.message);
  process.exit(1);
});
