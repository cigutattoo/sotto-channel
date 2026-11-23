<script setup>
import { RouterLink } from 'vue-router'
</script>

<template>
  <div class="text-center" style="padding:80px 20px">
    <div style="font-size:80px">🔒</div>
    <h1 style="font-size:32px;margin:16px 0">页面未找到</h1>
    <p class="text-muted">你要找的页面可能不存在或已被移除</p>
    <router-link to="/" class="btn btn-primary mt-8">返回首页</router-link>
  </div>
</template>
