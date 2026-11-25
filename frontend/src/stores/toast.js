import { defineStore } from 'pinia'
import { ref } from 'vue'

let idCounter = 0

export const useToastStore = defineStore('toast', () => {
  const toasts = ref([])

  function show(message, type = 'info', duration = 4000) {
    const id = ++idCounter
    toasts.value.push({ id, message, type })
    if (duration > 0) {
      setTimeout(() => dismiss(id), duration)
    }
    return id
  }

  function success(message, duration = 3500) { return show(message, 'success', duration) }
  function error(message, duration = 6000) { return show(message, 'error', duration) }
  function warn(message, duration = 5000) { return show(message, 'warn', duration) }
  function info(message, duration = 4000) { return show(message, 'info', duration) }

  function dismiss(id) {
    const i = toasts.value.findIndex(t => t.id === id)
    if (i >= 0) toasts.value.splice(i, 1)
  }

  // 从 axios error 提取友好消息
  function fromError(err, fallback = '操作失败，请稍后重试') {
    const hint = err?.response?.data?.error?.hint
    const msg = err?.response?.data?.error?.message
    const status = err?.response?.status
    if (hint) return error(hint)
    if (msg && status !== 401) return error(msg)
    return error(fallback)
  }

  return { toasts, show, success, error, warn, info, dismiss, fromError }
})
