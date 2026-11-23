<script setup>
import { ref, onMounted } from 'vue'
import { useCatalogStore } from '../stores/catalog'
import { channelsApi } from '../api'

const catalog = useCatalogStore()
const channels = ref([])
const loading = ref(true)

onMounted(async () => {
  await Promise.all([
    catalog.fetchCategories(),
    catalog.fetchHot(),
    (async () => {
      try {
        const { data } = await channelsApi.list({ limit: 24, sort: 'recent' })
        channels.value = data
      } catch {}
      loading.value = false
    })(),
  ])
})
</script>

<template>
  <div>
    <!-- Hero -->
    <section class="hero">
      <h1>发现 Sotto 频道</h1>
      <p>端到端加密的私密社区目录 · 按地区和主题浏览 · 一键加入 Sotto App</p>
    </section>

    <!-- Hot Channels -->
    <section v-if="catalog.hotChannels.length" class="mb-8">
      <h2 class="section-title">🔥 热门频道</h2>
      <div class="channel-grid">
        <router-link
          v-for="ch in catalog.hotChannels"
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
    </section>

    <!-- Quick Browse: Regions -->
    <section v-if="catalog.categoriesTree.length" class="mb-8">
      <h2 class="section-title">🌍 按地区浏览</h2>
      <div class="category-grid">
        <router-link
          v-for="region in catalog.categoriesTree"
          :key="region.slug"
          :to="`/categories`"
          class="category-pill"
        >
          {{ region.name }}
          <span class="count">{{ region.children?.length || 0 }} 分类</span>
        </router-link>
      </div>
    </section>

    <!-- Recent Channels -->
    <section>
      <h2 class="section-title">🆕 最新收录</h2>
      <div v-if="loading" class="loading">加载中...</div>
      <div v-else-if="!channels.length" class="loading text-muted">
        暂时没有频道 · <router-link to="/channels/submit">成为第一个提交者</router-link>
      </div>
      <div v-else class="channel-grid">
        <router-link
          v-for="ch in channels"
          :key="ch.id"
          :to="`/channels/${ch.id}`"
          class="channel-card"
        >
          <div class="channel-card-title">
            {{ ch.name }}
            <span v-if="ch.is_verified" class="badge badge-verified">✓</span>
          </div>
          <div class="channel-card-desc">{{ ch.description || '暂无描述' }}</div>
          <div class="channel-card-meta">
            <span class="channel-card-category">{{ ch.category_name }}</span>
            <span class="channel-card-stats">
              <span>👁 {{ ch.click_count || 0 }}</span>
            </span>
          </div>
        </router-link>
      </div>
    </section>
  </div>
</template>
