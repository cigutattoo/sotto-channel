import { defineStore } from 'pinia'
import { ref } from 'vue'
import { categoriesApi, channelsApi } from '../api'

export const useCatalogStore = defineStore('catalog', () => {
  const categoriesTree = ref([])
  const hotChannels = ref([])
  const loading = ref(false)

  async function fetchCategories() {
    if (categoriesTree.value.length) return
    loading.value = true
    try {
      const { data } = await categoriesApi.tree()
      // 后端返回 { regions: [...] } 或直接数组
      categoriesTree.value = data.regions || data || []
    } finally {
      loading.value = false
    }
  }

  async function fetchHot() {
    try {
      const { data } = await channelsApi.hot()
      hotChannels.value = data
    } catch {}
  }

  return { categoriesTree, hotChannels, loading, fetchCategories, fetchHot }
})
