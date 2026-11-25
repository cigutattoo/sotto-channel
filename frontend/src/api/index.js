import axios from 'axios'
import { useAuthStore } from '../stores/auth'

// 生产: Vite 构建时注入 __API_BASE__ (或 Cloudflare Pages Function 代理 /api/*)
// 开发: vite proxy /api → localhost:3000
const baseURL = import.meta.env.VITE_API_BASE || '/api'

const api = axios.create({
  baseURL,
  timeout: 30000,
  withCredentials: true, // cookie-based session
})

// Response interceptor
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      // 未认证 → 清除本地状态
      try { useAuthStore().clear() } catch {}
    }
    return Promise.reject(err)
  }
)

// --- Auth ---
export const authApi = {
  sendCode: (email) => api.post('/auth/send-code', { email }),
  verifyCode: (email, code) => api.post('/auth/verify-code', { email, code }),
  resendCode: (email) => api.post('/auth/resend-code', { email }),
  logout: () => api.post('/logout'),
}

// --- Me ---
export const meApi = {
  get: () => api.get('/me'),
  update: (data) => api.patch('/me', data),
  myChannels: () => api.get('/channels/mine'),
}

// --- Categories ---
export const categoriesApi = {
  tree: () => api.get('/categories/tree'),
}

// --- Channels (public) ---
export const channelsApi = {
  list: (params = {}) => api.get('/channels', { params }),
  get: (id) => api.get(`/channels/${id}`),
  hot: () => api.get('/channels/hot'),
  create: (data) => api.post('/channels', data),
  click: (id) => api.post(`/channels/${id}/click`),
  report: (id, { reason_code, reason_text }) => api.post(`/channels/${id}/report`, { reason_code, reason_text }),
}

// --- Admin ---
export const adminApi = {
  pendingChannels: () => api.get('/admin/pending/channels'),
  approveChannel: (id) => api.post(`/admin/channels/${id}/approve`),
  batchApprove: (ids) => api.post('/admin/channels/batch-approve', { ids }),
  rejectChannel: (id, data) => api.post(`/admin/channels/${id}/reject`, data),
  batchReject: (ids, reason_code, reason_text) => api.post('/admin/channels/batch-reject', { ids, reason_code, reason_text }),
  reports: (status = 'pending') => api.get('/admin/reports', { params: { status } }),
  users: () => api.get('/admin/users'),
  setRole: (userId, role) => api.post(`/admin/users/${userId}/role`, { role }),
  banUser: (userId, banned) => api.post(`/admin/users/${userId}/ban`, { banned }),
  stats: () => api.get('/admin/stats'),
}

export default api
