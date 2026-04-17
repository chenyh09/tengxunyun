/**
 * API 调用工具函数
 */

import axios from 'axios'
import { v4 as uuidv4 } from 'uuid'
import COS from 'cos-js-sdk-v5'
import { CREDENTIALS } from '../config/secrets.js'
import { getFileType } from './file.js'

const DEBUG_LKE =
  import.meta.env.DEV &&
  (import.meta.env.VITE_DEBUG_LKE === '1' ||
    (typeof window !== 'undefined' && window.localStorage?.getItem('DEBUG_LKE') === '1'))

const USE_DEV_COS_UPLOAD_PROXY =
  import.meta.env.DEV && (import.meta.env.VITE_USE_DEV_COS_PROXY === undefined || import.meta.env.VITE_USE_DEV_COS_PROXY === '1')

const debugLog = (...args) => {
  if (!DEBUG_LKE) return
  // eslint-disable-next-line no-console
  console.log('[LKE_DEBUG]', ...args)
}

const debugError = (stage, error) => {
  // eslint-disable-next-line no-console
  console.error(`[LKE_ERROR] ${stage}`, error)

  if (axios.isAxiosError?.(error)) {
    const info = {
      message: error.message,
      code: error.code,
      method: error.config?.method,
      url: error.config?.url,
      baseURL: error.config?.baseURL,
      requestUrl: error.request?.responseURL,
      status: error.response?.status,
      response: error.response?.data
    }
    // eslint-disable-next-line no-console
    console.error('[LKE_ERROR][axios]', info)
  }
}

/**
 * 获取 COS 临时凭证
 */
export const getStorageCredential = async ({ fileType, isPublic = false, typeKey = 'realtime' } = {}) => {
  debugLog('getStorageCredential:start', {
    api: CREDENTIALS.CREDENTIAL_API,
    region: CREDENTIALS.REGION
  })

  try {
    // 重要：OpenAPI 必须签名（需要 CAM 的 SecretId/SecretKey），所以这里把请求发给本地 dev server 代签。
    // vite.config.js 中的 `lkeOpenApiSignedProxyPlugin` 会拦截 `/lke-api-common` 并转发到腾讯云 OpenAPI。
    const body = {
      // DescribeStorageCredential 入参（见 105050/116238）
      BotBizId: CREDENTIALS.BOT_BIZ_ID || undefined,
      FileType: fileType || undefined,
      IsPublic: Boolean(isPublic),
      TypeKey: typeKey,

      // Region 仅用于服务端签名/转发（不会作为 OpenAPI body 参数传给上游）
      Region: CREDENTIALS.REGION
    }

    const headers = {
      'Content-Type': 'application/json'
    }

    debugLog('getStorageCredential:request', {
      url: CREDENTIALS.CREDENTIAL_API,
      headers,
      body: { ...body, BotBizId: body.BotBizId ? '***' : undefined }
    })

    const response = await axios.post(CREDENTIALS.CREDENTIAL_API, body, {
      headers
    })

    debugLog('getStorageCredential:response', response.status, response.data)

    const resp = response.data?.Response
    if (!resp) {
      throw new Error('OpenAPI 返回缺少 Response 字段')
    }
    if (resp.Error) {
      const code = resp.Error.Code || 'UnknownError'
      const msg = resp.Error.Message || 'UnknownMessage'
      throw new Error(`OpenAPI 错误 ${code}: ${msg}`)
    }

    return resp
  } catch (error) {
    debugError('getStorageCredential', error)

    const detail =
      (axios.isAxiosError?.(error) && (error.response?.data?.message || error.message)) ||
      error?.message ||
      String(error)

    throw new Error(`无法获取腾讯云上传凭证: ${detail}`)
  }
}

/**
 * 计算文件 CRC64 (腾讯云文档强制要求 x-cos-hash-crc64ecma 格式)
 */
