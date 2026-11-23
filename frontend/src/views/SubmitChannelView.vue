<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useCatalogStore } from '../stores/catalog'
import { channelsApi } from '../api'

const router = useRouter()
const catalog = useCatalogStore()

const form = ref({
  name: '',
  category_slug: '',
  description: '',
  join_type: 'invite_link',
  invite_url: '',
  language: '',
  member_count: null,
  tags: [],
  tagsInput: '',
})
const errorMsg = ref('')
const successMsg = ref('')
const loading = ref(false)

const categories = computed(() => {
  const list = []
  for (const region of catalog.categoriesTree) {
    for (const cat of region.children || []) {
      list.push({ slug: cat.slug, name: `${region.name} · ${cat.name}` })
    }
  }
  return list
})

onMounted(() => { catalog.fetchCategories() })

async function submit() {
  errorMsg.value = ''
  successMsg.value = ''

  // 前端基本校验（后端也有 zod 校验）
  if (!form.value.name || form.value.name.length < 2) {
    errorMsg.value = '频道名称至少 2 个字符'
    return
  }
  if (!form.value.category_slug) {
    errorMsg.value = '请选择一个分类'
    return
  }
  if (form.value.join_type === 'invite_link' && !form.value.invite_url) {
    errorMsg.value = '请填写公开邀请链接'
    return
  }

  loading.value = true
  try {
    const payload = {
      name: form.value.name.trim(),
      category_slug: form.value.category_slug,
      description: form.value.description.trim(),
      join_type: form.value.join_type,
      invite_url: form.value.join_type === 'invite_link' ? form.value.invite_url.trim() : null,
      language: form.value.language || null,
      member_count: form.value.member_count || null,
      tags: form.value.tagsInput
        .split(/[,，\s]+/)
        .map(t => t.trim())
        .filter(t => t.length > 0 && t.length <= 20)
        .slice(0, 10),
    }
    const { data } = await channelsApi.create(payload)
    successMsg.value = `提交成功！审核结果将通过邮件通知你。频道 ID: ${data.id}`
    form.value = { name: '', category_slug: '', description: '', join_type: 'invite_link', invite_url: '', language: '', member_count: null, tags: [], tagsInput: '' }
  } catch (e) {
    const code = e.response?.data?.error?.code
    const msg = e.response?.data?.error?.message
    if (code === 'CHANNEL_PASSWORD_PROTECTED') {
      errorMsg.value = '密令保护的频道不允许公开收录（这是硬性规定）。只有公开邀请链接频道可以被目录收录。'
    } else if (code === 'DAILY_LIMIT') {
      errorMsg.value = '今天提交次数已用完，明天再来吧'
    } else {
      errorMsg.value = msg || '提交失败'
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div>
    <h1 class="section-title">📝 提交频道</h1>
    <p class="text-muted mb-8">提交后将进入人工审核，审核结果通过邮件通知你。密令保护频道不参与公开收录。</p>

    <div v-if="errorMsg" class="alert alert-error">{{ errorMsg }}</div>
    <div v-if="successMsg" class="alert alert-success">
      {{ successMsg }}
      <router-link to="/me">查看我的提交 →</router-link>
    </div>

    <div class="card">
      <div class="form-group">
        <label class="form-label">频道名称 *</label>
        <input v-model="form.name" class="form-input" placeholder="例如: Tech & Privacy China" maxlength="80" />
      </div>

      <div class="form-group">
        <label class="form-label">分类 *</label>
        <select v-model="form.category_slug" class="form-select">
          <option value="">请选择分类...</option>
          <option v-for="c in categories" :key="c.slug" :value="c.slug">{{ c.name }}</option>
        </select>
      </div>

      <div class="form-group">
        <label class="form-label">频道简介 *</label>
        <textarea v-model="form.description" class="form-textarea" placeholder="简要描述频道内容、主题和适合人群..." maxlength="500"></textarea>
      </div>

      <div class="form-group">
        <label class="form-label">加入方式 *</label>
        <div class="gap-8">
          <label style="display:flex;align-items:center;gap:6px;cursor:pointer">
            <input type="radio" v-model="form.join_type" value="invite_link" />
            <span>公开邀请链接（可被目录收录）</span>
          </label>
          <label style="display:flex;align-items:center;gap:6px;cursor:pointer">
            <input type="radio" v-model="form.join_type" value="password_protected" disabled />
            <span style="color:var(--text-muted)">密令保护（不参与公开收录）</span>
          </label>
        </div>
      </div>

      <div v-if="form.join_type === 'invite_link'" class="form-group">
        <label class="form-label">公开邀请链接 *</label>
        <input v-model="form.invite_url" class="form-input" placeholder="https://sotto.app/invite/..." />
        <div class="form-hint">审核通过后用户点击即可一键加入 Sotto</div>
      </div>

      <div class="gap-16" style="display:grid;grid-template-columns:1fr 1fr">
        <div class="form-group">
          <label class="form-label">主要语言</label>
          <input v-model="form.language" class="form-input" placeholder="中文 / English" maxlength="30" />
        </div>
        <div class="form-group">
          <label class="form-label">成员数量（可选）</label>
          <input v-model.number="form.member_count" type="number" class="form-input" placeholder="如 500" min="0" />
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">标签（可选，用逗号分隔，最多 10 个）</label>
        <input v-model="form.tagsInput" class="form-input" placeholder="tech, privacy, cryptography" />
      </div>

      <button class="btn btn-primary" :disabled="loading" @click="submit">
        {{ loading ? '提交中...' : '提交审核' }}
      </button>
    </div>
  </div>
</template>
