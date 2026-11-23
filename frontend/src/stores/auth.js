import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authApi, meApi } from '../api'

export const useAuthStore = defineStore('auth', () => {
  const isInitialized = ref(false)
  const user = ref(null) // { id, email, email_masked, email_verified, role, status, created_at }
  const loading = ref(false)

  const isLoggedIn = computed(() => !!user.value?.email_verified)
  const isAdmin = computed(() => user.value?.role === 'admin')

  async function init() {
    if (isInitialized.value) return
    isInitialized.value = true
    try {
      const { data } = await meApi.get()
      user.value = data
    } catch {
      // 401 or network → stay logged out
    }
  }

  async function login(email, code) {
    loading.value = true
    try {
      const { data } = await authApi.verifyCode(email, code)
      // verify-code 成功后 session_token cookie 已设置
      // 再拉一次 /me 获取用户信息
      const me = await meApi.get()
      user.value = me.data
      return data
    } finally {
      loading.value = false
    }
  }

  async function logout() {
    loading.value = true
    try {
      await authApi.logout()
    } catch {}
    user.value = null
    loading.value = false
  }

  function clear() {
    user.value = null
  }

  return { isInitialized, user, loading, isLoggedIn, isAdmin, init, login, logout, clear }
})
