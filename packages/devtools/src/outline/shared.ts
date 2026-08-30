/* eslint-disable @typescript-eslint/consistent-type-assertions */
import type { ActiveOutline, OutlineRect } from './types.js'

type CanvasWithTextRendering = { textRendering: string }

export const MONO_FONT =
  'Menlo,Consolas,Monaco,Liberation Mono,Lucida Console,monospace'

export const PRIMARY_COLOR = '115,97,230'

const PRIMARY_RGB: readonly [number, number, number] = [115, 97, 230]
const HOT_RGB: readonly [number, number, number] = [239, 68, 68]

export const INTERPOLATION_SPEED = 0.2

export const SNAP_THRESHOLD = 0.5

export const MAX_LABEL_LENGTH = 40

export const TOTAL_FRAMES = 45

const BOUNDARY_SEPARATOR = '|'

export const lerp = (start: number, end: number): number => {
  const delta = end - start
  if (Math.abs(delta) < SNAP_THRESHOLD) {
    return end
  }
  return start + delta * INTERPOLATION_SPEED
}

const heatColor = (count: number): string => {
  const heat = Math.min(count / 5, 1)
  const r = Math.round(PRIMARY_RGB[0] + (HOT_RGB[0] - PRIMARY_RGB[0]) * heat)
  const g = Math.round(PRIMARY_RGB[1] + (HOT_RGB[1] - PRIMARY_RGB[1]) * heat)
  const b = Math.round(PRIMARY_RGB[2] + (HOT_RGB[2] - PRIMARY_RGB[2]) * heat)
  return `${r},${g},${b}`
}

export const updateOutlines = (
  activeOutlines: Map<string, ActiveOutline>,
  rects: ReadonlyArray<OutlineRect>,
): void => {
  for (const rect of rects) {
    const existing = activeOutlines.get(rect.id)
    if (existing) {
      const next: ActiveOutline = {
        ...existing,
        count: existing.count + 1,
        frame: 0,
        targetX: rect.x,
        targetY: rect.y,
        targetWidth: rect.width,
        targetHeight: rect.height,
        label: rect.label,
        ...(rect.cause !== undefined
          ? { cause: rect.cause }
          : existing.cause !== undefined
            ? { cause: existing.cause }
            : {}),
      }
      activeOutlines.set(rect.id, next)
    } else {
      const outline: ActiveOutline = {
        id: rect.id,
        label: rect.label,
        ...(rect.cause !== undefined ? { cause: rect.cause } : {}),
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        targetX: rect.x,
        targetY: rect.y,
        targetWidth: rect.width,
        targetHeight: rect.height,
        frame: 0,
        count: 1,
      }
      activeOutlines.set(rect.id, outline)
    }
  }
}

export const updateScroll = (
  activeOutlines: Map<string, ActiveOutline>,
  deltaX: number,
  deltaY: number,
): void => {
  for (const [id, outline] of activeOutlines) {
    activeOutlines.set(id, {
      ...outline,
      targetX: outline.targetX - deltaX,
      targetY: outline.targetY - deltaY,
    })
  }
}

export const getLabelText = (
  outlines: ReadonlyArray<ActiveOutline>,
): string => {
  const counts = new Map<string, number>()
  const causeByLabel = new Map<string, string>()
  for (const o of outlines) {
    counts.set(o.label, (counts.get(o.label) ?? 0) + o.count)
    if (o.cause !== undefined && !causeByLabel.has(o.label)) {
      causeByLabel.set(o.label, o.cause)
    }
  }
  const parts: Array<string> = []
  for (const [label, count] of counts) {
    const short = label.split(BOUNDARY_SEPARATOR).at(-1) ?? label
    const cause = causeByLabel.get(label)
    if (cause !== undefined) {
      parts.push(`${short} ×${count} (${cause})`)
    } else {
      parts.push(`${short} ×${count}`)
    }
  }
  let text = parts.join(', ')
  if (text.length > MAX_LABEL_LENGTH) {
    text = `${text.slice(0, MAX_LABEL_LENGTH)}…`
  }
  return text
}

export const initCanvas = (
  canvas: HTMLCanvasElement | OffscreenCanvas,
  dpr: number,
): CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null => {
  const ctx = canvas.getContext('2d', { alpha: true }) as
    CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null
  if (ctx) {
    ctx.scale(dpr, dpr)
  }
  return ctx
}

export const advanceOutlines = (
  activeOutlines: Map<string, ActiveOutline>,
): void => {
  for (const [id, outline] of activeOutlines) {
    let {
      x,
      y,
      width,
      height,
      targetX,
      targetY,
      targetWidth,
      targetHeight,
      frame,
    } = outline
    if (targetX !== x) {
      x = lerp(x, targetX)
    }
    if (targetY !== y) {
      y = lerp(y, targetY)
    }
    if (targetWidth !== width) {
      width = lerp(width, targetWidth)
    }
    if (targetHeight !== height) {
      height = lerp(height, targetHeight)
    }
    const nextFrame = frame + 1
    const nextOutline: ActiveOutline = {
      ...outline,
      x,
      y,
      width,
      height,
      frame: nextFrame,
    }
    activeOutlines.set(id, nextOutline)
  }
}

