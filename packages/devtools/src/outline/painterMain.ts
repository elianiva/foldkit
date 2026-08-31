/* eslint-disable @typescript-eslint/consistent-type-assertions */
import { Effect, Ref } from 'effect'

import { OUTLINE_Z_INDEX } from './constants.js'
import { finalizeDrawLoop, makeDrawLoop } from './drawLoop.js'
import { clampedCanvasSize, getDpr } from './geometry.js'
import type { OutlinePainter } from './painter.js'
import { drawFrame, initCanvas } from './render.js'
import type { ActiveOutline } from './types.js'

const isCanvasNeutered = (canvasEl: HTMLCanvasElement): boolean => {
  try {
    const maybe = canvasEl.getContext('2d')
    return maybe === null && canvasEl.width === 0 && canvasEl.height === 0
  } catch {
    return true
  }
}

const recreateCanvasIfNeutered = (
  canvas: HTMLCanvasElement,
  isVisible: boolean,
): HTMLCanvasElement => {
  let isNeutered = false
  try {
    const testCtx = canvas.getContext('2d')
    if (testCtx === null) {
      const width = canvas.width
      const height = canvas.height
      if (width === 0 || height === 0) {
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
    return canvas
  }
  const dpr = getDpr()
  const replacement = document.createElement('canvas')
  replacement.dataset['foldkitOutlines'] = 'true'
  replacement.style.position = 'fixed'
  replacement.style.inset = '0'
  replacement.style.width = `${window.innerWidth}px`
  replacement.style.height = `${window.innerHeight}px`
  replacement.style.pointerEvents = 'none'
  replacement.style.zIndex = OUTLINE_Z_INDEX
  replacement.style.display = isVisible ? 'block' : 'none'
  replacement.width = clampedCanvasSize(window.innerWidth, dpr)
  replacement.height = clampedCanvasSize(window.innerHeight, dpr)
  canvas.replaceWith(replacement)
  return replacement
}

export const acquireMainPainter = (
  initialCanvas: HTMLCanvasElement,
  storeRef: Ref.Ref<Map<string, ActiveOutline>>,
  enabledRef: Ref.Ref<boolean>,
) =>
  Effect.gen(function* () {
    let canvas = initialCanvas
    let ctx: CanvasRenderingContext2D | null = null
    let dpr = getDpr()

    if (isCanvasNeutered(canvas)) {
      canvas = recreateCanvasIfNeutered(
        canvas,
        (yield* Ref.get(enabledRef)) === true,
      )
    }
    ctx = initCanvas(canvas, dpr) as CanvasRenderingContext2D | null

    const drawLoop = makeDrawLoop(() => {
      if (!ctx) {
        return false
      }
      const enabled = Ref.get(enabledRef)
      if (Effect.runSync(enabled) !== true) {
        return false
      }
      const store = Effect.runSync(Ref.get(storeRef))
      return drawFrame(ctx, canvas, getDpr(), store)
    })

    const scheduleIfStoreHasOutlines = (): void => {
      const store = Effect.runSync(Ref.get(storeRef))
      if (store.size > 0) {
        drawLoop.schedule()
      }
    }

    const painter: OutlinePainter = {
      pushRects: () => drawLoop.schedule(),
      applyScroll: (_deltaX, _deltaY) => scheduleIfStoreHasOutlines(),
      resize: (width, height, nextDpr) => {
        dpr = nextDpr
        canvas.style.width = `${width}px`
        canvas.style.height = `${height}px`
        canvas.width = clampedCanvasSize(width, dpr)
        canvas.height = clampedCanvasSize(height, dpr)
        if (ctx) {
          ctx.resetTransform()
          ctx.scale(dpr, dpr)
        }
        scheduleIfStoreHasOutlines()
      },
      setVisible: visible => {
        canvas.style.display = visible ? 'block' : 'none'
      },
      clear: () => {
        drawLoop.cancel()
        if (ctx) {
          const currentDpr = getDpr()
          ctx.clearRect(
            0,
            0,
            canvas.width / currentDpr,
            canvas.height / currentDpr,
          )
        }
      },
    }

    yield* finalizeDrawLoop(drawLoop)

    return painter
  })
