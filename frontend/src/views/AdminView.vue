<script setup>
import { ref, onMounted } from 'vue'
import { adminApi } from '../api'

const stats = ref({})
const pending = ref([])
const rejectedReasons = ['content_policy', 'duplicate', 'spam', 'password_protected', 'other']
const rejectReasonMap = {
  content_policy: '违反内容政策',
  duplicate: '重复提交',
  spam: '疑似垃圾信息',
  password_protected: '密令保护（不收录）',
  other: '其他',
}

const loading = ref(true)
const actioning = ref(null) // channel id

async function load() {
  loading.value = true
  try {
    const [s, p] = await Promise.all([
      adminApi.stats().catch(() => ({ data: {} })),
      adminApi.pendingChannels().catch(() => ({ data: [] })),
    ])
    stats.value = s.data || {}
    pending.value = p.data || []
  } finally {
    loading.value = false
  }
}

async function approve(id) {
  actioning.value = id
  try {
    await adminApi.approveChannel(id)
    pending.value = pending.value.filter(c => c.id !== id)
  } finally {
    actioning.value = null
  }
}

async function reject(id) {
  const reason = prompt('拒绝原因 (content_policy / duplicate / spam / password_protected / other):', 'content_policy')
  if (!reason) return
  const detail = reason === 'other' ? prompt('详细说明:') : null
  actioning.value = id
  try {
    await adminApi.rejectChannel(id, { reason_code: reason, reason_text: detail })
    pending.value = pending.value.filter(c => c.id !== id)
  } finally {
    actioning.value = null
  }
}

onMounted(load)
</script>

<template>
  <div>
    <h1 class="section-title">🛠 审核后台</h1>

    <!-- Stats -->
    <div v-if="stats" class="gap-16 mb-8" style="flex-wrap:wrap">
      <div class="card" style="flex:1;min-width:150px;text-align:center">
        <div style="font-size:28px;font-weight:700">{{ stats.total_channels ?? '—' }}</div>
        <div class="text-muted" style="font-size:12px">总频道数</div>
      </div>
      <div class="card" style="flex:1;min-width:150px;text-align:center">
        <div style="font-size:28px;font-weight:700;color:var(--yellow)">{{ stats.pending_channels ?? '—' }}</div>
        <div class="text-muted" style="font-size:12px">待审核</div>
      </div>
      <div class="card" style="flex:1;min-width:150px;text-align:center">
        <div style="font-size:28px;font-weight:700;color:var(--accent)">{{ stats.approved_channels ?? '—' }}</div>
        <div class="text-muted" style="font-size:12px">已通过</div>
      </div>
      <div class="card" style="flex:1;min-width:150px;text-align:center">
        <div style="font-size:28px;font-weight:700">{{ stats.total_users ?? '—' }}</div>
        <div class="text-muted" style="font-size:12px">注册用户</div>
      </div>
    </div>

    <!-- Pending Channels -->
    <h2 class="section-title">📋 待审核频道</h2>
    <div v-if="loading" class="loading">加载中...</div>
    <div v-else-if="!pending.length" class="card text-center text-muted">
      所有频道都已处理 ✅
    </div>
    <div v-else class="card" style="padding:0;overflow-x:auto">
      <table class="admin-table">
        <thead>
          <tr>
            <th>频道名</th>
            <th>分类</th>
            <th>简介</th>
            <th>提交者</th>
            <th>提交时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="ch in pending" :key="ch.id">
            <td>
              <div><strong>{{ ch.name }}</strong></div>
              <div class="text-muted" style="font-size:12px">ID: {{ ch.id }}</div>
            </td>
            <td>{{ ch.category_name }}</td>
            <td style="max-width:280px">{{ (ch.description || '').slice(0, 120) }}</td>
            <td class="text-muted">{{ ch.owner?.email_masked || '—' }}</td>
            <td class="text-muted">{{ new Date(ch.created_at).toLocaleDateString('zh-CN') }}</td>
            <td>
              <div class="gap-8">
                <button class="btn btn-primary" style="padding:6px 12px;font-size:12px" :disabled="actioning===ch.id" @click="approve(ch.id)">
                  {{ actioning===ch.id ? '...' : '✅ 通过' }}
                </button>
                <button class="btn btn-danger" style="padding:6px 12px;font-size:12px" :disabled="actioning===ch.id" @click="reject(ch.id)">
                  ❌ 拒绝
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