export const buildRectMap = (
  activeOutlines: Map<string, ActiveOutline>,
): Map<
  string,
  {
    x: number
    y: number
    width: number
    height: number
    alpha: number
    color: string
  }
> => {
  const rectMap = new Map<
    string,
    {
      x: number
      y: number
      width: number
      height: number
      alpha: number
      color: string
    }
  >()
  for (const outline of activeOutlines.values()) {
    const alpha = 1 - (outline.frame - 1) / TOTAL_FRAMES
    const rectKey = `${outline.targetX},${outline.targetY},${outline.targetWidth},${outline.targetHeight}`
    const color = heatColor(outline.count)
    const existing = rectMap.get(rectKey)
    if (!existing || alpha > existing.alpha) {
      rectMap.set(rectKey, {
        x: outline.x,
        y: outline.y,
        width: outline.width,
        height: outline.height,
        alpha,
        color,
      })
    }
  }
  return rectMap
}

export const buildLabels = (
  activeOutlines: Map<string, ActiveOutline>,
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
): Array<{
  x: number
  y: number
  text: string
  width: number
  height: number
  alpha: number
  outlines: Array<ActiveOutline>
}> => {
  const groupedByLabel = new Map<string, Array<ActiveOutline>>()
  for (const outline of activeOutlines.values()) {
    const labelKey = `${outline.targetX},${outline.targetY}`
    const group = groupedByLabel.get(labelKey)
    if (group) {
      group.push(outline)
    } else {
      groupedByLabel.set(labelKey, [outline])
    }
  }
  const labels: Array<{
    x: number
    y: number
    text: string
    width: number
    height: number
    alpha: number
    outlines: Array<ActiveOutline>
  }> = []
  for (const outlines of groupedByLabel.values()) {
    const first = outlines[0]!
    const alpha = 1 - first.frame / TOTAL_FRAMES
    const text = getLabelText(outlines)
    const { width } = ctx.measureText(text)
    const height = 11
    labels.push({
      x: first.x,
      y: first.y,
      text,
      width,
      height,
      alpha,
      outlines: [...outlines],
    })
  }
  return labels
}

export const expireOutlines = (
  activeOutlines: Map<string, ActiveOutline>,
): void => {
  for (const [id, outline] of activeOutlines) {
    if (outline.frame > TOTAL_FRAMES) {
      activeOutlines.delete(id)
    }
  }
}

export const drawCanvas = (
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  canvas: HTMLCanvasElement | OffscreenCanvas,
  dpr: number,
  activeOutlines: Map<string, ActiveOutline>,
): boolean => {
  ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr)

  advanceOutlines(activeOutlines)

  const rectMap = buildRectMap(activeOutlines)

  for (const { x, y, width, height, alpha, color } of rectMap.values()) {
    ctx.strokeStyle = `rgba(${color},${alpha})`
    ctx.lineWidth = 1
    const rx = Math.round(x) + 0.5
    const ry = Math.round(y) + 0.5
    const rw = Math.round(width)
    const rh = Math.round(height)
    ctx.beginPath()
    ctx.rect(rx, ry, rw, rh)
    ctx.stroke()
    ctx.fillStyle = `rgba(${color},${alpha * 0.1})`
    ctx.fill()
  }

  if ('textRendering' in ctx) {
    ;(ctx as unknown as CanvasWithTextRendering).textRendering = 'optimizeSpeed'
  }
  ctx.font = `11px ${MONO_FONT}`

  const labels = buildLabels(activeOutlines, ctx)

  // Expiration must happen after label measurement so the last frame still contributes to a label.
  expireOutlines(activeOutlines)

  labels.sort((a, b) => {
    const areaA = a.outlines.reduce((s, o) => s + o.width * o.height, 0)
    const areaB = b.outlines.reduce((s, o) => s + o.width * o.height, 0)
    return areaB - areaA
  })

  const merged: typeof labels = []
  const removed = new Set<number>()
  for (let i = 0; i < labels.length; i++) {
    if (removed.has(i)) {
      continue
    }
    const current = labels[i]!
    for (let j = i + 1; j < labels.length; j++) {
      if (removed.has(j)) {
        continue
      }
      const other = labels[j]!
      const overlap =
        current.x + current.width > other.x &&
        other.x + other.width > current.x &&
        current.y + current.height > other.y &&
        other.y + other.height > current.y
      if (overlap) {
        current.text = getLabelText([...current.outlines, ...other.outlines])
        current.width = ctx.measureText(current.text).width
        current.outlines.push(...other.outlines)
        removed.add(j)
      }
    }
    merged.push(current)
  }

  for (const label of merged) {
    let labelY = label.y - label.height - 4
    if (labelY < 0) {
      labelY = 0
    }
    ctx.fillStyle = `rgba(${PRIMARY_COLOR},${label.alpha})`
    ctx.fillRect(label.x, labelY, label.width + 4, label.height + 4)
    ctx.fillStyle = `rgba(255,255,255,${label.alpha})`
    ctx.fillText(label.text, label.x + 2, labelY + label.height)
  }

  return activeOutlines.size > 0
}
