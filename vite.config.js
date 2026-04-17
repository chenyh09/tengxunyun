import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import crypto from 'node:crypto'
import { createRequire } from 'node:module'

function mockApiPlugin(enable = false) {
  return {
    name: 'mock-api',
    apply: 'serve',
    configureServer(server) {
      if (!enable) return
      // 在所有中间件之前添加 Mock 处理器
      server.middlewares.use((req, res, next) => {
        // 文档解析接口
        if (req.url.includes('/v1/qbot/chat/docParse')) {
          console.log('[Mock API] ✓ 拦截文档解析请求:', req.url)

          let body = ''
          req.on('data', (chunk) => {
            body += chunk
          })
          req.on('end', () => {
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(
              JSON.stringify({
                doc_id: `mock_doc_${Date.now()}`,
                status: 'success',
                message: '文档已解析（Mock模式）'
              })
            )
          })
          return
        }

        // 对话接口
        if (req.url.includes('/adp/v2/chat')) {
          console.log('[Mock API] ✓ 拦截对话请求:', req.url)

          let body = ''
          req.on('data', (chunk) => {
            body += chunk
          })
          req.on('end', () => {
            try {
              const data = JSON.parse(body)
              const userText = data.Contents?.[0]?.Text || '未知提问'
              const mockReply = `✅ Mock 模式回复\n\n您的问题: "${userText.substring(0, 50)}${
                userText.length > 50 ? '...' : ''
              }"\n\n这是本地开发模式的模拟回复。系统已正确接收并处理了您的请求。当连接到真实的腾讯云 LKE 服务时，将返回实际的 AI 分析结果。`

              res.statusCode = 200
              res.setHeader('Content-Type', 'application/json')
              res.end(
                JSON.stringify({
                  Contents: [
                    {
                      Type: 'text',
                      Text: mockReply
                    }
                  ]
                })
              )
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

function lkeOpenApiSignedProxyPlugin({ secretId, secretKey } = {}) {
  const endpoint = 'lke.tencentcloudapi.com'
  const service = 'lke'
  const version = '2023-11-30'
  const action = 'DescribeStorageCredential'

  const sha256Hex = (str) => crypto.createHash('sha256').update(str).digest('hex')
  const hmacSha256 = (key, msg, output = undefined) =>
    crypto.createHmac('sha256', key).update(msg).digest(output)

  const tc3SignedJsonPost = async ({ region, action, payload }) => {
    const timestamp = Math.floor(Date.now() / 1000)
    const date = new Date(timestamp * 1000).toISOString().slice(0, 10)

    const canonicalHeaders =
      'content-type:application/json; charset=utf-8\n' +
      `host:${endpoint}\n` +
      `x-tc-action:${String(action).toLowerCase()}\n`
    const signedHeaders = 'content-type;host;x-tc-action'
    const hashedPayload = sha256Hex(payload)

    const canonicalRequest =
      'POST\n/\n\n' + canonicalHeaders + '\n' + signedHeaders + '\n' + hashedPayload

    const credentialScope = `${date}/${service}/tc3_request`
    const stringToSign =
      'TC3-HMAC-SHA256\n' +
      `${timestamp}\n` +
      `${credentialScope}\n` +
      sha256Hex(canonicalRequest)

    const secretDate = hmacSha256(`TC3${secretKey}`, date)
    const secretService = hmacSha256(secretDate, service)
    const secretSigning = hmacSha256(secretService, 'tc3_request')
    const signature = hmacSha256(secretSigning, stringToSign, 'hex')

    const authorization =
      `TC3-HMAC-SHA256 Credential=${secretId}/${credentialScope}, ` +
      `SignedHeaders=${signedHeaders}, ` +
      `Signature=${signature}`

    const upstream = await fetch(`https://${endpoint}/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Host: endpoint,
        'X-TC-Action': action,
        'X-TC-Version': version,
        'X-TC-Region': region,
        'X-TC-Timestamp': String(timestamp),
        Authorization: authorization
      },
      body: payload
    })

    const text = await upstream.text()
    return { status: upstream.status, text }
  }

  return {
    name: 'lke-openapi-signed-proxy',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/lke-api-common')) return next()

        const looksLikeSecretId = (v) => typeof v === 'string' && v.startsWith('AKID')

        if (!secretId || !secretKey) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(
            JSON.stringify({
              message:
                'Missing OpenAPI credentials. Set TENCENTCLOUD_SECRET_ID and TENCENTCLOUD_SECRET_KEY in .env.local, then restart `pnpm dev`.'
            })
          )
          return
        }

        // 常见误配置：把 UIN 写进 SecretId，或把 AKID... 写进 SecretKey
        if (!looksLikeSecretId(secretId) && looksLikeSecretId(secretKey)) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(
            JSON.stringify({
              message:
                'OpenAPI credentials look swapped: SecretId should start with AKID..., SecretKey is a different random string. Please fix .env.local and restart `pnpm dev`.'
            })
          )
          return
        }

        if (!looksLikeSecretId(secretId)) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(
            JSON.stringify({
              message:
                'Invalid SecretId format: it should start with AKID.... Please fix TENCENTCLOUD_SECRET_ID in .env.local and restart `pnpm dev`.'
            })
          )
          return
        }

        let raw = ''
        await new Promise((resolve) => {
          req.on('data', (chunk) => {
            raw += chunk
          })
          req.on('end', resolve)
        })

        let body = {}
        try {
          body = raw ? JSON.parse(raw) : {}
        } catch {
          body = {}
        }

        const region = body.Region || body.region || 'ap-guangzhou'

        // 仅转发白名单字段，避免让客户端借助你的 SecretKey 构造任意 OpenAPI 调用
        const payloadObj = {}
        const botBizId = body.BotBizId || body.bot_biz_id || body.botBizId
        const fileType = body.FileType || body.file_type || body.fileType
        const typeKey = body.TypeKey || body.type_key || body.typeKey || 'realtime'

        if (botBizId) payloadObj.BotBizId = String(botBizId)
        if (fileType) payloadObj.FileType = String(fileType)
        if (typeof body.IsPublic === 'boolean') payloadObj.IsPublic = body.IsPublic
        payloadObj.TypeKey = String(typeKey)

        const payload = JSON.stringify(payloadObj)
        try {
          const { status, text } = await tc3SignedJsonPost({ region, action, payload })
          res.statusCode = status
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(text)
        } catch (err) {
          res.statusCode = 502
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({ message: 'OpenAPI 上游请求失败', error: String(err?.message || err) }))
        }
      })
    }
  }
}

function devCosUploadProxyPlugin({ secretId, secretKey } = {}) {
  const require = createRequire(import.meta.url)

  const sendJson = (res, statusCode, payload) => {
    res.statusCode = statusCode
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify(payload))
  }

  return {
    name: 'dev-cos-upload-proxy',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.method !== 'POST' || req.url !== '/__dev/cos-upload') return next()

        if (!secretId || !secretKey) {
          return sendJson(res, 500, {
            message:
              'Missing OpenAPI credentials. Set TENCENTCLOUD_SECRET_ID and TENCENTCLOUD_SECRET_KEY in .env.local, then restart `pnpm dev`.'
          })
        }

        let Busboy
        let COS
        try {
          Busboy = require('busboy')
          COS = require('cos-nodejs-sdk-v5')
        } catch (err) {
          return sendJson(res, 500, {
            message: 'Missing dev dependencies for upload proxy. Please install `busboy` and `cos-nodejs-sdk-v5`.',
            error: String(err?.message || err)
          })
        }

        const fields = {}
        let fileBuffer = null
        let fileMeta = null

        try {
          const bb = Busboy({ headers: req.headers, limits: { files: 1, fileSize: 100 * 1024 * 1024 } })

          bb.on('field', (name, value) => {
            fields[name] = value
          })

          bb.on('file', (name, file, info) => {
            if (name !== 'file') {
              file.resume()
              return
            }
            fileMeta = info
            const chunks = []
            file.on('data', (d) => chunks.push(d))
            file.on('end', () => {
              fileBuffer = Buffer.concat(chunks)
            })
          })

          bb.on('error', (err) => {
            sendJson(res, 400, { message: 'Invalid multipart form data', error: String(err?.message || err) })
          })

          bb.on('finish', async () => {
            if (!fileBuffer || !fileMeta?.filename) {
              return sendJson(res, 400, { message: 'Missing file field in multipart form data (name="file")' })
            }

            // 1) 申请上传临时凭证
            const endpoint = 'lke.tencentcloudapi.com'
            const service = 'lke'
            const version = '2023-11-30'
            const action = 'DescribeStorageCredential'

            const sha256Hex = (str) => crypto.createHash('sha256').update(str).digest('hex')
            const hmacSha256 = (key, msg, output = undefined) =>
              crypto.createHmac('sha256', key).update(msg).digest(output)

            const region = fields.region || fields.Region || 'ap-guangzhou'
            const payloadObj = {
              BotBizId: fields.botBizId || fields.BotBizId || undefined,
              FileType: fields.fileType || fields.FileType || undefined,
              IsPublic: fields.isPublic === 'true' || fields.IsPublic === 'true' || false,
              TypeKey: fields.typeKey || fields.TypeKey || 'realtime'
            }

            const payload = JSON.stringify(payloadObj)

            const timestamp = Math.floor(Date.now() / 1000)
            const date = new Date(timestamp * 1000).toISOString().slice(0, 10)

            const canonicalHeaders =
              'content-type:application/json; charset=utf-8\n' +
              `host:${endpoint}\n` +
              `x-tc-action:${String(action).toLowerCase()}\n`
            const signedHeaders = 'content-type;host;x-tc-action'
            const hashedPayload = sha256Hex(payload)

            const canonicalRequest =
              'POST\n/\n\n' + canonicalHeaders + '\n' + signedHeaders + '\n' + hashedPayload

            const credentialScope = `${date}/${service}/tc3_request`
            const stringToSign =
              'TC3-HMAC-SHA256\n' +
              `${timestamp}\n` +
              `${credentialScope}\n` +
              sha256Hex(canonicalRequest)

            const secretDate = hmacSha256(`TC3${secretKey}`, date)
            const secretService = hmacSha256(secretDate, service)
            const secretSigning = hmacSha256(secretService, 'tc3_request')
            const signature = hmacSha256(secretSigning, stringToSign, 'hex')

            const authorization =
              `TC3-HMAC-SHA256 Credential=${secretId}/${credentialScope}, ` +
              `SignedHeaders=${signedHeaders}, ` +
              `Signature=${signature}`

            let openapiText = ''
            try {
              const upstream = await fetch(`https://${endpoint}/`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json; charset=utf-8',
                  Host: endpoint,
                  'X-TC-Action': action,
                  'X-TC-Version': version,
                  'X-TC-Region': region,
                  'X-TC-Timestamp': String(timestamp),
                  Authorization: authorization
                },
                body: payload
              })
              openapiText = await upstream.text()
              if (!upstream.ok) {
                return sendJson(res, upstream.status, {
                  message: 'OpenAPI request failed',
                  status: upstream.status,
                  body: openapiText
                })
              }
            } catch (err) {
              return sendJson(res, 502, { message: 'OpenAPI upstream fetch failed', error: String(err?.message || err) })
            }

            let openapiJson
            try {
              openapiJson = JSON.parse(openapiText)
            } catch (err) {
              return sendJson(res, 502, {
                message: 'OpenAPI response is not valid JSON',
                body: openapiText,
                error: String(err?.message || err)
              })
            }

            const resp = openapiJson?.Response
            if (!resp) return sendJson(res, 502, { message: 'OpenAPI missing Response field', body: openapiJson })
            if (resp.Error) {
              return sendJson(res, 502, {
                message: `OpenAPI error ${resp.Error.Code || 'UnknownError'}: ${resp.Error.Message || ''}`,
                body: resp
              })
            }

            const { Credentials, Bucket, Region, UploadPath, Type } = resp
            if (!Credentials?.TmpSecretId || !Bucket || !Region || !UploadPath) {
              return sendJson(res, 502, { message: 'OpenAPI response missing required upload fields', body: resp })
            }

            // 2) 通过 Node SDK 上传（服务端无 CORS 限制）
            const cosKey = typeof UploadPath === 'string' ? UploadPath.replace(/^\//, '') : UploadPath

            const cos = new COS({
              SecretId: Credentials.TmpSecretId,
              SecretKey: Credentials.TmpSecretKey,
              SecurityToken: Credentials.Token
            })

            const contentType = fileMeta?.mimeType || 'application/octet-stream'

            try {
              const putObject = (params) =>
                new Promise((resolve, reject) => {
                  cos.putObject(params, (err, data) => {
                    if (err) return reject(err)
                    resolve(data)
                  })
                })

              const putRes = await putObject({
                Bucket,
                Region,
                Key: cosKey,
                Body: fileBuffer,
                ContentType: contentType,
                ContentLength: fileBuffer.length
              })

              return sendJson(res, 200, {
                Bucket,
                Region,
                UploadPath,
                Type,
                ETag: putRes?.ETag || putRes?.etag || ''
              })
            } catch (err) {
              return sendJson(res, 502, { message: 'COS upload failed', error: String(err?.message || err) })
            }
          })

          req.pipe(bb)
        } catch (err) {
          return sendJson(res, 500, { message: 'Upload proxy error', error: String(err?.message || err) })
        }
      })
    }
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const secretId = env.TENCENTCLOUD_SECRET_ID || env.TENCENT_SECRET_ID
  const secretKey = env.TENCENTCLOUD_SECRET_KEY || env.TENCENT_SECRET_KEY

  return {
    plugins: [
      vue(),
      mockApiPlugin(false),
      lkeOpenApiSignedProxyPlugin({ secretId, secretKey }),
      devCosUploadProxyPlugin({ secretId, secretKey })
    ],
    server: {
      proxy: {
        // 使用带尾斜杠的前缀，避免误匹配 `/lke-api-common`
        '/lke-api/': {
          target: 'https://lke.cloud.tencent.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/lke-api\//, '/')
        },

        '/lke-doc': {
          target: 'https://wss.lke.cloud.tencent.com',
          changeOrigin: true,
          headers: {
            Host: 'wss.lke.cloud.tencent.com'
          },
          rewrite: (path) => path.replace(/^\/lke-doc/, '')
        }
      }
    }
  }
})

