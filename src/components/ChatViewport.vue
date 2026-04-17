<template>
  <div class="chat-viewport">
    <el-scrollbar ref="scrollbarRef">
      <div class="message-wrapper">
        <div v-if="messages.length <= 1" class="welcome-section">
          <el-icon :size="48" color="#d1d5db"><Compass /></el-icon>
          <h2>开启您的科研协作</h2>
          <p>支持多路文献检索、逻辑一致性审查及图表数据提取</p>
          <div class="guide-grid">
            <div class="guide-card" @click="$emit('quick-command', '帮我检索关于\'具身智能\'的最新跨学科论文')">
              <el-icon><Search /></el-icon> 检索前沿文献
            </div>
            <div class="guide-card" @click="$emit('quick-command', '请审查以下段落的逻辑严密性：')">
              <el-icon><CircleCheck /></el-icon> 逻辑审查
            </div>
          </div>
        </div>

        <div v-for="(msg, index) in messages" :key="index" :class="['message-row', msg.role]">
          <div class="avatar-area">
            <el-avatar 
              :size="36" 
              :src="msg.role === 'assistant' ? 'https://api.dicebear.com/7.x/bottts/svg?seed=Science' : `https://api.dicebear.com/7.x/avataaars/svg?seed=${msg.role}`"
            />
          </div>
          <div class="message-content">
            <div class="sender-info">
              <span class="name">{{ msg.role === 'assistant' ? '科研助手 AI' : 'Xiao Chen' }}</span>
            </div>
            <div class="bubble">
              <div v-if="msg.loading" class="typing-loader">
                <span></span><span></span><span></span>
              </div>
              <div v-else class="text-inner" v-html="renderMessageContent(msg.content)"></div>
              <div v-if="msg.fileName" class="file-attachment">
                <el-icon><Document /></el-icon> {{ msg.fileName }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </el-scrollbar>
  </div>
</template>

<script setup>
import { ref, nextTick } from 'vue'
import { Compass, Search, CircleCheck, Document } from '@element-plus/icons-vue'
import { marked } from 'marked'
import DOMPurify from 'dompurify'

defineProps({
  messages: {
    type: Array,
    default: () => []
  }
})

defineEmits(['quick-command', 'scroll-to-bottom'])

const scrollbarRef = ref(null)

marked.setOptions({
  gfm: true,
  breaks: true
})

const renderMessageContent = (content) => {
  const raw = typeof content === 'string' ? content : String(content ?? '')
  const html = marked.parse(raw)
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    ALLOWED_TAGS: [
      'a',
      'b',
      'blockquote',
      'br',
      'code',
      'del',
      'div',
      'em',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'hr',
      'i',
      'img',
      'li',
      'ol',
      'p',
      'pre',
      'span',
      'strong',
      'ul'
    ],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'src', 'alt', 'title']
  })
}

const scrollToBottom = () => {
  if (scrollbarRef.value) {
    nextTick(() => {
      const scrollEl = scrollbarRef.value.$el.querySelector('.el-scrollbar__wrap')
      if (scrollEl) {
        scrollEl.scrollTop = scrollEl.scrollHeight
      }
    })
  }
}

defineExpose({ scrollToBottom })
</script>

<style scoped>
.chat-viewport {
  flex: 1;
  overflow: hidden;
}

.message-wrapper {
  max-width: 860px;
  margin: 0 auto;
  padding: 40px 20px 120px;
}

.welcome-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  text-align: center;
  color: #64748b;
}

.welcome-section h2 {
  margin: 20px 0 10px;
  color: #1e293b;
  font-size: 24px;
}

.guide-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-top: 30px;
  max-width: 500px;
}

.guide-card {
  padding: 20px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.3s;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  font-size: 13px;
}

.guide-card:hover {
  background: #f1f5f9;
  border-color: #cbd5e0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.message-row {
  display: flex;
  gap: 14px;
  margin-bottom: 30px;
}

.message-row.user {
  flex-direction: row-reverse;
}

.message-content {
  flex: 1;
}

.sender-info {
  margin-bottom: 8px;
}

.name {
  font-size: 12px;
  color: #94a3b8;
  font-weight: 500;
}

.bubble {
  padding: 12px 18px;
  border-radius: 12px;
  line-height: 1.6;
  font-size: 14px;
}

.assistant .bubble {
  background: #fff;
  border: 1px solid #e2e8f0;
  color: #1e293b;
  border-top-left-radius: 2px;
}

.user .bubble {
  background: #2563eb;
  color: #fff;
  border-top-right-radius: 2px;
}

.text-inner {
  white-space: normal;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.text-inner :deep(p) {
  margin: 6px 0;
}

.text-inner :deep(ol),
.text-inner :deep(ul) {
  margin: 8px 0;
  padding-left: 1.4em;
}

.text-inner :deep(li) {
  margin: 4px 0;
}

.text-inner :deep(ol > li)::marker {
  font-variant-numeric: tabular-nums;
}

/* 让 “**作者：** xxx / **年份：** yyyy” 这种 label-value 更整齐 */
.text-inner :deep(li > strong:first-child) {
  display: inline-block;
  min-width: 4.5em;
}

.text-inner :deep(pre) {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  margin: 8px 0;
}

.text-inner :deep(a) {
  text-decoration: underline;
}

.file-attachment {
  margin-top: 8px;
  font-size: 12px;
  color: #64748b;
  background: rgba(0, 0, 0, 0.05);
  padding: 4px 8px;
  border-radius: 4px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.typing-loader {
  display: flex;
  align-items: center;
  height: 20px;
}

.typing-loader span {
  width: 6px;
  height: 6px;
  background: #cbd5e0;
  display: inline-block;
  border-radius: 50%;
  margin: 0 2px;
  animation: typing 1s infinite;
}

.typing-loader span:nth-child(2) {
  animation-delay: 0.2s;
}

.typing-loader span:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes typing {
  0%, 100% {
    opacity: 0.3;
  }
  50% {
    opacity: 1;
  }
}
</style>
