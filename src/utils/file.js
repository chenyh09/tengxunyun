/**
 * 文件处理工具函数
 */

/**
 * 获取文件类型
 * @param {string} fileName - 文件名
 * @returns {string} 文件类型
 */
export const getFileType = (fileName) => {
  const ext = fileName.split('.').pop().toLowerCase()
  const typeMap = {
    'pdf': 'pdf',
    'doc': 'docx',
    'docx': 'docx',
    'txt': 'txt',
    'pptx': 'pptx',
    'ppt': 'pptx'
  }
  return typeMap[ext] || 'unknown'
}

/**
 * 文件大小格式化
 * @param {number} bytes - 字节数
 * @returns {string} 格式化的文件大小
 */
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
}

/**
 * 验证文件大小
 * @param {File} file - 文件对象
 * @param {number} maxSizeMB - 最大文件大小(MB)
 * @returns {boolean} 是否有效
 */
export const isValidFileSize = (file, maxSizeMB = 50) => {
  const maxBytes = maxSizeMB * 1024 * 1024
  return file.size <= maxBytes
}

/**
 * 验证文件类型
 * @param {File} file - 文件对象
 * @param {array} allowedTypes - 允许的文件类型
 * @returns {boolean} 是否有效
 */
export const isValidFileType = (file, allowedTypes = ['pdf', 'docx', 'txt', 'pptx']) => {
  const fileType = getFileType(file.name)
  return allowedTypes.includes(fileType)
}
