import '@testing-library/jest-dom'

/**
 * jsdom implements no `matchMedia`; the dashboard reads `prefers-reduced-motion` through it.
 * Reports no match, which is what a test with no display should see.
 */
if (typeof globalThis.matchMedia === 'undefined') {
  Object.assign(globalThis, {
    matchMedia: (media: string) => ({
      media,
      matches: false,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false
    })
  })
}

if (typeof globalThis.ResizeObserver === 'undefined') {
  /** Never fires: jsdom has no layout, so any size would be fiction. */
  class NoopResizeObserver {
    observe = (): undefined => undefined
    unobserve = (): undefined => undefined
    disconnect = (): undefined => undefined
  }
  Object.assign(globalThis, { ResizeObserver: NoopResizeObserver })
}
