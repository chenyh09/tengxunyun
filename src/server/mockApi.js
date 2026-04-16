/**
 * Mock API 服务器 - 用于本地开发测试
 * 模拟腾讯云 LKE 的文档解析和对话接口
 */

import { defineEventHandler, readMultipartFormData } from 'h3'
import { v4 as uuidv4 } from 'uuid'

// 模拟文档解析接口
export const mockDocParse = defineEventHandler(async (event) => {
  try {
    const formData = await readMultipartFormData(event)
    
    const fileName = formData.find(f => f.name === 'file_name')?.data
    const fileSize = formData.find(f => f.name === 'size')?.data
    
    console.log(`[Mock] 收到文件上传: ${fileName}, 大小: ${fileSize} bytes`)
    
    // 模拟返回文档ID
    return {
      doc_id: `doc_${uuidv4().substring(0, 8)}`,
      status: 'success',
      message: '文档已解析'
    }
  } catch (error) {
    console.error('[Mock] 文档解析错误:', error.message)
    return {
      status: 'error',
      message: error.message
    }
  }
})

// 模拟对话接口
export const mockChatMessage = defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const text = body.Contents?.[0]?.Text || ''
    
    console.log(`[Mock] 收到对话: ${text.substring(0, 50)}...`)
    
    // 模拟 AI 回复
    const mockResponse = `感谢您的提问。根据您上传的文档内容，我理解您提出了以下问题："${text.substring(0, 30)}..."。\n\n这是一个模拟的 AI 回复。在实际环境中，该字段将由腾讯云 LKE 服务返回真实的分析结果。\n\n---\n系统提示: 当前处于本地开发模式，使用模拟数据。`
    
    return {
      Contents: [
        {
          Type: 'text',
          Text: mockResponse
        }
      ],
      Message: {
        Contents: [
          {
            Type: 'text',
            Text: mockResponse
          }
        ]
      }
    }
  } catch (error) {
    console.error('[Mock] 对话错误:', error.message)
    return {
      Contents: [
        {
          Type: 'text',
          Text: `错误: ${error.message}`
        }
      ]
    }
  }
})
