<script setup>
import { ref, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth'
import { meApi } from '../api'

const auth = useAuthStore()
const myChannels = ref([])
const loadingChannels = ref(true)

onMounted(async () => {
  if (auth.isLoggedIn) {
    try {
      const { data } = await meApi.myChannels()
      myChannels.value = data
    } catch {}
    loadingChannels.value = false
  }
})

function statusBadge(status) {
  switch (status) {
    case 'approved': return { text: '已通过', cls: 'badge-verified' }
    case 'pending_audit': return { text: '审核中', cls: 'badge-pending' }
    case 'rejected': return { text: '已拒绝', cls: 'badge-rejected' }
    case 'suspended': return { text: '已暂停', cls: 'badge-rejected' }
    default: return { text: status, cls: '' }
  }
}
</script>

<template>
  <div v-if="!auth.isLoggedIn" class="login-wrapper text-center">
    <p>请先 <router-link to="/login">登录</router-link> 查看个人中心</p>
  </div>
  <div v-else>
    <h1 class="section-title">👤 我的账户</h1>

    <div class="card mb-8">
      <div class="gap-16" style="justify-content:space-between;align-items:center">
        <div>
          <p><strong>邮箱:</strong> {{ auth.user?.email_masked }}</p>
          <p class="text-muted"><strong>ID:</strong> {{ auth.user?.id }}</p>
          <div class="mt-4 gap-8">
            <span v-if="auth.isAdmin" class="badge badge-admin">管理员</span>
            <span v-if="auth.user?.status === 'banned'" class="badge badge-banned">已封禁</span>
            <span v-if="auth.user?.email_verified" class="badge badge-verified">邮箱已验证</span>
          </div>
        </div>
        <button class="btn btn-ghost" @click="auth.logout()">退出登录</button>
      </div>
    </div>

    <h2 class="section-title">📝 我的提交</h2>
    <div v-if="loadingChannels" class="loading">加载中...</div>
    <div v-else-if="!myChannels.length" class="card text-center text-muted">
      还没有提交过频道
      <div class="mt-4"><router-link to="/channels/submit" class="btn btn-primary">+ 提交频道</router-link></div>
    </div>
    <div v-else class="card" style="padding:0;overflow-x:auto">
      <table class="admin-table">
        <thead>
          <tr>
            <th>频道</th>
            <th>分类</th>
            <th>状态</th>
            <th>提交时间</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="ch in myChannels" :key="ch.id">
            <td>
              <router-link v-if="ch.status === 'approved'" :to="`/channels/${ch.id}`">{{ ch.name }}</router-link>
              <span v-else>{{ ch.name }}</span>
            </td>
            <td class="text-muted">{{ ch.category_name }}</td>
            <td>
              <span class="badge" :class="statusBadge(ch.status).cls">{{ statusBadge(ch.status).text }}</span>
              <span v-if="ch.status === 'rejected' && ch.reject_reason" class="text-muted" style="margin-left:8px;font-size:12px">
                {{ ch.reject_reason }}
              </span>
            </td>
            <td class="text-muted">{{ new Date(ch.created_at).toLocaleDateString('zh-CN') }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
