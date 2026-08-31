import { Array, Option } from 'effect'

import type {
  ActiveOutline,
  OutlineActiveEntry,
  OutlineRect,
  OutlineSnapshot,
} from './types.js'

export const makeOutlineStore = (): Map<string, ActiveOutline> => new Map()

export const clearOutlineStore = (store: Map<string, ActiveOutline>): void => {
  store.clear()
}

export const findOutlineInStore = (
  store: Map<string, ActiveOutline>,
  x: number,
  y: number,
): Option.Option<OutlineRect> => {
  for (const outline of store.values()) {
    if (
      x >= outline.x &&
      x <= outline.x + outline.width &&
      y >= outline.y &&
      y <= outline.y + outline.height
    ) {
      return Option.some({
        id: outline.id,
        label: outline.label,
        x: outline.x,
        y: outline.y,
        width: outline.width,
        height: outline.height,
        ...(outline.cause !== undefined ? { cause: outline.cause } : {}),
      })
    }
  }
  return Option.none()
}

export const statsFromStore = (
  store: Map<string, ActiveOutline>,
): Readonly<{ total: number; hottest: Option.Option<string> }> => {
  let hottest = Option.none<string>()
  let maxCount = 0
  for (const outline of store.values()) {
    if (outline.count > maxCount) {
      maxCount = outline.count
      hottest = Option.some(outline.id)
    }
  }
  return { total: store.size, hottest }
}

export const activeEntriesFromStore = (
  store: Map<string, ActiveOutline>,
): ReadonlyArray<OutlineActiveEntry> =>
  Array.fromIterable(store.values()).map(outline => ({
    id: outline.id,
    label: outline.label,
    x: outline.x,
    y: outline.y,
    width: outline.width,
    height: outline.height,
    count: outline.count,
    ...(outline.cause !== undefined ? { cause: outline.cause } : {}),
  }))

export const buildOutlineSnapshot = (
  isEnabled: boolean,
  store: Map<string, ActiveOutline>,
): OutlineSnapshot => {
  const stats = statsFromStore(store)
  return {
    isEnabled,
    total: stats.total,
    hottest: stats.hottest,
    activeOutlines: activeEntriesFromStore(store),
  }
}

export const isOutlineIdFiltered = (
  id: string,
  filter: Option.Option<(id: string) => boolean>,
): boolean =>
  Option.match(filter, {
    onNone: () => true,
    onSome: predicate => predicate(id),
  })
