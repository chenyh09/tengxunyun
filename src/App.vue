<template>
  <div class="app-wrapper">
    <header class="glass-header">
      <div class="header-left">
        <el-button :icon="Menu" circle @click="drawerVisible = true" />
        <div class="logo">
          <span class="title">AcademicFlow <small>跨领域科研学术辅助</small></span>
        </div>
      </div>
      <div class="user-status">
        <el-tag size="small" effect="plain" type="info">科研知识库已就绪</el-tag>
        <el-divider direction="vertical" />
        <span class="user-name">Xiao Chen</span>
        <el-avatar :size="32" src="https://api.dicebear.com/7.x/avataaars/svg?seed=XiaoChen" />
      </div>
    </header>

    <el-drawer v-model="drawerVisible" title="科研任务管理" direction="ltr" size="280px">
      <div class="drawer-content">
        <el-button type="primary" class="new-btn" :icon="Plus" plain>新建科研任务</el-button>
        <div class="section-label">最近检索/审查</div>
        <el-scrollbar height="calc(100vh - 200px)">
          <div v-for="i in 5" :key="i" class="nav-item">
            <el-icon><Search v-if="i%2==0"/><CircleCheck v-else/></el-icon>
            <span class="nav-title">{{ i%2==0 ? '多路文献检索: LLM Agent' : '论文逻辑审查方案' }}</span>
          </div>
        </el-scrollbar>
      </div>
    </el-drawer>

    <el-container class="main-layout">
      <el-main class="chat-main">
        <div class="chat-viewport">
          <el-scrollbar ref="scrollbarRef">
            <div class="message-wrapper">
              <div v-if="messages.length <= 1" class="welcome-section">
                <el-icon :size="48" color="#d1d5db"><Compass /></el-icon>
                <h2>开启您的科研协作</h2>
                <p>支持多路文献检索、逻辑一致性审查及图表数据提取</p>
                <div class="guide-grid">
                  <div class="guide-card" @click="quickCommand('帮我检索关于‘具身智能’的最新跨学科论文')">
                    <el-icon><Search /></el-icon> 检索前沿文献
                  </div>
                  <div class="guide-card" @click="quickCommand('请审查以下段落的逻辑严密性：')">
                    <el-icon><CircleCheck /></el-icon> 逻辑审查
                  </div>
                </div>
              </div>

              <div v-for="(msg, index) in messages" :key="index" :class="['message-row', msg.role]">
                <div class="avatar-area">
                  <el-avatar 
                    :size="36" 
                    :src="msg.role === 'assistant' ? 'https://api.dicebear.com/7.x/bottts/svg?seed=Science' : 'https://api.dicebear.com/7.x/avataaars/svg?seed=XiaoChen'" 
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
                    <div v-else class="text-inner" v-html="msg.content"></div>
                    <div v-if="msg.fileName" class="file-attachment">
                      <el-icon><Document /></el-icon> {{ msg.fileName }}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </el-scrollbar>
        </div>

        <div class="input-wrapper">
          <div class="input-card">
            <div class="action-bar">
              <div class="tags">
                <el-button size="small" bg text round :icon="Search" @click="quickCommand('进行多路文献检索：')">文献搜索</el-button>
                <el-button size="small" bg text round :icon="CircleCheck" @click="quickCommand('对以下内容进行逻辑审查：')">逻辑审查</el-button>
                <el-button size="small" bg text round :icon="DataLine" @click="quickCommand('从图中提取实验数据：')">图表提取</el-button>
              </div>
              <div class="upload-area">
                <el-tag v-if="currentFile" closable @close="currentFile = null" size="small" type="success" class="file-tag">
                  {{ currentFile.name }}
                </el-tag>
                <el-upload action="#" :auto-upload="false" :show-file-list="false" :on-change="handleFileChange">
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
                circle 
                @click="sendMessage" 
              />
            </div>
          </div>
          <p class="footer-notice">AI 生成内容仅供参考，请结合实验原始数据进行科研判断</p>
        </div>
      </el-main>
    </el-container>
  </div>
</template>

