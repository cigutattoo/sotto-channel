<script setup>
import { ref, onMounted } from 'vue'
import { useCatalogStore } from '../stores/catalog'

const catalog = useCatalogStore()

onMounted(() => { catalog.fetchCategories() })
</script>

<template>
  <div>
    <h1 class="section-title">浏览分类</h1>
    <p class="text-muted mb-8">选择地区 + 主题组合，发现更多 Sotto 频道</p>

    <div v-if="catalog.loading" class="loading">加载中...</div>

    <div v-else class="categories">
      <template v-for="region in catalog.categoriesTree" :key="region.slug">
        <h2 class="section-title mt-8">{{ region.name }}</h2>
        <div class="category-grid">
          <router-link
            v-for="cat in region.children"
            :key="cat.slug"
            :to="`/category/${cat.slug}`"
            class="category-pill"
          >
            {{ cat.name }}
          </router-link>
        </div>
      </template>
    </div>
  </div>
</template>
