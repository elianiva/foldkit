/* eslint-disable @typescript-eslint/consistent-type-assertions */
import { Data, Match as M } from 'effect'

import type { OutlineRect } from './types.js'

export type WorkerCommand = Data.TaggedEnum<{
  Init: {
    canvas: OffscreenCanvas
    width: number
    height: number
    dpr: number
  }
  DrawOutlines: { rects: ReadonlyArray<OutlineRect> }
  Scroll: { deltaX: number; deltaY: number }
  Resize: { width: number; height: number; dpr: number }
  Clear: {}
}>

export const WorkerCommand = Data.taggedEnum<WorkerCommand>()

export type WorkerWireMessage =
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

export type WorkerWireEnvelope = Readonly<{
  message: WorkerWireMessage
  transfer?: ReadonlyArray<Transferable>
}>

export const toWorkerWireEnvelope = (
  command: WorkerCommand,
): WorkerWireEnvelope =>
  M.value(command).pipe(
    M.tagsExhaustive({
      Init: ({ canvas, width, height, dpr }) => ({
        message: {
          type: 'init',
          canvas,
          width,
          height,
          dpr,
        } satisfies WorkerWireMessage,
        transfer: [canvas as unknown as Transferable],
      }),
      DrawOutlines: ({ rects }) => ({
        message: {
          type: 'draw-outlines',
          rects,
        } satisfies WorkerWireMessage,
      }),
      Scroll: ({ deltaX, deltaY }) => ({
        message: {
          type: 'scroll',
          deltaX,
          deltaY,
        } satisfies WorkerWireMessage,
      }),
      Resize: ({ width, height, dpr }) => ({
        message: {
          type: 'resize',
          width,
          height,
          dpr,
        } satisfies WorkerWireMessage,
      }),
      Clear: () => ({
        message: { type: 'clear' } satisfies WorkerWireMessage,
      }),
    }),
  )
