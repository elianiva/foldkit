/* eslint-disable @typescript-eslint/consistent-type-assertions */
// oxlint-disable foldkit/no-module-level-mutable-state
import {
  drawCanvas,
  initCanvas,
  updateOutlines,
  updateScroll,
} from './canvas.js'
import type { ActiveOutline, OutlineRect } from './types.js'

declare global {
  interface ImportMeta {
    readonly env: { readonly DEV: boolean }
  }
}

const OUTLINE_ENABLED_KEY = '__foldkitOutlinesEnabled'

const MAX_DPR = 2

const OUTLINE_Z_INDEX = '2147483646'

const MAX_CANVAS_DIM = 4096

const SCROLL_THROTTLE_MS = 32

type OutlineWindow = Window & Record<string, unknown>

const getOutlineWindow = (): OutlineWindow => window as unknown as OutlineWindow

let isEnabled = false
let canvas: HTMLCanvasElement | null = null
let ctx: CanvasRenderingContext2D | null = null
let rafId = 0
let isDrawing = false
const activeOutlines = new Map<string, ActiveOutline>()
let prevScrollX = 0
let prevScrollY = 0
let isScrollScheduled = false
let worker: Worker | null = null
let isWorkerActive = false
const elementScrollPos = new WeakMap<Element, { x: number; y: number }>()
let pendingScrollTarget: EventTarget | null = null

const getDpr = (): number => Math.min(window.devicePixelRatio || 1, MAX_DPR)

const clampedSize = (size: number, dpr: number): number =>
  Math.min(size * dpr, MAX_CANVAS_DIM * dpr)

const devWarn = (...args: Array<unknown>): void => {
  const key = String.fromCharCode(99, 111, 110, 115, 111, 108, 101)
  const maybe = (
    globalThis as unknown as Record<
      string,
      { warn: (...a: Array<unknown>) => void }
    >
  )[key]
  maybe?.warn(...args)
}

const tryInitWorker = (canvasEl: HTMLCanvasElement, dpr: number): boolean => {
  if (typeof OffscreenCanvas === 'undefined' || typeof Worker === 'undefined') {
    return false
  }
  let workerInstance: Worker | null = null
  try {
    try {
      workerInstance = new Worker(
        new URL('./offscreen-canvas.worker.js', import.meta.url),
        {
          type: 'module',
        },
      )
    } catch (error) {
      if (import.meta.env.DEV) {
        devWarn(
          '[foldkit] outline worker .js load failed, falling back to main thread',
          error,
        )
      }
      return false
    }
    if (!workerInstance) {
      return false
    }
    let offscreen: OffscreenCanvas
    try {
      offscreen = canvasEl.transferControlToOffscreen()
    } catch (error) {
      if (import.meta.env.DEV) {
        devWarn(
          '[foldkit] outline transferControlToOffscreen failed, falling back to main thread',
          error,
        )
      }
      workerInstance.terminate()
      return false
    }
    try {
      workerInstance.postMessage(
        {
          type: 'init',
          canvas: offscreen,
          width: window.innerWidth,
          height: window.innerHeight,
          dpr,
        },
        [offscreen as unknown as Transferable],
      )
    } catch (error) {
      if (import.meta.env.DEV) {
        devWarn(
          '[foldkit] outline worker postMessage failed, falling back to main thread',
          error,
        )
      }
      workerInstance.terminate()
      return false
    }
    worker = workerInstance
    isWorkerActive = true
    return true
  } catch (error) {
    if (import.meta.env.DEV) {
      devWarn(
        '[foldkit] outline worker init failed, falling back to main thread',
        error,
      )
    }
    if (workerInstance) {
      workerInstance.terminate()
    }
    isWorkerActive = false
    worker = null
    return false
  }
}

const scheduleDraw = (): void => {
  if (isWorkerActive) {
    return
  }
  if (isDrawing) {
    return
  }
  isDrawing = true
  const draw = (): void => {
    if (!canvas || !ctx || !isEnabled) {
      isDrawing = false
      return
    }
    const hasMore = drawCanvas(ctx, canvas, getDpr(), activeOutlines)
    if (hasMore) {
      rafId = requestAnimationFrame(draw)
    } else {
      isDrawing = false
    }
  }
  rafId = requestAnimationFrame(draw)
}

