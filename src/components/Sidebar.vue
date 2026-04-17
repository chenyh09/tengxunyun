<template>
  <el-drawer v-model="visible" title="科研任务管理" direction="ltr" size="280px">
    <div class="drawer-content">
      <el-button type="primary" class="new-btn" :icon="Plus" plain>新建科研任务</el-button>
      <div class="section-label">最近检索/审查</div>
      <el-scrollbar height="calc(100vh - 200px)">
        <div v-for="i in 5" :key="i" class="nav-item">
          <el-icon>
            <Search v-if="i % 2 == 0" />
            <CircleCheck v-else />
          </el-icon>
          <span class="nav-title">{{ i % 2 == 0 ? '多路文献检索: LLM Agent' : '论文逻辑审查方案' }}</span>
        </div>
      </el-scrollbar>
    </div>
  </el-drawer>
</template>

<script setup>
import { computed } from 'vue'
import { Plus, Search, CircleCheck } from '@element-plus/icons-vue'

const props = defineProps({
  modelValue: Boolean
})

const emit = defineEmits(['update:modelValue'])

const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})
</script>

<style scoped>
.drawer-content {
  padding: 10px 0;
}

.new-btn {
  width: 100%;
  margin-bottom: 20px;
}

.section-label {
  font-size: 12px;
  color: #94a3b8;
  padding: 0 16px;
  margin-bottom: 10px;
  font-weight: 600;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.2s;
}

.nav-item:hover {
  background: #f1f5f9;
}

.nav-title {
  font-size: 13px;
  color: #475569;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}
</style>
