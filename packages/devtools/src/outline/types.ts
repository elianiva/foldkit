export type OutlineRect = Readonly<{
  id: string
  label: string
  x: number
  y: number
  width: number
  height: number
  cause?: string
}>

export type ActiveOutline = Readonly<{
  id: string
  label: string
  x: number
  y: number
  width: number
  height: number
  targetX: number
  targetY: number
  targetWidth: number
  targetHeight: number
  frame: number
  count: number
  cause?: string
}>