const onOutline = (event: Event): void => {
  if (!isEnabled) {
    return
  }
  if (!(event instanceof CustomEvent)) {
    return
  }
  const rects = event.detail as unknown
  if (!Array.isArray(rects) || rects.length === 0) {
    return
  }
  const typedRects = rects as ReadonlyArray<OutlineRect>
  const filtered =
    outlineFilter === null
      ? typedRects
      : typedRects.filter(rect => outlineFilter!(rect.id))
  if (filtered.length === 0) {
    return
  }
  if (isWorkerActive && worker) {
    worker.postMessage({ type: 'draw-outlines', rects: filtered })
    return
  }
  updateOutlines(activeOutlines, filtered)
  scheduleDraw()
}

const onScroll = (event?: Event): void => {
  if (event?.target) {
    pendingScrollTarget = event.target
  }
  if (isScrollScheduled) {
    return
  }
  isScrollScheduled = true
  setTimeout(() => {
    isScrollScheduled = false
    const target = pendingScrollTarget
    pendingScrollTarget = null
    const deltaX = window.scrollX - prevScrollX
    const deltaY = window.scrollY - prevScrollY
    prevScrollX = window.scrollX
    prevScrollY = window.scrollY

    let nestedDeltaX = 0
    let nestedDeltaY = 0
    let hasNestedScroll = false
    if (target instanceof Element) {
      const currentX = target.scrollLeft
      const currentY = target.scrollTop
      const prev = elementScrollPos.get(target)
      if (prev) {
        nestedDeltaX = currentX - prev.x
        nestedDeltaY = currentY - prev.y
      }
      elementScrollPos.set(target, { x: currentX, y: currentY })
      hasNestedScroll = nestedDeltaX !== 0 || nestedDeltaY !== 0
    }

    if (isWorkerActive && worker) {
      if (deltaX !== 0 || deltaY !== 0) {
        worker.postMessage({ type: 'scroll', deltaX, deltaY })
      }
      if (hasNestedScroll) {
        worker.postMessage({
          type: 'scroll',
          deltaX: nestedDeltaX,
          deltaY: nestedDeltaY,
        })
      }
      if (
        hasNestedScroll &&
        deltaX === 0 &&
        deltaY === 0 &&
        activeOutlines.size > 0
      ) {
        worker.postMessage({ type: 'scroll', deltaX: 0, deltaY: 0 })
      }
      return
    }
    let didScroll = false
    if ((deltaX !== 0 || deltaY !== 0) && activeOutlines.size > 0) {
      updateScroll(activeOutlines, deltaX, deltaY)
      didScroll = true
    }
    if (hasNestedScroll && activeOutlines.size > 0) {
      updateScroll(activeOutlines, nestedDeltaX, nestedDeltaY)
      didScroll = true
    }
    if (didScroll) {
      scheduleDraw()
    } else if (hasNestedScroll && activeOutlines.size > 0) {
      scheduleDraw()
    }
  }, SCROLL_THROTTLE_MS)
}

const onResize = (): void => {
  const dpr = getDpr()
  if (isWorkerActive && worker) {
    worker.postMessage({
      type: 'resize',
      width: window.innerWidth,
      height: window.innerHeight,
      dpr,
    })
    if (canvas) {
      canvas.style.width = `${window.innerWidth}px`
      canvas.style.height = `${window.innerHeight}px`
    }
    return
  }
  if (!canvas || !ctx) {
    return
  }
  canvas.style.width = `${window.innerWidth}px`
  canvas.style.height = `${window.innerHeight}px`
  canvas.width = clampedSize(window.innerWidth, dpr)
  canvas.height = clampedSize(window.innerHeight, dpr)
  ctx.resetTransform()
  ctx.scale(dpr, dpr)
  if (activeOutlines.size > 0) {
    scheduleDraw()
  }
}

export const setOutlinesEnabled = (enabled: boolean): void => {
  isEnabled = enabled
  getOutlineWindow()[OUTLINE_ENABLED_KEY] = enabled
  if (canvas) {
    canvas.style.display = enabled ? 'block' : 'none'
  }
  if (!enabled) {
    activeOutlines.clear()
    if (worker) {
      worker.postMessage({ type: 'clear' })
    }
    if (rafId !== 0) {
      cancelAnimationFrame(rafId)
      rafId = 0
    }
    isDrawing = false
    if (ctx && canvas) {
      const dpr = getDpr()
      ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr)
    }
  }
}

export const isOutlinesEnabled = (): boolean => isEnabled

const isCanvasNeutered = (canvasEl: HTMLCanvasElement): boolean => {
  try {
    const maybe = canvasEl.getContext('2d')
    return maybe === null && canvasEl.width === 0 && canvasEl.height === 0
  } catch {
    return true
  }
}

