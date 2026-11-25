<template>
  <div class="legal-page">
    <h1>隐私政策</h1>
    <p class="effective">最后更新：2026 年 11 月 1 日</p>

    <section>
      <h2>1. 我们收集什么</h2>
      <p>为了提供服务，我们收集以下最少必要数据：</p>
      <ul>
        <li><b>邮箱地址</b> — 用于验证码登录（SHA-256 哈希存储用于查找，不用于其他目的）</li>
        <li><b>你提交的频道信息</b> — 名称、描述、邀请链接、分类</li>
        <li><b>访问日志</b> — IP 地址（仅用于频率限制，不长期存储）、User-Agent、请求时间</li>
      </ul>
    </section>

    <section>
      <h2>2. 我们不做什么</h2>
      <ul>
        <li>❌ 不跟踪 Sotto App 内的任何消息内容</li>
        <li>❌ 不把你的邮箱卖给第三方</li>
        <li>❌ 不在页面放追踪 cookies（仅 session cookie）</li>
        <li>❌ 不收集非必要的个人信息（无手机号、无姓名、无头像）</li>
      </ul>
    </section>

    <section>
      <h2>3. 数据存储与安全</h2>
      <p>用户数据存储在 Supabase (PostgreSQL)，使用 service_role key 访问，RLS 策略限制暴露范围。验证码存储在 Upstash Redis，过期自动清除。</p>
      <p>登录会话使用 HttpOnly + Secure + SameSite=Lax cookie，前端 JS 无法读取。</p>
    </section>

    <section>
      <h2>4. 频道数据</h2>
      <p>你提交的频道信息在审核通过后会公开显示。你可以在审核通过前随时撤回（DELETE /api/channels/:id）。审核通过后联系 Admin 移除。</p>
    </section>

    <section>
      <h2>5. 联系我们</h2>
      <p>隐私相关问题请发邮件至 <b>privacy@sottorelay.com</b></p>
    </section>

    <footer>
      <router-link to="/terms">查看服务条款 →</router-link>
    </footer>
  </div>
</template>

<script setup>
import { useHead } from '@vueuse/head'
useHead({ title: '隐私政策 — Sotto 频道目录' })
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
