/* eslint-disable @typescript-eslint/consistent-type-assertions */
import {
  drawCanvas as drawShared,
  initCanvas as initShared,
  updateScroll as updateScrollShared,
  updateOutlines as updateShared,
} from './shared.js'
import type { ActiveOutline } from './types.js'

export const updateOutlines = updateShared

export const updateScroll = updateScrollShared

export const initCanvas = (
  canvas: HTMLCanvasElement,
  dpr: number,
): CanvasRenderingContext2D | null =>
  initShared(canvas, dpr) as CanvasRenderingContext2D | null

export const drawCanvas = (
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  dpr: number,
  activeOutlines: Map<string, ActiveOutline>,
): boolean =>
  // `shared.drawCanvas` is generic over OffscreenCanvas as well; this
  // thin wrapper pins the types to the main-thread canvas for callers.
  drawShared(ctx, canvas, dpr, activeOutlines as never)
