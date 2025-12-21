import { useState, useEffect, useMemo, useRef } from 'react'
import { XMarkIcon, DocumentDuplicateIcon, CodeBracketIcon, PhotoIcon, DocumentTextIcon, ChevronLeftIcon } from '@heroicons/react/24/outline'

interface Sticker {
  id: string
  type: 'text' | 'code' | 'image'
  title: string
  content: string
}

// 便签颜色
const COLORS = [
  { bg: 'bg-yellow-100', border: 'border-yellow-200', text: 'text-yellow-800' },
  { bg: 'bg-pink-100', border: 'border-pink-200', text: 'text-pink-800' },
  { bg: 'bg-blue-100', border: 'border-blue-200', text: 'text-blue-800' },
  { bg: 'bg-green-100', border: 'border-green-200', text: 'text-green-800' },
  { bg: 'bg-purple-100', border: 'border-purple-200', text: 'text-purple-800' },
  { bg: 'bg-orange-100', border: 'border-orange-200', text: 'text-orange-800' },
]

// 生成随机位置（更自由的分布，允许部分遮挡登录框）
function generatePositions(count: number) {
  const positions: { x: number; y: number; rotation: number; zIndex: number }[] = []
  
  // 定义多个区域，包括可以部分遮挡登录框的边缘区域
  const zones = [
    // 四角区域
    { xMin: -5, xMax: 25, yMin: -5, yMax: 25 },   // 左上
    { xMin: 75, xMax: 105, yMin: -5, yMax: 25 },  // 右上
    { xMin: -5, xMax: 25, yMin: 75, yMax: 105 },  // 左下
    { xMin: 75, xMax: 105, yMin: 75, yMax: 105 }, // 右下
    // 边缘区域（可以部分藏到登录框下面）
    { xMin: 25, xMax: 40, yMin: 10, yMax: 90 },   // 左侧边缘
    { xMin: 60, xMax: 75, yMin: 10, yMax: 90 },   // 右侧边缘
    { xMin: 20, xMax: 80, yMin: -5, yMax: 20 },   // 顶部
    { xMin: 20, xMax: 80, yMin: 80, yMax: 105 },  // 底部
  ]
  
  for (let i = 0; i < count; i++) {
    const zone = zones[i % zones.length]
    const x = zone.xMin + Math.random() * (zone.xMax - zone.xMin)
    const y = zone.yMin + Math.random() * (zone.yMax - zone.yMin)
    
    // 靠近中心的便签 z-index 更低（藏在登录框下面）
    const distFromCenter = Math.sqrt(Math.pow(x - 50, 2) + Math.pow(y - 50, 2))
    const zIndex = distFromCenter < 25 ? 5 : 20
    
    positions.push({
      x, y,
      rotation: -8 + Math.random() * 16,
      zIndex
    })
  }
  return positions
}

interface PublicStickersProps {
  onShowMobileList?: () => void
}

