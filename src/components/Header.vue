<template>
  <header class="glass-header">
    <div class="header-left">
      <el-button :icon="Menu" circle @click="$emit('toggleDrawer')" />
      <div class="logo">
        <span class="title">AcademicFlow <small>跨领域科研学术辅助</small></span>
      </div>
    </div>
    <div class="user-status">
      <el-tag size="small" effect="plain" type="info">科研知识库已就绪</el-tag>
      <el-divider direction="vertical" />
      <span class="user-name">{{ userName }}</span>
      <el-avatar :size="32" :src="`https://api.dicebear.com/7.x/avataaars/svg?seed=${userName}`" />
    </div>
  </header>
</template>

<script setup>
import { Menu } from '@element-plus/icons-vue'
import { CREDENTIALS } from '../config/secrets.js'

defineProps({
  userName: {
    type: String,
    default: CREDENTIALS.USER_NAME
  }
})

defineEmits(['toggleDrawer'])
</script>

<style scoped>
.glass-header {
  height: 56px;
  background: #ffffff;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.logo {
  display: flex;
  align-items: center;
}

.title {
  font-weight: 600;
  font-size: 16px;
  color: #1e293b;
}

.title small {
  font-weight: 400;
  color: #64748b;
  margin-left: 10px;
}

.user-status {
  display: flex;
  align-items: center;
  gap: 12px;
}

.user-name {
  font-size: 13px;
  color: #475569;
}
</style>
