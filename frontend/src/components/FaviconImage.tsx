import { useState, useEffect } from 'react'

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
    }
  }

  // 重置状态当 URL 改变时
  useEffect(() => {
    setSourceIndex(0)
    setShowLetter(false)
    setTriedDirect(false)
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

  // 确定图标源
  let imgSrc = ''
  if (triedDirect && domain) {
    imgSrc = `https://${domain}/favicon.ico`
  } else {
    imgSrc = getFavicon(sourceIndex)
  }

  return (
    <img
      src={imgSrc}
      alt=""
      className={`${className} rounded object-cover`}
      onError={handleError}
      onLoad={handleLoad}
    />
  )
}
