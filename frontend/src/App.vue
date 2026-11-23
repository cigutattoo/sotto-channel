<script setup>
import { RouterView, RouterLink } from 'vue-router'
import { useAuthStore } from './stores/auth'
import { computed } from 'vue'

const auth = useAuthStore()
const isLoggedIn = computed(() => auth.isLoggedIn)
const isAdmin = computed(() => auth.user?.role === 'admin')
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
    </footer>
  </div>
</template>
