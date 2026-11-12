import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Overlay, type OverlayPayload } from './Overlay'

declare global {
  interface Window {
    overlay: {
      onShow(cb: (p: OverlayPayload) => void): void
      ready(): void
      answer(id: string, a: 'coming' | 'busy5' | 'dismissed'): void
    }
  }
}

// Register the listener synchronously (before React renders) and buffer into a module-level
// holder, so a payload arriving before the first render is not lost.
let latest: OverlayPayload | null = null
let push: ((p: OverlayPayload) => void) | null = null
window.overlay.onShow((p) => {
  latest = p
  push?.(p)
})

function App(): JSX.Element | null {
  const [payload, setPayload] = useState<OverlayPayload | null>(latest)
  useEffect(() => {
    push = setPayload
    if (latest) setPayload(latest)
    return () => { push = null }
  }, [])
  return payload ? <Overlay payload={payload} onAnswer={(id, a) => window.overlay.answer(id, a)} /> : null
}

createRoot(document.getElementById('root')!).render(<App />)
window.overlay.ready()
