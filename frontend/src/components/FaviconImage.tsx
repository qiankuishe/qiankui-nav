import { useState, useEffect, useRef } from 'react'
import { getFavicon as getCachedFavicon, setFavicon as cacheFavicon } from '../utils/faviconCache'

interface FaviconImageProps {
  url: string
  title: string
  className?: string
}

// 多个 Google favicon 源
const FAVICON_SOURCES = [
  (domain: string) =>
    `https://www.google.com/s2/favicons?sz=64&domain=${domain}`,
  (domain: string) =>
    `https://t0.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://${domain}&size=64`,
  (domain: string) =>
    `https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://${domain}&size=64`,
  (domain: string) =>
    `https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://${domain}&size=64`,
]

function getDomain(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return ''
  }
}

export default function FaviconImage({ url, title, className = 'w-7 h-7' }: FaviconImageProps) {
  const [sourceIndex, setSourceIndex] = useState(0)
  const [showLetter, setShowLetter] = useState(false)
  const [triedDirect, setTriedDirect] = useState(false)
  const [cachedDataUrl, setCachedDataUrl] = useState<string | null>(null)
  const [cacheChecked, setCacheChecked] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)

  const domain = getDomain(url)

  const getFavicon = (sourceIdx: number = 0): string => {
    if (!domain) return ''
    const source = FAVICON_SOURCES[sourceIdx] || FAVICON_SOURCES[0]
    return source(domain)
  }

  const tryNextSource = () => {
    const nextIdx = sourceIndex + 1
    // 还有备用源可用
    if (nextIdx < FAVICON_SOURCES.length) {
      setSourceIndex(nextIdx)
      return
    }
    // 尝试直接获取网站的 favicon.ico
    if (!triedDirect && domain) {
      setTriedDirect(true)
      return
    }
    // 所有源都失败，显示字母
    setShowLetter(true)
  }

  const handleError = () => {
    tryNextSource()
  }

  const handleLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.target as HTMLImageElement
    // 只检测是否太小（≤16px），太小说明是默认图标
    if (img.naturalWidth <= 16) {
      tryNextSource()
      return
    }
    
    // 成功加载，缓存到 IndexedDB
    if (!cachedDataUrl && img.src && !img.src.startsWith('data:')) {
      // 将图片转换为 data URL 并缓存
      try {
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.drawImage(img, 0, 0)
          const dataUrl = canvas.toDataURL('image/png')
          cacheFavicon(url, dataUrl).catch(() => {})
        }
      } catch {
        // 跨域图片无法转换，忽略
      }
    }
  }

  // 检查缓存
  useEffect(() => {
    let mounted = true
    
    const checkCache = async () => {
      if (!domain) {
        setCacheChecked(true)
        return
      }
      
      try {
        const cached = await getCachedFavicon(url)
        if (mounted && cached) {
          setCachedDataUrl(cached)
        }
      } catch {
        // 忽略缓存错误
      }
      
      if (mounted) {
        setCacheChecked(true)
      }
    }
    
    checkCache()
    
    return () => {
      mounted = false
    }
  }, [url, domain])

  // 重置状态当 URL 改变时
  useEffect(() => {
    setSourceIndex(0)
    setShowLetter(false)
    setTriedDirect(false)
    setCachedDataUrl(null)
    setCacheChecked(false)
  }, [url])

  // 显示字母回退
  if (showLetter || !domain) {
    return (
      <div
        className={`${className} flex items-center justify-center rounded-lg bg-primary text-white`}
      >
        <span className="text-sm font-semibold">
          {title[0]?.toUpperCase() || '?'}
        </span>
      </div>
    )
  }

  // 如果有缓存，直接使用
  if (cachedDataUrl) {
    return (
      <img
        src={cachedDataUrl}
        alt=""
        className={`${className} rounded object-cover`}
      />
    )
  }

  // 等待缓存检查完成
  if (!cacheChecked) {
    return (
      <div className={`${className} rounded bg-hover-bg animate-pulse`} />
    )
  }

  // 确定图标源
  let imgSrc = ''
  if (triedDirect && domain) {
    imgSrc = `https://${domain}/favicon.ico`
  } else {
    imgSrc = getFavicon(sourceIndex)
  }

  return (
    <img
      ref={imgRef}
      src={imgSrc}
      alt=""
      className={`${className} rounded object-cover`}
      crossOrigin="anonymous"
      onError={handleError}
      onLoad={handleLoad}
    />
  )
}
