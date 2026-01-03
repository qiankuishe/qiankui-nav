/**
 * Favicon 缓存服务
 * 使用 IndexedDB 存储 favicon，支持 LRU 淘汰和过期机制
 */

const DB_NAME = 'favicon-cache'
const STORE_NAME = 'favicons'
const DB_VERSION = 1
const MAX_CACHE_SIZE = 50 * 1024 * 1024 // 50MB
const EXPIRY_DAYS = 7

interface FaviconCacheEntry {
  hostname: string
  dataUrl: string
  size: number
  cachedAt: number
  accessedAt: number
}

let db: IDBDatabase | null = null

async function openDB(): Promise<IDBDatabase> {
  if (db) return db

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      db = request.result
      resolve(db)
    }

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'hostname' })
        store.createIndex('accessedAt', 'accessedAt', { unique: false })
        store.createIndex('cachedAt', 'cachedAt', { unique: false })
      }
    }
  })
}

function getHostname(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

function isExpired(entry: FaviconCacheEntry): boolean {
  const expiryTime = EXPIRY_DAYS * 24 * 60 * 60 * 1000
  return Date.now() - entry.cachedAt > expiryTime
}

export async function getFavicon(url: string): Promise<string | null> {
  try {
    const database = await openDB()
    const hostname = getHostname(url)

    return new Promise((resolve) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.get(hostname)

      request.onsuccess = () => {
        const entry = request.result as FaviconCacheEntry | undefined
        
        if (!entry) {
          resolve(null)
          return
        }

        // 检查是否过期
        if (isExpired(entry)) {
          store.delete(hostname)
          resolve(null)
          return
        }

        // 更新访问时间
        entry.accessedAt = Date.now()
        store.put(entry)
        
        resolve(entry.dataUrl)
      }

      request.onerror = () => resolve(null)
    })
  } catch {
    return null
  }
}

export async function setFavicon(url: string, dataUrl: string): Promise<void> {
  try {
    const database = await openDB()
    const hostname = getHostname(url)
    const size = new Blob([dataUrl]).size

    // 检查缓存大小，必要时清理
    await ensureCacheSize(size)

    const entry: FaviconCacheEntry = {
      hostname,
      dataUrl,
      size,
      cachedAt: Date.now(),
      accessedAt: Date.now(),
    }

    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.put(entry)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  } catch (err) {
    console.error('Failed to cache favicon:', err)
  }
}

async function ensureCacheSize(newEntrySize: number): Promise<void> {
  try {
    const database = await openDB()
    
    return new Promise((resolve) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const index = store.index('accessedAt')
      
      let totalSize = 0
      const entriesToDelete: string[] = []
      
      const request = index.openCursor()
      
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result
        
        if (cursor) {
          const entry = cursor.value as FaviconCacheEntry
          
          // 删除过期条目
          if (isExpired(entry)) {
            entriesToDelete.push(entry.hostname)
          } else {
            totalSize += entry.size
          }
          
          cursor.continue()
        } else {
          // 遍历完成，检查是否需要 LRU 淘汰
          if (totalSize + newEntrySize > MAX_CACHE_SIZE) {
            // 需要淘汰，按访问时间排序删除最旧的
            evictLRU(store, totalSize + newEntrySize - MAX_CACHE_SIZE)
          }
          
          // 删除过期条目
          entriesToDelete.forEach(hostname => store.delete(hostname))
          
          resolve()
        }
      }
      
      request.onerror = () => resolve()
    })
  } catch {
    // 忽略错误
  }
}

async function evictLRU(store: IDBObjectStore, bytesToFree: number): Promise<void> {
  return new Promise((resolve) => {
    const index = store.index('accessedAt')
    const request = index.openCursor()
    let freedBytes = 0

    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result
      
      if (cursor && freedBytes < bytesToFree) {
        const entry = cursor.value as FaviconCacheEntry
        freedBytes += entry.size
        cursor.delete()
        cursor.continue()
      } else {
        resolve()
      }
    }

    request.onerror = () => resolve()
  })
}

export async function clearCache(): Promise<void> {
  try {
    const database = await openDB()
    
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.clear()

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  } catch (err) {
    console.error('Failed to clear favicon cache:', err)
  }
}

export async function getCacheStats(): Promise<{ count: number; size: number }> {
  try {
    const database = await openDB()
    
    return new Promise((resolve) => {
      const transaction = database.transaction(STORE_NAME, 'readonly')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.openCursor()
      
      let count = 0
      let size = 0

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result
        
        if (cursor) {
          const entry = cursor.value as FaviconCacheEntry
          if (!isExpired(entry)) {
            count++
            size += entry.size
          }
          cursor.continue()
        } else {
          resolve({ count, size })
        }
      }

      request.onerror = () => resolve({ count: 0, size: 0 })
    })
  } catch {
    return { count: 0, size: 0 }
  }
}