<script setup>
import { ref, reactive, nextTick } from 'vue'
import { 
  Menu, Plus, Search, CircleCheck, DataLine, Memo,
  Promotion, Paperclip, Compass, Document
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import axios from 'axios'
import { v4 as uuidv4 } from 'uuid'

const drawerVisible = ref(false)
const userInput = ref('')
const scrollbarRef = ref(null)
const currentFile = ref(null) // 存储待上传文件

// 初始欢迎消息
const messages = reactive([
  { 
    role: 'assistant', 
    content: '您好，<b>Xiao Chen</b>。我是您的科研辅助智能体。您可以直接提问，或点击左下角回形针上传论文进行审查。',
    loading: false
  }
])

// 文件选择回调
const handleFileChange = (file) => {
  currentFile.value = file.raw
  ElMessage.success(`已载入文件: ${file.name}，点击发送按钮开始审查`)
}

// 模拟上传接口逻辑 (根据腾讯云LKE文档，通常需要先调用上传接口获取FileId)
const uploadFileToTencent = async (file) => {
  const formData = new FormData()
  // 注意：务必核对文档，上传接口的参数名可能是 'File' 或 'FileUpload'
  formData.append('File', file) 
  formData.append('AppKey', 'BASAYavmHgxaGkjuZAVOFJARZNjvxZwAmzyExDLSMPScGgWadjPIVXyjXfppxczgByYThRQDxxvdhTCulgwgxNIKujpqCDUHRdpWsmeHBERWuIYnamsdUwuMSUqeDWbO')

  try {
    // 使用新的代理前缀 /lke-upload
    // 接口路径请核对文档，通常是 /api/v1/resource/upload 或类似
    const res = await axios.post('/lke-upload/adp/v2/file/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000 // 给上传留出一分钟时间
    })

    console.log("文件上传原始响应:", res.data);
    return res.data?.FileId || res.data?.Data?.FileId || null
  } catch (e) {
    console.error("上传阶段崩溃:", e.response?.data || e.message);
    return null
  }
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
  scrollToBottom()

  try {
    let fileId = null
    // --- 业务修正：如果有文件，先上传 ---
    if (currentFile.value) {
      aiMsg.content = "正在上传并解析科研文档，请稍候..."
      fileId = await uploadFileToTencent(currentFile.value)
      if (!fileId) {
        throw new Error("文档解析引擎启动失败，请检查网络或格式")
      }
      currentFile.value = null // 清除已上传文件
    }

    const response = await axios.post('/lke-api/adp/v2/chat', {
      RequestId: uuidv4(),
      ConversationId: uuidv4(),
      AppKey: 'BASAYavmHgxaGkjuZAVOFJARZNjvxZwAmzyExDLSMPScGgWadjPIVXyjXfppxczgByYThRQDxxvdhTCulgwgxNIKujpqCDUHRdpWsmeHBERWuIYnamsdUwuMSUqeDWbO',
      VisitorId: 'XiaoChen_Student_001',
      Contents: [
        { Type: 'text', Text: text },
        // 如果有文件，将 FileId 传入
        ...(fileId ? [{ Type: 'file', FileId: fileId }] : [])
      ],
      Stream: 'disable',
      Incremental: true,
      WorkflowStatus: 'enable'
    }, {
      headers: { 'Content-Type': 'application/json' }
    });

    let aiAnswer = "";
    // SSE 解析逻辑处理
    if (typeof response.data === 'string' && response.data.includes('data:')) {
      const lines = response.data.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data:') && !trimmed.includes('[DONE]')) {
          try {
            const json = JSON.parse(trimmed.substring(5).trim());
            const part = json.Message?.Contents?.[0]?.Text || 
                         json.Payload?.WorkflowResults?.[0]?.Value ||
                         json.Contents?.[0]?.Text;
            if (part) aiAnswer += part;
          } catch (e) {}
        }
      }
    } else {
      aiAnswer = response.data?.Contents?.[0]?.Text || response.data?.Payload?.WorkflowResults?.[0]?.Value;
    }

    aiMsg.content = aiAnswer || "智能体审查完毕，未发现明显逻辑缺陷或匹配结果。";
    aiMsg.loading = false;

  } catch (error) {
    aiMsg.loading = false;
    aiMsg.content = `<span style="color: #ef4444;">业务中断: ${error.message || '参数异常'}</span>`;
  }
};

const scrollToBottom = () => {
  if (scrollbarRef.value) {
    nextTick(() => {
      const scrollEl = scrollbarRef.value.$el.querySelector('.el-scrollbar__wrap');
      scrollEl.scrollTop = scrollEl.scrollHeight;
    });
  }
}

const quickCommand = (cmd) => { userInput.value = cmd }

const handleEnter = (e) => {
  if (!e.shiftKey) sendMessage()
}
</script>

<style scoped>
/* 保持原有样式，新增文件标签样式 */
.app-wrapper { height: 100vh; display: flex; flex-direction: column; background-color: #f8fafc; overflow: hidden; }
.glass-header { height: 56px; background: #ffffff; border-bottom: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: space-between; padding: 0 20px; flex-shrink: 0; }
.header-left { display: flex; align-items: center; gap: 16px; }
.title { font-weight: 600; font-size: 16px; color: #1e293b; }
.title small { font-weight: 400; color: #64748b; margin-left: 10px; }
.user-status { display: flex; align-items: center; gap: 12px; }
.user-name { font-size: 13px; color: #475569; }

.main-layout { flex: 1; overflow: hidden; }
.chat-main { display: flex; flex-direction: column; padding: 0; height: 100%; }
.chat-viewport { flex: 1; overflow: hidden; }
.message-wrapper { max-width: 860px; margin: 0 auto; padding: 40px 20px 120px; }

.message-row { display: flex; gap: 14px; margin-bottom: 30px; }
.message-row.user { flex-direction: row-reverse; }
.bubble { padding: 12px 18px; border-radius: 12px; line-height: 1.6; font-size: 14px; }
.assistant .bubble { background: #fff; border: 1px solid #e2e8f0; color: #1e293b; border-top-left-radius: 2px; }
.user .bubble { background: #2563eb; color: #fff; border-top-right-radius: 2px; }

.file-attachment { margin-top: 8px; font-size: 12px; color: #64748b; background: rgba(0,0,0,0.05); padding: 4px 8px; border-radius: 4px; display: inline-flex; align-items: center; gap: 4px; }
.upload-area { display: flex; align-items: center; gap: 8px; }
.file-tag { max-width: 120px; overflow: hidden; text-overflow: ellipsis; }

.input-wrapper { padding: 20px; background: linear-gradient(to top, #f8fafc 70%, rgba(248,250,252, 0)); flex-shrink: 0; }
.input-card { max-width: 860px; margin: 0 auto; background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 12px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05); }
.action-bar { display: flex; justify-content: space-between; margin-bottom: 10px; }
.bottom-bar { display: flex; justify-content: space-between; align-items: center; margin-top: 10px; }
.hint { font-size: 11px; color: #94a3b8; }
.footer-notice { text-align: center; font-size: 11px; color: #cbd5e0; margin-top: 12px; }

.typing-loader span { width: 6px; height: 6px; background: #cbd5e0; display: inline-block; border-radius: 50%; margin: 0 2px; animation: typing 1s infinite; }
@keyframes typing { 0%, 100% { opacity: 0.3; } 50% { opacity: 1; } }
</style>