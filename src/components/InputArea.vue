<template>
  <div class="input-wrapper">
    <div class="input-card">
      <div class="action-bar">
        <div class="tags">
          <el-button size="small" bg text round :icon="Search" @click="$emit('quick-command', '进行多路文献检索：')">文献搜索</el-button>
          <el-button size="small" bg text round :icon="CircleCheck" @click="$emit('quick-command', '对以下内容进行逻辑审查：')">逻辑审查</el-button>
          <el-button size="small" bg text round :icon="DataLine" @click="$emit('quick-command', '从图中提取实验数据：')">图表提取</el-button>
        </div>
        <div class="upload-area">
          <el-tag v-if="currentFile" closable @close="handleClearFile" size="small" type="success" class="file-tag">
            <span class="file-name">{{ currentFile.name }}</span>
          </el-tag>
          <el-upload
            :key="uploadKey"
            ref="uploadRef"
            action="#"
            :auto-upload="false"
            :show-file-list="false"
            :disabled="Boolean(currentFile) || isLoading"
            @change="handleFileChange"
          >
            <el-button size="small" circle :icon="Paperclip" :type="currentFile ? 'primary' : 'default'" title="上传待审查文档" />
          </el-upload>
        </div>
      </div>
      
      <el-input
        v-model="userInput"
        type="textarea"
        :autosize="{ minRows: 1, maxRows: 8 }"
        placeholder="请输入科研指令，或粘贴论文段落..."
        resize="none"
        @keydown.enter.prevent="handleEnter"
      />
      
      <div class="bottom-bar">
        <span class="hint">按 Enter 发送指令 · 跨领域科研知识库已连接</span>
        <el-button 
          type="primary" 
          :icon="Promotion" 
          :disabled="!userInput.trim() && !currentFile" 
          :loading="isLoading"
          circle 
          @click="$emit('send-message', userInput)"
        />
      </div>
    </div>
    <p class="footer-notice">AI 生成内容仅供参考，请结合实验原始数据进行科研判断</p>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { Search, CircleCheck, DataLine, Promotion, Paperclip } from '@element-plus/icons-vue'

const props = defineProps({
  modelValue: String,
  currentFile: Object,
  isLoading: Boolean
})

const emit = defineEmits(['update:modelValue', 'send-message', 'clear-file', 'file-change', 'quick-command'])

const userInput = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

const uploadRef = ref(null)
const uploadKey = ref(0)

const resetUpload = () => {
  uploadRef.value?.clearFiles?.()
  uploadKey.value += 1
}

const handleFileChange = (file) => {
  emit('file-change', file.raw)
}

const handleClearFile = () => {
  emit('clear-file')
  resetUpload()
}

watch(
  () => props.currentFile,
  (val) => {
    if (!val) resetUpload()
  }
)

const handleEnter = (e) => {
  if (!e.shiftKey) {
    emit('send-message', userInput.value)
  }
}
</script>

<style scoped>
.input-wrapper {
  padding: 20px;
  background: linear-gradient(to top, #f8fafc 70%, rgba(248, 250, 252, 0));
  flex-shrink: 0;
}

.input-card {
  max-width: 860px;
  margin: 0 auto;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  padding: 12px;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05);
}

.action-bar {
  display: flex;
  justify-content: space-between;
  margin-bottom: 10px;
  align-items: center;
  gap: 10px;
}

.tags {
  display: flex;
  gap: 8px;
  flex: 1;
}

.upload-area {
  display: flex;
  align-items: center;
  gap: 8px;
}

.file-tag {
  max-width: 220px;
}

.file-name {
  display: inline-block;
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: bottom;
}

.bottom-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 10px;
}

.hint {
  font-size: 11px;
  color: #94a3b8;
}

.footer-notice {
  text-align: center;
  font-size: 11px;
  color: #cbd5e0;
  margin-top: 12px;
}
</style>
