/* eslint-disable @typescript-eslint/consistent-type-assertions */
import {
  Context,
  Effect,
  Layer,
  Option,
  Ref,
  Stream,
  SubscriptionRef,
} from 'effect'

import { OutlineCommand } from './commands.js'
import { OUTLINE_ENABLED_KEY, OUTLINE_Z_INDEX } from './constants.js'
import { dispatchOutlineCommand } from './dispatch.js'
import { clampedCanvasSize, getDpr } from './geometry.js'
import { acquireMainPainter } from './painterMain.js'
import { acquireWorkerPainter } from './painterWorker.js'
import {
  buildOutlineSnapshot,
  findOutlineInStore,
  makeOutlineStore,
} from './store.js'
import {
  acquireScrollIngress,
  outlineBatchStream,
  resizeCommandStream,
} from './streams.js'
import type { ActiveOutline, OutlineRect, OutlineSnapshot } from './types.js'

export type OutlineService = Readonly<{
  setEnabled: (enabled: boolean) => void
  setFilter: (predicate: (id: string) => boolean) => void
  clearFilter: () => void
  findAt: (x: number, y: number) => Option.Option<OutlineRect>
  snapshot: () => OutlineSnapshot
  changes: Stream.Stream<OutlineSnapshot>
}>

export class Outline extends Context.Service<Outline, OutlineService>()(
  '@foldkit/devtools/Outline',
) {}

type OutlineWindow = Window & Record<string, unknown>

const syncOutlineWindowFlag = (enabled: boolean): void => {
  getOutlineWindow()[OUTLINE_ENABLED_KEY] = enabled
}

const getOutlineWindow = (): OutlineWindow => window as unknown as OutlineWindow

const acquireCanvasElement = (initialEnabled: boolean) =>
  Effect.acquireRelease(
    Effect.sync(() => {
      const canvas = document.createElement('canvas')
      canvas.dataset['foldkitOutlines'] = 'true'
      canvas.style.position = 'fixed'
      canvas.style.inset = '0'
      canvas.style.width = `${window.innerWidth}px`
      canvas.style.height = `${window.innerHeight}px`
      canvas.style.pointerEvents = 'none'
      canvas.style.zIndex = OUTLINE_Z_INDEX
      canvas.style.display = initialEnabled ? 'block' : 'none'
      const dpr = getDpr()
      canvas.width = clampedCanvasSize(window.innerWidth, dpr)
      canvas.height = clampedCanvasSize(window.innerHeight, dpr)
      document.body.appendChild(canvas)
      return canvas
    }),
    canvas => Effect.sync(() => canvas.remove()),
  )

const makeNoopOutlineService = (
  store: Map<string, ActiveOutline>,
  enabledRef: Ref.Ref<boolean>,
  filterRef: Ref.Ref<Option.Option<(id: string) => boolean>>,
  snapshotRef: SubscriptionRef.SubscriptionRef<OutlineSnapshot>,
): OutlineService => {
  const publishSnapshot = (): OutlineSnapshot => {
    const isEnabled = Effect.runSync(Ref.get(enabledRef))
    return buildOutlineSnapshot(isEnabled, store)
  }

  const refreshSnapshot = (): void => {
    Effect.runSync(SubscriptionRef.set(snapshotRef, publishSnapshot()))
  }

  return {
    setEnabled: enabled => {
      Effect.runSync(Ref.set(enabledRef, enabled))
      syncOutlineWindowFlag(enabled)
      refreshSnapshot()
    },
    setFilter: predicate =>
      Effect.runSync(Ref.set(filterRef, Option.some(predicate))),
    clearFilter: () => Effect.runSync(Ref.set(filterRef, Option.none())),
    findAt: (x, y) => findOutlineInStore(store, x, y),
    snapshot: publishSnapshot,
    changes: SubscriptionRef.changes(snapshotRef),
  }
}

export const makeOutlineService = (initialEnabled: boolean) =>
  Effect.gen(function* () {
    const store = makeOutlineStore()
    const storeRef = yield* Ref.make(store)
    const enabledRef = yield* Ref.make(initialEnabled)
    const filterRef = yield* Ref.make<Option.Option<(id: string) => boolean>>(
      Option.none(),
    )

    syncOutlineWindowFlag(initialEnabled)

    const publishSnapshot = (): OutlineSnapshot => {
      const isEnabled = Effect.runSync(Ref.get(enabledRef))
      const currentStore = Effect.runSync(Ref.get(storeRef))
      return buildOutlineSnapshot(isEnabled, currentStore)
    }

    const snapshotRef = yield* SubscriptionRef.make(publishSnapshot())

    const refreshSnapshot = (): void => {
      Effect.runSync(SubscriptionRef.set(snapshotRef, publishSnapshot()))
    }

    if (typeof document === 'undefined' || !document.body) {
      return makeNoopOutlineService(store, enabledRef, filterRef, snapshotRef)
    }

    const canvas = yield* acquireCanvasElement(initialEnabled)
    const dpr = getDpr()
    const painter = yield* acquireWorkerPainter(canvas, dpr).pipe(
      Effect.catch(() => acquireMainPainter(canvas, storeRef, enabledRef)),
    )

    const dispatch = (command: OutlineCommand) =>
      Effect.gen(function* () {
        const enabled = yield* Ref.get(enabledRef)
        const currentStore = yield* Ref.get(storeRef)
        yield* dispatchOutlineCommand(
          command,
          currentStore,
          filterRef,
          painter,
          enabled,
        )
        if (
          command._tag === 'PushRects' ||
          command._tag === 'Scroll' ||
          command._tag === 'Clear'
        ) {
          refreshSnapshot()
        }
      })

    const dispatchSync = (command: OutlineCommand): void => {
      Effect.runSync(dispatch(command))
    }

    yield* acquireScrollIngress(store, commands => {
      for (const command of commands) {
        dispatchSync(command)
      }
    })

    yield* Effect.forkScoped(
      Stream.runForEach(outlineBatchStream, rects =>
        dispatch(OutlineCommand.PushRects({ rects })),
      ),
    )

    yield* Effect.forkScoped(
      Stream.runForEach(resizeCommandStream, command => dispatch(command)),
    )

    const service: OutlineService = {
      setEnabled: enabled => {
        Effect.runSync(Ref.set(enabledRef, enabled))
        syncOutlineWindowFlag(enabled)
        dispatchSync(OutlineCommand.SetVisible({ visible: enabled }))
        if (!enabled) {
          dispatchSync(OutlineCommand.Clear())
        }
        refreshSnapshot()
      },
      setFilter: predicate =>
        Effect.runSync(Ref.set(filterRef, Option.some(predicate))),
      clearFilter: () => Effect.runSync(Ref.set(filterRef, Option.none())),
      findAt: (x, y) => {
        const currentStore = Effect.runSync(Ref.get(storeRef))
        return findOutlineInStore(currentStore, x, y)
      },
      snapshot: publishSnapshot,
      changes: SubscriptionRef.changes(snapshotRef),
    }

    return service
  })

export const layerOutline = (initialEnabled: boolean) =>
  Layer.effect(Outline, makeOutlineService(initialEnabled))
