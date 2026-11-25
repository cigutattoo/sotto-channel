<script setup>
import { RouterView, RouterLink } from 'vue-router'
import { useAuthStore } from './stores/auth'
import { useToastStore } from './stores/toast'
import { computed } from 'vue'
import { useHead } from '@vueuse/head'

useHead({
  title: 'Sotto 频道目录 — 发现端到端加密的私密社区',
  meta: [
    { name: 'description', content: 'Sotto 频道目录 — 浏览、搜索、发现端到端加密的私密社区。' },
  ],
})

const auth = useAuthStore()
const toast = useToastStore()
const isLoggedIn = computed(() => auth.isLoggedIn)
const isAdmin = computed(() => auth.user?.role === 'admin')

const toastColors = {
  success: { bg: '#22c55e', color: '#fff' },
  error: { bg: '#ef4444', color: '#fff' },
  warn: { bg: '#f59e0b', color: '#fff' },
  info: { bg: '#3b82f6', color: '#fff' },
}
</script>

<template>
  <div class="app">
    <header class="nav">
      <div class="nav-inner">
        <RouterLink to="/" class="logo">
          <span class="logo-icon">🔒</span>
          Sotto<span class="logo-sub">频道目录</span>
        </RouterLink>
        <nav class="nav-links">
          <RouterLink to="/" class="nav-link">首页</RouterLink>
          <RouterLink v-if="isLoggedIn" to="/channels/submit" class="nav-link btn-primary">+ 提交频道</RouterLink>
          <RouterLink v-if="isLoggedIn" to="/me" class="nav-link">我的</RouterLink>
          <RouterLink v-if="isAdmin" to="/admin" class="nav-link nav-link-admin">审核后台</RouterLink>
          <RouterLink v-if="!isLoggedIn" to="/login" class="nav-link btn-primary">登录</RouterLink>
          <button v-if="isLoggedIn" class="nav-link btn-ghost" @click="auth.logout()">退出</button>
        </nav>
      </div>
    </header>

    <main class="main">
      <RouterView />
    </main>

    <footer class="footer">
      <p>Sotto 频道目录 — 发现端到端加密的私密社区</p>
      <p class="footer-sub">本目录只收录公开邀请链接频道 · 密令保护频道不在此展示</p>
      <div class="footer-legal">
        <RouterLink to="/privacy">隐私政策</RouterLink>
        <span>·</span>
        <RouterLink to="/terms">服务条款</RouterLink>
      </div>
    </footer>

    <!-- Toast Container -->
    <div class="toast-container">
      <TransitionGroup name="toast">
        <div
          v-for="t in toast.toasts"
          :key="t.id"
          class="toast"
          :style="{ background: toastColors[t.type]?.bg || toastColors.info.bg, color: toastColors[t.type]?.color || '#fff' }"
          @click="toast.dismiss(t.id)"
        >
          {{ t.message }}
        </div>
      </TransitionGroup>
    </div>
  </div>
</template>

<style>
.toast-container {
  position: fixed; top: 20px; right: 20px; z-index: 9999;
  display: flex; flex-direction: column; gap: 8px; pointer-events: none;
}
.toast {
  padding: 12px 20px; border-radius: 8px; font-size: 14px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15); cursor: pointer; pointer-events: auto;
  max-width: 360px; animation: toast-in 0.25s ease;
}
@keyframes toast-in { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
.toast-enter-active, .toast-leave-active { transition: all 0.25s ease; }
.toast-enter-from { opacity: 0; transform: translateX(20px); }
.toast-leave-to { opacity: 0; transform: translateX(20px); }

.footer-legal { margin-top: 12px; font-size: 12px; color: var(--text-muted); }
.footer-legal a { color: var(--text-muted); margin: 0 4px; text-decoration: none; }
.footer-legal a:hover { color: var(--accent); text-decoration: underline; }
</style>
