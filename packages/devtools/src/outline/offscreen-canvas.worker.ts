/* eslint-disable @typescript-eslint/consistent-type-assertions */
// oxlint-disable foldkit/no-module-level-mutable-state
import {
  drawCanvas as drawShared,
  initCanvas,
  updateOutlines,
  updateScroll,
} from './shared.js'
import type { ActiveOutline, OutlineRect } from './types.js'

type InitMessage = Readonly<{
  type: 'init'
  canvas: OffscreenCanvas
  width: number
  height: number
  dpr: number
}>

type ResizeMessage = Readonly<{
  type: 'resize'
  width: number
  height: number
  dpr: number
}>

type DrawOutlinesMessage = Readonly<{
  type: 'draw-outlines'
  rects: ReadonlyArray<OutlineRect>
}>

type ScrollMessage = Readonly<{
  type: 'scroll'
  deltaX: number
  deltaY: number
}>

type ClearMessage = Readonly<{ type: 'clear' }>

type WorkerMessage =
  | InitMessage
  | ResizeMessage
  | DrawOutlinesMessage
  | ScrollMessage
  | ClearMessage

let canvas: OffscreenCanvas | null = null
let ctx: OffscreenCanvasRenderingContext2D | null = null
let dpr = 1
const MAX_CANVAS_DIM = 4096
const activeOutlines = new Map<string, ActiveOutline>()

const clampedSize = (size: number, dprVal: number): number =>
  Math.min(size * dprVal, MAX_CANVAS_DIM * dprVal)
let rafId: number | undefined
let isDrawing = false

const runDraw = (): boolean => {
  if (!ctx || !canvas) {
    return false
  }
  return drawShared(ctx, canvas, dpr, activeOutlines)
}

const scheduleDraw = (): void => {
  if (isDrawing) {
    return
  }
  isDrawing = true
  const draw = (): void => {
    if (!canvas || !ctx) {
      isDrawing = false
      return
    }
    const hasMore = runDraw()
    if (hasMore) {
      if (typeof globalThis.requestAnimationFrame === 'function') {
        rafId = globalThis.requestAnimationFrame(draw)
      } else {
        rafId = globalThis.setTimeout(draw, 16) as unknown as number
      }
    } else {
      isDrawing = false
    }
  }
  if (typeof globalThis.requestAnimationFrame === 'function') {
    rafId = globalThis.requestAnimationFrame(draw)
  } else {
    rafId = globalThis.setTimeout(draw, 16) as unknown as number
  }
}

self.onmessage = (event: MessageEvent<WorkerMessage>): void => {
  const data = event.data
  switch (data.type) {
    case 'init': {
      canvas = data.canvas
      dpr = data.dpr
      canvas.width = clampedSize(data.width, dpr)
      canvas.height = clampedSize(data.height, dpr)
      const maybeCtx = initCanvas(canvas, dpr)
      ctx = maybeCtx as OffscreenCanvasRenderingContext2D | null
      break
    }
    case 'resize': {
      if (!canvas || !ctx) {
        break
      }
      dpr = data.dpr
      canvas.width = clampedSize(data.width, dpr)
      canvas.height = clampedSize(data.height, dpr)
      ctx.resetTransform()
      ctx.scale(dpr, dpr)
      if (activeOutlines.size > 0) {
        scheduleDraw()
      }
      break
    }
    case 'draw-outlines': {
      updateOutlines(activeOutlines, data.rects)
      scheduleDraw()
      break
    }
    case 'scroll': {
      if (activeOutlines.size > 0) {
        updateScroll(activeOutlines, data.deltaX, data.deltaY)
        scheduleDraw()
      }
      break
    }
    case 'clear': {
      activeOutlines.clear()
      if (canvas && ctx) {
        ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr)
      }
      if (rafId !== undefined) {
        if (typeof globalThis.cancelAnimationFrame === 'function') {
          globalThis.cancelAnimationFrame(rafId)
        } else {
          globalThis.clearTimeout(rafId)
        }
        rafId = undefined
      }
      isDrawing = false
      break
    }
  }
}
