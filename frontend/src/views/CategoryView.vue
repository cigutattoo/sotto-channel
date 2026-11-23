<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { channelsApi } from '../api'

const route = useRoute()
const channels = ref([])
const loading = ref(true)
const categoryName = ref('')

async function load(slug) {
  loading.value = true
  try {
    const { data } = await channelsApi.list({ category_slug: slug, limit: 50 })
    channels.value = data
    categoryName.value = data[0]?.category_name || slug
  } catch {
    channels.value = []
  }
  loading.value = false
}

onMounted(() => load(route.params.slug))
watch(() => route.params.slug, (slug) => load(slug))
</script>

<template>
  <div>
    <router-link to="/categories" class="text-muted">← 返回分类浏览</router-link>
    <h1 class="section-title mt-4">{{ categoryName || '分类' }}</h1>

    <div v-if="loading" class="loading">加载中...</div>
    <div v-else-if="!channels.length" class="card text-center">
      <p class="text-muted">这个分类还没有频道</p>
      <router-link to="/channels/submit" class="btn btn-primary mt-4">+ 提交第一个</router-link>
    </div>
    <div v-else class="channel-grid">
      <router-link
        v-for="ch in channels"
        :key="ch.id"
        :to="`/channels/${ch.id}`"
        class="channel-card"
      >
        <div class="channel-card-title">{{ ch.name }}</div>
        <div class="channel-card-desc">{{ ch.description || '暂无描述' }}</div>
        <div class="channel-card-meta">
          <span class="channel-card-category">{{ ch.category_name }}</span>
          <span class="channel-card-stats">
            <span>👁 {{ ch.click_count || 0 }}</span>
          </span>
        </div>
      </router-link>
    </div>
  </div>
</template>