export default function PublicStickers({ onShowMobileList }: PublicStickersProps) {
  const [stickers, setStickers] = useState<Sticker[]>([])
  const [selectedSticker, setSelectedSticker] = useState<Sticker | null>(null)
  const [copied, setCopied] = useState(false)
  // 30% 概率显示跑出来的便签
  const showEscapedSticker = useRef(Math.random() < 0.3)

  useEffect(() => {
    fetch('/api/clipboard/public/stickers')
      .then(res => res.json())
      .then(data => {
        if (data.success) setStickers(data.data || [])
      })
      .catch(() => {})
  }, [])

  // 为每个便签分配随机颜色和位置
  const stickerStyles = useMemo(() => {
    const positions = generatePositions(stickers.length)
    return stickers.map((_, i) => ({
      color: COLORS[i % COLORS.length],
      position: positions[i] || { x: 10, y: 10, rotation: 0, zIndex: 20 }
    }))
  }, [stickers.length])

  const copyContent = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {}
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'code': return CodeBracketIcon
      case 'image': return PhotoIcon
      default: return DocumentTextIcon
    }
  }

  if (stickers.length === 0) return null

  return (
    <>
      {/* 桌面端：散落的便签 */}
      <div className="hidden md:block fixed inset-0 pointer-events-none overflow-hidden">
        {stickers.map((sticker, i) => {
          const style = stickerStyles[i]
          const TypeIcon = getTypeIcon(sticker.type)
          return (
            <div
              key={sticker.id}
              className={`absolute w-40 pointer-events-auto cursor-pointer transition-all duration-200 hover:scale-105 hover:shadow-xl hover:!z-50 ${style.color.bg} ${style.color.border} border rounded-lg shadow-md`}
              style={{
                left: `${style.position.x}%`,
                top: `${style.position.y}%`,
                transform: `translate(-50%, -50%) rotate(${style.position.rotation}deg)`,
                zIndex: style.position.zIndex,
              }}
              onClick={() => setSelectedSticker(sticker)}
            >
              <div className="p-3">
                <div className={`flex items-center gap-2 mb-2 ${style.color.text}`}>
                  <TypeIcon className="w-4 h-4" />
                  <span className="text-sm font-medium truncate">{sticker.title || '无标题'}</span>
                </div>
                <div className={`text-xs ${style.color.text} opacity-80 line-clamp-3`}>
                  {sticker.type === 'image' ? '[图片]' : sticker.content.slice(0, 80)}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* 移动端：底部标签露头 */}
      <div 
        className="md:hidden fixed bottom-0 left-0 right-0 flex justify-center gap-2 px-4 cursor-pointer"
        onClick={onShowMobileList}
      >
        {stickers.slice(0, 5).map((sticker, i) => {
          const color = COLORS[i % COLORS.length]
          return (
            <div
              key={sticker.id}
              className={`${color.bg} ${color.border} border-t border-x rounded-t-lg px-3 py-2 transform translate-y-8 hover:translate-y-4 transition-transform shadow-md`}
              style={{ transform: `translateY(60%) rotate(${-4 + i * 2}deg)` }}
            >
              <span className={`text-xs font-medium ${color.text} truncate block max-w-16`}>
                {sticker.title || '便签'}
              </span>
            </div>
          )
        })}
        {stickers.length > 5 && (
          <div className="bg-gray-100 border-gray-200 border-t border-x rounded-t-lg px-3 py-2 transform translate-y-8">
            <span className="text-xs text-gray-600">+{stickers.length - 5}</span>
          </div>
        )}
      </div>

      {/* 移动端：30%概率跑出来的便签 - 显示在登录框下方、底部标签栏上方 */}
      {showEscapedSticker.current && stickers.length > 0 && (() => {
        const sticker = stickers[0]
        const color = COLORS[0]
        return (
          <div
            className="md:hidden fixed left-1/2 -translate-x-1/2 cursor-pointer z-10 animate-wiggle"
            style={{ bottom: '80px' }}
            onClick={onShowMobileList}
          >
            <div 
              className={`${color.bg} ${color.border} border rounded-lg px-4 py-2 shadow-lg`}
              style={{ transform: 'rotate(-3deg)' }}
            >
              <span className={`text-xs font-medium ${color.text} truncate block max-w-24`}>
                {sticker.title || '便签'}
              </span>
            </div>
          </div>
        )
      })()}

      {/* 详情弹窗 */}
      {selectedSticker && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedSticker(null)}
        >
          <div 
            className="bg-white rounded-2xl max-w-lg w-full max-h-[80vh] overflow-hidden shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-2">
                {(() => {
                  const TypeIcon = getTypeIcon(selectedSticker.type)
                  return <TypeIcon className="w-5 h-5 text-primary" />
                })()}
                <h3 className="font-semibold text-lg">{selectedSticker.title || '无标题'}</h3>
              </div>
              <button 
                onClick={() => setSelectedSticker(null)}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-auto max-h-[60vh]">
              {selectedSticker.type === 'image' ? (
                <img src={selectedSticker.content} alt="" className="max-w-full rounded-lg" />
              ) : selectedSticker.type === 'code' ? (
                <pre className="bg-gray-900 text-green-400 p-4 rounded-xl text-sm font-mono overflow-x-auto whitespace-pre-wrap">
                  {selectedSticker.content}
                </pre>
              ) : (
                <p className="text-gray-700 whitespace-pre-wrap">{selectedSticker.content}</p>
              )}
            </div>
            <div className="p-4 border-t flex justify-end">
              <button
                onClick={() => copyContent(selectedSticker.content)}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl hover:bg-primary-hover transition"
              >
                <DocumentDuplicateIcon className="w-4 h-4" />
                {copied ? '已复制' : '复制内容'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// 移动端便签列表组件
export function MobileStickerList({ onClose }: { onClose: () => void }) {
  const [stickers, setStickers] = useState<Sticker[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetch('/api/clipboard/public/stickers')
      .then(res => res.json())
      .then(data => {
        if (data.success) setStickers(data.data || [])
      })
      .catch(() => {})
  }, [])

  const copyContent = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {}
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'code': return CodeBracketIcon
      case 'image': return PhotoIcon
      default: return DocumentTextIcon
    }
  }

  return (
    <div className="fixed inset-0 bg-gradient-to-b from-gray-50 to-white z-50 overflow-auto">
      {/* 头部 */}
      <div className="sticky top-0 bg-white/80 backdrop-blur-sm border-b px-4 py-3 flex items-center gap-3">
        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition">
          <ChevronLeftIcon className="w-5 h-5" />
        </button>
        <h2 className="font-semibold text-lg">公开便签</h2>
      </div>

      {/* 便签列表 */}
      <div className="p-4 space-y-3">
        {stickers.map((sticker, i) => {
          const color = COLORS[i % COLORS.length]
          const TypeIcon = getTypeIcon(sticker.type)
          const isExpanded = expandedId === sticker.id

          return (
            <div
              key={sticker.id}
              className={`${color.bg} ${color.border} border rounded-xl overflow-hidden shadow-sm transition-all`}
            >
              <div 
                className="p-4 cursor-pointer"
                onClick={() => setExpandedId(isExpanded ? null : sticker.id)}
              >
                <div className={`flex items-center gap-2 ${color.text}`}>
                  <TypeIcon className="w-5 h-5" />
                  <span className="font-medium flex-1">{sticker.title || '无标题'}</span>
                  <span className="text-xs opacity-60">{isExpanded ? '收起' : '展开'}</span>
                </div>
                {!isExpanded && (
                  <p className={`mt-2 text-sm ${color.text} opacity-70 line-clamp-2`}>
                    {sticker.type === 'image' ? '[图片]' : sticker.content.slice(0, 100)}
                  </p>
                )}
              </div>

              {isExpanded && (
                <div className="px-4 pb-4">
                  <div className="bg-white/50 rounded-lg p-3 mb-3">
                    {sticker.type === 'image' ? (
                      <img src={sticker.content} alt="" className="max-w-full rounded-lg" />
                    ) : sticker.type === 'code' ? (
                      <pre className="bg-gray-900 text-green-400 p-3 rounded-lg text-sm font-mono overflow-x-auto whitespace-pre-wrap">
                        {sticker.content}
                      </pre>
                    ) : (
                      <p className="text-gray-700 whitespace-pre-wrap text-sm">{sticker.content}</p>
                    )}
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); copyContent(sticker.content) }}
                    className={`flex items-center gap-2 px-4 py-2 bg-white/70 ${color.text} rounded-lg text-sm font-medium`}
                  >
                    <DocumentDuplicateIcon className="w-4 h-4" />
                    {copied ? '已复制' : '复制'}
                  </button>
                </div>
              )}
            </div>
          )
        })}

        {stickers.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            暂无公开便签
          </div>
        )}
      </div>
    </div>
  )
}
