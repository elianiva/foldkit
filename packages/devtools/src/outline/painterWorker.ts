import { Data, Effect } from 'effect'

import type { OutlinePainter } from './painter.js'
import { WorkerCommand, toWorkerWireEnvelope } from './protocol.js'
import type { OutlineRect } from './types.js'

declare global {
  interface ImportMeta {
    readonly env: { readonly DEV: boolean }
  }
}

class OutlineWorkerUnavailable extends Data.TaggedError(
  'OutlineWorkerUnavailable',
)<{
  readonly reason: string
}> {}

const devWarn = (...args: Array<unknown>): void => {
  if (import.meta.env.DEV) {
    console.warn(...args)
  }
}

const postWorkerEnvelope = (
  worker: Worker,
  command: WorkerCommand,
): Effect.Effect<void, OutlineWorkerUnavailable> => {
  const envelope = toWorkerWireEnvelope(command)
  return Effect.try({
    try: () => {
      if (envelope.transfer !== undefined) {
        worker.postMessage(envelope.message, {
          transfer: [...envelope.transfer],
        })
      } else {
        worker.postMessage(envelope.message)
      }
    },
    catch: error => new OutlineWorkerUnavailable({ reason: String(error) }),
  })
}

export const acquireWorkerPainter = (canvas: HTMLCanvasElement, dpr: number) =>
  Effect.gen(function* () {
    if (
      typeof OffscreenCanvas === 'undefined' ||
      typeof Worker === 'undefined'
    ) {
      return yield* Effect.fail(
        new OutlineWorkerUnavailable({ reason: 'API missing' }),
      )
    }

    const worker = yield* Effect.try({
      try: () =>
        new Worker(new URL('./offscreen-canvas.worker.js', import.meta.url), {
          type: 'module',
        }),
      catch: error =>
        new OutlineWorkerUnavailable({
          reason: `[foldkit] outline worker .js load failed: ${String(error)}`,
        }),
    }).pipe(Effect.tapError(error => Effect.sync(() => devWarn(error.reason))))

    const offscreen = yield* Effect.try({
      try: () => canvas.transferControlToOffscreen(),
      catch: error => {
        worker.terminate()
        return new OutlineWorkerUnavailable({
          reason: `[foldkit] outline transferControlToOffscreen failed: ${String(error)}`,
        })
      },
    }).pipe(Effect.tapError(error => Effect.sync(() => devWarn(error.reason))))

    yield* postWorkerEnvelope(
      worker,
      WorkerCommand.Init({
        canvas: offscreen,
        width: window.innerWidth,
        height: window.innerHeight,
        dpr,
      }),
    ).pipe(
      Effect.tapError(() => Effect.sync(() => worker.terminate())),
      Effect.tapError(error => Effect.sync(() => devWarn(error.reason))),
    )

    const postCommand = (command: WorkerCommand): void => {
      const envelope = toWorkerWireEnvelope(command)
      if (envelope.transfer !== undefined) {
        worker.postMessage(envelope.message, {
          transfer: [...envelope.transfer],
        })
      } else {
        worker.postMessage(envelope.message)
      }
    }

    const painter: OutlinePainter = {
      pushRects: (rects: ReadonlyArray<OutlineRect>) =>
        postCommand(WorkerCommand.DrawOutlines({ rects })),
      applyScroll: (deltaX, deltaY) =>
        postCommand(WorkerCommand.Scroll({ deltaX, deltaY })),
      resize: (width, height, nextDpr) => {
        canvas.style.width = `${width}px`
        canvas.style.height = `${height}px`
        postCommand(WorkerCommand.Resize({ width, height, dpr: nextDpr }))
      },
      setVisible: visible => {
        canvas.style.display = visible ? 'block' : 'none'
      },
      clear: () => postCommand(WorkerCommand.Clear()),
    }

    yield* Effect.addFinalizer(() =>
      Effect.sync(() => {
        worker.terminate()
      }),
    )

    return painter
  })
