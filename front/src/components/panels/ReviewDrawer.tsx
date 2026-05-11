import { useEffect, useRef, useState } from 'react'
import { color } from '../../styles/tokens'
import { ReviewPanel } from './ReviewPanel'

const MIN_WIDTH = 360
const MAX_WIDTH = 1200
const DEFAULT_WIDTH = 480
const LS_WIDTH_KEY = 'mzc.review_drawer.width.v1'

/**
 * ReviewDrawer — right-side drawer that hosts the Submission Readiness
 * review. Supports:
 *  - drag handle on the left edge to resize the drawer (persisted)
 *  - fullscreen toggle for focused review work
 */
export function ReviewDrawer({
  docId,
  onClose,
}: {
  docId: string
  onClose: () => void
}) {
  const [width, setWidth] = useState<number>(() => {
    try {
      const raw = localStorage.getItem(LS_WIDTH_KEY)
      if (raw) {
        const n = Number(raw)
        if (Number.isFinite(n) && n >= MIN_WIDTH && n <= MAX_WIDTH) return n
      }
    } catch { /* ignore */ }
    return DEFAULT_WIDTH
  })
  const [fullscreen, setFullscreen] = useState(false)
  const dragState = useRef<{ startX: number; startWidth: number } | null>(null)

  // Persist width
  useEffect(() => {
    try { localStorage.setItem(LS_WIDTH_KEY, String(width)) } catch { /* ignore */ }
  }, [width])

  const handleMouseDown = (e: React.MouseEvent) => {
    if (fullscreen) return
    dragState.current = { startX: e.clientX, startWidth: width }
    e.preventDefault()
  }

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragState.current) return
      const delta = dragState.current.startX - e.clientX
      const next = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, dragState.current.startWidth + delta))
      setWidth(next)
    }
    const onUp = () => {
      dragState.current = null
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [])

  const effectiveWidth = fullscreen ? undefined : width

  return (
    <div
      className="review-drawer"
      style={{
        position: 'relative',
        width: fullscreen ? '100%' : effectiveWidth,
        minWidth: fullscreen ? 0 : width,
        flex: fullscreen ? 1 : `0 0 ${width}px`,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderLeft: fullscreen ? 'none' : `1px solid ${color.border}`,
        background: color.bgPrimary,
        flexShrink: 0,
      }}
      data-drawer-width={width}
      data-drawer-fullscreen={fullscreen ? '1' : '0'}
    >
      {/* Drag handle (left edge) */}
      {!fullscreen && (
        <div
          onMouseDown={handleMouseDown}
          role="separator"
          aria-orientation="vertical"
          title="드래그하여 크기 조절"
          className="review-drawer-drag-handle"
        />
      )}

      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
        padding: '10px 12px', borderBottom: `1px solid ${color.border}`, background: color.bgSurface,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: color.textPrimary, letterSpacing: '-0.01em' }}>Review</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button
            onClick={() => setFullscreen(v => !v)}
            className="mzc-btn mzc-btn-ghost"
            title={fullscreen ? '원래 크기로' : '전체 화면'}
            style={{ padding: '2px 6px', fontSize: 14, lineHeight: 1 }}
          >
            {fullscreen ? '⤡' : '⤢'}
          </button>
          <button
            onClick={onClose}
            className="mzc-btn mzc-btn-ghost"
            title="닫기"
            style={{ padding: '2px 6px', fontSize: 14, lineHeight: 1 }}
          >
            ✕
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        <ReviewPanel docId={docId} />
      </div>
    </div>
  )
}
