/* eslint-disable @typescript-eslint/consistent-type-assertions */
// oxlint-disable foldkit/no-module-level-mutable-state
import { Match as M } from 'effect'

import { makeWorkerDrawLoop } from './drawLoop.js'
import { clampedCanvasSize } from './geometry.js'
import { updateOutlines, updateScroll } from './model.js'
import { drawFrame, initCanvas } from './render.js'
import type { ActiveOutline, OutlineRect } from './types.js'

type WorkerWireMessage =
  | Readonly<{
      type: 'init'
      canvas: OffscreenCanvas
      width: number
      height: number
      dpr: number
    }>
  | Readonly<{
      type: 'draw-outlines'
      rects: ReadonlyArray<OutlineRect>
    }>
  | Readonly<{ type: 'scroll'; deltaX: number; deltaY: number }>
  | Readonly<{
      type: 'resize'
      width: number
      height: number
      dpr: number
    }>
  | Readonly<{ type: 'clear' }>

let canvas: OffscreenCanvas | null = null
let ctx: OffscreenCanvasRenderingContext2D | null = null
let dpr = 1
const activeOutlines = new Map<string, ActiveOutline>()

const runDraw = (): boolean => {
  if (!ctx || !canvas) {
    return false
  }
  return drawFrame(ctx, canvas, dpr, activeOutlines)
}

const drawLoop = makeWorkerDrawLoop(runDraw)

const scheduleDraw = (): void => {
  drawLoop.schedule()
}

const handleWireMessage = (data: WorkerWireMessage): void => {
  M.value(data).pipe(
    M.discriminatorsExhaustive('type')({
      init: message => {
        canvas = message.canvas
        dpr = message.dpr
        canvas.width = clampedCanvasSize(message.width, dpr)
        canvas.height = clampedCanvasSize(message.height, dpr)
        const maybeCtx = initCanvas(canvas, dpr)
        ctx = maybeCtx as OffscreenCanvasRenderingContext2D | null
      },
      'draw-outlines': message => {
        updateOutlines(activeOutlines, message.rects)
        scheduleDraw()
      },
      scroll: message => {
        if (activeOutlines.size > 0) {
          updateScroll(activeOutlines, message.deltaX, message.deltaY)
          scheduleDraw()
        }
      },
      resize: message => {
        if (!canvas || !ctx) {
          return
        }
        dpr = message.dpr
        canvas.width = clampedCanvasSize(message.width, dpr)
        canvas.height = clampedCanvasSize(message.height, dpr)
        ctx.resetTransform()
        ctx.scale(dpr, dpr)
        if (activeOutlines.size > 0) {
          scheduleDraw()
        }
      },
      clear: () => {
        activeOutlines.clear()
        if (canvas && ctx) {
          ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr)
        }
        drawLoop.cancel()
      },
    }),
  )
}

self.onmessage = (event: MessageEvent<WorkerWireMessage>): void => {
  handleWireMessage(event.data)
}
