<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import { channelsApi } from '../api'
import { useAuthStore } from '../stores/auth'

const route = useRoute()
const auth = useAuthStore()
const channel = ref(null)
const loading = ref(true)
const notFound = ref(false)

onMounted(async () => {
  try {
    const { data } = await channelsApi.get(route.params.id)
    channel.value = data
    // 记录点击
    channelsApi.click(route.params.id).catch(() => {})
  } catch (e) {
    if (e.response?.status === 404) notFound.value = true
  }
  loading.value = false
})

function joinUrl() {
  const c = channel.value
  if (!c) return 'sotto://'
  // Sotto deep link — 根据 join_type 生成
  if (c.join_type === 'invite_link') {
    // invite_url 应该包含 Sotto 的邀请链接
    return c.invite_url || `sotto://channel/${c.id}`
  }
  return `sotto://channel/${c.id}`
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
  </div>
</template>
