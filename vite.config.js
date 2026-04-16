import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

function mockApiPlugin(enable = false) {
  return {
    name: 'mock-api',
    apply: 'serve',
    configureServer(server) {
      if (!enable) return;
      // 在所有中间件之前添加 Mock 处理器
      server.middlewares.use((req, res, next) => {
        // 文档解析接口
        if (req.url.includes('/v1/qbot/chat/docParse')) {
          console.log('[Mock API] ✓ 拦截文档解析请求:', req.url)
          
          let body = ''
          req.on('data', chunk => { body += chunk })
          req.on('end', () => {
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({
              doc_id: `mock_doc_${Date.now()}`,
              status: 'success',
              message: '文档已解析（Mock模式）'
            }))
          })
          return
        }
        
        // 对话接口
        if (req.url.includes('/adp/v2/chat')) {
          console.log('[Mock API] ✓ 拦截对话请求:', req.url)
          
          let body = ''
          req.on('data', chunk => { body += chunk })
          req.on('end', () => {
            try {
              const data = JSON.parse(body)
              const userText = data.Contents?.[0]?.Text || '未知提问'
              const mockReply = `✅ Mock 模式回复\n\n您的问题: "${userText.substring(0, 50)}${userText.length > 50 ? '...' : ''}"\n\n这是本地开发模式的模拟回复。系统已正确接收并处理了您的请求。当连接到真实的腾讯云 LKE 服务时，将返回实际的 AI 分析结果。`
              
              res.statusCode = 200
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({
                Contents: [{
                  Type: 'text',
                  Text: mockReply
                }]
              }))
            } catch (error) {
              console.error('[Mock API] 错误:', error.message)
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: error.message }))
            }
          })
          return
        }
        
        next()
      })
    }
  }
}

export default defineConfig({
  plugins: [vue(), mockApiPlugin(false)],
  server: {
    proxy: {
      '/lke-api': {
        target: 'https://lke.cloud.tencent.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/lke-api/, '/')
      },
      '/lke-api-common': {
        target: 'https://lke.tencentcloudapi.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/lke-api-common/, '/')
      },
      '/lke-doc': {
        target: 'https://lke.cloud.tencent.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/lke-doc/, '/')
      }
    }
  }
})

