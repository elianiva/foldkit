import { Effect, Match as M, Option, Ref } from 'effect'

import { OutlineCommand } from './commands.js'
import { updateOutlines, updateScroll } from './model.js'
import type { OutlinePainter } from './painter.js'
import type { ActiveOutline, OutlineRect } from './types.js'

export const dispatchOutlineCommand = (
  command: OutlineCommand,
  store: Map<string, ActiveOutline>,
  filterRef: Ref.Ref<Option.Option<(id: string) => boolean>>,
  painter: OutlinePainter,
  enabled: boolean,
): Effect.Effect<void> => {
  const shouldProcess =
    enabled || command._tag === 'Clear' || command._tag === 'SetVisible'
  if (!shouldProcess) {
    return Effect.void
  }

  return M.value(command).pipe(
    M.tagsExhaustive({
      PushRects: ({ rects }) =>
        Effect.gen(function* () {
          if (rects.length === 0) {
            return
          }
          const filter = yield* Ref.get(filterRef)
          const filtered: ReadonlyArray<OutlineRect> = Option.match(filter, {
            onNone: () => rects,
            onSome: predicate => rects.filter(rect => predicate(rect.id)),
          })
          if (filtered.length === 0) {
            return
          }
          updateOutlines(store, filtered)
          painter.pushRects(filtered)
        }),
      Scroll: ({ deltaX, deltaY }) =>
        Effect.sync(() => {
          if (store.size > 0) {
            updateScroll(store, deltaX, deltaY)
          }
          painter.applyScroll(deltaX, deltaY)
        }),
      Resize: ({ width, height, dpr }) =>
        Effect.sync(() => painter.resize(width, height, dpr)),
      Clear: () =>
        Effect.sync(() => {
          store.clear()
          painter.clear()
        }),
      SetVisible: ({ visible }) =>
        Effect.sync(() => painter.setVisible(visible)),
    }),
  )
}
