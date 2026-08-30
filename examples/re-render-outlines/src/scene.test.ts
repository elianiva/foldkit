import { click, expect, given, role, scene, text } from 'foldkit/scene'
import { describe, test } from 'vitest'

import { type Model, update, view } from './main'

const initialModel: Model = {
  isMemoized: true,
  tick: 0,
  counter: 0,
  items: [
    { id: 'item-1', label: 'Item 1', value: 0 },
    { id: 'item-2', label: 'Item 2', value: 0 },
    { id: 'item-3', label: 'Item 3', value: 0 },
    { id: 'item-4', label: 'Item 4', value: 0 },
    { id: 'item-5', label: 'Item 5', value: 0 },
  ],
}

describe('view', () => {
  test('renders the memoization controls and counter region', () => {
    scene(
      { update, view },
      given(initialModel),
      expect(text('View Memoization')).toExist(),
      expect(role('button', { name: 'Increment tick' })).toExist(),
      expect(role('button', { name: 'Increment counter' })).toExist(),
      expect(text('Counter state')).toExist(),
      expect(text('0')).toExist(),
    )
  })

  test('increment tick updates the counter region', () => {
    scene(
      { update, view },
      given(initialModel),
      click(role('button', { name: 'Increment tick' })),
      expect(text('1')).toExist(),
    )
  })
})
