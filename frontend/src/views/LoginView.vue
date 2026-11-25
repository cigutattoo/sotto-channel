<script setup>
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { authApi } from '../api'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const step = ref('email') // 'email' | 'code'
const email = ref('')
const code = ref('')
const loading = ref(false)
const errorMsg = ref('')
const successMsg = ref('')
const countdown = ref(0)
let timer = null

const isCodeValid = computed(() => /^\d{6}$/.test(code.value))

async function sendCode() {
  if (!email.value) return
  errorMsg.value = ''
  successMsg.value = ''
  loading.value = true
  try {
    const { data } = await authApi.sendCode(email.value.trim())
    successMsg.value = `验证码已发送至 ${data.sent_to}，请查收邮件。`
    step.value = 'code'
    startCountdown()
  } catch (e) {
    errorMsg.value = e.response?.data?.error?.message || '发送失败，请稍后重试'
  } finally {
    loading.value = false
  }
}

async function resendCode() {
  errorMsg.value = ''
  successMsg.value = ''
  loading.value = true
  try {
    const { data } = await authApi.resendCode(email.value.trim())
    successMsg.value = `验证码已重新发送至 ${data.sent_to}`
    startCountdown()
  } catch (e) {
    errorMsg.value = e.response?.data?.error?.message || '发送失败'
  } finally {
    loading.value = false
  }
}

async function verifyCode() {
  errorMsg.value = ''
  if (!isCodeValid.value) {
    errorMsg.value = '请输入 6 位数字验证码'
    return
  }
  loading.value = true
  try {
    await auth.login(email.value.trim(), code.value)
    const redirect = route.query.redirect || '/'
    router.push(redirect)
  } catch (e) {
    const msg = e.response?.data?.error?.message
    if (e.response?.data?.error?.code === 'CODE_INVALID') {
      errorMsg.value = msg || '验证码错误'
    } else if (e.response?.data?.error?.code === 'CODE_EXPIRED') {
      errorMsg.value = '验证码已过期，请重新发送'
    } else {
      errorMsg.value = msg || '登录失败'
    }
    loading.value = false
  }
}

function startCountdown() {
  countdown.value = 60
  if (timer) clearInterval(timer)
  timer = setInterval(() => {
    countdown.value--
    if (countdown.value <= 0) clearInterval(timer)
  }, 1000)
}
</script>

<template>
  <div class="login-wrapper">
    <div class="login-title">🔒 登录 Sotto 频道目录</div>
    <p class="login-subtitle">通过邮箱验证码登录 · 无需密码</p>

    <div v-if="errorMsg" class="alert alert-error">{{ errorMsg }}</div>
    <div v-if="successMsg" class="alert alert-success">{{ successMsg }}</div>

    <!-- Step 1: Email -->
    <div v-if="step === 'email'">
      <div class="form-group">
        <label class="form-label">邮箱地址</label>
        <input
          v-model="email"
          type="email"
          class="form-input"
          placeholder="your@email.com"
          @keyup.enter="sendCode"
          :disabled="loading"
        />
        <div class="form-hint">我们会向你的邮箱发送 6 位验证码</div>
      </div>
      <button
        class="btn btn-primary"
        style="width:100%"
        :disabled="!email || loading"
        @click="sendCode"
      >
        {{ loading ? '发送中...' : '发送验证码' }}
      </button>
    </div>

    <!-- Step 2: Code -->
    <div v-else>
      <div class="form-group">
        <label class="form-label">验证码已发送至 {{ email }}</label>
        <input
          v-model="code"
          type="text"
          inputmode="numeric"
          maxlength="6"
          class="form-input code-input"
          placeholder="000000"
          @keyup.enter="verifyCode"
          :disabled="loading"
          autofocus
        />
      </div>
      <button
        class="btn btn-primary"
        style="width:100%"
        :disabled="!isCodeValid || loading"
        @click="verifyCode"
      >
        {{ loading ? '验证中...' : '登录 / 注册' }}
      </button>
      <div class="text-center mt-4" style="display:flex;justify-content:space-between">
        <button class="btn-ghost" style="background:none;border:none;color:var(--blue);cursor-pointer;font-size:13px" @click="step='email'">← 换个邮箱</button>
        <button
          class="btn-ghost"
          style="background:none;border:none;color:var(--blue);cursor-pointer;font-size:13px"
          :disabled="countdown > 0"
          @click="resendCode"
        >
          {{ countdown > 0 ? `重新发送 (${countdown}s)` : '重新发送验证码' }}
        </button>
      </div>
    </div>
  </div>
</template>
