<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import { useHead } from '@vueuse/head'
import { channelsApi } from '../api'
import { useAuthStore } from '../stores/auth'
import { useToastStore } from '../stores/toast'

const route = useRoute()
const auth = useAuthStore()
const toast = useToastStore()
const channel = ref(null)
const loading = ref(true)
const notFound = ref(false)

// Report dialog state
const showReport = ref(false)
const reporting = ref(false)
const reportCode = ref('CONTENT_VIOLATION')
const reportText = ref('')
const reported = ref(false)

const reasonOptions = [
  { v: 'CONTENT_VIOLATION', l: '内容违规' },
  { v: 'SPAM', l: '垃圾信息' },
  { v: 'INVALID_LINK', l: '无效邀请链接' },
  { v: 'MISLEADING', l: '误导信息' },
  { v: 'COPYRIGHT', l: '侵权' },
  { v: 'HARASSMENT', l: '骚扰' },
  { v: 'OTHER', l: '其他' },
]

const reasonLabel = computed(() => reasonOptions.find(r => r.v === reportCode.value)?.l || '举报')

onMounted(async () => {
  try {
    const { data } = await channelsApi.get(route.params.id)
    channel.value = data
    // 记录 view_count (详情页加载 = view)
    try { await channelsApi.click(route.params.id) } catch {}
  } catch (e) {
    if (e.response?.status === 404) notFound.value = true
  }
  loading.value = false
})

// SEO
useHead({
  title: () => channel.value ? `${channel.value.name} — Sotto 频道目录` : '频道详情',
  meta: () => channel.value ? [
    { name: 'description', content: channel.value.description?.slice(0, 160) || 'Sotto 频道详情' },
  ] : [],
})

function joinUrl() {
  const c = channel.value
  if (!c) return 'sotto://'
  if (c.join_type === 'invite_link') return c.invite_url || `sotto://channel/${c.id}`
  return `sotto://channel/${c.id}`
}

async function submitReport() {
  if (!auth.isLoggedIn) {
    toast.warn('请先登录后再举报')
    return
  }
  reporting.value = true
  try {
    await channelsApi.report(channel.value.id, { reason_code: reportCode.value, reason_text: reportText.value || undefined })
    reported.value = true
    toast.success('举报已提交，Admin 会尽快处理')
    showReport.value = false
  } catch (err) {
    toast.fromError(err, '举报失败，请稍后重试')
  } finally {
    reporting.value = false
  }
}
</script>

<template>
  <div v-if="loading" class="loading">加载中...</div>
  <div v-else-if="notFound" class="card text-center">
    <h2>频道不存在</h2>
    <p class="text-muted mt-4">该频道可能已被审核拒绝或下架。</p>
    <router-link to="/" class="btn mt-4">返回首页</router-link>
  </div>
  <div v-else-if="channel" class="channel-detail">
    <router-link to="/" class="text-muted">← 返回目录</router-link>

    <div class="card mt-4">
      <div class="gap-16" style="justify-content:space-between;align-items:flex-start">
        <div>
          <h1 class="section-title" style="margin-bottom:4px">
            {{ channel.name }}
            <span v-if="channel.is_verified" class="badge badge-verified">✓ 已认证</span>
          </h1>
          <p class="text-muted">{{ channel.category_name }} · 提交于 {{ new Date(channel.created_at).toLocaleDateString('zh-CN') }}</p>
        </div>
        <div class="channel-card-stats" style="font-size:14px;color:var(--text-secondary)">
          <span>👁 {{ channel.click_count || 0 }} 次点击</span>
          <span>📝 {{ channel.view_count || 0 }} 次展示</span>
        </div>
      </div>

      <p class="mt-8" style="line-height:1.8">{{ channel.description || '暂无频道描述。' }}</p>

      <!-- Meta -->
      <div class="mt-8 gap-16" style="flex-wrap:wrap">
        <div v-if="channel.language" class="text-muted">🌐 语言: {{ channel.language }}</div>
        <div v-if="channel.member_count" class="text-muted">👥 成员: {{ channel.member_count }}</div>
        <div v-if="channel.tags?.length" class="gap-8">
          <span v-for="t in channel.tags" :key="t" class="badge" style="background:var(--bg-hover);color:var(--text-secondary)">#{{ t }}</span>
        </div>
      </div>

      <!-- Join Button -->
      <div class="mt-8 flex-center" style="flex-direction:column;gap:12px">
        <a :href="joinUrl()" class="btn btn-primary" style="font-size:16px;padding:14px 32px">
          🔒 一键加入 Sotto
        </a>
        <p class="text-muted" style="font-size:12px">
          需要已安装 Sotto App · 通过 Sotto 深链跳转
        </p>
      </div>
    </div>

    <!-- Submitter Info -->
    <div v-if="channel.submitter" class="card mt-4">
      <div class="text-muted" style="font-size:12px;margin-bottom:4px">提交者</div>
      <div>{{ channel.submitter.email_masked || '匿名用户' }}</div>
    </div>

    <!-- Report Button + Dialog -->
    <div class="card mt-4">
      <div v-if="reported" class="text-muted" style="font-size:13px">✓ 已举报，感谢反馈</div>
      <div v-else>
        <button class="btn btn-ghost" style="color:var(--text-muted);border-color:var(--border)" @click="showReport = !showReport">
          🚩 举报此频道
        </button>

        <div v-if="showReport" class="mt-4" style="padding:16px;background:var(--bg-hover);border-radius:8px">
          <div class="text-muted" style="font-size:13px;margin-bottom:12px">请选择举报原因：</div>
          <select v-model="reportCode" class="input" style="margin-bottom:12px">
            <option v-for="r in reasonOptions" :key="r.v" :value="r.v">{{ r.l }}</option>
          </select>
          <textarea v-model="reportText" class="input" rows="3" style="margin-bottom:12px"
            placeholder="补充说明（可选，最多 500 字）" maxlength="500"></textarea>
          <div class="gap-16" style="justify-content:flex-end">
            <button class="btn btn-ghost" @click="showReport = false">取消</button>
            <button class="btn" :disabled="reporting" @click="submitReport">
              {{ reporting ? '提交中...' : '提交举报' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
