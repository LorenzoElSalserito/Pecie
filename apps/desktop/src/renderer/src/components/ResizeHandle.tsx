import { useCallback, useEffect, useRef } from 'react'

type ResizeHandleProps = {
  side: 'left' | 'right'
  onResize: (deltaX: number) => void
  onResizeEnd: () => void
}

export function ResizeHandle({ side, onResize, onResizeEnd }: ResizeHandleProps): React.JSX.Element {
  const startXRef = useRef(0)
  const isDragging = useRef(false)

  const handleMouseMove = useCallback(
    (event: MouseEvent) => {
      if (!isDragging.current) return
      const delta = event.clientX - startXRef.current
      startXRef.current = event.clientX
      onResize(delta)
    },
    [onResize]
  )

  const handleMouseUp = useCallback(() => {
    if (!isDragging.current) return
    isDragging.current = false
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    onResizeEnd()
  }, [onResizeEnd])

  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [handleMouseMove, handleMouseUp])

  return (
    <div
      aria-hidden="true"
      className={`resize-handle resize-handle--${side}`}
      onMouseDown={(event) => {
        event.preventDefault()
        startXRef.current = event.clientX
        isDragging.current = true
        document.body.style.cursor = 'col-resize'
        document.body.style.userSelect = 'none'
      }}
    />
  )
}