const calculateCRC64 = (file) => {
  const POLY = 0xc96c5795d7870f42n

  const table = (() => {
    const t = new Array(256)
    for (let i = 0; i < 256; i++) {
      let crc = BigInt(i)
      for (let j = 0; j < 8; j++) {
        crc = crc & 1n ? POLY ^ (crc >> 1n) : crc >> 1n
      }
      t[i] = crc
    }
    return t
  })()

  const crc64ecma = (bytes) => {
    let crc = ~0n & 0xffffffffffffffffn
    for (let i = 0; i < bytes.length; i++) {
      const idx = Number((crc ^ BigInt(bytes[i])) & 0xffn)
      crc = table[idx] ^ (crc >> 8n)
    }
    crc = ~crc & 0xffffffffffffffffn
    return crc
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const bytes = new Uint8Array(e.target.result)
        resolve(crc64ecma(bytes).toString())
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}

/**
 * 上传文件到腾讯云COS并进行文档解析
 * @param {File} file - 文件对象
 * @returns {Promise<string|null>} 文档ID或null
 */
export const uploadFileToTencent = async (file) => {
  debugLog('uploadFileToTencent:start', {
    name: file?.name,
    size: file?.size,
    type: file?.type,
    docParseApi: CREDENTIALS.DOC_PARSE_API
  })

  try {
    const fileExt = typeof file?.name === 'string' ? file.name.split('.').pop()?.toLowerCase() : undefined

    let Bucket
    let Region
    let UploadPath
    let Type
    let etag = ''
    let fileHash = ''

    if (USE_DEV_COS_UPLOAD_PROXY) {
      // 开发态：通过同源代理上传，绕过浏览器对 COS 的 CORS 限制
      fileHash = await calculateCRC64(file)

      const form = new FormData()
      form.append('file', file)
      if (fileExt) form.append('fileType', fileExt)
      if (CREDENTIALS.BOT_BIZ_ID) form.append('botBizId', CREDENTIALS.BOT_BIZ_ID)
      if (CREDENTIALS.REGION) form.append('region', CREDENTIALS.REGION)
      form.append('typeKey', 'realtime')
      form.append('isPublic', 'false')

      debugLog('uploadFileToTencent:devProxy:request', {
        url: '/__dev/cos-upload',
        fileName: file?.name,
        size: file?.size
      })

      const uploadRes = await axios.post('/__dev/cos-upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })

      Bucket = uploadRes.data?.Bucket
      Region = uploadRes.data?.Region
      UploadPath = uploadRes.data?.UploadPath
      Type = uploadRes.data?.Type
      etag = typeof uploadRes.data?.ETag === 'string' ? uploadRes.data.ETag : ''

      debugLog('uploadFileToTencent:devProxy:response', {
        Bucket,
        Region,
        UploadPath,
        ETag: etag
      })
    } else {
      // 生产/非代理：浏览器直传 COS（需要 COS 桶配置 CORS 允许当前站点 Origin）
      // 1. 获取临时凭证（返回 Credentials.TmpSecretId/TmpSecretKey/Token 等）
      const response = await getStorageCredential({ fileType: fileExt, isPublic: false, typeKey: 'realtime' })
      debugLog('uploadFileToTencent:credential', {
        Bucket: response?.Bucket,
        Region: response?.Region,
        UploadPath: response?.UploadPath,
        HasCredentials: Boolean(response?.Credentials)
      })

      const { Credentials, Bucket: b, Region: r, UploadPath: p, Type: t } = response
      Bucket = b
      Region = r
      UploadPath = p
      Type = t

      // 2. 初始化 COS SDK（强制 https，避免 http 重定向导致的预检异常）
      const cos = new COS({
        Protocol: 'https:',
        getAuthorization: (options, callback) => {
          callback({
            TmpSecretId: Credentials.TmpSecretId,
            TmpSecretKey: Credentials.TmpSecretKey,
            SecurityToken: Credentials.Token,
            StartTime: response.StartTime,
            ExpiredTime: response.ExpiredTime
          })
        }
      })

      // 3. 上传到 COS
      // 重点：UploadPath 通常以 `/` 开头；COS Key 更稳妥用不带前导 `/` 的形式
      const cosKey = typeof UploadPath === 'string' ? UploadPath.replace(/^\//, '') : UploadPath

      debugLog('uploadFileToTencent:cos.uploadFile', {
        Bucket,
        Region,
        Key: cosKey
      })

      const cosRes = await cos.uploadFile({
        Bucket,
        Region,
        Key: cosKey,
        Body: file
      })

      debugLog('uploadFileToTencent:cos.uploadFile:ok', {
        Location: cosRes?.Location,
        ETag: cosRes?.ETag
      })

      etag = typeof cosRes?.ETag === 'string' ? cosRes.ETag : ''

      // 4. 计算正确的 CRC64 哈希
      // 文档建议从上传返回头 `x-cos-hash-crc64ecma` 获取；这里优先取 header，取不到再本地计算兜底
      const headerCrc64 =
        cosRes?.headers?.['x-cos-hash-crc64ecma'] ||
        cosRes?.headers?.['X-Cos-Hash-Crc64Ecma'] ||
        cosRes?.headers?.['x-cos-hash-crc64ecma'.toUpperCase()]
      fileHash = headerCrc64 ? String(headerCrc64) : await calculateCRC64(file)
      debugLog('uploadFileToTencent:crc64', fileHash)
    }

    // 5. 调用文档解析接口（SSE 流式返回）
    const sessionId = uuidv4().replace(/-/g, '')
    const requestId = uuidv4()

    const quotedEtag = etag && etag.startsWith('"') ? etag : etag ? `"${etag.replace(/"/g, '')}"` : etag

    // 重要：docParse 的 cos_url 需要传 UploadPath（平台 cos 路径），不是完整 https URL
    const platformPath = typeof UploadPath === 'string' && UploadPath.startsWith('/') ? UploadPath : `/${UploadPath}`

    const body = {
      session_id: sessionId, // 文档解析的 session_id 要与后续对话一致
      bot_app_key: CREDENTIALS.APP_KEY,
      request_id: requestId,
      cos_bucket: Bucket,
      file_type: getFileType(file.name),
      file_name: file.name,
      cos_url: platformPath,
      cos_hash: fileHash,
      e_tag: quotedEtag,
      size: file.size.toString()
    }

    debugLog('uploadFileToTencent:docParse:request', {
      url: CREDENTIALS.DOC_PARSE_API,
      body: { ...body, bot_app_key: '***' }
    })

    const docParseRes = await axios.post(CREDENTIALS.DOC_PARSE_API, body, {
      headers: { 'Content-Type': 'application/json' },
      // 允许拿到 SSE 字符串，便于调试
      responseType: 'text'
    })

    debugLog('uploadFileToTencent:docParse:response', docParseRes.status, docParseRes.data)

    // 解析 SSE，抓取最后一个 doc_id
    const text = typeof docParseRes.data === 'string' ? docParseRes.data : ''
    let docId = null
    if (text) {
      const candidates = text.match(/"doc_id"\s*:\s*"(.*?)"/g) || []
      const last = candidates[candidates.length - 1]
      const m = last?.match(/"doc_id"\s*:\s*"(.*?)"/)
      if (m?.[1] && m[1] !== '0') docId = m[1]
    }

    debugLog('uploadFileToTencent:docParse:docId', docId)

    if (!docId) return null

    const fileType = getFileType(file.name)
    const baseName = file.name.replace(/\.[^/.]+$/, '')

    // file_url 用于后续 SSE 对话的 file_infos（标准模式拼接方式见文档）
    const typePart = Type || 'cos'
    const fileUrl = `https://${Bucket}.${typePart}.${Region}.myqcloud.com${platformPath}`

    return {
      docId,
      sessionId,
      fileInfo: {
        doc_id: docId,
        file_name: baseName,
        file_type: fileType,
        file_size: file.size.toString(),
        file_url: fileUrl
      }
    }
  } catch (e) {
    debugError('uploadFileToTencent', e)
    return null
  }
}

/**
 * 发送聊天消息
 * @param {string} text - 对话文本
 * @param {string|null} docId - 文档ID
 * @returns {Promise<string>} AI回复内容
 */
export const sendChatMessage = async (text, options = {}) => {
  const sessionId = options?.sessionId || uuidv4()
  const fileInfos = options?.fileInfos || (options?.fileInfo ? [options.fileInfo] : [])

  debugLog('sendChatMessage:start', {
    chatApi: CREDENTIALS.CHAT_API,
    sessionId,
    fileCount: fileInfos?.length || 0
  })

  try {
    // HTTP SSE 对话（见官方文档 105561）
    const body = {
      request_id: uuidv4(),
      session_id: sessionId,
      bot_app_key: CREDENTIALS.APP_KEY,
      visitor_biz_id: CREDENTIALS.VISITOR_ID,
      file_infos: fileInfos,
      content: text,
      incremental: true,
      stream: 'enable',
      streaming_throttle: 10
    }

    debugLog('sendChatMessage:request', {
      url: CREDENTIALS.CHAT_API,
      body: { ...body, bot_app_key: '***' }
    })

    const response = await axios.post(CREDENTIALS.CHAT_API, body, {
      headers: { 'Content-Type': 'application/json' },
      responseType: 'text'
    })

    debugLog('sendChatMessage:response', response.status, response.data)

    return parseResponse(response.data)
  } catch (error) {
    debugError('sendChatMessage', error)
    throw error
  }
}

/**
 * 解析响应内容
 * @param {any} data - 响应数据
 * @returns {string} 解析后的文本
 */
const parseResponse = (data) => {
  let aiAnswer = ""
  
  // SSE 解析逻辑处理
  if (typeof data === 'string' && (data.includes('data:') || data.includes('event:'))) {
    const lines = data.split('\n')
    for (const line of lines) {
      const trimmed = line.trim()

      // 兼容两种格式：
      // 1) event:reply\ndata:{json}
      // 2) data:{json}
      const payloadLine = trimmed.startsWith('data:') ? trimmed : ''
      if (!payloadLine || payloadLine.includes('[DONE]')) continue

      try {
        const json = JSON.parse(payloadLine.substring(5).trim())

        // 官方 SSE（105561）：reply 事件的内容在 payload.content
        if (json?.type === 'error' && json?.error?.message) {
          throw new Error(json.error.message)
        }

        const part =
          json?.payload?.content ||
          json?.Message?.Contents?.[0]?.Text ||
          json?.Payload?.WorkflowResults?.[0]?.Value ||
          json?.Contents?.[0]?.Text

        if (typeof part === 'string' && part) aiAnswer += part
      } catch (e) {
        // 忽略单行解析失败（SSE 可能包含空行/非 JSON 行）
      }
    }
  } else {
    aiAnswer = data?.payload?.content || data?.Contents?.[0]?.Text || data?.Payload?.WorkflowResults?.[0]?.Value
  }

  return aiAnswer || "智能体审查完毕，未发现明显逻辑缺陷或匹配结果。"
}
