<template>
  <div class="legal-page">
    <h1>服务条款</h1>
    <p class="effective">最后更新：2026 年 11 月 1 日</p>

    <section>
      <h2>1. 接受条款</h2>
      <p>访问或使用 Sotto 频道目录（以下简称"本服务"）即表示你同意这些条款。如果你不同意，请勿使用。</p>
    </section>

    <section>
      <h2>2. 服务描述</h2>
      <p>本服务是 Sotto（端到端加密隐私 IM）的独立频道发现目录。我们：</p>
      <ul>
        <li>允许用户浏览和搜索公开的 Sotto 频道</li>
        <li>允许登录用户提交频道（需审核）</li>
        <li>允许登录用户举报违规频道</li>
      </ul>
      <p>我们不托管、不存储、不检查 Sotto 消息内容。</p>
    </section>

    <section>
      <h2>3. 用户账号</h2>
      <p>通过邮箱验证码登录即创建账号。你有责任保持账号安全。我们保留对违规账号采取行动（包括封禁）的权利。</p>
    </section>

    <section>
      <h2>4. 提交内容</h2>
      <p>提交频道时，你保证：</p>
      <ul>
        <li>你有权提交该频道</li>
        <li>内容不违反当地法律</li>
        <li>不提交密令保护的频道（我们不收录）</li>
        <li>不提交垃圾信息、重复链接或机器人内容</li>
      </ul>
      <p>我们保留批准或拒绝任何提交的权利，且不需说明理由。</p>
    </section>

    <section>
      <h2>5. 禁止行为</h2>
      <ul>
        <li>使用自动化脚本大规模提交或举报</li>
        <li>试图绕过频率限制</li>
        <li>使用本服务从事违法活动</li>
        <li>干扰或攻击我们的基础设施</li>
      </ul>
    </section>

    <section>
      <h2>6. 免责声明</h2>
      <p>本服务"按原样"提供。我们不保证目录中频道的准确性、可用性或安全性。你点击加入频道时，会离开本服务进入 Sotto App，此时本服务不再承担任何责任。</p>
    </section>

    <section>
      <h2>7. 条款变更</h2>
      <p>我们可能更新这些条款。变更后在本页面发布，继续使用即表示接受新条款。</p>
    </section>

    <section>
      <h2>8. 适用法律</h2>
      <p>本服务受服务器所在地法律管辖。</p>
    </section>

    <footer>
      <router-link to="/privacy">查看隐私政策 →</router-link>
    </footer>
  </div>
</template>

<script setup>
import { useHead } from '@vueuse/head'
useHead({ title: '服务条款 — Sotto 频道目录' })
</script>

<style scoped>
.legal-page { max-width: 640px; margin: 0 auto; padding: 48px 24px; line-height: 1.8; color: var(--text); }
.legal-page h1 { font-size: 28px; margin-bottom: 4px; }
.legal-page .effective { color: var(--text-muted); margin-bottom: 32px; }
.legal-page section { margin-bottom: 28px; }
.legal-page h2 { font-size: 18px; margin-bottom: 8px; color: var(--text); }
.legal-page ul { padding-left: 20px; }
.legal-page li { margin-bottom: 4px; }
.legal-page footer { margin-top: 48px; padding-top: 24px; border-top: 1px solid var(--border); }
.legal-page footer a { color: var(--accent); text-decoration: none; }
</style>