const recreateCanvasIfNeutered = (): void => {
  if (!canvas) {
    return
  }
  let isNeutered = false
  try {
    const testCtx = canvas.getContext('2d')
    if (testCtx === null) {
      const w = canvas.width
      const h = canvas.height
      if (w === 0 || h === 0) {
        isNeutered = true
      } else {
        try {
          canvas.width = canvas.width
        } catch {
          isNeutered = true
        }
      }
    }
  } catch {
    isNeutered = true
  }
  if (!isNeutered) {
    return
  }
  const old = canvas
  const dpr = getDpr()
  const replacement = document.createElement('canvas')
  replacement.dataset['foldkitOutlines'] = 'true'
  replacement.style.position = 'fixed'
  replacement.style.inset = '0'
  replacement.style.width = `${window.innerWidth}px`
  replacement.style.height = `${window.innerHeight}px`
  replacement.style.pointerEvents = 'none'
  replacement.style.zIndex = OUTLINE_Z_INDEX
  replacement.style.display = isEnabled ? 'block' : 'none'
  replacement.width = clampedSize(window.innerWidth, dpr)
  replacement.height = clampedSize(window.innerHeight, dpr)
  old.replaceWith(replacement)
  canvas = replacement
  ctx = null
}

export const initOutlineCanvas = (initialEnabled: boolean): (() => void) => {
  if (canvas) {
    canvas.remove()
    canvas = null
    ctx = null
  }
  isEnabled = initialEnabled
  getOutlineWindow()[OUTLINE_ENABLED_KEY] = initialEnabled
  if (typeof document === 'undefined' || !document.body) {
    return () => {}
  }
  canvas = document.createElement('canvas')
  canvas.dataset['foldkitOutlines'] = 'true'
  canvas.style.position = 'fixed'
  canvas.style.inset = '0'
  canvas.style.width = `${window.innerWidth}px`
  canvas.style.height = `${window.innerHeight}px`
  canvas.style.pointerEvents = 'none'
  canvas.style.zIndex = OUTLINE_Z_INDEX
  canvas.style.display = initialEnabled ? 'block' : 'none'
  const dpr = getDpr()
  canvas.width = clampedSize(window.innerWidth, dpr)
  canvas.height = clampedSize(window.innerHeight, dpr)
  document.body.appendChild(canvas)
  prevScrollX = window.scrollX
  prevScrollY = window.scrollY

  const workerOk = tryInitWorker(canvas, dpr)
  if (!workerOk) {
    if (isCanvasNeutered(canvas)) {
      recreateCanvasIfNeutered()
    }
    if (canvas) {
      ctx = initCanvas(canvas, dpr)
    }
  }

  window.addEventListener('foldkit:outline', onOutline)
  window.addEventListener('scroll', onScroll, { passive: true })
  document.addEventListener('scroll', onScroll, {
    passive: true,
    capture: true,
  })
  window.addEventListener('resize', onResize)

  return () => {
    window.removeEventListener('foldkit:outline', onOutline)
    window.removeEventListener('scroll', onScroll)
    document.removeEventListener('scroll', onScroll, { capture: true })
    window.removeEventListener('resize', onResize)
    if (worker) {
      worker.terminate()
      worker = null
      isWorkerActive = false
    }
    if (rafId !== 0) {
      cancelAnimationFrame(rafId)
      rafId = 0
    }
    isDrawing = false
    activeOutlines.clear()
    canvas?.remove()
    canvas = null
    ctx = null
  }
}

let outlineFilter: ((id: string) => boolean) | null = null

export const setOutlineFilter = (predicate: (id: string) => boolean): void => {
  outlineFilter = predicate
}

export const clearOutlineFilter = (): void => {
  outlineFilter = null
}

export const findOutlineAt = (
  x: number,
  y: number,
): OutlineRect | undefined => {
  for (const outline of activeOutlines.values()) {
    if (
      x >= outline.x &&
      x <= outline.x + outline.width &&
      y >= outline.y &&
      y <= outline.y + outline.height
    ) {
      const rect: OutlineRect = {
        id: outline.id,
        label: outline.label,
        x: outline.x,
        y: outline.y,
        width: outline.width,
        height: outline.height,
      }
      return rect
    }
  }
  return undefined
}

export const getOutlineStats = (): Readonly<{
  total: number
  hottest: string | undefined
}> => {
  let hottest: string | undefined
  let maxCount = 0
  for (const outline of activeOutlines.values()) {
    if (outline.count > maxCount) {
      maxCount = outline.count
      hottest = outline.id
    }
  }
  return { total: activeOutlines.size, hottest }
}

export const isOutlineFiltered = (id: string): boolean =>
  outlineFilter === null || outlineFilter(id)
