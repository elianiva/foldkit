const stack: Array<boolean> = []

export const beginDirty = (): void => {
  stack.push(false)
}

export const markDirty = (): void => {
  if (stack.length > 0) {
    stack[stack.length - 1] = true
  } else {
    stack.push(true)
  }
}

export const consumeDirty = (): boolean => {
  if (stack.length === 0) {
    return false
  }
  const next = stack.pop()!
  return next
}
