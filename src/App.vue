<template>
  <div class="app-wrapper">
    <Header />
    
    <Sidebar v-model="drawerVisible" />

    <el-container class="main-layout">
      <el-main class="chat-main">
        <ChatViewport 
          ref="chatViewportRef"
          :messages="messages"
          @quick-command="quickCommand"
        />

        <InputArea 
          v-model="userInput"
          :current-file="currentFile"
          :is-loading="isLoading"
          @send-message="handleSendMessage"
          @file-change="handleFileChange"
          @clear-file="handleClearFile"
          @quick-command="quickCommand"
        />
      </el-main>
    </el-container>
  </div>
</template>

<script setup>
import { ref, reactive, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { CREDENTIALS } from './config/secrets.js'
import { uploadFileToTencent, sendChatMessage } from './utils/api.js'
import Header from './components/Header.vue'
import Sidebar from './components/Sidebar.vue'
import ChatViewport from './components/ChatViewport.vue'
import InputArea from './components/InputArea.vue'

const drawerVisible = ref(false)
const userInput = ref('')
const currentFile = ref(null)
const isLoading = ref(false)
const chatViewportRef = ref(null)

const messages = reactive([
  { 
    role: 'assistant', 
    content: `您好，<b>${CREDENTIALS.USER_NAME}</b>。我是您的科研辅助智能体。您可以直接提问，或点击左下角回形针上传论文进行审查。`,
    loading: false
  }
])

const handleFileChange = (file) => {
  currentFile.value = file
  ElMessage.success(`已载入文件: ${file.name}，点击发送按钮开始审查`)
}

const sendMessage = async () => {
  if (!userInput.value.trim() && !currentFile.value) return
  
  const text = userInput.value
  const fileName = currentFile.value?.name || null
  
  messages.push({ role: 'user', content: text, fileName: fileName })
  userInput.value = ''
  
  const aiMsg = reactive({ role: 'assistant', content: '', loading: true })
  messages.push(aiMsg)
  
  await nextTick()
  chatViewportRef.value?.scrollToBottom()
  isLoading.value = true

  try {
    let docId = null
    
    if (currentFile.value) {
      aiMsg.content = "正在上传并解析科研文档，请稍候..."
      docId = await uploadFileToTencent(currentFile.value)
      if (!docId) {
        throw new Error("文档解析引擎启动失败，请检查网络或格式")
      }
      currentFile.value = null
    }

    const aiAnswer = await sendChatMessage(text, docId)
    aiMsg.content = aiAnswer
    aiMsg.loading = false

  } catch (error) {
    aiMsg.loading = false
    aiMsg.content = `<span style="color: #ef4444;">业务中断: ${error.message || '参数异常'}</span>`
  } finally {
    isLoading.value = false
    await nextTick()
    chatViewportRef.value?.scrollToBottom()
  }
}

const quickCommand = (cmd) => { userInput.value = cmd }

const handleEnter = (e) => {
  if (!e.shiftKey) sendMessage()
}

const handleSendMessage = (text) => {
  userInput.value = text
  sendMessage()
}

const handleClearFile = () => {
  currentFile.value = null
}
</script>

<style scoped>
.app-wrapper { 
  height: 100vh; 
  display: flex; 
  flex-direction: column; 
  background-color: #f8fafc; 
  overflow: hidden; 
}

.main-layout { 
  flex: 1; 
  overflow: hidden; 
}

.chat-main { 
  display: flex; 
  flex-direction: column; 
  padding: 0; 
  height: 100%; 
}
</style>
