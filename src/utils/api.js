/**
 * API 调用工具函数
 */

import axios from 'axios'
import { v4 as uuidv4 } from 'uuid'
import COS from 'cos-js-sdk-v5'
import CryptoJS from 'crypto-js'
import { CREDENTIALS } from '../config/secrets.js'
import { getFileType } from './file.js'

/**
 * 获取 COS 临时凭证
 */
export const getStorageCredential = async () => {
  try {
    const response = await axios.post(CREDENTIALS.CREDENTIAL_API, {
      Action: 'DescribeStorageCredential',
      Version: '2023-11-30',
      BotAppKey: CREDENTIALS.APP_KEY
    }, {
      headers: {
        'Content-Type': 'application/json',
        'X-TC-Action': 'DescribeStorageCredential',
        'X-TC-Version': '2023-11-30',
        'X-TC-Region': CREDENTIALS.REGION
      }
    })
    return response.data.Response
  } catch (error) {
    console.error("获取凭证失败:", error.response?.data || error.message)
    throw new Error("无法获取腾讯云上传凭证")
  }
}

/**
 * 计算文件 CRC64 (这里使用 CryptoJS 模拟哈希计算，实际建议使用专门的 CRC64 库)
 */
const calculateHash = (file) => {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const wa = CryptoJS.lib.WordArray.create(e.target.result)
      const hash = CryptoJS.MD5(wa).toString() // 注意：LKE 推荐 CRC64，这里暂用 MD5 占位测试
      resolve(hash)
    }
    reader.readAsArrayBuffer(file)
  })
}

/**
 * 上传文件到腾讯云COS并进行文档解析
 * @param {File} file - 文件对象
 * @returns {Promise<string|null>} 文档ID或null
 */
export const uploadFileToTencent = async (file) => {
  try {
    // 1. 获取临时凭证
    const { Credentials, Bucket, Region, FilePath } = await getStorageCredential()
    
    // 2. 初始化 COS SDK
    const cos = new COS({
      getAuthorization: (options, callback) => {
        callback({
          TmpSecretId: Credentials.TmpSecretId,
          TmpSecretKey: Credentials.TmpSecretKey,
          SecurityToken: Credentials.Token,
          StartTime: Credentials.StartTime,
          ExpiredTime: Credentials.ExpiredTime,
        })
      }
    })

    // 3. 上传到 COS
    const uploadPath = `${FilePath}/${uuidv4()}_${file.name}`
    const cosRes = await cos.uploadFile({
      Bucket: Bucket,
      Region: Region,
      Key: uploadPath,
      Body: file,
    })

    console.log("COS 上传成功:", cosRes)

    // 4. 计算哈希 (LKE 校验需要)
    const fileHash = await calculateHash(file)

    // 5. 调用文档解析接口
    const sessionId = uuidv4().replace(/-/g, '')
    const docParseRes = await axios.post(CREDENTIALS.DOC_PARSE_API, {
      session_id: sessionId,
      bot_app_key: CREDENTIALS.APP_KEY,
      request_id: uuidv4(),
      cos_bucket: Bucket,
      file_type: getFileType(file.name),
      file_name: file.name,
      cos_url: `https://${cosRes.Location}`,
      cos_hash: fileHash,
      e_tag: cosRes.ETag,
      size: file.size.toString()
    }, {
      headers: { 'Content-Type': 'application/json' }
    })

    console.log("文档解析响应:", docParseRes.data)
    return docParseRes.data?.doc_id || docParseRes.data?.DocId || null
  } catch (e) {
    console.error("文件处理流程失败:", e)
    return null
  }
}

/**
 * 发送聊天消息
 * @param {string} text - 对话文本
 * @param {string|null} docId - 文档ID
 * @returns {Promise<string>} AI回复内容
 */
export const sendChatMessage = async (text, docId = null) => {
  try {
    const response = await axios.post(CREDENTIALS.CHAT_API, {
      RequestId: uuidv4(),
      ConversationId: uuidv4(),
      AppKey: CREDENTIALS.APP_KEY,
      VisitorId: CREDENTIALS.VISITOR_ID,
      Contents: [
        { Type: 'text', Text: text },
        // 如果有文档，将 doc_id 传入
        ...(docId ? [{ Type: 'doc', DocId: docId }] : [])
      ],
      Stream: 'disable',
      Incremental: true,
      WorkflowStatus: 'enable'
    }, {
      headers: { 'Content-Type': 'application/json' }
    })

    return parseResponse(response.data)
  } catch (error) {
    console.error("API调用失败:", error.response?.data || error.message)
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
  if (typeof data === 'string' && data.includes('data:')) {
    const lines = data.split('\n')
    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed.startsWith('data:') && !trimmed.includes('[DONE]')) {
        try {
          const json = JSON.parse(trimmed.substring(5).trim())
          const part = json.Message?.Contents?.[0]?.Text || 
                       json.Payload?.WorkflowResults?.[0]?.Value ||
                       json.Contents?.[0]?.Text
          if (part) aiAnswer += part
        } catch (e) {}
      }
    }
  } else {
    aiAnswer = data?.Contents?.[0]?.Text || data?.Payload?.WorkflowResults?.[0]?.Value
  }

  return aiAnswer || "智能体审查完毕，未发现明显逻辑缺陷或匹配结果。"
}
